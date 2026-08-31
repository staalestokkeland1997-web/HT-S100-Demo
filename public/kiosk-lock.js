// PIN-laas foran hele kiosken.
//
// HVA DEN ER: en sperre mot at tilfeldige folk bruker kiosken eller snubler
// over den offentlige URL-en. Den laases opp mot serveren (/api/kiosk-unlock),
// saa selve koden ligger i en miljovariabel og sendes ALDRI til nettleseren -
// det er forskjellen fra en PIN som staar i klientkoden og kan leses av hvem
// som helst i View Source. Forsokene er bremset, saa koden kan ikke gjettes.
//
// HVA DEN IKKE ER: ekte adgangskontroll. Sidene serveres fortsatt statisk, saa
// den som vet hva han gjor kan hente HTML-en eller kalle API-et direkte uten
// aa gaa via denne skjermen. Adminsidene har derfor sin EGEN sperre server-
// side (x-admin-password) - den er den virkelige beskyttelsen av persondata,
// og denne laasen erstatter den ikke.
//
// Uten KIOSK_PIN satt er laasen helt av, saa kiosken virker som for.
(function () {
  "use strict";

  var UNLOCK_KEY = "htkiosk_unlocked_until";
  var PIN_MIN = 4;
  var PIN_MAX = 12;

  function unlockedUntil() {
    try {
      return Number(localStorage.getItem(UNLOCK_KEY)) || 0;
    } catch (e) {
      return 0;
    }
  }

  function isUnlocked() {
    var until = unlockedUntil();
    // 0 fra serveren betyr "staa aapen til noen laaser" - da lagres et
    // tidspunkt langt fram i tid i stedet for aa la kiosken laase seg midt i
    // en messedag.
    return until > Date.now();
  }

  function storeUnlock(minutes) {
    var ms = minutes > 0 ? minutes * 60000 : 365 * 24 * 3600 * 1000;
    try {
      localStorage.setItem(UNLOCK_KEY, String(Date.now() + ms));
    } catch (e) {
      // Avslaatt lagring: da holder opplaasingen bare denne siden.
    }
  }

  function lock() {
    try {
      localStorage.removeItem(UNLOCK_KEY);
    } catch (e) {}
    location.reload();
  }

  // Skallet (app.html) laster resten i iframe. Begge ligger paa samme opphav,
  // saa opplaasingen deles via localStorage - PIN tastes EN gang, ikke paa
  // nytt for hver side kiosken bytter til.
  function inFrame() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  function buildGate(onDone) {
    var wrap = document.createElement("div");
    wrap.id = "htKioskLock";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Enter access code");
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;" +
      "justify-content:center;background:#07131f;color:#f4fbff;" +
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;" +
      "-webkit-user-select:none;user-select:none;touch-action:manipulation;";

    var pin = "";
    var busy = false;

    var card = document.createElement("div");
    card.style.cssText = "text-align:center;padding:28px;max-width:min(92vw,360px);width:100%;";

    var title = document.createElement("div");
    title.textContent = "Enter access code";
    title.style.cssText = "font-size:22px;font-weight:700;margin-bottom:6px;";

    var sub = document.createElement("div");
    sub.textContent = "Ask a member of staff.";
    sub.style.cssText = "font-size:14px;color:#a6c3d3;margin-bottom:22px;";

    var dots = document.createElement("div");
    dots.style.cssText =
      "display:flex;gap:10px;justify-content:center;align-items:center;height:22px;margin-bottom:10px;";

    var msg = document.createElement("div");
    msg.setAttribute("aria-live", "polite");
    msg.style.cssText = "min-height:20px;font-size:14px;color:#ff4f5f;margin-bottom:16px;";

    function drawDots() {
      dots.textContent = "";
      for (var i = 0; i < Math.max(pin.length, 4); i++) {
        var d = document.createElement("span");
        var filled = i < pin.length;
        d.style.cssText =
          "width:12px;height:12px;border-radius:50%;display:inline-block;" +
          "background:" + (filled ? "#4fe3ff" : "transparent") + ";" +
          "border:2px solid " + (filled ? "#4fe3ff" : "rgba(166,195,211,.45)") + ";";
        dots.appendChild(d);
      }
    }

    var pad = document.createElement("div");
    pad.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;";

    function key(label, action, tone) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText =
        "appearance:none;border:1px solid rgba(166,195,211,.25);border-radius:12px;" +
        "background:" + (tone === "go" ? "#0098c8" : "rgba(255,255,255,.06)") + ";" +
        "color:#f4fbff;font-size:" + (tone ? "16px" : "24px") + ";font-weight:600;" +
        "padding:16px 0;cursor:pointer;touch-action:manipulation;" +
        "-webkit-tap-highlight-color:transparent;font-family:inherit;";
      b.addEventListener("click", action);
      b.addEventListener("focus", function () { b.style.outline = "2px solid #4fe3ff"; });
      b.addEventListener("blur", function () { b.style.outline = "none"; });
      return b;
    }

    function press(digit) {
      if (busy || pin.length >= PIN_MAX) return;
      pin += digit;
      msg.textContent = "";
      drawDots();
    }

    function clear() {
      pin = "";
      msg.textContent = "";
      drawDots();
    }

    function submit() {
      if (busy) return;
      if (pin.length < PIN_MIN) {
        msg.textContent = "The code is at least " + PIN_MIN + " digits.";
        return;
      }

      busy = true;
      msg.style.color = "#a6c3d3";
      msg.textContent = "Checking…";

      fetch("/api/kiosk-unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: pin })
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (p) {
            return { ok: r.ok, status: r.status, payload: p };
          });
        })
        .then(function (res) {
          busy = false;

          if (res.ok && res.payload.ok) {
            storeUnlock(Number(res.payload.minutes) || 0);
            onDone();
            return;
          }

          pin = "";
          drawDots();
          msg.style.color = "#ff4f5f";
          msg.textContent =
            res.status === 429
              ? "Too many attempts. Wait a moment."
              : res.payload.error || "Wrong code.";
        })
        .catch(function () {
          busy = false;
          pin = "";
          drawDots();
          msg.style.color = "#ff4f5f";
          msg.textContent = "No connection. Try again.";
        });
    }

    ["1", "2", "3", "4", "5", "6", "7", "8", "9"].forEach(function (d) {
      pad.appendChild(key(d, function () { press(d); }));
    });
    pad.appendChild(key("Clear", clear, "alt"));
    pad.appendChild(key("0", function () { press("0"); }));
    pad.appendChild(key("Enter", submit, "go"));

    document.addEventListener("keydown", function (e) {
      if (!document.getElementById("htKioskLock")) return;
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") { pin = pin.slice(0, -1); drawDots(); }
      else if (e.key === "Enter") submit();
      else if (e.key === "Escape") clear();
    });

    drawDots();
    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(dots);
    card.appendChild(msg);
    card.appendChild(pad);
    wrap.appendChild(card);
    return wrap;
  }

  function show() {
    function mount() {
      if (document.getElementById("htKioskLock")) return;
      var gate = buildGate(function () {
        var el = document.getElementById("htKioskLock");
        if (el) el.remove();
        // Skallet holder appen i en iframe; last den paa nytt saa sidene bak
        // laasen starter i normal tilstand i stedet for halvveis initialisert.
        location.reload();
      });
      document.body.appendChild(gate);
      var first = gate.querySelector("button");
      if (first) first.focus();
    }

    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  }

  // Er PIN-en skrudd av i miljoet, skal ingenting skje - heller ingen blaff av
  // en laaseskjerm mens svaret er underveis.
  function start() {
    if (isUnlocked() || inFrame()) return;

    fetch("/api/kiosk-unlock", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (info) {
        if (info && info.required && !isUnlocked()) show();
      })
      .catch(function () {
        // Serveren svarer ikke: da vet vi ikke om en PIN er satt. Aa laase
        // kiosken paa en gjetning ville tatt ned demoen paa et nettverksblaff.
      });
  }

  window.HTKioskLock = { lock: lock, isUnlocked: isUnlocked };
  start();
})();
