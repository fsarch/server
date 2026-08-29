import { Module } from '@nestjs/common';
import { ItemsModule } from './items/items.module.js';

@Module({
  imports: [ItemsModule],
})
export class AppModule {}
