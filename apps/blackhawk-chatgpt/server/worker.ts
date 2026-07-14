import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import widgetHtml from "../web/live-brief-widget.html";
import { buildServer } from "./mcp-app.js";

const previewAuthConfig = { mode: "preview" as const };

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, last-event-id, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "mcp-protocol-version, mcp-session-id",
  "access-control-max-age": "86400"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
      "x-blackhawk-data-mode": "fictional-preview"
    }
  });
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  headers.set("x-blackhawk-data-mode", "fictional-preview");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleMcp(request: Request) {
  const server = buildServer(previewAuthConfig, widgetHtml);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  } catch (error) {
    console.error("Blackhawk Worker MCP request failed.", error);
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    return json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }, 500);
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "blackhawk-mcp", mode: "fictional-preview", liveSourcesConnected: false });
    }

    if (url.pathname === "/mcp") {
      if (request.method === "POST") return handleMcp(request);
      return json({ error: "Method not allowed" }, 405);
    }

    return json({ error: "Not found" }, 404);
  }
};
