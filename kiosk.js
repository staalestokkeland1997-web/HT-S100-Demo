// Kiosk helpers — active ONLY when the page is opened with ?kiosk=1
// (run-kiosk.sh / run-kiosk.bat do that for you).
//
// True fullscreen with no exit button comes from launching the browser with
// --kiosk; that cannot be done from a web page. This file adds the parts a
// page CAN do: keep the display awake, hide the idle mouse pointer, suppress
// the right-click menu, and fall back to the Fullscreen API when the browser
// was started normally.
(function () {
  if (!/[?&]kiosk=1(&|$)/.test(location.search)) return;
  var doc = document, root = doc.documentElement;
  root.classList.add('ht-kiosk');

  var style = doc.createElement('style');
  style.textContent = 'html.ht-kiosk-idle,html.ht-kiosk-idle *{cursor:none!important}';
  (doc.head || root).appendChild(style);

  // --- keep the screen awake (bridge / trade-show displays must not sleep) ---
  var lock = null;
  function acquireLock() {
    if (!navigator.wakeLock || lock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l;
      l.addEventListener('release', function () { lock = null; });
    }).catch(function () { /* denied or unsupported — harmless */ });
  }
  acquireLock();
  // the lock is dropped whenever the tab is hidden; re-take it on return
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden) acquireLock(); });

  // --- no context menu on an unattended display ---
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // --- fallback for a browser NOT started with --kiosk -----------------------
  // The Fullscreen API needs a user gesture, and it still shows the browser's
  // "press Esc to exit" hint — use run-kiosk.* for a hint-free display.
  function goFullscreen() {
    if (doc.fullscreenElement || doc.webkitFullscreenElement) return;
    var fn = root.requestFullscreen || root.webkitRequestFullscreen;
    if (fn) { try { fn.call(root); } catch (e) {} }
  }
  // Not {once:true}: a rejected request or an Esc exit must be recoverable by
  // the next interaction. goFullscreen no-ops while already fullscreen.
  window.addEventListener('pointerdown', goFullscreen);
  window.addEventListener('keydown', goFullscreen);

  // --- hide the pointer after 6 s of stillness ------------------------------
  var idleT = null, hidden = false;
  function wake() {
    if (hidden) { hidden = false; root.classList.remove('ht-kiosk-idle'); }
    clearTimeout(idleT);
    idleT = setTimeout(function () { hidden = true; root.classList.add('ht-kiosk-idle'); }, 6000);
  }
  window.addEventListener('pointermove', wake, { passive: true });
  window.addEventListener('pointerdown', wake, { passive: true });
  wake();
})();
