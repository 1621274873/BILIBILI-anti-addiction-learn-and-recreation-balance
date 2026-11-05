import test from "node:test";
import assert from "node:assert/strict";
import { releaseEntries } from "../scripts/package.mjs";
import { createZip } from "../scripts/lib/zip.mjs";

test("release archive contains only the explicit runtime allowlist and is reproducible", async () => {
  const entries = await releaseEntries();
  const names = entries.map(({ name }) => name);
  assert.ok(names.includes("manifest.json"));
  assert.ok(names.includes("LICENSE"));
  assert.ok(names.includes("PRIVACY.md"));
  assert.ok(names.includes("src/content/panel/styles.js"));
  assert.ok(names.includes("src/content/panel/view.js"));
  assert.ok(names.includes("src/popup/index.js"));
  assert.ok(names.every((name) => !/^(?:tests|docs|\.git|\.github)\//.test(name)));
  assert.ok(names.every((name) => !/(?:\.env|\.pem|\.crx)$/.test(name)));
  const first = createZip(entries);
  const second = createZip(await releaseEntries());
  assert.deepEqual(first, second);
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt32LE(first.length - 22), 0x06054b50);
});

test("ZIP writer rejects path traversal and duplicate entries", () => {
  assert.throws(() => createZip([{ name: "../manifest.json", data: Buffer.alloc(0) }]), /Unsafe/);
  assert.throws(() => createZip([{ name: "manifest.json", data: Buffer.alloc(0) }, { name: "manifest.json", data: Buffer.alloc(0) }]), /Unsafe/);
});
