import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MandarinQuestion, PlayerProfile, PowerUpItem, SkinItem } from '../types/game';
import { MANDARIN_QUESTIONS, POWER_UPS } from '../data/mandarinData';
import { sounds, speakChinese } from '../utils/audio';
import {
  Shield,
  Heart,
  Volume2,
  ShoppingBag,
  Zap,
  Clock,
  Crosshair,
  Trophy,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Flame,
  CheckCircle2,
  XCircle,
  Compass,
  Swords,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronsRight,
} from 'lucide-react';

interface ArenaViewProps {
  player: PlayerProfile;
  equippedSkin: SkinItem;
  onUpdatePlayer: (updater: (prev: PlayerProfile) => PlayerProfile) => void;
  onOpenForge: () => void;
}

// 2D Entity definitions
interface PlayerEntity {
  x: number;
  y: number;
  radius: number;
  speed: number;
  angle: number;
}

interface BotEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: 'drone' | 'boss';
  color: string;
  name: string;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isPlayer: boolean;
  color: string;
  damage: number;
}

interface LootChest {
  id: string;
  x: number;
  y: number;
  radius: number;
  isOpened: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

export const ArenaView: React.FC<ArenaViewProps> = ({
  player,
  equippedSkin,
  onUpdatePlayer,
  onOpenForge,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game Arena State
  const [currentWave, setCurrentWave] = useState<number>(1);
  const [playerHp, setPlayerHp] = useState<number>(100);
  const [playerShield, setPlayerShield] = useState<number>(50);
  const [streak, setStreak] = useState<number>(0);
  const [multiplierRemaining, setMultiplierRemaining] = useState<number>(0);

  // Storm Circle
  const [stormTime, setStormTime] = useState<number>(45);
  const [stormRadius, setStormRadius] = useState<number>(580);
  const [isStormFrozen, setIsStormFrozen] = useState<boolean>(false);

  // Questions & Tactical Combat Q&A Terminal
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [showPinyin, setShowPinyin] = useState<boolean>(player.pinyinDefaultVisible);
  const [showEnglishHint, setShowEnglishHint] = useState<boolean>(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [feedbackBanner, setFeedbackBanner] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  // Gimkit Shop Drawer
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);

  // Modals
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [isDefeated, setIsDefeated] = useState<boolean>(false);

  // Game Engine Entities stored in refs for 60fps canvas loop
  const playerRef = useRef<PlayerEntity>({
    x: 400,
    y: 300,
    radius: 20,
    speed: 3.5,
    angle: 0,
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const botsRef = useRef<BotEntity[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const chestsRef = useRef<LootChest[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  // World dimensions
  const WORLD_WIDTH = 1200;
  const WORLD_HEIGHT = 900;
  const mapCenter = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };

  // Shuffle questions for this session
  const sessionQuestions = useMemo(() => {
    return [...MANDARIN_QUESTIONS].sort(() => Math.random() - 0.5);
  }, []);

  const currentQ: MandarinQuestion = sessionQuestions[questionIndex % sessionQuestions.length];

  // Spawn Bots & Chests per wave
  const initWaveEntities = useCallback((wave: number) => {
    const newBots: BotEntity[] = [];

    // Boss Bot in center
    newBots.push({
      id: `boss_${wave}`,
      x: mapCenter.x,
      y: mapCenter.y - 120,
      radius: 36,
      hp: 200 + wave * 60,
      maxHp: 200 + wave * 60,
      speed: 1.2,
      type: 'boss',
      color: '#EF4444',
      name: `Titan Mecha Ω (Wave ${wave})`,
    });

    // 4 Minion Drones patrolling sectors
    const minionCount = 3 + wave;
    for (let i = 0; i < minionCount; i++) {
      const angle = (i / minionCount) * Math.PI * 2;
      const dist = 220 + Math.random() * 120;
      newBots.push({
        id: `drone_${wave}_${i}`,
        x: mapCenter.x + Math.cos(angle) * dist,
        y: mapCenter.y + Math.sin(angle) * dist,
        radius: 18,
        hp: 40 + wave * 15,
        maxHp: 40 + wave * 15,
        speed: 1.6,
        type: 'drone',
        color: '#F59E0B',
        name: `Cyber Sentry ${i + 1}`,
      });
    }

    // 4 Golden Loot Chests (宝箱)
    const newChests: LootChest[] = [
      { id: 'c1', x: mapCenter.x - 220, y: mapCenter.y - 180, radius: 18, isOpened: false },
      { id: 'c2', x: mapCenter.x + 220, y: mapCenter.y - 180, radius: 18, isOpened: false },
      { id: 'c3', x: mapCenter.x - 240, y: mapCenter.y + 180, radius: 18, isOpened: false },
      { id: 'c4', x: mapCenter.x + 240, y: mapCenter.y + 180, radius: 18, isOpened: false },
    ];

    botsRef.current = newBots;
    chestsRef.current = newChests;
    projectilesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    setStormRadius(580);
    setStormTime(45);
  }, [mapCenter.x, mapCenter.y]);

  useEffect(() => {
    initWaveEntities(currentWave);
  }, [currentWave, initWaveEntities]);

  // Audio pronounce on question change
  useEffect(() => {
    if (player.soundEnabled && currentQ) {
      speakChinese(currentQ.hanzi);
    }
  }, [questionIndex, player.soundEnabled, currentQ]);

  // Storm countdown timer
  useEffect(() => {
    if (isVictory || isDefeated || isStormFrozen) return;

    const timer = setInterval(() => {
      setStormTime((prev) => {
        if (prev <= 1) {
          // Storm contracts
          setStormRadius((r) => Math.max(160, r - 60));
          sounds.playDamage();
          return 30; // reset cycle
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVictory, isDefeated, isStormFrozen]);

  // Keyboard input listeners (WASD / Arrows to move; Space to fire; 1, 2, 3, 4 for questions)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;

      // Space to fire laser blast
      if (e.code === 'Space') {
        e.preventDefault();
        firePlayerProjectile();
      }

      // Quick numbers 1, 2, 3, 4 for answer choices
      if (['1', '2', '3', '4'].includes(e.key) && answerState === 'idle') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < currentQ.options.length && !eliminatedOptions.includes(idx)) {
          handleAnswerQuestion(idx);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  });

  // Shoot player laser
  const firePlayerProjectile = () => {
    if (isDefeated || isVictory) return;
    const p = playerRef.current;
    const speed = 9;
    const angle = p.angle;

    projectilesRef.current.push({
      x: p.x + Math.cos(angle) * (p.radius + 6),
      y: p.y + Math.sin(angle) * (p.radius + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      isPlayer: true,
      color: '#06B6D4',
      damage: 25 * (multiplierRemaining > 0 ? 2 : 1),
    });

    sounds.playDamage();
  };

  // Triggered when answering a Mandarin question
  const handleAnswerQuestion = (idx: number) => {
    if (answerState !== 'idle' || isVictory || isDefeated) return;

    setSelectedAnswer(idx);
    const isCorrect = idx === currentQ.correctIndex;

    if (isCorrect) {
      setAnswerState('correct');
      sounds.playSuccess();

      const mult = multiplierRemaining > 0 ? 2 : 1;
      const currentMult = Math.min(4, mult + Math.floor(streak / 3));
      const coinsEarned = 20 * currentMult;
      const xpEarned = 25 * currentMult;

      setStreak((s) => s + 1);
      if (multiplierRemaining > 0) {
        setMultiplierRemaining((m) => Math.max(0, m - 1));
      }

      // Super Combo: Unleash 8-way holographic laser barrage from player!
      const p = playerRef.current;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        projectilesRef.current.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(angle) * 10,
          vy: Math.sin(angle) * 10,
          isPlayer: true,
          color: '#10B981',
          damage: 50 * currentMult,
        });
      }

      // Recharge shields +20
      setPlayerShield((sh) => Math.min(100, sh + 20));

      // Floating text effect
      floatingTextsRef.current.push({
        id: `ft_${Date.now()}`,
        x: p.x,
        y: p.y - 30,
        text: `+${coinsEarned} Coins · SUPER LASER!`,
        color: '#10B981',
        alpha: 1,
      });

      // Update player profile
      onUpdatePlayer((prev) => {
        const newXp = prev.xp + xpEarned;
        let newLvl = prev.level;
        let newMax = prev.maxXp;
        if (newXp >= prev.maxXp) {
          newLvl += 1;
          newMax = Math.floor(prev.maxXp * 1.3);
          sounds.playVictory();
        }
        return {
          ...prev,
          xp: newXp >= prev.maxXp ? newXp - prev.maxXp : newXp,
          maxXp: newMax,
          level: newLvl,
          vCoins: prev.vCoins + coinsEarned,
          highestStreak: Math.max(prev.highestStreak, streak + 1),
        };
      });

      setFeedbackBanner({
        text: `正确！(Correct!) Unleashed 8-Way Laser Barrage (+${coinsEarned} Coins · +20 Shield)`,
        type: 'success',
      });

      setTimeout(() => {
        setSelectedAnswer(null);
        setAnswerState('idle');
        setEliminatedOptions([]);
        setShowEnglishHint(false);
        setQuestionIndex((prev) => prev + 1);
      }, 1000);
    } else {
      setAnswerState('wrong');
      sounds.playError();
      setStreak(0);

      // Boss retaliation strike
      setPlayerHp((hp) => {
        const next = Math.max(0, hp - 15);
        if (next <= 0) setIsDefeated(true);
        return next;
      });

      setFeedbackBanner({
        text: `不正确 (Incorrect). Correct was: ${currentQ.english}. Boss countered!`,
        type: 'warn',
      });

      setTimeout(() => {
        setSelectedAnswer(null);
        setAnswerState('idle');
        setQuestionIndex((prev) => prev + 1);
      }, 1600);
    }
  };

  // Buy Gimkit Power-Up
  const handleBuyPowerUp = (item: PowerUpItem) => {
    if (player.vCoins < item.cost) {
      sounds.playError();
      setFeedbackBanner({ text: 'Not enough V-Coins!', type: 'warn' });
      return;
    }

    onUpdatePlayer((prev) => ({ ...prev, vCoins: prev.vCoins - item.cost }));

    switch (item.type) {
      case 'shield':
        sounds.playShield();
        setPlayerShield((sh) => Math.min(100, sh + 25));
        setFeedbackBanner({ text: 'Shields Supercharged (+25)!', type: 'success' });
        break;
      case 'heal':
        sounds.playSlurp();
        setPlayerHp((hp) => Math.min(100, hp + 50));
        setFeedbackBanner({ text: 'Slurp Juice Restored +50 HP!', type: 'success' });
        break;
      case 'multiplier':
        sounds.playSuccess();
        setMultiplierRemaining((m) => m + 4);
        setFeedbackBanner({ text: '2x Attack Multiplier Active!', type: 'success' });
        break;
      case 'freeze':
        sounds.playShield();
        setIsStormFrozen(true);
        setFeedbackBanner({ text: 'Storm Circle Frozen for 15s!', type: 'success' });
        setTimeout(() => setIsStormFrozen(false), 15000);
        break;
      case 'radar':
        sounds.playSuccess();
        const wrongIdxs = currentQ.options
          .map((_, i) => i)
          .filter((i) => i !== currentQ.correctIndex);
        setEliminatedOptions(wrongIdxs.slice(0, 2));
        setFeedbackBanner({ text: 'Radar 50/50 eliminated 2 choices!', type: 'success' });
        break;
    }
  };

  // 60FPS Game Loop
  useEffect(() => {
    let animId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let botFireTimer = 0;

    const gameLoop = () => {
      const p = playerRef.current;

      // 1. UPDATE PLAYER MOVEMENT
      let dx = 0;
      let dy = 0;
      const k = keysPressed.current;

      if (k['w'] || k['arrowup']) dy -= 1;
      if (k['s'] || k['arrowdown']) dy += 1;
      if (k['a'] || k['arrowleft']) dx -= 1;
      if (k['d'] || k['arrowright']) dx += 1;

      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      p.x = Math.max(p.radius, Math.min(WORLD_WIDTH - p.radius, p.x + dx * p.speed));
      p.y = Math.max(p.radius, Math.min(WORLD_HEIGHT - p.radius, p.y + dy * p.speed));

      if (dx !== 0 || dy !== 0) {
        p.angle = Math.atan2(dy, dx);
      }

      // Check storm distance
      const distFromCenter = Math.hypot(p.x - mapCenter.x, p.y - mapCenter.y);
      if (distFromCenter > stormRadius && !isStormFrozen) {
        // Player inside the storm! Take 0.1 damage per frame
        setPlayerHp((hp) => {
          const next = Math.max(0, hp - 0.2);
          if (next <= 0) setIsDefeated(true);
          return next;
        });
      }

      // 2. CHECK CHEST INTERACTION
      chestsRef.current.forEach((chest) => {
        if (!chest.isOpened) {
          const distToChest = Math.hypot(p.x - chest.x, p.y - chest.y);
          if (distToChest < p.radius + chest.radius + 15) {
            // Open chest!
            chest.isOpened = true;
            sounds.playSuccess();
            onUpdatePlayer((prev) => ({ ...prev, vCoins: prev.vCoins + 35 }));
            floatingTextsRef.current.push({
              id: `chest_${Date.now()}`,
              x: chest.x,
              y: chest.y - 20,
              text: '宝箱开启! +35 Coins (Loot Vault)',
              color: '#FBBF24',
              alpha: 1,
            });
            // Spawn gold particle burst
            for (let i = 0; i < 15; i++) {
              particlesRef.current.push({
                x: chest.x,
                y: chest.y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1,
                maxLife: 1,
                color: '#FBBF24',
                size: Math.random() * 4 + 2,
              });
            }
          }
        }
      });

      // 3. UPDATE BOTS (Move towards player, shoot periodically)
      botFireTimer++;
      botsRef.current.forEach((bot) => {
        const bAngle = Math.atan2(p.y - bot.y, p.x - bot.x);
        bot.x += Math.cos(bAngle) * bot.speed;
        bot.y += Math.sin(bAngle) * bot.speed;

        // Bot shoots laser at player
        if (botFireTimer % (bot.type === 'boss' ? 70 : 120) === 0) {
          projectilesRef.current.push({
            x: bot.x,
            y: bot.y,
            vx: Math.cos(bAngle) * 5,
            vy: Math.sin(bAngle) * 5,
            isPlayer: false,
            color: bot.type === 'boss' ? '#EF4444' : '#F59E0B',
            damage: bot.type === 'boss' ? 14 : 8,
          });
        }
      });

      // 4. UPDATE PROJECTILES
      projectilesRef.current = projectilesRef.current.filter((proj) => {
        proj.x += proj.vx;
        proj.y += proj.vy;

        // Check screen bounds
        if (proj.x < 0 || proj.x > WORLD_WIDTH || proj.y < 0 || proj.y > WORLD_HEIGHT) {
          return false;
        }

        // Check collision with player
        if (!proj.isPlayer) {
          const d = Math.hypot(proj.x - p.x, proj.y - p.y);
          if (d < p.radius + 4) {
            // Player hit!
            sounds.playDamage();
            setPlayerShield((sh) => {
              if (sh > 0) {
                return Math.max(0, sh - proj.damage);
              } else {
                setPlayerHp((hp) => {
                  const next = Math.max(0, hp - proj.damage);
                  if (next <= 0) setIsDefeated(true);
                  return next;
                });
                return 0;
              }
            });
            // Spark effect
            for (let i = 0; i < 5; i++) {
              particlesRef.current.push({
                x: proj.x,
                y: proj.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1,
                maxLife: 1,
                color: '#EF4444',
                size: 3,
              });
            }
            return false;
          }
        } else {
          // Check collision with bots
          for (let i = 0; i < botsRef.current.length; i++) {
            const b = botsRef.current[i];
            const d = Math.hypot(proj.x - b.x, proj.y - b.y);
            if (d < b.radius + 5) {
              b.hp -= proj.damage;
              floatingTextsRef.current.push({
                id: `dmg_${Date.now()}_${Math.random()}`,
                x: b.x,
                y: b.y - 15,
                text: `-${proj.damage}`,
                color: '#06B6D4',
                alpha: 1,
              });
              // Spark
              for (let k = 0; k < 6; k++) {
                particlesRef.current.push({
                  x: proj.x,
                  y: proj.y,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 5,
                  life: 1,
                  maxLife: 1,
                  color: '#06B6D4',
                  size: 3,
                });
              }
              return false;
            }
          }
        }
        return true;
      });

      // Filter dead bots
      botsRef.current = botsRef.current.filter((b) => {
        if (b.hp <= 0) {
          sounds.playVictory();
          // Burst of particles
          for (let i = 0; i < 20; i++) {
            particlesRef.current.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 1,
              maxLife: 1,
              color: b.color,
              size: Math.random() * 5 + 2,
            });
          }
          if (b.type === 'boss') {
            setIsVictory(true);
          }
          return false;
        }
        return true;
      });

      // 5. UPDATE PARTICLES & FLOATING TEXTS
      particlesRef.current = particlesRef.current.filter((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.03;
        return pt.life > 0;
      });

      floatingTextsRef.current = floatingTextsRef.current.filter((ft) => {
        ft.y -= 0.8;
        ft.alpha -= 0.02;
        return ft.alpha > 0;
      });

      // ----------------------------------------------------------------------
      // 6. RENDER SCENE
      // ----------------------------------------------------------------------
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Camera coordinates centered on player
      const scaleX = canvas.width / WORLD_WIDTH;
      const scaleY = canvas.height / WORLD_HEIGHT;

      // Draw Grid
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize * scaleX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize * scaleY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Storm Circle (Purple Ring & Danger Zone)
      const stormScreenX = mapCenter.x * scaleX;
      const stormScreenY = mapCenter.y * scaleY;
      const stormScreenR = stormRadius * scaleX;

      // Outer storm fill
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.arc(stormScreenX, stormScreenY, stormScreenR, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(126, 34, 206, 0.28)';
      ctx.fill();

      // Storm border glowing line
      ctx.beginPath();
      ctx.arc(stormScreenX, stormScreenY, stormScreenR, 0, Math.PI * 2);
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#C084FC';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      // Draw Loot Chests (宝箱)
      chestsRef.current.forEach((chest) => {
        const cx = chest.x * scaleX;
        const cy = chest.y * scaleY;
        const cr = chest.radius * scaleX;

        ctx.save();
        if (chest.isOpened) {
          ctx.fillStyle = '#475569';
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 2;
          ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
          ctx.strokeRect(cx - cr, cy - cr, cr * 2, cr * 2);
        } else {
          // Glowing Gold Chest
          ctx.fillStyle = '#F59E0B';
          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#FBBF24';
          ctx.shadowBlur = 10;
          ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
          ctx.strokeRect(cx - cr, cy - cr, cr * 2, cr * 2);

          // Hanzi "宝" label on chest
          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('宝', cx, cy);
        }
        ctx.restore();
      });

      // Draw Bots
      botsRef.current.forEach((bot) => {
        const bx = bot.x * scaleX;
        const by = bot.y * scaleY;
        const br = bot.radius * scaleX;

        ctx.save();
        // Body
        ctx.fillStyle = bot.color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.shadowColor = bot.color;
        ctx.shadowBlur = bot.type === 'boss' ? 16 : 8;

        ctx.beginPath();
        if (bot.type === 'boss') {
          // Angular boss shape
          ctx.arc(bx, by, br, 0, Math.PI * 2);
        } else {
          ctx.arc(bx, by, br, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();

        // Bot Health bar
        const hpPct = bot.hp / bot.maxHp;
        const barW = br * 2.2;
        const barH = 4;
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(bx - barW / 2, by - br - 12, barW, barH);
        ctx.fillStyle = bot.color;
        ctx.fillRect(bx - barW / 2, by - br - 12, barW * hpPct, barH);

        // Name
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bot.name, bx, by - br - 16);
        ctx.restore();
      });

      // Draw Projectiles
      projectilesRef.current.forEach((proj) => {
        const px = proj.x * scaleX;
        const py = proj.y * scaleY;

        ctx.save();
        ctx.fillStyle = proj.color;
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, proj.isPlayer ? 4 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Particles
      particlesRef.current.forEach((pt) => {
        ctx.save();
        ctx.globalAlpha = pt.life;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x * scaleX, pt.y * scaleY, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Player Character
      const px = p.x * scaleX;
      const py = p.y * scaleY;
      const pr = p.radius * scaleX;

      ctx.save();
      // Outer neon ring
      ctx.fillStyle = '#06B6D4';
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();

      // Inner visor core
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(px, py, pr - 3, 0, Math.PI * 2);
      ctx.fill();

      // Gun/Facing pointer
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(p.angle) * (pr + 10), py + Math.sin(p.angle) * (pr + 10));
      ctx.stroke();

      // Player name & skin tag
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, px, py - pr - 14);

      // Player overhead health / shield mini-bar
      const pBarW = 34;
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(px - pBarW / 2, py - pr - 8, pBarW, 3);
      ctx.fillStyle = '#10B981';
      ctx.fillRect(px - pBarW / 2, py - pr - 8, pBarW * (playerHp / 100), 3);

      ctx.restore();

      // Draw Floating Texts
      floatingTextsRef.current.forEach((ft) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x * scaleX, ft.y * scaleY);
        ctx.restore();
      });

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [WORLD_WIDTH, WORLD_HEIGHT, mapCenter.x, mapCenter.y, stormRadius, isStormFrozen, playerHp, player.name]);

  // Mobile virtual joystick button handlers
  const handleVirtualMove = (key: string, isDown: boolean) => {
    keysPressed.current[key] = isDown;
  };

  const handleNextWave = () => {
    setCurrentWave((w) => w + 1);
    setPlayerHp(100);
    setPlayerShield(75);
    setIsVictory(false);
    onUpdatePlayer((prev) => ({
      ...prev,
      arenaVictories: prev.arenaVictories + 1,
      vCoins: prev.vCoins + 100,
    }));
  };

  const handleRestart = () => {
    setPlayerHp(100);
    setPlayerShield(50);
    setIsDefeated(false);
    setIsVictory(false);
    setStreak(0);
    initWaveEntities(currentWave);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top HUD: Vitals, Storm Ring, Multipliers, & Shop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Player Vitals */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-extrabold text-sm">
              HP
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Health & Shield
              </span>
              <div className="flex items-center gap-2 text-xs font-mono font-bold">
                <span className="text-emerald-400">HP {Math.round(playerHp)}/100</span>
                <span className="text-slate-500">·</span>
                <span className="text-cyan-400">SHIELD {Math.round(playerShield)}/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Storm Timer */}
        <div
          className={`border rounded-2xl p-3 flex items-center justify-between transition-all ${
            stormTime <= 10
              ? 'bg-red-950/40 border-red-500/70 animate-pulse'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock size={18} className={stormTime <= 10 ? 'text-red-400' : 'text-purple-400'} />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Storm Contraction
              </span>
              <span className="text-sm font-extrabold text-purple-300 font-mono">
                {isStormFrozen ? 'FROZEN (15s)' : `${stormTime}s`}
              </span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">
            Radius: {Math.round(stormRadius)}m
          </span>
        </div>

        {/* Streak & Damage Multiplier */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={18} className={streak >= 3 ? 'text-amber-400 fill-amber-400' : 'text-slate-500'} />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Answer Streak
              </span>
              <span className="text-sm font-extrabold text-amber-300 font-mono">
                {streak} in a row ({streak >= 3 ? '2x Damage!' : '1x'})
              </span>
            </div>
          </div>
        </div>

        {/* Gimkit Shop Drawer Trigger */}
        <button
          onClick={() => setIsShopOpen(true)}
          className="bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/40 rounded-2xl p-3 flex items-center justify-between text-left transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500 text-slate-950 font-bold">
              <ShoppingBag size={16} />
            </div>
            <div>
              <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider block">
                Gimkit Shop
              </span>
              <span className="text-xs font-bold text-white">Power-Ups</span>
            </div>
          </div>
          <ChevronRight size={18} className="text-cyan-400" />
        </button>
      </div>

      {/* Main Playable 2D Arena Canvas */}
      <div className="relative bg-slate-950 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Real HTML5 2D Canvas */}
        <canvas
          ref={canvasRef}
          width={880}
          height={480}
          className="w-full h-[360px] md:h-[460px] block cursor-crosshair"
          onClick={firePlayerProjectile}
        />

        {/* Floating Controls Overlay Reminder */}
        <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-[11px] text-slate-300 flex items-center gap-3">
          <span>Move: <strong className="text-cyan-400">W, A, S, D / Arrows</strong></span>
          <span>·</span>
          <span>Shoot: <strong className="text-cyan-400">Spacebar / Click</strong></span>
          <span>·</span>
          <span>Answer: <strong className="text-emerald-400">1-4 Keys</strong></span>
        </div>

        {/* Touch Controls for Mobile / Tablet */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 md:hidden">
          <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            <div />
            <button
              onTouchStart={() => handleVirtualMove('w', true)}
              onTouchEnd={() => handleVirtualMove('w', false)}
              className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center font-bold"
            >
              ↑
            </button>
            <div />
            <button
              onTouchStart={() => handleVirtualMove('a', true)}
              onTouchEnd={() => handleVirtualMove('a', false)}
              className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center font-bold"
            >
              ←
            </button>
            <button
              onTouchStart={() => handleVirtualMove('s', true)}
              onTouchEnd={() => handleVirtualMove('s', false)}
              className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center font-bold"
            >
              ↓
            </button>
            <button
              onTouchStart={() => handleVirtualMove('d', true)}
              onTouchEnd={() => handleVirtualMove('d', false)}
              className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center font-bold"
            >
              →
            </button>
          </div>
          <button
            onClick={firePlayerProjectile}
            className="w-12 h-12 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center shadow-lg active:scale-90"
          >
            FIRE
          </button>
        </div>

        {/* Minimap Pill Overlay */}
        <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-sm border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-mono text-cyan-300">
          Battle Island 1200x900m
        </div>
      </div>

      {/* TACTICAL COMBAT Q&A TERMINAL (The Superpower Engine!) */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
        {/* Terminal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Swords size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white uppercase font-['Barlow_Condensed']">
                Combat Tactical Terminal
              </h3>
              <p className="text-xs text-slate-400">
                Answer correctly to unleash an <strong>8-Way Laser Barrage</strong>, recharge shields & earn V-Coins!
              </p>
            </div>
          </div>

          {/* Audio, Pinyin & Hint Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => speakChinese(currentQ.hanzi)}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Volume2 size={16} />
              <span>Pronounce (发音)</span>
            </button>
            <button
              onClick={() => setShowPinyin(!showPinyin)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                showPinyin
                  ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              Pinyin {showPinyin ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowEnglishHint(!showEnglishHint)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                showEnglishHint
                  ? 'bg-amber-950 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              Hint {showEnglishHint ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackBanner && (
          <div
            className={`p-2.5 rounded-xl border text-center text-xs font-bold animate-in fade-in zoom-in-95 ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                : 'bg-red-950/60 border-red-500 text-red-300'
            }`}
          >
            {feedbackBanner.text}
          </div>
        )}

        {/* Character & Definition Clue */}
        <div className="text-center py-2 space-y-1">
          <div className="text-5xl md:text-6xl font-black text-white font-sans tracking-widest drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            {currentQ.hanzi}
          </div>
          {showPinyin && (
            <div className="text-lg md:text-xl font-bold text-cyan-400 font-mono">
              {currentQ.pinyin}
            </div>
          )}
          {showEnglishHint && (
            <div className="text-xs text-amber-300 italic">
              Category: {currentQ.category.toUpperCase()} · &ldquo;{currentQ.explanation}&rdquo;
            </div>
          )}
        </div>

        {/* 4 Interactive Choice Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedAnswer === idx;
            const isEliminated = eliminatedOptions.includes(idx);
            const isCorrectOption = idx === currentQ.correctIndex;

            let btnClass =
              'bg-slate-900 border-slate-800 text-slate-200 hover:border-cyan-400 hover:bg-slate-850 hover:text-white';

            if (answerState === 'correct' && isCorrectOption) {
              btnClass =
                'bg-emerald-950 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
            } else if (answerState === 'wrong' && isSelected) {
              btnClass = 'bg-red-950 border-red-500 text-red-200 ring-2 ring-red-500/50';
            } else if (answerState === 'wrong' && isCorrectOption) {
              btnClass = 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300';
            } else if (isEliminated) {
              btnClass = 'opacity-30 border-slate-900 text-slate-600 line-through cursor-not-allowed';
            }

            return (
              <button
                key={idx}
                disabled={isEliminated || answerState !== 'idle'}
                onClick={() => handleAnswerQuestion(idx)}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-3 group active:scale-[0.98] ${btnClass}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-400 group-hover:text-cyan-400">
                    {idx + 1}
                  </span>
                  <span className="text-sm md:text-base font-semibold">{opt}</span>
                </div>
                {answerState === 'correct' && isCorrectOption && (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                )}
                {answerState === 'wrong' && isSelected && (
                  <XCircle size={18} className="text-red-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gimkit Live Power-Up Shop Drawer */}
      {isShopOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-cyan-400" />
                <h3 className="text-base font-bold text-white uppercase tracking-wider font-['Barlow_Condensed']">
                  Gimkit Combat Power-Up Shop
                </h3>
              </div>
              <button
                onClick={() => setIsShopOpen(false)}
                className="text-slate-400 hover:text-white px-2 py-1 text-xs font-bold uppercase rounded bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="text-xs text-slate-400 mb-2">
                Spend V-Coins to acquire instantaneous game-changing boosts during battle!
              </div>

              {POWER_UPS.map((pu) => {
                const canAfford = player.vCoins >= pu.cost;
                return (
                  <div
                    key={pu.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
                        {pu.type === 'shield' && <Shield size={18} />}
                        {pu.type === 'heal' && <Heart size={18} />}
                        {pu.type === 'multiplier' && <Zap size={18} />}
                        {pu.type === 'freeze' && <Clock size={18} />}
                        {pu.type === 'radar' && <Crosshair size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{pu.name}</h4>
                          <span className="text-xs text-cyan-400">({pu.hanziName})</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{pu.description}</p>
                      </div>
                    </div>

                    <button
                      disabled={!canAfford}
                      onClick={() => handleBuyPowerUp(pu)}
                      className={`px-3.5 py-2 rounded-lg font-mono text-xs font-bold transition-all shrink-0 ${
                        canAfford
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {pu.cost} Coins
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                Balance: <strong className="text-amber-300 font-mono">{player.vCoins}</strong> V-Coins
              </span>
              <button
                onClick={() => setIsShopOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold"
              >
                Return to Battle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Royale Modal */}
      {isVictory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 md:p-8 text-center space-y-5 shadow-[0_0_60px_rgba(251,191,36,0.3)] animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.4)] animate-bounce">
              <Trophy size={40} />
            </div>

            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-300 block mb-1">
                第一名 · 大胜利
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white uppercase tracking-tight font-['Barlow_Condensed']">
                #1 Victory Royale!
              </h2>
              <p className="text-sm text-slate-300 mt-2">
                You defeated the Titan Mecha Boss on the battle island! Wave {currentWave} Cleared!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2 bg-slate-950 rounded-2xl border border-slate-800 p-3">
              <div>
                <span className="text-[11px] text-slate-400 font-semibold block">Bonus V-Coins</span>
                <span className="text-xl font-extrabold text-amber-300 font-mono">+100</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-semibold block">Battle Pass XP</span>
                <span className="text-xl font-extrabold text-cyan-400 font-mono">+150</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleNextWave}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-extrabold text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95"
              >
                Deploy to Wave {currentWave + 1}
              </button>
              <button
                onClick={onOpenForge}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>Forge New Skin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Defeat Modal */}
      {isDefeated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/50 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-950 border border-red-500 flex items-center justify-center text-red-400">
              <RotateCcw size={30} />
            </div>
            <h3 className="text-2xl font-bold text-white uppercase font-['Barlow_Condensed']">
              Battle Armor Depleted!
            </h3>
            <p className="text-xs text-slate-300">
              The storm or enemy drones caught you! Regroup, charge your shields, and jump right back in!
            </p>
            <button
              onClick={handleRestart}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm uppercase tracking-wider shadow-md transition-all active:scale-95"
            >
              Respawn & Deploy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
