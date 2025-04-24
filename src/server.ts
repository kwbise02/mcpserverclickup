import { Server as MCPServer } from '@modelcontextprotocol/sdk/server';
import { Transport } from '@modelcontextprotocol/sdk/transport';
import { Logger } from '@modelcontextprotocol/sdk/logger';

export function configureServer(transports: Transport[], logger: Logger) {
  return new MCPServer({
    transports,
    logger,
  });
}
