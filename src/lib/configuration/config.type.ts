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
  sampler?: ConfigTracingSamplerType;
  sampleRatio?: number;
  exporter?: ConfigTracingExporterType;
};

/**
 * Mirrors the standard `OTEL_TRACES_SAMPLER` values (minus `jaeger_remote` and
 * `xray`, which need extra setup this library doesn't wire up).
 *
 * The `parentbased_*` variants respect the parent span's sampling decision
 * (e.g. an upstream service's `traceparent` header) and only apply their own
 * rule for root spans — this is almost always what you want, since plain
 * (non-parent-based) sampling re-decides independently per span and can tear
 * a distributed trace apart. Defaults to `parentbased_traceidratio`.
 */
export type ConfigTracingSamplerType =
  | 'always_on'
  | 'always_off'
  | 'traceidratio'
  | 'parentbased_always_on'
  | 'parentbased_always_off'
  | 'parentbased_traceidratio';

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
