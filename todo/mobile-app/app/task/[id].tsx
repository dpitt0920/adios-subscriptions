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
import { AgentStatusBadge, PulsingDot } from "@/components/AgentStatusBadge";
import { AppText } from "@/components/AppText";
import { Markdown } from "@/components/Markdown";
import { SectionHeader } from "@/components/SectionHeader";
import { TaskRow } from "@/components/TaskRow";
import { colors, PRIORITY_LABELS, priorityColor } from "@/lib/constants";
import { addDays, formatDue, todayString } from "@/lib/dates";
import { useAgent } from "@/providers/AgentProvider";
import {
  AREA_META,
  AREAS,
  PILE_META,
  PILES,
  pileMeta,
  UNTRIAGED_ACTION,
  type Pile,
} from "@/lib/piles";
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

function PileCard({
  pile,
  active,
  onPress,
}: {
  pile: Pile;
  active: boolean;
  onPress: () => void;
}) {
  const meta = PILE_META[pile];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      className="flex-row items-center rounded-2xl px-4 py-3 border-2"
      style={({ pressed }) => ({
        gap: 12,
        backgroundColor: active ? meta.soft : "white",
        borderColor: active ? meta.color : "transparent",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 36, height: 36, backgroundColor: active ? meta.color : meta.soft }}
      >
        <Ionicons name={meta.icon} size={18} color={active ? "white" : meta.color} />
      </View>
      <View className="flex-1" style={{ gap: 2 }}>
        <AppText fontWeight="bold" className="text-base" style={{ color: active ? meta.color : "#111827" }}>
          {meta.label}
        </AppText>
        <AppText className="text-sm text-gray-600">{meta.description}</AppText>
      </View>
      {active && <Ionicons name="checkmark-circle" size={22} color={meta.color} />}
    </Pressable>
  );
}

function AreaChip({
  label,
  icon,
  color,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-full px-3 py-1.5 border"
      style={{
        gap: 4,
        backgroundColor: active ? color : "white",
        borderColor: active ? color : "#E5E7EB",
      }}
    >
      <Ionicons name={icon} size={14} color={active ? "white" : color} />
      <AppText className="text-sm" style={{ color: active ? "white" : "#374151" }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { top } = useSafeAreaInsets();
  const { getTask, subtasksOf, updateTask, toggleComplete, removeTask, addTask, runTask } =
    useTasks();
  const [starting, setStarting] = useState(false);
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
  const pile = pileMeta(task.pile);
  const accent = pile?.color ?? colors.primary;
  const working = task.agentStatus === "working";
  const needsYou = task.agentStatus === "needs_you";
  const failed = task.agentStatus === "failed";
  const hasOutput = !!task.agentOutput?.trim();
  const actionLabel = pile?.action ?? UNTRIAGED_ACTION;

  const run = async () => {
    if (working || starting) return;
    setStarting(true);
    try {
      await runTask(task.id);
    } finally {
      setStarting(false);
    }
  };

  const markDone = async () => {
    try {
      await updateTask(task.id, { completed: true });
      Toast.success("Marked done");
    } catch {
      Toast.error("Couldn't update task");
    }
  };
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


        <SectionHeader title="Who does it" />
        <View className="px-4" style={{ gap: 8 }}>
          {PILES.map((p) => (
            <PileCard
              key={p}
              pile={p}
              active={task.pile === p}
              onPress={() => updateTask(task.id, { pile: task.pile === p ? null : p })}
            />
          ))}
        </View>

        <SectionHeader title="Area" />
        <View className="flex-row flex-wrap px-4" style={{ gap: 8 }}>
          {AREAS.map((a) => (
            <AreaChip
              key={a}
              label={AREA_META[a].label}
              icon={AREA_META[a].icon}
              color={AREA_META[a].color}
              active={task.area === a}
              onPress={() => updateTask(task.id, { area: task.area === a ? null : a })}
            />
          ))}
        </View>

        {!task.completed && !working && !hasOutput && (
          <View className="px-4 pt-6">
            <Pressable
              onPress={run}
              disabled={starting}
              className="flex-row items-center justify-center rounded-2xl py-3.5"
              style={({ pressed }) => ({
                backgroundColor: accent,
                gap: 8,
                opacity: starting ? 0.7 : pressed ? 0.9 : 1,
              })}
            >
              {starting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Ionicons name={failed ? "refresh" : "sparkles"} size={18} color="white" />
              )}
              <AppText fontWeight="bold" className="text-white text-lg">
                {failed ? "Try again" : actionLabel}
              </AppText>
            </Pressable>
            {failed && (
              <AppText className="text-sm text-center mt-2" style={{ color: colors.overdue }}>
                Claude couldn’t finish this last time.
              </AppText>
            )}
          </View>
        )}

        {working && (
          <View
            className="mx-4 mt-6 rounded-2xl px-4 py-4 flex-row items-center"
            style={{ backgroundColor: pile?.soft ?? colors["primary-soft"], gap: 12 }}
          >
            <PulsingDot color={accent} size={9} />
            <View className="flex-1" style={{ gap: 2 }}>
              <AppText fontWeight="bold" className="text-base" style={{ color: accent }}>
                Claude is working on this…
              </AppText>
              <AppText className="text-sm text-gray-600">
                You can leave this screen. It keeps going in the background.
              </AppText>
            </View>
          </View>
        )}

        {hasOutput && (
          <>
            <SectionHeader
              title="Claude's work"
              right={<AgentStatusBadge status={task.agentStatus} color={accent} />}
            />
            <View className="mx-4 bg-white rounded-2xl px-4 py-4" style={{ gap: 14 }}>
              {failed && (
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.overdue} />
                  <AppText className="text-sm" style={{ color: colors.overdue }}>
                    Claude couldn’t finish this.
                  </AppText>
                </View>
              )}
              <Markdown>{task.agentOutput ?? ""}</Markdown>
              {!working && (
                <View className="flex-row flex-wrap pt-1" style={{ gap: 8 }}>
                  {needsYou && !task.completed && (
                    <Pressable
                      onPress={markDone}
                      className="flex-row items-center rounded-full px-4 py-2"
                      style={{ backgroundColor: accent, gap: 6 }}
                    >
                      <Ionicons name="checkmark" size={16} color="white" />
                      <AppText fontWeight="bold" className="text-white text-sm">
                        Mark done
                      </AppText>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={run}
                    disabled={starting}
                    className="flex-row items-center rounded-full px-4 py-2 border"
                    style={{ borderColor: accent, gap: 6, opacity: starting ? 0.6 : 1 }}
                  >
                    {starting ? (
                      <ActivityIndicator size="small" color={accent} />
                    ) : (
                      <Ionicons name="refresh" size={15} color={accent} />
                    )}
                    <AppText fontWeight="bold" className="text-sm" style={{ color: accent }}>
                      Run again
                    </AppText>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}

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
