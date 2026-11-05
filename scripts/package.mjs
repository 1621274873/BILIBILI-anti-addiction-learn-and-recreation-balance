import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { listFiles, projectRoot } from "./lib/project.mjs";
import { createZip } from "./lib/zip.mjs";

export async function releaseEntries() {
  const base = pathToFileURL(`${projectRoot}/`);
  // Explicit allowlist: never include .git, tests, demos, local profiles or secrets.
  const names = ["manifest.json", "LICENSE", "PRIVACY.md"];
  for (const directory of ["src", "assets"]) {
    names.push(...(await listFiles(new URL(`${directory}/`, base))).map((name) => `${directory}/${name}`));
  }
  return Promise.all(names.sort().map(async (name) => ({ name, data: await readFile(new URL(name, base)) })));
}

async function main() {
  const entries = await releaseEntries();
  const manifest = JSON.parse(entries.find((entry) => entry.name === "manifest.json").data);
  const archive = createZip(entries);
  const output = resolve(projectRoot, "dist", `bili-balance-${manifest.version}.zip`);
  await mkdir(resolve(projectRoot, "dist"), { recursive: true });
  await writeFile(output, archive);
  const digest = createHash("sha256").update(archive).digest("hex");
  await writeFile(`${output}.sha256`, `${digest}  bili-balance-${manifest.version}.zip\n`);
  console.log(`Packaged ${entries.length} files: ${output}\nSHA-256: ${digest}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
