import { describe, it, expect, vi } from 'vitest';
import { CustomResourceController } from './custom-resource.controller';
import { CustomResourceService } from './custom-resource.service';

describe('CustomResourceController', () => {
  it('wraps the service result in a data property', async () => {
    const resources = [{ id: 'part_attachment' }];
    const service = {
      getAll: vi.fn().mockReturnValue(resources),
    } as unknown as CustomResourceService;
    const controller = new CustomResourceController(service);

    const result = await controller.List();

    expect(result).toEqual({ data: resources });
  });
});
