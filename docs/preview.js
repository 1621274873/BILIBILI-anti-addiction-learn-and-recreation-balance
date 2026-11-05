(() => {
  const demo = BiliBalanceDemo.create();
  const panel = BiliBalancePanel.create({
    request: demo.request,
    setCategory: async (category) => {
      const dashboard = await demo.request({ type: "SET_CURRENT_CATEGORY", category });
      panel.render(dashboard, true);
    }
  });
  panel.render(demo.snapshot(), true);
  document.querySelector("#demoContinuous").addEventListener("click", () => {
    panel.render(demo.continuousWarning(), true);
  });
})();
