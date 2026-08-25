// Spillogikken fra den gamle lokale server.js, portert uendret slik at alle
// spill, adminsider og grenseverdier oppforer seg identisk paa Vercel.
// Eneste forskjell: config leses/skrives via lagringslaget i store.js i stedet
// for direkte til config/contest-config.json.

const store = require("./store");
const DEFAULT_CONFIG = require("../../config/contest-config.json");

function mergeSection(defaults, stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return defaults;
  }

  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    return stored;
  }

  return { ...defaults, ...stored };
}

// Den lagrede configen leses fra basen ved hvert API-kall, ogsaa av AIS-
// endepunktene som klientene poller hvert 3. sekund. Instansen holdes varm
// mellom kall (det er nettopp derfor AIS-socketen overlever), saa en kort
// cache paa modulnivaa fjerner titalls unodige databaseoppslag i minuttet
// uten at adminendringer blir staaende lenge.
const CONFIG_TTL_MS = 5000;
let configCache = null;
let configCachedAt = 0;

function invalidateConfigCache() {
  configCache = null;
  configCachedAt = 0;
}

const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

// Lagret config (fra adminsidene) legges over de bundlede standardene, felt
// for felt per seksjon, slik at nye standardfelter i repoet aldri forsvinner.
async function loadConfig() {
  if (configCache && Date.now() - configCachedAt < CONFIG_TTL_MS) {
    return configCache;
  }

  const { admin: _ignoredAdmin, apiKeys: _ignoredKeys, ...stored } =
    (await store.getJson("config")) || {};
  const config = { ...DEFAULT_CONFIG, ...stored };

  Object.keys(DEFAULT_CONFIG).forEach((key) => {
    config[key] = mergeSection(DEFAULT_CONFIG[key], stored[key]);
  });

  if (process.env.ADMIN_PASSWORD) {
    config.admin = { ...config.admin, password: process.env.ADMIN_PASSWORD };
  }

  if (process.env.AISSTREAM_API_KEY) {
    config.apiKeys = { ...config.apiKeys, aisstream: process.env.AISSTREAM_API_KEY };
  }

  if (process.env.ARCGIS_API_KEY) {
    config.apiKeys = { ...config.apiKeys, arcgis: process.env.ARCGIS_API_KEY };
  }

  if (!config.admin || !config.admin.password) {
    throw new Error("Missing admin.password in config/contest-config.json");
  }

  // Standardpassordet ligger i et offentlig repo, og bak adminsidene ligger
  // navn, e-post og telefon til alle deltakere. Er ADMIN_PASSWORD glemt i
  // produksjon, stenges adminsidene - men spillene og ECDIS-en fortsetter aa
  // virke. Aa ta ned hele kiosken midt paa en messe ville vaert en verre kur
  // enn sykdommen; /api/health sier tydelig fra i stedet.
  config.adminLocked = IS_PRODUCTION && config.admin.password === DEFAULT_CONFIG.admin.password;

  configCache = config;
  configCachedAt = Date.now();

  return config;
}

// Hemmeligheter kommer fra miljovariabler og skal ALDRI persisteres: gjorde de
// det, ville et adminpassord fra env blitt liggende i basen og fortsatt virke
// lenge etter at variabelen var fjernet.
async function writeConfig(config) {
  const { admin, apiKeys, adminLocked, ...persisted } = config;
  await store.setJson("config", persisted);
  invalidateConfigCache();
}

function toBoundedNumber(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function toBoundedFloat(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number * 100) / 100));
}

