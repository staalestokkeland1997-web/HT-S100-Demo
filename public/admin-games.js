let adminPassword = "";

const elements = {
  loginForm: document.getElementById("loginForm"),
  password: document.getElementById("passwordInput"),
  refreshButton: document.getElementById("refreshButton"),
  message: document.getElementById("adminMessage"),
  list: document.getElementById("gameList")
};

// Felter som kan styres per spill. Grensene speiler serverens GAME_SCHEMAS,
// slik at admin ikke kan sende inn verdier som blir stille klippet.
const FIELDS = {
  stacker: [
    { key: "timeLimitSeconds", label: "Time limit", suffix: "s", min: 20, max: 300 },
    { key: "startSpeedPercent", label: "Crane speed", suffix: "%", min: 40, max: 200 },
    { key: "speedRampPercent", label: "Speed ramp", suffix: "%", min: 0, max: 200 },
    { key: "startWidthPercent", label: "Start width", suffix: "%", min: 50, max: 160 },
    { key: "perfectTolerancePercent", label: "Perfect window", suffix: "%", min: 1, max: 15 },
    { key: "perfectRegainPercent", label: "Perfect regain", suffix: "%", min: 0, max: 100 },
    { key: "swayStartLevel", label: "Sway from level", suffix: "", min: 0, max: 60 },
    { key: "swayStrengthPercent", label: "Sway strength", suffix: "%", min: 0, max: 200 },
    { key: "basePoints", label: "Points per drop", suffix: "", min: 1, max: 200 },
    { key: "perfectBonusPoints", label: "Perfect bonus", suffix: "", min: 0, max: 300 },
    { key: "maxComboBonus", label: "Max combo bonus", suffix: "", min: 0, max: 500 }
  ],
  runner: [
    { key: "lives", label: "Hulls", suffix: "", min: 1, max: 6 },
    { key: "startSpeedPercent", label: "Start speed", suffix: "%", min: 50, max: 180 },
    { key: "speedRampPercent", label: "Speed ramp", suffix: "%", min: 0, max: 250 },
    { key: "maxSpeedPercent", label: "Top speed", suffix: "%", min: 110, max: 320 },
    { key: "obstacleDensityPercent", label: "Obstacles", suffix: "%", min: 40, max: 180 },
    { key: "cargoDensityPercent", label: "Cargo", suffix: "%", min: 0, max: 200 },
    { key: "cargoPoints", label: "Points per cargo", suffix: "", min: 1, max: 200 },
    { key: "distancePointsPer100m", label: "Points per 100 m", suffix: "", min: 0, max: 100 },
    { key: "streakBonusPercent", label: "Streak bonus", suffix: "%", min: 0, max: 300 },
    { key: "shieldSeconds", label: "Recovery time", suffix: "s", min: 0, max: 6 }
  ],
  dive: [
    { key: "startSpeedPercent", label: "Start speed", suffix: "%", min: 50, max: 180 },
    { key: "speedRampPercent", label: "Speed ramp", suffix: "%", min: 0, max: 250 },
    { key: "maxSpeedPercent", label: "Top speed", suffix: "%", min: 110, max: 320 },
    { key: "gapSizePercent", label: "Gap size", suffix: "%", min: 60, max: 160 },
    { key: "obstacleSpacingPercent", label: "Rock spacing", suffix: "%", min: 60, max: 180 },
    { key: "liftPercent", label: "Lift strength", suffix: "%", min: 60, max: 160 },
    { key: "pearlPoints", label: "Points per pearl", suffix: "", min: 1, max: 200 },
    { key: "distancePointsPer100m", label: "Points per 100 m", suffix: "", min: 0, max: 100 },
    { key: "mineStartDepth", label: "Mines from depth", suffix: "m", min: 100, max: 2000 }
  ],
  sonar: [
    { key: "nodeCount", label: "Contacts", suffix: "", min: 4, max: 9 },
    { key: "pingMs", label: "Ping length", suffix: "ms", min: 180, max: 1200 },
    { key: "gapMs", label: "Gap between pings", suffix: "ms", min: 60, max: 600 },
    { key: "inputTimeoutSeconds", label: "Answer time", suffix: "s", min: 2, max: 20 },
    { key: "startLength", label: "Start length", suffix: "", min: 1, max: 6 },
    { key: "pointsPerStep", label: "Points per step", suffix: "", min: 1, max: 100 },
    { key: "speedUpPercent", label: "Speed up per level", suffix: "%", min: 0, max: 20 }
  ],
  airhockey: [
    { key: "matchSeconds", label: "Match time", suffix: "s", min: 20, max: 300 },
    { key: "winScore", label: "Win score", suffix: "", min: 3, max: 50 },
    { key: "puckSpeedPercent", label: "Puck speed", suffix: "%", min: 60, max: 180 },
    { key: "paddleSizePercent", label: "Paddle size", suffix: "%", min: 60, max: 160 },
    { key: "powerUpDurationSeconds", label: "Power-up time", suffix: "s", min: 3, max: 20 }
  ]
};

