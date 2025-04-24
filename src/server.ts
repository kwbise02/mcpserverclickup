import { MCPServer } from "@modelcontextprotocol/sdk/server.js";
import { clickUpServices } from "./services/shared.js";

export const server = new MCPServer();

export async function configureServer() {
  // Add ClickUp services to the server
  for (const [name, service] of Object.entries(clickUpServices)) {
    server.addTool(name, service);
  }
}
