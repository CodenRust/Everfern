"use strict";
/**
 * EverFern Desktop — Database Integrator Subagent
 *
 * Specialized subagent for database integration including connection setup,
 * ORM model generation, migration management, and database optimization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseIntegrator = void 0;
exports.getDatabaseIntegrator = getDatabaseIntegrator;
exports.resetDatabaseIntegrator = resetDatabaseIntegrator;
/**
 * Database Integrator Subagent - Handles all database-related operations
 */
class DatabaseIntegrator {
    orm = 'typeorm';
    migrationTool = 'native';
    /**
     * Set up database connection with proper configuration
     */
    async setupDatabaseConnection(config) {
        const connectionConfig = this.generateConnectionConfig(config);
        const connectionFile = this.createConnectionFile(config, connectionConfig);
        return connectionFile;
    }
    /**
     * Create database models following ORM best practices
     */
    createDatabaseModels(models) {
        const modelFiles = [];
        for (const model of models) {
            const modelFile = this.generateModelFile(model);
            modelFiles.push(`src/models/${model.name}.ts`);
        }
        // Create index file for models
        const indexFile = this.createModelsIndexFile(models);
        modelFiles.push('src/models/index.ts');
        return modelFiles;
    }
    /**
     * Generate migration files for schema changes
     */
    generateMigrations(models, existingModels) {
        const migrations = [];
        if (!existingModels) {
            // Initial migration - create all tables
            const initialMigration = this.createInitialMigration(models);
            migrations.push(initialMigration);
        }
        else {
            // Generate diff migrations
            const diffMigrations = this.generateDiffMigrations(existingModels, models);
            migrations.push(...diffMigrations);
        }
        return migrations;
    }
    /**
     * Set up database connection pooling and error handling
     */
    createConnectionPooling(config) {
        return `
import { DataSource, DataSourceOptions } from 'typeorm';
import { Logger } from '../utils/logger';

const logger = new Logger('Database');

export const createDataSource = (config: DataSourceOptions): DataSource => {
  const dataSource = new DataSource({
    ...config,
    // Connection pooling configuration
    extra: {
      max: ${config.poolSize || 10}, // Maximum number of connections
      min: 2, // Minimum number of connections
      acquire: ${config.connectionTimeout || 30000}, // Maximum time to get connection
      idle: ${config.idleTimeout || 10000}, // Maximum time connection can be idle
      evict: 1000, // Time interval to run eviction
      handleDisconnects: true,
      reconnect: true,
      maxReconnectTries: 3,
      reconnectInterval: 1000
    },
    // Logging configuration
    logging: process.env.NODE_ENV === 'development' ? 'all' : ['error', 'warn'],
    logger: 'advanced-console',

    // Connection retry configuration
    retryAttempts: 3,
    retryDelay: 3000,

    // Enable connection validation
    validateConnection: true,

    // Connection timeout
    connectTimeout: ${config.connectionTimeout || 30000}
  });

  // Connection event handlers
  dataSource.initialize()
    .then(() => {
      logger.info('Database connection established successfully');
    })
    .catch((error) => {
      logger.error('Database connection failed:', error);
      process.exit(1);
    });

  // Handle connection errors
  dataSource.manager.connection.on('error', (error) => {
    logger.error('Database connection error:', error);
  });

  // Handle disconnection
  dataSource.manager.connection.on('disconnect', () => {
    logger.warn('Database disconnected');
  });

  // Handle reconnection
  dataSource.manager.connection.on('reconnect', () => {
    logger.info('Database reconnected');
  });

  return dataSource;
};

export const closeConnection = async (dataSource: DataSource): Promise<void> => {
  try {
    await dataSource.destroy();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
};`;
    }
    /**
     * Create seed data scripts for development and testing
     */
    createSeedScripts(models) {
        const seedFiles = [];
        for (const model of models) {
            const seedFile = this.generateSeedFile(model);
            seedFiles.push(`src/seeds/${model.name.toLowerCase()}.ts`);
        }
        // Create main seeder
        const mainSeeder = this.createMainSeeder(models);
        seedFiles.push('src/seeds/index.ts');
        return seedFiles;
    }
    /**
     * Implement proper indexing strategies for query optimization
     */
    generateIndexingStrategies(models) {
        const indexingStrategies = [];
        for (const model of models) {
            const modelIndexes = [];
            // Primary key index (automatic)
            modelIndexes.push({
                name: `pk_${model.tableName}`,
                fields: ['id'],
                type: 'btree',
                rationale: 'Primary key for unique identification and fast lookups'
            });
            // Foreign key indexes
            for (const field of model.fields) {
                if (field.references) {
                    modelIndexes.push({
                        name: `idx_${model.tableName}_${field.name}`,
                        fields: [field.name],
                        type: 'btree',
                        rationale: `Foreign key index for efficient joins with ${field.references.table}`
                    });
                }
            }
            // Unique field indexes
            for (const field of model.fields) {
                if (field.unique) {
                    modelIndexes.push({
                        name: `uniq_${model.tableName}_${field.name}`,
                        fields: [field.name],
                        type: 'btree',
                        rationale: `Unique constraint index for ${field.name}`
                    });
                }
            }
            // Search indexes for text fields
            for (const field of model.fields) {
                if (field.type === 'text' || (field.type === 'string' && field.length && field.length > 100)) {
                    modelIndexes.push({
                        name: `search_${model.tableName}_${field.name}`,
                        fields: [field.name],
                        type: 'gin',
                        rationale: `Full-text search index for ${field.name}`
                    });
                }
            }
            // Composite indexes for common query patterns
            if (model.timestamps) {
                modelIndexes.push({
                    name: `idx_${model.tableName}_created_updated`,
                    fields: ['createdAt', 'updatedAt'],
                    type: 'btree',
                    rationale: 'Composite index for date range queries and sorting'
                });
            }
            // Add custom indexes from model definition
            for (const index of model.indexes) {
                modelIndexes.push({
                    name: index.name,
                    fields: index.fields,
                    type: index.type || 'btree',
                    rationale: `Custom index for optimized queries on ${index.fields.join(', ')}`
                });
            }
            indexingStrategies.push({
                model: model.name,
                indexes: modelIndexes
            });
        }
        return indexingStrategies;
    }
    /**
     * Set up database transaction management
     */
    createTransactionManager() {
        return `
import { DataSource, QueryRunner, EntityManager } from 'typeorm';
import { Logger } from '../utils/logger';

const logger = new Logger('Transaction');

export class TransactionManager {
  constructor(private dataSource: DataSource) {}

  /**
   * Execute operations within a transaction
   */
  async executeInTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
    isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      if (isolationLevel) {
        await queryRunner.startTransaction(isolationLevel);
      } else {
        await queryRunner.startTransaction();
      }

      logger.debug('Transaction started');

      const result = await operation(queryRunner.manager);

      await queryRunner.commitTransaction();
      logger.debug('Transaction committed');

      return result;

    } catch (error) {
      logger.error('Transaction failed, rolling back:', error);
      await queryRunner.rollbackTransaction();
      throw error;

    } finally {
      await queryRunner.release();
      logger.debug('Transaction connection released');
    }
  }

  /**
   * Execute multiple operations in a single transaction
   */
  async executeBatch<T>(
    operations: Array<(manager: EntityManager) => Promise<T>>
  ): Promise<T[]> {
    return this.executeInTransaction(async (manager) => {
      const results: T[] = [];

      for (const operation of operations) {
        const result = await operation(manager);
        results.push(result);
      }

      return results;
    });
  }

  /**
   * Execute with savepoints for nested transactions
   */
  async executeWithSavepoint<T>(
    queryRunner: QueryRunner,
    savepointName: string,
    operation: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    try {
      await queryRunner.query(\`SAVEPOINT \${savepointName}\`);
      logger.debug(\`Savepoint \${savepointName} created\`);

      const result = await operation(queryRunner.manager);

      await queryRunner.query(\`RELEASE SAVEPOINT \${savepointName}\`);
      logger.debug(\`Savepoint \${savepointName} released\`);

      return result;

    } catch (error) {
      logger.error(\`Rolling back to savepoint \${savepointName}:, error\`);
      await queryRunner.query(\`ROLLBACK TO SAVEPOINT \${savepointName}\`);
      throw error;
    }
  }

  /**
   * Execute with retry logic for deadlock handling
   */
  async executeWithRetry<T>(
    operation: (manager: EntityManager) => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeInTransaction(operation);

      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable (deadlock, timeout, etc.)
        if (this.isRetryableError(error) && attempt < maxRetries) {
          logger.warn(\`Transaction attempt \${attempt} failed, retrying in \${retryDelay}ms:, error\`);
          await this.delay(retryDelay * attempt); // Exponential backoff
          continue;
        }

        throw error;
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'deadlock',
      'timeout',
      'connection',
      'lock wait timeout',
      'serialization failure'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}`;
    }
    /**
     * Optimize database queries and suggest improvements
     */
    optimizeQueries(queries) {
        const optimizations = [];
        for (const query of queries) {
            const optimization = this.analyzeAndOptimizeQuery(query);
            if (optimization) {
                optimizations.push(optimization);
            }
        }
        return optimizations;
    }
    /**
     * Build complete database integration
     */
    async buildDatabaseIntegration(config, models) {
        try {
            const filesCreated = [];
            // Create connection configuration
            const connectionFile = await this.setupDatabaseConnection(config);
            filesCreated.push(connectionFile);
            // Create model files
            const modelFiles = this.createDatabaseModels(models);
            filesCreated.push(...modelFiles);
            // Generate migrations
            const migrations = this.generateMigrations(models);
            for (const migration of migrations) {
                filesCreated.push(`src/migrations/${migration.id}_${migration.name}.ts`);
            }
            // Create connection pooling
            const poolingFile = this.createConnectionPooling(config);
            filesCreated.push('src/database/connection.ts');
            // Create transaction manager
            const transactionFile = this.createTransactionManager();
            filesCreated.push('src/database/transaction.ts');
            // Create seed scripts
            const seedFiles = this.createSeedScripts(models);
            filesCreated.push(...seedFiles);
            // Generate indexing strategies
            const indexingStrategies = this.generateIndexingStrategies(models);
            filesCreated.push('src/database/indexes.ts');
            return {
                success: true,
                filesCreated,
                modelsCreated: models.length,
                migrationsCreated: migrations.length,
                connectionFile
            };
        }
        catch (error) {
            return {
                success: false,
                filesCreated: [],
                modelsCreated: 0,
                migrationsCreated: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    // Private helper methods
    generateConnectionConfig(config) {
        switch (config.type) {
            case 'postgresql':
                return this.generatePostgreSQLConfig(config);
            case 'mysql':
                return this.generateMySQLConfig(config);
            case 'sqlite':
                return this.generateSQLiteConfig(config);
            case 'mongodb':
                return this.generateMongoDBConfig(config);
            default:
                throw new Error(`Unsupported database type: ${config.type}`);
        }
    }
    generatePostgreSQLConfig(config) {
        return `
import { DataSourceOptions } from 'typeorm';

export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || '${config.host || 'localhost'}',
  port: parseInt(process.env.DB_PORT || '${config.port || 5432}'),
  username: process.env.DB_USERNAME || '${config.username || 'postgres'}',
  password: process.env.DB_PASSWORD || '${config.password || ''}',
  database: process.env.DB_NAME || '${config.database}',
  ssl: process.env.DB_SSL === 'true' || ${config.ssl || false},
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: ['src/models/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: ['src/subscribers/**/*.ts'],
  cli: {
    entitiesDir: 'src/models',
    migrationsDir: 'src/migrations',
    subscribersDir: 'src/subscribers'
  }
};`;
    }
    generateMySQLConfig(config) {
        return `
import { DataSourceOptions } from 'typeorm';

export const databaseConfig: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || '${config.host || 'localhost'}',
  port: parseInt(process.env.DB_PORT || '${config.port || 3306}'),
  username: process.env.DB_USERNAME || '${config.username || 'root'}',
  password: process.env.DB_PASSWORD || '${config.password || ''}',
  database: process.env.DB_NAME || '${config.database}',
  ssl: process.env.DB_SSL === 'true' || ${config.ssl || false},
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: ['src/models/**/*.ts'],
  migrations: ['src/migrations/**/*.ts'],
  charset: 'utf8mb4',
  timezone: 'Z'
};`;
    }
    generateSQLiteConfig(config) {
        return `
import { DataSourceOptions } from 'typeorm';

export const databaseConfig: DataSourceOptions = {
  type: 'sqlite',
  database: process.env.DB_PATH || '${config.database}',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: ['src/models/**/*.ts'],
  migrations: ['src/migrations/**/*.ts']
};`;
    }
    generateMongoDBConfig(config) {
        return `
import { DataSourceOptions } from 'typeorm';

export const databaseConfig: DataSourceOptions = {
  type: 'mongodb',
  host: process.env.DB_HOST || '${config.host || 'localhost'}',
  port: parseInt(process.env.DB_PORT || '${config.port || 27017}'),
  username: process.env.DB_USERNAME || '${config.username || ''}',
  password: process.env.DB_PASSWORD || '${config.password || ''}',
  database: process.env.DB_NAME || '${config.database}',
  ssl: process.env.DB_SSL === 'true' || ${config.ssl || false},
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: ['src/models/**/*.ts'],
  useUnifiedTopology: true,
  useNewUrlParser: true
};`;
    }
    createConnectionFile(config, connectionConfig) {
        return 'src/database/config.ts';
    }
    generateModelFile(model) {
        // This would generate the actual TypeORM entity file
        return `src/models/${model.name}.ts`;
    }
    createModelsIndexFile(models) {
        return 'src/models/index.ts';
    }
    createInitialMigration(models) {
        return {
            id: `${Date.now()}`,
            name: 'initial_migration',
            up: this.generateCreateTablesSQL(models),
            down: this.generateDropTablesSQL(models),
            timestamp: Date.now()
        };
    }
    generateDiffMigrations(existing, updated) {
        // This would generate diff migrations by comparing existing and updated models
        return [];
    }
    generateCreateTablesSQL(models) {
        // This would generate SQL for creating tables
        return '-- Create tables SQL';
    }
    generateDropTablesSQL(models) {
        // This would generate SQL for dropping tables
        return '-- Drop tables SQL';
    }
    generateSeedFile(model) {
        return `src/seeds/${model.name.toLowerCase()}.ts`;
    }
    createMainSeeder(models) {
        return 'src/seeds/index.ts';
    }
    analyzeAndOptimizeQuery(query) {
        // Simplified query optimization analysis
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('select *')) {
            return {
                query,
                optimizedQuery: query.replace(/select \*/gi, 'SELECT specific_columns'),
                explanation: 'Avoid SELECT * to reduce data transfer and improve performance',
                indexSuggestions: ['Consider adding indexes on WHERE clause columns'],
                performanceGain: 'Up to 50% faster query execution'
            };
        }
        if (lowerQuery.includes('where') && !lowerQuery.includes('index')) {
            return {
                query,
                optimizedQuery: query,
                explanation: 'Consider adding indexes on WHERE clause columns',
                indexSuggestions: ['Add B-tree index on filtered columns'],
                performanceGain: 'Up to 90% faster query execution'
            };
        }
        return null;
    }
}
exports.DatabaseIntegrator = DatabaseIntegrator;
/**
 * Singleton instance for global access
 */
let databaseIntegratorInstance = null;
/**
 * Get or create the database integrator singleton
 */
function getDatabaseIntegrator() {
    if (!databaseIntegratorInstance) {
        databaseIntegratorInstance = new DatabaseIntegrator();
    }
    return databaseIntegratorInstance;
}
/**
 * Reset the database integrator (useful for testing)
 */
function resetDatabaseIntegrator() {
    databaseIntegratorInstance = null;
}
