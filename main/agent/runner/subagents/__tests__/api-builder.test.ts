/**
 * Unit tests for API Builder Subagent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { APIBuilder, getAPIBuilder, resetAPIBuilder, APISpec, APIEndpoint } from '../api-builder';

describe('APIBuilder', () => {
  let apiBuilder: APIBuilder;

  beforeEach(() => {
    resetAPIBuilder();
    apiBuilder = getAPIBuilder();
  });

  describe('RESTful Endpoint Creation', () => {
    it('should create CRUD endpoints for a resource', () => {
      const endpoints = apiBuilder.createRESTfulEndpoints('users', ['list', 'get', 'create', 'update', 'delete']);

      expect(endpoints).toHaveLength(5);

      // Check list endpoint
      const listEndpoint = endpoints.find(e => e.method === 'GET' && e.path === '/users');
      expect(listEndpoint).toBeDefined();
      expect(listEndpoint?.handler).toBe('listUsers');
      expect(listEndpoint?.authentication).toBe(true);

      // Check get endpoint
      const getEndpoint = endpoints.find(e => e.method === 'GET' && e.path === '/users/:id');
      expect(getEndpoint).toBeDefined();
      expect(getEndpoint?.handler).toBe('getUsers');
      expect(getEndpoint?.validation?.params).toBeDefined();

      // Check create endpoint
      const createEndpoint = endpoints.find(e => e.method === 'POST' && e.path === '/users');
      expect(createEndpoint).toBeDefined();
      expect(createEndpoint?.handler).toBe('createUsers');
      expect(createEndpoint?.authorization).toContain('admin');

      // Check update endpoint
      const updateEndpoint = endpoints.find(e => e.method === 'PUT' && e.path === '/users/:id');
      expect(updateEndpoint).toBeDefined();
      expect(updateEndpoint?.handler).toBe('updateUsers');
      expect(updateEndpoint?.authorization).toContain('owner');

      // Check delete endpoint
      const deleteEndpoint = endpoints.find(e => e.method === 'DELETE' && e.path === '/users/:id');
      expect(deleteEndpoint).toBeDefined();
      expect(deleteEndpoint?.handler).toBe('deleteUsers');
      expect(deleteEndpoint?.authorization).toContain('admin');
    });

    it('should create only specified operations', () => {
      const endpoints = apiBuilder.createRESTfulEndpoints('posts', ['list', 'get']);

      expect(endpoints).toHaveLength(2);
      expect(endpoints.every(e => e.method === 'GET')).toBe(true);
    });

    it('should include proper documentation for endpoints', () => {
      const endpoints = apiBuilder.createRESTfulEndpoints('products', ['list']);
      const listEndpoint = endpoints[0];

      expect(listEndpoint.documentation.summary).toContain('products');
      expect(listEndpoint.documentation.description).toContain('paginated');
      expect(listEndpoint.documentation.parameters).toHaveLength(2); // page and limit
      expect(listEndpoint.documentation.responses).toHaveLength(3); // 200, 401, 500
      expect(listEndpoint.documentation.tags).toContain('products');
    });
  });

  describe('Validation Middleware Creation', () => {
    it('should generate Joi validation middleware', () => {
      const schema = { type: 'joi', schema: {} };
      const middleware = apiBuilder.createValidationMiddleware(schema);

      expect(middleware).toContain('Joi');
      expect(middleware).toContain('validateBody');
      expect(middleware).toContain('ValidationError');
    });

    it('should generate Yup validation middleware', () => {
      const schema = { type: 'yup', schema: {} };
      const middleware = apiBuilder.createValidationMiddleware(schema);

      expect(middleware).toContain('yup');
      expect(middleware).toContain('validateBody');
      expect(middleware).toContain('async');
    });

    it('should generate Zod validation middleware', () => {
      const schema = { type: 'zod', schema: {} };
      const middleware = apiBuilder.createValidationMiddleware(schema);

      expect(middleware).toContain('zod');
      expect(middleware).toContain('validateBody');
      expect(middleware).toContain('safeParse');
    });

    it('should default to Joi for unknown validation types', () => {
      const schema = { type: 'unknown' as any, schema: {} };
      const middleware = apiBuilder.createValidationMiddleware(schema);

      expect(middleware).toContain('Joi');
    });
  });

  describe('Error Handling System', () => {
    it('should create comprehensive error handling', () => {
      const errorSystem = apiBuilder.createErrorHandlingSystem();

      expect(errorSystem).toContain('APIError');
      expect(errorSystem).toContain('ValidationError');
      expect(errorSystem).toContain('AuthenticationError');
      expect(errorSystem).toContain('AuthorizationError');
      expect(errorSystem).toContain('NotFoundError');
      expect(errorSystem).toContain('ConflictError');
      expect(errorSystem).toContain('RateLimitError');
      expect(errorSystem).toContain('errorHandler');
      expect(errorSystem).toContain('asyncHandler');
      expect(errorSystem).toContain('notFoundHandler');
    });

    it('should include proper error status codes', () => {
      const errorSystem = apiBuilder.createErrorHandlingSystem();

      expect(errorSystem).toContain('400'); // ValidationError
      expect(errorSystem).toContain('401'); // AuthenticationError
      expect(errorSystem).toContain('403'); // AuthorizationError
      expect(errorSystem).toContain('404'); // NotFoundError
      expect(errorSystem).toContain('409'); // ConflictError
      expect(errorSystem).toContain('429'); // RateLimitError
      expect(errorSystem).toContain('500'); // Internal Server Error
    });

    it('should include error logging', () => {
      const errorSystem = apiBuilder.createErrorHandlingSystem();

      expect(errorSystem).toContain('console.error');
      expect(errorSystem).toContain('stack');
      expect(errorSystem).toContain('url');
      expect(errorSystem).toContain('method');
      expect(errorSystem).toContain('ip');
    });
  });

  describe('Authorization Middleware', () => {
    it('should create role-based authorization', () => {
      const authMiddleware = apiBuilder.createAuthorizationMiddleware(['admin', 'user']);

      expect(authMiddleware).toContain('authorize');
      expect(authMiddleware).toContain('requiredRoles');
      expect(authMiddleware).toContain('userRoles');
      expect(authMiddleware).toContain('hasRequiredRole');
      expect(authMiddleware).toContain('AuthorizationError');
    });

    it('should include helper functions', () => {
      const authMiddleware = apiBuilder.createAuthorizationMiddleware(['admin']);

      expect(authMiddleware).toContain('requireRole');
      expect(authMiddleware).toContain('requireAnyRole');
      expect(authMiddleware).toContain('requireOwnership');
    });

    it('should check for authenticated user', () => {
      const authMiddleware = apiBuilder.createAuthorizationMiddleware(['admin']);

      expect(authMiddleware).toContain('if (!req.user)');
      expect(authMiddleware).toContain('User not authenticated');
    });
  });

  describe('Rate Limiting', () => {
    it('should create rate limiting middleware', () => {
      const rateLimitMiddleware = apiBuilder.createRateLimitingMiddleware();

      expect(rateLimitMiddleware).toContain('rateLimit');
      expect(rateLimitMiddleware).toContain('createRateLimit');
      expect(rateLimitMiddleware).toContain('windowMs');
      expect(rateLimitMiddleware).toContain('max');
      expect(rateLimitMiddleware).toContain('RateLimitError');
    });

    it('should include different rate limit configurations', () => {
      const rateLimitMiddleware = apiBuilder.createRateLimitingMiddleware();

      expect(rateLimitMiddleware).toContain('generalRateLimit');
      expect(rateLimitMiddleware).toContain('authRateLimit');
      expect(rateLimitMiddleware).toContain('apiRateLimit');
    });

    it('should have appropriate limits for different endpoints', () => {
      const rateLimitMiddleware = apiBuilder.createRateLimitingMiddleware();

      // Auth rate limit should be stricter
      expect(rateLimitMiddleware).toContain('max: 5'); // auth attempts
      // General rate limit
      expect(rateLimitMiddleware).toContain('max: 100'); // general requests
      // API rate limit
      expect(rateLimitMiddleware).toContain('max: 60'); // API requests per minute
    });
  });

  describe('CORS Configuration', () => {
    it('should create CORS middleware', () => {
      const corsMiddleware = apiBuilder.createCORSMiddleware();

      expect(corsMiddleware).toContain('cors');
      expect(corsMiddleware).toContain('corsOptions');
      expect(corsMiddleware).toContain('allowedOrigins');
      expect(corsMiddleware).toContain('credentials');
    });

    it('should include proper CORS configuration', () => {
      const corsMiddleware = apiBuilder.createCORSMiddleware();

      expect(corsMiddleware).toContain('methods');
      expect(corsMiddleware).toContain('allowedHeaders');
      expect(corsMiddleware).toContain('exposedHeaders');
      expect(corsMiddleware).toContain('maxAge');
    });

    it('should handle origin validation', () => {
      const corsMiddleware = apiBuilder.createCORSMiddleware();

      expect(corsMiddleware).toContain('origin:');
      expect(corsMiddleware).toContain('callback');
      expect(corsMiddleware).toContain('allowedOrigins.includes');
    });
  });

  describe('Authentication System Creation', () => {
    it('should create JWT authentication files', async () => {
      const config = { type: 'jwt' as const, secretKey: 'secret' };
      const files = await apiBuilder.createAuthenticationSystem(config);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('jwt-auth.ts');
    });

    it('should create OAuth authentication files', async () => {
      const config = { type: 'oauth' as const };
      const files = await apiBuilder.createAuthenticationSystem(config);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('oauth-auth.ts');
    });

    it('should create Basic authentication files', async () => {
      const config = { type: 'basic' as const };
      const files = await apiBuilder.createAuthenticationSystem(config);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('basic-auth.ts');
    });

    it('should create API key authentication files', async () => {
      const config = { type: 'api-key' as const };
      const files = await apiBuilder.createAuthenticationSystem(config);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('api-key-auth.ts');
    });
  });

  describe('API Building', () => {
    it('should build a complete API from specification', async () => {
      const spec: APISpec = {
        name: 'Test API',
        version: '1.0.0',
        description: 'Test API description',
        baseUrl: 'http://localhost:3000',
        endpoints: [
          {
            method: 'GET',
            path: '/users',
            handler: 'listUsers',
            middleware: ['cors'],
            authentication: true,
            documentation: {
              summary: 'List users',
              description: 'Get all users',
              parameters: [],
              responses: [],
              tags: ['users']
            }
          }
        ],
        authentication: { type: 'jwt', secretKey: 'secret' },
        middleware: ['cors', 'rateLimit'],
        errorHandling: {
          globalHandler: true,
          customErrors: []
        },
        documentation: {
          openapi: true,
          swagger: true,
          outputPath: 'docs/api.json'
        }
      };

      const result = await apiBuilder.buildAPI(spec);

      expect(result.success).toBe(true);
      expect(result.filesCreated.length).toBeGreaterThan(0);
      expect(result.endpoints).toBe(1);
      expect(result.documentation).toBeDefined();
    });

    it('should handle API building errors gracefully', async () => {
      const invalidSpec = {} as APISpec;

      const result = await apiBuilder.buildAPI(invalidSpec);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Documentation Generation', () => {
    it('should generate OpenAPI documentation', async () => {
      const spec: APISpec = {
        name: 'Test API',
        version: '1.0.0',
        description: 'Test API',
        baseUrl: 'http://localhost:3000',
        endpoints: [],
        authentication: { type: 'jwt' },
        middleware: [],
        errorHandling: { globalHandler: true, customErrors: [] },
        documentation: { openapi: true, swagger: false, outputPath: 'docs/api.json' }
      };

      const docPath = await apiBuilder.generateDocumentation(spec);

      expect(docPath).toBe('docs/api.json');
    });
  });

  describe('Helper Methods', () => {
    it('should capitalize strings correctly', () => {
      const capitalize = (apiBuilder as any).capitalize;

      expect(capitalize('user')).toBe('User');
      expect(capitalize('userProfile')).toBe('UserProfile');
      expect(capitalize('API')).toBe('API');
    });

    it('should extract resource from path correctly', () => {
      const extractResource = (apiBuilder as any).extractResourceFromPath;

      expect(extractResource('/users')).toBe('users');
      expect(extractResource('/users/:id')).toBe('users');
      expect(extractResource('/api/v1/users/:id/posts')).toBe('api');
      expect(extractResource('/')).toBe('api');
    });

    it('should group endpoints by resource', () => {
      const endpoints: APIEndpoint[] = [
        {
          method: 'GET',
          path: '/users',
          handler: 'listUsers',
          middleware: [],
          authentication: false,
          documentation: { summary: '', description: '', parameters: [], responses: [], tags: [] }
        },
        {
          method: 'POST',
          path: '/users',
          handler: 'createUser',
          middleware: [],
          authentication: false,
          documentation: { summary: '', description: '', parameters: [], responses: [], tags: [] }
        },
        {
          method: 'GET',
          path: '/posts',
          handler: 'listPosts',
          middleware: [],
          authentication: false,
          documentation: { summary: '', description: '', parameters: [], responses: [], tags: [] }
        }
      ];

      const grouped = (apiBuilder as any).groupEndpointsByResource(endpoints);

      expect(grouped.size).toBe(2);
      expect(grouped.has('users')).toBe(true);
      expect(grouped.has('posts')).toBe(true);
      expect(grouped.get('users')).toHaveLength(2);
      expect(grouped.get('posts')).toHaveLength(1);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getAPIBuilder();
      const instance2 = getAPIBuilder();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton correctly', () => {
      const instance1 = getAPIBuilder();
      resetAPIBuilder();
      const instance2 = getAPIBuilder();
      expect(instance1).not.toBe(instance2);
    });
  });
});
