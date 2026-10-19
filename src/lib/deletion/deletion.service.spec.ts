import { describe, expect, it, vi } from "vitest";
import { DeletionService } from "./deletion.service.js";

function buildService(scope: { serviceId?: string } = {}) {
  const addCronJob = vi.fn();
  const schedulerRegistry = { addCronJob } as any;
  const emit = vi.fn();
  const eventEmitter = { emit } as any;
  const service = new DeletionService(schedulerRegistry, eventEmitter, scope);
  return { service, addCronJob, emit };
}

const config = {
  hardDeleteAfterDays: 30,
  purgeSchedule: { cron: "0 0 * * *", timezone: "UTC" },
};

describe("DeletionService", () => {
  it("registers the cron job under the unscoped name when no serviceId is set", () => {
    const { service, addCronJob } = buildService();
    service.setupDeletionJob(config);
    expect(addCronJob).toHaveBeenCalledWith("metric-purge", expect.anything());
  });

  it("namespaces the cron job name per serviceId", () => {
    const { service, addCronJob } = buildService({ serviceId: "metric-main" });
    service.setupDeletionJob(config);
    expect(addCronJob).toHaveBeenCalledWith(
      "deletion-purge:metric-main",
      expect.anything(),
    );
  });

  it("emits the unscoped event name when no serviceId is set", async () => {
    const { service, emit } = buildService();
    // @ts-expect-error private method, exercised directly to avoid waiting on a real cron tick
    await service.handleDeletionJob(config);
    expect(emit).toHaveBeenCalledWith("fsarch.deletion", expect.anything());
  });

  it("namespaces the emitted event per serviceId, so one mount's purge tick can never reach another mount's handlers", async () => {
    const { service, emit } = buildService({ serviceId: "metric-main" });
    // @ts-expect-error private method, exercised directly to avoid waiting on a real cron tick
    await service.handleDeletionJob(config);
    expect(emit).toHaveBeenCalledWith(
      "fsarch.deletion:metric-main",
      expect.anything(),
    );
  });
});
