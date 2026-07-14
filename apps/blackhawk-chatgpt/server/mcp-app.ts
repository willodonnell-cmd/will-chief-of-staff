import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { authChallenge, OAUTH_SCOPES, type AuthConfig } from "./auth.js";
import { previewBrief } from "./fixture.js";

export const WIDGET_URI = "ui://blackhawk/live-brief-v1.html";

function toolSecuritySchemes(config: AuthConfig) {
  return config.mode === "preview"
    ? [{ type: "noauth" as const }]
    : [{ type: "oauth2" as const, scopes: [...OAUTH_SCOPES] }];
}

function installOAuthAwareToolList(server: McpServer, authConfig: AuthConfig) {
  const objectSchema = { type: "object" as const, properties: {}, additionalProperties: false };
  const common = { securitySchemes: toolSecuritySchemes(authConfig) };
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "show_live_brief",
        title: "Show Blackhawk live brief",
        description: "Shows Will's current canonical Blackhawk executive brief. In the Phase 1 checkpoint this returns clearly marked preview data.",
        inputSchema: objectSchema,
        annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        _meta: {
          ui: { resourceUri: WIDGET_URI, visibility: ["model", "app"] },
          "openai/toolInvocation/invoking": "Opening Blackhawk…",
          "openai/toolInvocation/invoked": "Blackhawk brief ready."
        },
        ...common
      },
      {
        name: "request_brief_refresh",
        title: "Refresh Blackhawk brief",
        description: "Requests an idempotent refresh of the current brief. The Phase 1 checkpoint simulates the refresh without accessing live sources.",
        inputSchema: objectSchema,
        annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
        _meta: {
          ui: { resourceUri: WIDGET_URI, visibility: ["model", "app"] },
          "openai/toolInvocation/invoking": "Refreshing Blackhawk…",
          "openai/toolInvocation/invoked": "Preview refresh complete."
        },
        ...common
      },
      {
        name: "get_brief_item",
        title: "Expand Blackhawk brief item",
        description: "Returns the source-backed detail already present for one displayed brief item.",
        inputSchema: {
          type: "object" as const,
          properties: { itemId: { type: "string", minLength: 1 } },
          required: ["itemId"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
        _meta: { ui: { visibility: ["app"] } },
        ...common
      }
    ]
  }));
}

function requireToolAuth(config: AuthConfig, authInfo: unknown) {
  if (config.mode === "preview" || authInfo) return null;
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: "Connect your authorized Blackhawk account to continue." }],
    _meta: { "mcp/www_authenticate": [authChallenge(config)] }
  };
}

export function buildServer(authConfig: AuthConfig, widgetHtml: string) {
  const toolSecurity = { securitySchemes: toolSecuritySchemes(authConfig) };
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
    ...toolSecurity,
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
  }, async (_input, extra) => {
    const authRequired = requireToolAuth(authConfig, extra.authInfo);
    if (authRequired) return authRequired;
    return {
      structuredContent: previewBrief,
      content: [{ type: "text", text: "Showing the Phase 1 Blackhawk preview brief. All displayed people, companies, and sources are fictional preview data." }],
      _meta: { preview: true }
    };
  });

  registerAppTool(server, "request_brief_refresh", {
    ...toolSecurity,
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
  }, async (_input, extra) => {
    const authRequired = requireToolAuth(authConfig, extra.authInfo);
    if (authRequired) return authRequired;
    return {
      structuredContent: previewBrief,
      content: [{ type: "text", text: "Preview refresh complete. No live source or production state was accessed." }],
      _meta: { preview: true, refreshSimulated: true }
    };
  });

  registerAppTool(server, "get_brief_item", {
    ...toolSecurity,
    title: "Expand Blackhawk brief item",
    description: "Returns the source-backed detail already present for one displayed brief item.",
    inputSchema: { itemId: z.string().min(1) },
    outputSchema: { itemId: z.string(), found: z.boolean() },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    _meta: { ui: { visibility: ["app"] } }
  }, async ({ itemId }, extra) => {
    const authRequired = requireToolAuth(authConfig, extra.authInfo);
    if (authRequired) return authRequired;
    type PreviewItemSummary = { id: string; headline: string; explanation: string };
    const sections = Object.values(previewBrief.brief.sections) as Array<{ items: readonly PreviewItemSummary[] }>;
    const item = sections.flatMap((section) => section.items).find((candidate) => candidate.id === itemId);
    return {
      structuredContent: { itemId, found: Boolean(item) },
      content: item ? [{ type: "text", text: `${item.headline}: ${item.explanation}` }] : [],
      _meta: { item: item ?? null, preview: true }
    };
  });

  // The current MCP TypeScript SDK does not yet preserve the Apps SDK
  // securitySchemes extension in its high-level tool registry. Override only
  // tools/list so ChatGPT receives the required per-tool OAuth declaration.
  installOAuthAwareToolList(server, authConfig);

  return server;
}
