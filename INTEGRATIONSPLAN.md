# Integrationsplan: Microservice mit @fsarch/server aufbauen

## Ziel

Dieser Plan dient als **Schritt-für-Schritt-Anleitung für eine KI (oder Entwickler)**, um einen neuen Microservice basierend auf der `@fsarch/server`-Bibliothek zu erstellen. Der Plan beschreibt die vollständige Architektur, Dateistruktur, Konventionen und Implementierungsschritte.

---

## 📁 Projektstruktur

**Wichtig: Tests liegen IMMER neben den zu testenden Dateien (Co-Location Pattern)**

```
my-microservice/
├── src/
│   ├── main.ts                          # Application Entry Point
│   ├── app.module.ts                    # Root NestJS Module
│   ├── app.module.spec.ts               # ⭐ Tests hier!
│   │
│   ├── database/
│   │   ├── index.ts                     # DATABASE_OPTIONS Export
│   │   ├── index.spec.ts                # ⭐ Database Config Tests
│   │   ├── entities/                    # TypeORM Entities
│   │   │   ├── user.entity.ts
│   │   │   └── user.entity.spec.ts      # ⭐ Entity Tests
│   │   └── migrations/                   # TypeORM Migrations
│   │       └── *.ts
│   │
│   ├── controllers/
│   │   ├── controllers.module.ts        # Aggregiert alle Controller
│   │   ├── controllers.module.spec.ts   # ⭐ Tests
│   │   └── user/
│   │       ├── user.module.ts
│   │       ├── user.module.spec.ts       # ⭐ Tests
│   │       ├── user.controller.ts
│   │       ├── user.controller.spec.ts  # ⭐ Controller Tests
│   │       ├── user.service.ts
│   │       └── user.service.spec.ts     # ⭐ Service Tests
│   │
│   ├── models/
│   │   └── user/
│   │       ├── CreateUserDto.ts
│   │       ├── CreateUserDto.spec.ts     # ⭐ DTO Tests
│   │       ├── UserDto.ts
│   │       └── UserDto.spec.ts           # ⭐ DTO Tests
│   │
│   ├── constants/
│   │   ├── role.enum.ts                 # Rollen/Permissions
│   │   └── role.enum.spec.ts            # ⭐ Enum Tests
│   │
│   └── config/
│       ├── validation.ts
│       └── validation.spec.ts           # ⭐ Validation Tests
│
├── config/
│   └── config.yml                       # Hauptkonfiguration (Auth, UAC, DB)
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
└── .prettierrc
```

**Begründung für Co-Location:**
- ✅ Bessere Lesbarkeit und Wartbarkeit
- ✅ Tests sind direkt mit dem Code verknüpft
- ✅ Änderungen am Code erfordern sofort sichtbare Test-Anpassungen
- ✅ Co-Location Pattern für bessere Wartbarkeit

---

## 🚀 Phase 1: Projektinitialisierung

### 1.1 package.json

```json
{
  "name": "my-microservice",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "build": "fsarch-server build",
    "start": "fsarch-server start",
    "start:dev": "ts-node src/main.ts",
    "start:prod": "node dist/main.js",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "typeorm": "node --loader ts-node/esm ./node_modules/typeorm/cli.js",
    "migration:create": "npm run typeorm migration:create ./src/database/migrations/$npm_config_name",
    "migration:run": "npm run typeorm migration:run",
    "migration:revert": "npm run typeorm migration:revert",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@fsarch/server": "^0.1.0",
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/swagger": "^11.0.0",
    "@nestjs/typeorm": "^11.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "pg": "^8.22.0",
    "reflect-metadata": "^0.2.0",
    "typeorm": "^1.1.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/node": "^24.0.0",
    "@vitest/coverage-v8": "^4.0.0",
    "eslint": "^10.0.0",
    "prettier": "^3.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3",
    "vitest": "^4.0.0"
  }
}
```

### 1.2 TypeScript Konfiguration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## ⚙️ Phase 2: Konfiguration

### 2.1 config.yml

**Pfad:** `/config/config.yml`

