// Google OAuth + the small slice of Gmail and Calendar the worker agent uses.
// Plain fetch against Google's REST APIs (no googleapis package).
//
// Safety rules enforced here, not just in the prompt:
// - Gmail: read, search and create DRAFTS only. There is no send function.
// - Calendar: events are created without attendees and with sendUpdates=none,
//   so no invitation is ever sent to anyone.

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { googleAccounts } from "../db/schema.js";
import { decrypt, encrypt } from "./crypto.js";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR = "https://www.googleapis.com/calendar/v3/calendars/primary";

/** A Google problem the user (or the model) can understand and act on. */
export class GoogleError extends Error {}

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new GoogleError(
      "Google isn't configured on the server (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      throw new GoogleError(
        "Google access has expired or was revoked. Reconnect Google in Settings."
      );
    }
    throw new Error(
      `Google token request failed (${res.status}): ${data.error ?? ""} ${data.error_description ?? ""}`.trim()
    );
  }
  return data as TokenResponse;
}

// Access tokens cached in memory per user until shortly before they expire.
const accessTokens = new Map<string, { token: string; expiresAt: number }>();

function cacheAccessToken(userId: string, tokens: TokenResponse) {
  accessTokens.set(userId, {
    token: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in - 60) * 1000,
  });
}

/** Finish the OAuth flow: exchange the code, look up the email, store the account. */
export async function completeGoogleConnect(userId: string, code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = config();
  const tokens = await tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const infoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) throw new Error(`Google userinfo failed (${infoRes.status})`);
  const info = (await infoRes.json()) as { email?: string };
  if (!info.email) throw new Error("Google didn't return an email address");

  const scopes = tokens.scope ?? GOOGLE_SCOPES.join(" ");
  let refreshTokenEnc: string;
  if (tokens.refresh_token) {
    refreshTokenEnc = encrypt(tokens.refresh_token);
  } else {
    // Google omits the refresh token on some re-consents; keep the stored one.
    const existing = await db.query.googleAccounts.findFirst({
      where: eq(googleAccounts.userId, userId),
    });
    if (!existing) throw new Error("Google didn't return a refresh token");
    refreshTokenEnc = existing.refreshTokenEnc;
  }

  await db
    .insert(googleAccounts)
    .values({ userId, email: info.email, refreshTokenEnc, scopes })
    .onConflictDoUpdate({
      target: googleAccounts.userId,
      set: { email: info.email, refreshTokenEnc, scopes },
    });
  cacheAccessToken(userId, tokens);
}

export async function getGoogleAccount(userId: string) {
  const row = await db.query.googleAccounts.findFirst({
    where: eq(googleAccounts.userId, userId),
  });
  return row ?? null;
}

/** Revoke at Google (best effort) and forget the account. */
export async function disconnectGoogle(userId: string): Promise<void> {
  const row = await getGoogleAccount(userId);
  accessTokens.delete(userId);
  if (!row) return;
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: decrypt(row.refreshTokenEnc) }),
    });
  } catch (err) {
    console.error("[google] revoke failed", err);
  }
  await db.delete(googleAccounts).where(eq(googleAccounts.userId, userId));
}

