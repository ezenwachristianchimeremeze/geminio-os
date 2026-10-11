import { invokeViaPort, parseModelJson } from "./llm-port";
import type { ProjectMemory } from "./project-memory";

/**
 * Database & Backend Generation Engine (Phase 6)
 * Generates Drizzle schemas, migrations, routers, and APIs
 */

export interface TableSchema {
  id: string;
  name: string;
  description: string;
  columns: ColumnDefinition[];
  relationships: Relationship[];
  indexes: IndexDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "json" | "uuid";
  required: boolean;
  unique: boolean;
  default?: unknown;
  description: string;
}

export interface Relationship {
  type: "one_to_many" | "many_to_one" | "many_to_many";
  target_table: string;
  foreign_key: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface APIEndpoint {
  id: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  description: string;
  request_schema: Record<string, unknown>;
  response_schema: Record<string, unknown>;
  authentication: "none" | "user" | "admin";
  rate_limit: number;
}

export class BackendGenerator {
  private memory: ProjectMemory;

  constructor(memory: ProjectMemory) {
    this.memory = memory;
  }

  /**
   * Generate Drizzle ORM schema
   */
  async generateDrizzleSchema(tables: TableSchema[]): Promise<string> {
    const prompt = `
      Generate a production-ready Drizzle ORM schema file for these tables:
      
      ${JSON.stringify(tables, null, 2)}
      
      Requirements:
      - Use Drizzle ORM with MySQL
      - Include proper type definitions
      - Add relationships and foreign keys
      - Include indexes
      - Add timestamps (createdAt, updatedAt)
      - Include JSDoc comments
      - Export all tables and relations
      - Use proper naming conventions
      
      Return ONLY the complete TypeScript code for schema.ts, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "backend-generator.generateDrizzleSchema",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      this.memory.storeArchitecture("drizzle_schema", content);
      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate database migration
   */
  async generateMigration(tables: TableSchema[]): Promise<string> {
    const prompt = `
      Generate a Drizzle migration SQL file for creating these tables:
      
      ${JSON.stringify(tables, null, 2)}
      
      Requirements:
      - Use MySQL syntax
      - Include CREATE TABLE statements
      - Add foreign key constraints
      - Add indexes
      - Add comments
      - Include proper data types
      - Add timestamps
      
      Return ONLY the complete SQL code, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "backend-generator.generateMigration",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2500,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate tRPC router
   */
  async generateTRPCRouter(endpoints: APIEndpoint[]): Promise<string> {
    const prompt = `
      Generate a production-ready tRPC router for these API endpoints:
      
      ${JSON.stringify(endpoints, null, 2)}
      
      Requirements:
      - Use tRPC v11
      - Include Zod validation schemas
      - Add authentication middleware
      - Include error handling
      - Add logging
      - Use proper TypeScript types
      - Include JSDoc comments
      - Add rate limiting
      - Include proper HTTP status codes
      
      Return ONLY the complete TypeScript code for the router, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "backend-generator.generateTRPCRouter",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 3000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      this.memory.storeArchitecture("trpc_router", content);
      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate CRUD operations
   */
  async generateCRUDOperations(table: TableSchema): Promise<string> {
    const prompt = `
      Generate production-ready CRUD operations for this table:
      
      ${JSON.stringify(table, null, 2)}
      
      Requirements:
      - Create, Read, Update, Delete operations
      - Use Drizzle ORM
      - Include proper error handling
      - Add validation
      - Include TypeScript types
      - Add logging
      - Include JSDoc comments
      - Add transaction support
      
      Return ONLY the complete TypeScript code, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "backend-generator.generateCRUDOperations",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2500,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate validation schemas
   */
  async generateValidationSchemas(tables: TableSchema[]): Promise<string> {
    const prompt = `
      Generate Zod validation schemas for these tables:
      
      ${JSON.stringify(tables, null, 2)}
      
      Requirements:
      - Use Zod v3
      - Include create, update, and read schemas
      - Add proper validation rules
      - Include error messages
      - Use proper TypeScript inference
      - Export all schemas
      - Include JSDoc comments
      
      Return ONLY the complete TypeScript code, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "backend-generator.generateValidationSchemas",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generate API documentation
   */
  async generateAPIDocumentation(endpoints: APIEndpoint[]): Promise<string> {
    const prompt = `
      Generate comprehensive API documentation for these endpoints:
      
      ${JSON.stringify(endpoints, null, 2)}
      
      Requirements:
      - Use Markdown format
      - Include endpoint descriptions
      - Add request/response examples
      - Document authentication
      - Include error codes
      - Add rate limits
      - Include usage examples
      
      Return ONLY the Markdown documentation, no explanations.
    `;

    try {
      const response = await invokeViaPort({
        operation: "backend-generator.generateAPIDocumentation",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      });

      const content = typeof response.choices[0]?.message?.content === 'string'
        ? response.choices[0]?.message?.content
        : "";

      return content;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

/**
 * Global Backend Generator manager
 */
class BackendGeneratorManager {
  private generators: Map<string, BackendGenerator> = new Map();

  createGenerator(projectId: string, memory: ProjectMemory): BackendGenerator {
    const generator = new BackendGenerator(memory);
    this.generators.set(projectId, generator);
    return generator;
  }

  getGenerator(projectId: string): BackendGenerator | undefined {
    return this.generators.get(projectId);
  }

  deleteGenerator(projectId: string): boolean {
    return this.generators.delete(projectId);
  }
}

export const backendGeneratorManager = new BackendGeneratorManager();
