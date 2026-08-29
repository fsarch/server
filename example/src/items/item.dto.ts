import { ApiProperty } from '@nestjs/swagger';

export class ItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class CreateItemDto {
  @ApiProperty()
  name!: string;
}
