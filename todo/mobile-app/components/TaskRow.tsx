import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import classNames from "classnames";
import { AgentStatusBadge } from "@/components/AgentStatusBadge";
import { AppText } from "@/components/AppText";
import { colors, priorityColor } from "@/lib/constants";
import { formatDue, isOverdue } from "@/lib/dates";
import { pileMeta } from "@/lib/piles";
import { useTasks, type Task } from "@/providers/TasksProvider";

interface TaskRowProps {
  task: Task;
  index?: number;
  showSubtaskCount?: boolean;
}

export function TaskRow({ task, index, showSubtaskCount = true }: TaskRowProps) {
  const { toggleComplete, subtasksOf } = useTasks();
  const subtasks = showSubtaskCount ? subtasksOf(task.id) : [];
  const doneSubtasks = subtasks.filter((s) => s.completed).length;
  const due = formatDue(task.dueDate, task.dueTime);
  const overdue = !task.completed && isOverdue(task.dueDate);
  const pile = pileMeta(task.pile);
  const agentStatus = task.completed && task.agentStatus !== "working" ? null : task.agentStatus;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id } })}
      className="flex-row items-start bg-white px-4 py-3"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, gap: 12 })}
    >
      {index != null && (
        <AppText className="text-muted-foreground text-sm mt-[3px] w-4 text-right">
          {index + 1}
        </AppText>
      )}
      <Pressable
        hitSlop={10}
        onPress={() => toggleComplete(task)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
      >
        <Ionicons
          name={task.completed ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={task.completed ? colors.primary : priorityColor(task.priority)}
        />
      </Pressable>
      <View className="flex-1">
        <AppText
          className={classNames("text-base", {
            "text-gray-900": !task.completed,
            "text-gray-400 line-through": task.completed,
          })}
        >
          {task.title}
        </AppText>
        {(pile || due || subtasks.length > 0 || task.estimateMinutes) && (
          <View className="flex-row items-center mt-1" style={{ gap: 10 }}>
            {pile && (
              <View className="flex-row items-center" style={{ gap: 3 }}>
                <Ionicons name={pile.icon} size={11} color={pile.color} />
                <AppText className="text-xs" style={{ color: pile.color }}>
                  {pile.short}
                </AppText>
              </View>
            )}
            {due && (
              <View className="flex-row items-center" style={{ gap: 3 }}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={overdue ? colors.overdue : colors["muted-foreground"]}
                />
                <AppText
                  className="text-xs"
                  style={{ color: overdue ? colors.overdue : colors["muted-foreground"] }}
                >
                  {due}
                </AppText>
              </View>
            )}
            {subtasks.length > 0 && (
              <View className="flex-row items-center" style={{ gap: 3 }}>
                <Ionicons name="git-branch-outline" size={12} color={colors["muted-foreground"]} />
                <AppText className="text-xs text-muted-foreground">
                  {doneSubtasks}/{subtasks.length}
                </AppText>
              </View>
            )}
            {task.estimateMinutes != null && (
              <View className="flex-row items-center" style={{ gap: 3 }}>
                <Ionicons name="time-outline" size={12} color={colors["muted-foreground"]} />
                <AppText className="text-xs text-muted-foreground">
                  {task.estimateMinutes}m
                </AppText>
              </View>
            )}
          </View>
        )}
      </View>
      {agentStatus && agentStatus !== "idle" && agentStatus !== "done" && (
        <View className="self-center">
          <AgentStatusBadge status={agentStatus} color={pile?.color} />
        </View>
      )}
    </Pressable>
  );
}
