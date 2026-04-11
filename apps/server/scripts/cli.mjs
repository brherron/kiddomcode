#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const bunExecutable = process.env.npm_execpath ?? "bun";
const cliEntrypoint = fileURLToPath(new URL("./cli.ts", import.meta.url));

const result = spawnSync(bunExecutable, [cliEntrypoint, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
