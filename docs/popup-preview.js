import "./fixtures.js";
import { mountPopup } from "../src/popup/popup.js";

const frame = document.querySelector("#popupPreview");
const demo = BiliBalanceDemo.create();
let popup;

function mount() {
  const target = frame.contentDocument;
  if (!target?.querySelector("#limitState")) return;
  popup?.destroy();
  popup = mountPopup({ document: target, request: demo.request });
  document.querySelector("#previewMessage").textContent = "仅演示，不连接 B站、不写入 Chrome 存储。";
}

frame.addEventListener("load", mount);
mount();
document.querySelector("#demoContinuous").addEventListener("click", () => {
  demo.continuousWarning();
  popup?.refresh();
});
