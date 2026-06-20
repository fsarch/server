import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestFactory } from "@nestjs/core";
import { PinoLogger } from "./logger/pino-logger.service.js";
import { DynamicModule, ForwardReference, INestApplication, Module, Type, VersioningType } from "@nestjs/common";
import { DatabaseModuleOptions } from "./database/database.module.js";
import { FsarchModule } from "./fsarch.module.js";
import { AuthExceptionFilter } from "./auth/errors/AuthExceptionFilter.js";
import { AuthService } from "./auth/auth.service.js";

type SwaggerOptionsType = {
  path?: string;
  title?: string;
  description: string;
  version: string;
};

type IEntryModule = Type<any> | DynamicModule | ForwardReference

export class FsArchAppBuilder {
  private swaggerOptions: Array<SwaggerOptionsType> = [];
  private databaseOptions?: DatabaseModuleOptions;
  private authOptions?: {};
  private readonly httpMethods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

  constructor(private readonly baseModule: IEntryModule, private readonly info: { name: string; version: string }) {

  }

  addSwagger(options: SwaggerOptionsType): this {
    this.swaggerOptions.push(options);
    return this;
  }

  setDatabase(databaseOptions: DatabaseModuleOptions) {
    this.databaseOptions = databaseOptions;
    return this;
  }

  enableAuth() {
    this.authOptions = {};
    return this;
  }

  private setUniqueOperationIds(document: { paths?: Record<string, Record<string, any>> }) {
    const usedOperationIds = new Set<string>();

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      for (const [httpMethod, operation] of Object.entries(pathItem ?? {})) {
        if (!this.httpMethods.has(httpMethod) || !operation || typeof operation !== 'object') {
          continue;
        }

        const normalizedPath = path
          .replace(/[{}]/g, '')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

        const baseOperationId = `${httpMethod}_${normalizedPath || 'root'}`;
        let operationId = baseOperationId;
        let duplicateCounter = 2;

        while (usedOperationIds.has(operationId)) {
          operationId = `${baseOperationId}_${duplicateCounter}`;
          duplicateCounter += 1;
        }

        operation.operationId = operationId;
        usedOperationIds.add(operationId);
      }
    }
  }

  public async build(): Promise<INestApplication> {
    const AppModule = this.baseModule;

    @Module({
      imports: [
        AppModule,
        FsarchModule.register({
          auth: this.authOptions,
          database: this.databaseOptions,
        }),
      ],
    })
    class FsArchAppModule {}

    const app = await NestFactory.create(FsArchAppModule, {
      logger: PinoLogger.Instance,
    });
    app.enableCors();

    if (this.authOptions) {
      const authService = app.get(AuthService);
      app.useGlobalFilters(new AuthExceptionFilter(authService));
    }

    app.enableVersioning({
      type: VersioningType.URI,
    });

    if (this.swaggerOptions) {
      for (const { path, title, version, description } of this.swaggerOptions) {
        const config = new DocumentBuilder()
          .setTitle(title ?? this.info.name)
          .setDescription(description)
          .addBearerAuth()
          .setVersion(version)
          .build();
        const document = SwaggerModule.createDocument(app, config);
        this.setUniqueOperationIds(document);
        SwaggerModule.setup(path ?? 'docs', app, document);
      }
    }

    return app;
  }
}
