import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import classNames from "classnames";
import { AppBar } from "@/components/AppBar";
import { AppText } from "@/components/AppText";
import { CaptureBar } from "@/components/CaptureBar";
import { SectionHeader } from "@/components/SectionHeader";
import { TaskRow } from "@/components/TaskRow";
import { colors } from "@/lib/constants";
import { addDays, todayString } from "@/lib/dates";
import { PILE_META, PILES, type Pile } from "@/lib/piles";
import { useTasks, type Task } from "@/providers/TasksProvider";

type Group = { title: string; tasks: Task[] };
type Filter = "all" | Pile;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  ...PILES.map((p) => ({ key: p, label: PILE_META[p].label })),
];

function SegmentedControl({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  counts: Record<Filter, number>;
}) {
  return (
    <View className="flex-row mx-4 bg-gray-200 rounded-xl p-1" style={{ gap: 2 }}>
      {FILTERS.map((f) => {
        const active = f.key === value;
        const color = f.key === "all" ? colors.primary : PILE_META[f.key].color;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={classNames("rounded-lg py-1.5 px-1 items-center justify-center", {
              "bg-white": active,
            })}
            style={{ flexGrow: f.key === "all" ? 0.7 : 1, flexBasis: 0 }}
          >
            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              fontWeight={active ? "bold" : "regular"}
              className="text-[13px]"
              style={{ color: active ? color : "#4B5563" }}
            >
              {f.label}
            </AppText>
            <AppText className="text-[11px] text-muted-foreground">{counts[f.key]}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function sortTasks(a: Task, b: Task) {
  const ad = a.dueDate ?? "9999";
  const bd = b.dueDate ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.createdAt < b.createdAt ? -1 : 1;
}

export default function TasksScreen() {
  const { tasks, refresh, refreshing, runTasks } = useTasks();
  const [showCompleted, setShowCompleted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [starting, setStarting] = useState(false);

  const counts = useMemo(() => {
    const open = tasks.filter((t) => !t.parentId && !t.completed);
    return {
      all: open.length,
      claude: open.filter((t) => t.pile === "claude").length,
      together: open.filter((t) => t.pile === "together").length,
      me: open.filter((t) => t.pile === "me").length,
    } satisfies Record<Filter, number>;
  }, [tasks]);

  // Open Claude-pile tasks that "Start all" would run.
  const startable = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.parentId &&
          !t.completed &&
          t.pile === "claude" &&
          (t.agentStatus === "idle" || t.agentStatus === "failed")
      ),
    [tasks]
  );
  const workingInClaude = tasks.some(
    (t) => !t.parentId && !t.completed && t.pile === "claude" && t.agentStatus === "working"
  );

  const startAll = async () => {
    if (!startable.length || starting) return;
    setStarting(true);
    try {
      await runTasks(startable.map((t) => t.id));
    } finally {
      setStarting(false);
    }
  };

  const groups = useMemo<Group[]>(() => {
    const today = todayString();
    const weekEnd = addDays(today, 7);
    const top = tasks.filter((t) => !t.parentId && (filter === "all" || t.pile === filter));
    const open = top.filter((t) => !t.completed).sort(sortTasks);
    const groups: Group[] = [
      { title: "Overdue", tasks: open.filter((t) => t.dueDate && t.dueDate < today) },
      { title: "Today", tasks: open.filter((t) => t.dueDate === today) },
      {
        title: "Next 7 days",
        tasks: open.filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= weekEnd),
      },
      { title: "Later", tasks: open.filter((t) => t.dueDate && t.dueDate > weekEnd) },
      { title: "No date", tasks: open.filter((t) => !t.dueDate) },
    ];
    if (showCompleted) {
      groups.push({
        title: "Completed",
        tasks: top
          .filter((t) => t.completed)
          .sort((a, b) => ((a.completedAt ?? "") > (b.completedAt ?? "") ? -1 : 1)),
      });
    }
    return groups.filter((g) => g.tasks.length > 0);
  }, [tasks, showCompleted, filter]);

  const pile = filter === "all" ? null : PILE_META[filter];

  return (
    <View className="flex-1 bg-app-bg">
      <AppBar
        title={
          <AppText className="text-gray-900 text-3xl" fontWeight="bold">
            Tasks
          </AppText>
        }
        rightAction={
          <Pressable onPress={() => setShowCompleted((v) => !v)} hitSlop={8}>
            <AppText className="text-primary text-sm" fontWeight="bold">
              {showCompleted ? "Hide done" : "Show done"}
            </AppText>
          </Pressable>
        }
      />
      <View className="pt-4" style={{ gap: 12 }}>
        <CaptureBar />
        <SegmentedControl value={filter} onChange={setFilter} counts={counts} />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {pile && (
          <View
            className="flex-row items-center mx-4 mt-4 rounded-2xl px-4 py-3"
            style={{ backgroundColor: pile.soft, gap: 10 }}
          >
            <Ionicons name={pile.icon} size={20} color={pile.color} />
            <AppText className="flex-1 text-sm text-gray-700">{pile.description}</AppText>
            {filter === "claude" && (startable.length > 0 || workingInClaude) && (
              <Pressable
                onPress={startAll}
                disabled={starting || startable.length === 0}
                className="flex-row items-center rounded-full px-3 py-1.5"
                style={{
                  backgroundColor: pile.color,
                  gap: 4,
                  opacity: starting || startable.length === 0 ? 0.6 : 1,
                }}
              >
                {starting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="play" size={12} color="white" />
                )}
                <AppText className="text-white text-sm" fontWeight="bold">
                  {startable.length > 0 ? `Start all (${startable.length})` : "All running"}
                </AppText>
              </Pressable>
            )}
          </View>
        )}
        {groups.map((group) => (
          <View key={group.title}>
            <SectionHeader title={group.title} count={group.tasks.length} />
            <View className="mx-4 rounded-2xl overflow-hidden">
              {group.tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </View>
          </View>
        ))}
        {groups.length === 0 && (
          <AppText className="text-muted-foreground text-center mt-16 px-8">
            {pile
              ? `Nothing in “${pile.label}” right now.`
              : "No tasks yet. Type one above, like “dentist next Tuesday 3pm”."}
          </AppText>
        )}
      </ScrollView>
    </View>
  );
}
