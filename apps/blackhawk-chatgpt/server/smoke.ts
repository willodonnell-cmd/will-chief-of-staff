import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const port = 8790;
const baseUrl = `http://127.0.0.1:${port}`;
const serverPath = fileURLToPath(new URL("./index.js", import.meta.url));
const child = spawn(process.execPath, [serverPath], {
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), BLACKHAWK_AUTH_MODE: "preview", NODE_ENV: "test" },
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

  const rawListResponse = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 10, method: "tools/list", params: {} })
  });
  const rawText = await rawListResponse.text();
  if (!rawText.includes('"securitySchemes"') || !rawText.includes('"noauth"') || rawText.includes('"oauth2"')) {
    throw new Error(`Preview tools/list does not advertise no-auth preview security.\n${rawText}`);
  }

  await client.close();
  console.log(JSON.stringify({ health, toolNames, resourceUri, briefId: structured.brief.briefId }, null, 2));
} finally {
  child.kill("SIGTERM");
}

const authPort = 8791;
const authBaseUrl = `http://127.0.0.1:${authPort}`;
const authChild = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(authPort),
    NODE_ENV: "test",
    BLACKHAWK_AUTH_MODE: "supabase",
    SUPABASE_URL: "https://example.supabase.co",
    BLACKHAWK_MCP_RESOURCE_URL: "https://blackhawk.example.com/mcp",
    BLACKHAWK_PRIMARY_OWNER_USER_ID: "00000000-0000-4000-8000-000000000001",
    BLACKHAWK_RECOVERY_USER_IDS: "00000000-0000-4000-8000-000000000002"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let authLogs = "";
authChild.stdout.on("data", (chunk) => { authLogs += chunk.toString(); });
authChild.stderr.on("data", (chunk) => { authLogs += chunk.toString(); });

try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${authBaseUrl}/health`);
      if (response.ok) break;
    } catch {}
    if (attempt === 29) throw new Error(`Authenticated server did not become healthy.\n${authLogs}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const metadataResponse = await fetch(`${authBaseUrl}/.well-known/oauth-protected-resource`);
  const metadata = await metadataResponse.json() as { resource?: string; authorization_servers?: string[] };
  if (metadata.resource !== "https://blackhawk.example.com/mcp" || metadata.authorization_servers?.[0] !== "https://example.supabase.co/auth/v1") {
    throw new Error("Protected-resource metadata is incorrect.");
  }

  const authListResponse = await fetch(`${authBaseUrl}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 11, method: "tools/list", params: {} })
  });
  const authListText = await authListResponse.text();
  if (!authListText.includes('"securitySchemes"') || !authListText.includes('"oauth2"') || authListText.includes('"noauth"')) {
    throw new Error(`Authenticated tools/list does not advertise OAuth security.\n${authListText}`);
  }

  const authClient = new Client({ name: "blackhawk-auth-smoke", version: "0.1.0" });
  await authClient.connect(new StreamableHTTPClientTransport(new URL(`${authBaseUrl}/mcp`)));
  const challengeResult = await authClient.callTool({ name: "show_live_brief", arguments: {} });
  const challenge = (challengeResult._meta as { "mcp/www_authenticate"?: string[] } | undefined)?.["mcp/www_authenticate"]?.[0];
  if (!challengeResult.isError || !challenge?.includes("resource_metadata=") || !challenge.includes("error_description=")) {
    throw new Error("Unauthenticated tool calls do not return the required OAuth challenge.");
  }
  await authClient.close();
  console.log(JSON.stringify({ authMode: "supabase", metadata, challenge: "verified" }, null, 2));
} finally {
  authChild.kill("SIGTERM");
}
