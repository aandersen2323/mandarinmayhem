import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Swords, MessageSquare, Send, Volume2, Shield, Zap, Flame, Trophy, Play, CheckCircle2, AlertCircle, Radio, LogOut, Crosshair } from 'lucide-react';
import { PlayerProfile, SkinItem, RemotePlayer, MultiplayerChatMessage, MandarinQuestion } from '../types/game';
import { MANDARIN_QUESTIONS } from '../data/mandarinData';
import { speakChinese, sounds } from '../utils/audio';

interface MultiplayerViewProps {
  player: PlayerProfile;
  equippedSkin: SkinItem;
  onEarnCoins: (amount: number) => void;
  onUpdatePlayer: React.Dispatch<React.SetStateAction<PlayerProfile>>;
}

export const MultiplayerView: React.FC<MultiplayerViewProps> = ({
  player,
  equippedSkin,
  onEarnCoins,
  onUpdatePlayer,
}) => {
  // Room state
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('SQUAD-88');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [players, setPlayers] = useState<Record<string, RemotePlayer>>({});
  const [chatMessages, setChatMessages] = useState<MultiplayerChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'arena' | 'chat' | 'players'>('arena');

  // Local player PvP state in multiplayer
  const [myHp, setMyHp] = useState(100);
  const [myShield, setMyShield] = useState(100);
  const [myKills, setMyKills] = useState(0);
  const [myPos, setMyPos] = useState({ x: 0, z: 0 });
  const [laserBeams, setLaserBeams] = useState<Array<{ id: string; x1: number; z1: number; x2: number; z2: number; color: string }>>([]);

  // Live Mandarin Duel Challenge
  const [duelQuestion, setDuelQuestion] = useState<MandarinQuestion>(() => MANDARIN_QUESTIONS[0]);
  const [duelBanner, setDuelBanner] = useState<string | null>(null);

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const arenaCanvasRef = useRef<HTMLCanvasElement>(null);
  const myPosRef = useRef({ x: 0, z: 0 });
  const keysRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    myPosRef.current = myPos;
  }, [myPos]);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Connect to WebSocket Server
  const connectToRoom = useCallback((targetRoomId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setInRoom(true);
      setRoomId(targetRoomId);

      // Join room payload
      ws.send(
        JSON.stringify({
          type: 'join_room',
          roomId: targetRoomId,
          player: {
            id: `p_${player.name.toLowerCase().replace(/\s+/g, '_')}`,
            name: player.name,
            level: player.level,
            equippedSkinId: player.equippedSkinId,
            accentColor: equippedSkin.accentColor || '#06B6D4',
          },
          x: (Math.random() - 0.5) * 60,
          z: (Math.random() - 0.5) * 60,
        })
      );
      sounds.playSuccess();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'room_joined') {
          setPlayers(data.players || {});
          setChatMessages(data.messages || []);
        } else if (data.type === 'player_joined') {
          setPlayers((prev) => ({ ...prev, [data.player.id]: data.player }));
          sounds.playShield();
        } else if (data.type === 'player_moved') {
          setPlayers((prev) => {
            if (!prev[data.playerId]) return prev;
            return {
              ...prev,
              [data.playerId]: {
                ...prev[data.playerId],
                x: data.x,
                y: data.y,
                z: data.z,
                rotY: data.rotY,
                hp: data.hp,
                shield: data.shield,
                isShooting: data.isShooting,
              },
            };
          });
        } else if (data.type === 'player_left') {
          setPlayers((prev) => {
            const next = { ...prev };
            delete next[data.playerId];
            return next;
          });
        } else if (data.type === 'new_chat_message') {
          setChatMessages((prev) => [...prev, data.message]);
          if (data.message.hanzi) {
            speakChinese(data.message.hanzi);
          }
        } else if (data.type === 'laser_fired') {
          // Render remote laser beam
          const beamId = `beam_${Date.now()}_${Math.random()}`;
          const origin = data.origin || { x: 0, z: 0 };
          const dir = data.direction || { x: 1, z: 0 };
          setLaserBeams((prev) => [
            ...prev,
            {
              id: beamId,
              x1: origin.x,
              z1: origin.z,
              x2: origin.x + dir.x * 40,
              z2: origin.z + dir.z * 40,
              color: '#38BDF8',
            },
          ]);
          sounds.playShoot();
          setTimeout(() => {
            setLaserBeams((prev) => prev.filter((b) => b.id !== beamId));
          }, 150);
        } else if (data.type === 'player_damaged') {
          const myId = `p_${player.name.toLowerCase().replace(/\s+/g, '_')}`;
          if (data.targetPlayerId === myId) {
            setMyHp(data.hp);
            setMyShield(data.shield);
            sounds.playDamage();
            if (data.isEliminated) {
              setDuelBanner('Knocked down in battle! Respawning in 3 seconds...');
              setTimeout(() => {
                setMyHp(100);
                setMyShield(100);
                setDuelBanner(null);
              }, 3000);
            }
          }
          if (data.attackerPlayerId === myId && data.isEliminated) {
            setMyKills((k) => k + 1);
            sounds.playVictory();
            onEarnCoins(25);
            setDuelBanner('🏆 Opponent Eliminated! +25 V-Coins!');
            setTimeout(() => setDuelBanner(null), 2500);
          }
        }
      } catch (err) {
        console.warn('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
  }, [player, equippedSkin, onEarnCoins]);

  // Leave room handler
  const handleLeaveRoom = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setInRoom(false);
    setIsConnected(false);
  };

  // Keyboard controls for PvP movement
  useEffect(() => {
    if (!inRoom) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const moveInterval = setInterval(() => {
      let dx = 0;
      let dz = 0;
      const speed = 1.2;

      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) dz -= speed;
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) dz += speed;
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) dx -= speed;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) dx += speed;

      if (dx !== 0 || dz !== 0) {
        setMyPos((prev) => {
          const nextX = Math.max(-45, Math.min(45, prev.x + dx));
          const nextZ = Math.max(-45, Math.min(45, prev.z + dz));

          // Sync to server via WebSocket
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'player_sync',
                x: nextX,
                z: nextZ,
                hp: myHp,
                shield: myShield,
              })
            );
          }
          return { x: nextX, z: nextZ };
        });
      }
    }, 40);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveInterval);
    };
  }, [inRoom, myHp, myShield]);

  // Send message to multiplayer room
  const handleSendMessage = (textToSend?: string, hanzi?: string, pinyin?: string) => {
    const text = textToSend || chatInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        type: 'send_chat',
        senderName: player.name,
        text,
        hanzi,
        pinyin,
        isTacticalCallout: !!hanzi,
      })
    );

    setChatInput('');
  };

  // Click on Arena to shoot rival
  const handleShootAtTarget = (targetX: number, targetZ: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    sounds.playShoot();
    const beamId = `beam_${Date.now()}`;
    setLaserBeams((prev) => [
      ...prev,
      {
        id: beamId,
        x1: myPos.x,
        z1: myPos.z,
        x2: targetX,
        z2: targetZ,
        color: '#06B6D4',
      },
    ]);
    setTimeout(() => {
      setLaserBeams((prev) => prev.filter((b) => b.id !== beamId));
    }, 150);

    // Notify room of shot
    wsRef.current.send(
      JSON.stringify({
        type: 'player_shoot',
        origin: { x: myPos.x, z: myPos.z },
        direction: { x: targetX - myPos.x, z: targetZ - myPos.z },
      })
    );

    // Check hit against remote players
    const myId = `p_${player.name.toLowerCase().replace(/\s+/g, '_')}`;
    for (const [pId, p] of Object.entries(players)) {
      if (pId === myId) continue;
      const dist = Math.hypot(p.x - targetX, p.z - targetZ);
      if (dist < 4.5) {
        wsRef.current.send(
          JSON.stringify({
            type: 'player_damage',
            targetPlayerId: pId,
            damage: 35,
          })
        );
        break;
      }
    }
  };

  // Answer Mandarin Question in Duel
  const handleAnswerDuel = (optionIndex: number) => {
    if (optionIndex === duelQuestion.correctIndex) {
      sounds.playVictory();
      setMyShield((prev) => Math.min(100, prev + 35));
      onEarnCoins(15);
      setDuelBanner(`🌟 正确 (Correct)! +35 Shield & +15 V-Coins!`);
      speakChinese(duelQuestion.hanzi);

      // Broadcast Mandarin battle broadcast to room
      handleSendMessage(
        `Answered "${duelQuestion.hanzi}" (${duelQuestion.pinyin}) correctly! Shield restored!`,
        duelQuestion.hanzi,
        duelQuestion.pinyin
      );

      setTimeout(() => {
        setDuelBanner(null);
        setDuelQuestion(MANDARIN_QUESTIONS[Math.floor(Math.random() * MANDARIN_QUESTIONS.length)]);
      }, 1500);
    } else {
      sounds.playError();
      setDuelBanner(`再试一次 (Try again)!`);
      setTimeout(() => setDuelBanner(null), 1200);
    }
  };

  const presetTacticalCalls = [
    { hanzi: '掩护我！', pinyin: 'yǎn hù wǒ!', english: 'Cover me!' },
    { hanzi: '敌人在附近！', pinyin: 'dí rén zài fù jìn!', english: 'Enemies nearby!' },
    { hanzi: '我需要换弹！', pinyin: 'wǒ xū yào huàn dàn!', english: 'Need to reload!' },
    { hanzi: '大吉大利！', pinyin: 'dà jí dà lì!', english: 'Victory Royale!' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Swords size={22} className="text-cyan-400" />
            <h2 className="text-xl md:text-2xl font-extrabold text-white uppercase tracking-wider font-['Barlow_Condensed']">
              Multiplayer Battle Royale & PvP Duels (多人联机对决)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Play real-time online against friends: duel rivals, answer Mandarin challenges, and chat live!
          </p>
        </div>

        {inRoom && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-slate-400">Room:</span>
              <strong className="text-cyan-300 font-bold">{roomId}</strong>
            </div>

            <button
              onClick={handleLeaveRoom}
              className="px-3.5 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={14} />
              <span>Leave Room</span>
            </button>
          </div>
        )}
      </div>

      {!inRoom ? (
        /* Room Browser & Join Screen */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Join / Create Room */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-lg">
            <h3 className="text-base font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Zap size={18} className="text-cyan-400" />
              <span>Create or Join Squad Room</span>
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Create a custom room code or join your friend’s room code to jump straight into the live battle arena!
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Enter Room Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SQUAD-88, DRAGON-1, NEO-SHANGHAI"
                    className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-cyan-300 uppercase tracking-wider focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={() => connectToRoom(inputRoomCode.trim() || 'SQUAD-88')}
                    className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95"
                  >
                    Join
                  </button>
                </div>
              </div>

              {/* Fast Room Presets */}
              <div>
                <span className="text-[11px] text-slate-500 block mb-1.5">Featured Public Battle Rooms:</span>
                <div className="grid grid-cols-2 gap-2">
                  {['SQUAD-88', 'NEO-SHANGHAI', 'DRAGON-ARENA', '4TH-GRADE-IMMERSION'].map((code) => (
                    <button
                      key={code}
                      onClick={() => connectToRoom(code)}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group"
                    >
                      <div className="text-xs font-mono font-bold text-white group-hover:text-cyan-300">
                        {code}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1">
                        <span>PvP Battle Royale</span>
                        <span className="text-emerald-400 font-bold">Online</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* How Multiplayer Works Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider text-white flex items-center gap-2 mb-3">
                <Shield size={18} className="text-amber-400" />
                <span>Multiplayer Game Features</span>
              </h3>
              <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Real-Time Online Battles: </strong>
                    Friends connect via WebSockets on the same room code. Move with WASD, click to fire laser bursts!
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Mandarin Combat Duels: </strong>
                    Answer Mandarin challenge questions to regenerate shields and deal massive plasma damage to opponents!
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Live Room Tactical Chat: </strong>
                    Broadcast tactical callouts to your squad. Click any callout to hear native Mandarin speech!
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => connectToRoom('SQUAD-88')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95"
            >
              <Play size={16} />
              <span>Instant Drop into Room SQUAD-88</span>
            </button>
          </div>
        </div>
      ) : (
        /* Live Multiplayer Arena & Room Chat Interface */
        <div className="space-y-4">
          {/* Status Alert Banner */}
          {duelBanner && (
            <div className="p-3 bg-gradient-to-r from-amber-500/20 to-cyan-500/20 border border-cyan-400 rounded-xl text-center text-xs font-bold text-white animate-pulse">
              {duelBanner}
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Health:</span>
              <div className="flex-1 bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-emerald-400 h-full transition-all" style={{ width: `${myHp}%` }} />
              </div>
              <span className="font-mono font-bold text-white">{myHp}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Shield:</span>
              <div className="flex-1 bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-cyan-400 h-full transition-all" style={{ width: `${myShield}%` }} />
              </div>
              <span className="font-mono font-bold text-cyan-300">{myShield}</span>
            </div>

            <div className="flex items-center justify-center gap-2 font-mono">
              <span className="text-slate-400">Eliminations:</span>
              <span className="text-amber-400 font-extrabold text-sm">{myKills} 💀</span>
            </div>

            <div className="flex items-center justify-end gap-2 text-slate-400">
              <Users size={14} className="text-cyan-400" />
              <span>In Room: <strong className="text-white">{Object.keys(players).length}</strong></span>
            </div>
          </div>

          {/* Main Battle Field & Chat Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 2D/Tactical Radar Arena View (8 Cols) */}
            <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between h-[520px] relative overflow-hidden shadow-2xl">
              {/* Radar Grid Backdrop */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = ((e.clientX - rect.left) / rect.width - 0.5) * 90;
                  const clickZ = ((e.clientY - rect.top) / rect.height - 0.5) * 90;
                  handleShootAtTarget(clickX, clickZ);
                }}
                className="w-full flex-1 relative bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden cursor-crosshair"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, rgba(6,182,212,0.06) 0%, transparent 70%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)`,
                  backgroundSize: '100% 100%, 30px 30px, 30px 30px',
                }}
              >
                {/* Center Landmark */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border border-cyan-500/30 flex items-center justify-center text-[10px] text-cyan-400/60 font-mono">
                  钟楼
                </div>

                {/* Laser Beams */}
                {laserBeams.map((beam) => {
                  const startLeft = ((beam.x1 + 45) / 90) * 100;
                  const startTop = ((beam.z1 + 45) / 90) * 100;
                  const endLeft = ((beam.x2 + 45) / 90) * 100;
                  const endTop = ((beam.z2 + 45) / 90) * 100;
                  return (
                    <svg key={beam.id} className="absolute inset-0 w-full h-full pointer-events-none">
                      <line
                        x1={`${startLeft}%`}
                        y1={`${startTop}%`}
                        x2={`${endLeft}%`}
                        y2={`${endTop}%`}
                        stroke={beam.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        opacity="0.8"
                      />
                    </svg>
                  );
                })}

                {/* Local Player Marker */}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-75 flex flex-col items-center pointer-events-none"
                  style={{
                    left: `${((myPos.x + 45) / 90) * 100}%`,
                    top: `${((myPos.z + 45) / 90) * 100}%`,
                  }}
                >
                  <div className="text-[10px] font-bold text-cyan-300 font-mono px-1 rounded bg-slate-900/90 border border-cyan-500/40 whitespace-nowrap mb-0.5">
                    {player.name} (YOU)
                  </div>
                  <div
                    className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                    style={{ backgroundColor: equippedSkin.accentColor || '#06B6D4' }}
                  >
                    战
                  </div>
                </div>

                {/* Remote Players Markers */}
                {Object.entries(players).map(([pId, p]) => {
                  const myId = `p_${player.name.toLowerCase().replace(/\s+/g, '_')}`;
                  if (pId === myId) return null;

                  const leftPct = ((p.x + 45) / 90) * 100;
                  const topPct = ((p.z + 45) / 90) * 100;

                  return (
                    <div
                      key={pId}
                      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150 flex flex-col items-center"
                      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShootAtTarget(p.x, p.z);
                      }}
                    >
                      <div className="text-[10px] font-bold text-red-300 font-mono px-1 rounded bg-slate-900/90 border border-red-500/40 whitespace-nowrap mb-0.5 flex items-center gap-1">
                        <span>{p.name}</span>
                        <span className="text-[9px] text-amber-300">Lv.{p.level}</span>
                      </div>
                      <div
                        className="w-5 h-5 rounded-full border-2 border-red-400 flex items-center justify-center text-[10px] font-black text-white shadow-[0_0_12px_rgba(239,68,68,0.8)] cursor-pointer"
                        style={{ backgroundColor: p.accentColor || '#EF4444' }}
                      >
                        敌
                      </div>
                    </div>
                  );
                })}

                {/* Arena Controls Info Overlay */}
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 pointer-events-none">
                  WASD to Move · Click on rivals to Shoot Lasers
                </div>
              </div>

              {/* Mandarin Combat Duel Box below Canvas */}
              <div className="mt-3 p-3 bg-slate-900 border border-cyan-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-cyan-400 shrink-0">
                    {duelQuestion.hanzi}
                  </span>
                  <div>
                    <div className="text-xs font-mono text-cyan-300">{duelQuestion.pinyin}</div>
                    <div className="text-xs text-slate-400">Meaning: {duelQuestion.english}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto">
                  {duelQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswerDuel(idx)}
                      className="px-3 py-1.5 bg-slate-950 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-semibold rounded-lg border border-slate-800 hover:border-cyan-400 transition-all active:scale-95 text-left truncate"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Room Chat & Tactical Comms (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden h-[520px]">
              {/* Chat Header */}
              <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Squad Chat & Comms
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">WebSocket Live</span>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
                {chatMessages.map((msg) => {
                  const isMe = msg.senderName === player.name;
                  return (
                    <div
                      key={msg.id}
                      className={`p-2.5 rounded-xl max-w-[90%] transition-all ${
                        isMe
                          ? 'bg-cyan-950/40 border border-cyan-500/40 text-cyan-100 ml-auto'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 mr-auto'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-0.5 font-bold">
                        <span className={isMe ? 'text-cyan-400' : 'text-amber-300'}>
                          {msg.senderName}
                        </span>
                        <span className="text-slate-500">{msg.timestamp}</span>
                      </div>

                      {msg.hanzi ? (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{msg.hanzi}</span>
                            <button
                              onClick={() => speakChinese(msg.hanzi!)}
                              className="p-1 rounded text-slate-400 hover:text-cyan-300"
                            >
                              <Volume2 size={13} />
                            </button>
                          </div>
                          <div className="text-[10px] text-cyan-300 font-mono">{msg.pinyin}</div>
                          <div className="text-[10px] text-slate-400 italic mt-0.5">{msg.text}</div>
                        </div>
                      ) : (
                        <div className="text-slate-200">{msg.text}</div>
                      )}
                    </div>
                  );
                })}
                <div ref={chatScrollRef} />
              </div>

              {/* Quick Mandarin Tactical Callouts */}
              <div className="p-2 bg-slate-900/60 border-t border-slate-800 flex flex-wrap gap-1.5">
                {presetTacticalCalls.map((call) => (
                  <button
                    key={call.hanzi}
                    onClick={() => handleSendMessage(call.english, call.hanzi, call.pinyin)}
                    className="text-[10px] px-2 py-1 rounded bg-slate-950 hover:bg-cyan-500 hover:text-slate-950 border border-slate-800 text-slate-300 font-semibold transition-all active:scale-95"
                  >
                    {call.hanzi}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Chat with squadmates..."
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => handleSendMessage()}
                  className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
