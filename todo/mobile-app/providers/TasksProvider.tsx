import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { Toast } from "toastify-react-native";
import { api } from "@/lib/api";
import { Cache, CACHE_KEYS } from "@/lib/cache";
import { localNowString, timeZone } from "@/lib/dates";
import type { Area, Pile } from "@/lib/piles";
import { useAuth } from "@/providers/AuthProvider";

const $list = api.api.tasks.$get;
export type Task = InferResponseType<typeof $list, 200>[number];

export type TaskPatch = {
  title?: string;
  notes?: string | null;
  priority?: number;
  dueDate?: string | null;
  dueTime?: string | null;
  completed?: boolean;
  area?: Area | null;
  pile?: Pile | null;
};

type TasksContextType = {
  tasks: Task[];
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  getTask: (id: string) => Task | undefined;
  subtasksOf: (id: string) => Task[];
  addTask: (title: string, extra?: { parentId?: string; dueDate?: string }) => Promise<void>;
  updateTask: (id: string, patch: TaskPatch) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  /** Start Claude working on a task in the background. Returns true if it started. */
  runTask: (id: string) => Promise<boolean>;
  /** Start several tasks at once; shows a single summary toast. */
  runTasks: (ids: string[]) => Promise<number>;
};

const TasksContext = createContext<TasksContextType | undefined>(undefined);
const QUERY_KEY = ["tasks"];
const POLL_MS = 4000;

type RunResult = "started" | "already" | "error";

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within a TasksProvider");
  return ctx;
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled: status === "authenticated",
    initialData: () => Cache.get<Task[]>(CACHE_KEYS.TASKS) ?? undefined,
    queryFn: async () => {
      const res = await $list();
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json();
      Cache.set(CACHE_KEYS.TASKS, data);
      return data;
    },
    // Poll only while Claude is working on something.
    refetchInterval: (q) =>
      q.state.data?.some((t) => t.agentStatus === "working") ? POLL_MS : false,
  });

  const tasks = useMemo(() => query.data ?? [], [query.data]);

  const setLocal = useCallback(
    (fn: (prev: Task[]) => Task[]) => {
      queryClient.setQueryData<Task[]>(QUERY_KEY, (prev) => fn(prev ?? []));
    },
    [queryClient]
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    [queryClient]
  );

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskPatch }) => {
      const res = await api.api.tasks[":id"].$patch({ param: { id }, json: patch });
      if (!res.ok) throw new Error("Failed to update task");
    },
    onMutate: ({ id, patch }) => {
      const { completed, ...rest } = patch;
      setLocal((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...rest,
                ...(completed !== undefined
                  ? { completed, completedAt: completed ? new Date().toISOString() : null }
                  : {}),
              }
            : t
        )
      );
    },
    onSettled: invalidate,
  });

  const startRun = useCallback(
    async (id: string): Promise<RunResult> => {
      setLocal((prev) =>
        prev.map((t) => (t.id === id ? { ...t, agentStatus: "working" as const } : t))
      );
      try {
        const res = await api.api.tasks[":id"].run.$post({
          param: { id },
          json: { localNow: localNowString(), timeZone: timeZone() },
        });
        const status: number = res.status;
        if (status === 409) return "already";
        return res.ok ? "started" : "error";
      } catch {
        return "error";
      }
    },
    [setLocal]
  );

  const value: TasksContextType = {
    tasks,
    loading: query.isPending,
    refreshing: query.isRefetching,
    refresh: async () => {
      await query.refetch();
    },
    getTask: (id) => tasks.find((t) => t.id === id),
    subtasksOf: (id) => tasks.filter((t) => t.parentId === id),
    addTask: async (title, extra) => {
      const res = await api.api.tasks.$post({
        json: { title, parentId: extra?.parentId, dueDate: extra?.dueDate },
      });
      if (!res.ok) throw new Error("Failed to add task");
      await invalidate();
    },
    updateTask: (id, patch) => updateMutation.mutateAsync({ id, patch }),
    toggleComplete: (task) =>
      updateMutation.mutateAsync({ id: task.id, patch: { completed: !task.completed } }),
    removeTask: async (id) => {
      setLocal((prev) => prev.filter((t) => t.id !== id && t.parentId !== id));
      const res = await api.api.tasks[":id"].$delete({ param: { id } });
      await invalidate();
      if (!res.ok) throw new Error("Failed to delete task");
    },
    runTask: async (id) => {
      const result = await startRun(id);
      if (result === "already") Toast.info("Claude is already working on this");
      else if (result === "error") Toast.error("Couldn't start Claude on this task");
      await invalidate();
      return result === "started";
    },
    runTasks: async (ids) => {
      const results = await Promise.all(ids.map(startRun));
      const started = results.filter((r) => r === "started").length;
      const failed = results.filter((r) => r === "error").length;
      if (failed > 0) Toast.error(`Couldn't start ${failed} of ${ids.length} tasks`);
      else if (started > 0)
        Toast.success(`Claude started on ${started} task${started === 1 ? "" : "s"}`);
      await invalidate();
      return started;
    },
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}
