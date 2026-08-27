import { SpanStatusCode, type Span as OtelSpan } from '@opentelemetry/api';
import { getTracer } from './tracing.js';

export type SpanOptions = {
  /** Span name. For `@Span()` defaults to `ClassName.methodName`; required for `withSpan()`. */
  name?: string;
  /** Name of the tracer the span is created on. Defaults to the shared 'fsarch' tracer. */
  tracerName?: string;
  /** Attributes set on the span right away. */
  attributes?: Record<string, string | number | boolean>;
};

function finishSpan(span: OtelSpan, error?: unknown): void {
  if (error !== undefined) {
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  span.end();
}

/**
 * Runs `fn` inside a new active span called `name`, recording exceptions and
 * setting the span status. Works for both sync and async (Promise-returning) `fn`
 * — use it to trace a block of code that isn't a whole class method (`@Span()`
 * covers that case).
 *
 * @example
 * ```typescript
 * const claims = await withSpan('claims.fetch-from-provider', () => provider.fetch());
 * ```
 */
export function withSpan<T>(
  name: string,
  fn: (span: OtelSpan) => T,
  options?: Omit<SpanOptions, 'name'>,
): T {
  const tracer = getTracer(options?.tracerName);

  return tracer.startActiveSpan(name, (span) => {
    if (options?.attributes) {
      span.setAttributes(options.attributes);
    }

    try {
      const result = fn(span);

      if (result instanceof Promise) {
        return result.then(
          (value) => {
            finishSpan(span);
            return value;
          },
          (error) => {
            finishSpan(span, error);
            throw error;
          },
        ) as T;
      }

      finishSpan(span);
      return result;
    } catch (error) {
      finishSpan(span, error);
      throw error;
    }
  });
}

/**
 * Method decorator that wraps a controller/service/repository/helper method in
 * a span. Works for both sync and async methods; the span name defaults to
 * `ClassName.methodName`.
 *
 * @example
 * ```typescript
 * class ClaimsService {
 *   @Span()
 *   async listClaims() { ... }
 *
 *   @Span({ name: 'claims.enrich', attributes: { component: 'claims' } })
 *   enrich(claim: Claim) { ... }
 * }
 * ```
 */
export function Span(options?: SpanOptions) {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    if (typeof originalMethod !== 'function') {
      return descriptor;
    }

    const className =
      (target as { constructor?: { name?: string } })?.constructor?.name ??
      (target as { name?: string })?.name ??
      'UnknownClass';
    const spanName = options?.name ?? `${className}.${String(propertyKey)}`;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      return withSpan(spanName, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
