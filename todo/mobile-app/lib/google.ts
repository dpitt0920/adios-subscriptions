// Google (Gmail + Calendar) connection status, shared by the More tab and the
// OAuth deep-link landing route.

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

export const GOOGLE_STATUS_KEY = ["google-status"];

export type GoogleStatus = { connected: boolean; email: string | null };

export function useGoogleStatus() {
  const { status } = useAuth();
  return useQuery({
    queryKey: GOOGLE_STATUS_KEY,
    enabled: status === "authenticated",
    queryFn: async (): Promise<GoogleStatus> => {
      const res = await api.api.google.status.$get();
      if (!res.ok) throw new Error("Failed to load Google status");
      return await res.json();
    },
  });
}
