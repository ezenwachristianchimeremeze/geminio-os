/**
 * Geminio OS - Memory System
 * 
 * Stores and retrieves:
 * - User preferences and habits
 * - Conversation history and context
 * - Feedback and learning data
 * - Goals and progress tracking
 * - Decision history and outcomes
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserMemory {
  userId: string;
  preferences: {
    communicationStyle: "formal" | "casual" | "technical" | "friendly";
    riskTolerance: "conservative" | "moderate" | "aggressive";
    decisionSpeed: "quick" | "balanced" | "thorough";
    learningStyle: "visual" | "reading" | "hands-on" | "mixed";
  };
  habits: {
    workHours: string;
    focusAreas: string[];
    communicationFrequency: "frequent" | "moderate" | "minimal";
    peakProductivityTime: string;
  };
  goals: Array<{
    id: string;
    title: string;
    description: string;
    status: "active" | "completed" | "paused";
    createdAt: Date;
    targetDate?: Date;
    progress: number;
  }>;
  conversationHistory: Array<{
    id: string;
    topic: string;
    summary: string;
    timestamp: Date;
    feedback?: "helpful" | "neutral" | "unhelpful";
  }>;
  decisionHistory: Array<{
    id: string;
    decision: string;
    optionsConsidered: string[];
    chosenOption: string;
    outcome?: string;
    timestamp: Date;
    satisfaction: number; // 1-10
  }>;
  learningPreferences: {
    preferredResources: string[];
    completedCourses: string[];
    skillsToLearn: string[];
  };
}

/**
 * Memory System Service
 * 
 * Manages all user memory and learning data
 */
export class MemorySystem {
  private storageKey = "geminio_memory";
  private memory: UserMemory | null = null;

