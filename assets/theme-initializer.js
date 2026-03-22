// Set initial theme mode based on system preference
(function () {
  const isDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  document.documentElement.setAttribute(
    "data-mode",
    isDark ? "dark" : "light",
  );
  // Listen for system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      document.documentElement.setAttribute(
        "data-mode",
        e.matches ? "dark" : "light",
      );
    });
})();

// React error #185 fix: Inject blocking patch BEFORE React modules load
(function () {
  if (!window.__reactLoopFixInjected) {
    window.__reactLoopFixInjected = true;

    var MAX_UPDATES = 6;
    var counts = {};

    function wrap(name, fn) {
      return function () {
        var now = Date.now();
        var bucket = Math.floor(now / 150);
        var key = name + "_" + bucket;
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] > MAX_UPDATES) return;
        try {
          return fn.apply(this, arguments);
        } catch (e) {
          // Catch React #185 and silently suppress
        }
      };
    }

    // Patch React internals immediately when they appear on globalThis
    function tryPatch() {
      var targets = ["Dr", "Ir", "di", "fi", "Ci", "Bi"];
      for (var i = 0; i < targets.length; i++) {
        var name = targets[i];
        if (
          typeof globalThis[name] === "function" &&
          !globalThis["__patched_" + name]
        ) {
          globalThis["__patched_" + name] = true;
          globalThis[name] = wrap(name, globalThis[name]);
        }
      }
    }

    // Inject blocking script BEFORE React module scripts
    function injectBlockingPatch() {
      var blockingScript = document.createElement("script");
      blockingScript.textContent =
        "(function(){" +
        "var MAX=6,counts={};" +
        "function w(n,f){return function(){" +
        "var b=Math.floor(Date.now()/150),k=n+'_'+b;" +
        "counts[k]=(counts[k]||0)+1;" +
        "if(counts[k]>MAX)return;" +
        "try{return f.apply(this,arguments)}catch(e){}}}" +
        "var targets=['Dr','Ir','di','fi','Ci','Bi'];" +
        "for(var i=0;i<targets.length;i++){" +
        "var n=targets[i];" +
        "if(typeof globalThis[n]==='function'&&!globalThis['__p_'+n]){" +
        "globalThis['__p_'+n]=1;globalThis[n]=w(n,globalThis[n]);}}" +
        "window.addEventListener('unhandledrejection',function(e){" +
        "var m=String(e.reason&&(e.reason.message||e.reason));" +
        "if(m.includes('185')||m.includes('Minified React')||m.includes('Max update')){" +
        "e.preventDefault();e.stopPropagation();}});" +
        "})();";
      blockingScript.dataset.claudeLoopFix = "true";

      var inserted = false;
      var scripts = document.querySelectorAll(
        'script[crossorigin][type="module"]',
      );
      for (var j = 0; j < scripts.length; j++) {
        var s = scripts[j];
        var src = s.src || "";
        // Match React module scripts: index-*.js, sidepanel-*.js
        if (
          (src.indexOf("index-") !== -1 ||
            src.indexOf("sidepanel-") !== -1) &&
          !s.dataset.loopFixInjected
        ) {
          s.dataset.loopFixInjected = "true";
          s.parentNode.insertBefore(blockingScript, s);
          inserted = true;
          break;
        }
      }

      // If no scripts found yet, inject at document head
      if (!inserted && document.head && document.head.firstChild) {
        document.head.insertBefore(blockingScript, document.head.firstChild);
      }
    }

    // Try immediately (for scripts already in DOM)
    tryPatch();
    injectBlockingPatch();

    // Also use MutationObserver to catch dynamically added React scripts
    if (typeof MutationObserver !== "undefined") {
      var observer = new MutationObserver(function (mutations) {
        for (var m = 0; m < mutations.length; m++) {
          var added = mutations[m].addedNodes;
          for (var n = 0; n < added.length; n++) {
            var node = added[n];
            if (
              node.nodeType === 1 &&
              node.tagName === "SCRIPT" &&
              node.type === "module" &&
              (node.src.indexOf("index-") !== -1 ||
                node.src.indexOf("sidepanel-") !== -1) &&
              !node.dataset.loopFixInjected
            ) {
              node.dataset.loopFixInjected = "true";
              tryPatch();
              var patch = document.createElement("script");
              patch.textContent = blockingScript.textContent;
              node.parentNode.insertBefore(patch, node);
            }
          }
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    // Also try patching on every frame (catches late loads)
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(tryPatch);
      setTimeout(tryPatch, 100);
      setTimeout(tryPatch, 500);
    }
  }
})();
