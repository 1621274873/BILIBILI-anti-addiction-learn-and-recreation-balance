import { mountPopup } from "./popup.js";

// A local HTTP preview injects its own fixture transport from docs/.
if (globalThis.chrome?.runtime?.id) {
  mountPopup({ request: (message) => chrome.runtime.sendMessage(message) });
}
