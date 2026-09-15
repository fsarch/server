import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomResourceService } from './custom-resource.service.js';

@ApiTags('.meta')
@Controller({ path: '.meta/custom-resources', version: '1' })
@ApiBearerAuth()
export class CustomResourceController {
  constructor(
    private readonly customResourceService: CustomResourceService,
  ) {}

  @Get()
  public async List() {
    return { data: this.customResourceService.getAll() };
  }
}
