"use strict";

// Bro mot Kystverkets aapne AIS-stroem — Vercel-utgaven.
//
// Kystverket kringkaster raa NMEA (AIVDM/AIVDO, IEC 62320-1) over en vanlig
// TCP-socket paa 153.44.253.27:5631. Dataene er gratis under NLOD og krever
// ingen nokkel eller registrering, men de kommer som en ufiltrert stroem for
// HELE norskekysten - og en nettleser kan uansett ikke aapne en raa TCP-socket.
// Derfor bor API-et: det holder oppkoblingen, dekoder meldingene, og lar
// vilkaarlig mange faner (ECDIS + radar samtidig) hente ut det de trenger.
// Det er ogsaa hele poenget kontra aisstream.io, der gratisnokkelen bare
// tillater en samtidig tilkobling.
//
// Forskjellen fra den lokale kiosk-serveren: en serverless-funksjon fryses
// mellom kall, saa intervaller kan ikke pusse cachen i bakgrunnen. Derfor
// kjorer vedlikeholdet paa touch() (altsaa naar en klient faktisk spor), og
// forste kall kan vente noen sekunder paa at stroemmen leverer - se ready().
// Sockelen selv overlever mellom kall saa lenge instansen holdes varm, saa
// den vanlige pollingen hvert 3. sekund treffer en oppkoblet stroem.
//
// Merk: den aapne stroemmen utelater fiskefartoy under 15 m og fritidsbaater
// under 45 m. Alt av yrkestrafikk - ferger, cargo, tank, passasjer - er med.
//
// Ingen npm-avhengigheter: dekoderen under er skrevet for hand, slik resten av
// prosjektet ogsaa er.

const net = require("net");

const DEFAULTS = {
  host: "153.44.253.27",
  port: 5631,
  // Hvor lenge et maal beholdes etter siste melding. Klasse A sender hvert
  // par sekunder i fart, klasse B sjeldnere; 12 min holder paa selv de trege.
  maxAgeMs: 12 * 60 * 1000,
  // Naar ingen klient har spurt paa en stund, legg paa. Kiosken skal ikke
  // holde en TCP-stroem aapen hele messedagen hvis ingen ser paa ECDIS-en.
  idleMs: 120 * 1000,
  // Hvor lenge forste kall venter paa at en fersk stroem skal levere maal.
  // Kystverket sender kontinuerlig, saa dette er normalt under et sekund.
  warmupMs: 2500,
  // Tak paa antall maal som returneres i ett svar.
  maxTargets: 900
};

// ---------------------------------------------------------------------------
// AIVDM-dekoding
// ---------------------------------------------------------------------------

// 6-bits ASCII-tegnsett brukt til navn, kallesignal og destinasjon.
const SIXBIT =
  "@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_ !\"#$%&'()*+,-./0123456789:;<=>?";

// Pakker om ASCII-armeringen til en bit-buffer. Hvert tegn baerer 6 bit.
function unarmor(payload, fillBits) {
  const bits = new Uint8Array(payload.length * 6);
  let n = 0;
  for (let i = 0; i < payload.length; i++) {
    let v = payload.charCodeAt(i) - 48;
    if (v > 40) v -= 8;
    if (v < 0 || v > 63) return null;
    for (let b = 5; b >= 0; b--) bits[n++] = (v >> b) & 1;
  }
  const len = Math.max(0, n - (fillBits || 0));
  return { bits, len };
}

function ubits(bits, start, length) {
  let v = 0;
  for (let i = 0; i < length; i++) v = v * 2 + bits[start + i];
  return v;
}

function sbits(bits, start, length) {
  let v = ubits(bits, start, length);
  if (bits[start] === 1) v -= Math.pow(2, length);
  return v;
}

function tbits(bits, start, length) {
  let out = "";
  for (let i = 0; i + 6 <= length; i += 6) {
    out += SIXBIT[ubits(bits, start + i, 6)];
  }
  // AIS polstrer med '@' og etterfolgende mellomrom.
  return out.replace(/@+$/, "").trim();
}

// Lengde-/breddegrad ligger som 1/10000 bueminutt.
function coord(raw, naValue) {
  if (raw === naValue) return null;
  const v = raw / 600000;
  return Math.abs(v) > 180 ? null : v;
}

