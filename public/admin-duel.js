let adminPassword = "";

const elements = {
  loginForm: document.getElementById("loginForm"),
  passwordInput: document.getElementById("passwordInput"),
  adminMessage: document.getElementById("adminMessage"),
  adminContent: document.getElementById("adminContent"),
  currentDifficulty: document.getElementById("currentDifficulty"),
  roundTimePreview: document.getElementById("roundTimePreview"),
  attackPreview: document.getElementById("attackPreview"),
  form: document.getElementById("duelSettingsForm"),
  reloadSettingsButton: document.getElementById("reloadSettingsButton"),
  difficultyNameInput: document.getElementById("difficultyNameInput"),
  durationSecondsInput: document.getElementById("durationSecondsInput"),
  initialShipsInput: document.getElementById("initialShipsInput"),
  spawnIntervalInput: document.getElementById("spawnIntervalInput"),
  correctDockPointsInput: document.getElementById("correctDockPointsInput"),
  comboBonusInput: document.getElementById("comboBonusInput"),
  maxComboBonusInput: document.getElementById("maxComboBonusInput"),
  streakEveryInput: document.getElementById("streakEveryInput"),
  streakBonusInput: document.getElementById("streakBonusInput"),
  priorityBonusInput: document.getElementById("priorityBonusInput"),
  wrongDockPenaltyInput: document.getElementById("wrongDockPenaltyInput"),
  collisionPenaltyInput: document.getElementById("collisionPenaltyInput"),
  trafficPenaltyInput: document.getElementById("trafficPenaltyInput"),
  attackDurationInput: document.getElementById("attackDurationInput"),
  attackMaxInput: document.getElementById("attackMaxInput"),
  attackEnergyBaseInput: document.getElementById("attackEnergyBaseInput"),
  trafficVesselsInput: document.getElementById("trafficVesselsInput"),
  stormSpeedInput: document.getElementById("stormSpeedInput"),
  fogOpacityInput: document.getElementById("fogOpacityInput"),
  glitchIntensityInput: document.getElementById("glitchIntensityInput"),
  beaconScoreInput: document.getElementById("beaconScoreInput"),
  beaconAttackInput: document.getElementById("beaconAttackInput"),
  beaconMinInput: document.getElementById("beaconMinInput"),
  beaconMaxInput: document.getElementById("beaconMaxInput"),
  priorityShipsInput: document.getElementById("priorityShipsInput"),
  beaconsInput: document.getElementById("beaconsInput"),
  finalSurgeInput: document.getElementById("finalSurgeInput"),
  stormInput: document.getElementById("stormInput"),
  fogInput: document.getElementById("fogInput"),
  trafficInput: document.getElementById("trafficInput"),
  glitchInput: document.getElementById("glitchInput")
};

