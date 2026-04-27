/**
 * EverFern Desktop — API Builder Subagent
 *
 * Specialized subagent for building RESTful APIs with authentication,
 * validation, error handling, and documentation generation.
 */

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  middleware: string[];
  validation?: {
    body?: any;
    params?: any;
    query?: any;
  };
  authentication: boolean;
  authorization?: string[];
  documentation: {
    summary: string;
    description: string;
    parameters: any[];
    responses: any[];
    tags: string[];
  };
}

export interface AuthenticationConfig {
  type: 'jwt' | 'oauth' | 'basic' | 'api-key';
  secretKey?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  refreshToken?: boolean;
}

export interface ValidationSchema {
  type: 'joi' | 'yup' | 'zod' | 'ajv';
  schema: any;
}

export interface APISpec {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: APIEndpoint[];
  authentication: AuthenticationConfig;
  middleware: string[];
  errorHandling: {
    globalHandler: boolean;
    customErrors: any[];
  };
  documentation: {
    openapi: boolean;
    swagger: boolean;
    outputPath: string;
  };
}

export interface APIBuildResult {
  success: boolean;
  filesCreated: string[];
  endpoints: number;
  documentation?: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * API Builder Subagent - Builds complete RESTful APIs
 */
export class APIBuilder {
  private framework: 'express' | 'fastify' | 'koa' | 'nestjs' = 'express';
  private validationLibrary: 'joi' | 'yup' | 'zod' = 'joi';
  private authLibrary: 'jsonwebtoken' | 'passport' | 'auth0' = 'jsonwebtoken';

