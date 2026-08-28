// Hele kiosk-API-et som EN Vercel serverless-funksjon. Rutingen og svarene er
// portert fra den gamle lokale server.js slik at frontend-sidene (spill,
// adminsider, ECDIS/radar) fungerer identisk — bare uten lokal server.
// /proxy og /ais/* rutes ogsaa hit via rewrites i vercel.json.

const crypto = require("crypto");
const store = require("./_lib/store");
const contest = require("./_lib/contest");
const { KystverketAis } = require("./_lib/ais-kystverket");
const { ecdisStateId, sanitizeEcdisState } = require("./_lib/ecdis-state");
const { proxyAllows } = require("./_lib/proxy-allowlist");

const KIOSK_CONFIG = require("../config/kiosk-config.json");

function normalizeRoute(route, fallback) {
  if (!route || typeof route !== "string") {
    return fallback;
  }

  return route.startsWith("/") ? route : `/${route}`;
}

function getDefaultRoute() {
  const kiosk = KIOSK_CONFIG.kiosk || {};
  const paths = kiosk.paths || {};

  if (kiosk.defaultPath) {
    return normalizeRoute(kiosk.defaultPath, "/select.html");
  }

  if (kiosk.defaultGame === "selector") {
    return normalizeRoute(paths.selector, "/select.html");
  }

  if (kiosk.defaultGame === "bridgeDuel") {
    return normalizeRoute(paths.bridgeDuel, "/bridge-duel-standalone.html");
  }

  return "/select.html";
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(payload);
}

// Vercel parser JSON-body selv naar Content-Type er satt; behold likevel
// stream-lesing som fallback (f.eks. sendBeacon uten korrekt content-type).
const MAX_BODY_BYTES = 1024 * 1024;

function parseJsonBody(request) {
  // Sjekk headeren for begge grenene under: taket nedenfor gjaldt bare
  // stream-fallbacken, saa en kropp Vercel alt hadde parset slapp usjekket
  // gjennom.
  const declared = Number(request.headers["content-length"]);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Promise.reject(new Error("Payload too large"));
  }

  if (request.body !== undefined && request.body !== null) {
    if (typeof request.body === "string") {
      if (!request.body) {
        return Promise.resolve({});
      }

      try {
        return Promise.resolve(JSON.parse(request.body));
      } catch (error) {
        return Promise.reject(new Error("Invalid JSON"));
      }
    }

    if (Buffer.isBuffer(request.body)) {
      try {
        return Promise.resolve(JSON.parse(request.body.toString("utf8") || "{}"));
      } catch (error) {
        return Promise.reject(new Error("Invalid JSON"));
      }
    }

    return Promise.resolve(request.body);
  }

  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });

    request.on("error", reject);
  });
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""));
  const rightBuffer = Buffer.from(String(right ?? ""));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.headers["x-real-ip"] || "unknown";
}

// Uten dette kan et skript prove tusenvis av adminpassord i minuttet mot en
// serverless-funksjon, eller fylle deltakerlisten med falsk persondata.
// Telleren ligger i basen naar en er koblet til, saa den deles av alle
// instanser; ellers holder den i prosessminnet paa en varm instans.
async function tooManyAttempts(response, bucket, limit, windowSeconds) {
  let count = 0;

  try {
    count = await store.hitCount(bucket, windowSeconds);
  } catch (error) {
    // Er telleren nede, skal den ikke ta ned kiosken. Slipp forespoerselen
    // gjennom heller enn aa avvise ekte deltakere paa messa.
    return false;
  }

  if (count <= limit) {
    return false;
  }

  response.writeHead(429, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Retry-After": String(windowSeconds)
  });
  response.end(JSON.stringify({ error: "Too many requests. Try again shortly." }));
  return true;
}

