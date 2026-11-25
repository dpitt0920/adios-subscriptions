// Plain-language quick capture: "call mom tomorrow 5pm" goes to the agent,
// which turns it into one or more tasks.

import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Toast } from "toastify-react-native";
import { colors } from "@/lib/constants";
import { useAgent } from "@/providers/AgentProvider";

export function CaptureBar({ placeholder = "Add a task… e.g. “pay rent Friday, urgent”" }) {
  const { send, pending } = useAgent();
  const [text, setText] = useState("");

  const submit = async () => {
    const value = text.trim();
    if (!value || pending) return;
    setText("");
    const reply = await send(value, { silent: true });
    if (reply) Toast.info(reply);
  };

  return (
    <View
      className="flex-row items-center bg-white rounded-2xl mx-4 px-4 border border-gray-200"
      style={{ gap: 8, minHeight: 48 }}
    >
      <Ionicons name="sparkles" size={18} color={colors.primary} />
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={colors["muted-foreground"]}
        returnKeyType="send"
        editable={!pending}
        className="flex-1 text-base text-gray-900 py-3"
      />
      <Pressable onPress={submit} disabled={pending || !text.trim()} hitSlop={8}>
        {pending ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons
            name="arrow-up-circle"
            size={28}
            color={text.trim() ? colors.primary : colors["muted-foreground"]}
          />
        )}
      </Pressable>
    </View>
  );
}
