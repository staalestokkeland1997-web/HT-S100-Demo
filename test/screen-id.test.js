"use strict";

// ECDIS og radaren deler EN lagret seilas. Nokkelen regnes ut i kiosk.js, som
// begge sidene laster - poenget med testene under er at de to ikke kan havne
// paa hver sin nokkel bare fordi de ble aapnet ulikt. Det var nettopp det som
// skjedde da nokkelen ble regnet ut hver for seg paa de to sidene.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "public", "ecdis", "kiosk.js"), "utf8");

// En delt "nettleser": to sider paa samme opphav ser samme localStorage.
function browser() {
  const store = new Map();
  return {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    store
  };
}

// Laster kiosk.js som om siden ble aapnet med denne query-strengen.
function open(shared, search) {
  const sandbox = {
    location: { search: search },
    localStorage: shared.localStorage,
    navigator: {},
    URLSearchParams,
    encodeURIComponent,
    String,
    setTimeout: () => {},
    clearTimeout: () => {},
    document: {
      documentElement: { classList: { add() {}, remove() {} } },
      createElement: () => ({ style: {} }),
      addEventListener() {},
      head: { appendChild() {} }
    }
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return sandbox.window;
}

test("a kiosk id from the URL is used as the key", () => {
  const b = browser();
  assert.equal(open(b, "?kiosk=1").htEcdisStateUrl(), "/api/ecdis-state?kiosk=1");
  assert.equal(open(b, "?kiosk=stand-a").htEcdisStateUrl(), "/api/ecdis-state?kiosk=stand-a");
});

test("a page opened without the parameter reuses the remembered id", () => {
  const b = browser();

  // ECDIS aapnes som kiosken gjor det.
  const ecdis = open(b, "?kiosk=1");
  // Radaren aapnes uten parameteren - fra en lenke, et bokmerke, en tab.
  const radar = open(b, "");

  assert.equal(radar.htEcdisStateUrl(), ecdis.htEcdisStateUrl(),
    "ellers slutter radaren aa folge ECDIS");
  assert.equal(radar.htScreenId(), "1");
});

test("the URL wins over the remembered id, so a screen can be moved", () => {
  const b = browser();
  open(b, "?kiosk=1");

  const moved = open(b, "?kiosk=2");
  assert.equal(moved.htScreenId(), "2");
  // og den nye verdien er den som huskes videre
  assert.equal(open(b, "").htScreenId(), "2");
});

test("with no id anywhere both pages still land on the same key", () => {
  const b = browser();
  assert.equal(open(b, "").htEcdisStateUrl(), "/api/ecdis-state");
  assert.equal(open(b, "?res=sharp").htEcdisStateUrl(), "/api/ecdis-state");
});

test("other query parameters never change the key", () => {
  const b = browser();
  const a = open(b, "?kiosk=1&res=sharp").htEcdisStateUrl();
  const c = open(b, "?res=low&kiosk=1").htEcdisStateUrl();
  assert.equal(a, c);
});

test("a hostile kiosk id cannot escape its key", () => {
  const b = browser();
  assert.equal(open(b, "?kiosk=" + encodeURIComponent("../../config")).htScreenId(), "config");
  assert.equal(open(b, "?kiosk=" + encodeURIComponent("a b:c")).htScreenId(), "abc");
  assert.equal(open(b, "?kiosk=" + "x".repeat(200)).htScreenId().length, 32);
});

test("blocked storage falls back instead of throwing", () => {
  const b = browser();
  b.localStorage.setItem = () => { throw new Error("denied"); };
  b.localStorage.getItem = () => { throw new Error("denied"); };

  assert.equal(open(b, "?kiosk=1").htScreenId(), "1", "the URL still works");
  assert.equal(open(b, "").htScreenId(), "default");
});
