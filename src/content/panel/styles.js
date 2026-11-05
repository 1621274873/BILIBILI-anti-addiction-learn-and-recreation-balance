// Local CSS for the extension-owned shadow tree; no remote stylesheet is loaded.
(() => {
  globalThis.BiliBalancePanelStyles = `
      :host { all: initial !important; position: fixed !important; z-index: 2147483000 !important;
        right: 24px !important; bottom: 24px !important; display: block !important;
        width: max-content !important; max-width: calc(100vw - 16px) !important;
        color-scheme: light; font: 13px/1.5 system-ui, "Microsoft YaHei", sans-serif !important; }
      :host([hidden]), [hidden] { display: none !important; }
      * { box-sizing: border-box; } button, input { font: inherit; }
      button { cursor: pointer; } button:disabled { cursor: default; opacity: .55; }
      button:focus-visible, input:focus-visible, .head:focus-visible { outline: 2px solid #16826b; outline-offset: 3px; }
      button { border: 1px solid #dce5e0; background: #fff; color: #364d44; border-radius: 9px; padding: 6px 10px; }
      button:hover { background: #edf5f1; } p { margin: 0; } strong { font-weight: 650; }
      .panel { width: 320px; max-width: calc(100vw - 16px); max-height: calc(100dvh - 16px);
        overflow: auto; background: #fcfdfb; color: #253c33; border: 1px solid #d5e1d9;
        border-radius: 18px; box-shadow: 0 12px 48px #19372c28; }
      .head { display: flex; align-items: center; gap: 10px; padding: 16px 16px 12px;
        cursor: move; user-select: none; touch-action: none; }
      .mark { width: 34px; height: 34px; display: grid; place-items: center; background: #21644f;
        color: #fff; border-radius: 11px; font-weight: 700; font-size: 12px; }
      .brand { flex: 1; } .brand strong { display: block; font-size: 14px; }
      .sub { font-size: 11px; color: #6e8276; } .collapse { width: 30px; height: 30px; padding: 0; font-size: 18px; }
      .body { padding: 0 16px 14px; } .status { display: flex; align-items: center; gap: 6px; margin: 0 0 12px; font-size: 11px; color: #667b6e; }
      .status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #7a9a85; }
      .status[data-active='true']::before { background: #218761; }
      .totals { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .tile { padding: 12px; border-radius: 12px; background: #eaf3ed; }
      .tile.fun { background: #f8eee7; color: #975e3c; }
      .tile span { display: block; font-size: 11px; } .tile strong { display: block; font-size: 24px; line-height: 1.4; font-variant-numeric: tabular-nums; }
      .budget { display: flex; justify-content: space-between; margin: 14px 0 7px; font-size: 11px; }
      .track { height: 5px; border-radius: 8px; background: #e8ece7; overflow: hidden; }
      .fill { display: block; height: 100%; width: 0; background: #7c9b85; transition: width .2s; }
      .warning { padding: 9px 10px; margin-top: 10px; border-radius: 9px; color: #9b472a; background: #fff0e5; font-size: 12px; }
      .current { margin-top: 16px; border-top: 1px solid #e4eae3; padding-top: 12px; }
      .eyebrow { font-size: 10px; letter-spacing: 1px; color: #77887b; margin-bottom: 5px; }
      .topic { font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
      .tags { display: flex; flex-wrap: wrap; gap: 5px; margin: 8px 0 10px; }
      .tag { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: 10px; border-radius: 5px; padding: 2px 6px; background: #f0f3ed; color: #687968; }
      .categories { display: flex; gap: 6px; } .categories button { flex: 1; font-size: 12px; }
      button[aria-pressed='true'] { color: #21644f; background: #e7f1e9; border-color: #97b79f; }
      .limit { display: flex; align-items: center; gap: 6px; margin-top: 14px; font-size: 11px; }
      .limit label { flex: 1; } input { width: 56px; min-width: 0; border: 1px solid #d9e2d9; padding: 6px;
        border-radius: 7px; color: #344e3c; background: #fff; } .limit button { font-size: 11px; }
      .tools { display: flex; justify-content: space-between; margin-top: 10px; }
      .tools button { border: 0; padding: 4px 0; font-size: 11px; color: #768576; background: transparent; }
      .message { color: #946139; font-size: 11px; min-height: 0; margin-top: 6px; }
      .privacy { text-align: center; color: #899587; font-size: 10px; margin-top: 10px; }
      .bubble { border-radius: 25px; padding: 11px 15px; background: #255f4e; color: white;
        box-shadow: 0 4px 20px #19372c26; border-color: #255f4e; font-size: 12px; }
      .bubble:hover { background: #32765e; } .bubble[data-warning='true'] { background: #9b472a; border-color: #9b472a; }
      @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
  `;
})();
