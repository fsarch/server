# @fsarch/server example

A minimal REST API demonstrating `@fsarch/server`, consumed as a **local
link** to the package in the parent directory (`"@fsarch/server": "file:.."`
in `package.json`) instead of a published npm version. This lets you try out
local changes to the library without publishing anything.

It exposes a small in-memory `items` CRUD resource:

- `GET    /items`
- `GET    /items/:id`
- `POST   /items` — body: `{ "name": "..." }`
- `DELETE /items/:id`

Swagger UI is available at `/docs` once the server is running.

## Setup

This folder is set up as an npm workspace of the root package (see
`"workspaces"` in the root `package.json`), so `@nestjs/*`, `reflect-metadata`
and `rxjs` are shared between the library and the example instead of being
installed twice — installing them separately would give the library and the
example two different copies of those packages, which breaks things like
`instanceof HttpException` checks across the module boundary. Because of
that, run `npm install` from the **repo root**, not from `example/`.

```bash
# from the repo root
npm install --legacy-peer-deps
npm run build

cd example
npm start   # compiles src/ and runs dist/main.js
```

The API listens on `http://localhost:3000` by default (override with `PORT`).

## Notes

- `config.yaml` in this folder is the config `@fsarch/server` loads at
  startup (see the main [README.md](../README.md) for all available
  options — auth, uac, database, tracing, ...). This example doesn't need
  any of those, so it's essentially empty.
- `@fsarch/server` is linked locally via `"@fsarch/server": "file:.."`,
  which npm installs as a symlink at `node_modules/@fsarch/server` (pointing
  back at the repo root). Rebuilding the library (`npm run build` at the
  repo root) is picked up the next time the example is started — no
  reinstall needed.
