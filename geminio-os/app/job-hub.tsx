import { ScrollView, Text, View, Pressable, FlatList, TextInput } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  status: "applied" | "interviewing" | "rejected" | "saved";
  matchScore: number;
  appliedDate?: string;
}

/**
 * Job Hub Dashboard
 * 
 * Features:
 * - Job search and filtering
 * - Application tracking
 * - Resume and cover letter generation
 * - Interview preparation
 */
export default function JobHubScreen() {
  const router = useRouter();
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([
    {
      id: "1",
      title: "Senior React Developer",
      company: "Tech Corp",
      location: "Remote",
      salary: "$120k - $160k",
      status: "applied",
      matchScore: 95,
      appliedDate: "2024-06-20",
    },
    {
      id: "2",
      title: "Full Stack Engineer",
      company: "StartUp Inc",
      location: "San Francisco, CA",
      salary: "$100k - $140k",
      status: "saved",
      matchScore: 87,
    },
    {
      id: "3",
      title: "AI/ML Engineer",
      company: "AI Labs",
      location: "Remote",
      salary: "$130k - $180k",
      status: "interviewing",
      matchScore: 92,
      appliedDate: "2024-06-15",
    },
  ]);

  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<Job["status"], string> = {
    applied: colors.primary,
    interviewing: colors.warning,
    rejected: colors.error,
    saved: colors.success,
  };

  const statusIcons: Record<Job["status"], any> = {
    applied: "check-circle",
    interviewing: "schedule",
    rejected: "cancel",
    saved: "bookmark",
  };

  const renderJobCard = ({ item }: { item: Job }) => (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <View className="bg-surface rounded-lg border border-border p-4 mb-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">
              {item.title}
            </Text>
            <Text className="text-sm text-muted mt-1">{item.company}</Text>
          </View>
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: statusColors[item.status] + "20" }}
          >
            <MaterialIcons
              name={statusIcons[item.status]}
              size={16}
              color={statusColors[item.status]}
            />
          </View>
        </View>

        <View className="flex-row items-center gap-2 mb-3">
          <MaterialIcons name="location-on" size={14} color={colors.muted} />
          <Text className="text-xs text-muted">{item.location}</Text>
          <Text className="text-xs text-muted">•</Text>
          <Text className="text-xs font-semibold text-foreground">
            {item.salary}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="w-16 h-2 bg-border rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${item.matchScore}%` }}
              />
            </View>
            <Text className="text-xs font-semibold text-primary">
              {item.matchScore}% match
            </Text>
          </View>
            <MaterialIcons name="arrow-forward" size={16} color={colors.primary} />
        </View>
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
          {/* Header */}
          <Pressable onPress={() => router.back()}>
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
              <Text className="text-sm font-semibold text-primary">Back</Text>
            </View>
          </Pressable>

          <View className="gap-1">
            <Text className="text-3xl font-bold text-foreground">
              Job Hub
            </Text>
            <Text className="text-sm text-muted">
              Track applications and opportunities
            </Text>
          </View>

          {/* Stats */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-lg border border-border p-3">
              <Text className="text-xs text-muted mb-1">Applied</Text>
              <Text className="text-2xl font-bold text-foreground">
                {jobs.filter((j) => j.status === "applied").length}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-lg border border-border p-3">
              <Text className="text-xs text-muted mb-1">Interviewing</Text>
              <Text className="text-2xl font-bold text-foreground">
                {jobs.filter((j) => j.status === "interviewing").length}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-lg border border-border p-3">
              <Text className="text-xs text-muted mb-1">Saved</Text>
              <Text className="text-2xl font-bold text-foreground">
                {jobs.filter((j) => j.status === "saved").length}
              </Text>
            </View>
          </View>

          {/* Search */}
          <View className="bg-surface rounded-lg border border-border px-4 py-3 flex-row items-center gap-2">
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search jobs..."
              placeholderTextColor={colors.muted}
              className="flex-1 text-foreground text-base"
            />
          </View>

          {/* Jobs List */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-muted uppercase tracking-wide">
              Your Jobs ({filteredJobs.length})
            </Text>
            <FlatList
              data={filteredJobs}
              renderItem={renderJobCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>

          {/* Action Buttons */}
          <View className="gap-2 mt-4">
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-primary rounded-lg px-4 py-3 flex-row items-center justify-center gap-2">
                <MaterialIcons name="search" size={20} color={colors.background} />
                <Text className="text-base font-semibold text-background">
                  Search New Jobs
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-surface border border-border rounded-lg px-4 py-3 flex-row items-center justify-center gap-2">
                <MaterialIcons name="description" size={20} color={colors.primary} />
                <Text className="text-base font-semibold text-primary">
                  Generate Resume
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
