import { ScrollView, Text, View, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";

interface Device {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline";
}

export default function DeviceControlScreen() {
  const router = useRouter();
  const colors = useColors();
  const [devices] = useState<Device[]>([
    { id: "1", name: "iPhone 15", type: "Mobile", status: "online" },
    { id: "2", name: "MacBook Pro", type: "Computer", status: "online" },
    { id: "3", name: "Smart Home Hub", type: "IoT", status: "offline" },
  ]);

  const renderDevice = ({ item }: { item: Device }) => (
    <View className="mb-3 bg-surface rounded-lg border border-border p-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1">
        <View className={`w-10 h-10 rounded-lg items-center justify-center ${
          item.status === "online" ? "bg-success/20" : "bg-muted/20"
        }`}>
          <MaterialIcons 
            name="devices" 
            size={20} 
            color={item.status === "online" ? colors.success : colors.muted} 
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">{item.name}</Text>
          <Text className="text-xs text-muted">{item.type}</Text>
        </View>
      </View>
      <View className={`px-2 py-1 rounded ${item.status === "online" ? "bg-success/20" : "bg-muted/20"}`}>
        <Text className={`text-xs font-semibold capitalize ${
          item.status === "online" ? "text-successText" : "text-muted"
        }`}>
          {item.status}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-4 py-6 gap-6">
          <Pressable onPress={() => router.back()}>
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">Back</Text>
            </View>
          </Pressable>

          <View className="gap-1">
            <Text className="text-3xl font-bold text-foreground">Device Control</Text>
            <Text className="text-sm text-muted">Manage your devices</Text>
          </View>

          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
