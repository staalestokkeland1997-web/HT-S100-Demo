let adminPassword = "";

const elements = {
  loginForm: document.getElementById("loginForm"),
  passwordInput: document.getElementById("passwordInput"),
  adminMessage: document.getElementById("adminMessage"),
  adminContent: document.getElementById("adminContent"),
  entriesCount: document.getElementById("entriesCount"),
  bestScore: document.getElementById("bestScore"),
  latestEntry: document.getElementById("latestEntry"),
  roundTotalTargets: document.getElementById("roundTotalTargets"),
  roundPlanGrid: document.getElementById("roundPlanGrid"),
  refreshAdminButton: document.getElementById("refreshAdminButton"),
  exportButton: document.getElementById("exportButton"),
  resetButton: document.getElementById("resetButton"),
  adminLeaderboard: document.getElementById("adminLeaderboard"),
  entriesTableBody: document.getElementById("entriesTableBody"),
  currentDifficulty: document.getElementById("currentDifficulty"),
  settingsForm: document.getElementById("settingsForm"),
  reloadSettingsButton: document.getElementById("reloadSettingsButton"),
  durationSecondsInput: document.getElementById("durationSecondsInput"),
  spawnIntervalInput: document.getElementById("spawnIntervalInput"),
  targetLifetimeInput: document.getElementById("targetLifetimeInput"),
  maxVisibleTargetsInput: document.getElementById("maxVisibleTargetsInput"),
  minTargetSizeInput: document.getElementById("minTargetSizeInput"),
  maxTargetSizeInput: document.getElementById("maxTargetSizeInput"),
  badPenaltyInput: document.getElementById("badPenaltyInput"),
  multiTouchWindowInput: document.getElementById("multiTouchWindowInput"),
  soundDefaultInput: document.getElementById("soundDefaultInput"),
  goodPointsInput: document.getElementById("goodPointsInput"),
  bonusPointsInput: document.getElementById("bonusPointsInput"),
  multiPointsInput: document.getElementById("multiPointsInput"),
  powerDurationInput: document.getElementById("powerDurationInput"),
  powerChanceInput: document.getElementById("powerChanceInput"),
  timeBonusInput: document.getElementById("timeBonusInput"),
  maxTimeBonusInput: document.getElementById("maxTimeBonusInput"),
  timeChanceInput: document.getElementById("timeChanceInput"),
  brandIntensityInput: document.getElementById("brandIntensityInput"),
  nearMissInput: document.getElementById("nearMissInput"),
  progressiveInput: document.getElementById("progressiveInput"),
  powerUpsInput: document.getElementById("powerUpsInput"),
  streakVisualsInput: document.getElementById("streakVisualsInput"),
  finalAlarmInput: document.getElementById("finalAlarmInput"),
  rankRevealInput: document.getElementById("rankRevealInput"),
  hattelandLabelsInput: document.getElementById("hattelandLabelsInput")
};

