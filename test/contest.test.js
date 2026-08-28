"use strict";

// Ren inn/ut-logikk: validering, normalisering og CSV-bygging. Alt sammen
// staar mellom publikum og databasen, saa det er her en regresjon merkes.

const test = require("node:test");
const assert = require("node:assert");
const contest = require("../api/_lib/contest");

test("entries need a name and a way to reach the winner", () => {
  assert.deepEqual(contest.validateStandaloneEntry({ name: "Kari", email: "kari@example.no" }), []);
  assert.deepEqual(contest.validateStandaloneEntry({ name: "Kari", phone: "40404040" }), []);

  assert.ok(contest.validateStandaloneEntry({ name: "K", email: "kari@example.no" }).length);
  assert.ok(contest.validateStandaloneEntry({ name: "Kari" }).length, "no email and no phone");
  assert.ok(contest.validateStandaloneEntry({ name: "Kari", email: "ikke-en-adresse" }).length);
  assert.ok(contest.validateStandaloneEntry({ name: "Kari", phone: "123" }).length, "phone too short");
});

test("names are trimmed of markup and length before they reach a leaderboard", () => {
  assert.equal(contest.sanitizeName("<script>alert(1)</script>"), "scriptalert(1)/script");
  assert.equal(contest.sanitizeName("  Kari  "), "Kari");
  assert.equal(contest.sanitizeName("x".repeat(80)).length, 40);
});

test("CSV export neutralises spreadsheet formulas", () => {
  // Et deltakernavn som starter med = + - eller @ blir ellers kjorbar formel
  // naar admin aapner eksporten i Excel.
  const csv = contest.buildCsv([
    { id: "1", game: "rush", name: '=HYPERLINK("http://evil","Vinner")', email: "a@b.no", score: 1 },
    { id: "2", game: "rush", name: "+CMD", email: "c@d.no", score: 2 },
    { id: "3", game: "rush", name: "Kari Nordmann", email: "e@f.no", score: 3 }
  ]);
  const rows = csv.split("\n");

  assert.ok(rows[1].includes("\"'=HYPERLINK"), rows[1]);
  assert.ok(rows[2].includes("\"'+CMD\""), rows[2]);
  assert.ok(rows[3].includes('"Kari Nordmann"'), "ordinary names are left alone");
});

test("CSV keeps quotes inside a field intact", () => {
  const csv = contest.buildCsv([{ id: "1", game: "rush", name: 'Kari "KN" Nordmann', email: "a@b.no", score: 1 }]);
  assert.ok(csv.includes('"Kari ""KN"" Nordmann"'), csv);
});

test("game ids outside the known set are rejected", () => {
  assert.equal(contest.normalizeGameId("rush"), "rush");
  assert.equal(contest.normalizeGameId("does-not-exist"), null);
  // Uten hasOwnProperty-sjekken ville arvede egenskaper sluppet gjennom.
  assert.equal(contest.normalizeGameId("constructor"), null);
  assert.equal(contest.normalizeGameId("__proto__"), null);
});

test("settings are clamped to their schema, never trusted as sent", () => {
  const schema = contest.GAME_SCHEMAS.sonar;
  const out = contest.normalizeBySchema(
    { nodeCount: 9999, pingMs: -5, enableTimeout: "ja", difficultyName: "x".repeat(60) },
    {},
    schema
  );

  assert.equal(out.nodeCount, schema.numbers.nodeCount.max);
  assert.equal(out.pingMs, schema.numbers.pingMs.min);
  assert.equal(out.enableTimeout, true, "a non-boolean falls back, it does not coerce");
  assert.equal(out.difficultyName.length, 40);
});

test("leaderboards rank by score, then by who got there first", () => {
  const entries = [
    { name: "Sen", score: 50, game: "rush", playedAt: "2026-08-25T10:05:00Z" },
    { name: "Tidlig", score: 50, game: "rush", playedAt: "2026-08-25T10:00:00Z" },
    { name: "Best", score: 90, game: "rush", playedAt: "2026-08-25T11:00:00Z" },
    { name: "Annet spill", score: 999, game: "sonar", playedAt: "2026-08-25T09:00:00Z" }
  ];
  const board = contest.getLeaderboard(entries, 10, "rush");

  assert.deepEqual(board.map((e) => e.name), ["Best", "Tidlig", "Sen"]);
  assert.deepEqual(board.map((e) => e.rank), [1, 2, 3]);
  assert.ok(!board.some((e) => e.email), "the public board never carries contact details");
});
