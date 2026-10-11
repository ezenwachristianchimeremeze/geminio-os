import { ScrollView, Text, View, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";

interface Document {
  id: string;
  name: string;
  type: string;
  date: string;
}

export default function DocumentsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [documents] = useState<Document[]>([
    { id: "1", name: "Project Proposal", type: "PDF", date: "Today" },
    { id: "2", name: "Meeting Notes", type: "Document", date: "Yesterday" },
    { id: "3", name: "Budget Report", type: "Spreadsheet", date: "2 days ago" },
  ]);

  const renderDocument = ({ item }: { item: Document }) => (
    <Pressable className="mb-3">
      <View className="bg-surface rounded-lg border border-border p-4 flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-lg bg-primary/20 items-center justify-center">
          <MaterialIcons name="description" size={20} color={colors.primary} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-sm font-semibold text-foreground">{item.name}</Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted">{item.type}</Text>
            <Text className="text-xs text-muted">{item.date}</Text>
          </View>
        </View>
        <MaterialIcons name="open-in-new" size={16} color={colors.primary} />
      </View>
    </Pressable>
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
            <Text className="text-3xl font-bold text-foreground">Documents</Text>
            <Text className="text-sm text-muted">Your files</Text>
          </View>

          <FlatList
            data={documents}
            renderItem={renderDocument}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
