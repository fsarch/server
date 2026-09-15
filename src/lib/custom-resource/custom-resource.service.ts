import { Inject, Injectable } from '@nestjs/common';
import { TCustomResourceDefinition } from './custom-resource.types.js';

export const CUSTOM_RESOURCE = Symbol('CUSTOM_RESOURCE');

@Injectable()
export class CustomResourceService {
  constructor(
    @Inject(CUSTOM_RESOURCE)
    private readonly resources: TCustomResourceDefinition[],
  ) {}

  public getAll(): TCustomResourceDefinition[] {
    return this.resources;
  }
}
