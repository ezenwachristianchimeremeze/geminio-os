import { ScrollView, Text, View, Pressable, Dimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface Metric {
  label: string;
  value: string | number;
  change: number;
  icon: string;
}

export default function AnalyticsScreen() {
  const colors = useColors();

  const metrics: Metric[] = [
    { label: "Total Tasks", value: 47, change: 12, icon: "📋" },
    { label: "Goals Progress", value: "65%", change: 8, icon: "🎯" },
    { label: "Productivity Score", value: 8.5, change: 5, icon: "⚡" },
    { label: "Focus Time", value: "24h", change: 15, icon: "⏱️" },
  ];

  const weeklyData = [
    { day: "Mon", value: 65 },
    { day: "Tue", value: 78 },
    { day: "Wed", value: 72 },
    { day: "Thu", value: 85 },
    { day: "Fri", value: 92 },
    { day: "Sat", value: 45 },
    { day: "Sun", value: 38 },
  ];

  const categoryBreakdown = [
    { name: "Work", value: 45, color: "bg-blue-500" },
    { name: "Learning", value: 25, color: "bg-purple-500" },
    { name: "Personal", value: 20, color: "bg-pink-500" },
    { name: "Health", value: 10, color: "bg-green-500" },
  ];

  const MetricCard = ({ metric }: { metric: Metric }) => (
    <View className="flex-1 bg-surface border border-border rounded-lg p-4 mr-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-2xl">{metric.icon}</Text>
        <View className={`px-2 py-1 rounded-full ${metric.change > 0 ? "bg-green-500/20" : "bg-red-500/20"}`}>
          <Text className={`text-xs font-semibold ${metric.change > 0 ? "text-green-600" : "text-red-600"}`}>
            {metric.change > 0 ? "+" : ""}{metric.change}%
          </Text>
        </View>
      </View>
      <Text className="text-2xl font-bold text-foreground">{metric.value}</Text>
      <Text className="text-xs text-muted mt-2">{metric.label}</Text>
    </View>
  );

  const BarChart = () => (
    <View className="bg-surface border border-border rounded-lg p-4">
      <Text className="text-lg font-semibold text-foreground mb-4">Weekly Activity</Text>
      <View className="flex-row items-end justify-between h-32 gap-2">
        {weeklyData.map((data, idx) => {
          const maxValue = Math.max(...weeklyData.map((d) => d.value));
          const height = (data.value / maxValue) * 100;

          return (
            <View key={idx} className="flex-1 items-center">
              <View
                className="w-full bg-primary rounded-t-lg"
                style={{ height: `${height}%` }}
              />
              <Text className="text-xs text-muted mt-2">{data.day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  const PieChart = () => (
    <View className="bg-surface border border-border rounded-lg p-4">
      <Text className="text-lg font-semibold text-foreground mb-4">Time Distribution</Text>
      <View className="gap-3">
        {categoryBreakdown.map((category, idx) => (
          <View key={idx}>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm font-semibold text-foreground">{category.name}</Text>
              <Text className="text-sm font-semibold text-foreground">{category.value}%</Text>
            </View>
            <View className="w-full bg-border rounded-full h-2 overflow-hidden">
              <View
                className={category.color}
                style={{ width: `${category.value}%` }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0 flex-1">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-6 pb-4 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Analytics</Text>
          <Text className="text-sm text-muted mt-1">Your productivity insights</Text>
        </View>

        {/* Key Metrics */}
        <View className="px-6 pt-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Key Metrics</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {metrics.map((metric, idx) => (
              <MetricCard key={idx} metric={metric} />
            ))}
          </ScrollView>
        </View>

        {/* Weekly Activity Chart */}
        <View className="px-6 pb-6">
          <BarChart />
        </View>

        {/* Time Distribution */}
        <View className="px-6 pb-6">
          <PieChart />
        </View>

        {/* Insights */}
        <View className="px-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Insights</Text>
          <View className="bg-surface border border-border rounded-lg p-4 gap-3">
            <View className="flex-row items-start gap-3">
              <Text className="text-2xl">💡</Text>
              <View className="flex-1">
                <Text className="font-semibold text-foreground">Peak Productivity</Text>
                <Text className="text-sm text-muted mt-1">You are most productive on Fridays. Keep up the momentum!</Text>
              </View>
            </View>
            <View className="flex-row items-start gap-3">
              <Text className="text-2xl">🎯</Text>
              <View className="flex-1">
                <Text className="font-semibold text-foreground">Goal Progress</Text>
                <Text className="text-sm text-muted mt-1">You are 65% towards your goals. Complete 2 more milestones!</Text>
              </View>
            </View>
            <View className="flex-row items-start gap-3">
              <Text className="text-2xl">⚡</Text>
              <View className="flex-1">
                <Text className="font-semibold text-foreground">Focus Time</Text>
                <Text className="text-sm text-muted mt-1">Average 24 hours of focused work per week. Excellent!</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Export Options */}
        <View className="px-6 pb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Export</Text>
          <View className="flex-row gap-3">
            <Pressable className="flex-1 bg-primary rounded-lg p-3 items-center">
              <Text className="text-white font-semibold">📄 PDF Report</Text>
            </Pressable>
            <Pressable className="flex-1 bg-surface border border-border rounded-lg p-3 items-center">
              <Text className="text-foreground font-semibold">📊 CSV Export</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
