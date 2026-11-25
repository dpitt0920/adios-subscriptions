// Landing route for the Google OAuth deep link (todoagent://google-connected).
// On iOS the auth session captures the redirect itself; on Android the link can
// also open the app here. The More tab shows the result, so just go back there.

import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { GOOGLE_STATUS_KEY } from "@/lib/google";
import { useAuth } from "@/providers/AuthProvider";

export default function GoogleConnectedScreen() {
  const { status } = useAuth();
  const { google } = useLocalSearchParams<{ google?: string }>();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: GOOGLE_STATUS_KEY });
  }, [queryClient, google]);

  return <Redirect href={status === "authenticated" ? "/more" : "/sign-in"} />;
}
