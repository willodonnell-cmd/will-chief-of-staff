import { Miniflare } from "miniflare";

type JsonRpcEnvelope = {
  result?: {
    tools?: Array<{ name: string }>;
    structuredContent?: { mode?: string; brief?: { briefId?: string } };
    contents?: Array<{ mimeType?: string }>;
  };
};

function parseEventStream(body: string): JsonRpcEnvelope {
  const data = body
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  if (!data) throw new Error(`MCP response did not contain an SSE data event: ${body}`);
  return JSON.parse(data) as JsonRpcEnvelope;
}

async function main() {
  const miniflare = new Miniflare({
    modules: true,
    modulesRoot: "dist-worker",
    scriptPath: "dist-worker/worker.js",
    modulesRules: [{ type: "Text", include: ["**/*.html"], fallthrough: true }],
    compatibilityDate: "2026-07-13"
  });

  const post = async (body: unknown) => {
    const response = await miniflare.dispatchFetch("https://preview.invalid/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`MCP returned HTTP ${response.status}: ${await response.text()}`);
    if (response.headers.get("x-blackhawk-data-mode") !== "fictional-preview") {
      throw new Error("Worker response is missing the fictional-preview safety marker.");
    }
    return parseEventStream(await response.text());
  };

  try {
    const health = await miniflare.dispatchFetch("https://preview.invalid/health");
    const healthBody = await health.json() as { mode?: string; liveSourcesConnected?: boolean };
    if (!health.ok || healthBody.mode !== "fictional-preview" || healthBody.liveSourcesConnected !== false) {
      throw new Error("Worker health endpoint is not locked to fictional preview mode.");
    }

    const listed = await post({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    const toolNames = listed.result?.tools?.map((tool) => tool.name).sort() ?? [];
    const expected = ["get_brief_item", "request_brief_refresh", "show_live_brief"];
    if (JSON.stringify(toolNames) !== JSON.stringify(expected)) {
      throw new Error(`Unexpected Worker tools: ${toolNames.join(", ")}`);
    }

    const shown = await post({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "show_live_brief", arguments: {} }
    });
    if (shown.result?.structuredContent?.mode !== "preview" || shown.result.structuredContent.brief?.briefId !== "preview-brief-1") {
      throw new Error("Worker show_live_brief response does not match the fictional checkpoint contract.");
    }

    const resource = await post({
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: { uri: "ui://blackhawk/live-brief-v1.html" }
    });
    if (resource.result?.contents?.[0]?.mimeType !== "text/html;profile=mcp-app") {
      throw new Error("Worker did not serve the ChatGPT widget resource with the MCP App MIME type.");
    }

    console.log(JSON.stringify({ health: healthBody, toolNames, briefId: "preview-brief-1", widgetVerified: true }, null, 2));
  } finally {
    await miniflare.dispose();
  }
}

await main();
