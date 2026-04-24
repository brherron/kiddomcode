import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert, it } from "@effect/vitest";

it("runs the server build CLI through a Node shim so the TypeScript entrypoint does not require a Node loader", () => {
  const packageJsonPath = join(import.meta.dirname, "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    readonly scripts?: Record<string, string>;
  };

  assert.deepStrictEqual(packageJson.scripts?.build, "node scripts/cli.mjs build");
  assert.deepStrictEqual(packageJson.scripts?.start, "node dist/bin.mjs");
});
