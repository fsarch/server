export { initializeTracing, shutdownTracing, getTracer } from './tracing.js';
export { TracingModule } from './tracing.module.js';
export { Span, withSpan } from './span.decorator.js';
export type { SpanOptions } from './span.decorator.js';
export type {
  ConfigTracingType,
  ConfigTracingExporterType,
  ConfigTracingConsoleExporterType,
  ConfigTracingOtlpHttpExporterType,
  ConfigTracingOtlpGrpcExporterType,
} from '../configuration/config.type.js';
