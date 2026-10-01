import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

interface Player {
  id: string;
  name: string;
  score: number;
  hits: number;
  shots: number;
  ready: boolean;
  color: string;
  lastShot?: { x: number; y: number; timestamp: number; hit: boolean };
  ws: WebSocket;
}

interface DuckState {
  id: string;
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  vx: number;
  vy: number;
  type: 'classic' | 'swift' | 'golden';
  points: number;
  status: 'flying' | 'hit' | 'escaped';
  hitBy?: string;
  hitByName?: string;
  spawnTime: number;
}

interface Room {
  id: string;
  hostId: string;
  players: Map<string, Player>;
  status: 'lobby' | 'playing' | 'round_over' | 'game_over';
  round: number;
  ducks: DuckState[];
  roundDucksRemaining: number;
  timer?: NodeJS.Timeout;
}

const rooms = new Map<string, Room>();
const PLAYER_COLORS = ['#38bdf8', '#f43f5e', '#a855f7', '#22c55e', '#eab308'];

function getCleanRoomData(room: Room) {
  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    hits: p.hits,
    shots: p.shots,
    ready: p.ready,
    color: p.color,
    lastShot: p.lastShot,
    isHost: p.id === room.hostId,
  }));

  return {
    id: room.id,
    hostId: room.hostId,
    players,
    status: room.status,
    round: room.round,
    ducks: room.ducks,
  };
}

