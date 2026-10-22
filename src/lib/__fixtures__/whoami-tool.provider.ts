import { Module } from "@nestjs/common";
import { McpController, Tool } from "@rekog/mcp-nest";
import { z } from "zod";
import { WidgetService } from "./widget.service.js";

@McpController()
export class WhoAmIToolProvider {
  constructor(private readonly widgetService: WidgetService) {}

  @Tool({
    name: "whoami",
    description:
      "Returns the TypeORM connection name of the mount serving this call",
    parameters: z.object({}),
  })
  async whoami() {
    return {
      content: [
        {
          type: "text" as const,
          text: String(
            (this.widgetService.dataSource.options as { name?: string }).name,
          ),
        },
      ],
    };
  }
}

@Module({})
export class EmptyAppModule {}
