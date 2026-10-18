import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Widget {
  @PrimaryColumn("varchar")
  id!: string;

  @Column("varchar")
  name!: string;
}
