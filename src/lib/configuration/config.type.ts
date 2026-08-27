export type ConfigType = {
  auth: ConfigAuthType;
  uac: ConfigStaticUacType;
  database: ConfigDatabaseType;
  tracing?: ConfigTracingType;
};

export type ConfigAuthType = ConfigStaticAuthType | ConfigJwtJwkAuthType | ConfigOidcAuthType;

export type ConfigStaticAuthType = {
  type: 'static';
  secret: string;
  users: Array<ConfigAuthUserType>;
};

export type ConfigJwtJwkAuthType = {
  type: 'jwt-jwk';
  jwkUrl: string;
};

export type ConfigOidcAuthType = {
  type: 'oidc';
  discovery_url: string;
};

type ConfigAuthUserType = {
  id: string;
  username: string;
  password: string;
};

export type ConfigUacType = ConfigStaticUacType;

export type ConfigStaticUacType = {
  type: 'static';
  users: Array<ConfigUacUserType>;
};

type ConfigUacUserType = {
  user_id: string;
  permissions: Array<string>;
};

export type ConfigDatabaseType =
  | ConfigSqliteDatabaseType
  | ConfigCockroachdbDatabaseType;

type ConfigSqliteDatabaseType = {
  type: 'sqlite';
  database: string;
};

type ConfigCockroachdbDatabaseType = {
  type: 'cockroachdb' | 'postgres';
  host: string;
  username: string;
  password?: string;
  database: string;
  port?: number;
  ssl?: {
    rejectUnauthorized?: boolean;
    ca?:
      | string
      | {
          path: string;
        };
    cert?:
      | string
      | {
          path: string;
        };
    key?:
      | string
      | {
          path: string;
        };
  };
};

export type ConfigTracingType = {
  enabled: boolean;
  serviceName?: string;
  sampleRatio?: number;
  exporter?: ConfigTracingExporterType;
};

export type ConfigTracingExporterType =
  | ConfigTracingConsoleExporterType
  | ConfigTracingOtlpHttpExporterType
  | ConfigTracingOtlpGrpcExporterType;

export type ConfigTracingConsoleExporterType = {
  type: 'console';
};

export type ConfigTracingOtlpHttpExporterType = {
  type: 'otlp-http';
  url: string;
  headers?: Record<string, string>;
};

export type ConfigTracingOtlpGrpcExporterType = {
  type: 'otlp-grpc';
  url: string;
  headers?: Record<string, string>;
};
