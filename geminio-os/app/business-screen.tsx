import { ScrollView, Text, View, Pressable, TextInput } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: number;
}

export default function BusinessScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'expenses' | 'clients'>('overview');
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: '1',
      title: 'Project Completion',
      amount: 5000,
      type: 'income',
      category: 'Services',
      date: Date.now() - 86400000,
    },
    {
      id: '2',
      title: 'Software Subscription',
      amount: 99,
      type: 'expense',
      category: 'Tools',
      date: Date.now() - 172800000,
    },
  ]);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalIncome - totalExpense;

  const TransactionCard = ({ transaction }: { transaction: Transaction }) => (
    <View className="bg-surface rounded-2xl p-4 mb-3 border border-border flex-row items-center justify-between">
      <View className="flex-row items-center gap-3 flex-1">
        <View
          className={`w-12 h-12 rounded-full items-center justify-center ${
            transaction.type === 'income'
              ? 'bg-success/20'
              : 'bg-error/20'
          }`}
        >
          <Text className="text-lg">
            {transaction.type === 'income' ? '📈' : '📉'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-foreground">
            {transaction.title}
          </Text>
          <Text className="text-xs text-muted mt-1">
            {transaction.category} • {new Date(transaction.date).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <Text
        className={`text-lg font-bold ${
          transaction.type === 'income'
            ? 'text-success'
            : 'text-error'
        }`}
      >
        {transaction.type === 'income' ? '+' : '-'}${transaction.amount}
      </Text>
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="px-6 pt-6 pb-8 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              Business Center
            </Text>
            <Text className="text-base text-muted">
              Manage finances and clients
            </Text>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setActiveTab('overview')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'overview'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'overview'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Overview
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('income')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'income'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'income'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Income
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('expenses')}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                activeTab === 'expenses'
                  ? 'bg-primary border-primary'
                  : 'border-border bg-surface'
              }`}
            >
              <Text
                className={`text-center font-semibold text-sm ${
                  activeTab === 'expenses'
                    ? 'text-white'
                    : 'text-foreground'
                }`}
              >
                Expenses
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          {activeTab === 'overview' && (
            <View className="gap-4">
              {/* Financial Summary Cards */}
              <View className="gap-3">
                <View className="bg-success/10 rounded-2xl p-4 border border-success/20">
                  <Text className="text-sm text-muted mb-1">Total Income</Text>
                  <Text className="text-3xl font-bold text-success">
                    ${totalIncome.toLocaleString()}
                  </Text>
                </View>
                <View className="bg-error/10 rounded-2xl p-4 border border-error/20">
                  <Text className="text-sm text-muted mb-1">Total Expenses</Text>
                  <Text className="text-3xl font-bold text-error">
                    ${totalExpense.toLocaleString()}
                  </Text>
                </View>
                <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
                  <Text className="text-sm text-muted mb-1">Net Profit</Text>
                  <Text className="text-3xl font-bold text-primary">
                    ${netProfit.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Recent Transactions */}
              <View className="gap-2">
                <Text className="text-lg font-bold text-foreground">
                  Recent Transactions
                </Text>
                {transactions.slice(0, 3).map((transaction) => (
                  <TransactionCard key={transaction.id} transaction={transaction} />
                ))}
              </View>
            </View>
          )}

          {activeTab === 'income' && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">
                Income Streams
              </Text>
              {transactions
                .filter((t) => t.type === 'income')
                .map((transaction) => (
                  <TransactionCard key={transaction.id} transaction={transaction} />
                ))}
            </View>
          )}

          {activeTab === 'expenses' && (
            <View className="gap-3">
              <Text className="text-lg font-bold text-foreground">
                Expenses
              </Text>
              {transactions
                .filter((t) => t.type === 'expense')
                .map((transaction) => (
                  <TransactionCard key={transaction.id} transaction={transaction} />
                ))}
            </View>
          )}

          {/* Quick Actions */}
          <View className="gap-2 mt-4">
            <Text className="text-lg font-bold text-foreground">
              Quick Actions
            </Text>
            <Pressable
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              className="bg-primary rounded-2xl p-4 items-center"
            >
              <Text className="text-white font-semibold">
                + Log Transaction
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