  /**
   * Initialize memory system
   */
  async initialize(userId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        this.memory = JSON.parse(stored);
      } else {
        this.memory = this.createDefaultMemory(userId);
        await this.save();
      }
    } catch (error) {
      console.error("Memory initialization error:", error);
      this.memory = this.createDefaultMemory(userId);
    }
  }

  /**
   * Create default memory structure
   */
  private createDefaultMemory(userId: string): UserMemory {
    return {
      userId,
      preferences: {
        communicationStyle: "friendly",
        riskTolerance: "moderate",
        decisionSpeed: "balanced",
        learningStyle: "mixed",
      },
      habits: {
        workHours: "9am-5pm",
        focusAreas: [],
        communicationFrequency: "moderate",
        peakProductivityTime: "morning",
      },
      goals: [],
      conversationHistory: [],
      decisionHistory: [],
      learningPreferences: {
        preferredResources: [],
        completedCourses: [],
        skillsToLearn: [],
      },
    };
  }

  /**
   * Save memory to storage
   */
  async save(): Promise<void> {
    if (!this.memory) return;
    try {
      await AsyncStorage.setItem(
        this.storageKey,
        JSON.stringify(this.memory)
      );
    } catch (error) {
      console.error("Memory save error:", error);
    }
  }

  /**
   * Add conversation to history
   */
  async addConversation(
    topic: string,
    summary: string,
    feedback?: "helpful" | "neutral" | "unhelpful"
  ): Promise<void> {
    if (!this.memory) return;

    this.memory.conversationHistory.push({
      id: `conv_${Date.now()}`,
      topic,
      summary,
      timestamp: new Date(),
      feedback,
    });

    // Keep only last 100 conversations
    if (this.memory.conversationHistory.length > 100) {
      this.memory.conversationHistory = this.memory.conversationHistory.slice(
        -100
      );
    }

    await this.save();
  }

  /**
   * Add decision to history
   */
  async addDecision(
    decision: string,
    optionsConsidered: string[],
    chosenOption: string,
    satisfaction: number
  ): Promise<void> {
    if (!this.memory) return;

    this.memory.decisionHistory.push({
      id: `dec_${Date.now()}`,
      decision,
      optionsConsidered,
      chosenOption,
      timestamp: new Date(),
      satisfaction,
    });

    // Keep only last 50 decisions
    if (this.memory.decisionHistory.length > 50) {
      this.memory.decisionHistory = this.memory.decisionHistory.slice(-50);
    }

    await this.save();
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    updates: Partial<UserMemory["preferences"]>
  ): Promise<void> {
    if (!this.memory) return;

    this.memory.preferences = {
      ...this.memory.preferences,
      ...updates,
    };

    await this.save();
  }

  /**
   * Add or update goal
   */
  async setGoal(
    title: string,
    description: string,
    targetDate?: Date
  ): Promise<string> {
    if (!this.memory) return "";

    const goalId = `goal_${Date.now()}`;
    this.memory.goals.push({
      id: goalId,
      title,
      description,
      status: "active",
      createdAt: new Date(),
      targetDate,
      progress: 0,
    });

    await this.save();
    return goalId;
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(goalId: string, progress: number): Promise<void> {
    if (!this.memory) return;

    const goal = this.memory.goals.find((g) => g.id === goalId);
    if (goal) {
      goal.progress = Math.min(100, Math.max(0, progress));
      if (progress === 100) {
        goal.status = "completed";
      }
      await this.save();
    }
  }

  /**
   * Get conversation context for advisor
   */
  getConversationContext(): string {
    if (!this.memory) return "";

    const recentConversations = this.memory.conversationHistory.slice(-5);
    const recentDecisions = this.memory.decisionHistory.slice(-3);
    const activeGoals = this.memory.goals.filter((g) => g.status === "active");

    return `
Recent conversations: ${recentConversations.map((c) => c.topic).join(", ")}
Recent decisions: ${recentDecisions.map((d) => d.decision).join(", ")}
Active goals: ${activeGoals.map((g) => g.title).join(", ")}
Communication style: ${this.memory.preferences.communicationStyle}
Risk tolerance: ${this.memory.preferences.riskTolerance}
    `.trim();
  }

  /**
   * Get learning recommendations based on history
   */
  getLearningRecommendations(): string[] {
    if (!this.memory) return [];

    const focusAreas = this.memory.habits.focusAreas;
    const skillsToLearn = this.memory.learningPreferences.skillsToLearn;

    return [...new Set([...focusAreas, ...skillsToLearn])].slice(0, 5);
  }

  /**
   * Get decision patterns
   */
  getDecisionPatterns(): {
    averageSatisfaction: number;
    mostChosenOptions: string[];
    riskPattern: string;
  } {
    if (!this.memory || this.memory.decisionHistory.length === 0) {
      return {
        averageSatisfaction: 0,
        mostChosenOptions: [],
        riskPattern: "unknown",
      };
    }

    const avgSatisfaction =
      this.memory.decisionHistory.reduce((sum, d) => sum + d.satisfaction, 0) /
      this.memory.decisionHistory.length;

    const optionCounts: Record<string, number> = {};
    this.memory.decisionHistory.forEach((d) => {
      optionCounts[d.chosenOption] =
        (optionCounts[d.chosenOption] || 0) + 1;
    });

    const mostChosenOptions = Object.entries(optionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([option]) => option);

    const riskPattern =
      avgSatisfaction > 7
        ? "confident"
        : avgSatisfaction > 5
          ? "balanced"
          : "cautious";

    return {
      averageSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      mostChosenOptions,
      riskPattern,
    };
  }

  /**
   * Get memory summary
   */
  getMemorySummary(): string {
    if (!this.memory) return "";

    const patterns = this.getDecisionPatterns();
    const activeGoals = this.memory.goals.filter((g) => g.status === "active");

    return `
User Profile:
- Communication: ${this.memory.preferences.communicationStyle}
- Risk Tolerance: ${this.memory.preferences.riskTolerance}
- Decision Speed: ${this.memory.preferences.decisionSpeed}

Current Status:
- Active Goals: ${activeGoals.length}
- Conversations Logged: ${this.memory.conversationHistory.length}
- Decisions Made: ${this.memory.decisionHistory.length}
- Average Satisfaction: ${patterns.averageSatisfaction}/10

Decision Pattern: ${patterns.riskPattern}
    `.trim();
  }

  /**
   * Clear all memory
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.storageKey);
      this.memory = null;
    } catch (error) {
      console.error("Memory clear error:", error);
    }
  }

  /**
   * Export memory as JSON
   */
  exportMemory(): string {
    if (!this.memory) return "{}";
    return JSON.stringify(this.memory, null, 2);
  }

  /**
   * Import memory from JSON
   */
  async importMemory(jsonData: string): Promise<void> {
    try {
      this.memory = JSON.parse(jsonData);
      await this.save();
    } catch (error) {
      console.error("Memory import error:", error);
    }
  }
}
