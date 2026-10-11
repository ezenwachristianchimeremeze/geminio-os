/**
 * Geminio OS - Proactive Intelligence
 * 
 * Detects:
 * - Potential problems before they become serious
 * - Opportunities aligned with user goals
 * - Deadline and event reminders
 * - Skill gaps and learning opportunities
 * - Financial risks and opportunities
 * - Career advancement opportunities
 */

export interface ProactiveAlert {
  id: string;
  type: "opportunity" | "risk" | "reminder" | "suggestion" | "warning";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  action: string;
  actionUrl?: string;
  timestamp: Date;
  read: boolean;
}

export interface OpportunityScore {
  opportunity: string;
  score: number; // 0-100
  reasoning: string;
  timeframe: string;
  effort: "low" | "medium" | "high";
}

export interface RiskAssessment {
  risk: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation: string;
  severity: number; // 0-100
}

/**
 * Proactive Intelligence Service
 * 
 * Continuously monitors user context and generates intelligent alerts
 */
export class ProactiveIntelligence {
  private alerts: ProactiveAlert[] = [];
  private lastScanTime: Date = new Date();

  /**
   * Scan user context for opportunities
   */
  scanForOpportunities(userContext: {
    goals: string[];
    skills: string[];
    experience: string;
    interests: string[];
    recentActivities: string[];
  }): OpportunityScore[] {
    const opportunities: OpportunityScore[] = [];

    // Career opportunities
    if (
      userContext.goals.includes("career advancement") ||
      userContext.goals.includes("job search")
    ) {
      opportunities.push({
        opportunity: "Senior Role Opportunity",
        score: 85,
        reasoning:
          "Your skills match emerging senior positions in your field",
        timeframe: "1-3 months",
        effort: "medium",
      });

      opportunities.push({
        opportunity: "Freelance Project",
        score: 72,
        reasoning:
          "High-value projects available matching your expertise",
        timeframe: "Immediate",
        effort: "high",
      });
    }

    // Learning opportunities
    if (
      userContext.goals.includes("skill development") ||
      userContext.goals.includes("learning")
    ) {
      opportunities.push({
        opportunity: "Advanced TypeScript Course",
        score: 78,
        reasoning:
          "Aligns with your career goals and current skill level",
        timeframe: "4 weeks",
        effort: "medium",
      });

      opportunities.push({
        opportunity: "System Design Mastery",
        score: 81,
        reasoning:
          "Critical skill for senior roles you're targeting",
        timeframe: "6 weeks",
        effort: "high",
      });
    }

    // Financial opportunities
    if (
      userContext.goals.includes("financial growth") ||
      userContext.goals.includes("investment")
    ) {
      opportunities.push({
        opportunity: "Diversify Income Streams",
        score: 68,
        reasoning:
          "Multiple income sources reduce risk and increase stability",
        timeframe: "3-6 months",
        effort: "high",
      });
    }

    return opportunities.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Scan for potential risks
   */
  scanForRisks(userContext: {
    upcomingDeadlines: Date[];
    financialStatus: string;
    healthStatus: string;
    workload: string;
    stressLevel: number; // 0-10
  }): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    // Deadline risks
    if (userContext.upcomingDeadlines.length > 0) {
      const daysUntilDeadline = Math.ceil(
        (userContext.upcomingDeadlines[0].getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysUntilDeadline < 7) {
        risks.push({
          risk: "Tight Deadline",
          likelihood: "high",
          impact: "high",
          mitigation:
            "Prioritize and break into smaller tasks, delegate if possible",
          severity: 85,
        });
      }
    }

    // Stress and burnout risks
    if (userContext.stressLevel > 7) {
      risks.push({
        risk: "Burnout Risk",
        likelihood: "high",
        impact: "high",
        mitigation:
          "Take breaks, set boundaries, practice self-care, seek support",
        severity: 80,
      });
    }

    // Workload risks
    if (userContext.workload === "high") {
      risks.push({
        risk: "Overcommitment",
        likelihood: "medium",
        impact: "medium",
        mitigation:
          "Review commitments, learn to say no, delegate or reschedule",
        severity: 65,
      });
    }

    // Financial risks
    if (userContext.financialStatus === "tight") {
      risks.push({
        risk: "Cash Flow Pressure",
        likelihood: "medium",
        impact: "medium",
        mitigation:
          "Review expenses, create budget, increase income or reduce costs",
        severity: 60,
      });
    }

    return risks.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Generate proactive reminders
   */
  generateReminders(userContext: {
    upcomingDeadlines: Array<{ date: Date; title: string }>;
    importantEvents: Array<{ date: Date; title: string }>;
    recurringTasks: string[];
  }): ProactiveAlert[] {
    const reminders: ProactiveAlert[] = [];
    const now = new Date();

    // Deadline reminders
    userContext.upcomingDeadlines.forEach((deadline) => {
      const daysUntil = Math.ceil(
        (deadline.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntil === 7) {
        reminders.push({
          id: `reminder_${deadline.title}_7days`,
          type: "reminder",
          title: "Deadline in 1 Week",
          description: `${deadline.title} is due in 7 days`,
          priority: "high",
          action: "Review and Plan",
          timestamp: now,
          read: false,
        });
      } else if (daysUntil === 1) {
        reminders.push({
          id: `reminder_${deadline.title}_1day`,
          type: "reminder",
          title: "Deadline Tomorrow!",
          description: `${deadline.title} is due tomorrow`,
          priority: "high",
          action: "Finalize",
          timestamp: now,
          read: false,
        });
      }
    });

    // Event reminders
    userContext.importantEvents.forEach((event) => {
      const daysUntil = Math.ceil(
        (event.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntil === 3 || daysUntil === 1) {
        reminders.push({
          id: `reminder_${event.title}_${daysUntil}days`,
          type: "reminder",
          title: `${event.title} Coming Up`,
          description: `${event.title} is in ${daysUntil} day${daysUntil > 1 ? "s" : ""}`,
          priority: "medium",
          action: "Prepare",
          timestamp: now,
          read: false,
        });
      }
    });

    return reminders;
  }

  /**
   * Suggest skill development
   */
  suggestSkillDevelopment(userContext: {
    currentSkills: string[];
    goals: string[];
    industry: string;
  }): ProactiveAlert[] {
    const suggestions: ProactiveAlert[] = [];
    const now = new Date();

    // Identify skill gaps
    const skillGaps = this.identifySkillGaps(
      userContext.currentSkills,
      userContext.goals,
      userContext.industry
    );

    skillGaps.forEach((skill, index) => {
      if (index < 3) {
        // Top 3 suggestions
        suggestions.push({
          id: `skill_${skill.replace(/\s+/g, "_")}`,
          type: "suggestion",
          title: `Learn ${skill}`,
          description: `${skill} is highly relevant to your goals`,
          priority: index === 0 ? "high" : "medium",
          action: "Find Resources",
          actionUrl: "/knowledge-vault",
          timestamp: now,
          read: false,
        });
      }
    });

    return suggestions;
  }

  /**
   * Identify skill gaps
   */
  private identifySkillGaps(
    currentSkills: string[],
    goals: string[],
    industry: string
  ): string[] {
    const gaps: string[] = [];

    // Common skills for different industries
    const industrySkills: Record<string, string[]> = {
      tech: [
        "System Design",
        "Advanced TypeScript",
        "Cloud Architecture",
        "DevOps",
        "AI/ML",
      ],
      finance: [
        "Financial Analysis",
        "Risk Management",
        "Data Analysis",
        "Compliance",
      ],
      marketing: [
        "Data Analytics",
        "SEO",
        "Content Strategy",
        "Social Media",
      ],
    };

    const requiredSkills = industrySkills[industry] || [];

    requiredSkills.forEach((skill) => {
      if (!currentSkills.includes(skill)) {
        gaps.push(skill);
      }
    });

    return gaps;
  }

  /**
   * Detect financial risks and opportunities
   */
  detectFinancialInsights(financialData: {
    monthlyIncome: number;
    monthlyExpenses: number;
    savings: number;
    investments: number;
    debt: number;
  }): ProactiveAlert[] {
    const insights: ProactiveAlert[] = [];
    const now = new Date();

    const savingsRate =
      ((financialData.monthlyIncome - financialData.monthlyExpenses) /
        financialData.monthlyIncome) *
      100;

    // Low savings rate warning
    if (savingsRate < 10) {
      insights.push({
        id: "financial_low_savings",
        type: "warning",
        title: "Low Savings Rate",
        description: "You're saving less than 10% of your income",
        priority: "high",
        action: "Review Budget",
        actionUrl: "/finance",
        timestamp: now,
        read: false,
      });
    }

    // Debt opportunity
    if (financialData.debt > 0 && savingsRate > 20) {
      insights.push({
        id: "financial_debt_payoff",
        type: "opportunity",
        title: "Debt Payoff Opportunity",
        description: "Strong savings rate - consider accelerating debt payoff",
        priority: "medium",
        action: "Plan Payoff",
        actionUrl: "/finance",
        timestamp: now,
        read: false,
      });
    }

    // Investment opportunity
    if (financialData.savings > 10000 && financialData.investments < 5000) {
      insights.push({
        id: "financial_investment",
        type: "opportunity",
        title: "Investment Opportunity",
        description:
          "Consider investing excess savings for long-term growth",
        priority: "medium",
        action: "Learn More",
        actionUrl: "/finance",
        timestamp: now,
        read: false,
      });
    }

    return insights;
  }

  /**
   * Get all current alerts
   */
  getAlerts(): ProactiveAlert[] {
    return this.alerts.filter((alert) => !alert.read);
  }

  /**
   * Mark alert as read
   */
  markAlertAsRead(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.read = true;
    }
  }

  /**
   * Add alert
   */
  addAlert(alert: ProactiveAlert): void {
    this.alerts.push(alert);
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }
}