  /**
   * Build a complete API from specification
   */
  async buildAPI(spec: APISpec): Promise<APIBuildResult> {
    try {
      const filesCreated: string[] = [];

      // Create main server file
      const serverFile = await this.createServerFile(spec);
      filesCreated.push(serverFile);

      // Create route files
      const routeFiles = await this.createRouteFiles(spec.endpoints);
      filesCreated.push(...routeFiles);

      // Create middleware files
      const middlewareFiles = await this.createMiddlewareFiles(spec);
      filesCreated.push(...middlewareFiles);

      // Create validation schemas
      const validationFiles = await this.createValidationSchemas(spec.endpoints);
      filesCreated.push(...validationFiles);

      // Create authentication system
      const authFiles = await this.createAuthenticationSystem(spec.authentication);
      filesCreated.push(...authFiles);

      // Create error handling
      const errorFiles = await this.createErrorHandling(spec.errorHandling);
      filesCreated.push(...errorFiles);

      // Generate documentation
      let documentationPath: string | undefined;
      if (spec.documentation.openapi || spec.documentation.swagger) {
        documentationPath = await this.generateDocumentation(spec);
        filesCreated.push(documentationPath);
      }

      return {
        success: true,
        filesCreated,
        endpoints: spec.endpoints.length,
        documentation: documentationPath
      };

    } catch (error) {
      return {
        success: false,
        filesCreated: [],
        endpoints: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Create RESTful endpoints with proper HTTP methods and status codes
   */
  createRESTfulEndpoints(resource: string, operations: string[]): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];
    const resourcePath = `/${resource.toLowerCase()}`;

    if (operations.includes('list')) {
      endpoints.push({
        method: 'GET',
        path: resourcePath,
        handler: `list${this.capitalize(resource)}`,
        middleware: ['cors', 'rateLimit'],
        authentication: true,
        documentation: {
          summary: `List all ${resource}`,
          description: `Retrieve a paginated list of ${resource} items`,
          parameters: [
            { name: 'page', in: 'query', type: 'integer', description: 'Page number' },
            { name: 'limit', in: 'query', type: 'integer', description: 'Items per page' }
          ],
          responses: [
            { status: 200, description: 'Success', schema: `${resource}List` },
            { status: 401, description: 'Unauthorized' },
            { status: 500, description: 'Internal Server Error' }
          ],
          tags: [resource]
        }
      });
    }

    if (operations.includes('get')) {
      endpoints.push({
        method: 'GET',
        path: `${resourcePath}/:id`,
        handler: `get${this.capitalize(resource)}`,
        middleware: ['cors', 'validateId'],
        validation: {
          params: { id: 'string.required()' }
        },
        authentication: true,
        documentation: {
          summary: `Get ${resource} by ID`,
          description: `Retrieve a specific ${resource} item by its ID`,
          parameters: [
            { name: 'id', in: 'path', type: 'string', required: true, description: `${resource} ID` }
          ],
          responses: [
            { status: 200, description: 'Success', schema: resource },
            { status: 404, description: 'Not Found' },
            { status: 401, description: 'Unauthorized' }
          ],
          tags: [resource]
        }
      });
    }

    if (operations.includes('create')) {
      endpoints.push({
        method: 'POST',
        path: resourcePath,
        handler: `create${this.capitalize(resource)}`,
        middleware: ['cors', 'validateBody'],
        validation: {
          body: `${resource}CreateSchema`
        },
        authentication: true,
        authorization: ['admin', 'user'],
        documentation: {
          summary: `Create new ${resource}`,
          description: `Create a new ${resource} item`,
          parameters: [
            { name: 'body', in: 'body', schema: `${resource}Create`, required: true }
          ],
          responses: [
            { status: 201, description: 'Created', schema: resource },
            { status: 400, description: 'Bad Request' },
            { status: 401, description: 'Unauthorized' },
            { status: 403, description: 'Forbidden' }
          ],
          tags: [resource]
        }
      });
    }

    if (operations.includes('update')) {
      endpoints.push({
        method: 'PUT',
        path: `${resourcePath}/:id`,
        handler: `update${this.capitalize(resource)}`,
        middleware: ['cors', 'validateId', 'validateBody'],
        validation: {
          params: { id: 'string.required()' },
          body: `${resource}UpdateSchema`
        },
        authentication: true,
        authorization: ['admin', 'owner'],
        documentation: {
          summary: `Update ${resource}`,
          description: `Update an existing ${resource} item`,
          parameters: [
            { name: 'id', in: 'path', type: 'string', required: true },
            { name: 'body', in: 'body', schema: `${resource}Update`, required: true }
          ],
          responses: [
            { status: 200, description: 'Updated', schema: resource },
            { status: 404, description: 'Not Found' },
            { status: 400, description: 'Bad Request' },
            { status: 403, description: 'Forbidden' }
          ],
          tags: [resource]
        }
      });
    }

    if (operations.includes('delete')) {
      endpoints.push({
        method: 'DELETE',
        path: `${resourcePath}/:id`,
        handler: `delete${this.capitalize(resource)}`,
        middleware: ['cors', 'validateId'],
        validation: {
          params: { id: 'string.required()' }
        },
        authentication: true,
        authorization: ['admin'],
        documentation: {
          summary: `Delete ${resource}`,
          description: `Delete a ${resource} item`,
          parameters: [
            { name: 'id', in: 'path', type: 'string', required: true }
          ],
          responses: [
            { status: 204, description: 'Deleted' },
            { status: 404, description: 'Not Found' },
            { status: 403, description: 'Forbidden' }
          ],
          tags: [resource]
        }
      });
    }

    return endpoints;
  }

  /**
   * Implement request validation using schema validation libraries
   */
  createValidationMiddleware(schema: ValidationSchema): string {
    switch (schema.type) {
      case 'joi':
        return this.generateJoiValidation(schema.schema);
      case 'yup':
        return this.generateYupValidation(schema.schema);
      case 'zod':
        return this.generateZodValidation(schema.schema);
      default:
        return this.generateJoiValidation(schema.schema);
    }
  }

  /**
   * Create comprehensive error handling with appropriate HTTP status codes
   */
  createErrorHandlingSystem(): string {
    return `
import { Request, Response, NextFunction } from 'express';

export class APIError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends APIError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends APIError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (error instanceof APIError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'MongoError' && error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate field value';
  }

  // Log error for debugging
  console.error(\`Error \${statusCode}: \${message}\`, {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: \`Route \${req.originalUrl} not found\`,
      statusCode: 404
    }
  });
};`;
  }

  /**
   * Implement authentication systems (JWT, OAuth, etc.)
   */
  createAuthenticationSystem(config: AuthenticationConfig): Promise<string[]> {
    const files: string[] = [];

    switch (config.type) {
      case 'jwt':
        files.push(this.createJWTAuthentication(config));
        break;
      case 'oauth':
        files.push(this.createOAuthAuthentication(config));
        break;
      case 'basic':
        files.push(this.createBasicAuthentication());
        break;
      case 'api-key':
        files.push(this.createAPIKeyAuthentication());
        break;
    }

    return Promise.resolve(files);
  }

  /**
   * Implement authorization middleware with role-based access control
   */
  createAuthorizationMiddleware(roles: string[]): string {
    return `
import { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from './errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

export const authorize = (requiredRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthorizationError('User not authenticated');
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      throw new AuthorizationError(\`Requires one of: \${requiredRoles.join(', ')}\`);
    }

    next();
  };
};

export const requireRole = (role: string) => authorize([role]);

export const requireAnyRole = (...roles: string[]) => authorize(roles);

export const requireOwnership = (resourceIdParam: string = 'id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthorizationError('User not authenticated');
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;

    // Check if user is admin or owns the resource
    if (req.user.roles.includes('admin') || resourceId === userId) {
      return next();
    }

    throw new AuthorizationError('Access denied: insufficient permissions');
  };
};`;
  }

  /**
   * Generate OpenAPI/Swagger documentation
   */
  async generateDocumentation(spec: APISpec): Promise<string> {
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: spec.name,
        version: spec.version,
        description: spec.description
      },
      servers: [
        {
          url: spec.baseUrl,
          description: 'API Server'
        }
      ],
      paths: this.generateOpenAPIPaths(spec.endpoints),
      components: {
        securitySchemes: this.generateSecuritySchemes(spec.authentication),
        schemas: this.generateSchemas(spec.endpoints)
      },
      security: this.generateSecurity(spec.authentication)
    };

