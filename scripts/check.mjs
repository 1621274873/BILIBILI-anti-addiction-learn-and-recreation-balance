import { spawnSync } from "node:child_process";
import { projectRoot } from "./lib/project.mjs";

for (const args of [["--test"], ["scripts/validate.mjs"]]) {
  const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
