import { z } from 'zod';

/**
 * OpenAPI Specification Generator
 * Generates OpenAPI 3.0 spec from tRPC procedures
 */

export interface OpenAPIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header';
    required: boolean;
    schema: any;
  }>;
  requestBody?: {
    required: boolean;
    content: {
      'application/json': {
        schema: any;
      };
    };
  };
  responses: {
    [statusCode: string]: {
      description: string;
      content?: {
        'application/json': {
          schema: any;
        };
      };
    };
  };
  tags?: string[];
  security?: Array<{ [key: string]: string[] }>;
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  servers: Array<{
    url: string;
    description?: string;
  }>;
  paths: {
    [path: string]: {
      [method: string]: OpenAPIEndpoint;
    };
  };
  components: {
    schemas: {
      [name: string]: any;
    };
    securitySchemes: {
      [name: string]: any;
    };
  };
}

/**
 * Generate OpenAPI spec
 */
export function generateOpenAPISpec(
  title: string,
  version: string,
  endpoints: OpenAPIEndpoint[],
  baseUrl: string = 'http://localhost:3000'
): OpenAPISpec {
  const paths: OpenAPISpec['paths'] = {};

  endpoints.forEach((endpoint) => {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }
    paths[endpoint.path][endpoint.method.toLowerCase()] = endpoint;
  });

  return {
    openapi: '3.0.0',
    info: {
      title,
      version,
    },
    servers: [
      {
        url: baseUrl,
        description: 'API Server',
      },
    ],
    paths,
    components: {
      schemas: {},
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };
}

/**
 * Zod Response Validation Schemas
 */

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.date().optional(),
});

export const PaginatedResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    hasMore: z.boolean(),
  }),
  timestamp: z.date().optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  timestamp: z.date().optional(),
});

/**
 * Validate API Response
 */
export function validateApiResponse<T>(data: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Response validation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Response Builder
 */
export class ResponseBuilder {
  static success<T>(data: T, message?: string) {
    return {
      success: true,
      data,
      message,
      timestamp: new Date(),
    };
  }

  static paginated<T>(
    data: T[],
    page: number,
    pageSize: number,
    total: number
  ) {
    return {
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
      },
      timestamp: new Date(),
    };
  }

  static error(code: string, message: string, details?: any) {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date(),
    };
  }

  static notFound(resource: string) {
    return this.error('NOT_FOUND', `${resource} not found`);
  }

  static unauthorized() {
    return this.error('UNAUTHORIZED', 'Unauthorized access');
  }

  static forbidden() {
    return this.error('FORBIDDEN', 'Access forbidden');
  }

  static badRequest(message: string) {
    return this.error('BAD_REQUEST', message);
  }

  static internalError(message: string = 'Internal server error') {
    return this.error('INTERNAL_ERROR', message);
  }
}

/**
 * Request/Response Logging
 */
export interface RequestLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
  error?: string;
}

export class RequestLogger {
  private logs: RequestLog[] = [];

  log(entry: Omit<RequestLog, 'id' | 'timestamp'>): void {
    this.logs.push({
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    });

    // Keep only last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  getLogs(limit: number = 100): RequestLog[] {
    return this.logs.slice(-limit);
  }

  getLogsByUser(userId: string, limit: number = 100): RequestLog[] {
    return this.logs.filter((log) => log.userId === userId).slice(-limit);
  }

  getErrorLogs(limit: number = 100): RequestLog[] {
    return this.logs.filter((log) => log.error).slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }
}

/**
 * API Versioning Support
 */
export interface ApiVersion {
  version: string;
  deprecated: boolean;
  deprecatedAt?: Date;
  sunsetsAt?: Date;
}

export const API_VERSIONS: Record<string, ApiVersion> = {
  'v1': {
    version: 'v1',
    deprecated: false,
  },
  'v2': {
    version: 'v2',
    deprecated: false,
  },
};

/**
 * Contract-First API Design
 * Define contracts before implementation
 */
export interface ApiContract {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  request: z.ZodSchema;
  response: z.ZodSchema;
  errors: Array<{
    code: string;
    statusCode: number;
    description: string;
  }>;
}

export function createApiContract(contract: ApiContract): ApiContract {
  return contract;
}
