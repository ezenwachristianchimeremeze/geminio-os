import { invokeViaPort, parseModelJson } from "./llm-port";
import type { ProjectMemory } from "./project-memory";
import type { Project } from "./types";

/**
 * Requirements Gathering Engine
 * Converts natural language into structured project requirements
 */

export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: "feature" | "user_story" | "functional" | "technical" | "non_functional";
  priority: "critical" | "high" | "medium" | "low";
  estimatedHours: number;
  dependencies: string[];
  acceptance_criteria: string[];
  tags: string[];
}

export interface UserStory {
  id: string;
  title: string;
  as: string;
  want: string;
  so_that: string;
  acceptance_criteria: string[];
  priority: "critical" | "high" | "medium" | "low";
}

export interface ImplementationPlan {
  id: string;
  title: string;
  description: string;
  phases: Phase[];
  total_hours: number;
  timeline_days: number;
  risks: Risk[];
  dependencies: string[];
}

export interface Phase {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  duration_hours: number;
  start_phase: number;
  end_phase: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  duration_hours: number;
  dependencies: string[];
  status: "pending" | "in_progress" | "completed" | "blocked";
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  probability: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  mitigation: string;
}

export class RequirementsGatheringEngine {
  private memory: ProjectMemory;
  private project: Project;

  constructor(memory: ProjectMemory, project: Project) {
    this.memory = memory;
    this.project = project;
  }

  /**
   * Extract requirements from natural language description
   */
  async extractRequirements(description: string): Promise<Requirement[]> {
    const prompt = `
      Analyze the following project description and extract all requirements.
      Return a JSON array of requirements with the following structure:
      {
        "id": "REQ-001",
        "title": "Feature title",
        "description": "Detailed description",
        "type": "feature|user_story|functional|technical|non_functional",
        "priority": "critical|high|medium|low",
        "estimatedHours": 8,
        "dependencies": ["REQ-002"],
        "acceptance_criteria": ["Criterion 1", "Criterion 2"],
        "tags": ["tag1", "tag2"]
      }

      Project Description:
      ${description}

      Return ONLY valid JSON array, no additional text.
    `;

    try {
      const response = await invokeViaPort({
        operation: "requirements-engine.extractRequirements",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0]?.message?.content 
        : "[]";
      const requirements = parseModelJson(content) as Requirement[];

      // Store in project memory
      this.memory.storeArchitecture('requirements', requirements);

      return requirements;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate user stories from requirements
   */
  async generateUserStories(requirements: Requirement[]): Promise<UserStory[]> {
    const prompt = `
      Convert the following requirements into user stories in the format:
      "As a [user type], I want [action], so that [benefit]"

      Requirements:
      ${JSON.stringify(requirements, null, 2)}

      Return a JSON array of user stories with this structure:
      {
        "id": "US-001",
        "title": "Story title",
        "as": "user type",
        "want": "action",
        "so_that": "benefit",
        "acceptance_criteria": ["Criterion 1"],
        "priority": "high"
      }

      Return ONLY valid JSON array, no additional text.
    `;

    try {
      const response = await invokeViaPort({
        operation: "requirements-engine.generateUserStories",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0]?.message?.content 
        : "[]";
      const userStories = parseModelJson(content) as UserStory[];

      // Store in project memory
      this.memory.storeArchitecture('user_stories', userStories);

      return userStories;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate implementation plan from requirements
   */
  async generateImplementationPlan(
    requirements: Requirement[]
  ): Promise<ImplementationPlan> {
    const prompt = `
      Create a detailed implementation plan for the following requirements.
      Consider dependencies, priorities, and realistic time estimates.

      Requirements:
      ${JSON.stringify(requirements, null, 2)}

      Return a JSON object with this structure:
      {
        "id": "PLAN-001",
        "title": "Implementation Plan",
        "description": "Overview",
        "phases": [
          {
            "id": "PHASE-1",
            "name": "Phase name",
            "description": "Phase description",
            "tasks": [
              {
                "id": "TASK-1",
                "title": "Task title",
                "description": "Task description",
                "assigned_to": "Developer",
                "duration_hours": 8,
                "dependencies": [],
                "status": "pending"
              }
            ],
            "duration_hours": 40,
            "start_phase": 1,
            "end_phase": 1
          }
        ],
        "total_hours": 160,
        "timeline_days": 20,
        "risks": [
          {
            "id": "RISK-1",
            "title": "Risk title",
            "description": "Risk description",
            "probability": "medium",
            "impact": "high",
            "mitigation": "Mitigation strategy"
          }
        ],
        "dependencies": []
      }

      Return ONLY valid JSON object, no additional text.
    `;

    try {
      const response = await invokeViaPort({
        operation: "requirements-engine.generateImplementationPlan",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0]?.message?.content 
        : "{}";
      const plan = parseModelJson(content) as ImplementationPlan;

      // Store in project memory
      this.memory.storeArchitecture('implementation_plan', plan);

      return plan;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Detect features from requirements
   */
  async detectFeatures(requirements: Requirement[]): Promise<string[]> {
    const features = requirements
      .filter((r) => r.type === "feature")
      .map((r) => r.title);

    return [...new Set(features)]; // Remove duplicates
  }

  /**
   * Detect technical requirements
   */
  async detectTechnicalRequirements(
    requirements: Requirement[]
  ): Promise<string[]> {
    const technical = requirements
      .filter((r) => r.type === "technical")
      .map((r) => r.description);

    return [...new Set(technical)];
  }

  /**
   * Prioritize requirements
   */
  prioritizeRequirements(requirements: Requirement[]): Requirement[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return [...requirements].sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        b.estimatedHours - a.estimatedHours
    );
  }

  /**
   * Identify dependencies between requirements
   */
  identifyDependencies(requirements: Requirement[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();

    requirements.forEach((req) => {
      dependencies.set(req.id, req.dependencies);
    });

    return dependencies;
  }

  /**
   * Generate requirements summary
   */
  generateSummary(requirements: Requirement[]): string {
    const totalHours = requirements.reduce((sum, r) => sum + r.estimatedHours, 0);
    const byType = requirements.reduce(
      (acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byPriority = requirements.reduce(
      (acc, r) => {
        acc[r.priority] = (acc[r.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return `
Requirements Summary:
- Total Requirements: ${requirements.length}
- Total Estimated Hours: ${totalHours}
- By Type: ${Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(", ")}
- By Priority: ${Object.entries(byPriority).map(([k, v]) => `${k}: ${v}`).join(", ")}
    `;
  }
}

/**
 * Global requirements engine manager
 */
class RequirementsEngineManager {
  private engines: Map<string, RequirementsGatheringEngine> = new Map();

  createEngine(
    projectId: string,
    memory: ProjectMemory,
    project: Project
  ): RequirementsGatheringEngine {
    const engine = new RequirementsGatheringEngine(memory, project);
    this.engines.set(projectId, engine);
    return engine;
  }

  getEngine(projectId: string): RequirementsGatheringEngine | undefined {
    return this.engines.get(projectId);
  }

  deleteEngine(projectId: string): boolean {
    return this.engines.delete(projectId);
  }
}

// Global instance
export const requirementsEngineManager = new RequirementsEngineManager();
