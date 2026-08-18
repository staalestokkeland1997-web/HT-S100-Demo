// Holder hele kiosken i ekte fullskjerm hele tiden — paa alle sider.
//
// To moduser:
//
// 1) Inne i fullskjerm-skallet (app.html, som `/` gaar til): sidene kjorer i
//    en iframe, og hvert trykk meldes til skallet via postMessage. Skallet
//    setter fullskjerm paa seg selv og navigerer aldri — dermed kan
//    fullskjermen ikke falle ut naar man gaar mellom spillvelger, spill og
//    ECDIS.
//
// 2) Aapnet direkte (uten skallet): forste trykk setter fullskjerm paa denne
//    siden. Nettlesere krever en brukerhandling for requestFullscreen, og de
//    fleste slipper fullskjermen ved sidebytte — derfor er skallet (`/`) den
//    anbefalte inngangen. Faller man ut (Esc eller navigasjon), tar neste
//    trykk fullskjermen inn igjen.
//
// Lytterne fjernes aldri og no-oper naar siden allerede er i fullskjerm.
(function () {
  var doc = document;
  var root = doc.documentElement;

  // Signal til ecdis/kiosk.js om at denne siden allerede har en
  // fullskjerm-keeper, saa ?kiosk=1-fallbacken ikke sender doble kall.
  window.__htFS = true;

  var framed = false;
  try {
    framed = Boolean(window.parent && window.parent !== window);
  } catch (error) {
    framed = true;
  }

  function isFullscreen() {
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  }

  var pending = false;

  function clearPending() {
    pending = false;
  }

  function enterFullscreen() {
    if (pending || isFullscreen()) return;
    var request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) return;
    pending = true;
    try {
      var result = request.call(root, { navigationUI: "hide" });
      if (result && typeof result.then === "function") {
        result.then(clearPending, clearPending);
      } else {
        setTimeout(clearPending, 500);
      }
    } catch (error) {
      pending = false;
    }
  }

  function onGesture() {
    if (framed) {
      // Skallet eier fullskjermen; brukeraktiveringen fra dette trykket
      // gjelder ogsaa forelderen, saa den kan kalle requestFullscreen naa.
      try {
        window.parent.postMessage({ type: "ht-fullscreen" }, location.origin);
      } catch (error) {
        /* fremmed forelder — ignorer */
      }
      return;
    }

    enterFullscreen();
  }

  // pointerdown skjer FOER navigasjonen et trykk utloeser (spillvelgeren
  // navigerer paa pointerup, lenker paa click), saa fullskjermen er aktiv
  // for neste side i stedet for aa hoppe ut og inn.
  window.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
  window.addEventListener("keydown", onGesture, { capture: true });

  doc.addEventListener("fullscreenchange", clearPending);
  doc.addEventListener("webkitfullscreenchange", clearPending);
})();
