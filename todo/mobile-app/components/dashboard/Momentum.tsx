import { useEffect } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/constants";
import { Card, DText, useCountUp } from "./primitives";
import type { DayStats } from "./stats";

const CHART_H = 112;
const MIN_H = 6;

function Column({ day, max, best, index }: { day: DayStats; max: number; best: boolean; index: number }) {
  const reduced = useReducedMotion();
  const target = day.count && max ? Math.max(MIN_H + 6, (day.count / max) * CHART_H) : MIN_H;
  const h = useSharedValue(reduced ? target : MIN_H);
  useEffect(() => {
    h.value = reduced
      ? target
      : withDelay(450 + index * 60, withSpring(target, { damping: 16, stiffness: 120, mass: 0.8 }));
  }, [target, index, reduced, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  const labelOpacity = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    labelOpacity.value = reduced ? 1 : withDelay(900 + index * 60, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
  }, [index, reduced, labelOpacity]);
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View style={{ height: CHART_H + 22, justifyContent: "flex-end", alignItems: "center" }}>
        {day.count > 0 && (
          <Animated.View style={labelStyle}>
            <DText bold size={12} color={best ? colors["pile-claude"] : colors["ink-3"]} style={{ marginBottom: 5 }}>
              {day.count}
            </DText>
          </Animated.View>
        )}
        <Animated.View
          style={[
            {
              width: 24,
              borderRadius: 9,
              overflow: "hidden",
              backgroundColor: day.count ? "#E6E2FB" : "#F1F0F6",
              boxShadow: best ? "0px 8px 16px -6px rgba(106, 87, 245, 0.6)" : undefined,
            },
            style,
          ]}
        >
          {best && (
            <LinearGradient
              colors={["#A493FF", colors["pile-claude"], "#4A3AD0"]}
              style={{ flex: 1 }}
            />
          )}
        </Animated.View>
      </View>
      <View
        style={{
          marginTop: 10,
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: day.isToday ? colors.ink : "transparent",
        }}
      >
        <DText bold={day.isToday} size={12} color={day.isToday ? "#fff" : colors["ink-3"]} lineHeight={15}>
          {day.label}
        </DText>
      </View>
    </View>
  );
}

export function Momentum({
  week,
  total,
  best,
  streak,
}: {
  week: DayStats[];
  total: number;
  best: number;
  streak: number;
}) {
  const max = Math.max(...week.map((d) => d.count), 0);
  const shownTotal = useCountUp(total, 1000, 400);
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View>
          <DText bold size={40} tracking={-1.4} lineHeight={44}>
            {shownTotal}
          </DText>
          <DText size={13.5} color={colors["ink-3"]}>
            {total === 1 ? "task done this week" : "tasks done this week"}
          </DText>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 11,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: streak ? "#FFF1E8" : "#F4F3F8",
          }}
        >
          <Ionicons name="flame" size={14} color={streak ? colors["pile-me"] : colors["ink-3"]} />
          <DText bold size={13} color={streak ? "#D9531A" : colors["ink-3"]}>
            {streak ? `${streak}-day streak` : "No streak yet"}
          </DText>
        </View>
      </View>
      <View style={{ flexDirection: "row", marginTop: 14 }}>
        {week.map((d, i) => (
          <Column key={d.date} day={d} max={max} best={i === best} index={i} />
        ))}
        {total === 0 && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, top: 24, alignItems: "center", gap: 6 }}
          >
            <Ionicons name="trending-up" size={26} color={colors["ink-3"]} />
            <DText size={13.5} color={colors["ink-3"]} center style={{ maxWidth: 230 }}>
              Finish a task and your week starts taking shape here.
            </DText>
          </View>
        )}
      </View>
      {best >= 0 && (
        <DText size={12.5} color={colors["ink-3"]} center style={{ marginTop: 14 }}>
          Best day:{" "}
          <DText bold size={12.5} color={colors["pile-claude"]}>
            {bestDayName(week[best].date)}
          </DText>
          {` with ${week[best].count} done`}
        </DText>
      )}
    </Card>
  );
}

function bestDayName(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
}
