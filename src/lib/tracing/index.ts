export type {
  ConfigTracingConsoleExporterType,
  ConfigTracingExporterType,
  ConfigTracingOtlpGrpcExporterType,
  ConfigTracingOtlpHttpExporterType,
  ConfigTracingType,
} from "../configuration/config.type.js";
export type { SpanOptions } from "./span.decorator.js";
export { Span, withSpan } from "./span.decorator.js";
export { getTracer, initializeTracing, shutdownTracing } from "./tracing.js";
export { TracingModule } from "./tracing.module.js";
