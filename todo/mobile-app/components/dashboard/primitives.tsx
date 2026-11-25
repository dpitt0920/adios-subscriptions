// Shared building blocks for the dashboard: typography, cards, springy press
// feedback, motion helpers.

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Type

type DTextProps = {
  children: ReactNode;
  bold?: boolean;
  size?: number;
  color?: string;
  /** Letter spacing; negative for large display numbers. */
  tracking?: number;
  lineHeight?: number;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  center?: boolean;
  upper?: boolean;
};

export function DText({
  children,
  bold,
  size = 15,
  color = colors.ink,
  tracking,
  lineHeight,
  numberOfLines,
  style,
  center,
  upper,
}: DTextProps) {
  return (
    <AppText
      fontWeight={bold ? "bold" : "regular"}
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: bold ? "din-rounded-bold" : "din-rounded",
          fontSize: size,
          color,
          letterSpacing: tracking,
          lineHeight: lineHeight ?? Math.round(size * 1.25),
          fontVariant: ["tabular-nums"],
          textAlign: center ? "center" : undefined,
          textTransform: upper ? "uppercase" : undefined,
        },
        style,
      ]}
    >
      {children}
    </AppText>
  );
}

// ---------------------------------------------------------------------------
// Surfaces

export const SHADOW_SOFT =
  "0px 1px 2px rgba(22, 19, 46, 0.04), 0px 8px 24px -6px rgba(36, 25, 122, 0.10)";
export const SHADOW_LIFT =
  "0px 2px 4px rgba(22, 19, 46, 0.05), 0px 18px 40px -12px rgba(36, 25, 122, 0.22)";

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderRadius: 26,
          padding: padded ? 20 : 0,
          boxShadow: SHADOW_SOFT,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  caption,
  right,
}: {
  title: string;
  caption?: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 14,
        paddingHorizontal: 4,
      }}
    >
      <View style={{ flex: 1 }}>
        <DText bold size={21} tracking={-0.3}>
          {title}
        </DText>
        {caption ? (
          <DText size={13.5} color={colors["ink-3"]} style={{ marginTop: 3 }}>
            {caption}
          </DText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Motion

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that springs down on touch. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.965,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 420, mass: 0.6 });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 260, mass: 0.6 });
        props.onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Staggered fade-up entrance. Pass the section's order on screen. */
export function Reveal({
  order,
  children,
  style,
}: {
  order: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduced
          ? undefined
          : FadeInDown.delay(80 + order * 70)
              .springify()
              .damping(20)
              .stiffness(160)
      }
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Animates a number from 0 to `target` with an ease-out curve. */
export function useCountUp(target: number, duration = 1100, delay = 250) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const current = useRef(value);
  useEffect(() => {
    if (reduced) {
      current.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const from = current.current;
    const tick = (now: number) => {
      if (start == null) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      current.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, reduced]);
  return value;
}

/** A softly breathing dot, for "live" states. */
export function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 })
      ),
      -1
    );
  }, [p, reduced]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.value),
    transform: [{ scale: 1 + p.value * 1.6 }],
  }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          { position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: color },
          halo,
        ]}
      />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/** A light sweep that glides across its parent (parent needs overflow: hidden). */
export function Shimmer({
  color = "rgba(255,255,255,0.35)",
  duration = 1600,
}: {
  color?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduced || !width) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1);
  }, [reduced, width, duration, x]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * 0.6 + x.value * width * 1.6 }],
  }));
  if (reduced) return null;
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: width * 0.6 }, style]}>
        <LinearGradient
          colors={["rgba(255,255,255,0)", color, "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
