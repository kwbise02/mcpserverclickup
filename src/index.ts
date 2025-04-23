import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from 'crypto';
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

console.log('Starting server initialization...');

// Create the server instance
const server = new Server(
    {
        name: "clickup-mcp-server",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {},
            logging: {}
        }
    }
);

console.log('Server instance created');

// Express app setup
const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Handle POST requests for client-server communication
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP Streamable HTTP Server listening on http://0.0.0.0:${PORT}`);
    console.log('Environment variables loaded:');
    console.log('- CLICKUP_API_KEY:', process.env.CLICKUP_API_KEY ? '[Set]' : '[Not Set]');
    console.log('- CLICKUP_TEAM_ID:', process.env.CLICKUP_TEAM_ID ? '[Set]' : '[Not Set]');
});
