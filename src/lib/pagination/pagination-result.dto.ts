import { IPaginationResult, IPaginationResultMetadata } from './pagination-result.type.js';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationResultMetaDto implements IPaginationResultMetadata {
  @ApiProperty({
    description: 'Current page (1-based)',
    example: 1,
  })
  currentPage: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 25,
  })
  pageSize: number = 0;

  @ApiProperty({
    description: 'Total number of items available',
    example: 123,
  })
  totalItems: number = 0;

  @ApiProperty({
    description: 'Total pages available for the current pageSize',
    example: 5,
  })
  totalPages: number = 0;
}

export class PaginationResultDto<T> implements IPaginationResult<T> {
  @ApiProperty({
    description: 'Page data array',
    isArray: true,
    type: Object,
  })
  data: Array<T> = [];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationResultMetaDto,
  })
  metadata: PaginationResultMetaDto = new PaginationResultMetaDto();
}
