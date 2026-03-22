(function() {
  var MAX = 6, counts = {};
  function w(n, f) {
    return function() {
      var b = Math.floor(Date.now() / 150), k = n + '_' + b;
      counts[k] = (counts[k] || 0) + 1;
      if (counts[k] > MAX) return;
      try { return f.apply(this, arguments); } catch(e) {}
    };
  }
  function tryPatch() {
    ['Dr', 'Ir', 'di', 'fi', 'Ci', 'Bi'].forEach(function(n) {
      if (typeof globalThis[n] === 'function' && !globalThis['__p_' + n]) {
        globalThis['__p_' + n] = 1;
        globalThis[n] = w(n, globalThis[n]);
      }
    });
  }
  tryPatch();
  requestAnimationFrame(function() { requestAnimationFrame(tryPatch); });
  setTimeout(tryPatch, 100);
  setTimeout(tryPatch, 500);
  window.addEventListener('unhandledrejection', function(e) {
    var m = String(e.reason && (e.reason.message || e.reason));
    if (m.indexOf('185') !== -1 || m.indexOf('Minified React') !== -1 || m.indexOf('Max update') !== -1) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
})();
