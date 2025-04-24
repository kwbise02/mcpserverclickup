import { MCPTool } from "@modelcontextprotocol/sdk/types.js";

export const clickUpServices: Record<string, MCPTool> = {
  // You can add your ClickUp tools here
  echo: {
    description: "Echo test tool",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Message to echo"
        }
      },
      required: ["message"]
    },
    handler: async (params) => {
      return { message: params.message };
    }
  }
};
