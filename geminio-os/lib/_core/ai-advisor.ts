/**
 * Geminio OS - AI Advisor Core
 * 
 * Transforms Geminio OS into a personal AI strategist with:
 * - Conversational personality engine
 * - Context awareness and memory
 * - Emotional intelligence
 * - Tone adaptation
 * - Proactive recommendations
 * - Decision support
 */

export interface UserProfile {
  id: string;
  name: string;
  goals: string[];
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
  };
  recentContext: {
    currentGoal: string;
    recentDecisions: string[];
    upcomingDeadlines: Date[];
    challenges: string[];
  };
}

export interface AdvisorResponse {
  message: string;
  tone: "supportive" | "analytical" | "encouraging" | "cautious" | "neutral";
  recommendations: Recommendation[];
  reasoning: string;
  followUpQuestions?: string[];
  alternatives?: string[];
  warnings?: string[];
  nextSteps?: string[];
}

export interface Recommendation {
  title: string;
  description: string;
  reasoning: string;
  pros: string[];
  cons: string[];
  timeframe: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
}

export interface ConversationContext {
  topic: string;
  history: Array<{
    role: "user" | "assistant";
    message: string;
    timestamp: Date;
  }>;
  emotionalTone: "positive" | "neutral" | "stressed" | "uncertain";
  decisionPoint: boolean;
  riskLevel: "low" | "medium" | "high";
}

/**
 * AI Advisor Service
 * 
 * Provides conversational AI assistance with personality and intelligence
 */
export class AIAdvisor {
  private userProfile: UserProfile;
  private conversationContext: ConversationContext;
  private memoryStore: Map<string, unknown> = new Map();

  constructor(userProfile: UserProfile) {
    this.userProfile = userProfile;
    this.conversationContext = {
      topic: "general",
      history: [],
      emotionalTone: "neutral",
      decisionPoint: false,
      riskLevel: "low",
    };
  }

  /**
   * Generate conversational response with personality
   */
  async generateResponse(userMessage: string): Promise<AdvisorResponse> {
    // Update conversation context
    this.conversationContext.history.push({
      role: "user",
      message: userMessage,
      timestamp: new Date(),
    });

    // Detect emotional tone from message
    const emotionalTone = this.detectEmotionalTone(userMessage);
    this.conversationContext.emotionalTone = emotionalTone;

    // Detect if this is a decision point
    const isDecisionPoint = this.isDecisionPoint(userMessage);
    this.conversationContext.decisionPoint = isDecisionPoint;

    // Select appropriate tone for response
    const responseTone = this.selectResponseTone(emotionalTone, isDecisionPoint);

    // Generate recommendations if needed
    const recommendations = isDecisionPoint
      ? await this.generateRecommendations(userMessage)
      : [];

    // Generate main response message
    const message = this.generateConversationalMessage(
      userMessage,
      emotionalTone,
      responseTone,
      recommendations
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(userMessage, recommendations);

    // Generate follow-up questions
    const followUpQuestions = this.generateFollowUpQuestions(userMessage);

    // Generate alternatives if decision point
    const alternatives = isDecisionPoint
      ? this.generateAlternatives(userMessage)
      : undefined;

    // Detect warnings
    const warnings = this.detectWarnings(userMessage);

    // Generate next steps
    const nextSteps = isDecisionPoint
      ? this.generateNextSteps(userMessage, recommendations)
      : undefined;

    return {
      message,
      tone: responseTone,
      recommendations,
      reasoning,
      followUpQuestions,
      alternatives,
      warnings: warnings.length > 0 ? warnings : undefined,
      nextSteps,
    };
  }

  /**
   * Detect emotional tone from user message
   */
  private detectEmotionalTone(
    message: string
  ): "positive" | "neutral" | "stressed" | "uncertain" {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("!") ||
      lowerMessage.includes("great") ||
      lowerMessage.includes("excited") ||
      lowerMessage.includes("happy")
    ) {
      return "positive";
    }

    if (
      lowerMessage.includes("help") ||
      lowerMessage.includes("stuck") ||
      lowerMessage.includes("confused") ||
      lowerMessage.includes("?")
    ) {
      return "uncertain";
    }

    if (
      lowerMessage.includes("urgent") ||
      lowerMessage.includes("stress") ||
      lowerMessage.includes("worried") ||
      lowerMessage.includes("panic")
    ) {
      return "stressed";
    }

    return "neutral";
  }

