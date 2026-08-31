"use strict";

// scores.js kjorer i nettleseren, saa den lastes her mot en minimal stubb av
// localStorage/fetch. Det som testes er selve flettingen: at server og lokal
// liste blir EN liste uten dobbeltforinger, og at kontaktopplysninger aldri
// blir liggende igjen paa en kiosk som staar aapen paa en messe.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "public", "scores.js"), "utf8");

function load({ fetchImpl } = {}) {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  const sandbox = {
    localStorage,
    location: { protocol: "https:" },
    encodeURIComponent,
    fetch: fetchImpl || (() => Promise.reject(new Error("offline"))),
    document: { readyState: "loading" },
    setTimeout: () => {},
    Promise,
    Date,
    Number,
    String,
    Array,
    JSON,
    Error,
    console
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox);
  return { api: sandbox.window.HTScores, store };
}

const ok = (payload) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
const fail = (status, payload) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve(payload || {}) });

test("a score is on the local board before the network is even tried", async () => {
  const { api } = load();
  const result = await api.submit("rush", { name: "Kari", score: 120, playedAt: "2026-08-28T10:00:00Z" }, 10);

  assert.equal(result.synced, false, "the stub network is offline");
  assert.equal(result.board[0].name, "Kari");
  assert.equal(result.board[0].score, 120);
  assert.equal(api.localBoard("rush", 10).length, 1, "it survives in localStorage");
});

test("contact details never touch the displayed board", async () => {
  const { api, store } = load();
  await api.submit("rush", { name: "Kari", email: "kari@example.no", phone: "40404040", score: 10 }, 10);

  const board = store.get("htkiosk_board_v1");
  assert.ok(!board.includes("kari@example.no"), "no email on the board");
  assert.ok(!board.includes("40404040"), "no phone on the board");
  assert.ok(board.includes("Kari"), "the name is what gets shown");
});

test("contact details are dropped from the queue the moment the entry syncs", async () => {
  const { api, store } = load({ fetchImpl: () => ok({ leaderboard: [] }) });
  await api.submit("rush", { name: "Kari", email: "kari@example.no", score: 10 }, 10);

  assert.equal(JSON.parse(store.get("htkiosk_pending_v1") || "[]").length, 0);
});

test("a failed submission is queued, and flush sends it later", async () => {
  let online = false;
  const seen = [];
  const { api } = load({
    fetchImpl: (url, opts) => {
      if (!online) return Promise.reject(new Error("offline"));
      seen.push(JSON.parse(opts.body).name);
      return ok({ leaderboard: [] });
    }
  });

  await api.submit("rush", { name: "Kari", score: 10, playedAt: new Date().toISOString() }, 10);
  assert.equal(api.pendingCount(), 1);

  online = true;
  assert.equal(await api.flush(), 1);
  assert.deepEqual(seen, ["Kari"]);
  assert.equal(api.pendingCount(), 0, "the queue is emptied, contact details with it");
});

test("a rejected entry is not retried forever", async () => {
  const { api } = load({ fetchImpl: () => fail(400, { error: "The score was rejected." }) });
  const result = await api.submit("rush", { name: "Kari", score: -5 }, 10);

  assert.equal(result.permanent, true);
  assert.equal(api.pendingCount(), 0, "4xx means the server will never accept it");
});

test("rate limiting is temporary, so the entry stays queued", async () => {
  const { api } = load({ fetchImpl: () => fail(429, { error: "Too many requests." }) });
  const result = await api.submit("rush", { name: "Kari", score: 10, playedAt: new Date().toISOString() }, 10);

  assert.equal(result.permanent, false);
  assert.equal(api.pendingCount(), 1);
});

test("the same round is not listed twice when it comes back from the server", async () => {
  const played = "2026-08-28T10:00:00Z";
  const { api } = load({
    fetchImpl: () => ok({ entries: [{ game: "rush", name: "Kari", score: 120, playedAt: played }] })
  });

  await api.submit("rush", { name: "Kari", score: 120, playedAt: played }, 10);
  const board = await api.board("rush", 10);

  assert.equal(board.length, 1, "local and server are the same round");
  assert.equal(board[0].rank, 1);
});

test("the board is server and local merged, ranked as one list", async () => {
  const { api } = load({
    fetchImpl: () =>
      ok({
        entries: [
          { game: "rush", name: "Server-topp", score: 200, playedAt: "2026-08-28T09:00:00Z" },
          { game: "rush", name: "Server-lav", score: 50, playedAt: "2026-08-28T09:30:00Z" }
        ]
      })
  });

  await api.submit("rush", { name: "Lokal", score: 120, playedAt: "2026-08-28T10:00:00Z" }, 10);
  const board = await api.board("rush", 10);

  assert.deepEqual(board.map((e) => e.name), ["Server-topp", "Lokal", "Server-lav"]);
});

test("a game only ever sees its own scores", async () => {
  const { api } = load();
  await api.submit("rush", { name: "Rush", score: 10, playedAt: "2026-08-28T10:00:00Z" }, 10);
  await api.submit("sonar", { name: "Sonar", score: 999, playedAt: "2026-08-28T10:01:00Z" }, 10);

  assert.deepEqual(api.localBoard("rush", 10).map((e) => e.name), ["Rush"]);
  assert.deepEqual(api.localBoard("sonar", 10).map((e) => e.name), ["Sonar"]);
});

test("the board falls back to local when the server is unreachable", async () => {
  const { api } = load({ fetchImpl: () => Promise.reject(new Error("offline")) });
  await api.submit("rush", { name: "Kari", score: 120 }, 10);

  const board = await api.board("rush", 10);
  assert.equal(board.length, 1, "an empty board would be worse than a local one");
  assert.equal(board[0].name, "Kari");
});

test("stale queued entries are given up rather than carrying contact details forever", async () => {
  const { api, store } = load();
  const old = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  store.set("htkiosk_pending_v1", JSON.stringify([{ game: "rush", name: "Gammel", email: "g@x.no", score: 1, playedAt: old }]));

  assert.equal(await api.flush(), 0);
  assert.equal(api.pendingCount(), 0);
});

test("ties are broken by who got there first", async () => {
  const { api } = load();
  await api.submit("rush", { name: "Sen", score: 50, playedAt: "2026-08-28T10:05:00Z" }, 10);
  await api.submit("rush", { name: "Tidlig", score: 50, playedAt: "2026-08-28T10:00:00Z" }, 10);

  assert.deepEqual(api.localBoard("rush", 10).map((e) => e.name), ["Tidlig", "Sen"]);
});

test("broken storage does not take the game down", async () => {
  const { api, store } = load({ fetchImpl: () => ok({ leaderboard: [] }) });
  store.set("htkiosk_board_v1", "{ ikke json");

  const result = await api.submit("rush", { name: "Kari", score: 10 }, 10);
  assert.equal(result.synced, true);
});
