/**
 * Progress Tracker
 * Tracks project development progress and milestones
 */

import type { Feature, Task, Bug, TestResult, Issue } from './types';

export class ProgressTracker {
  private projectId: string;
  private completedTasks: Set<string> = new Set();
  private currentTask: string | null = null;
  private remainingTasks: string[] = [];
  private knownIssues: Issue[] = [];
  private fixedBugs: Bug[] = [];
  private testResults: TestResult[] = [];
  private startTime: Date = new Date();
  private lastUpdated: Date = new Date();

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Mark task as completed
   */
  completeTask(taskId: string): void {
    this.completedTasks.add(taskId);
    this.remainingTasks = this.remainingTasks.filter((t) => t !== taskId);
    this.lastUpdated = new Date();
  }

  /**
   * Set current task
   */
  setCurrentTask(taskId: string): void {
    this.currentTask = taskId;
    this.lastUpdated = new Date();
  }

  /**
   * Add remaining task
   */
  addRemainingTask(taskId: string): void {
    if (!this.completedTasks.has(taskId) && !this.remainingTasks.includes(taskId)) {
      this.remainingTasks.push(taskId);
      this.lastUpdated = new Date();
    }
  }

  /**
   * Add remaining tasks
   */
  addRemainingTasks(taskIds: string[]): void {
    for (const taskId of taskIds) {
      this.addRemainingTask(taskId);
    }
  }

  /**
   * Get completed tasks count
   */
  getCompletedCount(): number {
    return this.completedTasks.size;
  }

  /**
   * Get remaining tasks count
   */
  getRemainingCount(): number {
    return this.remainingTasks.length;
  }

  /**
   * Get total tasks count
   */
  getTotalCount(): number {
    return this.getCompletedCount() + this.getRemainingCount();
  }

  /**
   * Get progress percentage
   */
  getProgressPercentage(): number {
    const total = this.getTotalCount();
    if (total === 0) return 0;
    return Math.round((this.getCompletedCount() / total) * 100);
  }

  /**
   * Add known issue
   */
  addIssue(issue: Issue): void {
    this.knownIssues.push(issue);
    this.lastUpdated = new Date();
  }

  /**
   * Resolve issue
   */
  resolveIssue(issueId: string): void {
    this.knownIssues = this.knownIssues.filter((i) => i.id !== issueId);
    this.lastUpdated = new Date();
  }

  /**
   * Get open issues
   */
  getOpenIssues(): Issue[] {
    return this.knownIssues.filter((i) => i.status !== 'resolved');
  }

  /**
   * Get critical issues
   */
  getCriticalIssues(): Issue[] {
    return this.knownIssues.filter((i) => i.severity === 'critical' && i.status !== 'resolved');
  }

  /**
   * Add fixed bug
   */
  addFixedBug(bug: Bug): void {
    this.fixedBugs.push(bug);
    this.lastUpdated = new Date();
  }

  /**
   * Get fixed bugs count
   */
  getFixedBugsCount(): number {
    return this.fixedBugs.length;
  }

  /**
   * Record test result
   */
  recordTestResult(result: TestResult): void {
    this.testResults.push(result);
    this.lastUpdated = new Date();
  }

  /**
   * Get test results
   */
  getTestResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * Get passing tests count
   */
  getPassingTestsCount(): number {
    return this.testResults.filter((t) => t.status === 'passed').length;
  }

  /**
   * Get failing tests count
   */
  getFailingTestsCount(): number {
    return this.testResults.filter((t) => t.status === 'failed').length;
  }

  /**
   * Get test pass rate
   */
  getTestPassRate(): number {
    if (this.testResults.length === 0) return 0;
    return Math.round((this.getPassingTestsCount() / this.testResults.length) * 100);
  }

  /**
   * Get elapsed time
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get elapsed time in hours
   */
  getElapsedHours(): number {
    return Math.round(this.getElapsedTime() / (1000 * 60 * 60));
  }

  /**
   * Generate progress report
   */
  generateProgressReport(): string {
    const total = this.getTotalCount();
    const completed = this.getCompletedCount();
    const remaining = this.getRemainingCount();
    const percentage = this.getProgressPercentage();
    const elapsedHours = this.getElapsedHours();
    const openIssues = this.getOpenIssues().length;
    const criticalIssues = this.getCriticalIssues().length;
    const passRate = this.getTestPassRate();

    return `
Progress Report
===============

Project ID: ${this.projectId}
Generated: ${new Date().toLocaleString()}

Overall Progress
----------------
Total Tasks: ${total}
Completed: ${completed}
Remaining: ${remaining}
Progress: ${percentage}%

Current Task: ${this.currentTask || 'None'}

Time Tracking
-------------
Start Time: ${this.startTime.toLocaleString()}
Elapsed Time: ${elapsedHours} hours
Last Updated: ${this.lastUpdated.toLocaleString()}

Issues & Bugs
-------------
Open Issues: ${openIssues}
Critical Issues: ${criticalIssues}
Fixed Bugs: ${this.getFixedBugsCount()}

Testing
-------
Total Tests: ${this.testResults.length}
Passing: ${this.getPassingTestsCount()}
Failing: ${this.getFailingTestsCount()}
Pass Rate: ${passRate}%

Open Issues:
${this.getOpenIssues()
  .map((i) => `  - [${i.severity.toUpperCase()}] ${i.title} (${i.status})`)
  .join('\n')}

Recent Test Results:
${this.testResults
  .slice(-5)
  .map((t) => `  - ${t.testName}: ${t.status} (${t.duration}ms)`)
  .join('\n')}

Remaining Tasks:
${this.remainingTasks.slice(0, 10).map((t) => `  - ${t}`).join('\n')}
${this.remainingTasks.length > 10 ? `  ... and ${this.remainingTasks.length - 10} more` : ''}
`;
  }

