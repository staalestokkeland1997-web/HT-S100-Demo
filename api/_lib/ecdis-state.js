"use strict";

// Validering av ECDIS-tilstanden som lagres server-side.
//
// Endepunktet er offentlig - kiosksidene kan ikke baere en hemmelighet - saa
// alt som kommer inn maa behandles som ukjent. Tilstanden leses tilbake av
// ECDIS-ens pre-boot og av radaren, som begge stoler paa formen: derfor gaar
// bare kjente felter innenfor gyldige omraader videre, og resten forkastes.

// En nokkel per kiosk. For laa alt under EN global nokkel: to besokende som
// aapnet demoen samtidig overskrev hverandres skip hvert 5. sekund, og en
// utenforstaaende kunne flyttet demoskipet midt i en presentasjon.
function ecdisStateId(searchParams) {
  const raw = String((searchParams && searchParams.get("kiosk")) || "").trim();
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return id || "default";
}

function num(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function sanitizeWaypoint(point) {
  if (!point || typeof point !== "object") return null;
  const lat = num(point.lat, -90, 90);
  const lon = num(point.lon, -180, 180);
  return lat === null || lon === null ? null : { lat, lon };
}

function sanitizeEcdisState(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const snap = body.ship;
  if (!snap || typeof snap !== "object") return null;

  const position = sanitizeWaypoint(snap.ship);
  if (!position) return null;

  const s = snap.ship;
  const ship = {
    savedAt: num(snap.savedAt, 0, Number.MAX_SAFE_INTEGER) ?? Date.now(),
    ship: {
      ...position,
      hdg: num(s.hdg, 0, 360),
      cog: num(s.cog, 0, 360),
      sog: num(s.sog, -10, 120),
      stw: num(s.stw, -10, 120)
    },
    activeLeg: num(snap.activeLeg, 0, 5000) ?? 0,
    sailing: Boolean(snap.sailing),
    demoSail: Boolean(snap.demoSail),
    autoNav: Boolean(snap.autoNav),
    simSpeed: num(snap.simSpeed, 0, 100) ?? 1
  };

  const view = snap.view && typeof snap.view === "object" ? sanitizeWaypoint(snap.view) : null;
  if (view) {
    ship.view = {
      ...view,
      zoom: num(snap.view.zoom, 0, 24) ?? 12,
      bearing: num(snap.view.bearing, -360, 360) ?? 0
    };
  }

  // UI-valgene er rene visningspreferanser og leses aldri som tall eller
  // koordinater. De slippes gjennom som de er, men med tak paa storrelsen.
  if (snap.ui && typeof snap.ui === "object" && !Array.isArray(snap.ui)) {
    const ui = JSON.stringify(snap.ui);
    if (ui.length <= 4096) ship.ui = JSON.parse(ui);
  }

  const out = { ship, route: null, targets: null };
  const route = body.route;

  if (route && typeof route === "object" && Array.isArray(route.route)) {
    const points = route.route.map(sanitizeWaypoint).filter(Boolean);

    // Ett ugyldig punkt forkaster hele ruten: en delvis rute ville sett
    // gyldig ut for radaren, men gaatt et annet sted enn den som ble lagret.
    if (points.length >= 2 && points.length === route.route.length && points.length <= 2000) {
      out.route = {
        route: points,
        activeLeg: num(route.activeLeg, 0, 5000) ?? 0,
        channel: typeof route.channel === "string" ? route.channel.slice(0, 64) : null
      };
    }
  }

  return out;
}

module.exports = { ecdisStateId, sanitizeEcdisState, sanitizeWaypoint };
