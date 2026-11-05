import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { projectRoot } from "../scripts/lib/project.mjs";

test("preview server serves previews but not repository internals", async (context) => {
  const port = 18765 + (process.pid % 1000);
  const origin = "http://127.0.0.1:" + port;
  const server = spawn(process.execPath, ["scripts/serve-preview.mjs"], {
    cwd: projectRoot, env: { ...process.env, PREVIEW_PORT: String(port) }, stdio: "ignore"
  });
  context.after(() => server.kill());
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { ready = (await fetch(origin + "/docs/preview.html")).status === 200; } catch {}
    if (ready) break;
    await delay(50);
  }
  assert.equal(ready, true, "preview server did not become ready");
  for (const path of ["/docs/preview.html", "/docs/popup-preview.html", "/src/popup/popup.html"]) {
    assert.equal((await fetch(origin + path)).status, 200, path);
  }
  assert.equal((await fetch(origin + "/manifest.json")).status, 404);
});
