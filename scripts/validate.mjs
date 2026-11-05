import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { listFiles, projectRoot } from "./lib/project.mjs";

process.chdir(projectRoot);
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const metadata = JSON.parse(await readFile("package.json", "utf8"));
const requiredFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...manifest.content_scripts.flatMap((entry) => entry.js),
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon)
];

for (const file of requiredFiles) {
  await access(file);
}

if (manifest.manifest_version !== 3) {
  throw new Error("Expected Manifest V3.");
}
if (metadata.version !== manifest.version) throw new Error("package.json and manifest.json versions differ.");
if (metadata.license !== "MIT") throw new Error("Expected the agreed MIT license.");
if (manifest.description.length > 132) throw new Error("Chrome descriptions must be at most 132 characters.");

const site = ["https://www.bilibili.com/*"];
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(site) ||
    manifest.content_scripts.some((script) => JSON.stringify(script.matches) !== JSON.stringify(site)) ||
    JSON.stringify(manifest.permissions) !== JSON.stringify(["storage"])) {
  throw new Error("Expected only the Bilibili main site and local storage permission.");
}

if (!manifest.content_security_policy.extension_pages.includes("connect-src 'none'")) {
  throw new Error("Extension pages must disable network connections.");
}

let scriptsChecked = 0;
let referencesChecked = 0;
async function checkReference(from, target) {
  if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) return;
  const path = resolve(dirname(from), decodeURIComponent(target.split(/[?#]/)[0]));
  const inside = relative(projectRoot, path);
  if (inside.startsWith("..") || isAbsolute(inside)) throw new Error(`Reference outside project: ${from} -> ${target}`);
  await access(path).catch(() => { throw new Error(`Missing reference: ${from} -> ${target}`); });
  referencesChecked++;
}

for (const directory of ["src", "scripts", "docs"]) {
  const base = pathToFileURL(`${resolve(directory)}/`);
  for (const file of await listFiles(base)) {
    const path = resolve(directory, file);
    const extension = extname(path);
    if (![".js", ".mjs", ".html", ".md"].includes(extension)) continue;
    const source = await readFile(path, "utf8");
    if ([".js", ".mjs"].includes(extension)) {
      execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
      scriptsChecked++;
      // Static relative module imports in this build-free project.
      for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.[^"']+)["']/g)) {
        await checkReference(path, match[1]);
      }
    } else if (extension === ".html") {
      for (const match of source.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) await checkReference(path, match[1]);
    } else {
      for (const match of source.matchAll(/\]\(([^\s)]+)\)/g)) await checkReference(path, match[1]);
    }
  }
}
for (const file of ["README.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", "PRIVACY.md"]) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/\]\(([^\s)]+)\)/g)) await checkReference(resolve(file), match[1]);
}

console.log(`Manifest valid; ${scriptsChecked} scripts parsed; ${referencesChecked} local references checked.`);
