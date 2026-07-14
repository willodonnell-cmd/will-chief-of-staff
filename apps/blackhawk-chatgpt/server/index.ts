import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { previewBrief } from "./fixture.js";

const WIDGET_URI = "ui://blackhawk/live-brief-v1.html";
const widgetPath = fileURLToPath(new URL("../web/live-brief-widget.html", import.meta.url));
const widgetHtml = readFileSync(widgetPath, "utf8");

function buildServer() {
  const server = new McpServer(
    { name: "blackhawk", version: "0.1.0" },
    {
      instructions:
        "Show the current Blackhawk brief before requesting a refresh. Never send email or Teams messages. Keep Investment Committee work outside the main brief. Treat preview data as fictional."
    }
  );

  registerAppResource(server, "blackhawk-live-brief", WIDGET_URI, {}, async () => ({
    contents: [{
      uri: WIDGET_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: widgetHtml,
      _meta: { ui: { prefersBorder: false } }
    }]
  }));

  registerAppTool(server, "show_live_brief", {
    title: "Show Blackhawk live brief",
    description: "Shows Will's current canonical Blackhawk executive brief. In the Phase 1 checkpoint this returns clearly marked preview data.",
    inputSchema: {},
    outputSchema: { mode: z.literal("preview"), brief: z.record(z.string(), z.unknown()) },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    _meta: {
      ui: { resourceUri: WIDGET_URI, visibility: ["model", "app"] },
      "openai/toolInvocation/invoking": "Opening Blackhawk…",
      "openai/toolInvocation/invoked": "Blackhawk brief ready."
    }
  }, async () => ({
    structuredContent: previewBrief,
    content: [{ type: "text", text: "Showing the Phase 1 Blackhawk preview brief. All displayed people, companies, and sources are fictional preview data." }],
    _meta: { preview: true }
  }));

  registerAppTool(server, "request_brief_refresh", {
    title: "Refresh Blackhawk brief",
    description: "Requests an idempotent refresh of the current brief. The Phase 1 checkpoint simulates the refresh without accessing live sources.",
    inputSchema: {},
    outputSchema: { mode: z.literal("preview"), brief: z.record(z.string(), z.unknown()) },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    _meta: {
      ui: { resourceUri: WIDGET_URI, visibility: ["model", "app"] },
      "openai/toolInvocation/invoking": "Refreshing Blackhawk…",
      "openai/toolInvocation/invoked": "Preview refresh complete."
    }
  }, async () => ({
    structuredContent: previewBrief,
    content: [{ type: "text", text: "Preview refresh complete. No live source or production state was accessed." }],
    _meta: { preview: true, refreshSimulated: true }
  }));

  registerAppTool(server, "get_brief_item", {
    title: "Expand Blackhawk brief item",
    description: "Returns the source-backed detail already present for one displayed brief item.",
    inputSchema: { itemId: z.string().min(1) },
    outputSchema: { itemId: z.string(), found: z.boolean() },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    _meta: { ui: { visibility: ["app"] } }
  }, async ({ itemId }) => {
    type PreviewItemSummary = { id: string; headline: string; explanation: string };
    const sections = Object.values(previewBrief.brief.sections) as Array<{ items: readonly PreviewItemSummary[] }>;
    const item = sections.flatMap((section) => section.items).find((candidate) => candidate.id === itemId);
    return {
      structuredContent: { itemId, found: Boolean(item) },
      content: item ? [{ type: "text", text: `${item.headline}: ${item.explanation}` }] : [] ,
      _meta: { item: item ?? null, preview: true }
    };
  });

  return server;
}

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8788);
const app = createMcpExpressApp({ host });

app.post("/mcp", async (request, response) => {
  const server = buildServer();
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

app.get("/health", (_request, response) => response.json({ status: "ok", mode: "preview" }));
app.get("/mcp", (_request, response) => response.status(405).json({ error: "Method not allowed" }));
app.delete("/mcp", (_request, response) => response.status(405).json({ error: "Method not allowed" }));

app.listen(port, host, (error?: Error) => {
  if (error) throw error;
  console.log(`Blackhawk MCP preview listening on http://${host}:${port}/mcp`);
});
