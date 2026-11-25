import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/constants";

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName, activeName: IconName) {
  function TabIcon({ focused, color }: { focused: boolean; color: string }) {
    return <Ionicons name={focused ? activeName : name} size={24} color={color} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors["muted-foreground"],
        tabBarStyle: { borderTopColor: "#F0F0F3" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarIcon: tabIcon("sunny-outline", "sunny") }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: "Tasks", tabBarIcon: tabIcon("list-outline", "list") }}
      />
      <Tabs.Screen
        name="assistant"
        options={{ title: "Assistant", tabBarIcon: tabIcon("sparkles-outline", "sparkles") }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: tabIcon("ellipsis-horizontal", "ellipsis-horizontal"),
        }}
      />
    </Tabs>
  );
}