const TOGGLES = {
  stacker: [
    { key: "enableTimeLimit", label: "Use time limit" },
    { key: "enableSway", label: "Crane sway" }
  ],
  runner: [
    { key: "enableJump", label: "Jump over low obstacles" },
    { key: "enableWeather", label: "Weather changes" }
  ],
  dive: [{ key: "enableMines", label: "Sea mines" }],
  sonar: [{ key: "enableTimeout", label: "Answer timeout" }],
  airhockey: [{ key: "enablePowerUps", label: "Power-ups" }]
};

const PRESETS = {
  stacker: {
    Easy: {
      difficultyName: "Easy",
      startSpeedPercent: 70,
      speedRampPercent: 60,
      startWidthPercent: 130,
      perfectTolerancePercent: 9,
      perfectRegainPercent: 50,
      swayStartLevel: 14,
      swayStrengthPercent: 60,
      basePoints: 10,
      perfectBonusPoints: 25,
      maxComboBonus: 120,
      timeLimitSeconds: 120,
      enableSway: true,
      enableTimeLimit: false
    },
    Normal: {
      difficultyName: "Normal",
      startSpeedPercent: 100,
      speedRampPercent: 100,
      startWidthPercent: 100,
      perfectTolerancePercent: 5,
      perfectRegainPercent: 35,
      swayStartLevel: 8,
      swayStrengthPercent: 100,
      basePoints: 10,
      perfectBonusPoints: 25,
      maxComboBonus: 120,
      timeLimitSeconds: 90,
      enableSway: true,
      enableTimeLimit: false
    },
    Hard: {
      difficultyName: "Hard",
      startSpeedPercent: 135,
      speedRampPercent: 145,
      startWidthPercent: 80,
      perfectTolerancePercent: 3,
      perfectRegainPercent: 20,
      swayStartLevel: 4,
      swayStrengthPercent: 145,
      basePoints: 12,
      perfectBonusPoints: 30,
      maxComboBonus: 150,
      timeLimitSeconds: 75,
      enableSway: true,
      enableTimeLimit: false
    }
  },
  runner: {
    Easy: {
      difficultyName: "Easy",
      startSpeedPercent: 80,
      speedRampPercent: 60,
      maxSpeedPercent: 165,
      obstacleDensityPercent: 65,
      cargoDensityPercent: 135,
      lives: 4,
      cargoPoints: 25,
      distancePointsPer100m: 10,
      streakBonusPercent: 120,
      shieldSeconds: 3,
      enableJump: true,
      enableWeather: true
    },
    Normal: {
      difficultyName: "Normal",
      startSpeedPercent: 100,
      speedRampPercent: 100,
      maxSpeedPercent: 220,
      obstacleDensityPercent: 100,
      cargoDensityPercent: 100,
      lives: 3,
      cargoPoints: 25,
      distancePointsPer100m: 10,
      streakBonusPercent: 100,
      shieldSeconds: 2,
      enableJump: true,
      enableWeather: true
    },
    Hard: {
      difficultyName: "Hard",
      startSpeedPercent: 125,
      speedRampPercent: 160,
      maxSpeedPercent: 290,
      obstacleDensityPercent: 145,
      cargoDensityPercent: 80,
      lives: 2,
      cargoPoints: 30,
      distancePointsPer100m: 14,
      streakBonusPercent: 140,
      shieldSeconds: 1,
      enableJump: true,
      enableWeather: true
    }
  },
  dive: {
    Easy: {
      difficultyName: "Easy",
      startSpeedPercent: 80,
      speedRampPercent: 60,
      maxSpeedPercent: 170,
      gapSizePercent: 130,
      obstacleSpacingPercent: 130,
      liftPercent: 100,
      pearlPoints: 25,
      distancePointsPer100m: 10,
      mineStartDepth: 700,
      enableMines: true
    },
    Normal: {
      difficultyName: "Normal",
      startSpeedPercent: 100,
      speedRampPercent: 100,
      maxSpeedPercent: 220,
      gapSizePercent: 100,
      obstacleSpacingPercent: 100,
      liftPercent: 100,
      pearlPoints: 25,
      distancePointsPer100m: 10,
      mineStartDepth: 400,
      enableMines: true
    },
    Hard: {
      difficultyName: "Hard",
      startSpeedPercent: 125,
      speedRampPercent: 160,
      maxSpeedPercent: 290,
      gapSizePercent: 82,
      obstacleSpacingPercent: 84,
      liftPercent: 110,
      pearlPoints: 30,
      distancePointsPer100m: 14,
      mineStartDepth: 250,
      enableMines: true
    }
  },
  sonar: {
    Easy: {
      difficultyName: "Easy",
      nodeCount: 4,
      pingMs: 700,
      gapMs: 260,
      inputTimeoutSeconds: 10,
      startLength: 1,
      pointsPerStep: 10,
      speedUpPercent: 2,
      enableTimeout: true
    },
    Normal: {
      difficultyName: "Normal",
      nodeCount: 6,
      pingMs: 520,
      gapMs: 180,
      inputTimeoutSeconds: 6,
      startLength: 1,
      pointsPerStep: 10,
      speedUpPercent: 4,
      enableTimeout: true
    },
    Hard: {
      difficultyName: "Hard",
      nodeCount: 8,
      pingMs: 340,
      gapMs: 110,
      inputTimeoutSeconds: 4,
      startLength: 2,
      pointsPerStep: 12,
      speedUpPercent: 7,
      enableTimeout: true
    }
  },
  airhockey: {
    Easy: {
      difficultyName: "Easy",
      matchSeconds: 60,
      winScore: 15,
      puckSpeedPercent: 80,
      paddleSizePercent: 130,
      powerUpDurationSeconds: 9,
      enablePowerUps: true
    },
    Normal: {
      difficultyName: "Normal",
      matchSeconds: 60,
      winScore: 25,
      puckSpeedPercent: 100,
      paddleSizePercent: 100,
      powerUpDurationSeconds: 7,
      enablePowerUps: true
    },
    Hard: {
      difficultyName: "Hard",
      matchSeconds: 90,
      winScore: 35,
      puckSpeedPercent: 135,
      paddleSizePercent: 80,
      powerUpDurationSeconds: 5,
      enablePowerUps: true
    }
  }
};

