#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "ui", "dist");
const hasDist = existsSync(dist) && readdirSync(dist).length > 0;

if (!hasDist) {
  console.log("[dev-full] ui/dist missing — building static UI first...");
  const build = spawnSync("pnpm", ["--filter", "@paperclipai/ui", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
} else {
  console.log("[dev-full] ui/dist present — skipping build.");
}

const server = spawn("pnpm", ["dev:server"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
server.on("exit", (code) => process.exit(code ?? 0));
