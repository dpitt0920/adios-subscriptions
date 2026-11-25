import { useRef, useState } from "react";
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
import classNames from "classnames";
import { AppBar } from "@/components/AppBar";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/constants";
import { useAgent } from "@/providers/AgentProvider";

const SUGGESTIONS = [
  "Plan my day",
  "What's overdue?",
  "Move everything due today to tomorrow",
  "Break down my biggest task",
];

export default function AssistantScreen() {
  const { messages, pending, send, clear } = useAgent();
  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const submit = (value = text) => {
    if (!value.trim() || pending) return;
    setText("");
    send(value);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-app-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppBar
        title={
          <AppText className="text-gray-900 text-3xl" fontWeight="bold">
            Assistant
          </AppText>
        }
        rightAction={
          messages.length > 0 ? (
            <Pressable onPress={clear} hitSlop={8} disabled={pending}>
              <AppText className="text-primary text-sm" fontWeight="bold">
                Clear
              </AppText>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && !pending && (
          <View className="flex-1 justify-center" style={{ gap: 12 }}>
            <AppText className="text-muted-foreground text-center mb-2">
              Ask me to add, change, break down or plan your tasks.
            </AppText>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => submit(s)}
                className="bg-white rounded-2xl px-4 py-3 border border-gray-200"
              >
                <AppText className="text-gray-800">{s}</AppText>
              </Pressable>
            ))}
          </View>
        )}

        {messages.map((m) => (
          <View
            key={m.id}
            className={classNames("max-w-[85%] rounded-2xl px-4 py-2.5", {
              "self-end bg-primary": m.role === "user",
              "self-start bg-white": m.role === "assistant" && !m.error,
              "self-start bg-red-50": m.error,
            })}
          >
            <AppText
              className={classNames("text-base", {
                "text-white": m.role === "user",
                "text-gray-900": m.role === "assistant" && !m.error,
                "text-red-700": m.error,
              })}
            >
              {m.content}
            </AppText>
          </View>
        ))}

        {pending && (
          <View className="self-start bg-white rounded-2xl px-4 py-3">
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </ScrollView>

      <View className="flex-row items-end px-4 pb-4 pt-2" style={{ gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Message the assistant"
          placeholderTextColor={colors["muted-foreground"]}
          multiline
          className="flex-1 bg-white rounded-2xl px-4 py-3 text-base text-gray-900 border border-gray-200"
          style={{ maxHeight: 120 }}
        />
        <Pressable
          onPress={() => submit()}
          disabled={pending || !text.trim()}
          className="mb-1.5"
          hitSlop={8}
        >
          <Ionicons
            name="arrow-up-circle"
            size={36}
            color={text.trim() && !pending ? colors.primary : colors["muted-foreground"]}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
