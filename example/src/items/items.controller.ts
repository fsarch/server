import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ItemsService } from './items.service.js';
import { CreateItemDto, ItemDto } from './item.dto.js';

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiOkResponse({ type: ItemDto, isArray: true })
  findAll(): Array<ItemDto> {
    return this.itemsService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: ItemDto })
  findOne(@Param('id') id: string): ItemDto {
    return this.itemsService.findOne(id);
  }

  @Post()
  @ApiOkResponse({ type: ItemDto })
  create(@Body() body: CreateItemDto): ItemDto {
    return this.itemsService.create(body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): void {
    this.itemsService.remove(id);
  }
}
