/**
 * Project Memory System
 * Maintains complete project context and development history
 */

import type { Project, Decision, ProgressTracking, Issue, TestResult, ConversationMessage } from './types';

export class ProjectMemory {
  private projectId: string;
  private architecture: Map<string, unknown> = new Map();
  private codingStyle: Map<string, unknown> = new Map();
  private folderOrganization: Map<string, unknown> = new Map();
  private namingConventions: Map<string, unknown> = new Map();
  private decisions: Decision[] = [];
  private progressHistory: ProgressTracking[] = [];
  private conversationHistory: ConversationMessage[] = [];

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Store architecture information
   */
  storeArchitecture(key: string, value: unknown): void {
    this.architecture.set(key, value);
  }

  /**
   * Retrieve architecture information
   */
  getArchitecture(key: string): unknown {
    return this.architecture.get(key);
  }

  /**
   * Get all architecture information
   */
  getAllArchitecture(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.architecture.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Store coding style information
   */
  storeCodingStyle(key: string, value: unknown): void {
    this.codingStyle.set(key, value);
  }

  /**
   * Retrieve coding style information
   */
  getCodingStyle(key: string): unknown {
    return this.codingStyle.get(key);
  }

  /**
   * Get all coding style information
   */
  getAllCodingStyle(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.codingStyle.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Store folder organization
   */
  storeFolderOrganization(key: string, value: unknown): void {
    this.folderOrganization.set(key, value);
  }

  /**
   * Get folder organization
   */
  getFolderOrganization(key: string): unknown {
    return this.folderOrganization.get(key);
  }

  /**
   * Get all folder organization
   */
  getAllFolderOrganization(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.folderOrganization.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Store naming convention
   */
  storeNamingConvention(key: string, value: unknown): void {
    this.namingConventions.set(key, value);
  }

  /**
   * Get naming convention
   */
  getNamingConvention(key: string): unknown {
    return this.namingConventions.get(key);
  }

  /**
   * Get all naming conventions
   */
  getAllNamingConventions(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.namingConventions.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Record a decision
   */
  recordDecision(decision: Decision): void {
    this.decisions.push(decision);
  }

  /**
   * Get decision history
   */
  getDecisionHistory(): Decision[] {
    return [...this.decisions];
  }

  /**
   * Get decisions by type
   */
  getDecisionsByType(type: string): Decision[] {
    return this.decisions.filter((d) => d.type === type);
  }

  /**
   * Get recent decisions
   */
  getRecentDecisions(count: number = 10): Decision[] {
    return this.decisions.slice(-count);
  }

  /**
   * Record progress
   */
  recordProgress(progress: ProgressTracking): void {
    this.progressHistory.push(progress);
  }

  /**
   * Get progress history
   */
  getProgressHistory(): ProgressTracking[] {
    return [...this.progressHistory];
  }

  /**
   * Get latest progress
   */
  getLatestProgress(): ProgressTracking | undefined {
    return this.progressHistory[this.progressHistory.length - 1];
  }

  /**
   * Add conversation message
   */
  addConversationMessage(message: ConversationMessage): void {
    this.conversationHistory.push(message);
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Get recent conversation
   */
  getRecentConversation(count: number = 20): ConversationMessage[] {
    return this.conversationHistory.slice(-count);
  }

  /**
   * Generate memory summary
   */
  generateMemorySummary(): string {
    const decisions = this.decisions.length;
    const conversations = this.conversationHistory.length;
    const progressPoints = this.progressHistory.length;

    return `
Project Memory Summary
======================

Project ID: ${this.projectId}

Architecture:
${Object.entries(this.getAllArchitecture())
  .map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Coding Style:
${Object.entries(this.getAllCodingStyle())
  .map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Folder Organization:
${Object.entries(this.getAllFolderOrganization())
  .map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Naming Conventions:
${Object.entries(this.getAllNamingConventions())
  .map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

Decision History: ${decisions} decisions made
Progress Tracking: ${progressPoints} progress updates
Conversations: ${conversations} messages

Recent Decisions:
${this.getRecentDecisions(5)
  .map((d) => `  - ${d.type}: ${d.description}`)
  .join('\n')}

Latest Progress:
${this.getLatestProgress() ? `  - Completed: ${this.getLatestProgress()?.completedTasks}/${this.getLatestProgress()?.totalTasks}` : '  - No progress recorded'}
`;
  }

  /**
   * Export memory as JSON
   */
  exportMemory(): Record<string, unknown> {
    return {
      projectId: this.projectId,
      architecture: Object.fromEntries(this.architecture),
      codingStyle: Object.fromEntries(this.codingStyle),
      folderOrganization: Object.fromEntries(this.folderOrganization),
      namingConventions: Object.fromEntries(this.namingConventions),
      decisions: this.decisions,
      progressHistory: this.progressHistory,
      conversationHistory: this.conversationHistory,
    };
  }

  /**
   * Import memory from JSON
   */
  importMemory(data: Record<string, unknown>): void {
    if (data.architecture && typeof data.architecture === 'object') {
      for (const [key, value] of Object.entries(data.architecture)) {
        this.architecture.set(key, value);
      }
    }

    if (data.codingStyle && typeof data.codingStyle === 'object') {
      for (const [key, value] of Object.entries(data.codingStyle)) {
        this.codingStyle.set(key, value);
      }
    }

    if (data.folderOrganization && typeof data.folderOrganization === 'object') {
      for (const [key, value] of Object.entries(data.folderOrganization)) {
        this.folderOrganization.set(key, value);
      }
    }

    if (data.namingConventions && typeof data.namingConventions === 'object') {
      for (const [key, value] of Object.entries(data.namingConventions)) {
        this.namingConventions.set(key, value);
      }
    }

    if (Array.isArray(data.decisions)) {
      this.decisions = data.decisions as Decision[];
    }

    if (Array.isArray(data.progressHistory)) {
      this.progressHistory = data.progressHistory as ProgressTracking[];
    }

    if (Array.isArray(data.conversationHistory)) {
      this.conversationHistory = data.conversationHistory as ConversationMessage[];
    }
  }

  /**
   * Clear all memory
   */
  clearMemory(): void {
    this.architecture.clear();
    this.codingStyle.clear();
    this.folderOrganization.clear();
    this.namingConventions.clear();
    this.decisions = [];
    this.progressHistory = [];
    this.conversationHistory = [];
  }
}

/**
 * Project Memory Manager
 * Manages multiple project memories
 */
export class ProjectMemoryManager {
  private memories: Map<string, ProjectMemory> = new Map();

  /**
   * Create or get project memory
   */
  getOrCreateMemory(projectId: string): ProjectMemory {
    if (!this.memories.has(projectId)) {
      this.memories.set(projectId, new ProjectMemory(projectId));
    }
    return this.memories.get(projectId)!;
  }

  /**
   * Get project memory
   */
  getMemory(projectId: string): ProjectMemory | undefined {
    return this.memories.get(projectId);
  }

  /**
   * Delete project memory
   */
  deleteMemory(projectId: string): boolean {
    return this.memories.delete(projectId);
  }

  /**
   * Get all project memories
   */
  getAllMemories(): ProjectMemory[] {
    return Array.from(this.memories.values());
  }

  /**
   * Export all memories
   */
  exportAllMemories(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [projectId, memory] of this.memories.entries()) {
      result[projectId] = memory.exportMemory();
    }
    return result;
  }

  /**
   * Import memories
   */
  importMemories(data: Record<string, Record<string, unknown>>): void {
    for (const [projectId, memoryData] of Object.entries(data)) {
      const memory = this.getOrCreateMemory(projectId);
      memory.importMemory(memoryData);
    }
  }
}

// Global memory manager instance
export const globalMemoryManager = new ProjectMemoryManager();
