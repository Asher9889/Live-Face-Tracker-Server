import { WebSocketServer, WebSocket } from "ws";
import http from "http";

export class WSStreamServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws, req) => {
    // ws another ws object represent the unique/different client
      this.clients.add(ws);
      console.log("Total Client connected", this.clients.size);

      ws.on("ping", () => {
        ws.pong();
      })

      ws.on("error", () => {
        this.clients.delete(ws);
        console.log("Total Client connected", this.clients.size);
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log("Total Client connected", this.clients.size);
      });
    });

    this.wss.on("close", () => {
      console.log("WS closed");
      this.clients.clear();
    });
  }

  broadcast(data: Record<string, any>) {
    if(this.clients.size === 0) return;
    console.log("Broadcasting to", this.clients.size, "clients");

    for(let client of this.clients){
      if(client.readyState === WebSocket.OPEN) { // 1
        client.send(JSON.stringify(data));
      }
    }
  }
}




