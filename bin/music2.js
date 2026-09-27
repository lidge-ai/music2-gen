#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/cli/index.js", import.meta.url);
const source = new URL("../src/cli/index.ts", import.meta.url);

if (existsSync(fileURLToPath(dist))) {
  await import(dist.href);
} else if (existsSync(fileURLToPath(source))) {
  await import(source.href);
} else {
  console.error("music2: build output missing (run npm run build)");
  process.exitCode = 1;
}