const presets = {
  recommended: {
    difficultyName: "Recommended Duel",
    durationSeconds: 90,
    initialShipsPerPlayer: 3,
    spawnIntervalSeconds: 1.45,
    correctDockPoints: 32,
    comboBonusPerDock: 9,
    maxComboBonus: 90,
    streakEvery: 5,
    streakBonusPoints: 70,
    priorityBonusPoints: 95,
    wrongDockPenalty: 22,
    collisionPenalty: 28,
    trafficPenalty: 12,
    attackDurationSeconds: 7,
    attackMaxEnergy: 95,
    attackEnergyBase: 14,
    trafficVessels: 4,
    stormSpeedMultiplierPercent: 245,
    fogOpacityPercent: 64,
    glitchIntensityPercent: 74,
    beaconScorePoints: 120,
    beaconAttackEnergy: 34,
    beaconSpawnMinSeconds: 9,
    beaconSpawnMaxSeconds: 13,
    enablePriorityShips: true,
    enableBeacons: true,
    enableFinalSurge: true,
    enableStormAttack: true,
    enableFogAttack: true,
    enableTrafficAttack: true,
    enableGlitchAttack: true
  },
  calm: {
    difficultyName: "Calm",
    durationSeconds: 120,
    initialShipsPerPlayer: 2,
    spawnIntervalSeconds: 2.2,
    correctDockPoints: 25,
    comboBonusPerDock: 5,
    maxComboBonus: 50,
    streakEvery: 5,
    streakBonusPoints: 40,
    priorityBonusPoints: 60,
    wrongDockPenalty: 10,
    collisionPenalty: 15,
    trafficPenalty: 6,
    attackDurationSeconds: 4,
    attackMaxEnergy: 120,
    attackEnergyBase: 10,
    trafficVessels: 1,
    stormSpeedMultiplierPercent: 140,
    fogOpacityPercent: 16,
    glitchIntensityPercent: 24,
    beaconScorePoints: 80,
    beaconAttackEnergy: 24,
    beaconSpawnMinSeconds: 12,
    beaconSpawnMaxSeconds: 18,
    enablePriorityShips: true,
    enableBeacons: true,
    enableFinalSurge: true,
    enableStormAttack: true,
    enableFogAttack: true,
    enableTrafficAttack: true,
    enableGlitchAttack: false
  },
  expo: {
    difficultyName: "Expo",
    durationSeconds: 90,
    initialShipsPerPlayer: 3,
    spawnIntervalSeconds: 1.55,
    correctDockPoints: 30,
    comboBonusPerDock: 8,
    maxComboBonus: 80,
    streakEvery: 5,
    streakBonusPoints: 60,
    priorityBonusPoints: 85,
    wrongDockPenalty: 20,
    collisionPenalty: 25,
    trafficPenalty: 10,
    attackDurationSeconds: 5,
    attackMaxEnergy: 100,
    attackEnergyBase: 13,
    trafficVessels: 2,
    stormSpeedMultiplierPercent: 175,
    fogOpacityPercent: 24,
    glitchIntensityPercent: 40,
    beaconScorePoints: 120,
    beaconAttackEnergy: 32,
    beaconSpawnMinSeconds: 9,
    beaconSpawnMaxSeconds: 13,
    enablePriorityShips: true,
    enableBeacons: true,
    enableFinalSurge: true,
    enableStormAttack: true,
    enableFogAttack: true,
    enableTrafficAttack: true,
    enableGlitchAttack: true
  },
  intense: {
    difficultyName: "Intense",
    durationSeconds: 90,
    initialShipsPerPlayer: 4,
    spawnIntervalSeconds: 1.2,
    correctDockPoints: 34,
    comboBonusPerDock: 10,
    maxComboBonus: 100,
    streakEvery: 4,
    streakBonusPoints: 70,
    priorityBonusPoints: 100,
    wrongDockPenalty: 24,
    collisionPenalty: 30,
    trafficPenalty: 12,
    attackDurationSeconds: 5,
    attackMaxEnergy: 115,
    attackEnergyBase: 12,
    trafficVessels: 2,
    stormSpeedMultiplierPercent: 195,
    fogOpacityPercent: 30,
    glitchIntensityPercent: 52,
    beaconScorePoints: 130,
    beaconAttackEnergy: 28,
    beaconSpawnMinSeconds: 10,
    beaconSpawnMaxSeconds: 15,
    enablePriorityShips: true,
    enableBeacons: true,
    enableFinalSurge: true,
    enableStormAttack: true,
    enableFogAttack: true,
    enableTrafficAttack: true,
    enableGlitchAttack: true
  },
  chaos: {
    difficultyName: "Chaos",
    durationSeconds: 75,
    initialShipsPerPlayer: 5,
    spawnIntervalSeconds: 0.95,
    correctDockPoints: 38,
    comboBonusPerDock: 12,
    maxComboBonus: 120,
    streakEvery: 4,
    streakBonusPoints: 90,
    priorityBonusPoints: 120,
    wrongDockPenalty: 30,
    collisionPenalty: 38,
    trafficPenalty: 16,
    attackDurationSeconds: 6,
    attackMaxEnergy: 130,
    attackEnergyBase: 11,
    trafficVessels: 3,
    stormSpeedMultiplierPercent: 225,
    fogOpacityPercent: 38,
    glitchIntensityPercent: 65,
    beaconScorePoints: 150,
    beaconAttackEnergy: 26,
    beaconSpawnMinSeconds: 12,
    beaconSpawnMaxSeconds: 18,
    enablePriorityShips: true,
    enableBeacons: true,
    enableFinalSurge: true,
    enableStormAttack: true,
    enableFogAttack: true,
    enableTrafficAttack: true,
    enableGlitchAttack: true
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

  return response.json();
}

function renderSettings(game) {
  elements.currentDifficulty.textContent = game.difficultyName || "Custom";
  elements.roundTimePreview.textContent = `${game.durationSeconds || 90} sec`;
  elements.attackPreview.textContent = `${game.attackDurationSeconds || 5} sec`;
  elements.difficultyNameInput.value = game.difficultyName || "Custom";
  elements.durationSecondsInput.value = game.durationSeconds;
  elements.initialShipsInput.value = game.initialShipsPerPlayer;
  elements.spawnIntervalInput.value = game.spawnIntervalSeconds;
  elements.correctDockPointsInput.value = game.correctDockPoints;
  elements.comboBonusInput.value = game.comboBonusPerDock;
  elements.maxComboBonusInput.value = game.maxComboBonus;
  elements.streakEveryInput.value = game.streakEvery;
  elements.streakBonusInput.value = game.streakBonusPoints;
  elements.priorityBonusInput.value = game.priorityBonusPoints;
  elements.wrongDockPenaltyInput.value = game.wrongDockPenalty;
  elements.collisionPenaltyInput.value = game.collisionPenalty;
  elements.trafficPenaltyInput.value = game.trafficPenalty;
  elements.attackDurationInput.value = game.attackDurationSeconds;
  elements.attackMaxInput.value = game.attackMaxEnergy;
  elements.attackEnergyBaseInput.value = game.attackEnergyBase;
  elements.trafficVesselsInput.value = game.trafficVessels;
  elements.stormSpeedInput.value = game.stormSpeedMultiplierPercent;
  elements.fogOpacityInput.value = game.fogOpacityPercent;
  elements.glitchIntensityInput.value = game.glitchIntensityPercent;
  elements.beaconScoreInput.value = game.beaconScorePoints;
  elements.beaconAttackInput.value = game.beaconAttackEnergy;
  elements.beaconMinInput.value = game.beaconSpawnMinSeconds;
  elements.beaconMaxInput.value = game.beaconSpawnMaxSeconds;
  elements.priorityShipsInput.checked = Boolean(game.enablePriorityShips);
  elements.beaconsInput.checked = Boolean(game.enableBeacons);
  elements.finalSurgeInput.checked = Boolean(game.enableFinalSurge);
  elements.stormInput.checked = Boolean(game.enableStormAttack);
  elements.fogInput.checked = Boolean(game.enableFogAttack);
  elements.trafficInput.checked = Boolean(game.enableTrafficAttack);
  elements.glitchInput.checked = Boolean(game.enableGlitchAttack);
}

function readSettingsForm() {
  return {
    difficultyName: elements.difficultyNameInput.value || "Custom",
    durationSeconds: Number(elements.durationSecondsInput.value),
    initialShipsPerPlayer: Number(elements.initialShipsInput.value),
    spawnIntervalSeconds: Number(elements.spawnIntervalInput.value),
    correctDockPoints: Number(elements.correctDockPointsInput.value),
    comboBonusPerDock: Number(elements.comboBonusInput.value),
    maxComboBonus: Number(elements.maxComboBonusInput.value),
    streakEvery: Number(elements.streakEveryInput.value),
    streakBonusPoints: Number(elements.streakBonusInput.value),
    priorityBonusPoints: Number(elements.priorityBonusInput.value),
    wrongDockPenalty: Number(elements.wrongDockPenaltyInput.value),
    collisionPenalty: Number(elements.collisionPenaltyInput.value),
    trafficPenalty: Number(elements.trafficPenaltyInput.value),
    attackDurationSeconds: Number(elements.attackDurationInput.value),
    attackMaxEnergy: Number(elements.attackMaxInput.value),
    attackEnergyBase: Number(elements.attackEnergyBaseInput.value),
    trafficVessels: Number(elements.trafficVesselsInput.value),
    stormSpeedMultiplierPercent: Number(elements.stormSpeedInput.value),
    fogOpacityPercent: Number(elements.fogOpacityInput.value),
    glitchIntensityPercent: Number(elements.glitchIntensityInput.value),
    beaconScorePoints: Number(elements.beaconScoreInput.value),
    beaconAttackEnergy: Number(elements.beaconAttackInput.value),
    beaconSpawnMinSeconds: Number(elements.beaconMinInput.value),
    beaconSpawnMaxSeconds: Number(elements.beaconMaxInput.value),
    enablePriorityShips: elements.priorityShipsInput.checked,
    enableBeacons: elements.beaconsInput.checked,
    enableFinalSurge: elements.finalSurgeInput.checked,
    enableStormAttack: elements.stormInput.checked,
    enableFogAttack: elements.fogInput.checked,
    enableTrafficAttack: elements.trafficInput.checked,
    enableGlitchAttack: elements.glitchInput.checked
  };
}

async function loadSettings() {
  const payload = await adminApi("/api/admin/duel-settings");
  renderSettings(payload.duelGame);
  elements.adminContent.classList.remove("hidden");
}

async function saveSettings(settings) {
  const payload = await adminApi("/api/admin/duel-settings", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ duelGame: settings })
  });

  renderSettings(payload.duelGame);
  elements.adminMessage.textContent = "Bridge Duel settings saved. The next round will use the new values.";
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.adminMessage.textContent = "";
  adminPassword = elements.passwordInput.value;

  try {
    await loadSettings();
  } catch (error) {
    elements.adminMessage.textContent = error.message;
  }
});

elements.reloadSettingsButton.addEventListener("click", () => {
  loadSettings().catch((error) => {
    elements.adminMessage.textContent = error.message;
  });
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.adminMessage.textContent = "";
  saveSettings(readSettingsForm()).catch((error) => {
    elements.adminMessage.textContent = error.message;
  });
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = presets[button.dataset.preset];

    if (!preset) {
      return;
    }

    renderSettings(preset);
    saveSettings(preset).catch((error) => {
      elements.adminMessage.textContent = error.message;
    });
  });
});
