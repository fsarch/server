import { Module } from "@nestjs/common";
import Joi from "joi";
import { CustomResourceController } from "./custom-resource.controller.js";
import {
  CUSTOM_RESOURCE,
  CustomResourceService,
} from "./custom-resource.service.js";
import { TCustomResourceDefinition } from "./custom-resource.types.js";

const CUSTOM_RESOURCE_ID_PATTERN = /^[a-z0-9_]+$/;

const REQUEST_SCHEMA = Joi.object({
  path: Joi.string().required(),
  method: Joi.string()
    .valid("GET", "POST", "PUT", "PATCH", "DELETE")
    .required(),
  auth: Joi.object({
    type: Joi.string().valid("credential-propagation").required(),
  }).required(),
  queryParams: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives(Joi.string(), Joi.array().items(Joi.string())),
  ),
});

const CUSTOM_RESOURCE_SCHEMA = Joi.array()
  .items(
    Joi.object({
      id: Joi.string().pattern(CUSTOM_RESOURCE_ID_PATTERN).required(),
      name: Joi.string().required(),
      description: Joi.string().required(),
      apiRoutes: Joi.object({
        list: Joi.object({
          request: REQUEST_SCHEMA.required(),
          enablePagination: Joi.boolean().required(),
        }).required(),
        get: Joi.object({
          request: REQUEST_SCHEMA.required(),
        }).required(),
        search: Joi.object({
          request: REQUEST_SCHEMA.required(),
          enablePagination: Joi.boolean().required(),
        }),
      }).required(),
    }),
  )
  .unique("id");

/**
 * Throws synchronously (at bootstrap) if `resources` doesn't match the
 * schema above. Shared by `forRoot()` and the per-mount custom resources of
 * `createServiceModule().register({ customResources })`.
 */
export function validateCustomResources(
  resources: TCustomResourceDefinition[],
): void {
  const { error } = CUSTOM_RESOURCE_SCHEMA.validate(resources, {
    abortEarly: false,
  });

  if (error) {
    throw new Error(`Invalid custom resources config: ${error.message}`);
  }
}

const URI_VERSION_SEGMENT = /^\/(v\d+)(?=\/|$)/;

/**
 * Rewrites a standalone route path to where the same route ends up when its
 * service is mounted under `prefix` via `RouterModule` - Nest's URI
 * versioning puts the version segment *in front of* the module prefix:
 * `/v1/parts/{{id}}` -> `/v1/<prefix>/parts/{{id}}`, while unversioned paths
 * just get the prefix: `/health` -> `/<prefix>/health`.
 */
export function prefixRoutePath(path: string, prefix: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const versionMatch = normalizedPath.match(URI_VERSION_SEGMENT);
  if (versionMatch) {
    const rest = normalizedPath.slice(versionMatch[0].length);
    return `/${versionMatch[1]}/${prefix}${rest}`;
  }
  return `/${prefix}${normalizedPath === "/" ? "" : normalizedPath}`;
}

/**
 * Applies `prefixRoutePath()` to every `apiRoutes` request path, so
 * definitions written for a standalone service point at the right routes
 * once that service is mounted under `prefix`.
 */
export function prefixCustomResourceRoutes(
  resources: TCustomResourceDefinition[],
  prefix: string,
): TCustomResourceDefinition[] {
  return resources.map((resource) => {
    const apiRoutes = Object.fromEntries(
      Object.entries(resource.apiRoutes).map(([routeName, route]) => [
        routeName,
        route
          ? {
              ...route,
              request: {
                ...route.request,
                path: prefixRoutePath(route.request.path, prefix),
              },
            }
          : route,
      ]),
    ) as TCustomResourceDefinition["apiRoutes"];
    return { ...resource, apiRoutes };
  });
}

export type CustomResourceModuleOptions = {
  resources: TCustomResourceDefinition[];
};

@Module({})
export class CustomResourceModule {
  static forRoot(options: CustomResourceModuleOptions) {
    validateCustomResources(options.resources);

    return {
      module: CustomResourceModule,
      controllers: [CustomResourceController],
      providers: [
        { provide: CUSTOM_RESOURCE, useValue: options.resources },
        CustomResourceService,
      ],
      exports: [CustomResourceService],
    };
  }
}
