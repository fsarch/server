import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ItemDto } from './item.dto.js';

@Injectable()
export class ItemsService {
  private readonly items = new Map<string, ItemDto>();

  findAll(): Array<ItemDto> {
    return [...this.items.values()];
  }

  findOne(id: string): ItemDto {
    const item = this.items.get(id);
    if (!item) {
      throw new NotFoundException(`Item "${id}" not found`);
    }
    return item;
  }

  create(name: string): ItemDto {
    const item: ItemDto = { id: randomUUID(), name };
    this.items.set(item.id, item);
    return item;
  }

  remove(id: string): void {
    if (!this.items.delete(id)) {
      throw new NotFoundException(`Item "${id}" not found`);
    }
  }
}