```yaml
# =============================================================================
# AUTHENTIFIZIERUNG
# Wähle einen Auth-Typ: static, jwt-jwk, oidc
# =============================================================================
auth:
  type: oidc
  discovery_url: https://issuer.example/.well-known/openid-configuration
  
  # Alternativ: JWT-JWK
  # type: jwt-jwk
  # jwk_url: https://issuer.example/.well-known/jwks.json
  
  # Alternativ: Static Token (für Entwicklung)
  # type: static
  # token: "my-secret-token"

# =============================================================================
# USER ACCESS CONTROL (UAC) - Berechtigungen
# =============================================================================
uac:
  type: static
  users:
    # Admin mit allen Rechten
    - user_id: "admin"
      permissions:
        - "*"
    # Standard Nutzer
    - user_id: "user-1"
      permissions:
        - read_user
        - write_user
        - read_product

# =============================================================================
# DATENBANK
# Unterstützte Typen: sqlite, postgres, cockroachdb
# =============================================================================
database:
  type: postgres
  host: localhost
  port: 5432
  username: dev
  password: secret
  database: my_microservice
  
  # SSL Konfiguration (optional für PostgreSQL)
  ssl:
    rejectUnauthorized: false
  
  # Alternativ: SQLite (für Entwicklung)
  # type: sqlite
  # database: ./data/database.sqlite3

# =============================================================================
# SOFT DELETION (optional)
# =============================================================================
# deletion:
#   enabled: true
#   cron_expression: "0 0 * * *"
```

---

## 🗃️ Phase 3: Datenbank Layer

### 3.1 DATABASE_OPTIONS definieren

**Pfad:** `/src/database/index.ts`

```typescript
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { MigrationClass } from 'typeorm';

// Importiere alle Entities
import { User } from './entities/user.entity.js';
import { Product } from './entities/product.entity.js';

// Importiere alle Migrations
import { InitialMigration1700000000000 } from './migrations/1700000000000-initial-migration.js';

export const DATABASE_OPTIONS = {
  entities: [User, Product] as EntityClassOrSchema[],
  migrations: [InitialMigration1700000000000] as MigrationClass[],
  // ACHTUNG: synchronize nur in Entwicklung nutzen!
  synchronize: process.env.NODE_ENV === 'development',
};
```

### 3.2 Entity Template

**Pfad:** `/src/database/entities/<entity-name>.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({
  name: '<table_name>',  // snake_case, Plural (z.B. "users")
})
export class <EntityName> {  // PascalCase, Singular (z.B. "User")
  
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk__<table_name>',
  })
  id: string;

  @Column({
    length: 255,
    nullable: false,
  })
  @Index()
  name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @UpdateDateColumn({
    name: 'update_time',
    nullable: true,
  })
  updateTime?: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
    nullable: true,
  })
  deletionTime?: Date;
}
```

### 3.3 Migration erstellen und ausführen

**Migration erstellen:**
```bash
npx typeorm migration:create ./src/database/migrations/1700000000000-initial-tables
```

**Migration Template:**
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1700000000000 implements MigrationInterface {
  name = 'InitialMigration1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL UNIQUE,
        "creation_time" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "update_time" TIMESTAMP WITH TIME ZONE,
        "deletion_time" TIMESTAMP WITH TIME ZONE
      );
      
      CREATE INDEX "idx_users_email" ON "users" ("email");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

**Migration ausführen:**
```bash
npm run migration:run
```

---

## 🏗️ Phase 4: Business Layer

### 4.1 Role Enum

**Pfad:** `/src/constants/role.enum.ts`

```typescript
/**
 * Definiert alle verfügbaren Berechtigungen für den Microservice.
 * Konvention:
 * - read_<resource>    : Lesen von <resource>
 * - write_<resource>   : Schreiben von <resource>
 * - create_<resource>  : Erstellen von <resource>
 * - delete_<resource>  : Löschen von <resource>
 * - manage_<resource>  : Volle Kontrolle über <resource>
 */
export enum Role {
  // User Ressource
  read_user = 'read_user',
  write_user = 'write_user',
  create_user = 'create_user',
  delete_user = 'delete_user',
  manage_user = 'manage_user',

  // Product Ressource
  read_product = 'read_product',
  write_product = 'write_product',
  create_product = 'create_product',
  delete_product = 'delete_product',
  manage_product = 'manage_product',

  // Wildcard für Admins
  all = '*',
}
```

