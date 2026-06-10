/* global console, process */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const openNextRoot = resolve(repoRoot, ".open-next");
const outputPath = resolve(
  repoRoot,
  process.argv[2] ?? ".local/sites-artifact/will-chief-of-staff-sites.tgz"
);
const stagingRoot = resolve(repoRoot, ".local/sites-artifact/staging");
const distRoot = resolve(stagingRoot, "dist");
const serverRoot = resolve(distRoot, "server");
const supportedRequireSpecifiers = new Set([
  "@builder.io/partytown/integration",
  "async_hooks",
  "node:async_hooks",
  "buffer",
  "node:buffer",
  "crypto",
  "node:crypto",
  "fs",
  "node:fs",
  "node:fs/promises",
  "http",
  "https",
  "node:child_process",
  "node:os",
  "path",
  "node:path",
  "stream",
  "node:stream",
  "node:stream/web",
  "url",
  "node:url",
  "util",
  "vm",
  "node:vm",
  "node:zlib"
]);

function requirePath(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required Sites artifact input: ${path}`);
  }
}

function assertSupportedStaticRequireSpecifiers(source) {
  const requireSpecifiers = new Set(
    [...source.matchAll(/require\((["'`])([^"'`]+)\1\)/g)].map((match) => match[2])
  );
  const unsupported = [...requireSpecifiers]
    .filter((specifier) => !supportedRequireSpecifiers.has(specifier))
    .sort();

  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported static dynamic require specifier(s) in OpenNext handler: ${unsupported.join(", ")}`
    );
  }
}

function removeExistingSitesRequireShim(source) {
  if (!source.includes("__sitesBuiltinRequire")) {
    return source;
  }

  const nextBundleStart = source.indexOf(
    'import {setInterval, clearInterval, setTimeout, clearTimeout} from "node:timers"'
  );
  if (nextBundleStart === -1) {
    throw new Error("Unable to replace existing Sites OpenNext require shim.");
  }

  return source.slice(nextBundleStart);
}

function patchOpenNextServerHandler() {
  const handlerPath = resolve(openNextRoot, "server-functions/default/handler.mjs");
  const source = removeExistingSitesRequireShim(readFileSync(handlerPath, "utf8"));
  assertSupportedStaticRequireSpecifiers(source);

  writeFileSync(
    handlerPath,
    `import * as __sitesAsyncHooks from "node:async_hooks";
import * as __sitesBuffer from "node:buffer";
import * as __sitesCrypto from "node:crypto";
import * as __sitesFs from "node:fs";
import * as __sitesFsPromises from "node:fs/promises";
import * as __sitesOs from "node:os";
import * as __sitesPath from "node:path";
import * as __sitesStream from "node:stream";
import * as __sitesStreamWeb from "node:stream/web";
import * as __sitesUrl from "node:url";
import * as __sitesUtil from "node:util";
import * as __sitesVm from "node:vm";
import * as __sitesZlib from "node:zlib";

class __SitesNoopAgent {
  constructor(options = {}) {
    this.options = options;
    this.keepAlive = Boolean(options.keepAlive);
  }

  destroy() {}
}

const __sitesHttp = {
  Agent: __SitesNoopAgent,
  globalAgent: new __SitesNoopAgent()
};
const __sitesHttps = {
  Agent: __SitesNoopAgent,
  globalAgent: new __SitesNoopAgent()
};
const __sitesChildProcess = new Proxy({}, {
  get(_target, property) {
    if (property === "__esModule") {
      return false;
    }

    return () => {
      throw new Error(\`node:child_process.\${String(property)} is unavailable in Sites Workers runtime\`);
    };
  }
});

const __sitesBuiltinRequire = {
  "async_hooks": __sitesAsyncHooks,
  "node:async_hooks": __sitesAsyncHooks,
  "buffer": __sitesBuffer,
  "node:buffer": __sitesBuffer,
  "crypto": __sitesCrypto,
  "node:crypto": __sitesCrypto,
  "fs": __sitesFs,
  "node:fs": __sitesFs,
  "node:fs/promises": __sitesFsPromises,
  "http": __sitesHttp,
  "https": __sitesHttps,
  "node:child_process": __sitesChildProcess,
  "node:os": __sitesOs,
  "path": __sitesPath,
  "node:path": __sitesPath,
  "stream": __sitesStream,
  "node:stream": __sitesStream,
  "node:stream/web": __sitesStreamWeb,
  "url": __sitesUrl,
  "node:url": __sitesUrl,
  "util": __sitesUtil,
  "vm": __sitesVm,
  "node:vm": __sitesVm,
  "node:zlib": __sitesZlib,
  "@builder.io/partytown/integration": {}
};

if (typeof globalThis.require !== "function") {
  Object.defineProperty(globalThis, "require", {
    configurable: true,
    value(specifier) {
      if (specifier in __sitesBuiltinRequire) {
        return __sitesBuiltinRequire[specifier];
      }

      throw new Error(\`Unsupported dynamic require in Sites OpenNext bundle: \${specifier}\`);
    }
  });
}

${source}`
  );
}

requirePath(resolve(openNextRoot, "worker.js"));
requirePath(resolve(openNextRoot, "cloudflare"));
requirePath(resolve(openNextRoot, "middleware"));
requirePath(resolve(openNextRoot, "server-functions"));
requirePath(resolve(openNextRoot, ".build"));
requirePath(resolve(openNextRoot, "assets"));
requirePath(resolve(repoRoot, ".openai/hosting.json"));
requirePath(resolve(repoRoot, "drizzle"));

patchOpenNextServerHandler();

rmSync(stagingRoot, { force: true, recursive: true });
mkdirSync(serverRoot, { recursive: true });
mkdirSync(resolve(distRoot, "client"), { recursive: true });
mkdirSync(resolve(distRoot, ".openai"), { recursive: true });

cpSync(resolve(openNextRoot, "worker.js"), resolve(serverRoot, "opennext-worker.js"));
for (const entry of ["cloudflare", "middleware", "server-functions", ".build"]) {
  cpSync(resolve(openNextRoot, entry), resolve(serverRoot, entry), { recursive: true });
}
cpSync(resolve(openNextRoot, "assets"), resolve(distRoot, "client"), { recursive: true });
cpSync(resolve(repoRoot, ".openai/hosting.json"), resolve(distRoot, ".openai/hosting.json"));
cpSync(resolve(repoRoot, "drizzle"), resolve(distRoot, ".openai/drizzle"), { recursive: true });

// Sites rejects this generated SQL manifest as an unsupported artifact content type.
rmSync(resolve(serverRoot, "cloudflare/cache-assets-manifest.sql"), { force: true });

writeFileSync(
  resolve(serverRoot, "index.js"),
  `function serializeStartupError(error) {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "Error";
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
  const stack = error && typeof error === "object" && "stack" in error ? String(error.stack) : message;

  return JSON.stringify(
    {
      ok: false,
      source: "sites-opennext-startup",
      name,
      message,
      stack: stack.split("\\n").slice(0, 12).join("\\n")
    },
    null,
    2
  );
}

export default {
  async fetch(request, env, ctx) {
    try {
      const worker = await import("./opennext-worker.js");
      return await worker.default.fetch(request, env, ctx);
    } catch (error) {
      console.error("[sites-opennext-startup]", error);
      return new Response(serializeStartupError(error), {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }
  }
};
`
);

mkdirSync(dirname(outputPath), { recursive: true });
rmSync(outputPath, { force: true });
const tar = spawnSync("tar", ["-C", stagingRoot, "-czf", outputPath, "dist"], { stdio: "inherit" });
if (tar.status !== 0) {
  throw new Error(`tar failed with status ${tar.status ?? "unknown"}`);
}

const size = statSync(outputPath).size;
console.log(`Sites archive written: ${outputPath} (${size} bytes)`);
