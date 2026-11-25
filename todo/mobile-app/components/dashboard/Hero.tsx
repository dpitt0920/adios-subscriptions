import { useState } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { colors } from "@/lib/constants";
import { DText, PulseDot, Reveal, useCountUp } from "./primitives";
import { ProgressRing } from "./ProgressRing";

type Props = {
  greeting: string;
  firstName: string | null;
  dateLabel: string;
  done: number;
  total: number;
  working: number;
  needsYou: number;
};

const WHITE_70 = "rgba(255,255,255,0.72)";
const WHITE_50 = "rgba(255,255,255,0.52)";

/** Soft colored light blooms layered over the gradient, for a mesh-like feel. */
function Blooms({ width, height }: { width: number; height: number }) {
  if (!width || !height) return null;
  const blooms = [
    { id: "b1", cx: width * 0.92, cy: height * 0.08, r: width * 0.75, color: "#B25CFF", o: 0.55 },
    { id: "b2", cx: width * 0.02, cy: height * 0.98, r: width * 0.8, color: "#2F7BFF", o: 0.45 },
    { id: "b3", cx: width * 0.75, cy: height * 0.95, r: width * 0.45, color: "#FF6FB5", o: 0.22 },
    { id: "b4", cx: width * 0.15, cy: height * 0.1, r: width * 0.4, color: "#41E2D0", o: 0.16 },
  ];
  return (
    <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        {blooms.map((b) => (
          <RadialGradient key={b.id} id={b.id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={b.color} stopOpacity={b.o} />
            <Stop offset="1" stopColor={b.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blooms.map((b) => (
        <Circle key={b.id} cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${b.id})`} />
      ))}
    </Svg>
  );
}

function StatusLine({ working, needsYou }: { working: number; needsYou: number }) {
  const parts: string[] = [];
  if (working > 0) parts.push(`Claude is working on ${working} ${working === 1 ? "task" : "tasks"}`);
  if (needsYou > 0) parts.push(`${needsYou} ${needsYou === 1 ? "needs" : "need"} you`);
  const text = parts.length ? parts.join("  ·  ") : "Claude is standing by";
  const live = working > 0;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 9,
        paddingVertical: 8,
        paddingHorizontal: 13,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.11)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        maxWidth: "100%",
      }}
    >
      {live ? (
        <PulseDot color="#6CF2C6" size={7} />
      ) : (
        <View style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: needsYou ? "#FFC46B" : WHITE_50 }} />
      )}
      <DText size={13.5} color="rgba(255,255,255,0.9)" numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </DText>
    </View>
  );
}

function Metric({ value, label, accent, last }: { value: number; label: string; accent: string; last?: boolean }) {
  const shown = useCountUp(value, 900, 450);
  return (
    <View
      style={{
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "rgba(255,255,255,0.10)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 6, height: 6, borderRadius: 6, backgroundColor: accent }} />
        <DText bold size={24} color="#fff" tracking={-0.5} lineHeight={28}>
          {shown}
        </DText>
      </View>
      <DText size={12.5} color={WHITE_50} style={{ marginLeft: 14 }} numberOfLines={1}>
        {label}
      </DText>
    </View>
  );
}

export function Hero({ greeting, firstName, dateLabel, done, total, working, needsYou }: Props) {
  const { top } = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const shownDone = useCountUp(done);
  const left = Math.max(0, total - done);
  const pct = total ? done / total : 0;
  const initial = (firstName ?? "").trim().charAt(0).toUpperCase();

  return (
    <View
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      style={{
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        overflow: "hidden",
        boxShadow: "0px 24px 48px -20px rgba(36, 25, 122, 0.55)",
      }}
    >
      <LinearGradient
        colors={[colors["night-1"], colors["night-2"], colors["night-3"]]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Blooms width={size.width} height={size.height} />
      {/* Hairline highlight along the bottom edge for a glassy finish. */}
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.08)"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }}
      />

      <View style={{ paddingTop: top + 14, paddingHorizontal: 22, paddingBottom: 26 }}>
        <Reveal order={0}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <DText bold size={12} color={WHITE_50} tracking={1.4} upper>
              {dateLabel}
            </DText>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.22)",
              }}
            >
              {initial ? (
                <DText bold size={16} color="#fff" lineHeight={20}>
                  {initial}
                </DText>
              ) : (
                <Ionicons name="person" size={17} color="#fff" />
              )}
            </View>
          </View>
          <DText bold size={34} color="#fff" tracking={-0.8} lineHeight={40} style={{ marginTop: 10 }}>
            {firstName ? `${greeting},\n${firstName}` : greeting}
          </DText>
          <View style={{ marginTop: 14 }}>
            <StatusLine working={working} needsYou={needsYou} />
          </View>
        </Reveal>

        <Reveal order={1}>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24, gap: 22 }}>
            <ProgressRing
              size={156}
              stroke={15}
              progress={pct}
              colors={["#7DF3D6", "#7FB0FF", "#D6A1FF"]}
              trackColor="rgba(255,255,255,0.10)"
            >
              {total > 0 ? (
                <View style={{ alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                    <DText bold size={46} color="#fff" tracking={-1.5} lineHeight={50}>
                      {shownDone}
                    </DText>
                    <DText bold size={20} color={WHITE_50} lineHeight={30} style={{ marginLeft: 2 }}>
                      /{total}
                    </DText>
                  </View>
                  <DText size={12.5} color={WHITE_70} tracking={0.2}>
                    {pct >= 1 ? "all done" : "done today"}
                  </DText>
                </View>
              ) : (
                <View style={{ alignItems: "center", gap: 4 }}>
                  <Ionicons name="sunny" size={28} color="#FFD27A" />
                  <DText bold size={15} color="#fff">
                    Clear day
                  </DText>
                </View>
              )}
            </ProgressRing>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Metric value={left} label="left for today" accent="#7FB0FF" />
              <Metric value={working} label="Claude working" accent="#6CF2C6" />
              <Metric value={needsYou} label="waiting on you" accent="#FFC46B" last />
            </View>
          </View>
        </Reveal>
      </View>
    </View>
  );
}