### 4.2 DTOs (Data Transfer Objects)

**CreateUserDto.ts:**
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MaxLength, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Name des Benutzers',
    example: 'Max Mustermann',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'E-Mail Adresse',
    example: 'max@example.com',
    maxLength: 255,
  })
  @IsEmail()
  @IsString()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Beschreibung',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
```

**UserDto.ts:**
```typescript
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    description: 'Einzigartige ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Name' })
  name: string;

  @ApiProperty({ description: 'E-Mail' })
  email: string;

  @ApiProperty({ description: 'Beschreibung', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Erstellungszeitpunkt' })
  creationTime: Date;

  @ApiProperty({ description: 'Letzte Aktualisierung', nullable: true })
  updateTime: Date | null;

  @ApiProperty({ description: 'Löschzeitpunkt', nullable: true })
  deletionTime: Date | null;
}
```

### 4.3 Service

**Pfad:** `/src/controllers/user/user.service.ts`

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { User } from '../../database/entities/user.entity.js';
import { CreateUserDto } from '../../models/user/CreateUserDto.js';
import { UserDto } from '../../models/user/UserDto.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createDto: CreateUserDto): Promise<UserDto> {
    const existing = await this.userRepository.findOne({
      where: { email: createDto.email } as FindOptionsWhere<User>,
    });
    
    if (existing) {
      throw new ConflictException(`User with email '${createDto.email}' already exists`);
    }

    const user = this.userRepository.create(createDto);
    const saved = await this.userRepository.save(user);
    return this.mapToDto(saved);
  }

  async findAllPaginated(page: number = 1, pageSize: number = 25): Promise<[UserDto[], number]> {
    const skip = (page - 1) * pageSize;
    const [users, total] = await this.userRepository.findAndCount({
      skip,
      take: pageSize,
    });
    return [users.map(this.mapToDto), total];
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.userRepository.findOne({
      where: { id } as FindOptionsWhere<User>,
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }
    
    return this.mapToDto(user);
  }

  async update(id: string, updateDto: Partial<CreateUserDto>): Promise<UserDto> {
    await this.userRepository.update(id, updateDto);
    const updated = await this.userRepository.findOne({
      where: { id } as FindOptionsWhere<User>,
    });
    
    if (!updated) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }
    
    return this.mapToDto(updated);
  }

  async remove(id: string): Promise<void> {
    const result = await this.userRepository.softDelete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }
  }

  private mapToDto(user: User): UserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      description: user.description ?? null,
      creationTime: user.creationTime,
      updateTime: user.updateTime ?? null,
      deletionTime: user.deletionTime ?? null,
    };
  }
}
```

### 4.4 Controller

**Pfad:** `/src/controllers/user/user.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@fsarch/server/auth';
import { Roles } from '@fsarch/server/uac';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiOkPaginatedResponse, PaginationResultDto } from '@fsarch/server/pagination';
import { UserService } from './user.service.js';
import { CreateUserDto } from '../../models/user/CreateUserDto.js';
import { UserDto } from '../../models/user/UserDto.js';
import { Role } from '../../constants/role.enum.js';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.create_user)
  @ApiOperation({ summary: 'Erstellt einen neuen Benutzer' })
  @ApiResponse({ status: 201, description: 'Benutzer erstellt' })
  @ApiResponse({ status: 409, description: 'E-Mail existiert bereits' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateUserDto): Promise<UserDto> {
    return this.userService.create(createDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.read_user)
  @ApiOperation({ summary: 'Liste aller Benutzer (paginiert)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 25 })
  @ApiOkPaginatedResponse(UserDto)
  async findAll(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 25,
  ): Promise<PaginationResultDto<UserDto>> {
    const [items, total] = await this.userService.findAllPaginated(page, pageSize);
    
    return {
      data: items,
      metadata: {
        currentPage: page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.read_user)
  @ApiOperation({ summary: 'Gibt einen Benutzer zurück' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  async findOne(@Param('id') id: string): Promise<UserDto> {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.write_user)
  @ApiOperation({ summary: 'Aktualisiert einen Benutzer' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateUserDto>,
  ): Promise<UserDto> {
    return this.userService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.delete_user)
  @ApiOperation({ summary: 'Löscht einen Benutzer (Soft Delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Benutzer gelöscht' })
  @ApiResponse({ status: 404, description: 'Benutzer nicht gefunden' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.userService.remove(id);
  }
}
```

### 4.5 Module

**user.module.ts:**
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

**controllers.module.ts:**
```typescript
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { UserModule } from './user/user.module.js';

@Module({
  imports: [HealthModule, UserModule],
})
export class ControllersModule {}
```

---

## 🚀 Phase 5: Application Bootstrap

### 5.1 App Module

**Pfad:** `/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ControllersModule } from './controllers/controllers.module.js';

@Module({
  imports: [ControllersModule],
})
export class AppModule {}
```

### 5.2 Main.ts

**Pfad:** `/src/main.ts`

```typescript
import { AppModule } from './app.module.js';
import { FsArchAppBuilder } from '@fsarch/server';
import { DATABASE_OPTIONS } from './database/index.js';

async function bootstrap() {
  console.log('Starting My-Microservice...');

  const app = await new FsArchAppBuilder(AppModule, {
    name: 'My-Microservice',
    version: '1.0.0',
  })
    .addSwagger({
      title: 'My-Microservice API',
      description: 'REST API Dokumentation',
      version: '1.0.0',
      path: 'docs',
    })
    .enableAuth()
    .setDatabase(DATABASE_OPTIONS)
    .enableSoftDeletion()
    .build();

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';
  
  await app.listen(port, host);
  
  console.log('=================================================');
  console.log(`  My-Microservice ist gestartet!`);
  console.log('=================================================');
  console.log(`  Server:  http://${host}:${port}`);
  console.log(`  Swagger: http://${host}:${port}/docs`);
  console.log(`  Health:  http://${host}:${port}/health`);
  console.log('=================================================');
}

