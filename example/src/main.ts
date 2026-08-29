import 'reflect-metadata';
import { FsArchAppBuilder } from '@fsarch/server';
import { AppModule } from './app.module.js';

const app = await new FsArchAppBuilder(AppModule, {
  name: 'fsarch-server-example',
  version: '1.0.0',
})
  .addSwagger({
    title: 'fsarch-server example',
    description: 'Minimal REST API built with the local @fsarch/server package',
    version: '1.0.0',
  })
  .build();

const port = process.env.PORT ?? 3000;
await app.listen(port);

console.log(`Example API listening on http://localhost:${port}`);
console.log(`Swagger docs at        http://localhost:${port}/docs`);
