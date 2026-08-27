export { initializeTracing, shutdownTracing, getTracer } from './tracing.js';
export { TracingModule } from './tracing.module.js';
export type {
  ConfigTracingType,
  ConfigTracingExporterType,
  ConfigTracingConsoleExporterType,
  ConfigTracingOtlpHttpExporterType,
  ConfigTracingOtlpGrpcExporterType,
} from '../configuration/config.type.js';
