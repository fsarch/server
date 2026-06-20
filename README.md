# @fsarch/server

TypeScript-based HTTP server library with CLI support.

## Installation

```bash
npm install @fsarch/server
```

## Usage as Library

```typescript
import { Server } from '@fsarch/server';

const server = new Server({ port: 3000 });

server.addRoute({
  method: 'GET',
  path: '/hello',
  handler: (req, res) => {
    res.json({ message: 'Hello World!' });
  }
});

// With route parameters
server.addRoute({
  method: 'GET',
  path: '/users/:id',
  handler: (req, res) => {
    res.json({ userId: req.params?.id });
  }
});

// With middleware
server.use((req, res, next) => {
  console.log('Request:', req.method, req.url);
  next();
});

await server.start();
```

## CLI Usage

```bash
# Start server
fsarch-server start --port 3000 --host 0.0.0.0

# Development mode
fsarch-server dev --port 3000

# Show help
fsarch-server --help

# Show version
fsarch-server --version
```

## Features

- TypeScript first with full type definitions
- HTTP/HTTPS server support
- Route handling with parameters
- Middleware support
- Configuration management
- Built-in logging
- CLI with multiple commands
- Dual module support (CommonJS & ESM)

## Development

```bash
npm install
npm run build
npm run dev
```

## License

MIT
