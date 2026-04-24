import { rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

await Promise.all([
  rm(path.join(root, ".next"), { recursive: true, force: true }),
  rm(path.join(root, ".next-dev"), { recursive: true, force: true }),
  rm(path.join(root, ".next-prod"), { recursive: true, force: true })
]);
