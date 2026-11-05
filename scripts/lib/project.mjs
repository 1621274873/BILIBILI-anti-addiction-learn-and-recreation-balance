import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

export async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(new URL(directory), { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not packaged: ${path}`);
    if (entry.isDirectory()) files.push(...await listFiles(new URL(`${entry.name}/`, directory), `${path}/`));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}
