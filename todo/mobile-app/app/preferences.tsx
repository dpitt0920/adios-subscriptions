// "How I like things": a free-text profile Claude reads before every task.

import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast } from "toastify-react-native";
import { AppText } from "@/components/AppText";
import { api } from "@/lib/api";
import { colors } from "@/lib/constants";
import { useAuth } from "@/providers/AuthProvider";

const MAX_LENGTH = 10000;

const PROMPTS: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; example: string }[] = [
  {
    icon: "mail-outline",
    title: "Tone for emails",
    example: "Warm but brief. Sign off with “Best, Sam”. Formal with my landlord.",
  },
  {
    icon: "people-outline",
    title: "People & relationships",
    example: "Ana is my partner. Mom is Linda. My manager is Priya (priya@work.com).",
  },
  {
    icon: "wallet-outline",
    title: "Budgets",
    example: "Gifts under $50. Prefer refurbished. Ask me before anything over $200.",
  },
  {
    icon: "time-outline",
    title: "Hours you're free",
    example: "Weekdays after 6pm, Saturday mornings. No calls before 9am.",
  },
  {
    icon: "close-circle-outline",
    title: "Things never to do",
    example: "Never email my boss on weekends. Don't book anything on Sundays.",
  },
];

const PLACEHOLDER = `Write anything Claude should know, for example:

• Emails: friendly, short, sign off “Best, Sam”
• People: Ana (partner), Mom (Linda), boss Priya
• Budgets: gifts under $50, ask before spending $200+
• Free: weekdays after 6pm, Saturday mornings
• Never: book anything on Sundays`;

export default function PreferencesScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { user, refetchUser } = useAuth();
  const initial = user?.preferences ?? "";
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = text.trim() !== initial.trim();

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const value = text.trim() || null;
      const res = await api.api.me.$patch({ json: { preferences: value } });
      if (!res.ok) throw new Error();
      await refetchUser();
      Toast.success("Saved. Claude will use this from now on.");
      router.back();
    } catch {
      Toast.error("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const insertPrompt = (title: string) => {
    setText((prev) => {
      const line = `${title}: `;
      if (!prev.trim()) return line;
      return `${prev.replace(/\s+$/, "")}\n\n${line}`;
    });
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-app-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        className="flex-row items-center justify-between px-4 pb-2"
        style={{ paddingTop: Platform.OS === "ios" ? 16 : top + 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <AppText className="text-base text-gray-600">Cancel</AppText>
        </Pressable>
        <AppText fontWeight="bold" className="text-base text-gray-900">
          How I like things
        </AppText>
        <Pressable onPress={save} disabled={saving || !dirty} hitSlop={10}>
          {saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <AppText
              fontWeight="bold"
              className="text-base"
              style={{ color: dirty ? colors.primary : colors["muted-foreground"] }}
            >
              Save
            </AppText>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottom + 40, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText className="text-sm text-gray-600">
          Claude reads this before every task, so drafts sound like you and plans fit your life.
        </AppText>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={PLACEHOLDER}
          placeholderTextColor={colors["muted-foreground"]}
          multiline
          maxLength={MAX_LENGTH}
          textAlignVertical="top"
          className="bg-white rounded-2xl px-4 py-3 text-base text-gray-900"
          style={{ minHeight: 280 }}
        />
        <AppText className="text-xs text-muted-foreground text-right -mt-2">
          {text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </AppText>

        <View style={{ gap: 8 }}>
          <AppText fontWeight="bold" className="text-sm text-gray-900">
            Ideas to cover
          </AppText>
          {PROMPTS.map((p) => (
            <Pressable
              key={p.title}
              onPress={() => insertPrompt(p.title)}
              className="flex-row items-start bg-white rounded-2xl px-4 py-3"
              style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name={p.icon} size={20} color={colors.primary} style={{ marginTop: 1 }} />
              <View className="flex-1" style={{ gap: 2 }}>
                <AppText fontWeight="bold" className="text-sm text-gray-900">
                  {p.title}
                </AppText>
                <AppText className="text-sm text-gray-600">{p.example}</AppText>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={colors["muted-foreground"]} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