// Spill med egne, mer detaljerte adminsider. Her vises bare rundetid,
// highscore og nullstilling slik at alt er tilgjengelig fra ett sted.
const LINKED_GAMES = {
  rush: {
    href: "/admin-rush.html",
    endpoint: "/api/admin/settings",
    payloadKey: "game",
    fields: [
      { key: "durationSeconds", label: "Round time", suffix: "s", min: 15, max: 90 },
      { key: "countdownSeconds", label: "Countdown", suffix: "s", min: 1, max: 5 }
    ]
  },
  duel: {
    href: "/admin-duel.html",
    endpoint: "/api/admin/duel-settings",
    payloadKey: "duelGame",
    fields: [{ key: "durationSeconds", label: "Round time", suffix: "s", min: 45, max: 300 }]
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
    const payload = await response.json().catch(() => ({ error: "Request failed." }));
    throw new Error(payload.error || "Request failed.");
  }

  return response.json();
}

function createField(gameId, field, value) {
  const label = document.createElement("label");
  label.className = "field";

  const caption = document.createElement("span");
  caption.textContent = field.suffix ? `${field.label} (${field.suffix})` : field.label;

  const input = document.createElement("input");
  input.type = "number";
  input.min = String(field.min);
  input.max = String(field.max);
  input.value = String(value ?? field.min);
  input.dataset.game = gameId;
  input.dataset.key = field.key;

  label.append(caption, input);
  return label;
}

function createToggle(gameId, toggle, value) {
  const label = document.createElement("label");
  label.className = "toggle";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.dataset.game = gameId;
  input.dataset.toggle = toggle.key;

  const caption = document.createElement("span");
  caption.textContent = toggle.label;

  label.append(input, caption);
  return label;
}

function renderBoard(entries) {
  const board = document.createElement("div");
  board.className = "board";

  const title = document.createElement("span");
  title.textContent = "Top scores";
  board.appendChild(title);

  const list = document.createElement("ol");

  if (!entries || !entries.length) {
    const empty = document.createElement("li");
    empty.innerHTML = "<span>No scores yet</span><b>0</b>";
    list.appendChild(empty);
  } else {
    entries.slice(0, 10).forEach((entry, index) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      const score = document.createElement("b");
      name.textContent = `${index + 1}. ${entry.name}`;
      score.textContent = String(entry.score);
      item.append(name, score);
      list.appendChild(item);
    });
  }

  board.appendChild(list);
  return board;
}

function readSettings(gameId) {
  const settings = {};

  document.querySelectorAll(`input[data-game="${gameId}"][data-key]`).forEach((input) => {
    settings[input.dataset.key] = Number(input.value);
  });

  document.querySelectorAll(`input[data-game="${gameId}"][data-toggle]`).forEach((input) => {
    settings[input.dataset.toggle] = input.checked;
  });

  return settings;
}

