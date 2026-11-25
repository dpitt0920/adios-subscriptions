import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sign, verify } from "../lib/crypto.js";
import {
  buildAuthUrl,
  completeGoogleConnect,
  disconnectGoogle,
  getGoogleAccount,
  isGoogleConfigured,
} from "../lib/google.js";
import type { AppEnv } from "../types.js";

const STATE_TTL_SECONDS = 10 * 60;

/** The app's deep link: todoagent://, Expo Go (exp:// / exps://), or http(s)://localhost. */
export function isAllowedReturnUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (["todoagent:", "exp:", "exps:"].includes(url.protocol)) return true;
  if (url.protocol === "http:" || url.protocol === "https:") {
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  }
  return false;
}

function withQuery(returnUrl: string, result: "connected" | "error"): string {
  const hashAt = returnUrl.indexOf("#");
  const base = hashAt === -1 ? returnUrl : returnUrl.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : returnUrl.slice(hashAt);
  return `${base}${base.includes("?") ? "&" : "?"}google=${result}${hash}`;
}

type State = { u: string; r: string };

const connectSchema = z.object({
  returnUrl: z
    .string()
    .max(2000)
    .refine(isAllowedReturnUrl, "returnUrl must be a todoagent:, exp:, exps: or http(s)://localhost URL"),
});

/** Authenticated routes, mounted at /api/google. */
const googleRoutes = new Hono<AppEnv>()
  .get("/status", async (c) => {
    const account = await getGoogleAccount(c.get("user").id);
    return c.json({ connected: account != null, email: account?.email ?? null });
  })
  .post("/connect", zValidator("json", connectSchema), async (c) => {
    if (!isGoogleConfigured()) {
      return c.json({ error: "Google isn't set up on this server." }, 503);
    }
    const state = sign(
      { u: c.get("user").id, r: c.req.valid("json").returnUrl } satisfies State,
      STATE_TTL_SECONDS
    );
    return c.json({ url: buildAuthUrl(state) });
  })
  .delete("/", async (c) => {
    await disconnectGoogle(c.get("user").id);
    return c.json({ ok: true as const });
  });

function callbackErrorPage(message: string) {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google connection</title><body style="font-family:system-ui;padding:24px"><h1>Couldn't connect Google</h1><p>${message}</p><p>Go back to the app and try again.</p></body>`;
}

/** Public OAuth callback (no auth middleware), mounted at /google on the root app. */
export const googleCallbackRoutes = new Hono().get("/callback", async (c) => {
  const stateParam = c.req.query("state");
  const state = stateParam ? verify<State>(stateParam) : null;
  if (!state || typeof state.u !== "string" || typeof state.r !== "string" || !isAllowedReturnUrl(state.r)) {
    return c.html(callbackErrorPage("This sign-in link is invalid or has expired."), 400);
  }

  const code = c.req.query("code");
  if (c.req.query("error") || !code) {
    return c.redirect(withQuery(state.r, "error"));
  }

  try {
    await completeGoogleConnect(state.u, code);
    return c.redirect(withQuery(state.r, "connected"));
  } catch (err) {
    console.error("[google] connect failed", err);
    return c.redirect(withQuery(state.r, "error"));
  }
});

export default googleRoutes;
