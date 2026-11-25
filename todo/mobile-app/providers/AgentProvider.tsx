// Chat state for the to-do agent. The conversation lives on the device; each
// request sends recent turns so the backend can stay stateless.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Cache, CACHE_KEYS } from "@/lib/cache";
import { localNowString, timeZone } from "@/lib/dates";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
};

type AgentContextType = {
  messages: ChatMessage[];
  pending: boolean;
  /** Send a message. Returns the agent's reply (or an error message). */
  send: (text: string, opts?: { silent?: boolean }) => Promise<string>;
  clear: () => void;
};

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const HISTORY_TURNS = 20;
const MAX_STORED = 100;

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within an AgentProvider");
  return ctx;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => Cache.get<ChatMessage[]>(CACHE_KEYS.AGENT_CHAT) ?? []
  );
  const [pending, setPending] = useState(false);

  const persist = useCallback((next: ChatMessage[]) => {
    const trimmed = next.slice(-MAX_STORED);
    Cache.set(CACHE_KEYS.AGENT_CHAT, trimmed);
    return trimmed;
  }, []);

  const send = useCallback(
    async (text: string, opts?: { silent?: boolean }) => {
      const message = text.trim();
      if (!message) return "";

      // Successful text turns only, alternating user/assistant.
      const history = messages
        .filter((m) => !m.error)
        .slice(-HISTORY_TURNS)
        .map(({ role, content }) => ({ role, content }));
      while (history.length && history[0].role !== "user") history.shift();

      const userMsg: ChatMessage = { id: newId(), role: "user", content: message };
      if (!opts?.silent) setMessages((prev) => persist([...prev, userMsg]));
      setPending(true);

      let reply: ChatMessage;
      try {
        const res = await api.api.agent.chat.$post({
          json: { message, history, localNow: localNowString(), timeZone: timeZone() },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Something went wrong.");
        }
        const data = await res.json();
        reply = { id: newId(), role: "assistant", content: data.reply };
        if (data.changedTaskIds.length > 0) {
          await queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      } catch (err) {
        reply = {
          id: newId(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong.",
          error: true,
        };
      } finally {
        setPending(false);
      }

      // Silent sends (quick capture) still land in the chat so the
      // conversation stays coherent for follow-ups.
      setMessages((prev) =>
        persist(opts?.silent ? [...prev, userMsg, reply] : [...prev, reply])
      );
      return reply.content;
    },
    [messages, persist, queryClient]
  );

  const clear = useCallback(() => {
    setMessages(persist([]));
  }, [persist]);

  return (
    <AgentContext.Provider value={{ messages, pending, send, clear }}>
      {children}
    </AgentContext.Provider>
  );
}
