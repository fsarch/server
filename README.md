# @fsarch/server

NestJS building blocks for FSArch services: app bootstrap, auth, UAC/roles, pagination DTOs, and configuration loading.

## Installation

```bash
npm install @fsarch/server
```

## Requirements

- Node.js >= 18
- `config.yaml` in the project root (or set a custom path via `CONFIG_FILE_PATH`)

## Quick Start (as used in `bot-protection`)

```ts
import { AppModule } from './app.module.js';
import { FsArchAppBuilder } from '@fsarch/server';
import { DATABASE_OPTIONS } from './database/index.js';

const app = await new FsArchAppBuilder(AppModule, {
  name: 'My-Service',
  version: '1.0.0',
})
  .addSwagger({
    title: 'My-Service',
    description: 'API description',
    version: '1.0.0',
  })
  .enableAuth()
  .setDatabase(DATABASE_OPTIONS)
  .build();

await app.listen(process.env.PORT ?? 3000);
```

## Configuration (`config.yaml`)

The library loads configuration from `./config.yaml` by default.
You can provide a different file via `CONFIG_FILE_PATH`.

### Auth

Supported types:

- `static`
- `jwt-jwk`
- `oidc`

Example:

```yaml
auth:
  type: oidc
  discovery_url: https://issuer.example/.well-known/openid-configuration
```

### UAC (roles / permissions)

Currently supported as static UAC configuration:

```yaml
uac:
  type: static
  users:
    - user_id: abcdef
      permissions:
        - manage_claims
```

### Database

Supported types:

- `sqlite`
- `postgres`
- `cockroachdb`

Example:

```yaml
database:
  type: postgres
  host: db-01
  port: 5432
  username: dev
  password: secret
  database: my_service
  ssl:
    rejectUnauthorized: false
```

## Exports & Usage

### Core

```ts
import { FsArchAppBuilder } from '@fsarch/server';
```

### Auth

```ts
import { AuthGuard, Public, UserData } from '@fsarch/server/auth';
```

### UAC

```ts
import { Roles } from '@fsarch/server/uac';
```

### Pagination (Swagger + DTO)

```ts
import {
  ApiOkPaginatedResponse,
  PaginationResultDto,
} from '@fsarch/server/pagination';
```

Controller example:

```ts
@Get()
@UseGuards(AuthGuard)
@Roles(Role.manage_claims)
@ApiOkPaginatedResponse(ClaimDto)
async listClaims(): Promise<PaginationResultDto<ClaimDto>> {
  return {
    data: [],
    metadata: {
      currentPage: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    },
  };
}
```

## CLI

`@fsarch/server` liefert ein CLI-Binary `fsarch-server` mit:
`@fsarch/server` ships a `fsarch-server` CLI binary with:

```bash
fsarch-server build
fsarch-server start
```

Typical scripts:

```json
{
  "scripts": {
    "build": "fsarch-server build",
    "start": "fsarch-server start"
  }
}
```

## License

MIT
