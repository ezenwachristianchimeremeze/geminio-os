import { ScrollView, Text, View, Pressable, FlatList } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  date: string;
  icon: string;
}

export default function FinanceScreen() {
  const router = useRouter();
  const colors = useColors();
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "1",
      description: "Salary",
      amount: 5000,
      category: "Income",
      type: "income",
      date: "2024-06-25",
      icon: "attach-money",
    },
    {
      id: "2",
      description: "Grocery Store",
      amount: 120,
      category: "Food",
      type: "expense",
      date: "2024-06-24",
      icon: "shopping-cart",
    },
    {
      id: "3",
      description: "Electric Bill",
      amount: 85,
      category: "Utilities",
      type: "expense",
      date: "2024-06-23",
      icon: "bolt",
    },
  ]);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <Pressable
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View className="flex-row items-center justify-between bg-surface rounded-lg border border-border p-4 mb-2">
        <View className="flex-row items-center gap-3 flex-1">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{
              backgroundColor:
                item.type === "income"
                  ? colors.success + "20"
                  : colors.error + "20",
            }}
          >
            <MaterialIcons
              name={item.icon as any}
              size={20}
              color={item.type === "income" ? colors.success : colors.error}
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">
              {item.description}
            </Text>
            <Text className="text-xs text-muted mt-1">{item.date}</Text>
          </View>
        </View>
        <Text
          className={`text-sm font-bold ${
            item.type === "income" ? "text-successText" : "text-errorText"
          }`}
        >
          {item.type === "income" ? "+" : "-"}${item.amount}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-4 py-6 gap-4">
          <Pressable onPress={() => router.back()}>
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">Back</Text>
            </View>
          </Pressable>

          <View className="gap-1">
            <Text className="text-3xl font-bold text-foreground">Finance</Text>
            <Text className="text-sm text-muted">Track income and expenses</Text>
          </View>

          <View className="bg-primary rounded-xl p-6 gap-4">
            <Text className="text-sm font-semibold text-background opacity-80">
              Current Balance
            </Text>
            <Text className="text-4xl font-bold text-background">
              ${balance.toFixed(2)}
            </Text>
            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-xs text-background opacity-80 mb-1">Income</Text>
                <Text className="text-lg font-bold text-background">
                  +${totalIncome.toFixed(2)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-background opacity-80 mb-1">Expenses</Text>
                <Text className="text-lg font-bold text-background">
                  -${totalExpense.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
              Recent Transactions ({transactions.length})
            </Text>
            <FlatList
              data={transactions}
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>

          <View className="gap-2 mt-4">
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-primary rounded-lg px-4 py-3 flex-row items-center justify-center gap-2">
                <MaterialIcons name="add" size={20} color={colors.background} />
                <Text className="text-base font-semibold text-background">
                  Add Transaction
                </Text>
              </View>
            </Pressable>
          </View>

          <View className="h-4" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