const difficultyPresets = {
  expo: {
    difficultyName: "Recommended Expo",
    soundDefaultEnabled: true,
    durationSeconds: 30,
    goodTargetBasePoints: 12,
    bonusTargetPoints: 32,
    multiTargetPoints: 48,
    spawnIntervalMs: 390,
    targetLifetimeMs: 1650,
    maxVisibleTargets: 5,
    minTargetSize: 82,
    maxTargetSize: 138,
    badTargetPenalty: 22,
    multiTouchWindowMs: 300,
    powerUpDurationSeconds: 5,
    powerUpSpawnChancePercent: 6,
    timeBonusSeconds: 2,
    maxTimeBonusSeconds: 6,
    timeBonusSpawnChancePercent: 2,
    brandIntensity: "Medium",
    enableNearMissWarnings: true,
    enableProgressiveDifficulty: true,
    enablePowerUps: true,
    enableStreakVisuals: true,
    enableFinalCountdownAlarm: true,
    enableRankReveal: true,
    useHattelandLabels: true
  },
  easy: {
    difficultyName: "Easy",
    soundDefaultEnabled: true,
    durationSeconds: 35,
    goodTargetBasePoints: 12,
    bonusTargetPoints: 28,
    multiTargetPoints: 42,
    spawnIntervalMs: 520,
    targetLifetimeMs: 2100,
    maxVisibleTargets: 3,
    minTargetSize: 108,
    maxTargetSize: 158,
    badTargetPenalty: 12,
    multiTouchWindowMs: 420,
    powerUpDurationSeconds: 6,
    powerUpSpawnChancePercent: 6,
    timeBonusSeconds: 3,
    maxTimeBonusSeconds: 9,
    timeBonusSpawnChancePercent: 4,
    brandIntensity: "Low",
    enableNearMissWarnings: true,
    enableProgressiveDifficulty: false,
    enablePowerUps: true,
    enableStreakVisuals: true,
    enableFinalCountdownAlarm: true,
    enableRankReveal: true,
    useHattelandLabels: true
  },
  normal: {
    difficultyName: "Normal",
    soundDefaultEnabled: true,
    durationSeconds: 30,
    goodTargetBasePoints: 12,
    bonusTargetPoints: 28,
    multiTargetPoints: 42,
    spawnIntervalMs: 420,
    targetLifetimeMs: 1800,
    maxVisibleTargets: 4,
    minTargetSize: 92,
    maxTargetSize: 148,
    badTargetPenalty: 18,
    multiTouchWindowMs: 320,
    powerUpDurationSeconds: 6,
    powerUpSpawnChancePercent: 7,
    timeBonusSeconds: 2,
    maxTimeBonusSeconds: 6,
    timeBonusSpawnChancePercent: 3,
    brandIntensity: "Medium",
    enableNearMissWarnings: true,
    enableProgressiveDifficulty: true,
    enablePowerUps: true,
    enableStreakVisuals: true,
    enableFinalCountdownAlarm: true,
    enableRankReveal: true,
    useHattelandLabels: true
  },
  hard: {
    difficultyName: "Hard",
    soundDefaultEnabled: true,
    durationSeconds: 30,
    goodTargetBasePoints: 12,
    bonusTargetPoints: 28,
    multiTargetPoints: 42,
    spawnIntervalMs: 330,
    targetLifetimeMs: 1400,
    maxVisibleTargets: 5,
    minTargetSize: 76,
    maxTargetSize: 128,
    badTargetPenalty: 24,
    multiTouchWindowMs: 260,
    powerUpDurationSeconds: 6,
    powerUpSpawnChancePercent: 8,
    timeBonusSeconds: 2,
    maxTimeBonusSeconds: 4,
    timeBonusSpawnChancePercent: 2,
    brandIntensity: "Medium",
    enableNearMissWarnings: true,
    enableProgressiveDifficulty: true,
    enablePowerUps: true,
    enableStreakVisuals: true,
    enableFinalCountdownAlarm: true,
    enableRankReveal: true,
    useHattelandLabels: true
  },
  extreme: {
    difficultyName: "Extreme",
    soundDefaultEnabled: true,
    durationSeconds: 30,
    goodTargetBasePoints: 14,
    bonusTargetPoints: 32,
    multiTargetPoints: 50,
    spawnIntervalMs: 250,
    targetLifetimeMs: 1050,
    maxVisibleTargets: 6,
    minTargetSize: 64,
    maxTargetSize: 112,
    badTargetPenalty: 32,
    multiTouchWindowMs: 210,
    powerUpDurationSeconds: 5,
    powerUpSpawnChancePercent: 9,
    timeBonusSeconds: 1,
    maxTimeBonusSeconds: 3,
    timeBonusSpawnChancePercent: 1,
    brandIntensity: "High",
    enableNearMissWarnings: true,
    enableProgressiveDifficulty: true,
    enablePowerUps: true,
    enableStreakVisuals: true,
    enableFinalCountdownAlarm: true,
    enableRankReveal: true,
    useHattelandLabels: true
  }
};

async function adminApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "x-admin-password": adminPassword,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(payload.error || "Admin request failed.");
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.blob();
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("no-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function renderLeaderboard(entries) {
  elements.adminLeaderboard.innerHTML = "";

  entries.forEach((entry) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const score = document.createElement("strong");
    label.textContent = `${entry.rank}. ${entry.name}`;
    score.textContent = String(entry.score);
    item.append(label, score);
    elements.adminLeaderboard.appendChild(item);
  });
}

function renderEntries(entries) {
  elements.entriesTableBody.innerHTML = "";

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    [entry.name, entry.email, entry.phone || "-", String(entry.score), formatDate(entry.createdAt)].forEach(
      (value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      }
    );
    elements.entriesTableBody.appendChild(row);
  });
}

