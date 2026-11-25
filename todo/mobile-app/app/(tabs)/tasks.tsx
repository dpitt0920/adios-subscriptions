import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { AppBar } from "@/components/AppBar";
import { AppText } from "@/components/AppText";
import { CaptureBar } from "@/components/CaptureBar";
import { SectionHeader } from "@/components/SectionHeader";
import { TaskRow } from "@/components/TaskRow";
import { addDays, todayString } from "@/lib/dates";
import { useTasks, type Task } from "@/providers/TasksProvider";

type Group = { title: string; tasks: Task[] };

function sortTasks(a: Task, b: Task) {
  const ad = a.dueDate ?? "9999";
  const bd = b.dueDate ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.createdAt < b.createdAt ? -1 : 1;
}

export default function TasksScreen() {
  const { tasks, refresh, refreshing } = useTasks();
  const [showCompleted, setShowCompleted] = useState(false);

  const groups = useMemo<Group[]>(() => {
    const today = todayString();
    const weekEnd = addDays(today, 7);
    const top = tasks.filter((t) => !t.parentId);
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
  }, [tasks, showCompleted]);

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
      <View className="pt-4">
        <CaptureBar />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
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
            No tasks yet. Type one above, like “dentist next Tuesday 3pm”.
          </AppText>
        )}
      </ScrollView>
    </View>
  );
}
