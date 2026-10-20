import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const port = process.env.PORT || 3000;

// In-Memory Multiplayer State
interface RemotePlayerState {
  id: string;
  name: string;
  level: number;
  skinId: string;
  accentColor: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  shield: number;
  kills: number;
  isShooting: boolean;
  activeWeaponName?: string;
  lastActive: number;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  hanzi?: string;
  pinyin?: string;
  timestamp: string;
  isTacticalCallout?: boolean;
}

interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  gameMode: string;
  maxPlayers: number;
  players: Map<string, RemotePlayerState>;
  messages: ChatMsg[];
  status: 'lobby' | 'playing' | 'ended';
  stormRadius: number;
  createdAt: number;
}

const rooms = new Map<string, GameRoom>();
const clientRooms = new Map<WebSocket, { roomId: string; playerId: string }>();

// Seed default global leaderboard with legendary operatives
interface LeaderboardRecord {
  id: string;
  name: string;
  level: number;
  wins: number;
  eliminations: number;
  mandarinScore: number;
  accuracy: number;
  skinId: string;
  accentColor: string;
}

const globalLeaderboard: LeaderboardRecord[] = [
  { id: 'lb_1', name: 'CyberDragon10', level: 12, wins: 28, eliminations: 142, mandarinScore: 980, accuracy: 96, skinId: 'skin_emerald_dragon', accentColor: '#10B981' },
  { id: 'lb_2', name: 'NeoNinja_4th', level: 10, wins: 21, eliminations: 118, mandarinScore: 840, accuracy: 92, skinId: 'skin_neon_ninja', accentColor: '#06B6D4' },
  { id: 'lb_3', name: 'TitanImmersion', level: 8, wins: 17, eliminations: 95, mandarinScore: 710, accuracy: 89, skinId: 'skin_titan_mecha', accentColor: '#3B82F6' },
  { id: 'lb_4', name: 'StormRonin_Kai', level: 7, wins: 14, eliminations: 82, mandarinScore: 650, accuracy: 88, skinId: 'skin_storm_ronin', accentColor: '#8B5CF6' },
  { id: 'lb_5', name: 'PheonixEmpress', level: 6, wins: 11, eliminations: 64, mandarinScore: 590, accuracy: 85, skinId: 'skin_cyber_phoenix', accentColor: '#F59E0B' },
];

// REST: Leaderboard
app.get('/api/leaderboard', (_req, res) => {
  const sorted = [...globalLeaderboard].sort((a, b) => b.wins - a.wins || b.mandarinScore - a.mandarinScore);
  res.json({ leaderboard: sorted });
});

app.post('/api/leaderboard/submit', (req, res) => {
  const { name, level, wins, eliminations, mandarinScore, accuracy, skinId, accentColor } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const existingIndex = globalLeaderboard.findIndex((e) => e.name.toLowerCase() === name.toLowerCase());
  const entry: LeaderboardRecord = {
    id: existingIndex >= 0 ? globalLeaderboard[existingIndex].id : `lb_${Date.now()}`,
    name,
    level: Math.max(level || 1, existingIndex >= 0 ? globalLeaderboard[existingIndex].level : 1),
    wins: Math.max(wins || 0, existingIndex >= 0 ? globalLeaderboard[existingIndex].wins : 0),
    eliminations: Math.max(eliminations || 0, existingIndex >= 0 ? globalLeaderboard[existingIndex].eliminations : 0),
    mandarinScore: Math.max(mandarinScore || 0, existingIndex >= 0 ? globalLeaderboard[existingIndex].mandarinScore : 0),
    accuracy: accuracy || 90,
    skinId: skinId || 'skin_neon_ninja',
    accentColor: accentColor || '#06B6D4',
  };

  if (existingIndex >= 0) {
    globalLeaderboard[existingIndex] = entry;
  } else {
    globalLeaderboard.push(entry);
  }

  res.json({ success: true, entry });
});

// REST: Active Rooms List
app.get('/api/rooms', (_req, res) => {
  const activeRooms = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    playerCount: r.players.size,
    maxPlayers: r.maxPlayers,
    status: r.status,
    gameMode: r.gameMode,
  }));
  res.json({ rooms: activeRooms });
});

