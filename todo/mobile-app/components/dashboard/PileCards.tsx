import { useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/constants";
import { PILES } from "./meta";
import { DText, PressableScale, PulseDot, SHADOW_SOFT, useCountUp } from "./primitives";
import type { PileStats } from "./stats";

function PileCard({ stats, onPress }: { stats: PileStats; onPress: () => void }) {
  const meta = PILES.find((p) => p.key === stats.pile)!;
  const count = useCountUp(stats.open, 900, 500);
  const compact = useWindowDimensions().width < 390;

  let status: React.ReactNode;
  if (stats.working > 0) {
    status = (
      <>
        <PulseDot color={meta.color} size={6} />
        <DText size={12} color={meta.color} bold numberOfLines={1} style={{ flexShrink: 1 }}>
          {stats.working} working
        </DText>
      </>
    );
  } else if (stats.needsYou > 0) {
    status = (
      <>
        <View style={{ width: 6, height: 6, borderRadius: 6, backgroundColor: colors.warning }} />
        <DText size={12} color="#C98207" bold numberOfLines={1} style={{ flexShrink: 1 }}>
          {stats.needsYou} for you
        </DText>
      </>
    );
  } else {
    status = (
      <DText size={12} color={colors["ink-3"]} numberOfLines={1}>
        {meta.blurb}
      </DText>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${stats.open} open`}
      style={{ flex: 1, minWidth: 0 }}
    >
      <View
        style={{
          borderRadius: 24,
          backgroundColor: colors.white,
          overflow: "hidden",
          boxShadow: SHADOW_SOFT,
        }}
      >
        <LinearGradient
          colors={[meta.wash, "rgba(255,255,255,0)"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 110 }}
        />
        <View style={{ padding: compact ? 12 : 14, paddingTop: 15 }}>
          <LinearGradient
            colors={meta.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0px 6px 14px -4px ${meta.color}88`,
            }}
          >
            <Ionicons name={meta.icon} size={17} color="#fff" />
          </LinearGradient>
          <DText bold size={36} tracking={-1.2} lineHeight={40} style={{ marginTop: 14 }}>
            {count}
          </DText>
          <AppText
            fontWeight="bold"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              fontFamily: "din-rounded-bold",
              fontSize: compact ? 12.5 : 13.5,
              lineHeight: 17,
              color: colors.ink,
              marginTop: 2,
            }}
          >
            {meta.label}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, minHeight: 16 }}>
            {status}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function PileCards({ piles, onOpen }: { piles: PileStats[]; onOpen: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {piles.map((p) => (
        <PileCard key={p.pile} stats={p} onPress={onOpen} />
      ))}
    </View>
  );
}
