/**
 * AI Builder Type Definitions
 * Core types for the AI Mobile App Builder and Project Continuation Engine
 */

// Project Status Types
export type ProjectStatus = 'planning' | 'designing' | 'building' | 'testing' | 'deploying' | 'completed';
export type FeatureStatus = 'pending' | 'in-progress' | 'completed' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type DecisionType = 'architecture' | 'feature' | 'design' | 'performance' | 'security';
export type Framework = 'react-native' | 'flutter' | 'expo' | 'next-js' | 'vue' | 'angular';
export type Platform = 'android' | 'ios' | 'web' | 'desktop';
export type Database = 'mysql' | 'postgresql' | 'mongodb' | 'firebase' | 'sqlite';

// Project Model
export interface Project {
  id: string;
  name: string;
  description: string;
  framework: Framework;
  version: string;
  status: ProjectStatus;
  platforms: Platform[];
  screens: Screen[];
  components: Component[];
  backend: BackendConfig;
  database: DatabaseConfig;
  features: Feature[];
  progress: number;
  totalEstimatedHours: number;
  actualHours: number;
  createdAt: Date;
  updatedAt: Date;
  uploadedAt?: Date;
  isUploadedProject: boolean;
}

// Screen Model
export interface Screen {
  id: string;
  name: string;
  description: string;
  route: string;
  components: string[];
  state: Record<string, unknown>;
  navigation: NavigationConfig;
  status: FeatureStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Component Model
export interface Component {
  id: string;
  name: string;
  description: string;
  props: PropDefinition[];
  state: StateDefinition[];
  methods: MethodDefinition[];
  styling: StyleConfig;
  status: FeatureStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Property Definition
export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

// State Definition
export interface StateDefinition {
  name: string;
  type: string;
  initialValue: unknown;
  description: string;
}

// Method Definition
export interface MethodDefinition {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  returnType: string;
}

// Parameter Definition
export interface ParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

// Style Configuration
export interface StyleConfig {
  theme: 'light' | 'dark' | 'auto';
  colors: Record<string, string>;
  spacing: Record<string, number>;
  typography: TypographyConfig;
  responsive: boolean;
}

// Typography Configuration
export interface TypographyConfig {
  fontFamily: string;
  fontSize: Record<string, number>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, number>;
}

// Navigation Configuration
export interface NavigationConfig {
  type: 'stack' | 'tab' | 'drawer' | 'modal';
  title: string;
  icon?: string;
  params?: Record<string, unknown>;
}

// Feature Model
export interface Feature {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  priority: Priority;
  estimatedHours: number;
  actualHours: number;
  assignedTo: string;
  dependencies: string[];
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}

// Task Model
export interface Task {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  estimatedHours: number;
  actualHours: number;
  createdAt: Date;
  updatedAt: Date;
}

// Backend Configuration
export interface BackendConfig {
  framework: 'express' | 'fastapi' | 'django' | 'spring' | 'trpc';
  language: 'typescript' | 'python' | 'java' | 'go';
  routers: Router[];
  middleware: Middleware[];
  authentication: AuthConfig;
  authorization: AuthorizationConfig;
  logging: LoggingConfig;
  errorHandling: ErrorHandlingConfig;
}

// Router Model
export interface Router {
  id: string;
  name: string;
  path: string;
  endpoints: Endpoint[];
  middleware: string[];
  description: string;
}

// Endpoint Model
export interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters: ParameterDefinition[];
  requestBody?: RequestBodyDefinition;
  responseBody?: ResponseBodyDefinition;
  authentication: boolean;
  authorization?: string[];
  validation: ValidationRule[];
  errorHandling: ErrorHandler[];
}

// Request Body Definition
export interface RequestBodyDefinition {
  type: string;
  required: boolean;
  schema: Record<string, unknown>;
}

// Response Body Definition
export interface ResponseBodyDefinition {
  type: string;
  schema: Record<string, unknown>;
}

// Validation Rule
export interface ValidationRule {
  field: string;
  type: string;
  rules: Record<string, unknown>;
  message: string;
}

// Error Handler
export interface ErrorHandler {
  status: number;
  message: string;
  description: string;
}

// Middleware Model
export interface Middleware {
  name: string;
  description: string;
  config: Record<string, unknown>;
}

// Authentication Configuration
export interface AuthConfig {
  enabled: boolean;
  type: 'oauth' | 'jwt' | 'session' | 'api-key';
  providers: AuthProvider[];
  tokenExpiry: number;
}

// Authentication Provider
export interface AuthProvider {
  name: string;
  type: 'google' | 'github' | 'facebook' | 'apple' | 'custom';
  config: Record<string, unknown>;
}

// Authorization Configuration
export interface AuthorizationConfig {
  enabled: boolean;
  type: 'rbac' | 'abac' | 'custom';
  roles: Role[];
  permissions: Permission[];
}

// Role Model
export interface Role {
  name: string;
  description: string;
  permissions: string[];
}

// Permission Model
export interface Permission {
  name: string;
  description: string;
  resource: string;
  action: string;
}

// Logging Configuration
export interface LoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  transport: 'console' | 'file' | 'cloud';
  format: 'json' | 'text';
}

