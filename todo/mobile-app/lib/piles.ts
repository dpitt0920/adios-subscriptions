// Shared metadata for piles (who does the task) and life areas.

import type { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/constants";

type IconName = keyof typeof Ionicons.glyphMap;

export const PILES = ["claude", "together", "me"] as const;
export type Pile = (typeof PILES)[number];

export const AREAS = ["work", "home", "family", "money", "health", "other"] as const;
export type Area = (typeof AREAS)[number];

export type AgentStatus = "idle" | "working" | "needs_you" | "done" | "failed";

export type PileMeta = {
  label: string;
  /** Very short label for compact badges. */
  short: string;
  description: string;
  /** Label of the main "run" action on a task in this pile. */
  action: string;
  icon: IconName;
  color: string;
  soft: string;
};

export const PILE_META: Record<Pile, PileMeta> = {
  claude: {
    label: "Claude's on it",
    short: "Claude",
    description: "Claude does it start to finish: research, writing, calendar events.",
    action: "Have Claude do it",
    icon: "sparkles",
    color: colors["pile-claude"],
    soft: colors["pile-claude-soft"],
  },
  together: {
    label: "Together",
    short: "Together",
    description: "Claude does most of it and you finish, like reviewing and sending a drafted email.",
    action: "Start it together",
    icon: "people",
    color: colors["pile-together"],
    soft: colors["pile-together-soft"],
  },
  me: {
    label: "Only you",
    short: "You",
    description: "Only you can do it. Claude still helps with a script, checklist or reminder.",
    action: "Help me with this",
    icon: "person",
    color: colors["pile-me"],
    soft: colors["pile-me-soft"],
  },
};

export const UNTRIAGED_ACTION = "Have Claude take a look";

export type AreaMeta = { label: string; icon: IconName; color: string };

export const AREA_META: Record<Area, AreaMeta> = {
  work: { label: "Work", icon: "briefcase-outline", color: colors["area-work"] },
  home: { label: "Home", icon: "home-outline", color: colors["area-home"] },
  family: { label: "Family", icon: "heart-outline", color: colors["area-family"] },
  money: { label: "Money", icon: "wallet-outline", color: colors["area-money"] },
  health: { label: "Health", icon: "fitness-outline", color: colors["area-health"] },
  other: { label: "Other", icon: "ellipsis-horizontal-circle-outline", color: colors["area-other"] },
};

export function pileMeta(pile: string | null | undefined): PileMeta | null {
  return pile && pile in PILE_META ? PILE_META[pile as Pile] : null;
}

export function areaMeta(area: string | null | undefined): AreaMeta | null {
  return area && area in AREA_META ? AREA_META[area as Area] : null;
}
