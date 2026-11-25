import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/constants";
import type { Task } from "@/providers/TasksProvider";
import { pileMeta, PILES } from "./meta";
import { Card, DText, PressableScale, PulseDot, Shimmer } from "./primitives";
import { firstLine } from "./stats";

type Kind = "needs_you" | "working" | "failed";

const CHIP: Record<Kind, { label: string; fg: string; bg: string }> = {
  needs_you: { label: "Your turn", fg: "#B87300", bg: "#FFF4DC" },
  working: { label: "Working", fg: colors["pile-claude"], bg: "#F0EDFF" },
  failed: { label: "Stuck", fg: colors.overdue, bg: "#FDECEC" },
};

function Row({ task, kind, first, onPress }: { task: Task; kind: Kind; first: boolean; onPress: () => void }) {
  const meta = pileMeta(task.pile) ?? PILES[0];
  const chip = CHIP[kind];
  const preview =
    kind === "working"
      ? "Claude is on it right now"
      : kind === "failed"
        ? firstLine(task.agentOutput) ?? "Claude couldn't finish. Take a look."
        : firstLine(task.agentOutput) ?? "Claude finished its part.";

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" scaleTo={0.98}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 14,
          paddingVertical: 15,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: colors.hairline,
        }}
      >
        <LinearGradient
          colors={meta.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 2 }}
        >
          <Ionicons name={meta.icon} size={18} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: chip.bg,
              }}
            >
              {kind === "working" && <PulseDot color={chip.fg} size={5} />}
              <DText bold size={11} color={chip.fg} tracking={0.3} lineHeight={14}>
                {chip.label}
              </DText>
            </View>
            <DText size={12} color={colors["ink-3"]} numberOfLines={1} style={{ flexShrink: 1 }}>
              {meta.label}
            </DText>
          </View>
          <DText bold size={15.5} lineHeight={20} numberOfLines={2}>
            {task.title}
          </DText>
          {kind === "working" ? (
            <View style={{ marginTop: 8, gap: 6 }}>
              <View style={{ height: 4, borderRadius: 4, backgroundColor: "#EEEBFB", overflow: "hidden" }}>
                <LinearGradient
                  colors={["#B9AEFF", colors["pile-claude"]]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ width: "62%", height: "100%", borderRadius: 4 }}
                />
                <Shimmer color="rgba(255,255,255,0.85)" duration={1300} />
              </View>
              <DText size={12.5} color={colors["ink-3"]} numberOfLines={1}>
                {preview}
              </DText>
            </View>
          ) : (
            <DText size={13.5} color={colors["ink-2"]} numberOfLines={1} style={{ marginTop: 3 }}>
              {preview}
            </DText>
          )}
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors["ink-3"]} style={{ marginTop: 22 }} />
      </View>
    </PressableScale>
  );
}

type Props = {
  needsYou: Task[];
  working: Task[];
  failed: Task[];
  onOpenTask: (id: string) => void;
  limit?: number;
};

export function NeedsYouFeed({ needsYou, working, failed, onOpenTask, limit = 6 }: Props) {
  const items: { task: Task; kind: Kind }[] = [
    ...needsYou.map((task) => ({ task, kind: "needs_you" as const })),
    ...failed.map((task) => ({ task, kind: "failed" as const })),
    ...working.map((task) => ({ task, kind: "working" as const })),
  ].slice(0, limit);

  if (items.length === 0) {
    return (
      <Card style={{ alignItems: "center", paddingVertical: 28 }}>
        <LinearGradient
          colors={["#E9FBF4", "#D2F5E8"]}
          style={{ width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="checkmark-done" size={26} color={colors.success} />
        </LinearGradient>
        <DText bold size={17} style={{ marginTop: 14 }}>
          {"You're all caught up"}
        </DText>
        <DText size={13.5} color={colors["ink-3"]} center lineHeight={19} style={{ marginTop: 6, maxWidth: 260 }}>
          When Claude finishes its part of a task, it lands here for you to review.
        </DText>
      </Card>
    );
  }

  return (
    <Card style={{ paddingVertical: 6 }}>
      {items.map(({ task, kind }, i) => (
        <Row key={task.id} task={task} kind={kind} first={i === 0} onPress={() => onOpenTask(task.id)} />
      ))}
    </Card>
  );
}
