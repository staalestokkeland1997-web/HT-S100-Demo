"use strict";

// De to stedene der en utenforstaaende snakker direkte til serveren:
// /api/ecdis-state (offentlig skrivbar) og /proxy (henter paa vegne av oss).

const test = require("node:test");
const assert = require("node:assert");
const { ecdisStateId, sanitizeEcdisState } = require("../api/_lib/ecdis-state");
const { proxyAllows } = require("../api/_lib/proxy-allowlist");

const params = (query) => new URL("http://x/?" + query).searchParams;

test("each kiosk gets its own state key", () => {
  assert.equal(ecdisStateId(params("kiosk=1")), "1");
  assert.equal(ecdisStateId(params("kiosk=stand-a")), "stand-a");
  assert.equal(ecdisStateId(params("")), "default");
});

test("a kiosk id can never escape its key", () => {
  assert.equal(ecdisStateId(params("kiosk=" + encodeURIComponent("../../config"))), "config");
  assert.equal(ecdisStateId(params("kiosk=" + encodeURIComponent("a:b c"))), "abc");
  assert.equal(ecdisStateId(params("kiosk=" + "x".repeat(200))).length, 32);
});

test("a valid snapshot survives the round trip", () => {
  const clean = sanitizeEcdisState({
    ship: {
      savedAt: 1000,
      ship: { lat: 59.4, lon: 5.3, hdg: 90, cog: 91, sog: 12.5, stw: 12 },
      activeLeg: 2,
      sailing: true,
      view: { lat: 59.4, lon: 5.3, zoom: 13, bearing: 0 },
      ui: { palette: "night" }
    },
    route: { route: [{ lat: 59.4, lon: 5.3 }, { lat: 59.5, lon: 5.4 }], activeLeg: 1, channel: "main" }
  });

  assert.equal(clean.ship.ship.lat, 59.4);
  assert.equal(clean.ship.ship.sog, 12.5);
  assert.equal(clean.ship.ui.palette, "night");
  assert.equal(clean.route.route.length, 2);
  assert.equal(clean.route.channel, "main");
});

test("junk is rejected instead of stored", () => {
  assert.equal(sanitizeEcdisState(null), null);
  assert.equal(sanitizeEcdisState("nope"), null);
  assert.equal(sanitizeEcdisState([1, 2, 3]), null);
  assert.equal(sanitizeEcdisState({}), null, "no ship");
  assert.equal(sanitizeEcdisState({ ship: { ship: { lat: 91, lon: 0 } } }), null, "latitude off the globe");
  assert.equal(sanitizeEcdisState({ ship: { ship: { lat: 59, lon: "øst" } } }), null);
});

test("unknown fields never reach the database", () => {
  const clean = sanitizeEcdisState({
    ship: { ship: { lat: 59, lon: 5 }, evil: "<script>", savedAt: 1 },
    targets: [{ mmsi: 1 }],
    somethingElse: "x".repeat(100000)
  });

  assert.deepEqual(Object.keys(clean).sort(), ["route", "ship", "targets"]);
  assert.equal(clean.ship.evil, undefined);
  assert.equal(clean.targets, null, "AIS targets are never adopted from a snapshot");
});

test("a route with one bad waypoint is dropped whole", () => {
  const clean = sanitizeEcdisState({
    ship: { ship: { lat: 59, lon: 5 }, savedAt: 1 },
    route: { route: [{ lat: 59, lon: 5 }, { lat: 999, lon: 5 }, { lat: 59.1, lon: 5.1 }] }
  });

  // En delvis rute ville sett gyldig ut for radaren, men gaatt et annet sted.
  assert.equal(clean.route, null);
});

test("the proxy allowlist admits only the demo's own data sources", () => {
  assert.ok(proxyAllows(new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact")));
  assert.ok(proxyAllows(new URL("https://cache.kartverket.no/v1/wmts")));
  assert.ok(proxyAllows(new URL("https://vannstand.kartverket.no/tideapi.php")));

  assert.ok(!proxyAllows(new URL("https://example.com/")), "an unlisted host");
  assert.ok(!proxyAllows(new URL("http://api.met.no/")), "plain http");
  assert.ok(!proxyAllows(new URL("https://api.met.no.evil.com/")), "a lookalike hostname");
  assert.ok(!proxyAllows(new URL("https://169.254.169.254/latest/meta-data/")), "cloud metadata");
});

test("github raw is narrowed to the one coastline file the demo needs", () => {
  assert.ok(
    proxyAllows(new URL("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson"))
  );
  assert.ok(
    !proxyAllows(new URL("https://raw.githubusercontent.com/someone/private-ish/main/secrets.env")),
    "otherwise the proxy is a general-purpose relay for anything on GitHub"
  );
});
