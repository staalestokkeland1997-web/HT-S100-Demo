const elements = {
  form: document.getElementById("statusLoginForm"),
  password: document.getElementById("statusPasswordInput"),
  message: document.getElementById("statusMessage"),
  content: document.getElementById("statusContent"),
  serverStatus: document.getElementById("serverStatus"),
  entryStatus: document.getElementById("entryStatus"),
  routeStatus: document.getElementById("routeStatus"),
  backupStatus: document.getElementById("backupStatus"),
  rushTitle: document.getElementById("rushStatusTitle"),
  rushBody: document.getElementById("rushStatusBody"),
  duelTitle: document.getElementById("duelStatusTitle"),
  duelBody: document.getElementById("duelStatusBody"),
  refresh: document.getElementById("refreshStatusButton")
};

let adminPassword = "";

async function statusApi() {
  const response = await fetch("/api/admin/status", {
    headers: {
      "x-admin-password": adminPassword
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Status check failed." }));
    throw new Error(payload.error || "Status check failed.");
  }

  return response.json();
}

function renderStatus(status) {
  const rush = status.games.harborRush || {};
  const duel = status.games.bridgeDuel || {};
  const backup = status.data.latestBackup;

  elements.serverStatus.textContent = `${status.host}:${status.port}`;
  elements.entryStatus.textContent = String(status.data.entries);
  elements.routeStatus.textContent = status.defaultRoute;
  elements.backupStatus.textContent = backup ? backup.name : "None";
  elements.rushTitle.textContent = rush.difficultyName || "Custom";
  elements.rushBody.textContent =
    `${rush.durationSeconds || 30}s, spawn ${rush.spawnIntervalMs || 420}ms, lifetime ${rush.targetLifetimeMs || 1800}ms, ` +
    `time bonus +${rush.timeBonusSeconds || 0}s max ${rush.maxTimeBonusSeconds || 0}s.`;
  elements.duelTitle.textContent = duel.difficultyName || "Custom";
  elements.duelBody.textContent =
    `${duel.durationSeconds || 90}s, spawn ${duel.spawnIntervalSeconds || 1.55}s, attack ${duel.attackDurationSeconds || 5}s, ` +
    `fog ${duel.fogOpacityPercent || 0}%, storm ${duel.stormSpeedMultiplierPercent || 100}%.`;
  elements.content.classList.remove("hidden");
}

async function refreshStatus() {
  elements.message.textContent = "";
  renderStatus(await statusApi());
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  adminPassword = elements.password.value;
  refreshStatus().catch((error) => {
    elements.message.textContent = error.message;
  });
});

elements.refresh.addEventListener("click", () => {
  refreshStatus().catch((error) => {
    elements.message.textContent = error.message;
  });
});
