"use strict";

// AIVDM-dekoderen er handskrevet og har ingen avhengigheter aa lene seg paa,
// saa den er ogsaa den delen som stillest kan gaa i stykker: en bitforskyvning
// gir ikke feilmelding, den gir et skip et annet sted. Vektorene under er de
// publiserte referansesetningene fra gpsd sin AIVDM/AIVDO-spesifikasjon, med
// posisjoner som lar seg kjenne igjen (Le Havre, San Francisco, Seattle).

const test = require("node:test");
const assert = require("node:assert");
const { decode, unarmor } = require("../api/_lib/ais-kystverket");

function parseSentence(line) {
  const star = line.lastIndexOf("*");
  const fields = line.slice(1, star).split(",");
  const armed = unarmor(fields[5], parseInt(fields[6], 10) || 0);
  assert.ok(armed, "payload could not be unarmored");
  return decode(armed.bits, armed.len);
}

test("type 1 position report - Le Havre", () => {
  const m = parseSentence("!AIVDM,1,1,,A,13HOI:0P0000VOHLCnHQKwvL05Ip,0*23");

  assert.equal(m.kind, "pos");
  assert.equal(m.mmsi, 227006760);
  assert.equal(m.cls, "A");
  assert.ok(Math.abs(m.lat - 49.475577) < 1e-5, `lat was ${m.lat}`);
  assert.ok(Math.abs(m.lon - 0.13138) < 1e-5, `lon was ${m.lon}`);
  assert.equal(m.sog, 0);
  assert.equal(m.cog, 36.7);
  assert.equal(m.hdg, null, "heading 511 means not available");
  assert.equal(m.navStatus, 0);
});

test("type 1 position report - San Francisco, under way", () => {
  const m = parseSentence("!AIVDM,1,1,,B,15MgK45P3@G?fl0E`Gmj2?v00L12,0*4C");

  assert.equal(m.mmsi, 366730000);
  assert.ok(Math.abs(m.lat - 37.802598) < 1e-5, `lat was ${m.lat}`);
  assert.ok(Math.abs(m.lon + 122.392533) < 1e-5, `lon was ${m.lon}`);
  assert.equal(m.sog, 20.8);
  assert.equal(m.navStatus, 5);
});

test("type 1 position report - Seattle, with true heading", () => {
  const m = parseSentence("!AIVDM,1,1,,B,177KQJ5000G?tO`K>RA1wUbN0TKH,0*5C");

  assert.equal(m.mmsi, 477553000);
  assert.ok(Math.abs(m.lat - 47.582833) < 1e-5, `lat was ${m.lat}`);
  assert.ok(Math.abs(m.lon + 122.345833) < 1e-5, `lon was ${m.lon}`);
  assert.equal(m.hdg, 181);
});

test("unknown message types are skipped, not guessed at", () => {
  // Type 4 (basestasjon) dekodes med vilje ikke - den ville bare kostet CPU.
  const m = parseSentence("!AIVDM,1,1,,A,403OviQuMGCqWrRO9>E6fE700@GO,0*4D");
  assert.equal(m, null);
});

test("a corrupt payload never throws", () => {
  assert.doesNotThrow(() => {
    const armed = unarmor("!!!!!!!!!!!!", 0);
    if (armed) decode(armed.bits, armed.len);
  });
});

test("a truncated message is rejected rather than half-decoded", () => {
  const armed = unarmor("13HOI:0P", 0);
  assert.equal(decode(armed.bits, armed.len), null);
});
