/**
 * Unit tests for Database Integrator Subagent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DatabaseIntegrator,
  getDatabaseIntegrator,
  resetDatabaseIntegrator,
  DatabaseConfig,
  ModelDefinition,
  ModelField
} from '../database-integrator';

describe('DatabaseIntegrator', () => {
  let dbIntegrator: DatabaseIntegrator;

  beforeEach(() => {
    resetDatabaseIntegrator();
    dbIntegrator = getDatabaseIntegrator();
  });

  describe('Database Connection Setup', () => {
    it('should set up PostgreSQL connection', async () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      const connectionFile = await dbIntegrator.setupDatabaseConnection(config);
      expect(connectionFile).toBe('src/database/config.ts');
    });

    it('should set up MySQL connection', async () => {
      const config: DatabaseConfig = {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'root',
        password: 'password'
      };

      const connectionFile = await dbIntegrator.setupDatabaseConnection(config);
      expect(connectionFile).toBe('src/database/config.ts');
    });

    it('should set up SQLite connection', async () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        database: 'test.db'
      };

      const connectionFile = await dbIntegrator.setupDatabaseConnection(config);
      expect(connectionFile).toBe('src/database/config.ts');
    });

    it('should set up MongoDB connection', async () => {
      const config: DatabaseConfig = {
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        database: 'testdb'
      };

      const connectionFile = await dbIntegrator.setupDatabaseConnection(config);
      expect(connectionFile).toBe('src/database/config.ts');
    });
  });

  describe('Model Creation', () => {
    it('should create database models', () => {
      const models: ModelDefinition[] = [
        {
          name: 'User',
          tableName: 'users',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'email', type: 'string', required: true, unique: true, length: 255 },
            { name: 'name', type: 'string', required: true, length: 100 },
            { name: 'age', type: 'number', required: false }
          ],
          indexes: [
            { name: 'idx_user_email', fields: ['email'], unique: true }
          ],
          relationships: [],
          timestamps: true,
          softDelete: false
        },
        {
          name: 'Post',
          tableName: 'posts',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'title', type: 'string', required: true, length: 200 },
            { name: 'content', type: 'text', required: true },
            { name: 'userId', type: 'uuid', required: true, references: { table: 'users', field: 'id' } }
          ],
          indexes: [],
          relationships: [
            { type: 'belongsTo', model: 'User', foreignKey: 'userId' }
          ],
          timestamps: true,
          softDelete: true
        }
      ];

      const modelFiles = dbIntegrator.createDatabaseModels(models);

      expect(modelFiles).toHaveLength(3); // 2 models + index file
      expect(modelFiles).toContain('src/models/User.ts');
      expect(modelFiles).toContain('src/models/Post.ts');
      expect(modelFiles).toContain('src/models/index.ts');
    });

    it('should handle models with relationships', () => {
      const models: ModelDefinition[] = [
        {
          name: 'Category',
          tableName: 'categories',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'name', type: 'string', required: true, length: 100 }
          ],
          indexes: [],
          relationships: [
            { type: 'hasMany', model: 'Product' }
          ],
          timestamps: true,
          softDelete: false
        }
      ];

      const modelFiles = dbIntegrator.createDatabaseModels(models);
      expect(modelFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Migration Generation', () => {
    it('should generate initial migration for new models', () => {
      const models: ModelDefinition[] = [
        {
          name: 'User',
          tableName: 'users',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'email', type: 'string', required: true, unique: true }
          ],
          indexes: [],
          relationships: [],
          timestamps: true,
          softDelete: false
        }
      ];

      const migrations = dbIntegrator.generateMigrations(models);

      expect(migrations).toHaveLength(1);
      expect(migrations[0].name).toBe('initial_migration');
      expect(migrations[0].up).toContain('Create tables');
      expect(migrations[0].down).toContain('Drop tables');
    });

    it('should generate diff migrations for model changes', () => {
      const existingModels: ModelDefinition[] = [
        {
          name: 'User',
          tableName: 'users',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'email', type: 'string', required: true, unique: true }
          ],
          indexes: [],
          relationships: [],
          timestamps: true,
          softDelete: false
        }
      ];

      const updatedModels: ModelDefinition[] = [
        {
          name: 'User',
          tableName: 'users',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'email', type: 'string', required: true, unique: true },
            { name: 'name', type: 'string', required: true, length: 100 } // New field
          ],
          indexes: [],
          relationships: [],
          timestamps: true,
          softDelete: false
        }
      ];

      const migrations = dbIntegrator.generateMigrations(updatedModels, existingModels);
      expect(Array.isArray(migrations)).toBe(true);
    });
  });

  describe('Connection Pooling', () => {
    it('should create connection pooling configuration', () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        database: 'testdb',
        poolSize: 20,
        connectionTimeout: 30000,
        idleTimeout: 10000
      };

      const poolingConfig = dbIntegrator.createConnectionPooling(config);

      expect(poolingConfig).toContain('DataSource');
      expect(poolingConfig).toContain('max: 20');
      expect(poolingConfig).toContain('acquire: 30000');
      expect(poolingConfig).toContain('idle: 10000');
      expect(poolingConfig).toContain('handleDisconnects: true');
      expect(poolingConfig).toContain('reconnect: true');
    });

    it('should use default values when not specified', () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        database: 'testdb'
      };

      const poolingConfig = dbIntegrator.createConnectionPooling(config);

      expect(poolingConfig).toContain('max: 10'); // default poolSize
      expect(poolingConfig).toContain('acquire: 30000'); // default connectionTimeout
      expect(poolingConfig).toContain('idle: 10000'); // default idleTimeout
    });
  });

  describe('Seed Scripts', () => {
    it('should create seed scripts for models', () => {
      const models: ModelDefinition[] = [
        {
          name: 'User',
          tableName: 'users',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'email', type: 'string', required: true, unique: true }
          ],
          indexes: [],
          relationships: [],
          timestamps: true,
          softDelete: false
        },
        {
          name: 'Post',
          tableName: 'posts',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'title', type: 'string', required: true }
          ],
          indexes: [],
          relationships: [],
          timestamps: true,
          softDelete: false
        }
      ];

      const seedFiles = dbIntegrator.createSeedScripts(models);

      expect(seedFiles).toHaveLength(3); // 2 model seeds + main seeder
      expect(seedFiles).toContain('src/seeds/user.ts');
      expect(seedFiles).toContain('src/seeds/post.ts');
      expect(seedFiles).toContain('src/seeds/index.ts');
    });
  });

  describe('Indexing Strategies', () => {
    it('should generate comprehensive indexing strategies', () => {
      const models: ModelDefinition[] = [
        {
          name: 'User',
          tableName: 'users',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'email', type: 'string', required: true, unique: true },
            { name: 'bio', type: 'text', required: false },
            { name: 'categoryId', type: 'uuid', required: false, references: { table: 'categories', field: 'id' } }
          ],
          indexes: [
            { name: 'custom_idx', fields: ['email', 'categoryId'] }
          ],
          relationships: [],
          timestamps: true,
          softDelete: false
        }
      ];

      const strategies = dbIntegrator.generateIndexingStrategies(models);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].model).toBe('User');

      const userIndexes = strategies[0].indexes;

      // Should have primary key index
      const pkIndex = userIndexes.find(idx => idx.name === 'pk_users');
      expect(pkIndex).toBeDefined();
      expect(pkIndex?.fields).toContain('id');

      // Should have unique field index
      const uniqueIndex = userIndexes.find(idx => idx.name === 'uniq_users_email');
      expect(uniqueIndex).toBeDefined();
      expect(uniqueIndex?.fields).toContain('email');

      // Should have foreign key index
      const fkIndex = userIndexes.find(idx => idx.name === 'idx_users_categoryId');
      expect(fkIndex).toBeDefined();
      expect(fkIndex?.fields).toContain('categoryId');

      // Should have text search index
      const searchIndex = userIndexes.find(idx => idx.name === 'search_users_bio');
      expect(searchIndex).toBeDefined();
      expect(searchIndex?.type).toBe('gin');

      // Should have timestamp index
      const timestampIndex = userIndexes.find(idx => idx.name === 'idx_users_created_updated');
      expect(timestampIndex).toBeDefined();
      expect(timestampIndex?.fields).toContain('createdAt');
      expect(timestampIndex?.fields).toContain('updatedAt');

      // Should have custom index
      const customIndex = userIndexes.find(idx => idx.name === 'custom_idx');
      expect(customIndex).toBeDefined();
      expect(customIndex?.fields).toContain('email');
      expect(customIndex?.fields).toContain('categoryId');
    });
  });

  describe('Transaction Manager', () => {
    it('should create transaction manager', () => {
      const transactionManager = dbIntegrator.createTransactionManager();

      expect(transactionManager).toContain('TransactionManager');
      expect(transactionManager).toContain('executeInTransaction');
      expect(transactionManager).toContain('executeBatch');
      expect(transactionManager).toContain('executeWithSavepoint');
      expect(transactionManager).toContain('executeWithRetry');
      expect(transactionManager).toContain('startTransaction');
      expect(transactionManager).toContain('commitTransaction');
      expect(transactionManager).toContain('rollbackTransaction');
    });

    it('should include error handling and retry logic', () => {
      const transactionManager = dbIntegrator.createTransactionManager();

      expect(transactionManager).toContain('isRetryableError');
      expect(transactionManager).toContain('deadlock');
      expect(transactionManager).toContain('timeout');
      expect(transactionManager).toContain('maxRetries');
      expect(transactionManager).toContain('retryDelay');
    });

    it('should include savepoint support', () => {
      const transactionManager = dbIntegrator.createTransactionManager();

      expect(transactionManager).toContain('SAVEPOINT');
      expect(transactionManager).toContain('RELEASE SAVEPOINT');
      expect(transactionManager).toContain('ROLLBACK TO SAVEPOINT');
    });
  });

  describe('Query Optimization', () => {
    it('should optimize SELECT * queries', () => {
      const queries = ['SELECT * FROM users WHERE id = 1'];
      const optimizations = dbIntegrator.optimizeQueries(queries);

      expect(optimizations).toHaveLength(1);
      expect(optimizations[0].optimizedQuery).toContain('SELECT specific_columns');
      expect(optimizations[0].explanation).toContain('SELECT *');
      expect(optimizations[0].performanceGain).toContain('50%');
    });

    it('should suggest indexes for WHERE clauses', () => {
      const queries = ['SELECT name FROM users WHERE email = ?'];
      const optimizations = dbIntegrator.optimizeQueries(queries);

      expect(optimizations).toHaveLength(1);
      expect(optimizations[0].indexSuggestions).toContain('Add B-tree index on filtered columns');
      expect(optimizations[0].performanceGain).toContain('90%');
    });

    it('should return empty array for already optimized queries', () => {
      const queries = ['SELECT id, name FROM users WHERE id = 1 AND INDEX(idx_id)'];
      const optimizations = dbIntegrator.optimizeQueries(queries);

      expect(optimizations).toHaveLength(0);
    });
  });

  describe('Database Integration Build', () => {
    it('should build complete database integration', async () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        database: 'testdb',
        username: 'testuser',
        password: 'testpass'
      };

      const models: ModelDefinition[] = [
        {
          name: 'User',
          tableName: 'users',
          fields: [
            { name: 'id', type: 'uuid', required: true, unique: true },
            { name: 'email', type: 'string', required: true, unique: true }
          ],
          indexes: [],
          relationships: [],
          timestamps: true,
          softDelete: false
        }
      ];

      const result = await dbIntegrator.buildDatabaseIntegration(config, models);

      expect(result.success).toBe(true);
      expect(result.filesCreated.length).toBeGreaterThan(0);
      expect(result.modelsCreated).toBe(1);
      expect(result.migrationsCreated).toBe(1);
      expect(result.connectionFile).toBeDefined();
    });

    it('should handle build errors gracefully', async () => {
      const invalidConfig = {} as DatabaseConfig;
      const models: ModelDefinition[] = [];

      const result = await dbIntegrator.buildDatabaseIntegration(invalidConfig, models);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Generation', () => {
    it('should generate PostgreSQL configuration', () => {
      const config: DatabaseConfig = {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        ssl: true
      };

      const configString = (dbIntegrator as any).generatePostgreSQLConfig(config);

      expect(configString).toContain("type: 'postgres'");
      expect(configString).toContain('localhost');
      expect(configString).toContain('5432');
      expect(configString).toContain('testdb');
      expect(configString).toContain('testuser');
      expect(configString).toContain('true'); // SSL
    });

    it('should generate MySQL configuration', () => {
      const config: DatabaseConfig = {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'testdb',
        username: 'root',
        password: 'password'
      };

      const configString = (dbIntegrator as any).generateMySQLConfig(config);

      expect(configString).toContain("type: 'mysql'");
      expect(configString).toContain('3306');
      expect(configString).toContain('charset');
      expect(configString).toContain('timezone');
    });

    it('should generate SQLite configuration', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        database: 'test.db'
      };

      const configString = (dbIntegrator as any).generateSQLiteConfig(config);

      expect(configString).toContain("type: 'sqlite'");
      expect(configString).toContain('test.db');
    });

    it('should generate MongoDB configuration', () => {
      const config: DatabaseConfig = {
        type: 'mongodb',
        host: 'localhost',
        port: 27017,
        database: 'testdb'
      };

      const configString = (dbIntegrator as any).generateMongoDBConfig(config);

      expect(configString).toContain("type: 'mongodb'");
      expect(configString).toContain('27017');
      expect(configString).toContain('useUnifiedTopology');
      expect(configString).toContain('useNewUrlParser');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getDatabaseIntegrator();
      const instance2 = getDatabaseIntegrator();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton correctly', () => {
      const instance1 = getDatabaseIntegrator();
      resetDatabaseIntegrator();
      const instance2 = getDatabaseIntegrator();
      expect(instance1).not.toBe(instance2);
    });
  });
});