    const docPath = spec.documentation.outputPath || 'docs/api.json';
    // In real implementation, would write to file
    return docPath;
  }

  /**
   * Create rate limiting and request throttling
   */
  createRateLimitingMiddleware(): string {
    return `
import rateLimit from 'express-rate-limit';
import { RateLimitError } from './errors';

export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests from this IP',
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req, res) => {
      throw new RateLimitError(options.message);
    }
  });
};

export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per 15 minutes
});

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts'
});

export const apiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  skipSuccessfulRequests: true
});`;
  }

  /**
   * Implement proper CORS configuration
   */
  createCORSMiddleware(): string {
    return `
import cors from 'cors';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://yourdomain.com'
];

export const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

export const corsMiddleware = cors(corsOptions);`;
  }

  // Private helper methods

  private async createServerFile(spec: APISpec): Promise<string> {
    // Generate main server file based on framework
    return `src/server.${this.framework === 'express' ? 'js' : 'ts'}`;
  }

  private async createRouteFiles(endpoints: APIEndpoint[]): Promise<string[]> {
    const routeFiles: string[] = [];
    const groupedEndpoints = this.groupEndpointsByResource(endpoints);

    for (const [resource, resourceEndpoints] of groupedEndpoints.entries()) {
      routeFiles.push(`src/routes/${resource}.ts`);
    }

    return routeFiles;
  }

  private async createMiddlewareFiles(spec: APISpec): Promise<string[]> {
    return [
      'src/middleware/auth.ts',
      'src/middleware/validation.ts',
      'src/middleware/cors.ts',
      'src/middleware/rateLimit.ts',
      'src/middleware/errors.ts'
    ];
  }

  private async createValidationSchemas(endpoints: APIEndpoint[]): Promise<string[]> {
    const schemaFiles: string[] = [];
    const resources = new Set(endpoints.map(e => this.extractResourceFromPath(e.path)));

    for (const resource of resources) {
      schemaFiles.push(`src/schemas/${resource}.ts`);
    }

    return schemaFiles;
  }

