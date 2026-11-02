import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg'
};

const players = new Map();
const messages = new Map();

const allowedVehicles = new Set([
  'hatch',
  'taxi',
  'suv',
  'jeep',
  'auto',
  'bus',
  'swift',
  'private',
  'van',
  'truck',
  'mini',
  'load',
  'tractor',
  'tanker',
  'garbage',
  'bike',
  'sport',
  'scooter',
  'moped',
  'bicycle',
  'goodsauto',
  'plane'
]);

function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });

  res.end(JSON.stringify(data));
}

async function body(req) {
  let s = '';

  for await (const c of req) {
    s += c;
  }

  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') {
    return null;
  }

  const kind = String(vehicle.kind || '').toLowerCase();

  if (!allowedVehicles.has(kind)) {
    return null;
  }

  return {
    kind,
    x: safeNumber(vehicle.x),
    y: safeNumber(vehicle.y),
    z: safeNumber(vehicle.z),
    yaw: safeNumber(vehicle.yaw)
  };
}

function removeInactivePlayers() {
  const now = Date.now();

  for (const [id, player] of players) {
    if (now - player.last > 15000) {
      players.delete(id);
      messages.delete(id);
    }
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      }).end();

      return;
    }

    // Health check
    if (url.pathname === '/health') {
      return json(res, 200, {
        status: 'ok'
      });
    }

    // Register or update player
    if (url.pathname === '/api/player' && req.method === 'POST') {
      const p = await body(req);

      if (!p.id || !p.name) {
        return json(res, 400, {
          error: 'name required'
        });
      }

      const vehicle = sanitizeVehicle(p.vehicle);

      players.set(String(p.id), {
        id: String(p.id),
        name: String(p.name).slice(0, 18),
        gender: p.gender || 'other',

        x: safeNumber(p.x),
        y: safeNumber(p.y),
        z: safeNumber(p.z),

        score: safeNumber(p.score),

        // Multiplayer vehicle synchronisation
        vehicle,

        last: Date.now()
      });

      return json(res, 200, {
        ok: true
      });
    }

    // Multiplayer state
    if (url.pathname === '/api/state' && req.method === 'GET') {
      const self = url.searchParams.get('self');

      removeInactivePlayers();

      return json(res, 200, {
        players: [...players.values()]
          .filter(p => p.id !== self),

        messages: messages.get(self) || []
      });
    }

    // Other players
    if (url.pathname === '/api/players' && req.method === 'GET') {
      const self = url.searchParams.get('self');

      removeInactivePlayers();

      return json(res, 200, {
        players: [...players.values()]
          .filter(p => p.id !== self)
          .map(({ id, name, gender }) => ({
            id,
            name,
            gender
          }))
      });
    }

    // Private messages
    if (url.pathname === '/api/message' && req.method === 'POST') {
      const m = await body(req);

      if (
        !players.has(m.from) ||
        !players.has(m.to) ||
        m.from === m.to
      ) {
        return json(res, 404, {
          ok: false
        });
      }

      const arr = messages.get(m.to) || [];

      arr.push({
        from: m.from,
        text: String(m.text || '').slice(0, 160),
        fromName: players.get(m.from)?.name || 'Player',
        time: Date.now()
      });

      messages.set(m.to, arr.slice(-50));

      return json(res, 200, {
        ok: true
      });
    }

    // Leaderboard
    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      removeInactivePlayers();

      const ranked = [...players.values()]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 50);

      return json(res, 200, {
        players: ranked
      });
    }

    // Serve game files
    const requestedPath = decodeURIComponent(url.pathname);

    const filePath = resolve(
      root,
      '.' + requestedPath
    );

    // Prevent directory traversal
    if (
      filePath !== root.slice(0, -1) &&
      !filePath.startsWith(root.endsWith(sep) ? root : root + sep)
    ) {
      res.writeHead(403).end();
      return;
    }

    const fileInfo = await stat(filePath);

    const finalPath = fileInfo.isDirectory()
      ? resolve(filePath, 'index.html')
      : filePath;

    const data = await readFile(finalPath);

    res.writeHead(200, {
      'Content-Type':
        mime[extname(finalPath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });

    res.end(data);

  } catch (error) {
    console.error('Request error:', error);

    res.writeHead(404).end('Not found');
  }
});

// Enzonic provides the PORT environment variable
const PORT = Number(process.env.PORT || 3000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Kurukkanmoola X server running on port ${PORT}`
  );
});