bootstrap().catch((error) => {
  console.error('Fehler beim Starten:', error);
  process.exit(1);
});
```

---

## 📝 Phase 6: Health Check (optional)

**health.controller.ts:**
```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '@fsarch/server/auth';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Gesundheitscheck' })
  @ApiResponse({ status: 200, description: 'Service ist gesund' })
  healthCheck(): { status: string; timestamp: Date } {
    return {
      status: 'healthy',
      timestamp: new Date(),
    };
  }
}
```

**health.module.ts:**
```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

---

## 🧪 Phase 7: Testing

### 7.1 Vitest Konfiguration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
    },
  },
});
```

### 7.2 Unit Test für Service

**Pfad:** `/src/controllers/user/user.service.spec.ts` (neben user.service.ts)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity.js';
import { UserService } from './user.service.js';
import { CreateUserDto } from '../../models/user/CreateUserDto.js';

const mockUser: User = {
  id: 'test-id',
  name: 'Test User',
  email: 'test@example.com',
  description: null,
  creationTime: new Date(),
  updateTime: null,
  deletionTime: null,
};

const mockRepository = {
  create: jest.fn().mockReturnValue(mockUser),
  save: jest.fn().mockResolvedValue(mockUser),
  find: jest.fn().mockResolvedValue([mockUser]),
  findOne: jest.fn().mockResolvedValue(mockUser),
  findAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
  update: jest.fn().mockResolvedValue({ affected: 1, raw: {} }),
  softDelete: jest.fn().mockResolvedValue({ affected: 1, raw: {} }),
};

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const createDto: CreateUserDto = {
        name: 'Test User',
        email: 'test@example.com',
      };

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(repository.save).toHaveBeenCalled();
      expect(result.id).toBe('test-id');
    });

    it('should throw ConflictException if email exists', async () => {
      mockRepository.findOne.mockResolvedValueOnce(mockUser);
      const createDto: CreateUserDto = { name: 'Test', email: 'test@example.com' };

      await expect(service.create(createDto)).rejects.toThrow('ConflictException');
    });
  });

  describe('findOne', () => {
    it('should find user by ID', async () => {
      const result = await service.findOne('test-id');
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'test-id' } });
      expect(result.id).toBe('test-id');
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('non-existent')).rejects.toThrow('NotFoundException');
    });
  });

  describe('remove', () => {
    it('should soft delete user', async () => {
      await service.remove('test-id');
      expect(repository.softDelete).toHaveBeenCalledWith('test-id');
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.softDelete.mockResolvedValueOnce({ affected: 0, raw: {} });
      await expect(service.remove('non-existent')).rejects.toThrow('NotFoundException');
    });
  });
});
```

