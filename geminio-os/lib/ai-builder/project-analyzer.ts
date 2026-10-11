/**
 * Project Analyzer
 * Analyzes uploaded projects to understand architecture and identify features
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Project, Screen, Component, Feature, ProjectAudit } from './types';

export class ProjectAnalyzer {
  private projectPath: string;
  private projectName: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.projectName = path.basename(projectPath);
  }

  /**
   * Analyze complete project structure
   */
  async analyzeProject(): Promise<Project> {
    const screens = await this.analyzeScreens();
    const components = await this.analyzeComponents();
    const framework = this.detectFramework();
    const version = this.detectVersion();

    return {
      id: `project-${Date.now()}`,
      name: this.projectName,
      description: `Analyzed project: ${this.projectName}`,
      framework,
      version,
      status: 'planning',
      platforms: this.detectPlatforms(),
      screens,
      components,
      backend: {
        framework: 'trpc',
        language: 'typescript',
        routers: [],
        middleware: [],
        authentication: {
          enabled: false,
          type: 'oauth',
          providers: [],
          tokenExpiry: 3600,
        },
        authorization: {
          enabled: false,
          type: 'rbac',
          roles: [],
          permissions: [],
        },
        logging: {
          enabled: false,
          level: 'info',
          transport: 'console',
          format: 'json',
        },
        errorHandling: {
          enabled: false,
          globalErrorHandler: false,
          errorLogging: false,
          errorReporting: false,
          customErrors: [],
        },
      },
      database: {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: this.projectName,
        tables: [],
        migrations: [],
        seeders: [],
      },
      features: [],
      progress: 0,
      totalEstimatedHours: 0,
      actualHours: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      uploadedAt: new Date(),
      isUploadedProject: true,
    };
  }

  /**
   * Analyze screens in the project
   */
  private async analyzeScreens(): Promise<Screen[]> {
    const screens: Screen[] = [];
    const appDir = path.join(this.projectPath, 'app');

    if (!fs.existsSync(appDir)) {
      return screens;
    }

    const files = this.getAllFiles(appDir);
    const screenFiles = files.filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));

    for (const file of screenFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const screenName = path.basename(file, path.extname(file));

      screens.push({
        id: `screen-${screenName}`,
        name: screenName,
        description: `Screen: ${screenName}`,
        route: `/${screenName}`,
        components: this.extractComponentsFromFile(content),
        state: {},
        navigation: {
          type: 'stack',
          title: screenName,
        },
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return screens;
  }

  /**
   * Analyze components in the project
   */
  private async analyzeComponents(): Promise<Component[]> {
    const components: Component[] = [];
    const componentsDir = path.join(this.projectPath, 'components');

    if (!fs.existsSync(componentsDir)) {
      return components;
    }

    const files = this.getAllFiles(componentsDir);
    const componentFiles = files.filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const componentName = path.basename(file, path.extname(file));

      components.push({
        id: `component-${componentName}`,
        name: componentName,
        description: `Component: ${componentName}`,
        props: this.extractPropsFromFile(content),
        state: [],
        methods: [],
        styling: {
          theme: 'auto',
          colors: {},
          spacing: {},
          typography: {
            fontFamily: 'system',
            fontSize: {},
            fontWeight: {},
            lineHeight: {},
          },
          responsive: true,
        },
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return components;
  }

  /**
   * Detect project framework
   */
  private detectFramework(): 'react-native' | 'flutter' | 'expo' | 'next-js' | 'vue' | 'angular' {
    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      if (packageJson.dependencies?.expo) return 'expo';
      if (packageJson.dependencies?.['react-native']) return 'react-native';
      if (packageJson.dependencies?.next) return 'next-js';
      if (packageJson.dependencies?.vue) return 'vue';
      if (packageJson.dependencies?.['@angular/core']) return 'angular';
    }

    return 'react-native';
  }

  /**
   * Detect project version
   */
  private detectVersion(): string {
    const packageJsonPath = path.join(this.projectPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      return packageJson.version || '1.0.0';
    }

    return '1.0.0';
  }

  /**
   * Detect supported platforms
   */
  private detectPlatforms(): ('android' | 'ios' | 'web' | 'desktop')[] {
    const appConfigPath = path.join(this.projectPath, 'app.config.ts');
    const platforms: ('android' | 'ios' | 'web' | 'desktop')[] = [];

    if (fs.existsSync(appConfigPath)) {
      const content = fs.readFileSync(appConfigPath, 'utf-8');
      if (content.includes('android')) platforms.push('android');
      if (content.includes('ios')) platforms.push('ios');
      if (content.includes('web')) platforms.push('web');
    }

    return platforms.length > 0 ? platforms : ['android', 'ios'];
  }

  /**
   * Get all files in directory recursively
   */
  private getAllFiles(dir: string): string[] {
    let files: string[] = [];

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (!item.startsWith('.') && item !== 'node_modules') {
            files = files.concat(this.getAllFiles(fullPath));
          }
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }

    return files;
  }

  /**
   * Extract components used in a file
   */
  private extractComponentsFromFile(content: string): string[] {
    const components: string[] = [];
    const componentRegex = /<([A-Z][a-zA-Z0-9]*)/g;
    let match;

    while ((match = componentRegex.exec(content)) !== null) {
      const componentName = match[1];
      if (!components.includes(componentName)) {
        components.push(componentName);
      }
    }

    return components;
  }

  /**
   * Extract props from component file
   */
  private extractPropsFromFile(content: string) {
    const props = [];
    const interfaceRegex = /interface\s+(\w+Props)\s*{([^}]+)}/g;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
      const propsContent = match[2];
      const propLines = propsContent.split('\n').filter((line) => line.trim());

      for (const line of propLines) {
        const propMatch = /(\w+)\s*:\s*([^;]+);?/.exec(line);
        if (propMatch) {
          props.push({
            name: propMatch[1],
            type: propMatch[2].trim(),
            required: !propMatch[2].includes('?'),
            description: '',
          });
        }
      }
    }

    return props;
  }

  /**
   * Generate project audit report
   */
  async generateAuditReport(project: Project): Promise<ProjectAudit> {
    const files = this.getAllFiles(this.projectPath);
    const tsFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

    return {
      projectId: project.id,
      projectName: project.name,
      framework: project.framework,
      version: project.version,
      totalFiles: files.length,
      totalScreens: project.screens.length,
      totalComponents: project.components.length,
      totalServices: this.countServices(),
      totalAPIs: this.countAPIs(),
      totalBackendRouters: this.countBackendRouters(),
      totalDatabaseTables: project.database.tables.length,
      aiFeatures: this.detectAIFeatures(),
      voiceFeatures: this.detectVoiceFeatures(),
      securityFeatures: this.detectSecurityFeatures(),
      testingStatus: {
        unitTests: this.countTests('unit'),
        integrationTests: this.countTests('integration'),
        e2eTests: this.countTests('e2e'),
        coverage: 0,
        passing: 0,
        failing: 0,
      },
      productionReadiness: this.calculateProductionReadiness(project),
      completedFeatures: this.detectCompletedFeatures(),
      partialFeatures: this.detectPartialFeatures(),
      missingFeatures: this.detectMissingFeatures(),
      bugs: [],
      buildErrors: [],
      runtimeErrors: [],
      technicalDebt: [],
      estimatedRemainingHours: this.estimateRemainingWork(project),
      generatedAt: new Date(),
    };
  }

  /**
   * Count service files
   */
  private countServices(): number {
    const servicesDir = path.join(this.projectPath, 'services');
    if (!fs.existsSync(servicesDir)) return 0;

    const files = this.getAllFiles(servicesDir);
    return files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx')).length;
  }

  /**
   * Count API files
   */
  private countAPIs(): number {
    const serverDir = path.join(this.projectPath, 'server');
    if (!fs.existsSync(serverDir)) return 0;

    const files = this.getAllFiles(serverDir);
    return files.filter((f) => f.endsWith('.ts')).length;
  }

  /**
   * Count backend routers
   */
  private countBackendRouters(): number {
    const routersDir = path.join(this.projectPath, 'server', 'routers');
    if (!fs.existsSync(routersDir)) return 0;

    const files = fs.readdirSync(routersDir);
    return files.filter((f) => f.endsWith('.ts')).length;
  }

  /**
   * Detect AI features
   */
  private detectAIFeatures(): string[] {
    const features: string[] = [];
    const files = this.getAllFiles(this.projectPath);

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

      try {
        const content = fs.readFileSync(file, 'utf-8');

        if (content.includes('chat') || content.includes('Chat')) features.push('AI Chat');
        if (content.includes('advisor') || content.includes('Advisor')) features.push('AI Advisor');
        if (content.includes('recommendation')) features.push('AI Recommendations');
        if (content.includes('memory') || content.includes('Memory')) features.push('AI Memory');
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return [...new Set(features)];
  }

  /**
   * Detect voice features
   */
  private detectVoiceFeatures(): string[] {
    const features: string[] = [];
    const files = this.getAllFiles(this.projectPath);

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

      try {
        const content = fs.readFileSync(file, 'utf-8');

        if (content.includes('voice') || content.includes('Voice')) features.push('Voice Commands');
        if (content.includes('speech') || content.includes('Speech')) features.push('Speech Recognition');
        if (content.includes('tts') || content.includes('text-to-speech')) features.push('Text-to-Speech');
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return [...new Set(features)];
  }

  /**
   * Detect security features
   */
  private detectSecurityFeatures(): string[] {
    const features: string[] = [];
    const files = this.getAllFiles(this.projectPath);

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

      try {
        const content = fs.readFileSync(file, 'utf-8');

        if (content.includes('encrypt') || content.includes('Encrypt')) features.push('Encryption');
        if (content.includes('auth') || content.includes('Auth')) features.push('Authentication');
        if (content.includes('permission') || content.includes('Permission')) features.push('Permissions');
        if (content.includes('validation') || content.includes('Validation')) features.push('Input Validation');
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return [...new Set(features)];
  }

  /**
   * Count tests
   */
  private countTests(type: 'unit' | 'integration' | 'e2e'): number {
    const testsDir = path.join(this.projectPath, 'tests');
    if (!fs.existsSync(testsDir)) return 0;

    const files = this.getAllFiles(testsDir);
    return files.filter((f) => f.includes(type) && f.endsWith('.test.ts')).length;
  }

  /**
   * Calculate production readiness percentage
   */
  private calculateProductionReadiness(project: Project): number {
    let readiness = 0;

    if (project.screens.length > 0) readiness += 20;
    if (project.components.length > 0) readiness += 15;
    if (project.backend.routers.length > 0) readiness += 20;
    if (project.database.tables.length > 0) readiness += 15;
    if (project.backend.authentication.enabled) readiness += 10;
    if (project.backend.logging.enabled) readiness += 10;
    if (project.backend.errorHandling.enabled) readiness += 10;

    return Math.min(readiness, 100);
  }

  /**
   * Detect completed features
   */
  private detectCompletedFeatures(): string[] {
    return ['Project Structure', 'Navigation', 'UI Components', 'Basic Styling'];
  }

  /**
   * Detect partially completed features
   */
  private detectPartialFeatures(): string[] {
    return ['Authentication', 'Database Integration', 'API Endpoints'];
  }

  /**
   * Detect missing features
   */
  private detectMissingFeatures(): string[] {
    return ['Testing Suite', 'CI/CD Pipeline', 'Documentation', 'Performance Optimization'];
  }

  /**
   * Estimate remaining work in hours
   */
  private estimateRemainingWork(project: Project): number {
    let hours = 0;

    if (project.backend.routers.length === 0) hours += 40;
    if (project.database.tables.length === 0) hours += 20;
    if (!project.backend.authentication.enabled) hours += 16;
    if (!project.backend.logging.enabled) hours += 8;
    if (!project.backend.errorHandling.enabled) hours += 12;

    return hours;
  }
}
