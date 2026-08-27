import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpanStatusCode } from '@opentelemetry/api';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

const exporter = new InMemorySpanExporter();
// A provider that isn't registered as the global tracer provider: spans are
// captured directly through it instead of routing through `@opentelemetry/api`'s
// global registration, which is process-wide state other spec files touch too.
const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});

vi.mock('./tracing.js', () => ({
  getTracer: (name?: string) => provider.getTracer(name ?? 'fsarch'),
}));

const { Span, withSpan } = await import('./span.decorator.js');

// Applies a decorator factory the same way `@Span()` would at the class
// declaration, without relying on decorator syntax being parsed in this
// file: tsconfig.json excludes `**/*.spec.ts` from experimentalDecorators
// support (it isn't part of the compiled project), so `@Span()` can't be
// written directly here even though it works fine in real, non-test source.
function applyMethodDecorator(
  decorator: (target: object, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor,
  prototype: object,
  methodName: string,
) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName)!;
  Object.defineProperty(prototype, methodName, decorator(prototype, methodName, descriptor));
}

beforeEach(() => {
  exporter.reset();
});

describe('withSpan', () => {
  it('records a successful span', async () => {
    const result = await withSpan('my-span', async () => 'ok');

    expect(result).toBe('ok');
    const [span] = exporter.getFinishedSpans();
    expect(span.name).toBe('my-span');
    expect(span.status.code).toBe(SpanStatusCode.OK);
  });

  it('records a sync exception and rethrows synchronously', () => {
    const error = new Error('boom');

    expect(() =>
      withSpan('failing-span-sync', () => {
        throw error;
      }),
    ).toThrow('boom');

    const [span] = exporter.getFinishedSpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.events.some((event) => event.name === 'exception')).toBe(true);
  });

  it('records an async rejection and rethrows', async () => {
    await expect(
      withSpan('failing-span-async', async () => {
        throw new Error('boom-async');
      }),
    ).rejects.toThrow('boom-async');

    const [span] = exporter.getFinishedSpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
  });
});

describe('Span()', () => {
  class Calculator {
    add(a: number, b: number): number {
      return a + b;
    }

    async fail(): Promise<void> {
      throw new Error('nope');
    }
  }

  applyMethodDecorator(Span(), Calculator.prototype, 'add');
  applyMethodDecorator(Span({ name: 'calculator.fail' }), Calculator.prototype, 'fail');

  it('wraps a sync method and defaults the span name to ClassName.methodName', () => {
    const calculator = new Calculator();

    expect(calculator.add(1, 2)).toBe(3);

    const [span] = exporter.getFinishedSpans();
    expect(span.name).toBe('Calculator.add');
    expect(span.status.code).toBe(SpanStatusCode.OK);
  });

  it('wraps an async method, uses the given name and records failures', async () => {
    const calculator = new Calculator();

    await expect(calculator.fail()).rejects.toThrow('nope');

    const [span] = exporter.getFinishedSpans();
    expect(span.name).toBe('calculator.fail');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
  });
});