function normalizeGameSettings(payload, currentGame) {
  const game = payload.game || payload;
  const brandIntensity = ["Low", "Medium", "High"].includes(game.brandIntensity)
    ? game.brandIntensity
    : currentGame.brandIntensity || "Medium";

  return {
    ...currentGame,
    difficultyName: String(game.difficultyName || currentGame.difficultyName || "Custom").slice(0, 40),
    soundDefaultEnabled:
      typeof game.soundDefaultEnabled === "boolean"
        ? game.soundDefaultEnabled
        : Boolean(currentGame.soundDefaultEnabled ?? true),
    durationSeconds: toBoundedNumber(game.durationSeconds, currentGame.durationSeconds, 15, 90),
    countdownSeconds: toBoundedNumber(game.countdownSeconds, currentGame.countdownSeconds, 1, 5),
    goodTargetBasePoints: toBoundedNumber(
      game.goodTargetBasePoints,
      currentGame.goodTargetBasePoints,
      0,
      250
    ),
    bonusTargetPoints: toBoundedNumber(game.bonusTargetPoints, currentGame.bonusTargetPoints, 0, 500),
    multiTargetPoints: toBoundedNumber(game.multiTargetPoints, currentGame.multiTargetPoints, 0, 750),
    badTargetPenalty: toBoundedNumber(game.badTargetPenalty, currentGame.badTargetPenalty, 0, 100),
    enableNearMissWarnings:
      typeof game.enableNearMissWarnings === "boolean"
        ? game.enableNearMissWarnings
        : Boolean(currentGame.enableNearMissWarnings ?? true),
    enableProgressiveDifficulty:
      typeof game.enableProgressiveDifficulty === "boolean"
        ? game.enableProgressiveDifficulty
        : Boolean(currentGame.enableProgressiveDifficulty ?? true),
    enablePowerUps:
      typeof game.enablePowerUps === "boolean" ? game.enablePowerUps : Boolean(currentGame.enablePowerUps ?? true),
    enableStreakVisuals:
      typeof game.enableStreakVisuals === "boolean"
        ? game.enableStreakVisuals
        : Boolean(currentGame.enableStreakVisuals ?? true),
    enableFinalCountdownAlarm:
      typeof game.enableFinalCountdownAlarm === "boolean"
        ? game.enableFinalCountdownAlarm
        : Boolean(currentGame.enableFinalCountdownAlarm ?? true),
    enableRankReveal:
      typeof game.enableRankReveal === "boolean" ? game.enableRankReveal : Boolean(currentGame.enableRankReveal ?? true),
    useHattelandLabels:
      typeof game.useHattelandLabels === "boolean"
        ? game.useHattelandLabels
        : Boolean(currentGame.useHattelandLabels ?? true),
    powerUpDurationSeconds: toBoundedNumber(
      game.powerUpDurationSeconds,
      currentGame.powerUpDurationSeconds,
      2,
      15
    ),
    powerUpSpawnChancePercent: toBoundedNumber(
      game.powerUpSpawnChancePercent,
      currentGame.powerUpSpawnChancePercent,
      0,
      25
    ),
    timeBonusSeconds: toBoundedNumber(game.timeBonusSeconds, currentGame.timeBonusSeconds, 1, 15),
    maxTimeBonusSeconds: toBoundedNumber(
      game.maxTimeBonusSeconds,
      currentGame.maxTimeBonusSeconds ?? 6,
      0,
      60
    ),
    timeBonusSpawnChancePercent: toBoundedNumber(
      game.timeBonusSpawnChancePercent,
      currentGame.timeBonusSpawnChancePercent,
      0,
      20
    ),
    brandIntensity,
    multiTouchWindowMs: toBoundedNumber(game.multiTouchWindowMs, currentGame.multiTouchWindowMs, 160, 800),
    maxVisibleTargets: toBoundedNumber(game.maxVisibleTargets, currentGame.maxVisibleTargets, 2, 8),
    spawnIntervalMs: toBoundedNumber(game.spawnIntervalMs, currentGame.spawnIntervalMs, 180, 1000),
    targetLifetimeMs: toBoundedNumber(game.targetLifetimeMs, currentGame.targetLifetimeMs, 650, 3000),
    minTargetSize: toBoundedNumber(game.minTargetSize, currentGame.minTargetSize, 48, 180),
    maxTargetSize: toBoundedNumber(game.maxTargetSize, currentGame.maxTargetSize, 64, 220),
    scoreHighlightThreshold: toBoundedNumber(
      game.scoreHighlightThreshold,
      currentGame.scoreHighlightThreshold,
      0,
      2000
    )
  };
}

