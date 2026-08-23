(() => {
  const $ = id => document.getElementById(id);

  const screens = ["home", "setup", "lobby", "game", "winner"];

  const S = {
    mode: "offline",
    players: [],
    turn: 0,
    round: 1,
    started: false,

    room: "",
    host: false,
    myId: "",

    eventSource: null,

    ready: false,
    rolling: false,

    offlineNames: []
  };

  const colors = [
    "#1da8ff",
    "#ff5361",
    "#42df8d",
    "#ffc52c",
    "#a66bff",
    "#aeb8c5"
  ];

  /* =====================================================
     BASIC UI
     ===================================================== */

  const show = id => {
    screens.forEach(s => {
      const el = $(s);
      if (el) el.classList.toggle("active", s === id);
    });

    scrollTo(0, 0);
  };

  function toast(t) {
    const e = $("toast");
    if (!e) return;

    e.textContent = t;
    e.classList.add("show");

    clearTimeout(window.diceToastTimer);

    window.diceToastTimer = setTimeout(() => {
      e.classList.remove("show");
    }, 2800);
  }

  function status(t) {
    if ($("onlineStatus")) {
      $("onlineStatus").textContent = t;
    }
  }

  function badge(on) {
    if (!$("netBadge")) return;

    $("netBadge").textContent = on ? "ONLINE" : "OFFLINE";

    $("netBadge").className =
      "badge " + (on ? "online" : "offline");
  }

  function esc(s) {
    return String(s || "").replace(
      /[&<>"']/g,
      x => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[x])
    );
  }

  /* =====================================================
     PLAYERS
     ===================================================== */

  function players6() {
    return Array.from({ length: 6 }, (_, i) => ({
      id: "p" + (i + 1),
      slot: i,
      name: "Player " + (i + 1),
      city: "City " + (i + 1),
      lives: 3,
      alive: true,
      ready: false,
      isHost: i === 0
    }));
  }

  function makeInputs() {
    const box = $("playerInputs");
    if (!box) return;

    box.innerHTML =
      Array.from({ length: 6 }, (_, i) => `
        <div class="pinput">
          <div class="num"
               style="border:1px solid ${colors[i]}">
            ${i + 1}
          </div>

          <label>
            PLAYER ${i + 1}
            <input
              id="pn${i}"
              maxlength="18"
              value="${esc(
                S.offlineNames[i]?.name ||
                `Player ${i + 1}`
              )}">
          </label>

          <label>
            CITY
            <input
              id="pc${i}"
              maxlength="24"
              value="${esc(
                S.offlineNames[i]?.city ||
                `City ${i + 1}`
              )}">
          </label>
        </div>
      `).join("");
  }

  /* =====================================================
     LOBBY
     ===================================================== */

  function renderLobby() {
    const ps = S.players || [];

    const readyCount =
      ps.filter(p => p.ready).length;

    if ($("roomCode"))
      $("roomCode").textContent = S.room;

    if ($("count"))
      $("count").textContent =
        `${ps.length}/6 PLAYERS`;

    if ($("readyCount"))
      $("readyCount").textContent =
        `${readyCount}/6 READY`;

    if ($("lobbyText")) {
      if (ps.length < 6) {
        const left = 6 - ps.length;

        $("lobbyText").textContent =
          `Waiting for ${left} more player${left === 1 ? "" : "s"}...`;
      }
      else if (readyCount < 6) {
        $("lobbyText").textContent =
          `All players joined. Waiting for ${6 - readyCount} READY.`;
      }
      else {
        $("lobbyText").textContent =
          "All players READY. Host can start.";
      }
    }

    if ($("hostText")) {
      $("hostText").textContent =
        S.host
          ? "★ You are the HOST."
          : "Waiting for the HOST.";
    }

    if ($("lobbyGrid")) {
      $("lobbyGrid").innerHTML =
        Array.from({ length: 6 }, (_, i) => {

          const p =
            ps.find(x => x.slot === i);

          if (!p) {
            return `
              <div class="slot empty">
                PLAYER ${i + 1}<br>
                WAITING...
              </div>
            `;
          }

          return `
            <div class="slot">

              <span>PLAYER ${i + 1}</span>

              <span class="status ${
                p.ready ? "ready" : "waiting"
              }">
                ${p.ready ? "READY" : "WAITING"}
              </span>

              <h3>${esc(p.name)}</h3>

              <p>📍 ${esc(p.city)}</p>

              ${
                p.isHost
                  ? '<div class="host">★ HOST</div>'
                  : ""
              }

            </div>
          `;
        }).join("");
    }

    const me =
      ps.find(p => p.id === S.myId);

    if ($("readyBtn")) {
      $("readyBtn").textContent =
        me?.ready
          ? "NOT READY"
          : "READY ✓";

      $("readyBtn").disabled =
        !me;
    }

    if ($("startOnline")) {
      $("startOnline").disabled =
        !(
          S.host &&
          ps.length === 6 &&
          readyCount === 6
        );
    }
  }

  /* =====================================================
     BOARD
     ===================================================== */

  function renderBoard() {
    if (!$("board")) return;

    $("board").innerHTML =
      S.players
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map(p => `
          <div class="
            player
            ${p.alive ? "" : "dead"}
            ${
              p.slot === S.turn && p.alive
                ? "current"
                : ""
            }
          ">

            <div class="ptop">

              <div
                class="avatar"
                style="border-color:${colors[p.slot]}"
              >
                P${p.slot + 1}
              </div>

              <div>
                <h3>${esc(p.name)}</h3>

                <div class="city">
                  📍 ${esc(p.city)}
                </div>
              </div>

            </div>

            <div class="hearts">
              ${[0, 1, 2].map(i => `
                <span class="${
                  i < p.lives ? "" : "empty"
                }">
                  ❤️
                </span>
              `).join("")}
            </div>

            ${
              p.slot === S.turn && p.alive
                ? '<div class="currentlabel">CURRENT</div>'
                : ""
            }

            ${
              !p.alive
                ? '<div class="deadlabel">ELIMINATED</div>'
                : ""
            }

          </div>
        `).join("");

    if ($("round"))
      $("round").textContent =
        `ROUND ${Math.max(1, S.round)}`;

    const cur =
      S.players.find(
        p =>
          p.slot === S.turn &&
          p.alive
      );

    if ($("turn"))
      $("turn").textContent =
        cur
          ? `${cur.name.toUpperCase()}'S TURN`
          : "GAME OVER";

    if ($("hint"))
      $("hint").textContent =
        cur ? "Roll the dice" : "";

    const mine =
      S.mode === "offline" ||
      cur?.id === S.myId;

    if ($("roll")) {
      $("roll").disabled =
        !S.started ||
        S.rolling ||
        !cur ||
        !mine;

      $("roll").textContent =
        mine
          ? "ROLL THE DICE"
          : "WAIT FOR YOUR TURN";
    }
  }

  function log(t) {
    if (!$("log")) return;

    const e =
      document.createElement("div");

    e.className = "logitem";
    e.textContent = t;

    $("log").prepend(e);
  }

  function nextAlive(from) {
    for (let n = 1; n <= 6; n++) {

      const slot =
        (from + n) % 6;

      const p =
        S.players.find(
          x => x.slot === slot
        );

      if (p?.alive)
        return slot;
    }

    return from;
  }

  function winner() {
    const alive =
      S.players.filter(
        p => p.alive
      );

    return alive.length === 1
      ? alive[0]
      : null;
  }

  function showWin(w) {
    if (!w) return;

    if ($("winnerAvatar"))
      $("winnerAvatar").textContent =
        "P" + (w.slot + 1);

    if ($("winnerName"))
      $("winnerName").textContent =
        w.name;

    if ($("winnerCity"))
      $("winnerCity").textContent =
        "📍 " + w.city;

    if ($("winnerLives"))
      $("winnerLives").textContent =
        "❤️".repeat(
          Math.max(1, w.lives)
        );

    S.started = false;

    show("winner");
  }

  /* =====================================================
     DICE ANIMATION
     ===================================================== */

  function animate(value, done) {

    S.rolling = true;

    if ($("roll"))
      $("roll").disabled = true;

    if ($("dice"))
      $("dice").classList.add("rolling");

    setTimeout(() => {

      if ($("dice"))
        $("dice").textContent = value;

      if ($("dice"))
        $("dice").classList.remove("rolling");

      S.rolling = false;

      done();

    }, 650);
  }

  /* =====================================================
     OFFLINE GAME
     ===================================================== */

  function offlineRoll() {

    if (
      S.rolling ||
      !S.started
    ) return;

    const cur =
      S.players.find(
        p =>
          p.slot === S.turn &&
          p.alive
      );

    if (!cur) return;

    const value =
      Math.floor(
        Math.random() * 6
      ) + 1;

    animate(value, () => {

      const target =
        S.players.find(
          p =>
            p.slot === value - 1
        );

      if (target?.alive) {

        target.lives--;

        if (target.lives < 1)
          target.alive = false;

        if ($("result"))
          $("result").textContent =
            `🎲 ${value} → ${target.name} loses 1 life!`;

        log(
          `${cur.name} rolled ${value} → ${target.name} -1 ❤️`
        );

      }
      else {

        if ($("result"))
          $("result").textContent =
            `🎲 ${value} → Player ${value} is already eliminated.`;

        log(
          `${cur.name} rolled ${value} → no damage`
        );
      }

      const w = winner();

      if (w)
        return showWin(w);

      S.turn =
        nextAlive(S.turn);

      S.round++;

      renderBoard();
    });
  }

  /* =====================================================
     SETUP
     ===================================================== */

  function setupOffline() {

    S.mode = "offline";
    S.players = players6();
    S.started = false;
    S.turn = 0;
    S.round = 1;

    badge(false);

    $("setupEyebrow").textContent =
      "OFFLINE";

    $("setupTitle").textContent =
      "Set up 6 players";

    $("offlineSetup")
      .classList.remove("hidden");

    $("onlineSetup")
      .classList.add("hidden");

    makeInputs();

    show("setup");
  }

  function setupOnline() {

    $("safetyModal")
      .classList.remove("hidden");

    $("setupEyebrow").textContent =
      "ONLINE";

    $("setupTitle").textContent =
      "Create or join a room";

    $("offlineSetup")
      .classList.add("hidden");

    $("onlineSetup")
      .classList.remove("hidden");

    status("Ready to connect.");

    show("setup");
  }

  /* =====================================================
     SERVER API
     ===================================================== */

  async function api(url, options = {}) {

    const response =
      await fetch(
        url,
        {
          ...options,
          headers: {
            "Content-Type":
              "application/json",
            ...(options.headers || {})
          },
          cache: "no-store"
        }
      );

    let data;

    try {
      data =
        await response.json();
    }
    catch {
      throw new Error(
        "Server returned an invalid response."
      );
    }

    if (!response.ok || data.ok === false) {
      throw new Error(
        data.error ||
        "Server request failed."
      );
    }

    return data;
  }

  /* =====================================================
     CLOSE ONLINE
     ===================================================== */

  function closeOnline() {

    try {
      S.eventSource?.close();
    }
    catch {}

    S.eventSource = null;
  }

  /* =====================================================
     APPLY SERVER STATE
     ===================================================== */

  function applyServerRoom(room) {

    if (!room) return;

    S.room = room.code;
    S.players =
      Array.isArray(room.players)
        ? room.players
        : [];

    S.started = !!room.started;
    S.turn =
      Number.isInteger(room.turn)
        ? room.turn
        : 0;

    S.round =
      Number.isInteger(room.round)
        ? room.round
        : 1;

    badge(true);

    renderLobby();

    /*
      IMPORTANT:
      Every online player is taken
      directly to the lobby when
      the server sends the state.
    */

    if (S.started) {
      startGameUI();
    }
    else {
      show("lobby");
    }
  }

  /* =====================================================
     REALTIME SERVER EVENTS
     ===================================================== */

  function connectEvents() {

    if (!S.room || !S.myId)
      return;

    closeOnline();

    status("Connecting to room…");

    const url =
      `/api/events?code=${encodeURIComponent(
        S.room
      )}&playerId=${encodeURIComponent(
        S.myId
      )}`;

    const source =
      new EventSource(url);

    S.eventSource = source;

    source.addEventListener(
      "connected",
      () => {
        status(
          "Connected. Loading lobby…"
        );
      }
    );

    source.addEventListener(
      "state",
      event => {

        try {

          const room =
            JSON.parse(
              event.data
            );

          applyServerRoom(room);

        }
        catch {
          toast(
            "Received invalid room data."
          );
        }
      }
    );

    source.addEventListener(
      "message",
      event => {

        try {

          const data =
            JSON.parse(
              event.data
            );

          if (
            data.message ===
            "GAME_STARTED"
          ) {
            status(
              "Game started."
            );
          }

        }
        catch {}
      }
    );

    source.onerror = () => {

      if (
        S.eventSource !== source
      ) return;

      status(
        "Reconnecting to room…"
      );
    };
  }

  /* =====================================================
     CREATE ROOM
     ===================================================== */

  async function createOnlineRoom() {

    const name =
      $("myName").value.trim()
      || "Player 1";

    const city =
      $("myCity").value.trim()
      || "Unknown City";

    closeOnline();

    S.mode = "online";
    S.host = true;

    badge(true);

    status("Creating room…");

    try {

      const data =
        await api(
          "/api/create",
          {
            method: "POST",
            body: JSON.stringify({
              name,
              city
            })
          }
        );

      S.room =
        data.roomCode;

      S.myId =
        data.playerId;

      applyServerRoom(
        data.room
      );

      connectEvents();

      toast(
        "Room created. Share the code."
      );

    }
    catch (err) {

      S.host = false;
      badge(false);

      status(
        "Could not create room."
      );

      toast(
        err.message ||
        "Could not create room."
      );
    }
  }

  /* =====================================================
     JOIN ROOM
     ===================================================== */

  async function joinOnlineRoom() {

    const code =
      $("roomInput").value
        .trim()
        .toUpperCase();

    const name =
      $("myName").value.trim()
      || "Player";

    const city =
      $("myCity").value.trim()
      || "Unknown City";

    if (
      !/^[A-Z0-9]{6}$/.test(code)
    ) {

      toast(
        "Enter the 6-character room code."
      );

      return;
    }

    closeOnline();

    S.mode = "online";
    S.host = false;

    badge(true);

    status("Joining room…");

    try {

      const data =
        await api(
          "/api/join",
          {
            method: "POST",
            body: JSON.stringify({
              code,
              name,
              city
            })
          }
        );

      S.room =
        data.roomCode;

      S.myId =
        data.playerId;

      applyServerRoom(
        data.room
      );

      connectEvents();

      toast(
        "Joined room successfully."
      );

    }
    catch (err) {

      badge(false);

      status(
        "Could not join room."
      );

      toast(
        err.message ||
        "Could not join room."
      );
    }
  }

  /* =====================================================
     READY
     ===================================================== */

  async function toggleReady() {

    if (
      S.mode !== "online" ||
      !S.room ||
      !S.myId
    ) return;

    const me =
      S.players.find(
        p => p.id === S.myId
      );

    if (!me) return;

    const nextReady =
      !me.ready;

    try {

      status(
        nextReady
          ? "Setting READY…"
          : "Setting NOT READY…"
      );

      const data =
        await api(
          "/api/ready",
          {
            method: "POST",
            body: JSON.stringify({
              code: S.room,
              playerId: S.myId,
              ready: nextReady
            })
          }
        );

      applyServerRoom(
        data.room
      );

      status(
        nextReady
          ? "READY."
          : "NOT READY."
      );

    }
    catch (err) {

      toast(
        err.message ||
        "Could not change READY status."
      );
    }
  }

  /* =====================================================
     START ONLINE GAME
     ===================================================== */

  async function startOnlineGame() {

    if (!S.host)
      return;

    try {

      const data =
        await api(
          "/api/start",
          {
            method: "POST",
            body: JSON.stringify({
              code: S.room,
              playerId: S.myId
            })
          }
        );

      applyServerRoom(
        data.room
      );

    }
    catch (err) {

      toast(
        err.message ||
        "Could not start game."
      );
    }
  }

  /* =====================================================
     ONLINE ROLL
     ===================================================== */

  async function onlineRoll() {

    if (
      S.rolling ||
      !S.started
    ) return;

    const me =
      S.players.find(
        p => p.id === S.myId
      );

    const current =
      S.players.find(
        p =>
          p.slot === S.turn &&
          p.alive
      );

    if (
      !me ||
      !current ||
      current.id !== me.id
    ) {

      toast(
        "Please wait for your turn."
      );

      return;
    }

    /*
      This endpoint will be added to
      server.js in the final server step.
    */

    const value =
      Math.floor(
        Math.random() * 6
      ) + 1;

    animate(
      value,
      () => {}
    );

    try {

      const data =
        await api(
          "/api/roll",
          {
            method: "POST",
            body: JSON.stringify({
              code: S.room,
              playerId: S.myId,
              value
            })
          }
        );

      if (data.room) {
        applyServerRoom(
          data.room
        );
      }

      if (data.roll) {
        applyOnlineRoll(
          data.roll
        );
      }

    }
    catch (err) {

      S.rolling = false;

      toast(
        err.message ||
        "Could not roll the dice."
      );

      renderBoard();
    }
  }

  /* =====================================================
     ONLINE ROLL RESULT
     ===================================================== */

  function applyOnlineRoll(roll) {

    const value =
      Number(roll.value);

    const target =
      S.players.find(
        p =>
          p.slot === value - 1
      );

    animate(
      value,
      () => {

        if ($("result")) {

          $("result").textContent =
            `🎲 ${value} → ${
              target?.name ||
              `Player ${value}`
            } ${
              roll.hit
                ? "loses 1 life!"
                : "is already eliminated."
            }`;
        }

        log(
          `${roll.roller} rolled ${value} → ${
            target?.name ||
            `Player ${value}`
          } ${
            roll.hit
              ? "-1 ❤️"
              : "no damage"
          }`
        );

        if (roll.room) {
          applyServerRoom(
            roll.room
          );
        }

        if (
          roll.winnerSlot !==
          null &&
          roll.winnerSlot !== undefined
        ) {

          const w =
            S.players.find(
              p =>
                p.slot ===
                roll.winnerSlot
            );

          if (w)
            showWin(w);
        }

      }
    );
  }

  /* =====================================================
     START GAME UI
     ===================================================== */

  function startGameUI() {

    if ($("modeText"))
      $("modeText").textContent =
        S.mode.toUpperCase();

    if ($("log"))
      $("log").innerHTML = "";

    if ($("result"))
      $("result").textContent =
        "The number decides who loses a life.";

    show("game");

    renderBoard();
  }

  /* =====================================================
     BUTTONS
     ===================================================== */

  if ($("goOffline"))
    $("goOffline").onclick =
      setupOffline;

  if ($("goOnline"))
    $("goOnline").onclick =
      setupOnline;

  if ($("backHome"))
    $("backHome").onclick = () => {
      closeOnline();
      show("home");
    };

  if ($("startOffline"))
    $("startOffline").onclick = () => {

      S.offlineNames =
        Array.from(
          { length: 6 },
          (_, i) => ({
            name:
              $("pn" + i)
                .value
                .trim()
              || `Player ${i + 1}`,

            city:
              $("pc" + i)
                .value
                .trim()
              || `City ${i + 1}`
          })
        );

      S.players =
        players6();

      S.players.forEach(
        (p, i) => {

          p.name =
            S.offlineNames[i].name;

          p.city =
            S.offlineNames[i].city;

          p.ready = true;
        }
      );

      S.mode = "offline";
      S.started = true;
      S.turn = 0;
      S.round = 1;

      startGameUI();
    };

  if ($("roll"))
    $("roll").onclick = () => {

      if (
        S.mode ===
        "offline"
      ) {
        offlineRoll();
      }
      else {
        onlineRoll();
      }
    };

  if ($("createRoom"))
    $("createRoom").onclick =
      createOnlineRoom;

  if ($("joinRoom"))
    $("joinRoom").onclick =
      joinOnlineRoom;

  if ($("readyBtn"))
    $("readyBtn").onclick =
      toggleReady;

  if ($("startOnline"))
    $("startOnline").onclick =
      startOnlineGame;

  if ($("copyRoom"))
    $("copyRoom").onclick =
      async () => {

        try {

          await navigator.clipboard.writeText(
            S.room
          );

          toast(
            "Room code copied."
          );

        }
        catch {

          toast(
            S.room
          );
        }
      };

  /* =====================================================
     PLAY AGAIN
     ===================================================== */

  if ($("again"))
    $("again").onclick = () => {

      if (
        S.mode ===
        "offline"
      ) {

        S.players.forEach(p => {
          p.lives = 3;
          p.alive = true;
          p.ready = true;
        });

        S.turn = 0;
        S.round = 1;
        S.started = true;

        startGameUI();

      }
      else if (S.host) {

        toast(
          "Host can create/start the next round."
        );

        show("lobby");

      }
      else {

        toast(
          "Ask the host to start the next game."
        );
      }
    };

  if ($("menu"))
    $("menu").onclick = () => {
      closeOnline();
      location.reload();
    };

  /* =====================================================
     SAFETY
     ===================================================== */

  makeInputs();
  badge(false);

  if ($("safetyOk"))
    $("safetyOk").onclick = () => {
      $("safetyModal")
        .classList.add("hidden");
    };

  /* =====================================================
     PWA INSTALL
     ===================================================== */

  let deferred;

  window.addEventListener(
    "beforeinstallprompt",
    e => {

      e.preventDefault();

      deferred = e;

      if ($("installBtn"))
        $("installBtn")
          .classList.remove("hidden");
    }
  );

  if ($("installBtn"))
    $("installBtn").onclick =
      async () => {

        if (!deferred)
          return;

        deferred.prompt();

        await deferred.userChoice;

        deferred = null;

        $("installBtn")
          .classList.add("hidden");
      };

})();