async function requireAdmin(request, response, config) {
  // ADMIN_PASSWORD glemt i produksjon: da staar standardpassordet fra det
  // offentlige repoet igjen, og adminsidene ville servert persondata til
  // hvem som helst. Steng dem heller enn aa stole paa passordet.
  if (config.adminLocked) {
    sendJson(response, 503, {
      error:
        "Admin is locked: ADMIN_PASSWORD is not set, and the default password from the public " +
        "repository cannot be used in production. Set it in Vercel > Settings > Environment Variables."
    });
    return false;
  }

  if (await tooManyAttempts(response, `admin:${clientIp(request)}`, 10, 600)) {
    return false;
  }

  const password = request.headers["x-admin-password"];

  if (!safeEquals(password, config.admin.password)) {
    sendJson(response, 401, {
      error: "Invalid admin password."
    });
    return false;
  }

  return true;
}

async function handleApi(request, response, url) {
  // Samme ett-segments-begrensning som for AIS: /api/admin/<x> naar funksjonen
  // som /api/admin?sub=<x> via rewriten i vercel.json. Gjenoppbygg stien.
  let pathname = url.pathname;
  if (/^\/api\/admin\/?$/.test(pathname)) {
    const sub = url.searchParams.get("sub");
    if (sub) pathname = "/api/admin/" + sub.replace(/^\/+/, "");
  }
  const config = await contest.loadConfig();

  if (request.method === "GET" && pathname === "/api/config") {
    sendJson(response, 200, contest.publicConfig(config));
    return;
  }

  // Offentlig helsesjekk uten sensitive data: sier om API-et lever og om
  // varig lagring (redis/supabase) er koblet til — praktisk for kiosk-
  // overvaaking og for aa sjekke databasen uten adminpassord.
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      time: new Date().toISOString(),
      storage: { mode: store.mode, persistent: store.persistent },
      adminLocked: Boolean(config.adminLocked)
    });
    return;
  }

  // HT ECDIS: skipets posisjon/kurs/innstillinger lagres server-side slik at
  // demoen fortsetter der den slapp selv om nettleserprofilen nullstilles.
  // AIS-maal lagres IKKE her - hver skjerm henter dem fra /ais/targets.
  // Tidsstemplene under maales i SERVERENS klokke, bade naar tilstanden
  // lagres og naar den leses. Da kan radaren regne ut hvor gammelt et
  // snapshot er uten aa stole paa at ECDIS-maskinen og radarmaskinen har
  // samme klokke - og fore skipet frem dit det faktisk staar naa, i stedet
  // for aa tegne en posisjon som er sekunder gammel.
  if (pathname === "/api/ecdis-state") {
    // En nokkel per kiosk. Endepunktet er offentlig (kiosksidene kan ikke bare
    // paa en hemmelighet), saa uten dette delte ALLE besokende ett skip:
    // to telefoner som aapner demoen overskrev hverandre hvert 5. sekund, og
    // en utenforstaaende kunne flyttet demoskipet midt i en presentasjon.
    // ECDIS og radar aapnes med samme ?kiosk=-verdi og deler derfor tilstand.
    const stateKey = "ecdis-state:" + ecdisStateId(url.searchParams);

    if (request.method === "GET") {
      const state = await store.getJson(stateKey);
      sendJson(response, 200, { ...(state || {}), serverNow: Date.now() });
      return;
    }

    if (request.method === "POST") {
      if (await tooManyAttempts(response, `ecdis:${clientIp(request)}`, 120, 60)) {
        return;
      }

      try {
        const body = await parseJsonBody(request);
        const clean = sanitizeEcdisState(body);

        if (!clean) {
          sendJson(response, 400, { error: "Invalid state payload." });
          return;
        }

        const stamped = { ...clean, serverSavedAt: Date.now() };

        if (JSON.stringify(stamped).length > 256 * 1024) {
          sendJson(response, 413, { error: "State too large." });
          return;
        }

        await store.setJson(stateKey, stamped);
        sendJson(response, 200, { ok: true });
      } catch (error) {
        sendJson(response, 400, { error: "Invalid state payload." });
      }
      return;
    }
  }

  if (request.method === "GET" && pathname === "/api/leaderboard") {
    const entries = await contest.readEntries();
    const game = contest.normalizeGameId(url.searchParams.get("game"));

    sendJson(response, 200, {
      game,
      entries: contest.getLeaderboard(entries, 10, game),
      boards: contest.getAllLeaderboards(entries, 10)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/games") {
    sendJson(response, 200, {
      games: Object.entries(contest.GAMES).map(([id, meta]) => ({
        id,
        label: meta.label,
        settings: config[meta.configKey] || {}
      }))
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/standalone-entry") {
    // Endepunktet er aapent og lagrer navn, e-post og telefon. Uten en bremse
    // kan bade leaderboardet og persondatabasen fylles med soppel fra ett
    // skript. Taket ligger langt over det en messebesokende rekker.
    if (await tooManyAttempts(response, `entry:${clientIp(request)}`, 10, 300)) {
      return;
    }

    const payload = await parseJsonBody(request);
    const entryPayload = payload && typeof payload === "object" ? payload : {};
    const errors = contest.validateStandaloneEntry(entryPayload);
    const score = Number(entryPayload.score);

    if (!Number.isInteger(score) || score < 0 || score > config.game.maxAcceptedScore) {
      errors.push("The score was rejected.");
    }

    if (errors.length > 0) {
      sendJson(response, 400, {
        error: errors.join(" ")
      });
      return;
    }

    const now = new Date().toISOString();
    const game = contest.normalizeGameId(entryPayload.game) || contest.DEFAULT_GAME_ID;
    const entry = {
      id: crypto.randomUUID(),
      name: contest.sanitizeName(entryPayload.name),
      email: String(entryPayload.email || "").trim().toLowerCase(),
      phone: String(entryPayload.phone || "").trim(),
      score,
      game,
      playedAt: entryPayload.playedAt || now,
      createdAt: now
    };

    await store.appendEntry(entry);
    const entries = await contest.readEntries();

    sendJson(response, 201, {
      entry,
      leaderboard: contest.getLeaderboard(entries, 10, game)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/entries") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    const allEntries = (await contest.readEntries()).sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
    const game = contest.normalizeGameId(url.searchParams.get("game"));
    const entries = game ? allEntries.filter((entry) => entry.game === game) : allEntries;

    sendJson(response, 200, {
      game,
      entries,
      leaderboard: contest.getLeaderboard(allEntries, 10, game),
      boards: contest.getAllLeaderboards(allEntries, 10)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/settings") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    sendJson(response, 200, {
      game: config.game,
      booth: config.booth,
      brand: config.brand
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/duel-settings") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    sendJson(response, 200, {
      duelGame: config.duelGame || {}
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/settings") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    const payload = await parseJsonBody(request);
    const nextConfig = {
      ...config,
      game: contest.normalizeGameSettings(payload, config.game)
    };

    if (nextConfig.game.maxTargetSize < nextConfig.game.minTargetSize) {
      nextConfig.game.maxTargetSize = nextConfig.game.minTargetSize;
    }

    await contest.writeConfig(nextConfig);
    sendJson(response, 200, {
      game: nextConfig.game
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/duel-settings") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    const payload = await parseJsonBody(request);
    const duelGame = contest.normalizeDuelGameSettings(payload, config.duelGame || {});

    if (duelGame.beaconSpawnMaxSeconds < duelGame.beaconSpawnMinSeconds) {
      duelGame.beaconSpawnMaxSeconds = duelGame.beaconSpawnMinSeconds;
    }

    if (duelGame.trafficDockHeight > duelGame.normalDockHeight) {
      duelGame.trafficDockHeight = duelGame.normalDockHeight;
    }

    const nextConfig = {
      ...config,
      duelGame
    };

    await contest.writeConfig(nextConfig);
    sendJson(response, 200, {
      duelGame
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/export") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    const exportGame = contest.normalizeGameId(url.searchParams.get("game"));
    const entries = await contest.readEntries();
    const csv = contest.buildCsv(
      exportGame ? entries.filter((entry) => entry.game === exportGame) : entries
    );
    response.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="messekonkurranse-export.csv"',
      "Cache-Control": "no-store"
    });
    response.end(csv);
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/status") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    const entries = await contest.readEntries();
    const host = String(request.headers["x-forwarded-host"] || request.headers.host || "vercel");
    sendJson(response, 200, {
      ok: true,
      time: new Date().toISOString(),
      host,
      port: 443,
      defaultRoute: getDefaultRoute(),
      storage: {
        mode: store.mode,
        persistent: store.persistent,
        note: store.persistent
          ? (store.mode === "supabase"
            ? "Supabase database connected - data is stored permanently."
            : "Redis database connected - data is stored permanently.")
          : "NO database configured - data is temporary and can reset at any time. Connect Upstash Redis in Vercel (Storage tab) or set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
      },
      data: {
        entries: entries.length,
        dataPath: store.persistent ? store.mode : "/tmp (ephemeral)",
        dataBytes: JSON.stringify(entries, null, 2).length + 1,
        latestEntry: entries[entries.length - 1] || null,
        latestBackup: await contest.latestBackupInfo()
      },
      games: {
        harborRush: config.game,
        bridgeDuel: config.duelGame || {}
      },
      perGame: Object.entries(contest.GAMES).map(([id, meta]) => ({
        id,
        label: meta.label,
        entries: entries.filter((entry) => entry.game === id).length,
        difficultyName: (config[meta.configKey] || {}).difficultyName || "Custom",
        best: contest.getLeaderboard(entries, 1, id)[0] || null
      }))
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/admin/game-settings") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    const entries = await contest.readEntries();
    sendJson(response, 200, {
      games: Object.entries(contest.GAMES).map(([id, meta]) => ({
        id,
        label: meta.label,
        configurable: Boolean(contest.GAME_SCHEMAS[id]),
        settings: config[meta.configKey] || {},
        entryCount: entries.filter((entry) => entry.game === id).length,
        leaderboard: contest.getLeaderboard(entries, 10, id)
      }))
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/game-settings") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    const payload = await parseJsonBody(request);
    const gameId = contest.normalizeGameId(payload.game);
    const schema = gameId && contest.GAME_SCHEMAS[gameId];

    if (!schema) {
      sendJson(response, 400, {
        error: "Unknown game, or the game has its own settings page."
      });
      return;
    }

    const configKey = contest.GAMES[gameId].configKey;
    const settings = contest.normalizeBySchema(payload.settings || {}, config[configKey] || {}, schema);
    await contest.writeConfig({ ...config, [configKey]: settings });

    sendJson(response, 200, {
      game: gameId,
      settings
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/admin/reset") {
    if (!(await requireAdmin(request, response, config))) {
      return;
    }

    const payload = await parseJsonBody(request);
    const gameId = contest.normalizeGameId(payload.game);
    const backupPath = await contest.backupEntries(gameId ? `before-reset-${gameId}` : "before-reset");
    const entries = await contest.readEntries();
    // Uten game nullstilles alt, ellers bare det ene spillets resultater.
    const remaining = gameId ? entries.filter((entry) => entry.game !== gameId) : [];

    await store.replaceEntries(remaining);
    sendJson(response, 200, {
      success: true,
      game: gameId,
      removed: entries.length - remaining.length,
      backupPath
    });
    return;
  }

  sendJson(response, 404, {
    error: "Unknown endpoint."
  });
}

// ---------------------------------------------------------------------------
// Kystverkets aapne AIS-stroem
// ---------------------------------------------------------------------------
// Kystverket leverer raa NMEA over TCP, som en nettleser ikke kan snakke med.
// Funksjonen bor: den holder oppkoblingen og deler den ut til alle faner - det
// er nettopp der den slaar aisstream.io, der en gratisnokkel bare tillater en
// samtidig tilkobling og ECDIS + radar derfor slaass om plassen.
//
// Sockelen henger paa modulnivaa slik at den overlever mellom kall saa lenge
// Vercel holder instansen varm; klienten poller hvert 3. sekund, saa den gjor
// den normalt. Er instansen kald, venter forste kall paa at stroemmen leverer
// (ready) i stedet for aa svare tomt - klientene har ingen simulert flaate aa
// falle tilbake paa, saa et tomt svar er et tomt kart.

let aisBridge = null;

async function aisConfig() {
  // Adminsidene kan overstyre kilden, saa den lagrede configen leses forst;
  // feiler lagringslaget skal AIS-en likevel virke paa de bundlede verdiene.
  let stored = null;
  try {
    stored = await contest.loadConfig();
  } catch (error) {
    stored = null;
  }
  const a = (stored && stored.ais) || {};
  const host = process.env.AIS_KYSTVERKET_HOST || a.host || "153.44.253.27";
  const port = Number(process.env.AIS_KYSTVERKET_PORT || a.port) || 5631;
  return {
    enabled: process.env.AIS_KYSTVERKET_ENABLED !== "0" && a.enabled !== false,
    host,
    port
  };
}

async function getAisBridge() {
  const cfg = await aisConfig();
  if (!cfg.enabled) return null;
  if (aisBridge && (aisBridge.opt.host !== cfg.host || aisBridge.opt.port !== cfg.port)) {
    aisBridge.stop("konfigurasjon endret");
    aisBridge = null;
  }
  if (!aisBridge) aisBridge = new KystverketAis({ host: cfg.host, port: cfg.port });
  return aisBridge;
}

function parseBox(raw) {
  if (!raw) return null;
  const p = String(raw).split(",").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  return {
    latMin: Math.min(p[0], p[2]), lonMin: Math.min(p[1], p[3]),
    latMax: Math.max(p[0], p[2]), lonMax: Math.max(p[1], p[3])
  };
}

async function handleAis(request, response, url) {
  const cors = { "Access-Control-Allow-Origin": "*" };
  const bridge = await getAisBridge();
  // Vercel matcher bare ETT path-segment inn i denne funksjonen, saa
  // vercel.json skriver /ais/<x> om til /api/ais?sub=<x>. Avhengig av lag kan
  // funksjonen se originalstien ELLER destinasjonen - taal begge.
  let route = url.pathname.replace(/^\/api/, "");
  if (!/^\/ais\//.test(route)) {
    const sub = url.searchParams.get("sub");
    if (sub) route = "/ais/" + sub.replace(/^\/+/, "");
  }

  if (!bridge) {
    sendJson(response, 503, { error: "The Kystverket source is switched off in config (ais.enabled).", state: "off" });
    return;
  }

  if (route === "/ais/status") {
    bridge.touch();
    // Klientens probe godtar connected ELLER targets > 0, saa den maa faa
    // sjansen til aa se en fersk stroem levere for den gir opp kilden.
    await bridge.ready(4000);
    response.writeHead(200, { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(bridge.status()));
    return;
  }

  if (route === "/ais/targets") {
    bridge.touch();
    await bridge.ready();
    const box = parseBox(url.searchParams.get("bbox"));
    const atons = url.searchParams.get("atons") === "1";
    const snap = bridge.snapshot(box, atons);
    response.writeHead(200, { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(snap));
    return;
  }

  sendJson(response, 404, { error: "Unknown AIS endpoint." });
}

// CORS-proxy for ECDIS-demoens dataleverandoerer (MET/yr, Kartverket tide,
// EMODnet, kystlinje). Streng allowlist saa den ikke kan misbrukes som aapent
// relay; api.met.no krever dessuten en identifiserende User-Agent.
const PROXY_UA = "HT-ECDIS-Demo/1.0 (github.com/staalestokkeland1997-web/HT-S100-Demo)";
const PROXY_TIMEOUT_MS = 8000;
const PROXY_MAX_BYTES = 8 * 1024 * 1024;
const PROXY_MAX_REDIRECTS = 2;

// Allowlisten sjekkes paa HVERT hopp. Med redirect: "follow" ville en tillatt
// vert som svarer 302 mot en annen vert tatt proxyen med seg dit, og
// allowlisten var omgaatt.
async function proxyFetch(startUrl, signal) {
  let target = startUrl;

  for (let hop = 0; hop <= PROXY_MAX_REDIRECTS; hop++) {
    const upstream = await fetch(target.href, {
      headers: { "User-Agent": PROXY_UA },
      redirect: "manual",
      signal
    });

    if (upstream.status < 300 || upstream.status > 399) {
      return upstream;
    }

    const location = upstream.headers.get("location");
    if (!location) return upstream;

    let next;
    try {
      next = new URL(location, target.href);
    } catch (error) {
      throw new Error("Bad redirect target");
    }

    if (!proxyAllows(next)) {
      throw new Error("Redirect to a host that is not allowed: " + next.hostname);
    }

    target = next;
  }

  throw new Error("Too many redirects");
}

async function handleProxy(request, response, query) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*"
  };

  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return;
  }

  if (query.get("ping") !== null && !query.get("url")) {
    response.writeHead(200, { ...cors, "Content-Type": "text/plain" });
    response.end("ok");
    return;
  }

  let target;
  try {
    target = new URL(query.get("url") || "");
  } catch (error) {
    response.writeHead(400, cors);
    response.end("Bad url");
    return;
  }

  if (!proxyAllows(target)) {
    response.writeHead(403, cors);
    response.end("Host not allowed: " + target.hostname);
    return;
  }

  try {
    const upstream = await proxyFetch(target, AbortSignal.timeout(PROXY_TIMEOUT_MS));

    // Uten tak kunne en stor motpart holde hele svaret i minnet paa en
    // funksjon med 30 sekunders levetid.
    const declared = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > PROXY_MAX_BYTES) {
      response.writeHead(502, { ...cors, "Content-Type": "text/plain" });
      response.end("Upstream response too large");
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());

    if (body.length > PROXY_MAX_BYTES) {
      response.writeHead(502, { ...cors, "Content-Type": "text/plain" });
      response.end("Upstream response too large");
      return;
    }

    // Kartfliser og kystlinjer endrer seg ikke, saa la CDN-en beholde dem.
    // For hentet hver panorering flisen paa nytt gjennom funksjonen - tregere
    // paa messa, og unodig baandbredde aa betale for.
    const cacheable = upstream.status === 200 && !/(^|\.)api\.met\.no$/.test(target.hostname);
    response.writeHead(upstream.status, {
      ...cors,
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": cacheable ? "public, max-age=3600, s-maxage=86400" : "no-cache"
    });
    response.end(body);
  } catch (error) {
    const timedOut = error && (error.name === "TimeoutError" || error.name === "AbortError");
    response.writeHead(timedOut ? 504 : 502, { ...cors, "Content-Type": "text/plain" });
    response.end((timedOut ? "Upstream timeout: " : "Upstream error: ") + target.hostname);
  }
}

module.exports = async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");

    // Rewriten /proxy -> /api/proxy kan gi begge stiene her avhengig av lag.
    if (url.pathname === "/proxy" || url.pathname === "/api/proxy") {
      await handleProxy(request, response, url.searchParams);
      return;
    }

    // Samme for /ais/* -> /api/ais/*. Rewriten treffer ogsaa som eksakt
    // /api/ais (med halen i ?sub=), saa den maa med her.
    if (/^\/(api\/)?ais(\/|$)/.test(url.pathname)) {
      await handleAis(request, response, url);
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    sendText(response, 404, "Not found");
  } catch (error) {
    console.error(error);
    sendJson(response, 500, {
      error: "Internal server error."
    });
  }
};
