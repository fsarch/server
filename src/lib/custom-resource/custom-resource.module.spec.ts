import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { CustomResourceModule } from './custom-resource.module';
import { CustomResourceService } from './custom-resource.service';
import { TCustomResourceDefinition } from './custom-resource.types';

const validResource: TCustomResourceDefinition = {
  id: 'part_attachment',
  name: 'Part Attachment',
  description: 'Attachments of a part',
  apiRoutes: {
    list: {
      request: {
        path: '/parts/{{id}}/attachments',
        method: 'GET',
        auth: { type: 'credential-propagation' },
        queryParams: {
          type: 'image',
          tags: ['a', 'b'],
        },
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
    search: {
      request: {
        path: '/parts/{{id}}/attachments/search',
        method: 'GET',
        auth: { type: 'credential-propagation' },
        queryParams: {
          q: '{{query}}',
        },
      },
      enablePagination: true,
    },
  },
};

describe('CustomResourceModule', () => {
  it('builds a module and resolves CustomResourceService for a valid config', async () => {
    const module = await Test.createTestingModule({
      imports: [
        CustomResourceModule.forRoot({ resources: [validResource] }),
      ],
    }).compile();

    expect(module.get(CustomResourceService)).toBeDefined();
  });

  it('accepts an empty resource list', () => {
    expect(() =>
      CustomResourceModule.forRoot({ resources: [] }),
    ).not.toThrow();
  });

  it.each(['Part-Attachment', 'part attachment', 'part-attachment'])(
    'rejects an invalid id "%s"',
    (id) => {
      expect(() =>
        CustomResourceModule.forRoot({
          resources: [{ ...validResource, id }],
        }),
      ).toThrow();
    },
  );

  it('rejects duplicate ids', () => {
    expect(() =>
      CustomResourceModule.forRoot({
        resources: [validResource, validResource],
      }),
    ).toThrow();
  });

  it('accepts a resource without a search route', () => {
    const { search, ...apiRoutesWithoutSearch } = validResource.apiRoutes;
    expect(() =>
      CustomResourceModule.forRoot({
        resources: [{ ...validResource, apiRoutes: apiRoutesWithoutSearch }],
      }),
    ).not.toThrow();
  });

  it('rejects queryParams with a value that is neither a string nor an array of strings', () => {
    expect(() =>
      CustomResourceModule.forRoot({
        resources: [
          {
            ...validResource,
            apiRoutes: {
              ...validResource.apiRoutes,
              list: {
                ...validResource.apiRoutes.list,
                request: {
                  ...validResource.apiRoutes.list.request,
                  queryParams: { nested: { not: 'allowed' } as never },
                },
              },
            },
          },
        ],
      }),
    ).toThrow();
  });
});