async function getAccessToken(userId: string): Promise<string> {
  const cached = accessTokens.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const row = await getGoogleAccount(userId);
  if (!row) throw new GoogleError("Google isn't connected.");
  const { clientId, clientSecret } = config();
  const tokens = await tokenRequest({
    refresh_token: decrypt(row.refreshTokenEnc),
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  cacheAccessToken(userId, tokens);
  return tokens.access_token;
}

/** Authorized JSON request to a Google API; retries once with a fresh token on 401. */
async function googleApi<T>(userId: string, url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken(userId);
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (res.status === 401 && attempt === 0) {
      accessTokens.delete(userId);
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 403) {
        throw new GoogleError(
          `Google denied access (403). The needed permission may not have been granted; reconnect Google in Settings. ${text.slice(0, 300)}`
        );
      }
      if (res.status === 404) throw new GoogleError("Not found at Google (404).");
      throw new GoogleError(`Google API error ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }
  throw new GoogleError("Google rejected the access token. Reconnect Google in Settings.");
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailPart;
};

function header(part: GmailPart | undefined, name: string): string | undefined {
  return part?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

export async function gmailSearch(userId: string, query: string, max = 10) {
  const list = await googleApi<{ messages?: { id: string; threadId: string }[] }>(
    userId,
    `${GMAIL}/messages?${new URLSearchParams({ q: query, maxResults: String(max) })}`
  );
  const ids = (list.messages ?? []).slice(0, max);
  const meta = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "To", "Subject", "Date"]) meta.append("metadataHeaders", h);
  return Promise.all(
    ids.map(async ({ id }) => {
      const m = await googleApi<GmailMessage>(userId, `${GMAIL}/messages/${id}?${meta}`);
      return {
        id: m.id,
        threadId: m.threadId,
        from: header(m.payload, "From") ?? null,
        to: header(m.payload, "To") ?? null,
        subject: header(m.payload, "Subject") ?? null,
        date: header(m.payload, "Date") ?? null,
        snippet: m.snippet ?? "",
      };
    })
  );
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function findBody(part: GmailPart | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data && !part.filename) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const found = findBody(child, mime);
    if (found != null) return found;
  }
  return null;
}

function listAttachments(part: GmailPart | undefined, out: string[] = []): string[] {
  if (!part) return out;
  if (part.filename) out.push(part.filename);
  for (const child of part.parts ?? []) listAttachments(child, out);
  return out;
}

const MAX_BODY_CHARS = 8000;

export async function gmailRead(userId: string, id: string) {
  const m = await googleApi<GmailMessage>(
    userId,
    `${GMAIL}/messages/${encodeURIComponent(id)}?format=full`
  );
  const plain = findBody(m.payload, "text/plain");
  const html = plain == null ? findBody(m.payload, "text/html") : null;
  let body = plain ?? (html != null ? htmlToText(html) : m.snippet ?? "");
  const truncated = body.length > MAX_BODY_CHARS;
  if (truncated) body = body.slice(0, MAX_BODY_CHARS);
  return {
    id: m.id,
    threadId: m.threadId,
    from: header(m.payload, "From") ?? null,
    to: header(m.payload, "To") ?? null,
    cc: header(m.payload, "Cc") ?? null,
    subject: header(m.payload, "Subject") ?? null,
    date: header(m.payload, "Date") ?? null,
    attachments: listAttachments(m.payload),
    body,
    truncated,
  };
}

/** Strip CR/LF so a value can't inject extra headers. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoded-word(s) for a header value, only when it isn't plain ASCII. */
export function encodeHeaderValue(value: string): string {
  const clean = oneLine(value);
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;
  // Keep each encoded word under 75 chars: <=45 bytes of UTF-8 per word.
  const words: string[] = [];
  let chunk = "";
  for (const ch of clean) {
    if (Buffer.byteLength(chunk + ch, "utf8") > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words
    .map((w) => `=?UTF-8?B?${Buffer.from(w, "utf8").toString("base64")}?=`)
    .join("\r\n ");
}

export type DraftInput = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
};

/** Build an RFC 2822 message (UTF-8 plain text) and return it base64url-encoded for Gmail. */
export function buildRawMessage(input: DraftInput): string {
  const headers = [`To: ${oneLine(input.to)}`];
  if (input.cc?.trim()) headers.push(`Cc: ${oneLine(input.cc)}`);
  headers.push(`Subject: ${encodeHeaderValue(input.subject)}`);
  if (input.inReplyTo) headers.push(`In-Reply-To: ${oneLine(input.inReplyTo)}`);
  if (input.references) headers.push(`References: ${oneLine(input.references)}`);
  headers.push(
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64"
  );
  const body = input.body.replace(/\r?\n/g, "\r\n");
  const encodedBody = (Buffer.from(body, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join(
    "\r\n"
  );
  const message = `${headers.join("\r\n")}\r\n\r\n${encodedBody}\r\n`;
  return Buffer.from(message, "utf8").toString("base64url");
}

export async function gmailCreateDraft(
  userId: string,
  input: { to: string; cc?: string; subject: string; body: string; replyToMessageId?: string }
) {
  let threadId: string | undefined;
  let inReplyTo: string | undefined;
  let references: string | undefined;
  let subject = input.subject;
  if (input.replyToMessageId) {
    const meta = new URLSearchParams({ format: "metadata" });
    for (const h of ["Message-ID", "References", "Subject"]) meta.append("metadataHeaders", h);
    const original = await googleApi<GmailMessage>(
      userId,
      `${GMAIL}/messages/${encodeURIComponent(input.replyToMessageId)}?${meta}`
    );
    threadId = original.threadId;
    inReplyTo = header(original.payload, "Message-ID");
    const prior = header(original.payload, "References");
    references = [prior, inReplyTo].filter(Boolean).join(" ") || undefined;
    // Gmail threads replies by subject too; keep "Re: <original subject>".
    const originalSubject = header(original.payload, "Subject");
    if (originalSubject && !subject.trim()) subject = originalSubject;
    if (subject && !/^re:/i.test(subject.trim())) subject = `Re: ${subject}`;
  }
  const raw = buildRawMessage({ ...input, subject, inReplyTo, references });
  const draft = await googleApi<{ id: string; message?: { id: string; threadId: string } }>(
    userId,
    `${GMAIL}/drafts`,
    { method: "POST", body: JSON.stringify({ message: { raw, ...(threadId ? { threadId } : {}) } }) }
  );
  return {
    draftId: draft.id,
    messageId: draft.message?.id ?? null,
    threadId: draft.message?.threadId ?? threadId ?? null,
    link: "https://mail.google.com/mail/u/0/#drafts",
  };
}

// ---------------------------------------------------------------------------
// Calendar (primary calendar)
// ---------------------------------------------------------------------------

type CalendarTime = { date?: string; dateTime?: string; timeZone?: string };
type CalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: CalendarTime;
  end?: CalendarTime;
  attendees?: unknown[];
};

export async function calendarListEvents(userId: string, timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "25",
  });
  const data = await googleApi<{ items?: CalendarEvent[]; timeZone?: string }>(
    userId,
    `${CALENDAR}/events?${params}`
  );
  return {
    calendarTimeZone: data.timeZone ?? null,
    events: (data.items ?? []).map((e) => ({
      id: e.id,
      summary: e.summary ?? "(no title)",
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      location: e.location ?? null,
      description: e.description ? e.description.slice(0, 500) : null,
      attendeeCount: e.attendees?.length ?? 0,
      link: e.htmlLink ?? null,
    })),
  };
}

export async function calendarCreateEvent(
  userId: string,
  input: {
    summary: string;
    description?: string;
    location?: string;
    start: CalendarTime;
    end: CalendarTime;
  }
) {
  // Deliberately no `attendees` and sendUpdates=none: never invite anyone.
  const body = {
    summary: input.summary,
    ...(input.description ? { description: input.description } : {}),
    ...(input.location ? { location: input.location } : {}),
    start: input.start,
    end: input.end,
  };
  const event = await googleApi<CalendarEvent>(userId, `${CALENDAR}/events?sendUpdates=none`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    id: event.id,
    summary: event.summary ?? input.summary,
    start: event.start?.dateTime ?? event.start?.date ?? null,
    end: event.end?.dateTime ?? event.end?.date ?? null,
    link: event.htmlLink ?? null,
  };
}
