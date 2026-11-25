// Dashboard styling for piles and life areas. Labels, icons and base colors
// match lib/piles.ts; this adds gradients and washes for the richer visuals.

import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/constants";

export type IconName = keyof typeof Ionicons.glyphMap;

export type Pile = "claude" | "together" | "me";
export type Area = "work" | "home" | "family" | "money" | "health" | "other";
export type AgentStatus = "idle" | "working" | "needs_you" | "done" | "failed";

export type PileMeta = {
  key: Pile;
  label: string;
  blurb: string;
  icon: IconName;
  color: string;
  /** Gradient for the pile's badge and accents, light -> deep. */
  gradient: readonly [string, string];
  /** Very light wash used behind the card's content. */
  wash: string;
};

export const PILES: readonly PileMeta[] = [
  {
    key: "claude",
    label: "Claude's on it",
    blurb: "Done for you",
    icon: "sparkles",
    color: colors["pile-claude"],
    gradient: ["#9A8BFF", "#5B44E8"],
    wash: "#F1EEFF",
  },
  {
    key: "together",
    label: "Together",
    blurb: "You finish",
    icon: "people",
    color: colors["pile-together"],
    gradient: ["#4FD8C4", "#0E8C7E"],
    wash: "#E4F6F2",
  },
  {
    key: "me",
    label: "Only you",
    blurb: "Claude helps",
    icon: "person",
    color: colors["pile-me"],
    gradient: ["#FFAE73", "#D2652F"],
    wash: "#FFF1E8",
  },
];

export type AreaMeta = {
  key: Area;
  label: string;
  icon: IconName;
  color: string;
  gradient: readonly [string, string];
};

export const AREAS: readonly AreaMeta[] = [
  { key: "work", label: "Work", icon: "briefcase", color: colors["area-work"], gradient: ["#93AAF5", "#4867B7"] },
  { key: "home", label: "Home", icon: "home", color: colors["area-home"], gradient: ["#E8C27A", "#A8792F"] },
  { key: "family", label: "Family", icon: "heart", color: colors["area-family"], gradient: ["#F39BBE", "#C2527A"] },
  { key: "money", label: "Money", icon: "wallet", color: colors["area-money"], gradient: ["#6FD6A0", "#2E8A57"] },
  { key: "health", label: "Health", icon: "fitness", color: colors["area-health"], gradient: ["#FF9F86", "#D2513E"] },
  { key: "other", label: "Other", icon: "ellipsis-horizontal", color: colors["area-other"], gradient: ["#C4C3D0", "#8A8A96"] },
];

export function pileMeta(pile: Pile | null | undefined): PileMeta | undefined {
  return PILES.find((p) => p.key === pile);
}