  /**
   * Get progress summary
   */
  getProgressSummary(): Record<string, unknown> {
    return {
      projectId: this.projectId,
      totalTasks: this.getTotalCount(),
      completedTasks: this.getCompletedCount(),
      remainingTasks: this.getRemainingCount(),
      progressPercentage: this.getProgressPercentage(),
      currentTask: this.currentTask,
      openIssues: this.getOpenIssues().length,
      criticalIssues: this.getCriticalIssues().length,
      fixedBugs: this.getFixedBugsCount(),
      totalTests: this.testResults.length,
      passingTests: this.getPassingTestsCount(),
      failingTests: this.getFailingTestsCount(),
      testPassRate: this.getTestPassRate(),
      elapsedHours: this.getElapsedHours(),
      startTime: this.startTime.toISOString(),
      lastUpdated: this.lastUpdated.toISOString(),
    };
  }

  /**
   * Export tracker state
   */
  exportState(): Record<string, unknown> {
    return {
      projectId: this.projectId,
      completedTasks: Array.from(this.completedTasks),
      currentTask: this.currentTask,
      remainingTasks: this.remainingTasks,
      knownIssues: this.knownIssues,
      fixedBugs: this.fixedBugs,
      testResults: this.testResults,
      startTime: this.startTime.toISOString(),
      lastUpdated: this.lastUpdated.toISOString(),
    };
  }

  /**
   * Import tracker state
   */
  importState(state: Record<string, unknown>): void {
    if (Array.isArray(state.completedTasks)) {
      this.completedTasks = new Set(state.completedTasks as string[]);
    }

    if (typeof state.currentTask === 'string') {
      this.currentTask = state.currentTask;
    }

    if (Array.isArray(state.remainingTasks)) {
      this.remainingTasks = state.remainingTasks as string[];
    }

    if (Array.isArray(state.knownIssues)) {
      this.knownIssues = state.knownIssues as Issue[];
    }

    if (Array.isArray(state.fixedBugs)) {
      this.fixedBugs = state.fixedBugs as Bug[];
    }

    if (Array.isArray(state.testResults)) {
      this.testResults = state.testResults as TestResult[];
    }

    if (typeof state.startTime === 'string') {
      this.startTime = new Date(state.startTime);
    }

    if (typeof state.lastUpdated === 'string') {
      this.lastUpdated = new Date(state.lastUpdated);
    }
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.completedTasks.clear();
    this.currentTask = null;
    this.remainingTasks = [];
    this.knownIssues = [];
    this.fixedBugs = [];
    this.testResults = [];
    this.startTime = new Date();
    this.lastUpdated = new Date();
  }
}

/**
 * Progress Tracker Manager
 * Manages multiple progress trackers
 */
export class ProgressTrackerManager {
  private trackers: Map<string, ProgressTracker> = new Map();

  /**
   * Create or get progress tracker
   */
  getOrCreateTracker(projectId: string): ProgressTracker {
    if (!this.trackers.has(projectId)) {
      this.trackers.set(projectId, new ProgressTracker(projectId));
    }
    return this.trackers.get(projectId)!;
  }

  /**
   * Get progress tracker
   */
  getTracker(projectId: string): ProgressTracker | undefined {
    return this.trackers.get(projectId);
  }

  /**
   * Delete progress tracker
   */
  deleteTracker(projectId: string): boolean {
    return this.trackers.delete(projectId);
  }

  /**
   * Get all trackers
   */
  getAllTrackers(): ProgressTracker[] {
    return Array.from(this.trackers.values());
  }

  /**
   * Get overall progress
   */
  getOverallProgress(): Record<string, unknown> {
    const trackers = Array.from(this.trackers.values());
    const totalTasks = trackers.reduce((sum, t) => sum + t.getTotalCount(), 0);
    const completedTasks = trackers.reduce((sum, t) => sum + t.getCompletedCount(), 0);
    const totalIssues = trackers.reduce((sum, t) => sum + t.getOpenIssues().length, 0);
    const totalTests = trackers.reduce((sum, t) => sum + t.getTestResults().length, 0);
    const passingTests = trackers.reduce((sum, t) => sum + t.getPassingTestsCount(), 0);

    return {
      totalProjects: trackers.length,
      totalTasks,
      completedTasks,
      remainingTasks: totalTasks - completedTasks,
      progressPercentage: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
      totalOpenIssues: totalIssues,
      totalTests,
      passingTests,
      failingTests: totalTests - passingTests,
      testPassRate: totalTests === 0 ? 0 : Math.round((passingTests / totalTests) * 100),
    };
  }
}

// Global progress tracker manager instance
export const globalProgressTrackerManager = new ProgressTrackerManager();