// Error Handling Configuration
export interface ErrorHandlingConfig {
  enabled: boolean;
  globalErrorHandler: boolean;
  errorLogging: boolean;
  errorReporting: boolean;
  customErrors: CustomError[];
}

// Custom Error
export interface CustomError {
  name: string;
  statusCode: number;
  message: string;
  description: string;
}

// Database Configuration
export interface DatabaseConfig {
  type: Database;
  host: string;
  port: number;
  database: string;
  tables: Table[];
  migrations: Migration[];
  seeders: Seeder[];
}

// Table Model
export interface Table {
  id: string;
  name: string;
  description: string;
  columns: Column[];
  indexes: Index[];
  constraints: Constraint[];
  relationships: Relationship[];
}

// Column Model
export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  defaultValue?: unknown;
  description: string;
}

// Index Model
export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
  description: string;
}

// Constraint Model
export interface Constraint {
  name: string;
  type: 'primary' | 'foreign' | 'unique' | 'check';
  columns: string[];
  description: string;
}

// Relationship Model
export interface Relationship {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
  onDelete: 'cascade' | 'restrict' | 'set-null';
  onUpdate: 'cascade' | 'restrict' | 'set-null';
}

// Migration Model
export interface Migration {
  id: string;
  name: string;
  version: number;
  up: string;
  down: string;
  status: 'pending' | 'completed';
  createdAt: Date;
  executedAt?: Date;
}

// Seeder Model
export interface Seeder {
  id: string;
  name: string;
  description: string;
  data: Record<string, unknown>[];
  status: 'pending' | 'completed';
}

// Decision Model
export interface Decision {
  id: string;
  projectId: string;
  type: DecisionType;
  description: string;
  options: DecisionOption[];
  selectedOption: string;
  rationale: string;
  madeBy: 'ai' | 'user';
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Decision Option
export interface DecisionOption {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  recommendation: boolean;
}

// Project Audit Report
export interface ProjectAudit {
  projectId: string;
  projectName: string;
  framework: Framework;
  version: string;
  totalFiles: number;
  totalScreens: number;
  totalComponents: number;
  totalServices: number;
  totalAPIs: number;
  totalBackendRouters: number;
  totalDatabaseTables: number;
  aiFeatures: string[];
  voiceFeatures: string[];
  securityFeatures: string[];
  testingStatus: TestingStatus;
  productionReadiness: number;
  completedFeatures: string[];
  partialFeatures: string[];
  missingFeatures: string[];
  bugs: Bug[];
  buildErrors: BuildError[];
  runtimeErrors: RuntimeError[];
  technicalDebt: TechnicalDebtItem[];
  estimatedRemainingHours: number;
  generatedAt: Date;
}

// Testing Status
export interface TestingStatus {
  unitTests: number;
  integrationTests: number;
  e2eTests: number;
  coverage: number;
  passing: number;
  failing: number;
}

// Bug Model
export interface Bug {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'fixed' | 'closed';
  file: string;
  line: number;
  createdAt: Date;
}

// Build Error
export interface BuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

// Runtime Error
export interface RuntimeError {
  type: string;
  message: string;
  stack: string;
  frequency: number;
  lastOccurred: Date;
}

// Technical Debt Item
export interface TechnicalDebtItem {
  id: string;
  type: string;
  description: string;
  severity: Priority;
  estimatedHours: number;
  file: string;
}

// Progress Tracking
export interface ProgressTracking {
  projectId: string;
  completedTasks: number;
  totalTasks: number;
  currentTask: string;
  remainingTasks: string[];
  knownIssues: Issue[];
  fixedBugs: Bug[];
  testResults: TestResult[];
  lastUpdated: Date;
}

// Issue Model
export interface Issue {
  id: string;
  title: string;
  description: string;
  severity: Priority;
  status: 'open' | 'in-progress' | 'resolved';
  createdAt: Date;
}

// Test Result
export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  timestamp: Date;
}

// Approval Request
export interface ApprovalRequest {
  id: string;
  projectId: string;
  type: 'code-review' | 'feature-approval' | 'deployment' | 'deletion';
  description: string;
  changes: Change[];
  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected';
}

// Change Model
export interface Change {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  before?: string;
  after?: string;
  description: string;
}

// Conversation Message
export interface ConversationMessage {
  id: string;
  projectId: string;
  sender: 'ai' | 'user';
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

// Build Configuration
export interface BuildConfig {
  platform: Platform;
  releaseType: 'debug' | 'release';
  signingConfig?: SigningConfig;
  buildOptions: Record<string, unknown>;
}

// Signing Configuration
export interface SigningConfig {
  keystore: string;
  keystorePassword: string;
  keyAlias: string;
  keyPassword: string;
}

// Deployment Configuration
export interface DeploymentConfig {
  platform: Platform;
  appStore?: string;
  testFlight?: boolean;
  playStore?: boolean;
  releaseNotes: string;
  version: string;
  buildNumber: number;
}