function broadcastToRoom(room: Room, message: Record<string, unknown>, excludePlayerId?: string) {
  const data = JSON.stringify(message);
  room.players.forEach((player) => {
    if (player.id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  });
}

function spawnDuckForRoom(room: Room) {
  if (room.status !== 'playing') return;

  const duckTypes: Array<{ type: 'classic' | 'swift' | 'golden'; points: number; speedMul: number }> = [
    { type: 'classic', points: 500, speedMul: 1.0 },
    { type: 'swift', points: 800, speedMul: 1.6 },
    { type: 'golden', points: 1500, speedMul: 2.2 },
  ];

  const roll = Math.random();
  const selected = roll > 0.85 ? duckTypes[2] : roll > 0.5 ? duckTypes[1] : duckTypes[0];

  const fromLeft = Math.random() > 0.5;
  const startX = fromLeft ? -5 : 105;
  const startY = 40 + Math.random() * 35; // lower to middle screen
  const baseVx = (1.4 + Math.random() * 1.5) * selected.speedMul;
  const vx = fromLeft ? baseVx : -baseVx;
  const vy = -(1.2 + Math.random() * 1.4) * selected.speedMul;

  const duck: DuckState = {
    id: `duck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    x: startX,
    y: startY,
    vx,
    vy,
    type: selected.type,
    points: selected.points,
    status: 'flying',
    spawnTime: Date.now(),
  };

  room.ducks.push(duck);
  broadcastToRoom(room, {
    type: 'DUCK_SPAWNED',
    duck,
  });
}

function startRound(room: Room) {
  room.status = 'playing';
  room.ducks = [];
  room.roundDucksRemaining = 10;

  broadcastToRoom(room, {
    type: 'ROUND_STARTED',
    round: room.round,
    room: getCleanRoomData(room),
  });

  if (room.timer) clearInterval(room.timer);

  // Spawn ducks every 2-3 seconds until round quota is reached
  room.timer = setInterval(() => {
    if (room.status !== 'playing') {
      if (room.timer) clearInterval(room.timer);
      return;
    }

    // Check existing active ducks
    const activeDucks = room.ducks.filter(d => d.status === 'flying');
    if (activeDucks.length < 2 && room.roundDucksRemaining > 0) {
      spawnDuckForRoom(room);
      room.roundDucksRemaining--;
    } else if (room.roundDucksRemaining <= 0 && activeDucks.length === 0) {
      // Round completed
      if (room.timer) clearInterval(room.timer);
      room.status = 'round_over';
      broadcastToRoom(room, {
        type: 'ROUND_FINISHED',
        round: room.round,
        room: getCleanRoomData(room),
      });
    }
  }, 1200);
}

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentPlayerId: string | null = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }

      if (data.type === 'JOIN_ROOM') {
        const roomId = (data.roomId || 'ARENA-1').toUpperCase().trim();
        const playerName = (data.playerName || 'Hunter').trim().substring(0, 16);
        const playerId = data.playerId || `p_${Math.random().toString(36).substring(2, 9)}`;

        let room = rooms.get(roomId);
        if (!room) {
          room = {
            id: roomId,
            hostId: playerId,
            players: new Map(),
            status: 'lobby',
            round: 1,
            ducks: [],
            roundDucksRemaining: 10,
          };
          rooms.set(roomId, room);
        }

        const playerColor = PLAYER_COLORS[room.players.size % PLAYER_COLORS.length];
        const newPlayer: Player = {
          id: playerId,
          name: playerName,
          score: 0,
          hits: 0,
          shots: 0,
          ready: false,
          color: playerColor,
          ws,
        };

        room.players.set(playerId, newPlayer);
        currentRoomId = roomId;
        currentPlayerId = playerId;

        ws.send(JSON.stringify({
          type: 'JOINED_SUCCESS',
          playerId,
          room: getCleanRoomData(room),
        }));

        broadcastToRoom(room, {
          type: 'ROOM_UPDATE',
          room: getCleanRoomData(room),
          message: `${playerName} joined the arena!`,
        }, playerId);
        return;
      }

      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;
      const player = room.players.get(currentPlayerId);
      if (!player) return;

      if (data.type === 'SET_READY') {
        player.ready = Boolean(data.ready);
        broadcastToRoom(room, {
          type: 'ROOM_UPDATE',
          room: getCleanRoomData(room),
        });
        return;
      }

      if (data.type === 'START_GAME') {
        if (room.hostId === currentPlayerId) {
          room.round = 1;
          // reset player scores
          room.players.forEach(p => {
            p.score = 0;
            p.hits = 0;
            p.shots = 0;
          });
          startRound(room);
        }
        return;
      }

      if (data.type === 'NEXT_ROUND') {
        if (room.hostId === currentPlayerId) {
          room.round += 1;
          startRound(room);
        }
        return;
      }

      if (data.type === 'SHOOT') {
        const { x, y, hitDuckId } = data;
        player.shots += 1;
        let isHit = false;
        let hitDuck: DuckState | undefined;

        if (hitDuckId) {
          hitDuck = room.ducks.find(d => d.id === hitDuckId && d.status === 'flying');
          if (hitDuck) {
            hitDuck.status = 'hit';
            hitDuck.hitBy = player.id;
            hitDuck.hitByName = player.name;
            player.hits += 1;
            player.score += hitDuck.points;
            isHit = true;
          }
        }

        player.lastShot = { x, y, timestamp: Date.now(), hit: isHit };

        broadcastToRoom(room, {
          type: 'PLAYER_SHOT',
          playerId: player.id,
          playerName: player.name,
          color: player.color,
          x,
          y,
          hit: isHit,
          hitDuckId: hitDuck ? hitDuck.id : undefined,
          points: hitDuck ? hitDuck.points : 0,
          room: getCleanRoomData(room),
        });
        return;
      }

      if (data.type === 'DUCK_ESCAPED') {
        const { duckId } = data;
        const duck = room.ducks.find(d => d.id === duckId);
        if (duck && duck.status === 'flying') {
          duck.status = 'escaped';
          broadcastToRoom(room, {
            type: 'DUCK_ESCAPED',
            duckId,
          });
        }
        return;
      }

      if (data.type === 'CHAT_EMOTE') {
        const emote = String(data.emote || '🎯').substring(0, 10);
        broadcastToRoom(room, {
          type: 'CHAT_EMOTE',
          playerId: player.id,
          playerName: player.name,
          color: player.color,
          emote,
        });
        return;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && currentPlayerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players.delete(currentPlayerId);
        if (room.players.size === 0) {
          if (room.timer) clearInterval(room.timer);
          rooms.delete(currentRoomId);
        } else {
          if (room.hostId === currentPlayerId) {
            const nextHost = room.players.keys().next().value;
            if (nextHost) room.hostId = nextHost;
          }
          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            room: getCleanRoomData(room),
            message: 'A hunter left the arena.',
          });
        }
      }
    }
  });
});

// API routes for export or room info
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', onlineRooms: rooms.size });
});

// Mount Vite middleware in development
async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
