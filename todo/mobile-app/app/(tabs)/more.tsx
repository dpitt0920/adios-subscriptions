import { Alert, View } from "react-native";
import { AppBar } from "@/components/AppBar";
import { AppButton, AppButtonStyle } from "@/components/AppButton";
import { AppText } from "@/components/AppText";
import { useAgent } from "@/providers/AgentProvider";
import { useAuth } from "@/providers/AuthProvider";

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

  return (
    <View className="flex-1 bg-app-bg">
      <AppBar
        title={
          <AppText className="text-gray-900 text-3xl" fontWeight="bold">
            More
          </AppText>
        }
      />
      <View className="px-4 pt-6" style={{ gap: 4 }}>
        <AppText className="text-gray-900 text-lg" fontWeight="bold">
          {user?.fullName ?? "Signed in"}
        </AppText>
        <AppText className="text-muted-foreground">{user?.email}</AppText>
      </View>
      <View className="px-4 pt-8">
        <AppButton text="Sign out" variant={AppButtonStyle.Outline} onPress={confirmSignOut} />
      </View>
    </View>
  );
}
