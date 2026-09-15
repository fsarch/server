# Custom Resource Module

Lets a service advertise "custom resources" — resource types that a client (typically a frontend) can list and fetch via a generic API, without the client having to know the concrete routes up front. The module is a classic NestJS dynamic module: the list of resources is passed in at registration time, not loaded from a config file, so it has no dependency on `@fsarch/server/configuration` or the app's `config.yaml`.

## Registration

If your app is bootstrapped with `FsArchAppBuilder` (from `@fsarch/server`), use `.addCustomResource(resource)` instead — it adds one resource at a time, the same way `.addSwagger()` works, and wires this module in for you. See the root [README](../../../README.md#custom-resource).

The rest of this document describes the underlying `CustomResourceModule`, for apps that don't use `FsArchAppBuilder`.

```ts
import { CustomResourceModule } from '@fsarch/server/custom-resource';

@Module({
  imports: [
    CustomResourceModule.forRoot({
      resources: [
        {
          id: 'part_attachment',
          name: 'Part Attachment',
          description: 'Attachments of a part',
          apiRoutes: {
            list: {
              request: {
                path: '/parts/{{id}}/attachments',
                method: 'GET',
                auth: { type: 'credential-propagation' },
              },
              enablePagination: true,
            },
            get: {
              request: {
                path: '/parts/{{id}}/attachments/{{id}}',
                method: 'GET',
                auth: { type: 'credential-propagation' },
              },
            },
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

`forRoot()` validates the given resources with a Joi schema and throws synchronously (at bootstrap) if the config is invalid — see [Validation](#validation) below.

## Endpoint

```
GET /.meta/custom-resources
```

(Note: this module registers its controller at version `'1'`, so with a NestJS app that enables URI versioning — as `FsArchAppBuilder` does — the effective path is `/v1/.meta/custom-resources`.)

Returns all registered resource definitions:

```json
{
  "data": [
    {
      "id": "part_attachment",
      "name": "Part Attachment",
      "description": "Attachments of a part",
      "apiRoutes": {
        "list": {
          "request": {
            "path": "/parts/{{id}}/attachments",
            "method": "GET",
            "auth": { "type": "credential-propagation" }
          },
          "enablePagination": true
        },
        "get": {
          "request": {
            "path": "/parts/{{id}}/attachments/{{id}}",
            "method": "GET",
            "auth": { "type": "credential-propagation" }
          }
        }
      }
    }
  ]
}
```

Authentication is whatever the host application enforces globally (e.g. via `AuthGuard` from `@fsarch/server/auth`) — this module does not add its own guard.

## Resource Definition

| Field                              | Type                                  | Description                                                                                                           |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                                | `string`                              | Unique identifier, must match `^[a-z0-9_]+$` (lowercase letters, digits, `_` only — no uppercase, spaces or hyphens). See [Validation](#validation). |
| `name`                              | `string`                              | Human-readable name.                                                                                                   |
| `description`                       | `string`                              | Human-readable description.                                                                                            |
| `apiRoutes.list.request`            | [`Request`](#request)                 | How to call the endpoint that lists this resource.                                                                     |
| `apiRoutes.list.enablePagination`   | `boolean`                             | Whether the list endpoint supports pagination.                                                                         |
| `apiRoutes.get.request`             | [`Request`](#request)                 | How to call the endpoint that fetches a single instance of this resource.                                              |

### `Request`

| Field    | Type                                                | Description                                                                                                                                                          |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`   | `string`                                            | Request path, may contain placeholders (see below).                                                                                                                 |
| `method` | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'`     | HTTP method to use.                                                                                                                                                  |
| `auth`   | `{ type: 'credential-propagation' }`                  | Auth strategy: the caller's own credentials are propagated to the downstream request. Currently the only supported type.                                            |

### Path Placeholders

`path` values may contain placeholders wrapped in `{{ }}` (chosen over `##` to avoid clashing with `#` as a YAML/Markdown comment marker, and because `{{}}` is the common templating convention):

- `{{id}}` — the id of the resource instance itself.
- `{{$system.crd.[<custom-resource-service-name>].[<custom-resource-id>].id}}` — a reference to the id of another custom resource definition. `<custom-resource-service-name>` is optional and only needed when referencing a custom resource defined by a different service.

This module does **not** resolve these placeholders itself — it only serves the definitions as configured. Resolution is the responsibility of the consumer (e.g. a frontend) that reads this endpoint.

## Validation

`forRoot()` validates the given `resources` array with Joi and throws an `Error` at module-registration time (i.e. at application bootstrap) if:

- any `id` does not match `^[a-z0-9_]+$`,
- the same `id` is used more than once,
- any required field is missing or has the wrong type.

This is a fail-fast check, not a runtime/request-time validation — an invalid config prevents the application from starting rather than causing errors on individual requests.

## Structure

```
src/lib/custom-resource/
├── custom-resource.types.ts      # TCustomResourceDefinition and related types
├── custom-resource.service.ts    # CustomResourceService, reads the registered list
├── custom-resource.controller.ts # GET .meta/custom-resources
├── custom-resource.module.ts     # forRoot() + Joi validation
├── index.ts                      # public exports
└── README.md
```

## Design Notes

- Only `forRoot()` is implemented. A `forFeature()` that lets individual feature modules contribute their own resources into a shared registry is a natural future extension (mirroring `TypeOrmModule.forRoot()`/`forFeature()`) but has not been needed by any consumer yet.
