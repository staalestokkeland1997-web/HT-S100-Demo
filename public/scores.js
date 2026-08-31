// Highscore som overlever alt: lokalt paa enheten FORST, server naar den svarer.
//
// Bakgrunnen: uten database er serveren bare varm-instans-minne, og en
// highscoreliste som forsvinner midt paa en messedag er verdilos. Derfor er
// localStorage sannheten paa enheten - den overlever bade reload, redeploy og
// at nettet faller ut - mens serveren gir det felles bildet naar den er der.
// Listen som vises er de to flettet sammen.
//
// PERSONVERN: den lokale listen inneholder BARE navn, poeng og tidspunkt.
// E-post og telefon ligger utelukkende i synkekoen, og slettes i det
// innsendingen gaar gjennom. En kiosk som staar aapen paa en messe skal ikke
// baere kontaktopplysninger i nettleseren lenger enn nodvendig.
(function () {
  "use strict";

  var BOARD_KEY = "htkiosk_board_v1";
  var PENDING_KEY = "htkiosk_pending_v1";
  var BOARD_MAX = 50;
  var PENDING_MAX = 200;
  var PENDING_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Serveren lager sin egen id, saa den kan ikke brukes til aa kjenne igjen en
  // oppforing paa tvers. playedAt settes av klienten og bevares av serveren,
  // saa spill+navn+poeng+tidspunkt identifiserer samme runde.
  function fingerprint(entry) {
    return [
      entry.game || "",
      String(entry.name || "").trim().toLowerCase(),
      Number(entry.score) || 0,
      entry.playedAt || ""
    ].join("|");
  }

  function publicFields(entry) {
    return {
      game: entry.game,
      name: entry.name,
      score: Number(entry.score) || 0,
      playedAt: entry.playedAt
    };
  }

  function rank(entries, limit) {
    return entries
      .slice()
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.playedAt || 0).getTime() - new Date(b.playedAt || 0).getTime();
      })
      .slice(0, limit || 10)
      .map(function (entry, i) {
        return {
          rank: i + 1,
          name: entry.name,
          score: entry.score,
          game: entry.game,
          playedAt: entry.playedAt
        };
      });
  }

  function merge(local, server, game, limit) {
    var seen = {};
    var out = [];

    (server || []).concat(local || []).forEach(function (entry) {
      if (!entry || (game && entry.game !== game)) return;
      var key = fingerprint(entry);
      if (seen[key]) return;
      seen[key] = true;
      out.push(publicFields(entry));
    });

    return rank(out, limit);
  }

  function saveLocal(entry) {
    var board = read(BOARD_KEY);
    board.push(publicFields(entry));

    // Hold listen kort per spill, ellers vokser den hele messen igjennom.
    var perGame = {};
    var kept = [];
    board
      .slice()
      .sort(function (a, b) { return (b.score || 0) - (a.score || 0); })
      .forEach(function (e) {
        var n = (perGame[e.game] = (perGame[e.game] || 0) + 1);
        if (n <= BOARD_MAX) kept.push(e);
      });

    write(BOARD_KEY, kept);
  }

  function queue(entry) {
    var pending = read(PENDING_KEY);
    pending.push(entry);
    write(PENDING_KEY, pending.slice(-PENDING_MAX));
  }

  function dropFromQueue(entry) {
    var key = fingerprint(entry);
    write(
      PENDING_KEY,
      read(PENDING_KEY).filter(function (e) { return fingerprint(e) !== key; })
    );
  }

  function canReachServer() {
    return typeof fetch === "function" && location.protocol !== "file:";
  }

  function post(entry) {
    if (!canReachServer()) {
      return Promise.reject(new Error("No server."));
    }

    return fetch("/api/standalone-entry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) {
          var error = new Error(payload.error || "Could not save score.");
          // 4xx betyr at serveren avviste innholdet. Da hjelper det ikke aa
          // prove igjen senere - koen skal ikke fylles med noe som aldri gaar
          // gjennom. 5xx, 429 og nettverksfeil er derimot verdt et nytt forsok.
          error.permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
          throw error;
        }
        return payload;
      });
    });
  }

  // Sender inn en runde. Den lokale listen oppdateres FOR nettverket proves,
  // saa poengene staar der uansett hva serveren svarer.
  function submit(game, entry, limit) {
    var full = {
      game: game,
      name: entry.name,
      email: entry.email || "",
      phone: entry.phone || "",
      consent: true,
      score: Number(entry.score) || 0,
      playedAt: entry.playedAt || new Date().toISOString()
    };

    saveLocal(full);

    return post(full).then(
      function (payload) {
        return {
          synced: true,
          board: merge(read(BOARD_KEY), payload.leaderboard || [], game, limit)
        };
      },
      function (error) {
        if (!error.permanent) queue(full);
        return {
          synced: false,
          error: error.message,
          permanent: !!error.permanent,
          board: localBoard(game, limit)
        };
      }
    );
  }

  function localBoard(game, limit) {
    return merge(read(BOARD_KEY), [], game, limit);
  }

  // Den viste listen: server + lokalt flettet. Er serveren nede, staar den
  // lokale igjen alene i stedet for at tavlen blir tom.
  function board(game, limit) {
    if (!canReachServer()) {
      return Promise.resolve(localBoard(game, limit));
    }

    return fetch("/api/leaderboard?game=" + encodeURIComponent(game), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) {
        return merge(read(BOARD_KEY), (payload && payload.entries) || [], game, limit);
      })
      .catch(function () {
        return localBoard(game, limit);
      });
  }

  // Sender koen paa nytt. Kalles ved oppstart, saa runder som ble spilt mens
  // nettet var nede kommer med i den felles listen naar det er tilbake.
  function flush() {
    var now = Date.now();
    var pending = read(PENDING_KEY).filter(function (e) {
      var at = new Date(e.playedAt || 0).getTime();
      // Gamle oppforinger gis opp: kiosken skal ikke baere kontaktopplysninger
      // videre i det uendelige for en innsending som aldri kom fram.
      return at && now - at < PENDING_MAX_AGE_MS;
    });

    write(PENDING_KEY, pending);

    if (!pending.length) return Promise.resolve(0);

    var sent = 0;
    return pending
      .reduce(function (chain, entry) {
        return chain.then(function () {
          return post(entry).then(
            function () { dropFromQueue(entry); sent++; },
            function (error) { if (error.permanent) dropFromQueue(entry); }
          );
        });
      }, Promise.resolve())
      .then(function () { return sent; });
  }

  window.HTScores = {
    submit: submit,
    board: board,
    localBoard: localBoard,
    flush: flush,
    pendingCount: function () { return read(PENDING_KEY).length; }
  };

  // Ikke i veien for oppstarten: koen tommes naar siden er ferdig lastet.
  var kick = function () { setTimeout(function () { flush().catch(function () {}); }, 1200); };
  if (document.readyState === "complete") kick();
  else window.addEventListener("load", kick);
})();