---

## 🎨 Phase 8: ESLint & Prettier

**.eslintrc.json:**
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": ["./tsconfig.json"]
  },
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

**.prettierrc:**
```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "es5",
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

## 🐳 Phase 9: Docker (optional)

**Dockerfile:**
```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY config/ ./config/

RUN npm run build

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

---

## 📜 Phase 10: Git & CI/CD

### .gitignore
```gitignore
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build Output
dist/
build/

# Test Coverage
coverage/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Database
*.sqlite3
data/

# Logs
logs/
*.log
```

### GitHub Actions Workflow

**.github/workflows/test.yml:**
```yaml
name: Test & Lint

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx prettier --check "src/**/*.ts"
      - run: npm run build
      - run: npm test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
```

---

## ✅ Checkliste für KI-Implementierung

### [ ] Phase 1: Projekt Setup
- [ ] Verzeichnisstruktur erstellen
- [ ] package.json mit Abhängigkeiten
- [ ] tsconfig.json konfigurieren
- [ ] ESLint & Prettier konfigurieren

### [ ] Phase 2: Konfiguration
- [ ] config.yml mit Auth, UAC, Database

### [ ] Phase 3: Datenbank
- [ ] DATABASE_OPTIONS definieren
- [ ] Entities erstellen (je Ressource)
- [ ] Initial-Migration generieren
- [ ] Migration ausführen

### [ ] Phase 4: Business Layer
- [ ] Role Enum mit allen Berechtigungen
- [ ] Für jede Ressource:
  - [ ] DTOs (Create, Response)
  - [ ] Service implementieren
  - [ ] Controller implementieren
  - [ ] Module Datei erstellen
- [ ] ControllersModule als Aggregator

### [ ] Phase 5: Application Bootstrap
- [ ] AppModule erstellen
- [ ] main.ts mit FsArchAppBuilder
- [ ] Health Check hinzufügen

### [ ] Phase 6: Testing
- [ ] Vitest konfigurieren
- [ ] Service Tests erstellen
- [ ] Controller Tests erstellen
- [ ] Tests ausführen

### [ ] Phase 7: Quality & Deployment
- [ ] Code formatieren
- [ ] Linting ausführen
- [ ] Dockerfile erstellen (optional)
- [ ] CI/CD Pipeline einrichten (optional)

---

## 📚 Quick Start: Neue Ressource hinzufügen

