// Lagringslag for Vercel. Serverless-funksjoner har ikke varig filsystem slik
// den gamle lokale serveren hadde (data/entries.json), saa all tilstand gaar
// via en Redis-kompatibel REST-database (Upstash / Vercel KV / Redis Cloud via
// Vercel Marketplace) naar den er konfigurert med miljovariabler.
//
// Uten Redis faller laget tilbake til /tmp + prosessminne: alt fungerer, men
// data overlever bare saa lenge samme funksjonsinstans er varm. Admin-status
// viser tydelig hvilken modus som er aktiv.

const fs = require("fs");
const os = require("os");
const path = require("path");

const REDIS_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL ||
  "";
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN ||
  "";

const HAS_REDIS = Boolean(REDIS_URL && REDIS_TOKEN);
const KEY_PREFIX = "htkiosk:";
const MAX_BACKUPS = 10;

const TMP_DIR = process.env.HTKIOSK_DATA_DIR || path.join(os.tmpdir(), "ht-kiosk-data");
const memoryCache = new Map();

async function redisCommand(command) {
  const response = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    throw new Error(`Redis request failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (payload && payload.error) {
    throw new Error(`Redis error: ${payload.error}`);
  }

  return payload ? payload.result : null;
}

function tmpPathFor(key) {
  return path.join(TMP_DIR, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}

function tmpRead(key) {
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(tmpPathFor(key), "utf8"));
    memoryCache.set(key, parsed);
    return parsed;
  } catch (error) {
    return null;
  }
}

function tmpWrite(key, value) {
  memoryCache.set(key, value);

  try {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    const target = tmpPathFor(key);
    const tempPath = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(tempPath, `${JSON.stringify(value)}\n`, "utf8");
    fs.renameSync(tempPath, target);
  } catch (error) {
    // Minnekopien holder resten av den varme instansen i gang.
  }
}

async function getJson(key) {
  if (HAS_REDIS) {
    const raw = await redisCommand(["GET", KEY_PREFIX + key]);

    if (raw === null || raw === undefined) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  return tmpRead(key);
}

async function setJson(key, value) {
  if (HAS_REDIS) {
    await redisCommand(["SET", KEY_PREFIX + key, JSON.stringify(value)]);
    return;
  }

  tmpWrite(key, value);
}

// Deltakerlisten ligger som Redis-liste slik at samtidige innsendinger fra to
// funksjonsinstanser aldri overskriver hverandre (RPUSH er atomisk).
async function listEntries() {
  if (HAS_REDIS) {
    const raw = (await redisCommand(["LRANGE", KEY_PREFIX + "entries", "0", "-1"])) || [];
    return raw
      .map((item) => {
        try {
          return JSON.parse(item);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
  }

  const stored = tmpRead("entries");
  return Array.isArray(stored) ? stored : [];
}

async function appendEntry(entry) {
  if (HAS_REDIS) {
    await redisCommand(["RPUSH", KEY_PREFIX + "entries", JSON.stringify(entry)]);
    return;
  }

  const entries = await listEntries();
  entries.push(entry);
  tmpWrite("entries", entries);
}

async function replaceEntries(entries) {
  if (HAS_REDIS) {
    await redisCommand(["DEL", KEY_PREFIX + "entries"]);

    if (entries.length > 0) {
      await redisCommand([
        "RPUSH",
        KEY_PREFIX + "entries",
        ...entries.map((entry) => JSON.stringify(entry))
      ]);
    }

    return;
  }

  tmpWrite("entries", entries);
}

async function listBackups() {
  const stored = await getJson("backups");
  return Array.isArray(stored) ? stored : [];
}

async function pushBackup(backup) {
  const backups = await listBackups();
  backups.unshift(backup);
  await setJson("backups", backups.slice(0, MAX_BACKUPS));
}

module.exports = {
  mode: HAS_REDIS ? "redis" : "ephemeral",
  persistent: HAS_REDIS,
  getJson,
  setJson,
  listEntries,
  appendEntry,
  replaceEntries,
  listBackups,
  pushBackup
};
