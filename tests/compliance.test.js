import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";

const contentPath = new URL("../src/content/content.js", import.meta.url);
const backgroundPath = new URL(
  "../src/background/service-worker.js",
  import.meta.url
);
const manifestPath = new URL("../manifest.json", import.meta.url);
const storagePath = new URL("../src/shared/storage.js", import.meta.url);

test("measurement module contains no direct DOM writes or network calls", async () => {
  const source = await readFile(contentPath, "utf8");
  const forbiddenPatterns = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bsendBeacon\s*\(/,
    /\bcreateElement\s*\(/,
    /\.innerHTML\s*=/,
    /\binsertAdjacentHTML\s*\(/,
    /\bremoveChild\s*\(/,
    /\bdocument\.documentElement\b/,
    /\btextContent\s*=/
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(source, pattern);
  }
});

test("content script measures local video playback without user identity", async () => {
  const source = await readFile(contentPath, "utf8");

  assert.match(source, /addEventListener\("play"/);
  assert.match(source, /addEventListener\("pause"/);
  assert.match(source, /currentTime/);
  assert.doesNotMatch(source, /document\.cookie/);
  assert.doesNotMatch(source, /\bcsrf\b/i);
  assert.doesNotMatch(source, /\buid\b/i);
});

test("extension makes no external requests", async () => {
  const [content, background, manifestText] = await Promise.all([
    readFile(contentPath, "utf8"),
    readFile(backgroundPath, "utf8"),
    readFile(manifestPath, "utf8")
  ]);
  const manifest = JSON.parse(manifestText);

  assert.doesNotMatch(content, /\bfetch\s*\(/);
  assert.doesNotMatch(background, /\bfetch\s*\(/);
  assert.deepEqual(manifest.host_permissions, [
    "https://www.bilibili.com/*"
  ]);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "https://www.bilibili.com/*"
  ]);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
  assert.equal(manifest.web_accessible_resources, undefined);

  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      if (entry.isDirectory()) await inspect(path);
      else if (/\.(?:js|html|css)$/.test(entry.name)) {
        const source = await readFile(path, "utf8");
        assert.doesNotMatch(source, /\b(?:fetch|sendBeacon)\s*\(|\b(?:XMLHttpRequest|WebSocket|EventSource)\b|chrome\.storage\.sync/, path.pathname);
        assert.doesNotMatch(source, /(?:src|href)\s*=\s*["']https?:\/\//, path.pathname);
      }
    }
  }
  await inspect(new URL("../src/", import.meta.url));
});

test("floating UI only mounts its own shadow root, without page HTML replacement", async () => {
  const source = (await Promise.all(["panel/view.js", "floating-panel.js"].map((path) =>
    readFile(new URL(`../src/content/${path}`, import.meta.url), "utf8")))).join("\n");
  assert.match(source, /host\.attachShadow/);
  assert.match(source, /mode: "closed"/);
  assert.match(source, /document\.documentElement\.append\(host\)/);
  assert.doesNotMatch(source, /\.innerHTML\s*=|\b(?:removeChild|insertAdjacentHTML)\s*\(|document\.querySelector/);
});

test("persistence contains only local aggregate settings", async () => {
  const source = await readFile(storagePath, "utf8");

  assert.match(source, /chrome\.storage\.local/);
  assert.doesNotMatch(source, /chrome\.storage\.sync/);
  assert.doesNotMatch(source, /categoryOverrides/);
  assert.doesNotMatch(source, /\bcurrent\s*:/);
  assert.doesNotMatch(source, /\btitle\s*:/);
  assert.doesNotMatch(source, /\btags\s*:/);
});
