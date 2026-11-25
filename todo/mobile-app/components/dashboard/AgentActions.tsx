import { ActivityIndicator, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/constants";
import type { IconName } from "./meta";
import { DText, PressableScale, SHADOW_SOFT, Shimmer } from "./primitives";

type Props = {
  queue: number;
  pending: boolean;
  onHandOff: () => void;
  onPlanDay: () => void;
  onOpenChat: () => void;
};

function SecondaryButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{ flex: 1, opacity: disabled ? 0.55 : 1 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          height: 52,
          borderRadius: 18,
          backgroundColor: colors.white,
          boxShadow: SHADOW_SOFT,
        }}
      >
        <Ionicons name={icon} size={17} color={colors.primary} />
        <DText bold size={14.5} color={colors.ink}>
          {label}
        </DText>
      </View>
    </PressableScale>
  );
}

export function AgentActions({ queue, pending, onHandOff, onPlanDay, onOpenChat }: Props) {
  const subtitle = pending
    ? "Claude is picking things up. You can keep going."
    : queue > 0
      ? `${queue} ${queue === 1 ? "task is" : "tasks are"} ready in Claude's pile. It'll work through them and check in when it needs you.`
      : "Claude will sweep its pile and start on anything new.";

  return (
    <View style={{ gap: 10 }}>
      <PressableScale
        onPress={onHandOff}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel="Hand it all to Claude"
        accessibilityState={{ busy: pending }}
        scaleTo={0.975}
      >
        <View
          style={{
            borderRadius: 28,
            overflow: "hidden",
            boxShadow: "0px 2px 6px rgba(74, 58, 208, 0.18), 0px 22px 40px -14px rgba(91, 68, 232, 0.65)",
          }}
        >
          <LinearGradient
            colors={["#7B5CFF", "#5B44E8", "#3A2AB8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <LinearGradient
            colors={["rgba(255,140,200,0.35)", "rgba(255,140,200,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.3, y: 0.8 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Top inner highlight. */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 24,
              right: 24,
              height: 1,
              backgroundColor: "rgba(255,255,255,0.35)",
            }}
          />
          {pending && <Shimmer color="rgba(255,255,255,0.18)" />}
          <View style={{ flexDirection: "row", alignItems: "center", padding: 20, gap: 16 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.16)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.28)",
              }}
            >
              {pending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="sparkles" size={24} color="#fff" />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <DText bold size={19} color="#fff" tracking={-0.2}>
                {pending ? "Claude's on it…" : "Hand it all to Claude"}
              </DText>
              <DText size={13.5} color="rgba(255,255,255,0.75)" lineHeight={18} style={{ marginTop: 4 }}>
                {subtitle}
              </DText>
            </View>
            {!pending && (
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                }}
              >
                <Ionicons name="arrow-forward" size={17} color={colors["night-3"]} />
              </View>
            )}
          </View>
        </View>
      </PressableScale>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SecondaryButton icon="calendar-clear" label="Plan my day" onPress={onPlanDay} disabled={pending} />
        <SecondaryButton icon="chatbubble-ellipses" label="Ask Claude" onPress={onOpenChat} />
      </View>
    </View>
  );
}
