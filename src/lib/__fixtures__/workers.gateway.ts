import { Injectable } from "@nestjs/common";
import { SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";

@WebSocketGateway({ path: "/api/workers/websocket", transports: "websocket" })
export class WorkersGateway {
  @SubscribeMessage("ping")
  ping() {
    return "pong";
  }
}

@WebSocketGateway()
export class RootGateway {}

@WebSocketGateway(8099, { path: "/own-port" })
export class OwnPortGateway {}

@Injectable()
export class UsesGateway {
  constructor(readonly gateway: WorkersGateway) {}
}