function dimensions(a, b, c, d) {
  const l = a + b;
  const w = c + d;
  if (!l && !w) return null;
  return { l, b: w };
}

// Dekoder de meldingstypene en ECDIS faktisk trenger. Resten (basestasjoner,
// DGNSS, sikkerhetsmeldinger) hoppes over med vilje - de ville bare kostet
// CPU paa en messe-PC uten aa endre kartbildet.
function decode(bits, len) {
  if (len < 38) return null;
  const type = ubits(bits, 0, 6);
  const mmsi = ubits(bits, 8, 30);
  if (!mmsi) return null;

  // Klasse A posisjonsrapport.
  if (type === 1 || type === 2 || type === 3) {
    if (len < 144) return null;
    const lon = coord(sbits(bits, 61, 28), 0x6791ac0);
    const lat = coord(sbits(bits, 89, 27), 0x3412140);
    if (lat === null || lon === null) return null;
    const sog = ubits(bits, 50, 10);
    const cog = ubits(bits, 116, 12);
    const hdg = ubits(bits, 128, 9);
    const nav = ubits(bits, 38, 4);
    return {
      kind: "pos", mmsi, lat, lon,
      sog: sog === 1023 ? null : sog / 10,
      cog: cog === 3600 ? null : cog / 10,
      hdg: hdg === 511 ? null : hdg,
      navStatus: nav === 15 ? null : nav,
      cls: "A"
    };
  }

  // Klasse B posisjonsrapport.
  if (type === 18) {
    if (len < 139) return null;
    const lon = coord(sbits(bits, 57, 28), 0x6791ac0);
    const lat = coord(sbits(bits, 85, 27), 0x3412140);
    if (lat === null || lon === null) return null;
    const sog = ubits(bits, 46, 10);
    const cog = ubits(bits, 112, 12);
    const hdg = ubits(bits, 124, 9);
    return {
      kind: "pos", mmsi, lat, lon,
      sog: sog === 1023 ? null : sog / 10,
      cog: cog === 3600 ? null : cog / 10,
      hdg: hdg === 511 ? null : hdg,
      navStatus: null,
      cls: "B"
    };
  }

  // Utvidet klasse B - posisjon og statiske data i samme melding.
  if (type === 19) {
    if (len < 263) return null;
    const lon = coord(sbits(bits, 57, 28), 0x6791ac0);
    const lat = coord(sbits(bits, 85, 27), 0x3412140);
    if (lat === null || lon === null) return null;
    const sog = ubits(bits, 46, 10);
    const cog = ubits(bits, 112, 12);
    const hdg = ubits(bits, 124, 9);
    const out = {
      kind: "pos", mmsi, lat, lon,
      sog: sog === 1023 ? null : sog / 10,
      cog: cog === 3600 ? null : cog / 10,
      hdg: hdg === 511 ? null : hdg,
      navStatus: null,
      cls: "B"
    };
    if (len >= 301) {
      out.name = tbits(bits, 143, 120);
      out.shipType = ubits(bits, 263, 8);
      out.dim = dimensions(
        ubits(bits, 271, 9), ubits(bits, 280, 9),
        ubits(bits, 289, 6), ubits(bits, 295, 6)
      );
    }
    return out;
  }

  // Statiske reise- og skipsdata (klasse A).
  if (type === 5) {
    if (len < 302) return null;
    const out = {
      kind: "static", mmsi,
      imo: ubits(bits, 40, 30) || null,
      callsign: tbits(bits, 70, 42),
      name: tbits(bits, 112, 120),
      shipType: ubits(bits, 232, 8),
      dim: dimensions(
        ubits(bits, 240, 9), ubits(bits, 249, 9),
        ubits(bits, 258, 6), ubits(bits, 264, 6)
      ),
      draught: ubits(bits, 294, 8) / 10 || null
    };
    if (len >= 422) out.dest = tbits(bits, 302, 120);
    return out;
  }

  // Statisk datarapport (klasse B), delt i del A (navn) og del B (resten).
  if (type === 24) {
    const part = ubits(bits, 38, 2);
    if (part === 0 && len >= 160) {
      return { kind: "static", mmsi, name: tbits(bits, 40, 120) };
    }
    if (part === 1 && len >= 162) {
      return {
        kind: "static", mmsi,
        shipType: ubits(bits, 40, 8),
        callsign: tbits(bits, 90, 42),
        dim: dimensions(
          ubits(bits, 132, 9), ubits(bits, 141, 9),
          ubits(bits, 150, 6), ubits(bits, 156, 6)
        )
      };
    }
    return null;
  }

  // Navigasjonsinnretninger. Kystverkets eget AIS-nett sender ekte AtoN
  // (lykter, staker, raconer).
  if (type === 21) {
    if (len < 272) return null;
    const lon = coord(sbits(bits, 164, 28), 0x6791ac0);
    const lat = coord(sbits(bits, 192, 27), 0x3412140);
    if (lat === null || lon === null) return null;
    return {
      kind: "aton", mmsi, lat, lon,
      aidType: ubits(bits, 38, 5),
      name: tbits(bits, 43, 120),
      virtual: len >= 270 ? !!bits[269] : false
    };
  }

  return null;
}


