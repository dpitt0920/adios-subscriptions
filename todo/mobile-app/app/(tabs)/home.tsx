import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useIsFocused } from "@react-navigation/native";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { todayString } from "@/lib/dates";
import { useAgent } from "@/providers/AgentProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useTasks } from "@/providers/TasksProvider";

export default function HomeScreen() {
  const { tasks, refresh, refreshing } = useTasks();
  const { send, pending } = useAgent();
  const { user } = useAuth();
  const focused = useIsFocused();
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || null;

  return (
    <>
      {focused && <StatusBar style="light" />}
      <Dashboard
        tasks={tasks}
        today={todayString()}
        firstName={firstName}
        agentPending={pending}
        refreshing={refreshing}
        onRefresh={refresh}
        onHandOff={() => {
          send("Start working on everything in the Claude pile.");
        }}
        onPlanDay={() => {
          send("Plan my day.");
          router.push("/assistant");
        }}
        onOpenChat={() => router.push("/assistant")}
        onOpenTasks={() => router.push("/tasks")}
        onOpenTask={(id) => router.push({ pathname: "/task/[id]", params: { id } })}
      />
    </>
  );
}
