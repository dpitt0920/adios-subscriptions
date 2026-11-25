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
  // Piles (who does the task). See lib/piles.ts.
  "pile-claude": "#5B4BDB",
  "pile-claude-soft": "#ECE9FD",
  "pile-together": "#0E8C7E",
  "pile-together-soft": "#DFF3EF",
  "pile-me": "#C0622F",
  "pile-me-soft": "#FBEBE2",
  // Life areas.
  "area-work": "#4867B7",
  "area-home": "#8A6D3B",
  "area-family": "#C2527A",
  "area-money": "#2E8A57",
  "area-health": "#D2513E",
  "area-other": "#8A8A96",
  // Agent status.
  "needs-you": "#B45309",
  "needs-you-soft": "#FEF1DC",
  // Dashboard surfaces and type (see components/dashboard).
  ink: "#16132E",
  "ink-2": "#5E5A78",
  "ink-3": "#9C99B0",
  hairline: "#ECEAF4",
  canvas: "#F6F5FB",
  "night-1": "#0E0A2A",
  "night-2": "#24197A",
  "night-3": "#4A3AD0",
  success: "#1FBF8A",
  warning: "#F5A524",
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
