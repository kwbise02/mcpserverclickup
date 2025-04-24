import { Server as MCPServer } from "@modelcontextprotocol/sdk";
import { clickUpServices } from "./services/shared.js";

export const server = new MCPServer();

export async function configureServer() {
  for (const [name, service] of Object.entries(clickUpServices)) {
    server.addTool(name, service);
  }
}
