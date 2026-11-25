import { View } from "react-native";
import { AppText } from "@/components/AppText";

export function SectionHeader({
  title,
  count,
  color,
  right,
}: {
  title: string;
  count?: number;
  color?: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 pt-6 pb-2">
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <AppText fontWeight="bold" className="text-base text-gray-900" style={color ? { color } : undefined}>
          {title}
        </AppText>
        {count != null && <AppText className="text-sm text-muted-foreground">{count}</AppText>}
      </View>
      {right}
    </View>
  );
}
