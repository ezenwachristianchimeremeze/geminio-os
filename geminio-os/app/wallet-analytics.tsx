import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, Alert, FlatList } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import * as Haptics from 'expo-haptics';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: Date;
}

interface Budget {
  category: string;
  limit: number;
  spent: number;
}

interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  nextBillingDate: Date;
}

const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    type: 'income',
    category: 'Salary',
    amount: 5000,
    description: 'Monthly salary',
    date: new Date(Date.now() - 86400000),
  },
  {
    id: 't2',
    type: 'expense',
    category: 'Food',
    amount: 45.50,
    description: 'Groceries',
    date: new Date(Date.now() - 43200000),
  },
  {
    id: 't3',
    type: 'expense',
    category: 'Entertainment',
    amount: 12.99,
    description: 'Movie ticket',
    date: new Date(Date.now() - 3600000),
  },
];

const SAMPLE_BUDGETS: Budget[] = [
  { category: 'Food', limit: 500, spent: 320 },
  { category: 'Entertainment', limit: 200, spent: 150 },
  { category: 'Transport', limit: 300, spent: 280 },
  { category: 'Utilities', limit: 400, spent: 350 },
];

const SAMPLE_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 's1',
    name: 'Netflix',
    amount: 15.99,
    frequency: 'monthly',
    nextBillingDate: new Date(Date.now() + 5 * 86400000),
  },
  {
    id: 's2',
    name: 'Spotify',
    amount: 9.99,
    frequency: 'monthly',
    nextBillingDate: new Date(Date.now() + 8 * 86400000),
  },
];

export default function WalletAnalyticsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>(SAMPLE_TRANSACTIONS);
  const [budgets, setBudgets] = useState<Budget[]>(SAMPLE_BUDGETS);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(SAMPLE_SUBSCRIPTIONS);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'subscriptions'>('overview');

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const handleAddTransaction = useCallback(() => {
    Alert.alert('Add Transaction', 'Add new transaction');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleGenerateReport = useCallback(() => {
    Alert.alert('Report Generated', 'Generating financial report...');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const TransactionCard = ({ transaction }: { transaction: Transaction }) => (
    <View className="bg-surface rounded-lg p-3 mb-2 border border-border flex-row items-center justify-between">
      <View className="flex-1">
        <Text className="font-semibold text-foreground">{transaction.category}</Text>
        <Text className="text-xs text-muted">{transaction.description}</Text>
      </View>
      <Text className={`font-bold text-lg ${transaction.type === 'income' ? 'text-successText' : 'text-foreground'}`}>
        {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
      </Text>
    </View>
  );

  const BudgetCard = ({ budget }: { budget: Budget }) => {
    const percentage = (budget.spent / budget.limit) * 100;
    const isOver = budget.spent > budget.limit;

    return (
      <View className="bg-surface rounded-lg p-3 mb-2 border border-border gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold text-foreground">{budget.category}</Text>
          <Text className={`font-bold ${isOver ? 'text-errorText' : 'text-successText'}`}>
            ${budget.spent.toFixed(2)} / ${budget.limit.toFixed(2)}
          </Text>
        </View>
        <View className="h-2 bg-muted/20 rounded-full overflow-hidden">
          <View
            className={`h-full ${isOver ? 'bg-error' : 'bg-success'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </View>
        <Text className="text-xs text-muted">{Math.round(percentage)}% spent</Text>
      </View>
    );
  };

  const SubscriptionCard = ({ subscription }: { subscription: Subscription }) => (
    <View className="bg-surface rounded-lg p-3 mb-2 border border-border">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-foreground">{subscription.name}</Text>
          <Text className="text-xs text-muted">
            Next billing: {subscription.nextBillingDate.toLocaleDateString()}
          </Text>
        </View>
        <Text className="font-bold text-foreground">${subscription.amount.toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <View className="flex-1">
        {/* Tabs */}
        <View className="flex-row border-b border-border">
          {(['overview', 'analytics', 'subscriptions'] as const).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === tab ? 'border-primary' : 'border-transparent'
              }`}
            >
              <Text className={`font-semibold text-sm ${activeTab === tab ? 'text-primary' : 'text-muted'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
          <View className="px-6 pt-6 pb-8 gap-4">
            {activeTab === 'overview' ? (
              <>
                {/* Balance Cards */}
                <View className="gap-2">
                  <View className="bg-gradient-to-br from-success/10 to-primary/10 rounded-2xl p-4 border border-success/20">
                    <Text className="text-sm text-muted mb-1">Income</Text>
                    <Text className="text-3xl font-bold text-successText">${totalIncome.toFixed(2)}</Text>
                  </View>
                  <View className="bg-gradient-to-br from-error/10 to-warning/10 rounded-2xl p-4 border border-error/20">
                    <Text className="text-sm text-muted mb-1">Expenses</Text>
                    <Text className="text-3xl font-bold text-errorText">${totalExpense.toFixed(2)}</Text>
                  </View>
                  <View className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 border border-primary/20">
                    <Text className="text-sm text-muted mb-1">Balance</Text>
                    <Text className={`text-3xl font-bold ${balance >= 0 ? 'text-successText' : 'text-errorText'}`}>
                      ${balance.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Recent Transactions */}
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-bold text-foreground">Recent Transactions</Text>
                    <Pressable
                      onPress={handleAddTransaction}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className="bg-primary rounded-lg px-3 py-1"
                    >
                      <Text className="text-primaryForeground font-semibold text-sm">+ Add</Text>
                    </Pressable>
                  </View>
                  {transactions.map(t => (
                    <TransactionCard key={t.id} transaction={t} />
                  ))}
                </View>
              </>
            ) : activeTab === 'analytics' ? (
              <>
                {/* Budget Overview */}
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-bold text-foreground">Budget Status</Text>
                    <Pressable
                      onPress={handleGenerateReport}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                      className="bg-primary rounded-lg px-3 py-1"
                    >
                      <Text className="text-primaryForeground font-semibold text-sm">Report</Text>
                    </Pressable>
                  </View>
                  {budgets.map(budget => (
                    <BudgetCard key={budget.category} budget={budget} />
                  ))}
                </View>

                {/* Insights */}
                <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 gap-2">
                  <Text className="font-semibold text-primary">💡 Financial Insights</Text>
                  <Text className="text-sm text-foreground">
                    • Spending is at 64% of your budget
                    • Entertainment is 75% of limit
                    • Average monthly expense: $58.49
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* Subscriptions */}
                <View className="gap-2">
                  <Text className="text-lg font-bold text-foreground">Active Subscriptions</Text>
                  {subscriptions.map(sub => (
                    <SubscriptionCard key={sub.id} subscription={sub} />
                  ))}
                </View>

                {/* Monthly Subscription Cost */}
                <View className="bg-surface rounded-2xl p-4 border border-border gap-2">
                  <Text className="font-semibold text-foreground">Monthly Subscription Cost</Text>
                  <Text className="text-2xl font-bold text-primary">
                    ${subscriptions.reduce((sum, s) => sum + (s.frequency === 'monthly' ? s.amount : 0), 0).toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
