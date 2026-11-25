// Single source of truth for app colors.
// Used by both tailwind.config.js and direct style usage.
export const colors = {
  primary: "#5B4BDB",
  "primary-foreground": "#FFFFFF",
  "primary-soft": "#ECE9FD",
  "muted-foreground": "#9D9D9D",
  white: "#FFFFFF",
  "low-shadow": "#D1D1D1",
  "app-bg": "#F4F4F7",
  overdue: "#D93F3F",
  "priority-1": "#D93F3F",
  "priority-2": "#E8890C",
  "priority-3": "#3B7DDD",
  "priority-4": "#B4B4BC",
} as const;

export const PRIORITY_LABELS: Record<number, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
  4: "None",
};

export function priorityColor(priority: number): string {
  return (
    colors[`priority-${priority}` as keyof typeof colors] ?? colors["priority-4"]
  );
}
