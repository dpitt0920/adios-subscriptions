// The Home dashboard, as a pure view over the task list. app/(tabs)/home.tsx
// wires it to the providers and router.

import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/constants";
import type { Task } from "@/providers/TasksProvider";
import { AgentActions } from "./AgentActions";
import { Hero } from "./Hero";
import { LifeBalance } from "./LifeBalance";
import { Momentum } from "./Momentum";
import { NeedsYouFeed } from "./NeedsYouFeed";
import { PileCards } from "./PileCards";
import { Card, DText, Reveal, SectionTitle } from "./primitives";
import { computeStats, greeting } from "./stats";

export type DashboardProps = {
  tasks: Task[];
  today: string;
  firstName: string | null;
  agentPending: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onHandOff: () => void;
  onPlanDay: () => void;
  onOpenChat: () => void;
  onOpenTasks: () => void;
  onOpenTask: (id: string) => void;
  /** Bottom padding so the last card clears the tab bar. */
  bottomInset?: number;
};

function Welcome({ onOpenTasks }: { onOpenTasks: () => void }) {
  const examples = ["Renew passport", "Email landlord about the leak", "Book dentist", "Plan Mia's birthday"];
  return (
    <Card style={{ overflow: "hidden" }}>
      <LinearGradient
        colors={["#F3F0FF", "rgba(255,255,255,0)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 160 }}
      />
      <DText bold size={20} tracking={-0.3}>
        Empty your head here
      </DText>
      <DText size={14} color={colors["ink-2"]} lineHeight={20} style={{ marginTop: 6 }}>
        Add everything you need to do, in your own words. Claude sorts it into piles and starts on
        its part right away.
      </DText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {examples.map((e) => (
          <View
            key={e}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <DText size={13} color={colors["ink-2"]}>
              {e}
            </DText>
          </View>
        ))}
      </View>
      <Pressable
        onPress={onOpenTasks}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: 18,
          height: 50,
          borderRadius: 16,
          backgroundColor: colors.ink,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name="add" size={19} color="#fff" />
        <DText bold size={15} color="#fff">
          Add your first tasks
        </DText>
      </Pressable>
    </Card>
  );
}

export function Dashboard(props: DashboardProps) {
  const { tasks, today, firstName } = props;
  const stats = useMemo(() => computeStats(tasks, today), [tasks, today]);
  const isEmpty = tasks.length === 0;
  const needsCount = stats.needsYou.length + stats.failed.length;

  const dateLabel = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [today]);

  let order = 2;
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {/* Dark backdrop for the pull-to-refresh overscroll above the hero. */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 240, backgroundColor: colors["night-1"] }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: (props.bottomInset ?? 0) + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor="#fff" />
        }
      >
        <View style={{ backgroundColor: colors.canvas }}>
          <Hero
            greeting={greeting()}
            firstName={firstName}
            dateLabel={dateLabel}
            done={stats.today.done}
            total={stats.today.total}
            working={stats.working.length}
            needsYou={needsCount}
          />
        </View>

        <View style={{ backgroundColor: colors.canvas, paddingHorizontal: 20, paddingTop: 28, gap: 34 }}>
          {isEmpty && (
            <Reveal order={order++}>
              <Welcome onOpenTasks={props.onOpenTasks} />
            </Reveal>
          )}

          <Reveal order={order++}>
            <SectionTitle
              title="Three piles"
              caption={
                stats.unsorted > 0
                  ? `${stats.unsorted} still being sorted`
                  : `${stats.openTotal} open · Claude takes what it can`
              }
            />
            <PileCards piles={stats.piles} onOpen={props.onOpenTasks} />
          </Reveal>

          <Reveal order={order++}>
            <SectionTitle
              title="Needs you"
              caption={
                needsCount > 0
                  ? "Claude did its part. Your turn."
                  : stats.working.length > 0
                    ? "Claude is still working."
                    : "Nothing waiting on you"
              }
              right={
                needsCount + stats.working.length > 0 ? (
                  <Pressable onPress={props.onOpenTasks} hitSlop={10} accessibilityRole="button">
                    <DText bold size={14} color={colors.primary}>
                      See all
                    </DText>
                  </Pressable>
                ) : undefined
              }
            />
            <NeedsYouFeed
              needsYou={stats.needsYou}
              working={stats.working}
              failed={stats.failed}
              onOpenTask={props.onOpenTask}
            />
          </Reveal>

          <Reveal order={order++}>
            <AgentActions
              queue={stats.claudeQueue}
              pending={props.agentPending}
              onHandOff={props.onHandOff}
              onPlanDay={props.onPlanDay}
              onOpenChat={props.onOpenChat}
            />
          </Reveal>

          <Reveal order={order++}>
            <SectionTitle title="Life balance" caption="Open tasks by area" />
            <LifeBalance areas={stats.areas} />
          </Reveal>

          <Reveal order={order++}>
            <SectionTitle title="Momentum" caption="The last 7 days" />
            <Momentum week={stats.week} total={stats.weekTotal} best={stats.bestDay} streak={stats.streak} />
          </Reveal>
        </View>
      </ScrollView>
    </View>
  );
}