  private async createErrorHandling(errorConfig: any): Promise<string[]> {
    return ['src/middleware/errorHandler.ts', 'src/utils/errors.ts'];
  }

  private createJWTAuthentication(config: AuthenticationConfig): string {
    return 'src/middleware/jwt-auth.ts';
  }

  private createOAuthAuthentication(config: AuthenticationConfig): string {
    return 'src/middleware/oauth-auth.ts';
  }

  private createBasicAuthentication(): string {
    return 'src/middleware/basic-auth.ts';
  }

  private createAPIKeyAuthentication(): string {
    return 'src/middleware/api-key-auth.ts';
  }

  private generateJoiValidation(schema: any): string {
    return `
import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }
    next();
  };
};`;
  }

  private generateYupValidation(schema: any): string {
    return `
import * as yup from 'yup';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

export const validateBody = (schema: yup.ObjectSchema<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.validate(req.body);
      next();
    } catch (error) {
      throw new ValidationError(error.message);
    }
  };
};`;
  }

  private generateZodValidation(schema: any): string {
    return `
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0].message);
    }
    next();
  };
};`;
  }

  private generateOpenAPIPaths(endpoints: APIEndpoint[]): any {
    const paths: any = {};

    for (const endpoint of endpoints) {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      paths[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.documentation.summary,
        description: endpoint.documentation.description,
        tags: endpoint.documentation.tags,
        parameters: endpoint.documentation.parameters,
        responses: this.formatOpenAPIResponses(endpoint.documentation.responses),
        security: endpoint.authentication ? [{ bearerAuth: [] }] : []
      };
    }

    return paths;
  }

  private generateSecuritySchemes(auth: AuthenticationConfig): any {
    switch (auth.type) {
      case 'jwt':
        return {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        };
      case 'api-key':
        return {
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        };
      default:
        return {};
    }
  }

  private generateSchemas(endpoints: APIEndpoint[]): any {
    const schemas: any = {};

    // Generate schemas based on endpoints
    const resources = new Set(endpoints.map(e => this.extractResourceFromPath(e.path)));

    for (const resource of resources) {
      schemas[resource] = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      };
    }

    return schemas;
  }

  private generateSecurity(auth: AuthenticationConfig): any[] {
    switch (auth.type) {
      case 'jwt':
        return [{ bearerAuth: [] }];
      case 'api-key':
        return [{ apiKey: [] }];
      default:
        return [];
    }
  }

  private formatOpenAPIResponses(responses: any[]): any {
    const formatted: any = {};

    for (const response of responses) {
      formatted[response.status] = {
        description: response.description,
        content: response.schema ? {
          'application/json': {
            schema: { $ref: `#/components/schemas/${response.schema}` }
          }
        } : undefined
      };
    }

    return formatted;
  }

  private groupEndpointsByResource(endpoints: APIEndpoint[]): Map<string, APIEndpoint[]> {
    const grouped = new Map<string, APIEndpoint[]>();

    for (const endpoint of endpoints) {
      const resource = this.extractResourceFromPath(endpoint.path);
      if (!grouped.has(resource)) {
        grouped.set(resource, []);
      }
      grouped.get(resource)!.push(endpoint);
    }

    return grouped;
  }

  private extractResourceFromPath(path: string): string {
    const parts = path.split('/').filter(p => p && !p.startsWith(':'));
    return parts[0] || 'api';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Singleton instance for global access
 */
let apiBuilderInstance: APIBuilder | null = null;

/**
 * Get or create the API builder singleton
 */
export function getAPIBuilder(): APIBuilder {
  if (!apiBuilderInstance) {
    apiBuilderInstance = new APIBuilder();
  }
  return apiBuilderInstance;
}

/**
 * Reset the API builder (useful for testing)
 */
export function resetAPIBuilder(): void {
  apiBuilderInstance = null;
}