function normalizeDuelGameSettings(payload, currentDuelGame = {}) {
  const game = payload.duelGame || payload.game || payload;

  return {
    ...currentDuelGame,
    difficultyName: String(game.difficultyName || currentDuelGame.difficultyName || "Custom").slice(0, 40),
    durationSeconds: toBoundedNumber(game.durationSeconds, currentDuelGame.durationSeconds || 90, 45, 300),
    initialShipsPerPlayer: toBoundedNumber(
      game.initialShipsPerPlayer,
      currentDuelGame.initialShipsPerPlayer || 3,
      1,
      8
    ),
    spawnIntervalSeconds: toBoundedFloat(
      game.spawnIntervalSeconds,
      currentDuelGame.spawnIntervalSeconds || 1.55,
      0.6,
      4
    ),
    finalSurgeSeconds: toBoundedNumber(game.finalSurgeSeconds, currentDuelGame.finalSurgeSeconds || 15, 5, 60),
    finalSurgeSpawnFactorPercent: toBoundedNumber(
      game.finalSurgeSpawnFactorPercent,
      currentDuelGame.finalSurgeSpawnFactorPercent || 82,
      45,
      120
    ),
    attackDurationSeconds: toBoundedNumber(
      game.attackDurationSeconds,
      currentDuelGame.attackDurationSeconds || 5,
      2,
      15
    ),
    attackMaxEnergy: toBoundedNumber(game.attackMaxEnergy, currentDuelGame.attackMaxEnergy || 100, 40, 200),
    correctDockPoints: toBoundedNumber(game.correctDockPoints, currentDuelGame.correctDockPoints || 30, 0, 250),
    comboBonusPerDock: toBoundedNumber(game.comboBonusPerDock, currentDuelGame.comboBonusPerDock || 8, 0, 80),
    maxComboBonus: toBoundedNumber(game.maxComboBonus, currentDuelGame.maxComboBonus || 80, 0, 300),
    streakEvery: toBoundedNumber(game.streakEvery, currentDuelGame.streakEvery || 5, 2, 20),
    streakBonusPoints: toBoundedNumber(game.streakBonusPoints, currentDuelGame.streakBonusPoints || 60, 0, 500),
    priorityBonusPoints: toBoundedNumber(game.priorityBonusPoints, currentDuelGame.priorityBonusPoints || 85, 0, 500),
    wrongDockPenalty: toBoundedNumber(game.wrongDockPenalty, currentDuelGame.wrongDockPenalty || 20, 0, 200),
    collisionPenalty: toBoundedNumber(game.collisionPenalty, currentDuelGame.collisionPenalty || 25, 0, 200),
    trafficPenalty: toBoundedNumber(game.trafficPenalty, currentDuelGame.trafficPenalty || 10, 0, 200),
    attackEnergyBase: toBoundedNumber(game.attackEnergyBase, currentDuelGame.attackEnergyBase || 13, 0, 100),
    attackEnergyComboFactorPercent: toBoundedNumber(
      game.attackEnergyComboFactorPercent,
      currentDuelGame.attackEnergyComboFactorPercent || 34,
      0,
      200
    ),
    attackEnergyStreakFactorPercent: toBoundedNumber(
      game.attackEnergyStreakFactorPercent,
      currentDuelGame.attackEnergyStreakFactorPercent || 18,
      0,
      200
    ),
    priorityAttackEnergy: toBoundedNumber(
      game.priorityAttackEnergy,
      currentDuelGame.priorityAttackEnergy || 28,
      0,
      150
    ),
    beaconAttackEnergy: toBoundedNumber(
      game.beaconAttackEnergy,
      currentDuelGame.beaconAttackEnergy || 32,
      0,
      150
    ),
    beaconScorePoints: toBoundedNumber(
      game.beaconScorePoints,
      currentDuelGame.beaconScorePoints || 120,
      0,
      500
    ),
    beaconSpawnMinSeconds: toBoundedNumber(
      game.beaconSpawnMinSeconds,
      currentDuelGame.beaconSpawnMinSeconds || 9,
      3,
      60
    ),
    beaconSpawnMaxSeconds: toBoundedNumber(
      game.beaconSpawnMaxSeconds,
      currentDuelGame.beaconSpawnMaxSeconds || 13,
      3,
      90
    ),
    trafficVessels: toBoundedNumber(game.trafficVessels, currentDuelGame.trafficVessels || 2, 1, 6),
    stormSpeedMultiplierPercent: toBoundedNumber(
      game.stormSpeedMultiplierPercent,
      currentDuelGame.stormSpeedMultiplierPercent || 175,
      100,
      350
    ),
    stormExistingShipBoostPercent: toBoundedNumber(
      game.stormExistingShipBoostPercent,
      currentDuelGame.stormExistingShipBoostPercent || 118,
      100,
      250
    ),
    fogOpacityPercent: toBoundedNumber(game.fogOpacityPercent, currentDuelGame.fogOpacityPercent || 24, 0, 85),
    glitchIntensityPercent: toBoundedNumber(
      game.glitchIntensityPercent,
      currentDuelGame.glitchIntensityPercent || 40,
      0,
      100
    ),
    trafficDockHeight: toBoundedNumber(game.trafficDockHeight, currentDuelGame.trafficDockHeight || 60, 40, 90),
    normalDockHeight: toBoundedNumber(game.normalDockHeight, currentDuelGame.normalDockHeight || 64, 46, 100),
    enablePriorityShips:
      typeof game.enablePriorityShips === "boolean"
        ? game.enablePriorityShips
        : Boolean(currentDuelGame.enablePriorityShips ?? true),
    priorityShipChancePercent: toBoundedNumber(
      game.priorityShipChancePercent,
      currentDuelGame.priorityShipChancePercent || 22,
      0,
      80
    ),
    enableBeacons:
      typeof game.enableBeacons === "boolean" ? game.enableBeacons : Boolean(currentDuelGame.enableBeacons ?? true),
    enableFinalSurge:
      typeof game.enableFinalSurge === "boolean"
        ? game.enableFinalSurge
        : Boolean(currentDuelGame.enableFinalSurge ?? true),
    enableStormAttack:
      typeof game.enableStormAttack === "boolean"
        ? game.enableStormAttack
        : Boolean(currentDuelGame.enableStormAttack ?? true),
    enableFogAttack:
      typeof game.enableFogAttack === "boolean" ? game.enableFogAttack : Boolean(currentDuelGame.enableFogAttack ?? true),
    enableTrafficAttack:
      typeof game.enableTrafficAttack === "boolean"
        ? game.enableTrafficAttack
        : Boolean(currentDuelGame.enableTrafficAttack ?? true),
    enableGlitchAttack:
      typeof game.enableGlitchAttack === "boolean"
        ? game.enableGlitchAttack
        : Boolean(currentDuelGame.enableGlitchAttack ?? true)
  };
}

