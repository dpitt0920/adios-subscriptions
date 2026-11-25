import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import { Toast } from "toastify-react-native";
import { AppBar } from "@/components/AppBar";
import { AppButton, AppButtonStyle } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { api } from "@/lib/api";
import { colors } from "@/lib/constants";
import { GOOGLE_STATUS_KEY, useGoogleStatus } from "@/lib/google";
import { useAgent } from "@/providers/AgentProvider";
import { useAuth } from "@/providers/AuthProvider";

function RowIcon({ name }: { name: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View
      className="items-center justify-center rounded-xl bg-primary-soft"
      style={{ width: 36, height: 36 }}
    >
      <Ionicons name={name} size={18} color={colors.primary} />
    </View>
  );
}

function GoogleRow() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useGoogleStatus();
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const returnUrl = Linking.createURL("google-connected");
      const res = await api.api.google.connect.$post({ json: { returnUrl } });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Couldn't connect Google");
      }
      const { url } = await res.json();
      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      await queryClient.invalidateQueries({ queryKey: GOOGLE_STATUS_KEY });
      if (result.type === "success") {
        const outcome = Linking.parse(result.url).queryParams?.google;
        if (outcome === "connected") Toast.success("Google connected");
        else Toast.error("Couldn't connect Google");
      }
    } catch (err) {
      Toast.error(err instanceof Error && err.message ? err.message : "Couldn't connect Google");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () =>
    Alert.alert(
      "Disconnect Google?",
      "Claude will no longer be able to draft emails or add calendar events.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await api.api.google.$delete();
              if (!res.ok) throw new Error();
              Toast.success("Google disconnected");
            } catch {
              Toast.error("Couldn't disconnect Google");
            } finally {
              await queryClient.invalidateQueries({ queryKey: GOOGLE_STATUS_KEY });
              setBusy(false);
            }
          },
        },
      ]
    );

  const connected = data?.connected ?? false;

  return (
    <View className="bg-white px-4 py-3" style={{ gap: 8 }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <RowIcon name="logo-google" />
        <View className="flex-1" style={{ gap: 2 }}>
          <AppText className="text-base text-gray-900">Google (Gmail + Calendar)</AppText>
          {isPending ? null : isError ? (
            <Pressable onPress={() => refetch()} hitSlop={6}>
              <AppText className="text-sm text-muted-foreground">Couldn’t load. Tap to retry</AppText>
            </Pressable>
          ) : (
            <AppText className="text-sm text-muted-foreground" numberOfLines={1}>
              {connected ? (data?.email ?? "Connected") : "Not connected"}
            </AppText>
          )}
        </View>
        {isPending || busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : connected ? (
          <Pressable onPress={disconnect} hitSlop={8}>
            <AppText className="text-sm" style={{ color: colors.overdue }}>
              Disconnect
            </AppText>
          </Pressable>
        ) : (
          <Pressable
            onPress={connect}
            disabled={isError}
            className="bg-primary rounded-full px-3 py-1.5"
            style={{ opacity: isError ? 0.5 : 1 }}
          >
            <AppText fontWeight="bold" className="text-white text-sm">
              Connect
            </AppText>
          </Pressable>
        )}
      </View>
      <AppText className="text-xs text-muted-foreground">
        Emails are only saved as drafts for you to send, and calendar events never invite anyone.
      </AppText>
    </View>
  );
}

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const { clear } = useAgent();

  const confirmSignOut = () =>
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          clear();
          await signOut();
        },
      },
    ]);

  const prefsSummary = user?.preferences?.trim()
    ? user.preferences.trim().split("\n")[0]
    : "Tell Claude about your tone, people, budgets and limits";

  return (
    <View className="flex-1 bg-app-bg">
      <AppBar
        title={
          <AppText className="text-gray-900 text-3xl" fontWeight="bold">
            More
          </AppText>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-6" style={{ gap: 4 }}>
          <AppText className="text-gray-900 text-lg" fontWeight="bold">
            {user?.fullName ?? "Signed in"}
          </AppText>
          <AppText className="text-muted-foreground">{user?.email}</AppText>
        </View>

        <View className="mx-4 mt-6 rounded-2xl overflow-hidden" style={{ gap: 1 }}>
          <Pressable
            onPress={() => router.push("/preferences")}
            className="flex-row items-center bg-white px-4 py-3"
            style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.7 : 1 })}
          >
            <RowIcon name="heart-outline" />
            <View className="flex-1" style={{ gap: 2 }}>
              <AppText className="text-base text-gray-900">How I like things</AppText>
              <AppText className="text-sm text-muted-foreground" numberOfLines={1}>
                {prefsSummary}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors["muted-foreground"]} />
          </Pressable>
          <GoogleRow />
        </View>

        <View className="px-4 pt-8">
          <AppButton text="Sign out" variant={AppButtonStyle.Outline} onPress={confirmSignOut} />
        </View>
      </ScrollView>
    </View>
  );
}
