// Pure derivations of dashboard numbers from the task list.

import { addDays, toDateString } from "@/lib/dates";
import type { Task } from "@/providers/TasksProvider";
import { AREAS, PILES, type Area, type Pile } from "./meta";

export type PileStats = { pile: Pile; open: number; working: number; needsYou: number };
export type AreaStats = { area: Area; open: number };
export type DayStats = { date: string; label: string; count: number; isToday: boolean };

export type DashboardStats = {
  today: { done: number; total: number };
  working: Task[];
  needsYou: Task[];
  failed: Task[];
  piles: PileStats[];
  unsorted: number;
  areas: AreaStats[];
  week: DayStats[];
  weekTotal: number;
  bestDay: number; // index into week, -1 when no completions
  streak: number;
  openTotal: number;
  claudeQueue: number; // open Claude-pile tasks not already being worked on
};

/** Local calendar day of an ISO timestamp. */
function localDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : toDateString(d);
}

const byPriority = (a: Task, b: Task) => a.priority - b.priority;

export function computeStats(tasks: Task[], today: string): DashboardStats {
  const top = tasks.filter((t) => !t.parentId);
  const open = top.filter((t) => !t.completed);

  // Today's ring: what's planned/due today (plus overdue) and what got done today.
  const todays = top.filter((t) => {
    if (t.completed) return localDay(t.completedAt) === today;
    return t.plannedDate === today || (t.dueDate != null && t.dueDate <= today);
  });
  const doneToday = todays.filter((t) => t.completed).length;

  const working = open.filter((t) => t.agentStatus === "working").sort(byPriority);
  const needsYou = open.filter((t) => t.agentStatus === "needs_you").sort(byPriority);
  const failed = open.filter((t) => t.agentStatus === "failed").sort(byPriority);

  const piles = PILES.map(({ key }) => {
    const inPile = open.filter((t) => t.pile === key);
    return {
      pile: key,
      open: inPile.length,
      working: inPile.filter((t) => t.agentStatus === "working").length,
      needsYou: inPile.filter((t) => t.agentStatus === "needs_you").length,
    };
  });

  const areas = AREAS.map(({ key }) => ({
    area: key,
    open: open.filter((t) => (t.area ?? "other") === key).length,
  }));

  // Momentum: completions per local day over the last 7 days (subtasks count too).
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const day = t.completed ? localDay(t.completedAt) : null;
    if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const week: DayStats[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const [y, m, d] = date.split("-").map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "narrow" });
    return { date, label, count: counts.get(date) ?? 0, isToday: i === 6 };
  });
  const weekTotal = week.reduce((s, d) => s + d.count, 0);
  let bestDay = -1;
  week.forEach((d, i) => {
    if (d.count > 0 && (bestDay < 0 || d.count >= week[bestDay].count)) bestDay = i;
  });

  // Streak of consecutive days with a completion, ending today (or yesterday
  // if nothing is done yet today). Limited to the 7 days the app keeps.
  let streak = 0;
  for (let i = week[6].count > 0 ? 6 : 5; i >= 0 && week[i].count > 0; i--) streak++;

  return {
    today: { done: doneToday, total: todays.length },
    working,
    needsYou,
    failed,
    piles,
    unsorted: open.filter((t) => !t.pile).length,
    areas,
    week,
    weekTotal,
    bestDay,
    streak,
    openTotal: open.length,
    claudeQueue: open.filter((t) => t.pile === "claude" && t.agentStatus === "idle").length,
  };
}

/** First readable line of a markdown blob, without markup. */
export function firstLine(markdown: string | null | undefined): string | null {
  if (!markdown) return null;
  for (const raw of markdown.split("\n")) {
    const line = raw
      .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]+/g, "")
      .trim();
    if (line && !/^[-=_*]{3,}$/.test(line)) return line;
  }
  return null;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