// Alle spill i kiosken. configKey peker paa seksjonen i contest-config.json,
// og gameId er det spillene sender inn sammen med score.
const GAMES = {
  stacker: { label: "Container Stacker", configKey: "stackerGame" },
  runner: { label: "Fjord Runner", configKey: "runnerGame" },
  dive: { label: "Deep Dive", configKey: "diveGame" },
  rush: { label: "Harbor Rush", configKey: "game" },
  duel: { label: "Bridge Duel", configKey: "duelGame" },
  airhockey: { label: "HT Air Hockey", configKey: "airHockeyGame" },
  sonar: { label: "Sonar Sequence", configKey: "sonarGame" }
};

const DEFAULT_GAME_ID = "rush";

// Enkle grenser per felt slik at nye spill ikke trenger hver sin normalizer.
const GAME_SCHEMAS = {
  airhockey: {
    numbers: {
      matchSeconds: { min: 20, max: 300, fallback: 60 },
      winScore: { min: 3, max: 50, fallback: 25 },
      puckSpeedPercent: { min: 60, max: 180, fallback: 100 },
      paddleSizePercent: { min: 60, max: 160, fallback: 100 },
      powerUpDurationSeconds: { min: 3, max: 20, fallback: 7 }
    },
    booleans: { enablePowerUps: true }
  },
  stacker: {
    numbers: {
      startSpeedPercent: { min: 40, max: 200, fallback: 100 },
      speedRampPercent: { min: 0, max: 200, fallback: 100 },
      startWidthPercent: { min: 50, max: 160, fallback: 100 },
      perfectTolerancePercent: { min: 1, max: 15, fallback: 5 },
      perfectRegainPercent: { min: 0, max: 100, fallback: 35 },
      swayStartLevel: { min: 0, max: 60, fallback: 8 },
      swayStrengthPercent: { min: 0, max: 200, fallback: 100 },
      basePoints: { min: 1, max: 200, fallback: 10 },
      perfectBonusPoints: { min: 0, max: 300, fallback: 25 },
      maxComboBonus: { min: 0, max: 500, fallback: 120 },
      timeLimitSeconds: { min: 20, max: 300, fallback: 90 }
    },
    booleans: { enableSway: true, enableTimeLimit: false }
  },
  runner: {
    numbers: {
      startSpeedPercent: { min: 50, max: 180, fallback: 100 },
      speedRampPercent: { min: 0, max: 250, fallback: 100 },
      maxSpeedPercent: { min: 110, max: 320, fallback: 220 },
      obstacleDensityPercent: { min: 40, max: 180, fallback: 100 },
      cargoDensityPercent: { min: 0, max: 200, fallback: 100 },
      lives: { min: 1, max: 6, fallback: 3 },
      cargoPoints: { min: 1, max: 200, fallback: 25 },
      distancePointsPer100m: { min: 0, max: 100, fallback: 10 },
      streakBonusPercent: { min: 0, max: 300, fallback: 100 },
      shieldSeconds: { min: 0, max: 6, fallback: 2 }
    },
    booleans: { enableJump: true, enableWeather: true }
  },
  dive: {
    numbers: {
      startSpeedPercent: { min: 50, max: 180, fallback: 100 },
      speedRampPercent: { min: 0, max: 250, fallback: 100 },
      maxSpeedPercent: { min: 110, max: 320, fallback: 220 },
      gapSizePercent: { min: 60, max: 160, fallback: 100 },
      obstacleSpacingPercent: { min: 60, max: 180, fallback: 100 },
      liftPercent: { min: 60, max: 160, fallback: 100 },
      pearlPoints: { min: 1, max: 200, fallback: 25 },
      distancePointsPer100m: { min: 0, max: 100, fallback: 10 },
      mineStartDepth: { min: 100, max: 2000, fallback: 400 }
    },
    booleans: { enableMines: true }
  },
  sonar: {
    numbers: {
      nodeCount: { min: 4, max: 9, fallback: 6 },
      pingMs: { min: 180, max: 1200, fallback: 520 },
      gapMs: { min: 60, max: 600, fallback: 180 },
      inputTimeoutSeconds: { min: 2, max: 20, fallback: 6 },
      startLength: { min: 1, max: 6, fallback: 1 },
      pointsPerStep: { min: 1, max: 100, fallback: 10 },
      speedUpPercent: { min: 0, max: 20, fallback: 4 }
    },
    booleans: { enableTimeout: true }
  }
};