// ---------------------------------------------------------------------------
// Stroem-klient
// ---------------------------------------------------------------------------

class KystverketAis {
  constructor(options) {
    this.opt = { ...DEFAULTS, ...(options || {}) };
    this.targets = new Map();
    this.atons = new Map();
    // Flerdelsmeldinger (type 5 og 24 sprenger 168-bits rammen) settes sammen
    // per kanal og sekvensnummer.
    this.frags = new Map();
    this.socket = null;
    this.buf = "";
    this.retry = 0;
    this.retryTimer = null;
    this.lastTouch = 0;
    this.lastMsgAt = 0;
    this.lastKeepAt = 0;
    this.msgCount = 0;
    this.rateWindow = [];
    this.waiters = [];
    this.error = null;
    this.state = "off";
    this.startedAt = 0;
  }

  // Kalles hver gang en klient spor etter data. Starter stroemmen ved forste
  // sporsmaal og holder den i live saa lenge noen bryr seg. Her gjores ogsaa
  // vedlikeholdet: en serverless-funksjon fryses mellom kall, saa et
  // setInterval ville uansett bare fyrt av naar en forespoersel vekket den.
  touch() {
    const now = Date.now();
    this.lastTouch = now;
    if (this.state === "off") this.start();
    if (now - this.lastKeepAt >= 5000) {
      this.lastKeepAt = now;
      this._housekeep();
    }
  }

  start() {
    if (this.socket || this.retryTimer) return;
    this.state = "connecting";
    this.error = null;
    this.startedAt = Date.now();
    this._open();
  }

  stop(reason) {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.buf = "";
    this.frags.clear();
    this.state = "off";
    this.error = reason || null;
    this._wake();
  }

