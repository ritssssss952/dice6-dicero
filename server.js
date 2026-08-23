const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

/* =========================================================
   DICE 6 - SERVER
   Room + 6 Players + READY + Realtime SSE
   ========================================================= */

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon"
};

/* ---------------------------------------------------------
   ROOMS
   --------------------------------------------------------- */

const rooms = new Map();

/*
room = {
  code: "ABC123",
  hostId: "...",
  players: [
    {
      id,
      slot,
      name,
      city,
      lives: 3,
      alive: true,
      ready: false,
      isHost: false
    }
  ],
  clients: Set(),
  started: false,
  turn: 0,
  round: 1
}
*/

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */

function randomId() {
  return Math.random().toString(36).slice(2) +
         Math.random().toString(36).slice(2);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  do {
    code = "";

    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));

  return code;
}

function cleanText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, maxLength);
}

function getRoom(code) {
  return rooms.get(String(code || "").trim().toUpperCase());
}

function publicRoom(room) {
  return {
    code: room.code,
    started: room.started,
    turn: room.turn,
    round: room.round,

    players: room.players.map(p => ({
      id: p.id,
      slot: p.slot,
      name: p.name,
      city: p.city,
      lives: p.lives,
      alive: p.alive,
      ready: p.ready,
      isHost: p.isHost
    }))
  };
}

/* ---------------------------------------------------------
   REALTIME BROADCAST
   --------------------------------------------------------- */

function sendEvent(client, event, data) {
  try {
    client.write(
      `event: ${event}\n` +
      `data: ${JSON.stringify(data)}\n\n`
    );
  } catch (e) {
    // Client already disconnected.
  }
}

function broadcast(room) {
  const state = publicRoom(room);

  for (const client of room.clients) {
    sendEvent(client, "state", state);
  }
}

function broadcastMessage(room, message) {
  for (const client of room.clients) {
    sendEvent(client, "message", {
      message
    });
  }
}

/* ---------------------------------------------------------
   JSON BODY
   --------------------------------------------------------- */

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 1000000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

/* ---------------------------------------------------------
   RESPONSE HELPERS
   --------------------------------------------------------- */

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(JSON.stringify(data));
}

function error(res, status, message) {
  json(res, status, {
    ok: false,
    error: message
  });
}

/* ---------------------------------------------------------
   CREATE ROOM
   --------------------------------------------------------- */

async function createRoom(req, res) {
  const body = await readJson(req);

  const name = cleanText(body.name, 18);
  const city = cleanText(body.city, 24);

  if (!name) {
    return error(res, 400, "Player name is required.");
  }

  if (!city) {
    return error(res, 400, "City is required.");
  }

  const code = makeRoomCode();
  const hostId = randomId();

  const room = {
    code,
    hostId,
    players: [],
    clients: new Set(),
    started: false,
    turn: 0,
    round: 1
  };

  room.players.push({
    id: hostId,
    slot: 0,
    name,
    city,
    lives: 3,
    alive: true,
    ready: false,
    isHost: true
  });

  rooms.set(code, room);

  return json(res, 200, {
    ok: true,
    room: publicRoom(room),
    playerId: hostId,
    roomCode: code
  });
}

/* ---------------------------------------------------------
   JOIN ROOM
   --------------------------------------------------------- */

async function joinRoom(req, res) {
  const body = await readJson(req);

  const code = cleanText(body.code, 20).toUpperCase();
  const name = cleanText(body.name, 18);
  const city = cleanText(body.city, 24);

  if (!code) {
    return error(res, 400, "Room code is required.");
  }

  if (!name) {
    return error(res, 400, "Player name is required.");
  }

  if (!city) {
    return error(res, 400, "City is required.");
  }

  const room = getRoom(code);

  if (!room) {
    return error(res, 404, "Room not found.");
  }

  if (room.started) {
    return error(res, 400, "Game has already started.");
  }

  if (room.players.length >= 6) {
    return error(res, 400, "Room is full. Exactly 6 players are allowed.");
  }

  const playerId = randomId();
  const slot = room.players.length;

  room.players.push({
    id: playerId,
    slot,
    name,
    city,
    lives: 3,
    alive: true,
    ready: false,
    isHost: false
  });

  broadcast(room);

  return json(res, 200, {
    ok: true,
    room: publicRoom(room),
    playerId,
    roomCode: room.code
  });
}

/* ---------------------------------------------------------
   READY
   --------------------------------------------------------- */

async function readyPlayer(req, res) {
  const body = await readJson(req);

  const room = getRoom(body.code);
  const playerId = String(body.playerId || "");

  if (!room) {
    return error(res, 404, "Room not found.");
  }

  const player = room.players.find(p => p.id === playerId);

  if (!player) {
    return error(res, 404, "Player not found.");
  }

  if (room.started) {
    return error(res, 400, "Game has already started.");
  }

  player.ready = body.ready !== false;

  broadcast(room);

  return json(res, 200, {
    ok: true,
    room: publicRoom(room)
  });
}