function normalizeBySchema(payload, current, schema) {
  const next = { ...current };
  next.difficultyName = String(payload.difficultyName || current.difficultyName || "Custom").slice(0, 40);

  Object.entries(schema.numbers || {}).forEach(([field, range]) => {
    const fallback = current[field] ?? range.fallback;
    next[field] = toBoundedNumber(payload[field], fallback, range.min, range.max);
  });

  Object.entries(schema.booleans || {}).forEach(([field, fallback]) => {
    next[field] =
      typeof payload[field] === "boolean" ? payload[field] : Boolean(current[field] ?? fallback);
  });

  return next;
}

function normalizeGameId(value) {
  const id = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(GAMES, id) ? id : null;
}

function publicConfig(config) {
  return {
    brand: config.brand,
    booth: config.booth,
    game: config.game,
    duelGame: config.duelGame,
    airHockeyGame: config.airHockeyGame || {},
    stackerGame: config.stackerGame || {},
    runnerGame: config.runnerGame || {},
    diveGame: config.diveGame || {},
    sonarGame: config.sonarGame || {},
    privacy: config.privacy,
    theme: config.theme,
    // API-nokler for innebygde demoer (f.eks. aisstream.io for HT ECDIS).
    // Disse brukes av klienten direkte og er derfor bevisst i public config.
    apiKeys: config.apiKeys || {},
    // AIS-kilder for HT ECDIS. Klienten viser en velger basert paa denne.
    ais: {
      source: (config.ais && config.ais.source) || "auto",
      kystverket: {
        enabled: !(config.ais && config.ais.enabled === false),
        host: (config.ais && config.ais.host) || "153.44.253.27",
        port: (config.ais && Number(config.ais.port)) || 5631
      }
    }
  };
}