  // Venter paa at stroemmen faktisk leverer. Uten den ville forste poll etter
  // en kaldstart svare med tom liste, og klienten ville tegnet et tomt kart
  // selv om Kystverket er tilgjengelig.
  ready(waitMs) {
    if (this.targets.size > 0) return Promise.resolve(true);
    // Er stroemmen alt kjent doed, svar med en gang. Klienten poller hvert
    // 3. sekund uansett, og en serverless-funksjon som venter er en funksjon
    // som koster - da ville en nede-kilde holdt API-et opptatt kontinuerlig.
    if (this.error && this.retry > 1) return Promise.resolve(false);
    const budget = waitMs != null ? waitMs : this.opt.warmupMs;
    if (budget <= 0) return Promise.resolve(this.targets.size > 0);
    return new Promise((resolve) => {
      const waiter = { resolve, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve(this.targets.size > 0);
      }, budget);
      if (waiter.timer.unref) waiter.timer.unref();
      this.waiters.push(waiter);
    });
  }

  _wake() {
    if (!this.waiters.length) return;
    const pending = this.waiters;
    this.waiters = [];
    for (const w of pending) {
      clearTimeout(w.timer);
      w.resolve(this.targets.size > 0);
    }
  }

  _open() {
    const s = net.connect({ host: this.opt.host, port: this.opt.port });
    this.socket = s;
    s.setEncoding("ascii");
    // Kystverket sender kontinuerlig; blir det stille i 60 s er lenken doed
    // selv om TCP-en tror den lever.
    s.setTimeout(60000);
    if (s.unref) s.unref();

    s.on("connect", () => {
      this.state = "connected";
      this.error = null;
      this.retry = 0;
    });
    s.on("data", (chunk) => this._feed(chunk));
    s.on("timeout", () => s.destroy(new Error("ingen data paa 60 s")));
    s.on("error", (err) => {
      this.error = err.code || err.message;
      this._wake();
    });
    s.on("close", () => {
      if (this.socket !== s) return;
      this.socket = null;
      if (this.state === "off") return;
      this._scheduleRetry();
    });
  }

  _scheduleRetry() {
    this.state = "reconnecting";
    const wait = Math.min(30000, 1500 * Math.pow(2, Math.min(4, this.retry++)));
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.state !== "off") this._open();
    }, wait);
    if (this.retryTimer.unref) this.retryTimer.unref();
  }

  _feed(chunk) {
    this.buf += chunk;
    // Vern mot en motpart som sender soppel uten linjeskift.
    if (this.buf.length > 262144) this.buf = this.buf.slice(-65536);
    const lines = this.buf.split(/\r?\n/);
    this.buf = lines.pop() || "";
    for (const line of lines) this._line(line);
    if (this.waiters.length && this.targets.size > 0) this._wake();
  }

  _line(raw) {
    let line = raw.trim();
    if (!line) return;
    // IEC 62320-1 tillater en TAG-blokk foran selve setningen.
    if (line[0] === "\\") {
      const end = line.indexOf("\\", 1);
      if (end < 0) return;
      line = line.slice(end + 1);
    }
    if (line[0] !== "!" && line[0] !== "$") return;
    if (line.indexOf("VDM") < 0 && line.indexOf("VDO") < 0) return;

    const star = line.lastIndexOf("*");
    const body = star > 0 ? line.slice(1, star) : line.slice(1);
    if (star > 0) {
      let sum = 0;
      for (let i = 0; i < body.length; i++) sum ^= body.charCodeAt(i);
      const given = parseInt(line.slice(star + 1, star + 3), 16);
      if (!Number.isNaN(given) && sum !== given) return;
    }

    const f = body.split(",");
    if (f.length < 6) return;
    const count = parseInt(f[1], 10);
    const num = parseInt(f[2], 10);
    const seq = f[3];
    const chan = f[4] || "?";
    const payload = f[5];
    const fill = parseInt(f[6], 10) || 0;
    if (!count || !num || !payload) return;

    let full = payload;
    let fillBits = fill;
    if (count > 1) {
      const key = chan + "|" + seq + "|" + count;
      let slot = this.frags.get(key);
      if (!slot || num === 1) {
        slot = { parts: new Array(count).fill(null), at: Date.now() };
        this.frags.set(key, slot);
      }
      slot.parts[num - 1] = payload;
      slot.fill = fill;
      slot.at = Date.now();
      if (slot.parts.some((p) => p === null)) return;
      full = slot.parts.join("");
      fillBits = slot.fill;
      this.frags.delete(key);
    }

    const armed = unarmor(full, fillBits);
    if (!armed) return;
    let msg;
    try {
      msg = decode(armed.bits, armed.len);
    } catch (e) {
      return;
    }
    if (!msg) return;

    this.lastMsgAt = Date.now();
    this.msgCount++;
    this._apply(msg);
  }

  _apply(msg) {
    const now = Date.now();
    if (msg.kind === "aton") {
      this.atons.set(msg.mmsi, {
        mmsi: msg.mmsi, lat: msg.lat, lon: msg.lon,
        name: msg.name || "AtoN " + msg.mmsi,
        aidType: msg.aidType, virtual: msg.virtual, last: now
      });
      return;
    }

    let t = this.targets.get(msg.mmsi);
    if (!t) {
      t = { mmsi: msg.mmsi, last: 0 };
      this.targets.set(msg.mmsi, t);
    }
    if (msg.kind === "pos") {
      t.lat = msg.lat;
      t.lon = msg.lon;
      t.sog = msg.sog;
      t.cog = msg.cog;
      t.hdg = msg.hdg != null ? msg.hdg : msg.cog;
      if (msg.navStatus != null) t.navStatus = msg.navStatus;
      t.cls = msg.cls;
      t.last = now;
    }
    if (msg.name) t.name = msg.name;
    if (msg.callsign) t.callsign = msg.callsign;
    if (msg.imo) t.imo = msg.imo;
    if (msg.dest) t.dest = msg.dest;
    if (msg.draught) t.draught = msg.draught;
    if (msg.dim) t.dim = msg.dim;
    if (msg.shipType != null) t.shipType = msg.shipType;
    if (msg.kind === "static") t.lastStatic = now;
  }

  _housekeep() {
    const now = Date.now();
    const cut = now - this.opt.maxAgeMs;
    for (const [k, t] of this.targets) if ((t.last || 0) < cut) this.targets.delete(k);
    for (const [k, a] of this.atons) if ((a.last || 0) < now - 3600000) this.atons.delete(k);
    for (const [k, s] of this.frags) if (s.at < now - 20000) this.frags.delete(k);

    this.rateWindow.push({ t: now, n: this.msgCount });
    if (this.rateWindow.length > 5) this.rateWindow.shift();

    // Ingen har spurt paa lenge - legg paa til noen kommer tilbake.
    if (this.lastTouch && now - this.lastTouch > this.opt.idleMs) {
      this.stop("inaktiv");
    }
  }

  msgRate() {
    if (this.rateWindow.length < 2) return 0;
    const a = this.rateWindow[0];
    const b = this.rateWindow[this.rateWindow.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? Math.round((b.n - a.n) / dt) : 0;
  }

  status() {
    return {
      source: "kystverket",
      host: this.opt.host,
      port: this.opt.port,
      state: this.state,
      connected: this.state === "connected",
      targets: this.targets.size,
      atons: this.atons.size,
      messages: this.msgCount,
      msgRate: this.msgRate(),
      lastMsgAgeMs: this.lastMsgAt ? Date.now() - this.lastMsgAt : null,
      error: this.error
    };
  }

  // Oyeblikksbilde for et kartutsnitt. Stroemmen har ingen filtrering paa
  // serversiden hos Kystverket, saa utsnittet klippes her.
  snapshot(box, includeAtons) {
    const now = Date.now();
    const cut = now - this.opt.maxAgeMs;
    const inBox = (o) =>
      !box || (o.lat >= box.latMin && o.lat <= box.latMax &&
               o.lon >= box.lonMin && o.lon <= box.lonMax);

    const targets = [];
    for (const t of this.targets.values()) {
      if (t.lat == null || (t.last || 0) < cut || !inBox(t)) continue;
      targets.push(t);
    }
    // Er det for mange i utsnittet, behold de ferskeste - de er mest relevante
    // for et kollisjonsbilde og gir minst hakking paa kartet.
    targets.sort((a, b) => (b.last || 0) - (a.last || 0));
    const clipped = targets.slice(0, this.opt.maxTargets);

    const out = {
      now,
      source: "kystverket",
      state: this.state,
      total: this.targets.size,
      shown: clipped.length,
      truncated: targets.length > clipped.length,
      targets: clipped.map((t) => ({
        mmsi: t.mmsi, lat: t.lat, lon: t.lon,
        sog: t.sog, cog: t.cog, hdg: t.hdg,
        navStatus: t.navStatus, name: t.name, callsign: t.callsign,
        imo: t.imo, dest: t.dest, draught: t.draught, dim: t.dim,
        shipType: t.shipType, cls: t.cls,
        ageMs: now - (t.last || now)
      }))
    };

    if (includeAtons) {
      out.atons = [];
      for (const a of this.atons.values()) {
        if (!inBox(a)) continue;
        out.atons.push({
          mmsi: a.mmsi, lat: a.lat, lon: a.lon,
          name: a.name, aidType: a.aidType, virtual: a.virtual
        });
        if (out.atons.length >= 400) break;
      }
    }
    return out;
  }
}

module.exports = { KystverketAis, decode, unarmor };
