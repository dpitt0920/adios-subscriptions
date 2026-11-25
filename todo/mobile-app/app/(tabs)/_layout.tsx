import { useEffect } from "react";
import { router, Tabs, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/constants";

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName, activeName: IconName) {
  function TabIcon({ focused, color }: { focused: boolean; color: string }) {
    return <Ionicons name={focused ? activeName : name} size={24} color={color} />;
  }
  return TabIcon;
}

// Home (the dashboard) is the tab the app opens on.
export const unstable_settings = { initialRouteName: "home" };

// The root URL "/" resolves to the Today screen (index), so on the first mount
// of the tab bar we move to Home once. Later taps on Today are left alone.
let openedHome = false;

export default function TabsLayout() {
  const pathname = usePathname();
  useEffect(() => {
    if (openedHome) return;
    openedHome = true;
    if (pathname === "/") router.replace("/home");
  }, [pathname]);

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors["muted-foreground"],
        tabBarStyle: { borderTopColor: "#F0F0F3" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: tabIcon("grid-outline", "grid") }}
      />
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
