import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { OnHardDelete } from "./deletion.decorator.js";
import { DeletionExplorer } from "./deletion.explorer.js";

// `@OnHardDelete(...)` is applied by calling the decorator function
// directly (rather than with `@` syntax) - vitest's transform pipeline for
// `.spec.ts` files doesn't parse an inline decorated class the same way
// `tsc`/esbuild's CLI does, even though this is exactly the metadata shape
// the real `@OnHardDelete` decorator produces in application code.
class MetricHandler {
  public calls: Array<{ cutOffDate: Date }> = [];

  async handleMetricDeletion(payload: { cutOffDate: Date }) {
    this.calls.push(payload);
  }
}
OnHardDelete("metric")(
  MetricHandler.prototype,
  "handleMetricDeletion",
  Object.getOwnPropertyDescriptor(
    MetricHandler.prototype,
    "handleMetricDeletion",
  )!,
);

class CalendarHandler {
  public calls: Array<{ cutOffDate: Date }> = [];

  async handleCalendarDeletion(payload: { cutOffDate: Date }) {
    this.calls.push(payload);
  }
}
OnHardDelete("calendar")(
  CalendarHandler.prototype,
  "handleCalendarDeletion",
  Object.getOwnPropertyDescriptor(
    CalendarHandler.prototype,
    "handleCalendarDeletion",
  )!,
);

function wrapperFor(instance: object) {
  return { instance } as any;
}

class FakeEventEmitter {
  private listeners = new Map<string, Array<(payload: any) => void>>();

  on(event: string, listener: (payload: any) => void) {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
  }

  async emit(event: string, payload: any) {
    for (const listener of this.listeners.get(event) ?? []) {
      await listener(payload);
    }
  }
}

describe("DeletionExplorer", () => {
  it("discovers process-wide when no scopeModule is set (unscoped, default behavior)", async () => {
    const metricHandler = new MetricHandler();
    const getProviders = vi
      .fn()
      .mockReturnValue([wrapperFor(metricHandler)]);
    const discoveryService = { getProviders } as any;
    const eventEmitter = new FakeEventEmitter();

    const explorer = new DeletionExplorer(
      discoveryService,
      new Reflector(),
      eventEmitter as any,
      {},
    );
    await explorer.onApplicationBootstrap();

    expect(getProviders).toHaveBeenCalledWith();

    const cutOffDate = new Date();
    await eventEmitter.emit("fsarch.deletion", {
      getCutOffDate: () => cutOffDate,
    });
    expect(metricHandler.calls).toEqual([{ cutOffDate }]);
  });

  it("restricts discovery to the given scopeModule when mounted", async () => {
    const metricHandler = new MetricHandler();
    const getProviders = vi
      .fn()
      .mockReturnValue([wrapperFor(metricHandler)]);
    const discoveryService = { getProviders } as any;
    const eventEmitter = new FakeEventEmitter();
    class MetricMountModule {}

    const explorer = new DeletionExplorer(
      discoveryService,
      new Reflector(),
      eventEmitter as any,
      { serviceId: "metric-main", scopeModule: MetricMountModule },
    );
    await explorer.onApplicationBootstrap();

    expect(getProviders).toHaveBeenCalledWith({ include: [MetricMountModule] });
  });

  it("never lets one mount's purge tick invoke another mount's handler", async () => {
    const metricHandler = new MetricHandler();
    const calendarHandler = new CalendarHandler();
    class MetricMountModule {}
    class CalendarMountModule {}

    // Two mounts sharing one process-wide EventEmitter2, exactly like a
    // real mono-service harness — the thing this scoping is meant to
    // protect against.
    const eventEmitter = new FakeEventEmitter();

    // Metric mount's explorer only ever sees its own module's providers.
    const metricExplorer = new DeletionExplorer(
      { getProviders: vi.fn().mockReturnValue([wrapperFor(metricHandler)]) } as any,
      new Reflector(),
      eventEmitter as any,
      { serviceId: "metric-main", scopeModule: MetricMountModule },
    );
    // Calendar mount's explorer only ever sees its own module's providers.
    const calendarExplorer = new DeletionExplorer(
      { getProviders: vi.fn().mockReturnValue([wrapperFor(calendarHandler)]) } as any,
      new Reflector(),
      eventEmitter as any,
      { serviceId: "calendar-main", scopeModule: CalendarMountModule },
    );

    await metricExplorer.onApplicationBootstrap();
    await calendarExplorer.onApplicationBootstrap();

    // Metric mount's own purge tick fires only its own namespaced event.
    const metricCutoff = new Date();
    await eventEmitter.emit("fsarch.deletion:metric-main", {
      getCutOffDate: () => metricCutoff,
    });

    expect(metricHandler.calls).toEqual([{ cutOffDate: metricCutoff }]);
    expect(calendarHandler.calls).toEqual([]);
  });
});
