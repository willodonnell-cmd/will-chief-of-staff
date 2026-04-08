import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";

const filesToRestore = ["tsconfig.json", "next-env.d.ts"];
const originals = new Map();

async function main() {
  await Promise.all(
    filesToRestore.map(async (file) => {
      originals.set(file, await readFile(file, "utf8"));
    })
  );

  const nextBin = "./node_modules/next/dist/bin/next";

  try {
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [nextBin, "build"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NEXT_DIST_DIR: ".next-build"
        },
        stdio: "inherit"
      });

      child.on("error", reject);
      child.on("exit", (code) => resolve(code ?? 1));
    });

    process.exit(exitCode);
  } finally {
    await Promise.all(
      Array.from(originals.entries()).map(([file, contents]) => writeFile(file, contents))
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
