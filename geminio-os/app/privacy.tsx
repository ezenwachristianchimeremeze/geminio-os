import { ScrollView, Text, View, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";

interface Permission {
  id: string;
  name: string;
  status: "allowed" | "denied";
}

export default function PrivacyScreen() {
  const router = useRouter();
  const colors = useColors();
  const [permissions] = useState<Permission[]>([
    { id: "1", name: "Camera Access", status: "allowed" },
    { id: "2", name: "Microphone Access", status: "allowed" },
    { id: "3", name: "Location Services", status: "denied" },
    { id: "4", name: "Contacts Access", status: "allowed" },
  ]);

  const renderPermission = ({ item }: { item: Permission }) => (
    <View className="mb-3 bg-surface rounded-lg border border-border p-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1">
        <View className={`w-10 h-10 rounded-lg items-center justify-center ${
          item.status === "allowed" ? "bg-success/20" : "bg-error/20"
        }`}>
          <MaterialIcons 
            name="security" 
            size={20} 
            color={item.status === "allowed" ? colors.success : colors.error} 
          />
        </View>
        <Text className="text-sm font-semibold text-foreground flex-1">{item.name}</Text>
      </View>
      <Pressable>
        <View className={`px-3 py-1 rounded ${item.status === "allowed" ? "bg-success/20" : "bg-error/20"}`}>
          <Text className={`text-xs font-semibold capitalize ${
            item.status === "allowed" ? "text-successText" : "text-errorText"
          }`}>
            {item.status}
          </Text>
        </View>
      </Pressable>
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
            <Text className="text-3xl font-bold text-foreground">Privacy & Security</Text>
            <Text className="text-sm text-muted">Manage permissions</Text>
          </View>

          <FlatList
            data={permissions}
            renderItem={renderPermission}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