  /**
   * Detect if message is asking for decision support
   */
  private isDecisionPoint(message: string): boolean {
    const decisionKeywords = [
      "should i",
      "should we",
      "what should",
      "which option",
      "which is better",
      "help me decide",
      "what do you think",
      "recommendation",
      "advice",
      "best way",
      "pros and cons",
    ];

    const lowerMessage = message.toLowerCase();
    return decisionKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  /**
   * Select appropriate response tone based on context
   */
  private selectResponseTone(
    emotionalTone: string,
    isDecisionPoint: boolean
  ): "supportive" | "analytical" | "encouraging" | "cautious" | "neutral" {
    if (emotionalTone === "stressed") {
      return "supportive";
    }

    if (emotionalTone === "uncertain") {
      return isDecisionPoint ? "analytical" : "encouraging";
    }

    if (emotionalTone === "positive") {
      return "encouraging";
    }

    if (isDecisionPoint && this.conversationContext.riskLevel === "high") {
      return "cautious";
    }

    return "neutral";
  }

  /**
   * Generate conversational message
   */
  private generateConversationalMessage(
    userMessage: string,
    emotionalTone: string,
    responseTone: string,
    recommendations: Recommendation[]
  ): string {
    const greetings = {
      supportive: [
        "I understand this can feel overwhelming. Let me help you think through this.",
        "I hear you. Let's break this down together.",
        "That sounds challenging. Here's what I think could help:",
      ],
      analytical: [
        "Great question. Let me analyze this for you.",
        "I can help you think through this systematically.",
        "Here's my analysis of your situation:",
      ],
      encouraging: [
        "That's a great direction! Let me share some thoughts.",
        "I love your enthusiasm! Here's what I'd suggest:",
        "Excellent thinking. Here's how you could move forward:",
      ],
      cautious: [
        "This is an important decision. Let me share some considerations.",
        "Before you move forward, here are some things to consider:",
        "I want to make sure you're thinking about all angles here.",
      ],
      neutral: [
        "Here's what I think about that:",
        "Let me share some perspective on this:",
        "That's interesting. Here's my take:",
      ],
    };

    const selectedGreeting =
      greetings[responseTone as keyof typeof greetings][
        Math.floor(Math.random() * 3)
      ];

    if (recommendations.length > 0) {
      return `${selectedGreeting} I'd recommend considering ${recommendations.length} different approaches here.`;
    }

    return selectedGreeting;
  }

  /**
   * Generate recommendations for decision point
   */
  private async generateRecommendations(
    userMessage: string
  ): Promise<Recommendation[]> {
    // Mock recommendations - in production, call GPT-4o-mini
    return [
      {
        title: "Option 1: Direct Approach",
        description:
          "Take immediate action based on your current understanding.",
        reasoning:
          "This approach leverages your existing knowledge and gets results quickly.",
        pros: [
          "Fast execution",
          "Builds momentum",
          "Clear decision",
        ],
        cons: [
          "May miss important details",
          "Higher risk of mistakes",
        ],
        timeframe: "Immediate",
        effort: "low",
        impact: "medium",
      },
      {
        title: "Option 2: Research & Plan",
        description: "Take time to gather information and create a detailed plan.",
        reasoning:
          "This approach reduces risk and ensures you're making an informed decision.",
        pros: [
          "Thorough understanding",
          "Lower risk",
          "Better long-term outcomes",
        ],
        cons: [
          "Takes more time",
          "May delay action",
        ],
        timeframe: "1-2 weeks",
        effort: "medium",
        impact: "high",
      },
      {
        title: "Option 3: Hybrid Approach",
        description:
          "Start with research while taking initial steps in parallel.",
        reasoning:
          "This balances speed with thoroughness, allowing you to learn while progressing.",
        pros: [
          "Balanced risk/reward",
          "Continuous learning",
          "Flexible adjustment",
        ],
        cons: [
          "Requires coordination",
          "Moderate complexity",
        ],
        timeframe: "Ongoing",
        effort: "medium",
        impact: "high",
      },
    ];
  }

  /**
   * Generate reasoning for recommendations
   */
  private generateReasoning(
    userMessage: string,
    recommendations: Recommendation[]
  ): string {
    if (recommendations.length === 0) {
      return "Based on our conversation, I'm providing general guidance to help you move forward.";
    }

    return `I've identified ${recommendations.length} viable paths forward. Each has different trade-offs between speed, risk, and long-term impact. The best choice depends on your priorities and timeline.`;
  }

  /**
   * Generate follow-up questions
   */
  private generateFollowUpQuestions(userMessage: string): string[] {
    return [
      "What's your timeline for making this decision?",
      "What's the biggest concern you have about this?",
      "Have you faced a similar situation before?",
      "What would success look like for you?",
    ];
  }

  /**
   * Generate alternative approaches
   */
  private generateAlternatives(userMessage: string): string[] {
    return [
      "Have you considered asking for input from someone with experience in this area?",
      "What if you started with a smaller test version first?",
      "Could you break this into smaller, more manageable steps?",
      "What would the opposite approach look like?",
    ];
  }

  /**
   * Detect potential warnings or risks
   */
  private detectWarnings(userMessage: string): string[] {
    const warnings: string[] = [];
    const lowerMessage = userMessage.toLowerCase();

    if (
      lowerMessage.includes("money") ||
      lowerMessage.includes("investment") ||
      lowerMessage.includes("spend")
    ) {
      warnings.push(
        "This involves financial decisions. Make sure you understand the full cost implications."
      );
    }

    if (
      lowerMessage.includes("urgent") ||
      lowerMessage.includes("deadline") ||
      lowerMessage.includes("asap")
    ) {
      warnings.push(
        "Time pressure can lead to rushed decisions. Take a moment to think through this carefully."
      );
    }

    if (
      lowerMessage.includes("everyone") ||
      lowerMessage.includes("pressure") ||
      lowerMessage.includes("should")
    ) {
      warnings.push(
        "Make sure this decision aligns with your own goals, not just external pressure."
      );
    }

    return warnings;
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(
    userMessage: string,
    recommendations: Recommendation[]
  ): string[] {
    return [
      "Reflect on which option resonates most with your values and goals",
      "Gather any additional information you need to feel confident",
      "Set a specific date to make your final decision",
      "Plan how you'll implement your chosen approach",
    ];
  }

  /**
   * Update user profile based on feedback
   */
  updateUserProfile(updates: Partial<UserProfile>): void {
    this.userProfile = {
      ...this.userProfile,
      ...updates,
    };
  }

  /**
   * Store memory for future reference
   */
  storeMemory(key: string, value: unknown): void {
    this.memoryStore.set(key, value);
  }

  /**
   * Retrieve stored memory
   */
  retrieveMemory(key: string): unknown {
    return this.memoryStore.get(key);
  }

  /**
   * Get conversation history
   */
  getConversationHistory() {
    return this.conversationContext.history;
  }

  /**
   * Clear conversation context for new topic
   */
  clearContext(): void {
    this.conversationContext = {
      topic: "general",
      history: [],
      emotionalTone: "neutral",
      decisionPoint: false,
      riskLevel: "low",
    };
  }
}
