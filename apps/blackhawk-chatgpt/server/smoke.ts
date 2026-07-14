import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const port = 8790;
const baseUrl = `http://127.0.0.1:${port}`;
const serverPath = fileURLToPath(new URL("./index.js", import.meta.url));
const child = spawn(process.execPath, [serverPath], {
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

let logs = "";
child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Blackhawk preview server did not become healthy.\n${logs}`);
}

try {
  const health = await waitForHealth();
  const client = new Client({ name: "blackhawk-smoke", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  await client.connect(transport);

  const listed = await client.listTools();
  const toolNames = listed.tools.map((tool) => tool.name).sort();
  const expected = ["get_brief_item", "request_brief_refresh", "show_live_brief"];
  if (JSON.stringify(toolNames) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected tools: ${toolNames.join(", ")}`);
  }

  const showTool = listed.tools.find((tool) => tool.name === "show_live_brief");
  const resourceUri = (showTool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
  if (resourceUri !== "ui://blackhawk/live-brief-v1.html") {
    throw new Error("show_live_brief is not connected to the expected widget resource.");
  }
  const resource = await client.readResource({ uri: resourceUri });
  if (resource.contents[0]?.mimeType !== "text/html;profile=mcp-app") {
    throw new Error("Blackhawk widget resource has the wrong MIME type.");
  }

  const result = await client.callTool({ name: "show_live_brief", arguments: {} });
  const structured = result.structuredContent as { mode?: string; brief?: { briefId?: string } } | undefined;
  if (structured?.mode !== "preview" || structured.brief?.briefId !== "preview-brief-1") {
    throw new Error("show_live_brief did not return the expected preview contract.");
  }

  await client.close();
  console.log(JSON.stringify({ health, toolNames, resourceUri, briefId: structured.brief.briefId }, null, 2));
} finally {
  child.kill("SIGTERM");
}
