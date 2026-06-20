import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginationResultDto } from './pagination-result.dto.js';

export const ApiOkPaginatedResponse = <TModel extends Type<unknown>>(
  itemDto: TModel,
) =>
  applyDecorators(
    ApiExtraModels(PaginationResultDto, itemDto),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginationResultDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(itemDto) },
              },
            },
          },
        ],
      },
    }),
  );

