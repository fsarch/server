# Integrationsplan: Microservice mit @fsarch/server aufbauen

## Ziel

Dieser Plan dient als **Schritt-für-Schritt-Anleitung für eine KI (oder Entwickler)**, um einen neuen Microservice basierend auf der `@fsarch/server`-Bibliothek zu erstellen. Der Plan beschreibt die vollständige Architektur, Dateistruktur, Konventionen und Implementierungsschritte.

---

## 📁 Projektstruktur

**Wichtig: Tests liegen IMMER neben den zu testenden Dateien (Co-Location Pattern)**

```
my-microservice/
├── src/
│   ├── main.ts                          # Dünne Bootstrap-Shell (liest aus lib/index.ts)
│   │
│   ├── lib/                              # Feature-Modul + Mono-Service-Descriptor
│   │   ├── index.ts                     # Exportiert Modul + `descriptor`
│   │   ├── index.spec.ts                # ⭐ Tests hier!
│   │   ├── my-microservice.module.ts    # createServiceModule() — EIN flaches Modul
│   │   └── my-microservice.module.spec.ts # ⭐ Tests hier!
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
│   │   └── user/
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

**Wichtig — kein `app.module.ts`, kein `*.module.ts` pro Ressource mehr:** Controller, Service und Entities jeder Ressource werden direkt in den EINEN `createServiceModule()`-Aufruf in `src/lib/my-microservice.module.ts` eingetragen (`controllers`/`providers`-Arrays), statt in einem eigenen, handgeschriebenen `@Module()`. Siehe Phase 5.1. Das ist nicht nur weniger Boilerplate — es ist auch die Voraussetzung dafür, dass der Service später ohne Code-Änderung in einen Mono-Service-Prozess gemountet werden kann (Phase 5.5): `createServiceModule()`s `TypeOrmModule.forFeature(entities, connectionName)` bindet nur Controller/Provider, die *direkt* in diesem einen Modul deklariert sind — verschachtelte, handgeschriebene Module würden bei einer benannten DB-Connection weiterhin an die Default-Connection binden.

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
    "start:prod": "node --import @fsarch/server/register dist/main.js",
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
    "@fsarch/server": "^0.5.1",
    "@nestjs/common": "^12.1.0",
    "@nestjs/core": "^12.1.0",
    "@nestjs/platform-express": "^12.1.0",
    "@nestjs/swagger": "^12.0.2",
    "@nestjs/typeorm": "^12.0.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "pg": "^8.22.0",
    "reflect-metadata": "^0.2.0",
    "typeorm": "^1.1.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^12.0.7",
    "@nestjs/testing": "^12.1.0",
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

**Wichtig:** `@nestjs/*`-Versionen hier müssen zur Version passen, die `@fsarch/server` selbst als `dependencies` mitbringt (aktuell `^12.1.0`) — bei abweichenden Majors/Minors kann es zu zwei getrennten Nest-Instanzen im Dependency-Baum kommen, wodurch z. B. ein per `@UseGuards(AuthGuard)` referenzierter Guard seine eigenen Abhängigkeiten nicht mehr auflösen kann. Vor dem Anlegen eines neuen Service kurz `npm view @fsarch/server dependencies` (oder die `package.json` dieses Repos) gegen die hier verwendeten Versionen prüfen.

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

# =============================================================================
# TRACING (optional, OpenTelemetry)
# `serviceName` is required here when the process is started with the
# `@fsarch/server/register` preload (see Phase 5.3) — that preload runs
# before FsArchAppBuilder exists, so it has no `name`/`version` to fall back to.
# =============================================================================
# tracing:
#   enabled: true
#   serviceName: my-microservice
#   sampler: parentbased_traceidratio
#   sampleRatio: 1.0
#   exporter:
#     type: otlp-http
#     url: http://localhost:4318/v1/traces
```

**Mono-Service-Betrieb (optional, siehe Phase 5.5):** Wird dieser Service später zusammen mit anderen in einem gemeinsamen Prozess gemountet, liegt `config.yaml` nicht mehr flach vor, sondern als `services:`-Liste — `config:` je Eintrag ist 1:1 die obige Standalone-Config, copy-paste-kompatibel:

```yaml
services:
  - type: my-microservice
    id: my-microservice-main
    config:
      auth: { ... }     # wie oben
      uac: { ... }       # wie oben
      database: { ... }  # wie oben
```

Für Standalone-Betrieb (ohne `.addService()`) bleibt das flache `config.yaml` von oben unverändert gültig.

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

### 4.5 Kein eigenes Modul pro Ressource

Anders als in älteren `@fsarch/server`-Services wird hier **kein** `user.module.ts` und **kein** aggregierendes `controllers.module.ts` mehr geschrieben. `UserController` und `UserService` werden stattdessen direkt in den `controllers`/`providers`-Arrays des einen `createServiceModule()`-Aufrufs eingetragen — siehe Phase 5.1. `TypeOrmModule.forFeature([User])` übernimmt `createServiceModule()` ebenfalls automatisch (aus `entities`), kein eigener `@nestjs/typeorm`-Import in diesem Modul nötig.

---

## 🚀 Phase 5: Application Bootstrap

### 5.1 Feature-Modul

**Pfad:** `/src/lib/my-microservice.module.ts`

Statt eines handgeschriebenen `app.module.ts` wird das eine Feature-Modul des
Service über `@fsarch/server`s `createServiceModule()`-Helper erzeugt. Er
übernimmt `TypeOrmModule.forFeature(entities, connectionName)` intern —
`connectionName` bleibt `undefined` (Standalone, Default-Connection) außer ein
Mono-Service-Harness ruft `.register({ connectionName, ... })` auf (Phase
5.5). Alle Controller/Provider aus Phase 4 landen hier direkt, **nicht** in
eigenen, verschachtelten Modulen:

```typescript
import { createServiceModule } from '@fsarch/server';
import { User } from '../database/entities/user.entity.js';
import { UserController } from '../controllers/user/user.controller.js';
import { UserService } from '../controllers/user/user.service.js';
import { HealthController } from '../controllers/health/health.controller.js';

export const MyMicroserviceModule = createServiceModule({
  entities: [User],
  controllers: [HealthController, UserController],
  providers: [UserService],
  exports: [UserService],
});
```

Für jede weitere Ressource (Phase 4 wiederholt für z. B. `Product`): Entity zu
`entities`, Controller zu `controllers`, Service zu `providers` hinzufügen —
sonst nichts.

### 5.2 Descriptor

**Pfad:** `/src/lib/index.ts`

Der `descriptor` ist die eingefrorene Form der Builder-Aufrufkette, die
`main.ts` sonst direkt ausführen würde (`.enableAuth()`, `.setDatabase()`,
`.addSwagger()`, …) — als Daten statt als Methodenaufrufe. `main.ts` liest
seine Werte daraus (Phase 5.3); ein späterer Mono-Service-Harness (Phase 5.5)
spreadet denselben Descriptor in `.addService({ id, ...descriptor })`, ohne
dass irgendetwas doppelt gepflegt werden muss:

```typescript
import { DATABASE_OPTIONS } from '../database/index.js';
import { MyMicroserviceModule } from './my-microservice.module.js';

export { MyMicroserviceModule };
export const entities = DATABASE_OPTIONS.entities;
export const migrations = DATABASE_OPTIONS.migrations;

export const descriptor = {
  module: MyMicroserviceModule,
  entities,
  migrations,
  swagger: {
    title: 'My-Microservice API',
    description: 'REST API Dokumentation',
    version: '1.0.0',
    path: 'docs',
  },
  auth: true,
  // uac: { roles: Object.values(Role) }, // nur falls .enableUac(...) genutzt wird
};
```

### 5.3 Main.ts

**Pfad:** `/src/main.ts`

**Wichtig, falls Tracing (`tracing.enabled: true`) genutzt wird:** Auto-
Instrumentierung (HTTP/Express/Postgres/Nest) patcht Module beim ersten
Laden — das funktioniert nur, wenn sie *vor* dem `import { descriptor } ...`
unten aktiv ist, also nicht durch Code in `main.ts` selbst, sondern über
Node's `--import`-Flag beim Prozessstart:

```bash
node --import @fsarch/server/register dist/main.js
```

`start:prod` in `package.json` und das Dockerfile in Phase 9 sind bereits
entsprechend konfiguriert. Ohne den Preload startet Tracing zwar trotzdem
(manuelle Spans über `getTracer()`/`@Span()`/`withSpan()` funktionieren), aber
die Auto-Instrumentierung patcht nichts mehr, da `@nestjs/core` durch den
`import` unten längst geladen ist.

```typescript
import { FsArchAppBuilder } from '@fsarch/server';
import { descriptor } from './lib/index.js';

async function bootstrap() {
  console.log('Starting My-Microservice...');

  // `descriptor.module.register()` ohne Argumente = Default-Connection,
  // keine Guards — exakt das Verhalten eines handgeschriebenen AppModule.
  // Die Builder-Aufrufe unten lesen nur noch ihre Werte aus `descriptor`,
  // statt sie hier zu duplizieren.
  const app = await new FsArchAppBuilder(descriptor.module.register(), {
    name: 'My-Microservice',
    version: '1.0.0',
  })
    .addSwagger(descriptor.swagger)
    .enableAuth()
    .setDatabase({ entities: descriptor.entities, migrations: descriptor.migrations })
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

### 5.4 Custom Resource (optional)

`.addCustomResource()` registriert einen `GET /.meta/custom-resources`-Endpunkt, über den der Service bekannt gibt, welche Resource-Typen er anbietet und wie man sie listet bzw. einzeln abruft (Path, HTTP-Methode, Auth-Strategie) — ohne dass Konsumenten (z. B. ein gemeinsames Frontend) die Routen pro Service hart codieren müssen. Anders als Auth/UAC/Database läuft das **nicht** über `config.yml`, sondern direkt im Code — ein Aufruf pro Resource-Typ, analog zu `.addSwagger()`:

```typescript
const app = await new FsArchAppBuilder(descriptor.module.register(), {
  name: 'My-Microservice',
  version: '1.0.0',
})
  // ... addSwagger(), enableAuth(), setDatabase(), enableSoftDeletion() ...
  .addCustomResource({
    id: 'user',
    name: 'User',
    description: 'Users managed by this service.',
    apiRoutes: {
      list: {
        request: {
          path: '/users',
          method: 'GET',
          auth: { type: 'credential-propagation' },
        },
        enablePagination: true,
      },
      get: {
        request: {
          path: '/users/{{id}}',
          method: 'GET',
          auth: { type: 'credential-propagation' },
        },
      },
      search: {
        request: {
          path: '/users/search',
          method: 'GET',
          auth: { type: 'credential-propagation' },
          queryParams: { q: '{{query}}' },
        },
        enablePagination: true,
      },
    },
  })
  .build();
```

**Wichtig:**
- `id` muss `^[a-z0-9_]+$` entsprechen (nur Kleinbuchstaben, Ziffern, `_`) und über alle registrierten Resources eindeutig sein — bei Verstoß startet die App nicht (Joi-Validierung beim Bootstrap).
- `path` und `queryParams`-Werte dürfen `{{id}}` (die ID der Resource-Instanz selbst), `{{$system.crd.[<service-name>].[<custom-resource-id>].id}}` (Referenz auf die ID einer — ggf. fremden — Custom Resource) oder — nur innerhalb von `apiRoutes.search` — `{{query}}` (der vom Aufrufer übergebene Suchbegriff) als Platzhalter enthalten. Diese werden vom Server nicht aufgelöst, nur durchgereicht.
- `apiRoutes.search` ist optional und hat, falls angegeben, dieselbe Form wie `apiRoutes.list` (`request` + `enablePagination`). `queryParams` (`Record<string, string | string[]>`) ist auf jedem Request optional und erlaubt strukturierte Query-Parameter statt eines fest in `path` codierten Query-Strings.
- Komplett optional — ohne mindestens einen `.addCustomResource()`-Aufruf wird kein `.meta/custom-resources`-Endpunkt registriert.

Details: Abschnitt [„Custom Resource“](./README.md#custom-resource) in der Haupt-README von `@fsarch/server`.

### 5.5 Mono-Service Mounting (optional)

Mehrere nach diesem Plan gebaute Services (jeder nach dem Library+Shell-Muster aus 5.1/5.2) lassen sich **ohne Code-Änderung am Service selbst** in einem gemeinsamen Prozess zusammenfassen, um den fixen Node/Nest-Sockel nur einmal statt N-mal zu bezahlen. Das übernimmt ein separates, dünnes Harness-Repo — nicht der Service selbst:

```typescript
import { FsArchAppBuilder } from '@fsarch/server';
import { Module } from '@nestjs/common';
import { descriptor as userServiceDescriptor } from 'user-service/dist/lib/index.js';
import { descriptor as billingServiceDescriptor } from 'billing-service/dist/lib/index.js';

@Module({})
class RootModule {}

const app = await new FsArchAppBuilder(RootModule, {
  name: 'Mono-Service',
  version: '1.0.0',
})
  .addService({ id: 'user-main', ...userServiceDescriptor })
  .addService({ id: 'billing-main', ...billingServiceDescriptor })
  .build();

await app.listen(process.env.PORT ?? 3000);
```

Jeder `.addService({ id, ...descriptor })`-Eintrag bekommt automatisch:

- eine **eigene, benannte TypeORM-Connection** (Name = `id`) — vollständig getrennte Datenbank pro Mount,
- einen **eigenen, nicht-globalen Auth-/UAC-Guard**, falls `descriptor.auth`/`descriptor.uac` gesetzt ist — kein gemeinsamer Login über Mounts hinweg,
- einen **eigenen Routen-Präfix** (`/v1/<id>/...` — die NestJS-Versionierung steht *vor* dem Präfix, nicht danach),
- ein **eigenes Swagger-Dokument** unter `/<id>` (falls `descriptor.swagger` gesetzt ist).

Die `config.yaml` des Harness-Prozesses listet jeden Mount als Eintrag im `services:`-Array (siehe Phase 2) — `config:` je Eintrag ist 1:1 die Standalone-`config.yaml` des jeweiligen Service-Typs:

```yaml
services:
  - type: user-service
    id: user-main
    config:
      auth: { type: static, secret: '...' }
      uac: { type: static, users: [...] }
      database: { type: postgres, host: ..., database: user_main }
  - type: billing-service
    id: billing-main
    config:
      auth: { type: static, secret: '...' }
      database: { type: postgres, host: ..., database: billing_main }
```

**Voraussetzungen, damit ein nach diesem Plan gebauter Service mountbar bleibt** (alle bereits durch Phase 5.1/5.2 erfüllt, wenn der Plan befolgt wurde):

- Genau **ein** `createServiceModule()`-Aufruf, keine verschachtelten, handgeschriebenen `@Module()`s mit eigenem `TypeOrmModule.forFeature(...)` — eine benannte Connection bindet nur Controller/Provider, die *direkt* im generierten Modul deklariert sind.
- `@InjectRepository(Entity)` und `@InjectDataSource()` (ab `@fsarch/server@0.5.1`) im Service-Code bleiben unverändert, unqualifiziert — `createServiceModule()` bindet sie bei gesetzter `connectionName` automatisch an die benannte Connection um.
- Nutzt der Service **eigene** `@nestjs/config`-Sections außerhalb von `auth`/`uac`/`database` (z. B. ein selbstgeschriebenes `ConfigModule.forRoot({ load: [...] })` für Service-spezifische Settings), muss dessen Loader-Funktion optional eine `serviceId` annehmen und bei gesetzter `serviceId` aus dem passenden `services[].config`-Eintrag statt aus der Root-Config lesen — und `isGlobal: !serviceId`, damit zwei gemountete Instanzen sich nicht gegenseitig überschreiben. `auth`/`uac`/`database` brauchen das nicht, die sind bereits serviceId-bewusst (siehe `ModuleConfigurationService`).
- Modul-Constructor-Seiteneffekte (z. B. Daten aus der Config in die DB seeden) gehören in einen `OnModuleInit`-Provider statt in den Konstruktor eines `@Module()` — `createServiceModule()` erzeugt kein eigenes Modul mit Constructor-Hook.

---

## 📝 Phase 6: Health Check (optional)

**Pfad:** `/src/controllers/health/health.controller.ts`

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

Kein eigenes `health.module.ts` — `HealthController` wird direkt in das
`controllers`-Array von `createServiceModule()` (Phase 5.1) eingetragen, wie
im Beispiel dort bereits gezeigt. `@Public()` macht die Route unabhängig
davon, ob/wie der Service gemountet wird, immer unauthentifiziert
erreichbar.

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

CMD ["node", "--import", "@fsarch/server/register", "dist/main.js"]
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
  - [ ] (kein eigenes Module File — Eintrag in Phase 5.1's `createServiceModule()`)

### [ ] Phase 5: Application Bootstrap
- [ ] Feature-Modul via `createServiceModule()` (`src/lib/<service>.module.ts`)
- [ ] `descriptor` exportieren (`src/lib/index.ts`)
- [ ] main.ts mit FsArchAppBuilder, liest aus `descriptor`
- [ ] Custom Resource registrieren (optional, `.addCustomResource()` je Resource-Typ)
- [ ] Health Check hinzufügen (Controller ins `createServiceModule()`-Array, kein eigenes Modul)
- [ ] Mono-Service-mountbar? (optional, meist automatisch erfüllt): genau ein `createServiceModule()`-Aufruf, keine eigene `@nestjs/config`-Section ohne `serviceId`-Awareness, keine Modul-Constructor-Seiteneffekte

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

# 5. Feature-Modul (src/lib/<service>.module.ts) aktualisieren:
#    - Product zu entities hinzufügen
#    - ProductController zu controllers hinzufügen
#    - ProductService zu providers (und ggf. exports) hinzufügen
#    Kein eigenes product.module.ts, kein ControllersModule-Aggregator.

# 6. DATABASE_OPTIONS aktualisieren
# Füge Product zu src/database/index.ts entities hinzu

# 7. Migration erstellen
npx typeorm migration:create ./src/database/migrations/$(date +%s)-add-products
# Migration manuell bearbeiten und ausführen
npm run migration:run

# 8. Tests erstellen (neben den Dateien)
# src/controllers/product/product.service.spec.ts
# src/controllers/product/product.controller.spec.ts

# 9. (Optional) Resource über .meta/custom-resources discoverable machen
# In main.ts, vor .build():
#   .addCustomResource({
#     id: 'product',
#     name: 'Product',
#     description: 'Products managed by this service.',
#     apiRoutes: {
#       list: {
#         request: { path: '/products', method: 'GET', auth: { type: 'credential-propagation' } },
#         enablePagination: true,
#       },
#       get: {
#         request: { path: '/products/{{id}}', method: 'GET', auth: { type: 'credential-propagation' } },
#       },
#     },
#   })
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

Der Plan garantiert eine **konsistente, wartbare und skalierbare** Microservice-Architektur mit @fsarch/server — und, als Nebeneffekt des Library+Shell-Musters aus Phase 5.1/5.2, dass sich der entstehende Service jederzeit später ohne Code-Änderung in einen Mono-Service-Prozess mounten lässt (Phase 5.5), falls der Ressourcenverbrauch vieler durchgängig idler Standalone-Deployments das irgendwann nötig macht.

---

*Generiert für KI-gestützte Microservice-Entwicklung mit @fsarch/server*
