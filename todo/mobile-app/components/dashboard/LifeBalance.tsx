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
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/constants";
import { AREAS, type AreaMeta } from "./meta";
import { Card, DText } from "./primitives";
import type { AreaStats } from "./stats";

function useGrow(target: number, delay: number) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    v.value = reduced
      ? target
      : withDelay(delay, withTiming(target, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [target, delay, reduced, v]);
  return v;
}

function Bar({ meta, count, max, index }: { meta: AreaMeta; count: number; max: number; index: number }) {
  const fill = useGrow(max ? count / max : 0, 400 + index * 80);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(fill.value * 100, 0)}%` }));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${meta.color}1A`,
        }}
      >
        <Ionicons name={meta.icon} size={16} color={meta.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <DText bold size={14.5}>
            {meta.label}
          </DText>
          <DText bold size={14.5} color={count ? colors.ink : colors["ink-3"]}>
            {count}
          </DText>
        </View>
        <View style={{ height: 8, borderRadius: 8, backgroundColor: "#F1F0F6", overflow: "hidden" }}>
          <Animated.View style={[{ height: "100%", borderRadius: 8, overflow: "hidden" }, style]}>
            <LinearGradient
              colors={meta.gradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

export function LifeBalance({ areas }: { areas: AreaStats[] }) {
  const total = areas.reduce((s, a) => s + a.open, 0);
  const max = Math.max(...areas.map((a) => a.open), 0);
  const shown = AREAS.filter((m) => m.key !== "other" || (areas.find((a) => a.area === "other")?.open ?? 0) > 0);
  const top = [...areas].sort((a, b) => b.open - a.open)[0];
  const topMeta = AREAS.find((m) => m.key === top?.area);

  return (
    <Card>
      {/* Distribution capsule */}
      <View style={{ flexDirection: "row", height: 12, borderRadius: 12, overflow: "hidden", gap: 3, backgroundColor: total ? undefined : "#F1F0F6" }}>
        {total > 0 &&
          areas
            .filter((a) => a.open > 0)
            .map((a) => {
              const meta = AREAS.find((m) => m.key === a.area)!;
              return (
                <LinearGradient
                  key={a.area}
                  colors={meta.gradient}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ flex: a.open, borderRadius: 3 }}
                />
              );
            })}
      </View>
      <DText size={13.5} color={colors["ink-2"]} style={{ marginTop: 12, marginBottom: 18 }}>
        {total === 0 ? (
          "Nothing open in any area. Enjoy the balance."
        ) : (
          <>
            <DText bold size={13.5} color={topMeta?.color}>
              {topMeta?.label}
            </DText>{" "}
            {`is taking ${Math.round(((top?.open ?? 0) / total) * 100)}% of your ${total} open tasks.`}
          </>
        )}
      </DText>
      {total === 0 ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {shown.map((meta) => (
            <View key={meta.key} style={{ alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: `${meta.color}1A`,
                }}
              >
                <Ionicons name={meta.icon} size={19} color={meta.color} />
              </View>
              <DText size={12} color={colors["ink-2"]}>
                {meta.label}
              </DText>
            </View>
          ))}
        </View>
      ) : (
      <View style={{ gap: 16 }}>
        {shown.map((meta, i) => (
          <Bar key={meta.key} meta={meta} count={areas.find((a) => a.area === meta.key)?.open ?? 0} max={max} index={i} />
        ))}
      </View>
      )}
    </Card>
  );
}