function countByPercent(total, percent) {
  return Math.max(0, Math.round(total * (Number(percent || 0) / 100)));
}

function getRoundPlan(game) {
  const baseInterval = Math.max(140, Number(game.spawnIntervalMs || 420));
  const baseDurationMs = Number(game.durationSeconds || 30) * 1000;
  const progressiveFactor = game.enableProgressiveDifficulty ? 1.18 : 1;
  const plannedSpawns = Math.max(
    24,
    Math.ceil((baseDurationMs / baseInterval) * progressiveFactor) + Number(game.maxVisibleTargets || 4) + 4
  );
  const timeBonusLabel = `+${Number(game.timeBonusSeconds || 0)} sec plates`;
  const counts = {
    [timeBonusLabel]: game.enablePowerUps ? countByPercent(plannedSpawns, game.timeBonusSpawnChancePercent) : 0,
    Powerups: game.enablePowerUps ? countByPercent(plannedSpawns, game.powerUpSpawnChancePercent) : 0,
    Hazards: countByPercent(plannedSpawns, 18),
    Cargo: countByPercent(plannedSpawns, 10),
    "Dual input": countByPercent(plannedSpawns, 20)
  };
  const specialCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  counts.Signals = Math.max(0, plannedSpawns - specialCount);
  return { plannedSpawns, counts };
}

function renderRoundPlan(game) {
  const plan = getRoundPlan(game);
  elements.roundTotalTargets.textContent = `${plan.plannedSpawns} targets`;
  elements.roundPlanGrid.innerHTML = "";

  Object.entries(plan.counts).forEach(([label, count]) => {
    const item = document.createElement("article");
    const title = document.createElement("span");
    const value = document.createElement("strong");
    title.textContent = label;
    value.textContent = String(count);
    item.append(title, value);
    elements.roundPlanGrid.appendChild(item);
  });
}

async function loadAdminData() {
  const [payload] = await Promise.all([adminApi("/api/admin/entries"), loadSettings()]);
  const entries = payload.entries;
  const topScore = payload.leaderboard[0]?.score || 0;
  const latest = entries[0]?.name || "None";

  elements.entriesCount.textContent = String(entries.length);
  elements.bestScore.textContent = String(topScore);
  elements.latestEntry.textContent = latest;
  renderLeaderboard(payload.leaderboard);
  renderEntries(entries);
  elements.adminContent.classList.remove("hidden");
}

function renderSettings(game) {
  elements.currentDifficulty.textContent = game.difficultyName || "Custom";
  renderRoundPlan(game);
  elements.soundDefaultInput.checked = Boolean(game.soundDefaultEnabled ?? true);
  elements.durationSecondsInput.value = game.durationSeconds;
  elements.goodPointsInput.value = game.goodTargetBasePoints;
  elements.bonusPointsInput.value = game.bonusTargetPoints;
  elements.multiPointsInput.value = game.multiTargetPoints;
  elements.spawnIntervalInput.value = game.spawnIntervalMs;
  elements.targetLifetimeInput.value = game.targetLifetimeMs;
  elements.maxVisibleTargetsInput.value = game.maxVisibleTargets;
  elements.minTargetSizeInput.value = game.minTargetSize;
  elements.maxTargetSizeInput.value = game.maxTargetSize;
  elements.badPenaltyInput.value = game.badTargetPenalty;
  elements.multiTouchWindowInput.value = game.multiTouchWindowMs;
  elements.powerDurationInput.value = game.powerUpDurationSeconds;
  elements.powerChanceInput.value = game.powerUpSpawnChancePercent;
  elements.timeBonusInput.value = game.timeBonusSeconds;
  elements.maxTimeBonusInput.value = game.maxTimeBonusSeconds ?? 6;
  elements.timeChanceInput.value = game.timeBonusSpawnChancePercent;
  elements.brandIntensityInput.value = game.brandIntensity || "Medium";
  elements.nearMissInput.checked = Boolean(game.enableNearMissWarnings);
  elements.progressiveInput.checked = Boolean(game.enableProgressiveDifficulty);
  elements.powerUpsInput.checked = Boolean(game.enablePowerUps);
  elements.streakVisualsInput.checked = Boolean(game.enableStreakVisuals);
  elements.finalAlarmInput.checked = Boolean(game.enableFinalCountdownAlarm);
  elements.rankRevealInput.checked = Boolean(game.enableRankReveal);
  elements.hattelandLabelsInput.checked = Boolean(game.useHattelandLabels);
}

