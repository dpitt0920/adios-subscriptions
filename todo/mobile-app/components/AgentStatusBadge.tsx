// Compact indicators for Claude's work on a task: a pulsing dot while it's
// working, a "Needs you" chip, a subtle failure marker.

import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/constants";

export function PulsingDot({ color = colors.primary, size = 8 }: { color?: string; size?: number }) {
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size * 2,
          height: size * 2,
          borderRadius: size,
          backgroundColor: color,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export function NeedsYouChip() {
  return (
    <View
      className="flex-row items-center rounded-full px-2 py-0.5"
      style={{ backgroundColor: colors["needs-you-soft"], gap: 3 }}
    >
      <Ionicons name="hand-left-outline" size={11} color={colors["needs-you"]} />
      <AppText className="text-xs" fontWeight="bold" style={{ color: colors["needs-you"] }}>
        Needs you
      </AppText>
    </View>
  );
}

/** Right-side status for a task row. Renders nothing for idle/done. */
export function AgentStatusBadge({
  status,
  color,
}: {
  status: string | null | undefined;
  color?: string;
}) {
  if (status === "working") {
    return (
      <View className="flex-row items-center" style={{ gap: 2 }}>
        <PulsingDot color={color} size={7} />
        <AppText className="text-xs" style={{ color: color ?? colors.primary }}>
          Working
        </AppText>
      </View>
    );
  }
  if (status === "needs_you") return <NeedsYouChip />;
  if (status === "failed") {
    return <Ionicons name="alert-circle-outline" size={16} color={colors.overdue} style={{ opacity: 0.8 }} />;
  }
  return null;
}