```bash
# 1. Entity erstellen
cat > src/database/entities/product.entity.ts << 'EOF'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk__products' })
  id: string;

  @Column({ length: 255, unique: true })
  sku: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @CreateDateColumn({ name: 'creation_time' })
  creationTime: Date;

  @DeleteDateColumn({ name: 'deletion_time', nullable: true })
  deletionTime?: Date;
}
EOF

# 2. DTOs erstellen
mkdir -p src/models/product
cat > src/models/product/CreateProductDto.ts << 'EOF'
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, MaxLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty() @IsString() @MaxLength(255) sku: string;
  @ApiProperty() @IsString() @MaxLength(255) name: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() price: number;
}
EOF

cat > src/models/product/ProductDto.ts << 'EOF'
import { ApiProperty } from '@nestjs/swagger';
export class ProductDto {
  @ApiProperty() id: string;
  @ApiProperty() sku: string;
  @ApiProperty() name: string;
  @ApiProperty() price: number;
  @ApiProperty() creationTime: Date;
  @ApiProperty({ nullable: true }) deletionTime?: Date;
}
EOF

# 3. Role Enum aktualisieren
cat >> src/constants/role.enum.ts << 'EOF'
export enum Role {
  read_product = 'read_product',
  create_product = 'create_product',
  write_product = 'write_product',
  delete_product = 'delete_product',
}
EOF

# 4. Service, Controller, Module erstellen
mkdir -p src/controllers/product
cat > src/controllers/product/product.service.ts << 'EOF'
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../database/entities/product.entity.js';
import { CreateProductDto } from '../../models/product/CreateProductDto.js';
import { ProductDto } from '../../models/product/ProductDto.js';

@Injectable()
export class ProductService {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}
  
  async create(dto: CreateProductDto): Promise<ProductDto> {
    const product = this.repo.create(dto);
    const saved = await this.repo.save(product);
    return this.mapToDto(saved);
  }
  
  async findAllPaginated(page: number = 1, pageSize: number = 25): Promise<[ProductDto[], number]> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.repo.findAndCount({ skip, take: pageSize });
    return [items.map(this.mapToDto), total];
  }
  
  async findOne(id: string): Promise<ProductDto> {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return this.mapToDto(product);
  }
  
  async update(id: string, dto: Partial<CreateProductDto>): Promise<ProductDto> {
    await this.repo.update(id, dto);
    const updated = await this.repo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Product not found');
    return this.mapToDto(updated);
  }
  
  async remove(id: string): Promise<void> {
    const result = await this.repo.softDelete(id);
    if (result.affected === 0) throw new NotFoundException('Product not found');
  }
  
  private mapToDto(p: Product): ProductDto {
    return { id: p.id, sku: p.sku, name: p.name, price: p.price, 
             creationTime: p.creationTime, deletionTime: p.deletionTime ?? undefined };
  }
}
EOF

cat > src/controllers/product/product.controller.ts << 'EOF'
import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@fsarch/server/auth';
import { Roles } from '@fsarch/server/uac';
import { ApiOkPaginatedResponse, PaginationResultDto } from '@fsarch/server/pagination';
import { ProductService } from './product.service.js';
import { CreateProductDto } from '../../models/product/CreateProductDto.js';
import { ProductDto } from '../../models/product/ProductDto.js';
import { Role } from '../../constants/role.enum.js';

@Controller('products')
export class ProductController {
  constructor(private service: ProductService) {}
  
  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.create_product)
  async create(@Body() dto: CreateProductDto): Promise<ProductDto> {
    return this.service.create(dto);
  }
  
  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.read_product)
  @ApiOkPaginatedResponse(ProductDto)
  async findAll(@Query('page') page: number = 1, @Query('pageSize') pageSize: number = 25): 
    Promise<PaginationResultDto<ProductDto>> {
    const [items, total] = await this.service.findAllPaginated(page, pageSize);
    return { data: items, metadata: { currentPage: page, pageSize, totalItems: total, 
                                     totalPages: Math.ceil(total / pageSize) } };
  }
  
  @Get(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.read_product)
  async findOne(@Param('id') id: string): Promise<ProductDto> {
    return this.service.findOne(id);
  }
  
  @Put(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.write_product)
  async update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>): 
    Promise<ProductDto> {
    return this.service.update(id, dto);
  }
  
  @Delete(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.delete_product)
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
EOF

cat > src/controllers/product/product.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../database/entities/product.entity.js';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
EOF

# 5. ControllersModule aktualisieren
# Füge ProductModule zu src/controllers/controllers.module.ts hinzu

# 6. DATABASE_OPTIONS aktualisieren
# Füge Product zu src/database/index.ts entities hinzu

# 7. Migration erstellen
npx typeorm migration:create ./src/database/migrations/$(date +%s)-add-products
# Migration manuell bearbeiten und ausführen
npm run migration:run

# 8. Tests erstellen (neben den Dateien)
# src/controllers/product/product.service.spec.ts
# src/controllers/product/product.controller.spec.ts
```

---

## 🎯 Zusammenfassung

Dieser Integrationsplan bietet eine **vollständige Anleitung** für den Aufbau eines Microservices mit `@fsarch/server`. Die KI kann diesen Plan Schritt für Schritt abarbeiten, um:

1. ✅ Ein neues Projekt zu initialisieren
2. ✅ Die benötigte Infrastruktur zu konfigurieren
3. ✅ Entities, DTOs, Services und Controller zu erstellen
4. ✅ **Tests immer neben den zu testenden Dateien** zu platzieren (Co-Location)
5. ✅ Datenbank-Migrations zu erstellen und auszuführen
6. ✅ Die Anwendung korrekt zu booten
7. ✅ Best Practices und Konventionen einzuhalten

Der Plan garantiert eine **konsistente, wartbare und skalierbare** Microservice-Architektur mit @fsarch/server.

---

*Generiert für KI-gestützte Microservice-Entwicklung mit @fsarch/server*
