import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Widget } from "./widget.entity.js";

@Injectable()
export class WidgetService {
  constructor(
    @InjectRepository(Widget)
    public readonly repository: Repository<Widget>,
    @InjectDataSource()
    public readonly dataSource: DataSource,
  ) {}
}
