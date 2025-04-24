import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const clickUpServices: Record<string, Tool> = {
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
    handler: async (params: { message: string }) => {
      return { message: params.message };
    }
  }
};