// REST: Zero-cost procedural skin generator API
app.post('/api/skins/procedural', (req, res) => {
  const { archetype = 'cyber_ninja', imageSize = '1K', prompt = 'Neon Hero', crest = '龙' } = req.body;
  const colors: Record<string, { main: string; glow: string; crest: string; name: string }> = {
    cyber_ninja: { main: '#06B6D4', glow: '#22D3EE', crest: '忍', name: 'Neon Shadow Ninja' },
    mecha_titan: { main: '#3B82F6', glow: '#60A5FA', crest: '甲', name: 'Titan Mecha' },
    dragon_knight: { main: '#10B981', glow: '#34D399', crest: '龙', name: 'Dragon Striker' },
    stealth_ronin: { main: '#8B5CF6', glow: '#A855F7', crest: '浪', name: 'Storm Ronin' },
  };

  const c = colors[archetype] || colors.cyber_ninja;
  const chosenCrest = crest || c.crest;
  const resPx = imageSize === '4K' ? 4096 : imageSize === '2K' ? 2048 : 1024;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${resPx} ${resPx}" width="${resPx}" height="${resPx}">
    <defs>
      <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#0F172A" />
        <stop offset="60%" stop-color="#020617" />
        <stop offset="100%" stop-color="#000000" />
      </radialGradient>
      <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c.main}" />
        <stop offset="100%" stop-color="${c.glow}" />
      </linearGradient>
      <filter id="bloom">
        <feGaussianBlur stdDeviation="${resPx * 0.015}" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bgGlow)"/>
    <circle cx="${resPx * 0.5}" cy="${resPx * 0.5}" r="${resPx * 0.42}" fill="none" stroke="${c.main}" stroke-width="${resPx * 0.004}" opacity="0.4" stroke-dasharray="16 8"/>
    <path d="M${resPx * 0.25} ${resPx * 0.85} L${resPx * 0.35} ${resPx * 0.55} L${resPx * 0.65} ${resPx * 0.55} L${resPx * 0.75} ${resPx * 0.85} Z" fill="#1E293B" stroke="${c.main}" stroke-width="${resPx * 0.008}"/>
    <polygon points="${resPx * 0.25},${resPx * 0.85} ${resPx * 0.5},${resPx * 0.72} ${resPx * 0.75},${resPx * 0.85} ${resPx * 0.5},${resPx * 0.95}" fill="#0F172A" stroke="${c.glow}" stroke-width="${resPx * 0.006}"/>
    <circle cx="${resPx * 0.5}" cy="${resPx * 0.78}" r="${resPx * 0.06}" fill="${c.main}" opacity="0.8" filter="url(#bloom)"/>
    <text x="${resPx * 0.5}" y="${resPx * 0.805}" font-family="sans-serif" font-weight="900" font-size="${resPx * 0.07}" fill="#FFFFFF" text-anchor="middle">${chosenCrest}</text>
    <path d="M${resPx * 0.34} ${resPx * 0.58} Q${resPx * 0.3} ${resPx * 0.25} ${resPx * 0.5} ${resPx * 0.18} Q${resPx * 0.7} ${resPx * 0.25} ${resPx * 0.66} ${resPx * 0.58} Z" fill="#090D16" stroke="${c.main}" stroke-width="${resPx * 0.01}"/>
    <rect x="${resPx * 0.36}" y="${resPx * 0.36}" width="${resPx * 0.28}" height="${resPx * 0.08}" rx="${resPx * 0.03}" fill="url(#neonGlow)" filter="url(#bloom)"/>
    <line x1="${resPx * 0.38}" y1="${resPx * 0.4}" x2="${resPx * 0.62}" y2="${resPx * 0.4}" stroke="#FFFFFF" stroke-width="${resPx * 0.015}" stroke-linecap="round"/>
    <polygon points="${resPx * 0.42},${resPx * 0.48} ${resPx * 0.58},${resPx * 0.48} ${resPx * 0.5},${resPx * 0.58}" fill="#1E293B" stroke="${c.main}" stroke-width="${resPx * 0.004}"/>
    <text x="${resPx * 0.5}" y="${resPx * 0.92}" font-family="sans-serif" font-weight="bold" font-size="${resPx * 0.032}" fill="${c.glow}" text-anchor="middle" letter-spacing="4">CYBER MATRIX ${imageSize} EDITION</text>
  </svg>`;

  const base64Svg = Buffer.from(svg).toString('base64');
  return res.json({
    imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
    prompt,
    size: imageSize,
    description: `Synthesized via Cyber Matrix Studio (Ultra ${imageSize} Resolution). High-tech armor calibrated!`,
  });
});

// Setup Vite middlewares in development or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Create HTTP Server & Mount Real-Time WebSocket Server
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Broadcast helper to all sockets in a room
  function broadcastToRoom(roomId: string, message: object, excludeSocket?: WebSocket) {
    const payload = JSON.stringify(message);
    for (const [client, meta] of clientRooms.entries()) {
      if (meta.roomId === roomId && client !== excludeSocket && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const { type } = msg;

        if (type === 'join_room') {
          const { roomId = 'LOBBY-01', player } = msg;
          let room = rooms.get(roomId);
          if (!room) {
            room = {
              id: roomId,
              name: `Squad Room ${roomId}`,
              hostId: player.id,
              gameMode: 'pvp_battle_royale',
              maxPlayers: 16,
              players: new Map(),
              messages: [
                {
                  id: `welcome_${Date.now()}`,
                  senderId: 'SYSTEM',
                  senderName: 'Tactical HQ (司令部)',
                  text: `欢迎进入房间 ${roomId}！(Welcome to Room ${roomId}!)`,
                  hanzi: '战备完成，开始作战！',
                  pinyin: 'zhàn bèi wán chéng, kāi shǐ zuò zhàn!',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ],
              status: 'lobby',
              stormRadius: 100,
              createdAt: Date.now(),
            };
            rooms.set(roomId, room);
          }

          const remotePlayer: RemotePlayerState = {
            id: player.id,
            name: player.name || 'Gamer',
            level: player.level || 1,
            skinId: player.equippedSkinId || 'skin_neon_ninja',
            accentColor: player.accentColor || '#06B6D4',
            x: msg.x || (Math.random() - 0.5) * 40,
            y: 1.5,
            z: msg.z || (Math.random() - 0.5) * 40,
            rotY: 0,
            hp: 100,
            shield: 100,
            kills: 0,
            isShooting: false,
            activeWeaponName: 'Pulse Blaster',
            lastActive: Date.now(),
          };

          room.players.set(player.id, remotePlayer);
          clientRooms.set(ws, { roomId, playerId: player.id });

          // Send full room state to the newly connected player
          ws.send(
            JSON.stringify({
              type: 'room_joined',
              roomId,
              roomName: room.name,
              players: Object.fromEntries(room.players),
              messages: room.messages,
              hostId: room.hostId,
            })
          );

          // Broadcast player joined to everyone else in room
          broadcastToRoom(
            roomId,
            {
              type: 'player_joined',
              player: remotePlayer,
            },
            ws
          );
        } else if (type === 'player_sync') {
          const clientMeta = clientRooms.get(ws);
          if (!clientMeta) return;
          const { roomId, playerId } = clientMeta;
          const room = rooms.get(roomId);
          if (!room) return;

          const player = room.players.get(playerId);
          if (player) {
            player.x = msg.x ?? player.x;
            player.y = msg.y ?? player.y;
            player.z = msg.z ?? player.z;
            player.rotY = msg.rotY ?? player.rotY;
            player.hp = msg.hp ?? player.hp;
            player.shield = msg.shield ?? player.shield;
            player.isShooting = !!msg.isShooting;
            player.activeWeaponName = msg.activeWeaponName || player.activeWeaponName;
            player.lastActive = Date.now();

            broadcastToRoom(
              roomId,
              {
                type: 'player_moved',
                playerId,
                x: player.x,
                y: player.y,
                z: player.z,
                rotY: player.rotY,
                hp: player.hp,
                shield: player.shield,
                isShooting: player.isShooting,
              },
              ws
            );
          }
        } else if (type === 'player_shoot') {
          const clientMeta = clientRooms.get(ws);
          if (!clientMeta) return;
          broadcastToRoom(
            clientMeta.roomId,
            {
              type: 'laser_fired',
              playerId: clientMeta.playerId,
              origin: msg.origin,
              direction: msg.direction,
              weaponType: msg.weaponType,
            },
            ws
          );
        } else if (type === 'player_damage') {
          const clientMeta = clientRooms.get(ws);
          if (!clientMeta) return;
          const { roomId } = clientMeta;
          const room = rooms.get(roomId);
          if (!room) return;

          const target = room.players.get(msg.targetPlayerId);
          if (target) {
            let remainingDamage = msg.damage || 25;
            if (target.shield > 0) {
              const absorbed = Math.min(target.shield, remainingDamage);
              target.shield -= absorbed;
              remainingDamage -= absorbed;
            }
            if (remainingDamage > 0) {
              target.hp = Math.max(0, target.hp - remainingDamage);
            }

            const isDead = target.hp <= 0;
            if (isDead) {
              const attacker = room.players.get(clientMeta.playerId);
              if (attacker) attacker.kills += 1;
            }

            broadcastToRoom(roomId, {
              type: 'player_damaged',
              targetPlayerId: target.id,
              attackerPlayerId: clientMeta.playerId,
              hp: target.hp,
              shield: target.shield,
              isEliminated: isDead,
            });
          }
        } else if (type === 'send_chat') {
          const clientMeta = clientRooms.get(ws);
          if (!clientMeta) return;
          const { roomId, playerId } = clientMeta;
          const room = rooms.get(roomId);
          if (!room) return;

          const chatEntry: ChatMsg = {
            id: `msg_${Date.now()}`,
            senderId: playerId,
            senderName: msg.senderName || 'Operative',
            text: msg.text || '',
            hanzi: msg.hanzi,
            pinyin: msg.pinyin,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isTacticalCallout: !!msg.isTacticalCallout,
          };

          room.messages.push(chatEntry);
          if (room.messages.length > 50) room.messages.shift();

          broadcastToRoom(roomId, {
            type: 'new_chat_message',
            message: chatEntry,
          });
        }
      } catch (e) {
        console.warn('WebSocket message error:', e);
      }
    });

    ws.on('close', () => {
      const clientMeta = clientRooms.get(ws);
      if (clientMeta) {
        const { roomId, playerId } = clientMeta;
        const room = rooms.get(roomId);
        if (room) {
          room.players.delete(playerId);
          broadcastToRoom(roomId, {
            type: 'player_left',
            playerId,
          });
          if (room.players.size === 0) {
            rooms.delete(roomId);
          }
        }
        clientRooms.delete(ws);
      }
    });
  });

  server.listen(port, () => {
    console.log(`CyberMandarin Royale server with Real-Time WebSockets listening on port ${port}`);
  });
}

startServer();
