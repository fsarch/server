import { describe, it, expect } from 'vitest';
import { CustomResourceService } from './custom-resource.service';
import { TCustomResourceDefinition } from './custom-resource.types';

describe('CustomResourceService', () => {
  const resources: TCustomResourceDefinition[] = [
    {
      id: 'part_attachment',
      name: 'Part Attachment',
      description: 'Attachments of a part',
      apiRoutes: {
        list: {
          request: {
            path: '/parts/{{id}}/attachments',
            method: 'GET',
            auth: { type: 'credential-propagation' },
          },
          enablePagination: true,
        },
        get: {
          request: {
            path: '/parts/{{id}}/attachments/{{id}}',
            method: 'GET',
            auth: { type: 'credential-propagation' },
          },
        },
      },
    },
  ];

  it('should be defined', () => {
    const service = new CustomResourceService([]);
    expect(service).toBeDefined();
  });

  it('returns the resources it was constructed with', () => {
    const service = new CustomResourceService(resources);
    expect(service.getAll()).toEqual(resources);
  });
});