async function saveGame(gameId, overrides) {
  const linked = LINKED_GAMES[gameId];
  const settings = overrides || readSettings(gameId);

  if (linked) {
    await adminApi(linked.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [linked.payloadKey]: settings })
    });
  } else {
    await adminApi("/api/admin/game-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: gameId, settings })
    });
  }

  elements.message.textContent = "Saved. The next round uses the new settings.";
  await loadGames();
}

async function resetGame(gameId, label) {
  const confirmed = window.confirm(
    `Reset all ${label} scores? A backup of the data file is saved first.`
  );

  if (!confirmed) return;

  const result = await adminApi("/api/admin/reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ game: gameId })
  });

  elements.message.textContent = `${label}: ${result.removed} scores removed. Backup: ${result.backupPath}.`;
  await loadGames();
}

function renderGame(game) {
  const card = document.createElement("article");
  card.className = "game-card";

  const head = document.createElement("div");
  head.className = "game-head";

  const heading = document.createElement("h2");
  heading.textContent = game.label;

  const badges = document.createElement("div");
  badges.className = "badges";

  const difficulty = document.createElement("span");
  difficulty.className = "badge badge--active";
  difficulty.textContent = game.settings.difficultyName || "Custom";

  const count = document.createElement("span");
  count.className = "badge";
  count.textContent = `${game.entryCount} scores`;

  badges.append(difficulty, count);
  head.append(heading, badges);

  const body = document.createElement("div");
  body.className = "game-body";

  const left = document.createElement("div");
  left.style.display = "grid";
  left.style.gap = "14px";

  const linked = LINKED_GAMES[game.id];
  const fieldSpecs = linked ? linked.fields : FIELDS[game.id] || [];
  const toggleSpecs = linked ? [] : TOGGLES[game.id] || [];

  if (PRESETS[game.id]) {
    const presets = document.createElement("div");
    presets.className = "presets";

    Object.keys(PRESETS[game.id]).forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset";
      button.textContent = name;
      button.addEventListener("click", () => {
        saveGame(game.id, PRESETS[game.id][name]).catch((error) => {
          elements.message.textContent = error.message;
        });
      });
      presets.appendChild(button);
    });

    left.appendChild(presets);
  }

  if (fieldSpecs.length) {
    const fields = document.createElement("div");
    fields.className = "fields";
    fieldSpecs.forEach((field) => {
      fields.appendChild(createField(game.id, field, game.settings[field.key]));
    });
    left.appendChild(fields);
  }

  if (toggleSpecs.length) {
    const toggles = document.createElement("div");
    toggles.className = "toggles";
    toggleSpecs.forEach((toggle) => {
      toggles.appendChild(createToggle(game.id, toggle, game.settings[toggle.key]));
    });
    left.appendChild(toggles);
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary";
  save.textContent = "Save settings";
  save.addEventListener("click", () => {
    saveGame(game.id).catch((error) => {
      elements.message.textContent = error.message;
    });
  });

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "danger";
  reset.textContent = "Reset scores";
  reset.addEventListener("click", () => {
    resetGame(game.id, game.label).catch((error) => {
      elements.message.textContent = error.message;
    });
  });

  actions.append(save, reset);

  if (linked) {
    const more = document.createElement("a");
    more.className = "ghost";
    more.href = linked.href;
    more.textContent = "All settings";
    actions.appendChild(more);
  }

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "ghost";
  exportButton.textContent = "Export CSV";
  exportButton.addEventListener("click", () => {
    // Eksporten krever adminpassord i header, saa den hentes som blob.
    downloadCsv(game.id, game.label).catch((error) => {
      elements.message.textContent = error.message;
    });
  });

  actions.appendChild(exportButton);
  left.appendChild(actions);

  if (linked) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Round time is set here. Points, spawn rates and effects live on the full settings page.";
    left.appendChild(note);
  }

  body.append(left, renderBoard(game.leaderboard));
  card.append(head, body);
  return card;
}

async function downloadCsv(gameId, label) {
  const response = await fetch(`/api/admin/export?game=${gameId}`, {
    headers: { "x-admin-password": adminPassword }
  });

  if (!response.ok) {
    elements.message.textContent = "Could not export CSV.";
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-scores.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadGames() {
  const payload = await adminApi("/api/admin/game-settings");
  elements.list.innerHTML = "";
  payload.games.forEach((game) => {
    elements.list.appendChild(renderGame(game));
  });
  elements.list.classList.remove("hidden");
}

elements.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  elements.message.textContent = "";
  adminPassword = elements.password.value;
  loadGames().catch((error) => {
    elements.message.textContent = error.message;
  });
});

elements.refreshButton.addEventListener("click", () => {
  elements.message.textContent = "";
  loadGames().catch((error) => {
    elements.message.textContent = error.message;
  });
});
