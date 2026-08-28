// Lagringslag for Vercel. Serverless-funksjoner har ikke varig filsystem slik
// den gamle lokale serveren hadde (data/entries.json), saa all tilstand gaar
// via en database naar en er konfigurert med miljovariabler:
//   1. Redis-kompatibel REST (Upstash / Vercel KV / Redis Cloud) - forst.
//   2. Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) - hvis ikke Redis.
//
// Uten database faller laget tilbake til /tmp + prosessminne: alt fungerer,
// men data overlever bare saa lenge samme funksjonsinstans er varm. Admin-
// status viser tydelig hvilken modus som er aktiv.

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

// Alternativ: Supabase (Postgres via PostgREST). Brukes naar Redis ikke er
// konfigurert men SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY er satt. Tabellene
// (htkiosk_kv + htkiosk_entries) har RLS paa uten policies, saa bare service-
// nokkelen naar dem — sett den ALDRI i klientkode.
const SUPA_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";
const HAS_SUPABASE = Boolean(SUPA_URL && SUPA_KEY);

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

async function supaFetch(pathname, options = {}) {
  const response = await fetch(SUPA_URL + pathname, {
    ...options,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with status ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
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

  if (HAS_SUPABASE) {
    const rows = await supaFetch(
      `/rest/v1/htkiosk_kv?key=eq.${encodeURIComponent(key)}&select=value`
    );
    return Array.isArray(rows) && rows[0] ? rows[0].value : null;
  }

  return tmpRead(key);
}

async function setJson(key, value) {
  if (HAS_REDIS) {
    await redisCommand(["SET", KEY_PREFIX + key, JSON.stringify(value)]);
    return;
  }

  if (HAS_SUPABASE) {
    await supaFetch("/rest/v1/htkiosk_kv", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ key, value }])
    });
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

  if (HAS_SUPABASE) {
    // PostgREST svarer maks 1000 rader per kall - side igjennom alt.
    const out = [];
    for (let offset = 0; ; offset += 1000) {
      const rows = await supaFetch(
        `/rest/v1/htkiosk_entries?select=entry&order=id.asc&offset=${offset}&limit=1000`
      );
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const row of rows) if (row && row.entry != null) out.push(row.entry);
      if (rows.length < 1000) break;
    }
    return out;
  }

  const stored = tmpRead("entries");
  return Array.isArray(stored) ? stored : [];
}

async function appendEntry(entry) {
  if (HAS_REDIS) {
    await redisCommand(["RPUSH", KEY_PREFIX + "entries", JSON.stringify(entry)]);
    return;
  }

  if (HAS_SUPABASE) {
    // INSERT er atomisk, saa samtidige innsendinger overskriver aldri hverandre.
    await supaFetch("/rest/v1/htkiosk_entries", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify([{ entry }])
    });
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

  if (HAS_SUPABASE) {
    await supaFetch("/rest/v1/htkiosk_entries?id=gte.0", { method: "DELETE" });

    if (entries.length > 0) {
      await supaFetch("/rest/v1/htkiosk_entries", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(entries.map((entry) => ({ entry })))
      });
    }

    return;
  }

  tmpWrite("entries", entries);
}

// Sikkerhetskopier ligger som EN nokkel per kopi, og bare metadataene staar i
// indeksen. For laa alle de ti kopiene i samme verdi: med noen tusen deltakere
// sprengte den Upstash sitt 1 MB-tak, og da feilet nullstillingen i akkurat det
// oyeblikket sikkerhetskopien trengtes. Indeksen er dessuten liten nok til at
// /api/admin/status kan lese den uten aa dra med seg hele deltakerbasen.
async function listBackups() {
  const stored = await getJson("backup-index");

  if (Array.isArray(stored)) {
    return stored;
  }

  // Migrering fra det gamle formatet: hele kopier lagret under "backups".
  const legacy = await getJson("backups");
  return Array.isArray(legacy) ? legacy.map(({ entries, ...meta }) => meta) : [];
}

async function pushBackup(backup) {
  const { entries, ...meta } = backup;
  const index = await listBackups();

  await setJson(`backup:${meta.name}`, { ...meta, entries });

  index.unshift(meta);
  const kept = index.slice(0, MAX_BACKUPS);

  await setJson("backup-index", kept);

  // Rydd bort kopier som falt ut av indeksen, saa de ikke blir liggende med
  // persondata i basen etter at admin har nullstilt.
  for (const dropped of index.slice(MAX_BACKUPS)) {
    await deleteKey(`backup:${dropped.name}`).catch(() => {});
  }
}

async function readBackup(name) {
  return getJson(`backup:${name}`);
}

async function deleteKey(key) {
  if (HAS_REDIS) {
    await redisCommand(["DEL", KEY_PREFIX + key]);
    return;
  }

  if (HAS_SUPABASE) {
    await supaFetch(`/rest/v1/htkiosk_kv?key=eq.${encodeURIComponent(key)}`, { method: "DELETE" });
    return;
  }

  memoryCache.delete(key);

  try {
    fs.unlinkSync(tmpPathFor(key));
  } catch (error) {
    // Fantes ikke - ingenting aa rydde.
  }
}

// Enkel forsoksteller for adminpaalogging og innsending. Redis/Supabase gir
// en teller som deles av alle funksjonsinstanser; uten database faller den
// tilbake til prosessminnet, som er bedre enn ingenting paa en varm instans.
const memoryHits = new Map();

async function hitCount(bucket, windowSeconds) {
  const key = `rate:${bucket}`;

  if (HAS_REDIS) {
    const count = await redisCommand(["INCR", KEY_PREFIX + key]);

    if (Number(count) === 1) {
      await redisCommand(["EXPIRE", KEY_PREFIX + key, String(windowSeconds)]);
    }

    return Number(count);
  }

  const now = Date.now();
  const slot = memoryHits.get(key);

  if (!slot || slot.resetAt <= now) {
    memoryHits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });

    // Uten TTL i basen maa kartet ryddes selv, ellers vokser det i en varm
    // instans som staar hele messedagen.
    if (memoryHits.size > 5000) {
      for (const [k, v] of memoryHits) if (v.resetAt <= now) memoryHits.delete(k);
    }

    return 1;
  }

  slot.count += 1;
  return slot.count;
}

module.exports = {
  mode: HAS_REDIS ? "redis" : HAS_SUPABASE ? "supabase" : "ephemeral",
  persistent: HAS_REDIS || HAS_SUPABASE,
  getJson,
  setJson,
  listEntries,
  appendEntry,
  replaceEntries,
  listBackups,
  pushBackup,
  readBackup,
  deleteKey,
  hitCount
};