async function readEntries() {
  const entries = await store.listEntries();

  // Eldre oppforinger ble lagret for spillene fikk egne lister.
  return entries.map((entry) => ({
    ...entry,
    game: normalizeGameId(entry.game) || DEFAULT_GAME_ID
  }));
}

async function backupEntries(reason = "manual") {
  const entries = await readEntries();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeReason = String(reason).replace(/[^a-z0-9_-]/gi, "-").slice(0, 32) || "manual";
  const name = `entries-${timestamp}-${safeReason}.json`;
  const backup = {
    name,
    createdAt: new Date().toISOString(),
    bytes: JSON.stringify(entries, null, 2).length + 1,
    entries
  };

  await store.pushBackup(backup);
  return `backup:${name}`;
}

async function latestBackupInfo() {
  const backups = await store.listBackups();
  const latest = backups[0];

  if (!latest) {
    return null;
  }

  return {
    name: latest.name,
    path: `backup:${latest.name}`,
    createdAt: latest.createdAt,
    bytes: latest.bytes
  };
}

function getLeaderboard(entries, limit = 10, game = null) {
  const scoped = game ? entries.filter((entry) => entry.game === game) : entries;

  return [...scoped]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return new Date(left.playedAt).getTime() - new Date(right.playedAt).getTime();
    })
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      score: entry.score,
      game: entry.game,
      playedAt: entry.playedAt
    }));
}

// Ett gjennomlop i stedet for en full sortering per spill. Med sju spill
// sorterte /api/leaderboard hele deltakerlisten sju ganger for hver
// forespoersel, ogsaa naar klienten bare ba om ett av dem.
function getAllLeaderboards(entries, limit = 10) {
  const byGame = Object.fromEntries(Object.keys(GAMES).map((gameId) => [gameId, []]));

  for (const entry of entries) {
    const bucket = byGame[entry.game];
    if (bucket) bucket.push(entry);
  }

  return Object.fromEntries(
    Object.entries(byGame).map(([gameId, scoped]) => [gameId, getLeaderboard(scoped, limit)])
  );
}

function buildCsv(entries) {
  const header = ["id", "game", "name", "email", "phone", "score", "playedAt", "createdAt"];
  const rows = entries.map((entry) => [
    entry.id,
    entry.game || DEFAULT_GAME_ID,
    entry.name,
    entry.email,
    entry.phone || "",
    entry.score,
    entry.playedAt,
    entry.createdAt
  ]);

  // Regneark tolker ledende =, +, - og @ som formelstart, saa et deltakernavn
  // kan ellers bli kjorbar kode naar admin aapner eksporten i Excel. Apostrof
  // foran gjor cellen til ren tekst.
  const escape = (value) => {
    const text = String(value ?? "");
    const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, "\"\"")}"`;
  };
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

// Navn vises paa kiosk-leaderboards; fjern tegn som kan tolkes som HTML.
function sanitizeName(value) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, 40);
}

function validateStandaloneEntry(payload = {}) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    errors.push("Invalid entry data.");
    return errors;
  }

  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!payload.name || String(payload.name).trim().length < 2) {
    errors.push("Name must be at least 2 characters.");
  }

  if (!email && !phone) {
    errors.push("Email or phone is required.");
  }

  if (email && !emailPattern.test(email)) {
    errors.push("The email address is invalid.");
  }

  if (phone && (phone.length < 5 || phone.length > 30)) {
    errors.push("The phone number must be between 5 and 30 characters.");
  }

  return errors;
}

module.exports = {
  GAMES,
  DEFAULT_GAME_ID,
  GAME_SCHEMAS,
  loadConfig,
  writeConfig,
  invalidateConfigCache,
  toBoundedNumber,
  toBoundedFloat,
  normalizeGameSettings,
  normalizeDuelGameSettings,
  normalizeBySchema,
  normalizeGameId,
  publicConfig,
  readEntries,
  backupEntries,
  latestBackupInfo,
  getLeaderboard,
  getAllLeaderboards,
  buildCsv,
  sanitizeName,
  validateStandaloneEntry
};
