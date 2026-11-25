import { useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppBar } from "@/components/AppBar";
import { AppText } from "@/components/AppText";
import { CaptureBar } from "@/components/CaptureBar";
import { SectionHeader } from "@/components/SectionHeader";
import { TaskRow } from "@/components/TaskRow";
import { colors } from "@/lib/constants";
import { todayString } from "@/lib/dates";
import { useAgent } from "@/providers/AgentProvider";
import { useTasks, type Task } from "@/providers/TasksProvider";

function byDueThenPriority(a: Task, b: Task) {
  const ad = a.dueDate ?? "9999";
  const bd = b.dueDate ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return (a.dueTime ?? "99") < (b.dueTime ?? "99") ? -1 : 1;
}

export default function TodayScreen() {
  const { tasks, refresh, refreshing } = useTasks();
  const { send, pending } = useAgent();
  const today = todayString();

  const { plan, overdue, dueToday, doneToday } = useMemo(() => {
    const top = tasks.filter((t) => !t.parentId);
    const plan = tasks
      .filter((t) => t.plannedDate === today)
      .sort((a, b) => (a.planOrder ?? 0) - (b.planOrder ?? 0));
    const inPlan = new Set(plan.map((t) => t.id));
    const open = top.filter((t) => !t.completed && !inPlan.has(t.id));
    return {
      plan,
      overdue: open.filter((t) => t.dueDate && t.dueDate < today).sort(byDueThenPriority),
      dueToday: open.filter((t) => t.dueDate === today).sort(byDueThenPriority),
      doneToday: top.filter(
        (t) => t.completed && t.completedAt && t.completedAt.slice(0, 10) >= today && !inPlan.has(t.id)
      ),
    };
  }, [tasks, today]);

  const planMyDay = () => {
    send("Plan my day.");
    router.push("/assistant");
  };

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const nothingToday = plan.length + overdue.length + dueToday.length === 0;

  return (
    <View className="flex-1 bg-app-bg">
      <AppBar
        title={
          <View>
            <AppText className="text-gray-900 text-3xl" fontWeight="bold">
              Today
            </AppText>
            <AppText className="text-muted-foreground text-sm">{dateLabel}</AppText>
          </View>
        }
      />
      <View className="pt-4">
        <CaptureBar />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <SectionHeader
          title="Plan"
          count={plan.length || undefined}
          right={
            <Pressable
              onPress={planMyDay}
              disabled={pending}
              className="flex-row items-center bg-primary-soft rounded-full px-3 py-1.5"
              style={{ gap: 4, opacity: pending ? 0.6 : 1 }}
            >
              {pending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="sparkles" size={14} color={colors.primary} />
              )}
              <AppText className="text-primary text-sm" fontWeight="bold">
                {plan.length ? "Re-plan" : "Plan my day"}
              </AppText>
            </Pressable>
          }
        />
        {plan.length > 0 ? (
          <View className="mx-4 rounded-2xl overflow-hidden">
            {plan.map((t, i) => (
              <TaskRow key={t.id} task={t} index={i} />
            ))}
          </View>
        ) : (
          <AppText className="px-4 text-muted-foreground text-sm">
            Let the assistant pick what to do today and in what order.
          </AppText>
        )}

        {overdue.length > 0 && (
          <>
            <SectionHeader title="Overdue" count={overdue.length} color={colors.overdue} />
            <View className="mx-4 rounded-2xl overflow-hidden">
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </View>
          </>
        )}

        {dueToday.length > 0 && (
          <>
            <SectionHeader title="Due today" count={dueToday.length} />
            <View className="mx-4 rounded-2xl overflow-hidden">
              {dueToday.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </View>
          </>
        )}

        {doneToday.length > 0 && (
          <>
            <SectionHeader title="Done" count={doneToday.length} />
            <View className="mx-4 rounded-2xl overflow-hidden">
              {doneToday.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </View>
          </>
        )}

        {nothingToday && doneToday.length === 0 && (
          <View className="items-center mt-16 px-8" style={{ gap: 8 }}>
            <Ionicons name="sunny-outline" size={40} color={colors["muted-foreground"]} />
            <AppText className="text-muted-foreground text-center">
              Nothing due today. Type a task above in your own words.
            </AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
