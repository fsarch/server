import { Module } from '@nestjs/common';
import Joi from 'joi';
import { CustomResourceController } from './custom-resource.controller.js';
import {
  CustomResourceService,
  CUSTOM_RESOURCE,
} from './custom-resource.service.js';
import { TCustomResourceDefinition } from './custom-resource.types.js';

const CUSTOM_RESOURCE_ID_PATTERN = /^[a-z0-9_]+$/;

const REQUEST_SCHEMA = Joi.object({
  path: Joi.string().required(),
  method: Joi.string()
    .valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    .required(),
  auth: Joi.object({
    type: Joi.string().valid('credential-propagation').required(),
  }).required(),
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
      }).required(),
    }),
  )
  .unique('id');

export type CustomResourceModuleOptions = {
  resources: TCustomResourceDefinition[];
};

@Module({})
export class CustomResourceModule {
  static forRoot(options: CustomResourceModuleOptions) {
    const { error } = CUSTOM_RESOURCE_SCHEMA.validate(options.resources, {
      abortEarly: false,
    });

    if (error) {
      throw new Error(`Invalid custom resources config: ${error.message}`);
    }

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