async function loadSettings() {
  const payload = await adminApi("/api/admin/settings");
  renderSettings(payload.game);
  return payload.game;
}

function readSettingsForm(difficultyName = "Custom") {
  return {
    difficultyName,
    soundDefaultEnabled: elements.soundDefaultInput.checked,
    durationSeconds: Number(elements.durationSecondsInput.value),
    goodTargetBasePoints: Number(elements.goodPointsInput.value),
    bonusTargetPoints: Number(elements.bonusPointsInput.value),
    multiTargetPoints: Number(elements.multiPointsInput.value),
    spawnIntervalMs: Number(elements.spawnIntervalInput.value),
    targetLifetimeMs: Number(elements.targetLifetimeInput.value),
    maxVisibleTargets: Number(elements.maxVisibleTargetsInput.value),
    minTargetSize: Number(elements.minTargetSizeInput.value),
    maxTargetSize: Number(elements.maxTargetSizeInput.value),
    badTargetPenalty: Number(elements.badPenaltyInput.value),
    multiTouchWindowMs: Number(elements.multiTouchWindowInput.value),
    powerUpDurationSeconds: Number(elements.powerDurationInput.value),
    powerUpSpawnChancePercent: Number(elements.powerChanceInput.value),
    timeBonusSeconds: Number(elements.timeBonusInput.value),
    maxTimeBonusSeconds: Number(elements.maxTimeBonusInput.value),
    timeBonusSpawnChancePercent: Number(elements.timeChanceInput.value),
    brandIntensity: elements.brandIntensityInput.value,
    enableNearMissWarnings: elements.nearMissInput.checked,
    enableProgressiveDifficulty: elements.progressiveInput.checked,
    enablePowerUps: elements.powerUpsInput.checked,
    enableStreakVisuals: elements.streakVisualsInput.checked,
    enableFinalCountdownAlarm: elements.finalAlarmInput.checked,
    enableRankReveal: elements.rankRevealInput.checked,
    useHattelandLabels: elements.hattelandLabelsInput.checked
  };
}

async function saveSettings(game) {
  const payload = await adminApi("/api/admin/settings", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ game })
  });

  renderSettings(payload.game);
  elements.adminMessage.textContent = "Settings saved. The next player will use the new difficulty.";
}

async function exportCsv() {
  const blob = await adminApi("/api/admin/export");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "messekonkurranse-export.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function resetLeaderboard() {
  const confirmed = window.confirm("Reset all registered scores for a new event?");

  if (!confirmed) {
    return;
  }

  const result = await adminApi("/api/admin/reset", { method: "POST" });
  await loadAdminData();
  elements.adminMessage.textContent = `Leaderboard reset. Backup saved: ${result.backupPath || "created"}.`;
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.adminMessage.textContent = "";
  adminPassword = elements.passwordInput.value;

  try {
    await loadAdminData();
  } catch (error) {
    elements.adminMessage.textContent = error.message;
  }
});

elements.refreshAdminButton.addEventListener("click", () => {
  loadAdminData().catch((error) => {
    elements.adminMessage.textContent = error.message;
  });
});

elements.exportButton.addEventListener("click", () => {
  exportCsv().catch((error) => {
    elements.adminMessage.textContent = error.message;
  });
});

elements.resetButton.addEventListener("click", () => {
  resetLeaderboard().catch((error) => {
    elements.adminMessage.textContent = error.message;
  });
});

elements.reloadSettingsButton.addEventListener("click", () => {
  loadSettings().catch((error) => {
    elements.adminMessage.textContent = error.message;
  });
});

elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.adminMessage.textContent = "";
  saveSettings(readSettingsForm()).catch((error) => {
    elements.adminMessage.textContent = error.message;
  });
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = difficultyPresets[button.dataset.preset];

    if (!preset) {
      return;
    }

    renderSettings(preset);
    saveSettings(preset).catch((error) => {
      elements.adminMessage.textContent = error.message;
    });
  });
});
