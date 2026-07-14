import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import {
  loadAuthConfig,
  optionalBearerAuth,
  protectedResourceMetadata
} from "./auth.js";
import { buildServer } from "./mcp-app.js";

const widgetPath = fileURLToPath(new URL("../web/live-brief-widget.html", import.meta.url));
const widgetHtml = readFileSync(widgetPath, "utf8");

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8788);
const authConfig = loadAuthConfig();
const app = createMcpExpressApp({ host });
app.use(optionalBearerAuth(authConfig));

if (authConfig.mode === "supabase") {
  const metadata = protectedResourceMetadata(authConfig);
  app.get("/.well-known/oauth-protected-resource", (_request, response) => response.json(metadata));
  app.get("/.well-known/oauth-protected-resource/mcp", (_request, response) => response.json(metadata));
}

app.post("/mcp", async (request, response) => {
  const server = buildServer(authConfig, widgetHtml);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    console.error("Blackhawk MCP request failed.", error);
    if (!response.headersSent) {
      response.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  } finally {
    response.on("close", () => {
      void transport.close();
      void server.close();
    });
  }
});

app.get("/health", (_request, response) => response.json({ status: "ok", mode: authConfig.mode }));
app.get("/mcp", (_request, response) => response.status(405).json({ error: "Method not allowed" }));
app.delete("/mcp", (_request, response) => response.status(405).json({ error: "Method not allowed" }));

app.listen(port, host, (error?: Error) => {
  if (error) throw error;
  console.log(`Blackhawk MCP (${authConfig.mode}) listening on http://${host}:${port}/mcp`);
});