/* ---------------------------------------------------------
   START GAME
   --------------------------------------------------------- */

async function startGame(req, res) {
  const body = await readJson(req);

  const room = getRoom(body.code);
  const playerId = String(body.playerId || "");

  if (!room) {
    return error(res, 404, "Room not found.");
  }

  if (room.hostId !== playerId) {
    return error(res, 403, "Only the host can start the game.");
  }

  if (room.players.length !== 6) {
    return error(res, 400, "Exactly 6 players are required.");
  }

  if (!room.players.every(p => p.ready)) {
    return error(res, 400, "All 6 players must be READY.");
  }

  room.started = true;
  room.turn = 0;
  room.round = 1;

  broadcast(room);

  broadcastMessage(room, "GAME_STARTED");

  return json(res, 200, {
    ok: true,
    room: publicRoom(room)
  });
}

/* ---------------------------------------------------------
   ROOM STATE
   --------------------------------------------------------- */

function roomState(req, res) {
  const code = String(req.query.code || "").toUpperCase();
  const room = getRoom(code);

  if (!room) {
    return error(res, 404, "Room not found.");
  }

  return json(res, 200, {
    ok: true,
    room: publicRoom(room)
  });
}

/* ---------------------------------------------------------
   SSE CONNECTION
   --------------------------------------------------------- */

function connectEvents(req, res) {
  const code = String(req.query.code || "").toUpperCase();
  const playerId = String(req.query.playerId || "");

  const room = getRoom(code);

  if (!room) {
    return error(res, 404, "Room not found.");
  }

  const player = room.players.find(p => p.id === playerId);

  if (!player) {
    return error(res, 404, "Player not found.");
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no"
  });

  room.clients.add(res);

  sendEvent(res, "connected", {
    ok: true
  });

  sendEvent(res, "state", publicRoom(room));

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (e) {}
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    room.clients.delete(res);
  });
}

/* ---------------------------------------------------------
   REQUEST HANDLER
   --------------------------------------------------------- */

const server = http.createServer(async (req, res) => {

  try {

    const url = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );

    /* CORS */

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type"
      });

      return res.end();
    }

    /* Health */

    if (
      req.method === "GET" &&
      url.pathname === "/health"
    ) {
      return json(res, 200, {
        ok: true,
        game: "DICE 6",
        rooms: rooms.size
      });
    }

    /* Create */

    if (
      req.method === "POST" &&
      url.pathname === "/api/create"
    ) {
      return await createRoom(req, res);
    }

    /* Join */

    if (
      req.method === "POST" &&
      url.pathname === "/api/join"
    ) {
      return await joinRoom(req, res);
    }

    /* Ready */

    if (
      req.method === "POST" &&
      url.pathname === "/api/ready"
    ) {
      return await readyPlayer(req, res);
    }

    /* Start */

    if (
      req.method === "POST" &&
      url.pathname === "/api/start"
    ) {
      return await startGame(req, res);
    }

    /* State */

    if (
      req.method === "GET" &&
      url.pathname === "/api/state"
    ) {
      return roomState(req, res);
    }

    /* Realtime events */

    if (
      req.method === "GET" &&
      url.pathname === "/api/events"
    ) {
      return connectEvents(req, res);
    }

    /* -----------------------------------------------------
       STATIC FILES
       ----------------------------------------------------- */

    let requestPath = decodeURIComponent(url.pathname);

    if (requestPath === "/") {
      requestPath = "/index.html";
    }

    const filePath = path.resolve(
      ROOT,
      "." + requestPath
    );

    /* Security */

    if (
      filePath !== ROOT &&
      !filePath.startsWith(ROOT + path.sep)
    ) {
      res.writeHead(403, {
        "Content-Type": "text/plain"
      });

      return res.end("Forbidden");
    }

    fs.readFile(filePath, (err, data) => {

      if (err) {
        console.log(
          "FILE NOT FOUND:",
          filePath
        );

        res.writeHead(404, {
          "Content-Type": "text/plain"
        });

        return res.end("Not Found");
      }

      const ext =
        path.extname(filePath).toLowerCase();

      res.writeHead(200, {
        "Content-Type":
          mimeTypes[ext] ||
          "application/octet-stream",

        /*
          IMPORTANT:
          Never cache HTML or JavaScript.
        */

        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate"
      });

      res.end(data);
    });

  } catch (err) {

    console.error(
      "SERVER ERROR:",
      err
    );

    error(
      res,
      500,
      "Internal server error."
    );
  }

});

/* ---------------------------------------------------------
   START
   --------------------------------------------------------- */

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `DICE 6 server running on port ${PORT}`
    );
  }
);
