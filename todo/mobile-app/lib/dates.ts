// Dates are exchanged with the backend as local calendar strings (YYYY-MM-DD).

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}

/** e.g. "Wednesday 2026-11-25 14:05" — sent to the agent so it can resolve "tomorrow". */
export function localNowString(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} ${toDateString(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
}

export function formatDue(dueDate: string | null, dueTime: string | null): string | null {
  if (!dueDate) return null;
  const today = todayString();
  let label: string;
  if (dueDate === today) label = "Today";
  else if (dueDate === addDays(today, 1)) label = "Tomorrow";
  else if (dueDate === addDays(today, -1)) label = "Yesterday";
  else {
    const [y, m, d] = dueDate.split("-").map(Number);
    label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return dueTime ? `${label} ${dueTime}` : label;
}

export function isOverdue(dueDate: string | null): boolean {
  return dueDate != null && dueDate < todayString();
}
