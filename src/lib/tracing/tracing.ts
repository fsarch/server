import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ConsoleSpanExporter,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type Sampler,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Metadata } from '@grpc/grpc-js';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { trace, type Tracer } from '@opentelemetry/api';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { loadConfigFile } from '../configuration/configuration.js';
import { TRACING_CONFIG_VALIDATOR } from './tracing-config.validator.js';
import {
  ConfigTracingExporterType,
  ConfigTracingSamplerType,
} from '../configuration/config.type.js';

const DEFAULT_TRACER_NAME = 'fsarch';
const DEFAULT_SAMPLER: ConfigTracingSamplerType = 'parentbased_traceidratio';
const DEFAULT_SERVICE_NAME = 'fsarch-service';

function createSampler(
  samplerType: ConfigTracingSamplerType,
  sampleRatio: number,
): Sampler {
  switch (samplerType) {
    case 'always_on':
      return new AlwaysOnSampler();
    case 'always_off':
      return new AlwaysOffSampler();
    case 'traceidratio':
      return new TraceIdRatioBasedSampler(sampleRatio);
    case 'parentbased_always_on':
      return new ParentBasedSampler({ root: new AlwaysOnSampler() });
    case 'parentbased_always_off':
      return new ParentBasedSampler({ root: new AlwaysOffSampler() });
    case 'parentbased_traceidratio':
      return new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(sampleRatio),
      });
    default:
      throw new Error(`Tracing sampler type unknown: ${samplerType as string}`);
  }
}

let sdk: NodeSDK | undefined;

function createExporter(exporterConfig: ConfigTracingExporterType): SpanExporter {
  switch (exporterConfig.type) {
    case 'console':
      return new ConsoleSpanExporter();
    case 'otlp-http':
      return new OTLPTraceExporterHttp({
        url: exporterConfig.url,
        headers: exporterConfig.headers,
      });
    case 'otlp-grpc': {
      const metadata = new Metadata();
      for (const [key, value] of Object.entries(exporterConfig.headers ?? {})) {
        metadata.set(key, value);
      }

      return new OTLPTraceExporterGrpc({
        url: exporterConfig.url,
        metadata,
      });
    }
    default:
      throw new Error(
        `Tracing exporter type unknown: ${(exporterConfig as { type: string }).type}`,
      );
  }
}

/**
 * Reads the `tracing` section of `config.yaml` and, if enabled, starts the
 * OpenTelemetry NodeSDK with instrumentation for the HTTP/Express/Postgres/Nest
 * stack used by fsarch services.
 *
 * IMPORTANT: auto-instrumentation only patches modules that haven't been
 * loaded yet. `http`/`express`/`pg`/`@nestjs/core` are essentially always
 * already loaded by the time application code (including
 * `FsArchAppBuilder.build()`) runs, because ESM resolves a file's entire
 * static `import` graph before executing any of its top-level code — so
 * calling this from inside the app is too late to instrument any of that.
 * Use the `@fsarch/server/register` preload instead (see its module doc),
 * which calls this function before the app's own module graph loads at all.
 * `FsArchAppBuilder.build()` still calls this too, purely so
 * `getTracer()`/`@Span()`/`withSpan()` and shutdown-hook wiring work even for
 * services that only need manual spans and skip the preload.
 *
 * `defaults` is optional because the preload has no access to the
 * `name`/`version` passed to `FsArchAppBuilder` (that object doesn't exist
 * yet at preload time) — set `tracing.serviceName` in `config.yaml` or the
 * `OTEL_SERVICE_NAME` env var to name the service in that case.
 *
 * Safe to call multiple times: it only ever starts the SDK once.
 *
 * @returns `true` if tracing was started, `false` if it is disabled/not configured.
 */
export function initializeTracing(defaults?: {
  serviceName?: string;
  serviceVersion?: string;
}): boolean {
  if (sdk) {
    return true;
  }

  const rawConfig = loadConfigFile();
  const tracingConfig = rawConfig.tracing;

  if (!tracingConfig?.enabled) {
    return false;
  }

  const valid = TRACING_CONFIG_VALIDATOR.validate(tracingConfig, {
    abortEarly: false,
  });
  if (valid.error) {
    console.error('error while validating config', valid.error.details);
    throw new Error('invalid config');
  }

  const serviceName =
    tracingConfig.serviceName ??
    defaults?.serviceName ??
    process.env.OTEL_SERVICE_NAME ??
    DEFAULT_SERVICE_NAME;

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      ...(defaults?.serviceVersion
        ? { [ATTR_SERVICE_VERSION]: defaults.serviceVersion }
        : {}),
    }),
    traceExporter: createExporter(tracingConfig.exporter as ConfigTracingExporterType),
    sampler: createSampler(
      tracingConfig.sampler ?? DEFAULT_SAMPLER,
      tracingConfig.sampleRatio ?? 1,
    ),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PgInstrumentation(),
      new NestInstrumentation(),
    ],
  });

  sdk.start();

  return true;
}

/**
 * Flushes and shuts down the tracing SDK, if it was started. Hooked into
 * Nest's `OnApplicationShutdown` by `TracingModule` so spans are flushed
 * before the process exits.
 */
export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  const instance = sdk;
  sdk = undefined;
  await instance.shutdown();
}

/**
 * Returns a tracer for creating custom spans in application code. Works
 * regardless of whether tracing is enabled: with no SDK started, spans are
 * simply no-ops.
 */
export function getTracer(name: string = DEFAULT_TRACER_NAME): Tracer {
  return trace.getTracer(name);
}
