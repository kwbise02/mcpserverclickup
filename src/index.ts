#!/usr/bin/env node

/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * ClickUp MCP Server
 * 
 * This custom server implements the Model Context Protocol (MCP) specification to enable
 * AI applications to interact with ClickUp workspaces. It provides a standardized 
 * interface for managing tasks, lists, folders and other ClickUp entities using Natural Language.
 * 
 * Key Features:
 * - Complete task management (CRUD operations, moving, duplicating)
 * - Workspace organization (spaces, folders, lists)
 * - Bulk operations with concurrent processing
 * - Natural language date parsing
 * - File attachments support
 * - Name-based entity resolution
 * - Markdown formatting
 * - Built-in rate limiting
 * 
 * For full documentation and usage examples, please refer to the README.md file.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { configureServer, server } from "./server.js";
import { clickUpServices } from "./services/shared.js";
import { info, error } from "./logger.js";
import config from "./config.js";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { randomUUID } from 'crypto';
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

// Get directory name for module paths
const __dirname = dirname(fileURLToPath(import.meta.url));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  error("Uncaught Exception", { message: err.message, stack: err.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  error("Unhandled Rejection", { reason });
  process.exit(1);
});

/**
 * Application entry point that configures and starts the MCP server.
 */
async function main() {
  try {
    console.log("Starting ClickUp MCP Server...");
    
    // Log essential information about the environment
    info("Server environment", {
      pid: process.pid,
      node: process.version,
      os: process.platform,
      arch: process.arch
    });
    
    // Configure the server with all handlers
    console.log("Configuring server request handlers");
    await configureServer();

    // Check if we should use HTTP transport
    const useHttp = process.env.USE_HTTP === 'true';
    const port = parseInt(process.env.PORT || '3000', 10);
    
    if (useHttp) {
      console.log("Using HTTP transport");
      const app = express();
      
      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
      });

      // Map to store transports by session ID
      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Handle POST requests for client-to-server communication
      app.post('/mcp', async (req, res) => {
        console.log('Received POST request to /mcp');
        
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        try {
          if (sessionId && transports[sessionId]) {
            // Reuse existing transport
            transport = transports[sessionId];
            console.log('Using existing transport for session:', sessionId);
          } else if (!sessionId && isInitializeRequest(req.body)) {
            console.log('Creating new transport for initialization request');
            // New initialization request
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (sessionId) => {
                // Store the transport by session ID
                transports[sessionId] = transport;
                console.log('New session initialized:', sessionId);
              }
            });

            // Clean up transport when closed
            transport.onclose = () => {
              if (transport.sessionId) {
                delete transports[transport.sessionId];
                console.log('Session closed:', transport.sessionId);
              }
            };

            await server.connect(transport);
            console.log('Server connected to transport');
          } else {
            console.log('Invalid request - missing session ID or not an initialize request');
            res.status(400).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided',
              },
              id: null,
            });
            return;
          }

          // Handle the request
          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          console.error('Error handling request:', error);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: null,
            });
          }
        }
      });

      // Reusable handler for GET and DELETE requests
      const handleSessionRequest = async (req: express.Request, res: express.Response) => {
        console.log(`Received ${req.method} request to /mcp`);
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          console.log('Invalid or missing session ID:', sessionId);
          res.status(400).send('Invalid or missing session ID');
          return;
        }
        
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      };

      // Handle GET requests for server-to-client notifications via SSE
      app.get('/mcp', handleSessionRequest);

      // Handle DELETE requests for session termination
      app.delete('/mcp', handleSessionRequest);
      
      // Start HTTP server
      app.listen(port, '0.0.0.0', () => {
        console.log(`HTTP server listening on http://0.0.0.0:${port}`);
        console.log('Environment variables loaded:');
        console.log('- CLICKUP_API_KEY:', process.env.CLICKUP_API_KEY ? '[Set]' : '[Not Set]');
        console.log('- CLICKUP_TEAM_ID:', process.env.CLICKUP_TEAM_ID ? '[Set]' : '[Not Set]');
      });
    } else {
      // Connect using stdio transport
      console.log("Using stdio transport");
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }
    
    console.log("Server startup complete - ready to handle requests");
  } catch (err) {
    console.error("Error during server startup:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  error("Unhandled server error", { message: err.message, stack: err.stack });
  process.exit(1);
});
