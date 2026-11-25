import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import classNames from "classnames";
import { Toast } from "toastify-react-native";
import { AppText } from "@/components/AppText";
import { SectionHeader } from "@/components/SectionHeader";
import { TaskRow } from "@/components/TaskRow";
import { colors, PRIORITY_LABELS, priorityColor } from "@/lib/constants";
import { addDays, formatDue, todayString } from "@/lib/dates";
import { useAgent } from "@/providers/AgentProvider";
import { useTasks } from "@/providers/TasksProvider";

function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={classNames("rounded-full px-3 py-1.5 border", {
        "bg-primary border-primary": active,
        "bg-white border-gray-200": !active,
      })}
    >
      <AppText
        className={classNames("text-sm", { "text-white": active, "text-gray-700": !active })}
        style={!active && color ? { color } : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { top } = useSafeAreaInsets();
  const { getTask, subtasksOf, updateTask, toggleComplete, removeTask, addTask } = useTasks();
  const { send, pending } = useAgent();
  const task = getTask(id);

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [newSubtask, setNewSubtask] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
    }
    // Only resync when navigating to a different task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center bg-app-bg" style={{ paddingTop: top }}>
        <AppText className="text-muted-foreground">This task no longer exists.</AppText>
        <Pressable onPress={() => router.back()} className="mt-4">
          <AppText className="text-primary" fontWeight="bold">
            Go back
          </AppText>
        </Pressable>
      </View>
    );
  }

  const subtasks = subtasksOf(task.id);
  const today = todayString();
  const dueOptions: { label: string; value: string | null }[] = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Next week", value: addDays(today, 7) },
    { label: "No date", value: null },
  ];

  const saveTitle = () => {
    const value = title.trim();
    if (value && value !== task.title) updateTask(task.id, { title: value });
    else setTitle(task.title);
  };

  const saveNotes = () => {
    const value = notes.trim() || null;
    if (value !== (task.notes ?? null)) updateTask(task.id, { notes: value });
  };

  const addSubtask = async () => {
    const value = newSubtask.trim();
    if (!value) return;
    setNewSubtask("");
    try {
      await addTask(value, { parentId: task.id });
    } catch {
      Toast.error("Couldn't add subtask");
    }
  };

  const breakDown = async () => {
    const reply = await send(
      `Break down the task "${task.title}" (id ${task.id}) into subtasks.`,
      { silent: true }
    );
    if (reply) Toast.info(reply);
  };

  const confirmDelete = () =>
    Alert.alert("Delete task?", "This also deletes its subtasks.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          router.back();
          try {
            await removeTask(task.id);
          } catch {
            Toast.error("Couldn't delete task");
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-app-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        className="flex-row items-center justify-between px-4 pb-2"
        style={{ paddingTop: top + 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </Pressable>
        <Pressable onPress={confirmDelete} hitSlop={10}>
          <Ionicons name="trash-outline" size={22} color={colors.overdue} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start px-4 pt-2" style={{ gap: 12 }}>
          <Pressable onPress={() => toggleComplete(task)} hitSlop={10} className="mt-1">
            <Ionicons
              name={task.completed ? "checkmark-circle" : "ellipse-outline"}
              size={28}
              color={task.completed ? colors.primary : priorityColor(task.priority)}
            />
          </Pressable>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={saveTitle}
            multiline
            className="flex-1 text-2xl text-gray-900 font-din-rounded-bold"
          />
        </View>

        <SectionHeader title="Due" right={
          <AppText className="text-sm text-muted-foreground">
            {formatDue(task.dueDate, task.dueTime) ?? "None"}
          </AppText>
        } />
        <View className="flex-row flex-wrap px-4" style={{ gap: 8 }}>
          {dueOptions.map((o) => (
            <Chip
              key={o.label}
              label={o.label}
              active={task.dueDate === o.value}
              onPress={() =>
                updateTask(task.id, { dueDate: o.value, ...(o.value ? {} : { dueTime: null }) })
              }
            />
          ))}
        </View>

        <SectionHeader title="Priority" />
        <View className="flex-row flex-wrap px-4" style={{ gap: 8 }}>
          {[1, 2, 3, 4].map((p) => (
            <Chip
              key={p}
              label={PRIORITY_LABELS[p]}
              active={task.priority === p}
              color={priorityColor(p)}
              onPress={() => updateTask(task.id, { priority: p })}
            />
          ))}
        </View>

        <SectionHeader title="Notes" />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={saveNotes}
          placeholder="Add notes"
          placeholderTextColor={colors["muted-foreground"]}
          multiline
          className="mx-4 bg-white rounded-2xl px-4 py-3 text-base text-gray-900 min-h-[80px]"
        />

        <SectionHeader
          title="Subtasks"
          count={subtasks.length || undefined}
          right={
            <Pressable
              onPress={breakDown}
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
                Break down
              </AppText>
            </Pressable>
          }
        />
        <View className="mx-4 rounded-2xl overflow-hidden">
          {subtasks.map((s) => (
            <TaskRow key={s.id} task={s} showSubtaskCount={false} />
          ))}
          <View className="flex-row items-center bg-white px-4" style={{ gap: 12 }}>
            <Ionicons name="add" size={24} color={colors["muted-foreground"]} />
            <TextInput
              value={newSubtask}
              onChangeText={setNewSubtask}
              onSubmitEditing={addSubtask}
              placeholder="Add subtask"
              placeholderTextColor={colors["muted-foreground"]}
              returnKeyType="done"
              className="flex-1 py-3 text-base text-gray-900"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
