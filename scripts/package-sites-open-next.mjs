/* global console, process */

import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
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

function requirePath(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required Sites artifact input: ${path}`);
  }
}

requirePath(resolve(openNextRoot, "worker.js"));
requirePath(resolve(openNextRoot, "cloudflare"));
requirePath(resolve(openNextRoot, "middleware"));
requirePath(resolve(openNextRoot, "server-functions"));
requirePath(resolve(openNextRoot, ".build"));
requirePath(resolve(openNextRoot, "assets"));
requirePath(resolve(repoRoot, ".openai/hosting.json"));
requirePath(resolve(repoRoot, "drizzle"));

rmSync(stagingRoot, { force: true, recursive: true });
mkdirSync(serverRoot, { recursive: true });
mkdirSync(resolve(distRoot, "client"), { recursive: true });
mkdirSync(resolve(distRoot, ".openai"), { recursive: true });

cpSync(resolve(openNextRoot, "worker.js"), resolve(serverRoot, "index.js"));
for (const entry of ["cloudflare", "middleware", "server-functions", ".build"]) {
  cpSync(resolve(openNextRoot, entry), resolve(serverRoot, entry), { recursive: true });
}
cpSync(resolve(openNextRoot, "assets"), resolve(distRoot, "client"), { recursive: true });
cpSync(resolve(repoRoot, ".openai/hosting.json"), resolve(distRoot, ".openai/hosting.json"));
cpSync(resolve(repoRoot, "drizzle"), resolve(distRoot, ".openai/drizzle"), { recursive: true });

// Sites rejects this generated SQL manifest as an unsupported artifact content type.
rmSync(resolve(serverRoot, "cloudflare/cache-assets-manifest.sql"), { force: true });

mkdirSync(dirname(outputPath), { recursive: true });
rmSync(outputPath, { force: true });
const tar = spawnSync("tar", ["-C", stagingRoot, "-czf", outputPath, "dist"], { stdio: "inherit" });
if (tar.status !== 0) {
  throw new Error(`tar failed with status ${tar.status ?? "unknown"}`);
}

const size = statSync(outputPath).size;
console.log(`Sites archive written: ${outputPath} (${size} bytes)`);
