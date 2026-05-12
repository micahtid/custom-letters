import { access, writeFile } from "node:fs/promises";
import path from "node:path";

const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");

try {
  await access(buildIdPath);
} catch {
  await writeFile(buildIdPath, "paper-thread-build", "utf8");
}
