# FSArch Configuration Module

The FSArch Configuration Module provides a flexible way to manage and validate application configuration in NestJS applications. It integrates with `@nestjs/config` and adds support for custom configuration sections with Joi validation.

## Overview

FSArch offers two ways to handle configuration:

1. **Global Configuration** - Automatically loaded from `config.yaml` (or file specified in `CONFIG_FILE_PATH` env var)
2. **Module Configuration** - Custom configuration sections with validation schemas

## Table of Contents

- [Global Configuration](#global-configuration)
- [Module Configuration](#module-configuration)
  - [Basic Usage](#basic-usage)
  - [With Validation Schema](#with-validation-schema)
  - [Using in Services](#using-in-services)
- [Configuration Types](#configuration-types)
- [Environment Variables](#environment-variables)
- [Examples](#examples)
  - [Database Configuration](#database-configuration)
  - [Storage Configuration](#storage-configuration)
  - [Custom Module Configuration](#custom-module-configuration)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)

## Global Configuration

The global configuration is automatically loaded by the `ConfigurationModule` and made available through NestJS's `ConfigService`.

### File Location

By default, FSArch looks for `config.yaml` in the current working directory. You can specify a different file path using the `CONFIG_FILE_PATH` environment variable:

```bash
CONFIG_FILE_PATH=./config/my-config.yml node dist/main
```

### File Format

The configuration file is a YAML file with the following structure:

```yaml
auth:
  type: jwt-jwk
  jwkUrl: https://example.com/.well-known/jwks.json

uac:
  type: static
  users:
    - user_id: user1
      permissions:
        - manage_claims

database:
  type: postgres
  host: localhost
  port: 5432
  database: mydb
  username: admin
  password: secret
```

### Type Definitions

See [ConfigType](#configuration-types) for the complete type definitions.

## Module Configuration

For custom configuration sections that are not part of the core FSArch types, use the `ModuleConfiguration` class.

### Basic Usage

```typescript
import { ModuleConfiguration } from '@fsarch/server/configuration';
import { Module } from '@nestjs/common';

// Define a token for your configuration
const MY_CONFIG_TOKEN = Symbol('MY_CONFIG');

// Register the configuration module
@Module({
  imports: [
    ModuleConfiguration.register(MY_CONFIG_TOKEN, {
      name: 'myConfig',  // Path in the config file (e.g., config.myConfig)
    }),
  ],
  exports: [MY_CONFIG_TOKEN],
})
export class MyConfigModule {}
```

### With Validation Schema

Use Joi to validate your configuration:

```typescript
import { ModuleConfiguration } from '@fsarch/server/configuration';
import Joi from 'joi';
import { Module } from '@nestjs/common';

const MY_CONFIG_TOKEN = Symbol('MY_CONFIG');

const MY_CONFIG_SCHEMA = Joi.object({
  apiUrl: Joi.string().uri().required(),
  timeout: Joi.number().default(5000),
  retries: Joi.number().min(0).max(5).default(3),
});

@Module({
  imports: [
    ModuleConfiguration.register(MY_CONFIG_TOKEN, {
      name: 'myService',
      validationSchema: MY_CONFIG_SCHEMA,
    }),
  ],
  exports: [MY_CONFIG_TOKEN],
})
export class MyConfigModule {}
```

### Using in Services

Inject `ModuleConfigurationService` to access your configuration:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ModuleConfigurationService } from '@fsarch/server/configuration';
import { MY_CONFIG_TOKEN } from './my-config.module';

interface MyConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}

@Injectable()
export class MyService {
  constructor(
    @Inject(MY_CONFIG_TOKEN)
    private configService: ModuleConfigurationService<MyConfig>,
  ) {}

  getConfig(): MyConfig {
    return this.configService.get();
  }

  getApiUrl(): string {
    return this.configService.get('apiUrl');
  }
}
```

## Configuration Types

### Core Configuration Types

The global configuration includes the following sections:

#### Auth Configuration

```typescript
type ConfigAuthType = 
  | ConfigStaticAuthType
  | ConfigJwtJwkAuthType
  | ConfigOidcAuthType;

interface ConfigStaticAuthType {
  type: 'static';
  secret: string;
  users: Array<{
    id: string;
    username: string;
    password: string;
  }>;
}

interface ConfigJwtJwkAuthType {
  type: 'jwt-jwk';
  jwkUrl: string;
}

interface ConfigOidcAuthType {
  type: 'oidc';
  discovery_url: string;
}
```

#### UAC Configuration

```typescript
interface ConfigStaticUacType {
  type: 'static';
  users: Array<{
    user_id: string;
    permissions: Array<string>;
  }>;
}
```

#### Database Configuration

```typescript
type ConfigDatabaseType = 
  | ConfigSqliteDatabaseType
  | ConfigCockroachdbDatabaseType;

interface ConfigSqliteDatabaseType {
  type: 'sqlite';
  database: string;
}

interface ConfigCockroachdbDatabaseType {
  type: 'cockroachdb' | 'postgres';
  host: string;
  username: string;
  password?: string;
  database: string;
  port?: number;
  ssl?: {
    rejectUnauthorized?: boolean;
    ca?: string | { path: string };
    cert?: string | { path: string };
    key?: string | { path: string };
  };
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CONFIG_FILE_PATH` | Path to the configuration file | `config.yaml` |

## Examples

### Database Configuration

```typescript
// database-configuration.module.ts
import { ModuleConfiguration } from '@fsarch/server/configuration';
import Joi from 'joi';
import { Module } from '@nestjs/common';

export const DATABASE_CONFIG_TOKEN = Symbol('DATABASE_CONFIG');

const DATABASE_SCHEMA = Joi.object({
  host: Joi.string().required(),
  port: Joi.number().default(5432),
  username: Joi.string().required(),
  password: Joi.string().required(),
  database: Joi.string().required(),
});

@Module({
  imports: [
    ModuleConfiguration.register(DATABASE_CONFIG_TOKEN, {
      name: 'database',
      validationSchema: DATABASE_SCHEMA,
    }),
  ],
  exports: [DATABASE_CONFIG_TOKEN],
})
export class DatabaseConfigurationModule {}
```

### Storage Configuration

```typescript
// storage-configuration.module.ts
import { ModuleConfiguration } from '@fsarch/server/configuration';
import Joi from 'joi';
import { Module } from '@nestjs/common';

export const STORAGE_CONFIG_TOKEN = Symbol('STORAGE_CONFIG');

// Schema for storage.data configuration
const STORAGE_DATA_SCHEMA = Joi.alternatives().try(
  Joi.string(), // Legacy: just a path string
  Joi.object({
    type: Joi.string().valid('filesystem').required(),
    config: Joi.object({
      path: Joi.string().required(),
    }).required(),
  }),
  Joi.object({
    type: Joi.string().valid('s3').required(),
    config: Joi.object({
      bucket: Joi.string().required(),
      region: Joi.string().required(),
      accessKeyId: Joi.string().optional(),
      secretAccessKey: Joi.string().optional(),
      endpoint: Joi.string().optional(),
      prefix: Joi.string().optional(),
    }).required(),
  }),
);

@Module({
  imports: [
    ModuleConfiguration.register(STORAGE_CONFIG_TOKEN, {
      name: 'storage.data',
      validationSchema: STORAGE_DATA_SCHEMA,
    }),
  ],
  exports: [STORAGE_CONFIG_TOKEN],
})
export class StorageConfigurationModule {}
```

Then in your service:

```typescript
// storage.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ModuleConfigurationService } from '@fsarch/server/configuration';
import { STORAGE_CONFIG_TOKEN } from './storage-configuration.module';

type StorageConfig = 
  | string
  | { type: 'filesystem'; config: { path: string } }
  | { type: 's3'; config: { bucket: string; region: string; accessKeyId?: string; secretAccessKey?: string; endpoint?: string; prefix?: string } };

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_CONFIG_TOKEN)
    private configService: ModuleConfigurationService<StorageConfig>,
  ) {}

  getStorageConfig(): StorageConfig {
    return this.configService.get();
  }
}
```

### Custom Module Configuration

```typescript
// my-feature.module.ts
import { Module } from '@nestjs/common';
import { ModuleConfiguration } from '@fsarch/server/configuration';
import Joi from 'joi';

const FEATURE_CONFIG_TOKEN = Symbol('FEATURE_CONFIG');

const FEATURE_SCHEMA = Joi.object({
  enabled: Joi.boolean().default(true),
  maxItems: Joi.number().min(1).max(100).default(10),
  apiKey: Joi.string().optional(),
});

@Module({
  imports: [
    ModuleConfiguration.register(FEATURE_CONFIG_TOKEN, {
      name: 'feature',
      validationSchema: FEATURE_SCHEMA,
    }),
  ],
  providers: [
    {
      provide: 'FEATURE_SERVICE',
      useFactory: (configService: ModuleConfigurationService<any>) => {
        const config = configService.get();
        return new MyFeatureService(config);
      },
      inject: [FEATURE_CONFIG_TOKEN],
    },
  ],
  exports: ['FEATURE_SERVICE', FEATURE_CONFIG_TOKEN],
})
export class FeatureModule {}
```

## Best Practices

### 1. Use Symbols for Tokens

Always use `Symbol()` for configuration tokens to avoid naming collisions:

```typescript
// Good
export const CONFIG_TOKEN = Symbol('CONFIG_TOKEN');

// Bad (can cause collisions)
export const CONFIG_TOKEN = 'CONFIG_TOKEN';
```

### 2. Validate with Joi

Always provide a validation schema to catch configuration errors early:

```typescript
// Good
ModuleConfiguration.register(MY_TOKEN, {
  name: 'myConfig',
  validationSchema: MY_SCHEMA, // Always include validation
});

// Bad (no validation)
ModuleConfiguration.register(MY_TOKEN, {
  name: 'myConfig',
});
```

### 3. Use Conditional Joi Schemas

For configurations with different types (like filesystem vs S3), use `Joi.alternatives().conditional()`:

```typescript
const STORAGE_SCHEMA = Joi.alternatives().conditional('type', {
  is: 'filesystem',
  then: Joi.object({
    type: Joi.string().valid('filesystem').required(),
    config: Joi.object({ path: Joi.string().required() }),
  }),
  is: 's3',
  then: Joi.object({
    type: Joi.string().valid('s3').required(),
    config: Joi.object({ bucket: Joi.string().required(), region: Joi.string().required() }),
  }),
});
```

### 4. Export Configuration Modules

Export your configuration modules so they can be imported by other modules:

```typescript
@Module({
  imports: [ModuleConfiguration.register(MY_TOKEN, {...})],
  exports: [MY_TOKEN], // Export the token
})
export class MyConfigModule {}
```

### 5. Use TypeScript Interfaces

Define TypeScript interfaces for your configuration to enable type checking:

```typescript
interface MyConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}

// In your service
@Injectable()
export class MyService {
  constructor(
    @Inject(MY_TOKEN)
    private config: ModuleConfigurationService<MyConfig>, // Type-safe
  ) {}
}
```

## Migration Guide

### From Manual Configuration Loading

**Before:**
```typescript
// configuration.ts
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';

export default () => {
  const config = yaml.load(readFileSync('config.yaml', 'utf8'));
  return config;
};

// In app.module.ts
ConfigModule.forRoot({ load: [configuration] })
```

**After:**
```typescript
// Use ModuleConfiguration instead
ModuleConfiguration.register(MY_TOKEN, {
  name: 'mySection',
  validationSchema: MY_SCHEMA,
});

// In your module
@Module({
  imports: [ModuleConfiguration.register(MY_TOKEN, {...})],
  exports: [MY_TOKEN],
})
```

### From NestJS ConfigService

If you're currently using `ConfigService.get('mySection')`, you can replace it with `ModuleConfigurationService`:

**Before:**
```typescript
constructor(private configService: ConfigService) {}

getConfig() {
  return this.configService.get('mySection');
}
```

**After:**
```typescript
constructor(
  @Inject(MY_TOKEN)
  private configService: ModuleConfigurationService<MyConfig>
) {}

getConfig() {
  return this.configService.get();
}
```

## API Reference

### ModuleConfiguration

#### `static register(token, options)`

Registers a configuration section with optional validation.

**Parameters:**
- `token` (string | symbol): A unique identifier for the configuration
- `options` (object): Configuration options
  - `name` (string): The path in the configuration file (e.g., 'storage.data')
  - `validationSchema` (Joi.Schema, optional): Joi validation schema

**Returns:** DynamicModule that can be imported into other modules

### ModuleConfigurationService<T>

Service for accessing configuration values with type safety.

**Type Parameter:** `T extends Record<string, any>` - The configuration type

**Methods:**
- `get()`: Returns the full configuration object
- `get<K extends keyof T>(key: K)`: Returns a specific configuration value

**Example:**
```typescript
interface MyConfig {
  apiUrl: string;
  timeout: number;
}

@Injectable()
class MyService {
  constructor(
    @Inject(MY_TOKEN)
    private config: ModuleConfigurationService<MyConfig>
  ) {}

  useConfig() {
    const fullConfig = this.config.get(); // MyConfig
    const apiUrl = this.config.get('apiUrl'); // string
  }
}
```

## Support

For issues or questions, please refer to the main FSArch documentation or create an issue in the repository.
