(function () {
  var isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-mode", isDark ? "dark" : "light");
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
    document.documentElement.setAttribute("data-mode", e.matches ? "dark" : "light");
  });
})();

(function () {
  if (window.__reactLoopFixLoaded) return;
  window.__reactLoopFixLoaded = true;
  var s = document.createElement("script");
  s.src = chrome.runtime.getURL("assets/react-loop-blocker.js");
  (document.head || document.documentElement).appendChild(s);
})();
