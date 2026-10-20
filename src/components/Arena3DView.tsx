import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { PlayerProfile, SkinItem, PowerUpItem, MandarinQuestion } from '../types/game';
import { MANDARIN_QUESTIONS, POWER_UPS } from '../data/mandarinData';
import { sounds, speakChinese } from '../utils/audio';

interface Arena3DViewProps {
  player: PlayerProfile;
  equippedSkin?: SkinItem;
  onUpdatePlayer: React.Dispatch<React.SetStateAction<PlayerProfile>>;
  onOpenForge: () => void;
}

export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type WeaponId = 'rifle' | 'shotgun' | 'sniper' | 'rocket' | 'smg';

export interface WeaponSlot {
  id: WeaponId;
  slotNum: number;
  name: string;
  hanziName: string;
  pinyinName: string;
  rarity: WeaponRarity;
  damage: number;
  fireCooldownMs: number;
  maxAmmo: number;
  currentAmmo: number;
  isUnlocked: boolean;
  stars: number;
  bulletSpeed: number;
  bulletColor: number;
  pellets?: number;
  isExplosive?: boolean;
  upgradeProgress: number; // Correct answers towards next tier
  upgradeTarget: number;   // Correct answers required for next tier
  tier: number;            // 1 to 5
}

interface EnemyBot3D {
  id: string;
  name: string;
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  fireCooldown: number;
  strafeDir: number;
  strafeTimer: number;
  isBoss: boolean;
  walkCycle: number;
}

interface LaserBullet3D {
  mesh: THREE.Mesh;
  direction: THREE.Vector3;
  speed: number;
  life: number;
  isPlayer: boolean;
  damage: number;
  isExplosive?: boolean;
}

interface ShieldPotionDrop {
  group: THREE.Group;
  collected: boolean;
}

interface GoldCoinPickup3D {
  group: THREE.Group;
  coinMesh: THREE.Mesh | THREE.Group;
  beaconMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  sparkles?: THREE.Mesh[];
  baseY: number;
  x: number;
  z: number;
  collected: boolean;
  type: 'coin' | 'chest' | 'ammo' | 'slurp';
}

interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

interface RampCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'x' | 'z';
  startCoord: number;
  endCoord: number;
  baseHeight: number;
  topHeight: number;
}

interface FloatingCombatText {
  id: number;
  text: string;
  x: number;
  y: number;
  isCrit: boolean;
  opacity: number;
}

export interface WaveLevelConfig {
  levelNumber: number;
  title: string;
  subtitle: string;
  botCount: number;
  bossName: string;
  bossHp: number;
  stormRadius: number;
  stormSeconds: number;
  rewardCoins: number;
}

export const WAVE_LEVELS: WaveLevelConfig[] = [
  {
    levelNumber: 1,
    title: 'Level 1: Recon Patrol Incursion',
    subtitle: 'Rival scouts have parachuted into the outer perimeter. Eliminate the squad!',
    botCount: 4,
    bossName: 'Scout Leader Alpha',
    bossHp: 130,
    stormRadius: 160,
    stormSeconds: 45,
    rewardCoins: 100,
  },
  {
    levelNumber: 2,
    title: 'Level 2: Cyber Vanguard Assault',
    subtitle: 'Armored vanguard bots with rapid plasma rifles are advancing from the south!',
    botCount: 6,
    bossName: 'Cyber Vanguard Mecha',
    bossHp: 220,
    stormRadius: 155,
    stormSeconds: 45,
    rewardCoins: 130,
  },
  {
    levelNumber: 3,
    title: 'Level 3: Urban Siege (High-Rise Assault)',
    subtitle: 'Enemies have fortified the Tilted Apartment and shipping containers. Watch the high ground!',
    botCount: 7,
    bossName: 'Goliath Heavy Gunner',
    bossHp: 300,
    stormRadius: 150,
    stormSeconds: 40,
    rewardCoins: 160,
  },
  {
    levelNumber: 4,
    title: 'Level 4: Armory Infiltration & Snipers',
    subtitle: 'Rival snipers are posted on the Clocktower deck. Use ramps and cover!',
    botCount: 8,
    bossName: 'Phantom Sniper Overlord',
    bossHp: 380,
    stormRadius: 145,
    stormSeconds: 40,
    rewardCoins: 200,
  },
  {
    levelNumber: 5,
    title: 'Level 5: Mid-Game Titan Boss Battle',
    subtitle: 'A colossal Titan Mecha Alpha has breached the island center! Storm is contracting!',
    botCount: 9,
    bossName: 'Titan Mecha Alpha',
    bossHp: 480,
    stormRadius: 135,
    stormSeconds: 35,
    rewardCoins: 250,
  },
  {
    levelNumber: 6,
    title: 'Level 6: Shadow Syndicate Strike',
    subtitle: 'High-speed stealth cyber ronin are flanking through the forest foliage!',
    botCount: 10,
    bossName: 'Shadow Ronin Ω',
    bossHp: 560,
    stormRadius: 125,
    stormSeconds: 35,
    rewardCoins: 300,
  },
  {
    levelNumber: 7,
    title: 'Level 7: Fortress Citadel Defense',
    subtitle: 'Enemies are converging on all 4 island structures simultaneously. Hold the line!',
    botCount: 11,
    bossName: 'Overlord Dreadnought',
    bossHp: 640,
    stormRadius: 115,
    stormSeconds: 30,
    rewardCoins: 350,
  },
  {
    levelNumber: 8,
    title: 'Level 8: Cyber Warlord Battalion',
    subtitle: 'Coordinated battalion crossfire! Upgrade your weapons with Mandarin questions to survive!',
    botCount: 12,
    bossName: 'Warlord Omega',
    bossHp: 740,
    stormRadius: 105,
    stormSeconds: 30,
    rewardCoins: 420,
  },
  {
    levelNumber: 9,
    title: 'Level 9: Storm Cataclysm (Close Quarters)',
    subtitle: 'The storm has collapsed the island to 75m! Furious close-range warfare on the ramps!',
    botCount: 13,
    bossName: 'Cataclysm Behemoth',
    bossHp: 880,
    stormRadius: 85,
    stormSeconds: 28,
    rewardCoins: 500,
  },
  {
    levelNumber: 10,
    title: 'Level 10: The Sovereign Grand Finale',
    subtitle: 'The ultimate showdown! Defeat the Sovereign Dragon Mecha Ω to conquer Battle Island!',
    botCount: 15,
    bossName: 'The Sovereign Dragon Mecha Ω',
    bossHp: 1100,
    stormRadius: 75,
    stormSeconds: 25,
    rewardCoins: 1000,
  },
];

const RARITY_COLORS: Record<WeaponRarity, { border: string; bg: string; text: string; glow: string; hex: number }> = {
  common: { border: 'border-slate-500', bg: 'bg-slate-800/80', text: 'text-slate-300', glow: '#94a3b8', hex: 0x94a3b8 },
  rare: { border: 'border-blue-500', bg: 'bg-blue-950/80', text: 'text-blue-300', glow: '#3b82f6', hex: 0x3b82f6 },
  epic: { border: 'border-purple-500', bg: 'bg-purple-950/80', text: 'text-purple-300', glow: '#a855f7', hex: 0xa855f7 },
  legendary: { border: 'border-amber-500', bg: 'bg-amber-950/80', text: 'text-amber-300', glow: '#f59e0b', hex: 0xf59e0b },
  mythic: { border: 'border-rose-500', bg: 'bg-rose-950/80', text: 'text-rose-300', glow: '#f43f5e', hex: 0xf43f5e },
};

// BALANCED STARTING WEAPONS: Starts at Tier 1 (Common) with real progression!
const INITIAL_WEAPONS: WeaponSlot[] = [
  {
    id: 'rifle',
    slotNum: 1,
    name: 'Pulse Rifle',
    hanziName: '能量步枪',
    pinyinName: 'Néngliàng Bùqiāng',
    rarity: 'common',
    damage: 24,
    fireCooldownMs: 150,
    maxAmmo: 25,
    currentAmmo: 25,
    isUnlocked: true,
    stars: 1,
    bulletSpeed: 95,
    bulletColor: 0x38bdf8,
    upgradeProgress: 0,
    upgradeTarget: 3,
    tier: 1,
  },
  {
    id: 'shotgun',
    slotNum: 2,
    name: 'Havoc Pump Shotgun',
    hanziName: '重型散弹枪',
    pinyinName: 'Zhòngxíng Sǎndànqiāng',
    rarity: 'common',
    damage: 60,
    fireCooldownMs: 750,
    maxAmmo: 4,
    currentAmmo: 4,
    isUnlocked: true,
    stars: 1,
    bulletSpeed: 80,
    bulletColor: 0xf59e0b,
    pellets: 5,
    upgradeProgress: 0,
    upgradeTarget: 3,
    tier: 1,
  },
  {
    id: 'smg',
    slotNum: 3,
    name: 'Rapid Cyber SMG',
    hanziName: '极速冲锋枪',
    pinyinName: 'Jísù Chōngfēngqiāng',
    rarity: 'common',
    damage: 15,
    fireCooldownMs: 95,
    maxAmmo: 28,
    currentAmmo: 28,
    isUnlocked: true,
    stars: 1,
    bulletSpeed: 105,
    bulletColor: 0x22d3ee,
    upgradeProgress: 0,
    upgradeTarget: 3,
    tier: 1,
  },
  {
    id: 'sniper',
    slotNum: 4,
    name: 'Thermal Heavy Sniper',
    hanziName: '重型狙击枪',
    pinyinName: 'Zhòngxíng Jūjīqiāng',
    rarity: 'rare',
    damage: 85,
    fireCooldownMs: 1300,
    maxAmmo: 3,
    currentAmmo: 3,
    isUnlocked: true,
    stars: 2,
    bulletSpeed: 160,
    bulletColor: 0xa855f7,
    upgradeProgress: 0,
    upgradeTarget: 4,
    tier: 2,
  },
  {
    id: 'rocket',
    slotNum: 5,
    name: 'Anvil Rocket Launcher',
    hanziName: '火箭筒',
    pinyinName: 'Huǒjiàn Tǒng',
    rarity: 'epic',
    damage: 130,
    fireCooldownMs: 1800,
    maxAmmo: 2,
    currentAmmo: 2,
    isUnlocked: true,
    stars: 3,
    bulletSpeed: 55,
    bulletColor: 0xef4444,
    isExplosive: true,
    upgradeProgress: 0,
    upgradeTarget: 5,
    tier: 3,
  },
];

export const Arena3DView: React.FC<Arena3DViewProps> = ({
  player,
  equippedSkin,
  onUpdatePlayer,
  onOpenForge,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Progressive Danger Levels (1 to 10)
  const [currentWave, setCurrentWave] = useState<number>(1);
  const [playerHp, setPlayerHp] = useState<number>(100);
  const [playerShield, setPlayerShield] = useState<number>(50);
  const [enemiesEliminated, setEnemiesEliminated] = useState<number>(0);
  const [totalEnemiesInWave, setTotalEnemiesInWave] = useState<number>(4);
  const [streak, setStreak] = useState<number>(0);
  const [multiplierRemaining, setMultiplierRemaining] = useState<number>(0);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingCombatText[]>([]);
  const [isReloading, setIsReloading] = useState<boolean>(false);

  // Weapon Hotbar & Active Weapon
  const [weapons, setWeapons] = useState<WeaponSlot[]>(INITIAL_WEAPONS);
  const [activeWeaponIdx, setActiveWeaponIdx] = useState<number>(0);

  // Mandarin Tactical Reload & Station State
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [feedbackBanner, setFeedbackBanner] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showPinyin, setShowPinyin] = useState<boolean>(true);
  const [showRadicalHint, setShowRadicalHint] = useState<boolean>(false);

  // Battle Royale Storm Circle
  const [stormRadius, setStormRadius] = useState<number>(160);
  const [stormSeconds, setStormSeconds] = useState<number>(45);
  const [isStormFrozen, setIsStormFrozen] = useState<boolean>(false);

  // Gimkit In-Game Power-Up Shop
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);

  // Victory / Defeat Overlays
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [isDefeated, setIsDefeated] = useState<boolean>(false);

  // Mutable Scalar Refs
  const onUpdatePlayerRef = useRef(onUpdatePlayer);
  const playerHpRef = useRef(100);
  const playerShieldRef = useRef(50);
  const weaponsRef = useRef(weapons);
  const activeWeaponRef = useRef(weapons[0]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const playerGroupRef = useRef<THREE.Group | null>(null);
  const stormMeshRef = useRef<THREE.Mesh | null>(null);
  const enemiesRef = useRef<EnemyBot3D[]>([]);
  const bulletsRef = useRef<LaserBullet3D[]>([]);
  const potionDropsRef = useRef<ShieldPotionDrop[]>([]);
  const goldPickupsRef = useRef<GoldCoinPickup3D[]>([]);
  const obstaclesRef = useRef<ObstacleBox[]>([]);
  const rampsRef = useRef<RampCollider[]>([]);
  const spawnWaveRef = useRef<(wave: number) => void>(() => {});
  const lastStormTickRef = useRef<number>(0);

  // Player Limbs & Weapon Mount Refs
  const playerLimbsRef = useRef<{
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArmGroup: THREE.Group;
    rightArmGroup: THREE.Group;
    weaponMount: THREE.Group;
    muzzleFlashMesh: THREE.Mesh;
  } | null>(null);

  const stormRadiusRef = useRef(160);
  const isStormFrozenRef = useRef(false);
  const isDefeatedRef = useRef(false);
  const isVictoryRef = useRef(false);
  const multiplierRemainingRef = useRef(0);
  const isPointerLockedRef = useRef(false);
  const streakRef = useRef(0);

  // Sync state with refs safely
  useEffect(() => {
    onUpdatePlayerRef.current = onUpdatePlayer;
  }, [onUpdatePlayer]);

  useEffect(() => {
    stormRadiusRef.current = stormRadius;
  }, [stormRadius]);

  useEffect(() => {
    isStormFrozenRef.current = isStormFrozen;
  }, [isStormFrozen]);

  useEffect(() => {
    isDefeatedRef.current = isDefeated;
  }, [isDefeated]);

  useEffect(() => {
    isVictoryRef.current = isVictory;
  }, [isVictory]);

  useEffect(() => {
    multiplierRemainingRef.current = multiplierRemaining;
  }, [multiplierRemaining]);

  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  useEffect(() => {
    weaponsRef.current = weapons;
    activeWeaponRef.current = weapons[activeWeaponIdx] || weapons[0];
  }, [weapons, activeWeaponIdx]);

  useEffect(() => {
    isPointerLockedRef.current = isPointerLocked;
  }, [isPointerLocked]);

  // Kinematics: Physics & Movement
  const playerVelocityY = useRef<number>(0);
  const isGroundedRef = useRef<boolean>(true);
  const keysRef = useRef<{ [k: string]: boolean }>({});
  const lastShotTimeRef = useRef<number>(0);
  const mouseLookRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  const sessionQuestions = useMemo(() => {
    return [...MANDARIN_QUESTIONS].sort(() => Math.random() - 0.5);
  }, []);

  const currentQ: MandarinQuestion = sessionQuestions[questionIndex % sessionQuestions.length];
  const currentQRef = useRef(currentQ);
  useEffect(() => {
    currentQRef.current = currentQ;
  }, [currentQ]);

  // Auto-pronounce on question change
  useEffect(() => {
    if (player.soundEnabled && currentQ) {
      speakChinese(currentQ.hanzi);
    }
  }, [questionIndex, player.soundEnabled, currentQ?.id]);

  // Safe Storm countdown timer
  useEffect(() => {
    if (isVictory || isDefeated || isStormFrozen) return;

    const timer = setInterval(() => {
      setStormSeconds((prev) => {
        if (prev <= 1) {
          setTimeout(() => {
            setStormRadius((r) => Math.max(40, r - 20));
            sounds.playDamage();
          }, 0);
          const currentCfg = WAVE_LEVELS[Math.min(currentWave - 1, WAVE_LEVELS.length - 1)];
          return currentCfg?.stormSeconds || 40;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVictory, isDefeated, isStormFrozen, currentWave]);

  // Bullet hit test against obstacle boxes
  const checkBulletObstacleHit = useCallback((pos: THREE.Vector3): boolean => {
    for (const b of obstaclesRef.current) {
      if (
        pos.x >= b.minX &&
        pos.x <= b.maxX &&
        pos.z >= b.minZ &&
        pos.z <= b.maxZ &&
        pos.y <= b.height &&
        pos.y >= 0
      ) {
        return true;
      }
    }
    return false;
  }, []);

  // Floating combat text
  const addCombatText = useCallback((text: string, isCrit: boolean) => {
    const id = Date.now() + Math.random();
    const textObj: FloatingCombatText = {
      id,
      text,
      x: window.innerWidth / 2 + (Math.random() * 80 - 40),
      y: window.innerHeight / 2 - 40 - Math.random() * 30,
      isCrit,
      opacity: 1.0,
    };
    setFloatingTexts((prev) => [...prev.slice(-6), textObj]);

    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== id));
    }, 1100);
  }, []);

  const addCombatTextRef = useRef(addCombatText);
  useEffect(() => {
    addCombatTextRef.current = addCombatText;
  }, [addCombatText]);

  // Procedural 3D Weapon Model Generator
  const buildWeaponMesh = useCallback((wId: WeaponId, rarity?: WeaponRarity): THREE.Group => {
    const group = new THREE.Group();
    const rConfig = RARITY_COLORS[rarity || 'common'];
    const gunDarkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
    const gunAccentMat = new THREE.MeshStandardMaterial({
      color: rConfig.hex,
      metalness: 0.8,
      roughness: 0.25,
      emissive: rConfig.hex,
      emissiveIntensity: 0.35,
    });
    const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.95, roughness: 0.15 });

    switch (wId) {
      case 'rifle': {
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 1.3), gunDarkMat);
        group.add(receiver);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 12), gunMetalMat);
        barrel.rotateX(Math.PI / 2);
        barrel.position.set(0, 0.05, 0.85);
        group.add(barrel);
        const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.65), gunAccentMat);
        handguard.position.set(0, 0.02, 0.55);
        group.add(handguard);
        const holoOptic = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.35), gunDarkMat);
        holoOptic.position.set(0, 0.24, -0.1);
        group.add(holoOptic);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.5), gunDarkMat);
        stock.position.set(0, -0.06, -0.7);
        group.add(stock);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.22), gunAccentMat);
        mag.position.set(0, -0.32, -0.2);
        mag.rotateX(-0.2);
        group.add(mag);
        break;
      }
      case 'shotgun': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 1.1), gunDarkMat);
        group.add(body);
        const doubleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.9, 12), gunMetalMat);
        doubleBarrel.rotateX(Math.PI / 2);
        doubleBarrel.position.set(0, 0.08, 0.85);
        group.add(doubleBarrel);
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.45), gunAccentMat);
        pump.position.set(0, -0.06, 0.65);
        group.add(pump);
        break;
      }
      case 'sniper': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 1.4), gunDarkMat);
        group.add(body);
        const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 12), gunMetalMat);
        longBarrel.rotateX(Math.PI / 2);
        longBarrel.position.set(0, 0.06, 1.3);
        group.add(longBarrel);
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 12), gunAccentMat);
        scope.rotateX(Math.PI / 2);
        scope.position.set(0, 0.26, 0.1);
        group.add(scope);
        break;
      }
      case 'rocket': {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 16), gunDarkMat);
        tube.rotateX(Math.PI / 2);
        tube.position.set(0, 0.05, 0.3);
        group.add(tube);
        const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.08), gunAccentMat);
        shieldPlate.position.set(0, 0.05, 0.7);
        group.add(shieldPlate);
        break;
      }
      case 'smg': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.8), gunDarkMat);
        group.add(body);
        const shortBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 12), gunMetalMat);
        shortBarrel.rotateX(Math.PI / 2);
        shortBarrel.position.set(0, 0.04, 0.5);
        group.add(shortBarrel);
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.16), gunAccentMat);
        mag.position.set(0, -0.32, 0.1);
        group.add(mag);
        break;
      }
    }

    return group;
  }, []);

  // Switch Weapon Slot
  const handleSelectWeapon = useCallback((idx: number) => {
    if (idx < 0 || idx >= weaponsRef.current.length) return;
    setActiveWeaponIdx(idx);
    sounds.playShield();
  }, []);

  const handleSelectWeaponRef = useRef(handleSelectWeapon);
  useEffect(() => {
    handleSelectWeaponRef.current = handleSelectWeapon;
  }, [handleSelectWeapon]);

  // Update weapon 3D mesh when active weapon or rarity changes
  useEffect(() => {
    if (!playerLimbsRef.current?.weaponMount) return;
    const mount = playerLimbsRef.current.weaponMount;
    mount.clear();
    const currentW = weapons[activeWeaponIdx] || weapons[0];
    const newMesh = buildWeaponMesh(currentW.id, currentW.rarity);
    mount.add(newMesh);
  }, [activeWeaponIdx, weapons[activeWeaponIdx]?.id, weapons[activeWeaponIdx]?.rarity, buildWeaponMesh]);

  // Manual Quick Weapon Reload (R Key or Click)
  const handleQuickReload = useCallback(() => {
    const currentW = activeWeaponRef.current;
    if (!currentW || isReloading) return;
    if (currentW.currentAmmo >= currentW.maxAmmo) {
      setFeedbackBanner({ text: `${currentW.name} magazine is already full!`, type: 'info' });
      return;
    }

    setIsReloading(true);
    sounds.playShield();
    addCombatTextRef.current(`RELOADING... [R]`, false);
    setFeedbackBanner({
      text: `🔄 Reloading ${currentW.name}... Answer questions below to earn Mastery Points for weapon upgrades!`,
      type: 'info',
    });

    setTimeout(() => {
      setWeapons((prev) =>
        prev.map((w, idx) =>
          idx === activeWeaponIdx ? { ...w, currentAmmo: w.maxAmmo } : w
        )
      );
      setIsReloading(false);
      sounds.playSuccess();
      addCombatTextRef.current(`MAGAZINE RELOADED!`, false);
    }, 750);
  }, [activeWeaponIdx, isReloading]);

  const handleQuickReloadRef = useRef(handleQuickReload);
  useEffect(() => {
    handleQuickReloadRef.current = handleQuickReload;
  }, [handleQuickReload]);

  // Player Manual Shooting
  const shootPlayerLaser = useCallback(() => {
    if (
      isDefeatedRef.current ||
      isVictoryRef.current ||
      !playerGroupRef.current ||
      !sceneRef.current ||
      !cameraRef.current ||
      isReloading
    ) {
      return;
    }

    const currentW = activeWeaponRef.current;
    if (!currentW || !currentW.isUnlocked) return;

    const now = performance.now();
    if (now - lastShotTimeRef.current < currentW.fireCooldownMs) return;

    // Check Ammo
    if (currentW.currentAmmo <= 0) {
      sounds.playError();
      setFeedbackBanner({
        text: `⚠️ 弹药耗尽 (Out of Ammo)! Press [R] to reload, or answer '${currentQRef.current.hanzi}' (${currentQRef.current.pinyin}) below!`,
        type: 'error',
      });
      return;
    }

    lastShotTimeRef.current = now;

    // Decrement ammo
    setWeapons((prev) =>
      prev.map((w, idx) =>
        idx === activeWeaponIdx ? { ...w, currentAmmo: Math.max(0, w.currentAmmo - 1) } : w
      )
    );

    // Muzzle flash
    if (playerLimbsRef.current?.muzzleFlashMesh) {
      const flash = playerLimbsRef.current.muzzleFlashMesh;
      flash.visible = true;
      flash.scale.set(1.4, 1.4, 1.4);
      setTimeout(() => {
        if (flash) flash.visible = false;
      }, 50);
    }

    const camera = cameraRef.current;
    const scene = sceneRef.current;

    // Crosshair Ray
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const targetPoint = raycaster.ray.origin
      .clone()
      .add(raycaster.ray.direction.clone().multiplyScalar(90));

    const weaponOrigin = playerGroupRef.current.position.clone().add(new THREE.Vector3(0.5, 1.6, 0.8));
    const fireDirection = targetPoint.clone().sub(weaponOrigin).normalize();

    const pelletCount = currentW.pellets || 1;
    for (let p = 0; p < pelletCount; p++) {
      const spreadDir = fireDirection.clone();
      if (pelletCount > 1) {
        spreadDir.x += (Math.random() - 0.5) * 0.07;
        spreadDir.y += (Math.random() - 0.5) * 0.07;
        spreadDir.z += (Math.random() - 0.5) * 0.07;
        spreadDir.normalize();
      }

      const bGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
      bGeo.rotateX(Math.PI / 2);
      const bMat = new THREE.MeshBasicMaterial({ color: currentW.bulletColor });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.copy(weaponOrigin);
      bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spreadDir);
      scene.add(bMesh);

      bulletsRef.current.push({
        mesh: bMesh,
        direction: spreadDir,
        speed: currentW.bulletSpeed,
        life: 55,
        isPlayer: true,
        damage: currentW.damage,
        isExplosive: currentW.isExplosive,
      });
    }

    sounds.playDamage();
  }, [activeWeaponIdx, isReloading]);

  const shootPlayerLaserRef = useRef(shootPlayerLaser);
  useEffect(() => {
    shootPlayerLaserRef.current = shootPlayerLaser;
  }, [shootPlayerLaser]);

  // MANDARIN QUESTION ANSWERING: EARNS MASTERY POINTS & FORGES UPGRADES
  const handleAnswerQuestion = (idx: number) => {
    if (answerState !== 'idle' || isVictory || isDefeated) return;

    setSelectedAnswer(idx);
    const isCorrect = idx === currentQ.correctIndex;

    if (isCorrect) {
      setAnswerState('correct');

      const baseMult = multiplierRemaining > 0 ? 2 : 1;
      const currentMult = Math.min(4, baseMult + Math.floor(streak / 3));
      const coinsEarned = 25 * currentMult;

      setStreak((s) => s + 1);
      setMultiplierRemaining((m) => Math.max(0, m - 1));

      // Shield replenish (+25)
      playerShieldRef.current = Math.min(100, playerShieldRef.current + 25);
      setPlayerShield(playerShieldRef.current);

      const currentW = weapons[activeWeaponIdx];
      const nextProgress = currentW.upgradeProgress + 1;
      const didLevelUp = nextProgress >= currentW.upgradeTarget;

      if (didLevelUp) {
        sounds.playVictory();
        const nextRarity: WeaponRarity =
          currentW.rarity === 'common'
            ? 'rare'
            : currentW.rarity === 'rare'
            ? 'epic'
            : currentW.rarity === 'epic'
            ? 'legendary'
            : 'mythic';

        const nextTier = Math.min(5, currentW.tier + 1);
        const nextTarget = currentW.upgradeTarget + 2; // Each tier requires more answers (3 -> 5 -> 7 -> 9)

        setWeapons((prev) =>
          prev.map((w, wIdx) => {
            if (wIdx === activeWeaponIdx) {
              return {
                ...w,
                currentAmmo: Math.round(w.maxAmmo * 1.2),
                maxAmmo: Math.round(w.maxAmmo * 1.2),
                damage: Math.round(w.damage * 1.2),
                stars: Math.min(5, w.stars + 1),
                rarity: nextRarity,
                tier: nextTier,
                upgradeProgress: 0,
                upgradeTarget: nextTarget,
              };
            }
            return { ...w, currentAmmo: w.maxAmmo };
          })
        );

        addCombatTextRef.current(`⭐ ${currentW.name} TIER ${nextTier}! ⭐`, true);
        setFeedbackBanner({
          text: `🎉 TACTICAL ASCENSION! ${currentW.name} forged to ${nextRarity.toUpperCase()} (Tier ${nextTier})! +20% Damage & Capacity!`,
          type: 'success',
        });
      } else {
        sounds.playSuccess();
        setWeapons((prev) =>
          prev.map((w, wIdx) => {
            if (wIdx === activeWeaponIdx) {
              return {
                ...w,
                currentAmmo: w.maxAmmo, // Full reload
                upgradeProgress: nextProgress,
              };
            }
            return { ...w, currentAmmo: w.maxAmmo };
          })
        );

        addCombatTextRef.current(`+1 MASTERY (${nextProgress}/${currentW.upgradeTarget})`, false);
        setFeedbackBanner({
          text: `太棒了！ Correct! [${nextProgress}/${currentW.upgradeTarget} Mastery Points to Upgrade ${currentW.name}] · Ammo Reloaded!`,
          type: 'success',
        });
      }

      onUpdatePlayerRef.current((prev) => ({
        ...prev,
        xp: prev.xp + 35,
        vCoins: prev.vCoins + coinsEarned,
        highestStreak: Math.max(prev.highestStreak, streak + 1),
      }));

      setTimeout(() => {
        setQuestionIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        setAnswerState('idle');
        setEliminatedOptions([]);
        setShowRadicalHint(false);
      }, 1200);
    } else {
      setAnswerState('wrong');
      sounds.playError();
      setStreak(0);

      // Wrong answer penalty: lose 1 upgrade progress point!
      setWeapons((prev) =>
        prev.map((w, wIdx) => {
          if (wIdx === activeWeaponIdx) {
            return {
              ...w,
              upgradeProgress: Math.max(0, w.upgradeProgress - 1),
            };
          }
          return w;
        })
      );

      setFeedbackBanner({
        text: `加油！ Correct: ${currentQ.options[currentQ.correctIndex]} (${currentQ.pinyin}). -1 Upgrade Progress!`,
        type: 'error',
      });

      setTimeout(() => {
        setSelectedAnswer(null);
        setAnswerState('idle');
      }, 1500);
    }
  };

  // Gimkit In-Game Power-Up Shop (Rebalanced prices)
  const handleBuyCombatPowerUp = (pu: PowerUpItem) => {
    if (player.vCoins < pu.cost) {
      sounds.playError();
      setFeedbackBanner({ text: 'Not enough V-Coins! Answer Mandarin questions to earn coins!', type: 'error' });
      return;
    }

    sounds.playVictory();
    onUpdatePlayerRef.current((prev) => ({
      ...prev,
      vCoins: prev.vCoins - pu.cost,
    }));

    switch (pu.type) {
      case 'shield':
        playerShieldRef.current = Math.min(100, playerShieldRef.current + 50);
        setPlayerShield(playerShieldRef.current);
        addCombatTextRef.current('+50 SHIELD!', false);
        setFeedbackBanner({ text: 'Super Shield Applied (+50 Shield)!', type: 'success' });
        break;
      case 'heal':
        playerHpRef.current = Math.min(100, playerHpRef.current + 60);
        setPlayerHp(playerHpRef.current);
        addCombatTextRef.current('+60 HEALTH!', false);
        setFeedbackBanner({ text: 'Medkit Applied (+60 Health)!', type: 'success' });
        break;
      case 'multiplier':
        setMultiplierRemaining(4);
        setFeedbackBanner({ text: '2X Score & Coin Multiplier Activated for 4 answers!', type: 'success' });
        break;
      case 'freeze':
        setIsStormFrozen(true);
        setFeedbackBanner({ text: 'Storm Circle Frozen for 15 seconds!', type: 'success' });
        setTimeout(() => setIsStormFrozen(false), 15000);
        break;
      case 'radar':
        const wrongIdxs = currentQ.options
          .map((_, i) => i)
          .filter((i) => i !== currentQ.correctIndex);
        setEliminatedOptions(wrongIdxs.slice(0, 2));
        setFeedbackBanner({ text: 'Radar 50/50 eliminated 2 wrong answers!', type: 'success' });
        break;
    }
  };

  // -------------------------------------------------------------------------
  // THREE.JS SCENE SETUP & GAME LOOP
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;

    // 1. Scene & Atmosphere
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1122);
    scene.fog = new THREE.FogExp2(0x0e172a, 0.0035);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 900);
    cameraRef.current = camera;

    // 2. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.replaceChildren(renderer.domElement);

    // 3. Cinematic Lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.7);
    hemiLight.position.set(0, 80, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.4);
    sunLight.position.set(60, 90, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 280;
    sunLight.shadow.camera.left = -110;
    sunLight.shadow.camera.right = 110;
    sunLight.shadow.camera.top = 110;
    sunLight.shadow.camera.bottom = -110;
    scene.add(sunLight);

    // 4. Battle Royale Island Terrain
    const islandRadius = 180;
    const islandGeo = new THREE.CylinderGeometry(islandRadius, islandRadius + 12, 10, 64);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.8,
      metalness: 0.1,
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -5;
    island.receiveShadow = true;
    scene.add(island);

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.15,
        metalness: 0.6,
        transparent: true,
        opacity: 0.85,
      })
    );
    ocean.rotateX(-Math.PI / 2);
    ocean.position.y = -5.8;
    scene.add(ocean);

    // 5. 3D Purple Storm Cylinder
    const stormGeo = new THREE.CylinderGeometry(160, 160, 100, 48, 1, true);
    const stormMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const stormMesh = new THREE.Mesh(stormGeo, stormMat);
    stormMesh.position.y = 50;
    scene.add(stormMesh);
    stormMeshRef.current = stormMesh;

    // 6. BUILDINGS, CLIMBABLE RAMPS & PROPS
    const buildingGroup = new THREE.Group();
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.85 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.7, roughness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.7, roughness: 0.4 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6, roughness: 0.4 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.1,
    });

    const obstacles: ObstacleBox[] = [];
    const ramps: RampCollider[] = [];

    // BUILDING A: Tilted Towers Multi-Story Apartment (-42, 0, 32)
    const aptGroup = new THREE.Group();
    const aptMain = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 18), brickMat);
    aptMain.position.set(0, 5, 0);
    aptMain.castShadow = true;
    aptMain.receiveShadow = true;
    aptGroup.add(aptMain);

    for (let floor = 1; floor <= 2; floor++) {
      for (let w = -2; w <= 2; w++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.2), windowMat);
        win.position.set(w * 3.6, floor * 3.4, 9.1);
        aptGroup.add(win);
        const winBack = win.clone();
        winBack.position.z = -9.1;
        aptGroup.add(winBack);
      }
    }

    const aptRoof = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.6, 18.4), concreteMat);
    aptRoof.position.set(0, 10.3, 0);
    aptGroup.add(aptRoof);

    const acUnit = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 3.5), metalMat);
    acUnit.position.set(-5, 11.4, -4);
    acUnit.castShadow = true;
    aptGroup.add(acUnit);

    const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3, 16), woodMat);
    waterTank.position.set(5, 13, 4);
    aptGroup.add(waterTank);

    aptGroup.position.set(-42, 0, 32);
    buildingGroup.add(aptGroup);
    obstacles.push({ minX: -52, maxX: -32, minZ: 23, maxZ: 41, height: 10 });

    // Climbable Ramp to Apartment Roof
    const aptRampGeo = new THREE.BoxGeometry(6, 0.4, 14.5);
    aptRampGeo.rotateX(Math.atan2(10, 13));
    const aptRamp = new THREE.Mesh(aptRampGeo, woodMat);
    aptRamp.position.set(-42, 5.0, 16.5);
    aptRamp.castShadow = true;
    aptRamp.receiveShadow = true;
    buildingGroup.add(aptRamp);

    ramps.push({
      minX: -46,
      maxX: -38,
      minZ: 9.5,
      maxZ: 23.5,
      axis: 'z',
      startCoord: 10.0,
      endCoord: 23.0,
      baseHeight: 0,
      topHeight: 10,
    });

    // BUILDING B: Clocktower Citadel (-36, 0, -30)
    const towerGroup = new THREE.Group();
    const towerBody = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 16), concreteMat);
    towerBody.position.set(0, 6, 0);
    towerBody.castShadow = true;
    towerBody.receiveShadow = true;
    towerGroup.add(towerBody);

    for (let r = 0; r < 4; r++) {
      const clockMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 0.3, 24),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      clockMesh.rotateX(Math.PI / 2);
      clockMesh.rotateZ(r * (Math.PI / 2));
      const dist = 8.15;
      if (r === 0) clockMesh.position.set(0, 8.5, dist);
      if (r === 1) clockMesh.position.set(dist, 8.5, 0);
      if (r === 2) clockMesh.position.set(0, 8.5, -dist);
      if (r === 3) clockMesh.position.set(-dist, 8.5, 0);
      towerGroup.add(clockMesh);
    }

    const battlement = new THREE.Mesh(new THREE.BoxGeometry(17, 1.5, 17), brickMat);
    battlement.position.set(0, 12.5, 0);
    towerGroup.add(battlement);

    towerGroup.position.set(-36, 0, -30);
    buildingGroup.add(towerGroup);
    obstacles.push({ minX: -44, maxX: -28, minZ: -38, maxZ: -22, height: 12 });

    // Ramp to Clocktower Deck
    const towerRampGeo = new THREE.BoxGeometry(14, 0.4, 6);
    towerRampGeo.rotateZ(-Math.atan2(12, 13));
    const towerRamp = new THREE.Mesh(towerRampGeo, woodMat);
    towerRamp.position.set(-21.5, 6.0, -30);
    towerRamp.castShadow = true;
    towerRamp.receiveShadow = true;
    buildingGroup.add(towerRamp);

    ramps.push({
      minX: -28.5,
      maxX: -14.5,
      minZ: -34,
      maxZ: -26,
      axis: 'x',
      startCoord: -15,
      endCoord: -28,
      baseHeight: 0,
      topHeight: 12,
    });

    // BUILDING C: Red Dog Tactical Armory & Gas Station (38, 0, 20)
    const armoryGroup = new THREE.Group();
    const garageBody = new THREE.Mesh(new THREE.BoxGeometry(18, 6.5, 16), metalMat);
    garageBody.position.set(0, 3.25, 0);
    garageBody.castShadow = true;
    garageBody.receiveShadow = true;
    armoryGroup.add(garageBody);

    const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 10), redMat);
    canopyRoof.position.set(0, 5.5, 13);
    armoryGroup.add(canopyRoof);

    armoryGroup.position.set(38, 0, 20);
    buildingGroup.add(armoryGroup);
    obstacles.push({ minX: 29, maxX: 47, minZ: 12, maxZ: 28, height: 6.5 });

    const armoryRampGeo = new THREE.BoxGeometry(6, 0.4, 9.5);
    armoryRampGeo.rotateX(-Math.atan2(6.5, 8.5));
    const armoryRamp = new THREE.Mesh(armoryRampGeo, woodMat);
    armoryRamp.position.set(38, 3.25, 7.5);
    armoryRamp.castShadow = true;
    buildingGroup.add(armoryRamp);

    ramps.push({
      minX: 34,
      maxX: 42,
      minZ: 3.0,
      maxZ: 12.0,
      axis: 'z',
      startCoord: 3.5,
      endCoord: 12.0,
      baseHeight: 0,
      topHeight: 6.5,
    });

    // BUILDING D: Shipping Containers Hub (26, 0, -28)
    const cont1 = new THREE.Mesh(new THREE.BoxGeometry(7, 3.8, 16), blueMat);
    cont1.position.set(22, 1.9, -28);
    cont1.castShadow = true;
    buildingGroup.add(cont1);
    obstacles.push({ minX: 18.5, maxX: 25.5, minZ: -36, maxZ: -20, height: 3.8 });

    const cont2 = new THREE.Mesh(new THREE.BoxGeometry(7, 3.8, 16), redMat);
    cont2.position.set(22, 5.7, -28);
    cont2.castShadow = true;
    buildingGroup.add(cont2);
    obstacles.push({ minX: 18.5, maxX: 25.5, minZ: -36, maxZ: -20, height: 7.6 });

    const cont3 = new THREE.Mesh(new THREE.BoxGeometry(16, 3.8, 7), yellowMat);
    cont3.position.set(34, 1.9, -28);
    cont3.castShadow = true;
    buildingGroup.add(cont3);
    obstacles.push({ minX: 26, maxX: 42, minZ: -31.5, maxZ: -24.5, height: 3.8 });

    const contRampGeo = new THREE.BoxGeometry(5.5, 0.4, 6.5);
    contRampGeo.rotateX(Math.atan2(3.8, 5.5));
    const contRamp = new THREE.Mesh(contRampGeo, woodMat);
    contRamp.position.set(34, 1.9, -19.5);
    contRamp.castShadow = true;
    buildingGroup.add(contRamp);

    ramps.push({
      minX: 31,
      maxX: 37,
      minZ: -24.5,
      maxZ: -16.5,
      axis: 'z',
      startCoord: -17.0,
      endCoord: -24.5,
      baseHeight: 0,
      topHeight: 3.8,
    });

    // BUILDING E: Central Tactical 45-Degree Fortnite Build Ramps
    const midPlat = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 6), woodMat);
    midPlat.position.set(0, 3.75, 14);
    buildingGroup.add(midPlat);
    obstacles.push({ minX: -3, maxX: 3, minZ: 11, maxZ: 17, height: 4.0 });

    const midRampGeo = new THREE.BoxGeometry(6, 0.4, 6.8);
    midRampGeo.rotateX(Math.atan2(4.0, 5.5));
    const midRamp = new THREE.Mesh(midRampGeo, woodMat);
    midRamp.position.set(0, 2.0, 8.0);
    midRamp.castShadow = true;
    buildingGroup.add(midRamp);

    ramps.push({
      minX: -3.5,
      maxX: 3.5,
      minZ: 5.0,
      maxZ: 11.2,
      axis: 'z',
      startCoord: 5.2,
      endCoord: 11.0,
      baseHeight: 0,
      topHeight: 4.0,
    });

    scene.add(buildingGroup);
    obstaclesRef.current = obstacles;
    rampsRef.current = ramps;

    // 7. PINE TREES, FOLIAGE & BOULDERS
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x582a0b, roughness: 0.9 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });

    for (let t = 0; t < 36; t++) {
      const angle = (t / 36) * Math.PI * 2 + Math.sin(t * 1.5) * 0.4;
      const dist = 55 + (t % 5) * 18;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3.5, 8), trunkMat);
      trunk.position.y = 1.75;
      trunk.castShadow = true;
      tree.add(trunk);

      for (let lvl = 0; lvl < 3; lvl++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(3.2 - lvl * 0.7, 3.0, 8),
          pineMat
        );
        cone.position.y = 3.2 + lvl * 1.8;
        cone.castShadow = true;
        tree.add(cone);
      }

      tree.position.set(tx, 0, tz);
      scene.add(tree);

      if (t % 3 === 0) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8 + Math.random(), 1), rockMat);
        rock.position.set(tx + 6, 1.0, tz + 4);
        rock.castShadow = true;
        scene.add(rock);
      }
    }

    // 8. INTERACTIVE LOOT PICKUPS
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
    });
    const chestGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.6,
    });
    const slurpMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0x0891b2,
      emissiveIntensity: 0.7,
    });
    const ammoMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      metalness: 0.6,
      roughness: 0.4,
      emissive: 0x4d7c0f,
      emissiveIntensity: 0.4,
    });

    const pickups: GoldCoinPickup3D[] = [];

    const spawnPickup = (x: number, y: number, z: number, type: 'coin' | 'chest' | 'ammo' | 'slurp') => {
      const g = new THREE.Group();
      let mainMesh: THREE.Mesh | THREE.Group;

      if (type === 'coin') {
        const coinG = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.25, 24), goldMat);
        disc.rotateX(Math.PI / 2);
        coinG.add(disc);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.08, 12, 32), chestGoldMat);
        coinG.add(rim);
        mainMesh = coinG;
      } else if (type === 'chest') {
        const chestG = new THREE.Group();
        const cBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 1.4), chestGoldMat);
        cBase.position.y = 0.55;
        chestG.add(cBase);
        const cLid = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.0, 16, 1, false, 0, Math.PI), chestGoldMat);
        cLid.rotateZ(Math.PI / 2);
        cLid.position.set(0, 1.1, 0);
        chestG.add(cLid);
        mainMesh = chestG;
      } else if (type === 'slurp') {
        const slurpKeg = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.4, 16), slurpMat);
        slurpKeg.position.y = 0.7;
        mainMesh = slurpKeg;
      } else {
        const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), ammoMat);
        ammoBox.position.y = 0.45;
        mainMesh = ammoBox;
      }

      g.add(mainMesh);

      const beaconGeo = new THREE.CylinderGeometry(0.12, 0.7, 18, 16, 1, true);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: type === 'slurp' ? 0x22d3ee : type === 'ammo' ? 0x84cc16 : 0xfbbf24,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 9;
      g.add(beacon);

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 1.7, 24),
        new THREE.MeshBasicMaterial({
          color: type === 'slurp' ? 0x38bdf8 : type === 'ammo' ? 0xa3e635 : 0xfde047,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
        })
      );
      halo.rotateX(Math.PI / 2);
      halo.position.y = 0.1;
      g.add(halo);

      g.position.set(x, y, z);
      scene.add(g);

      pickups.push({
        group: g,
        coinMesh: mainMesh,
        beaconMesh: beacon,
        haloMesh: halo,
        baseY: y,
        x,
        z,
        collected: false,
        type,
      });
    };

    spawnPickup(-42, 10.3, 32, 'chest'); // Rooftop Chest!
    spawnPickup(-36, 12.5, -30, 'coin'); // Clocktower Balcony
    spawnPickup(38, 6.5, 20, 'ammo');    // Armory Roof
    spawnPickup(22, 5.7, -28, 'slurp');  // Shipping Container Roof
    spawnPickup(0, 3.75, 14, 'slurp');   // Center Ramp Platform
    spawnPickup(-20, 0.4, 18, 'coin');
    spawnPickup(18, 0.4, 8, 'coin');
    spawnPickup(-14, 0.4, -18, 'coin');
    spawnPickup(12, 0.4, 25, 'ammo');

    goldPickupsRef.current = pickups;

    // 9. HIGH-FIDELITY FORTNITE PLAYER CHARACTER
    const pGroup = new THREE.Group();
    playerGroupRef.current = pGroup;

    const suitMat = new THREE.MeshStandardMaterial({
      color: equippedSkin?.accentColor ? parseInt(equippedSkin.accentColor.replace('#', '0x')) : 0x0284c7,
      metalness: 0.6,
      roughness: 0.35,
    });
    const armorDarkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, 0.55), suitMat);
    torso.position.y = 1.7;
    torso.castShadow = true;
    pGroup.add(torso);

    const arcCore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16), visorMat);
    arcCore.rotateX(Math.PI / 2);
    arcCore.position.set(0, 1.85, 0.29);
    pGroup.add(arcCore);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), armorDarkMat);
    head.position.y = 2.65;
    head.castShadow = true;
    pGroup.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.2), visorMat);
    visor.position.set(0, 2.65, 0.28);
    pGroup.add(visor);

    const legGeo = new THREE.CylinderGeometry(0.18, 0.15, 1.15, 8);
    const leftLeg = new THREE.Mesh(legGeo, armorDarkMat);
    leftLeg.position.set(-0.3, 0.6, 0);
    leftLeg.castShadow = true;
    pGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, armorDarkMat);
    rightLeg.position.set(0.3, 0.6, 0);
    rightLeg.castShadow = true;
    pGroup.add(rightLeg);

    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.58, 2.05, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), suitMat);
    leftArmMesh.position.set(0.1, -0.4, 0.3);
    leftArmMesh.rotation.x = -Math.PI / 4;
    leftArmGroup.add(leftArmMesh);
    pGroup.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.58, 2.05, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.24), suitMat);
    rightArmMesh.position.set(-0.1, -0.35, 0.35);
    rightArmMesh.rotation.x = -Math.PI / 3.5;
    rightArmGroup.add(rightArmMesh);
    pGroup.add(rightArmGroup);

    const weaponMount = new THREE.Group();
    weaponMount.position.set(0.45, 1.7, 0.65);
    const curW = weaponsRef.current[0];
    const initialGunMesh = buildWeaponMesh(curW.id, curW.rarity);
    weaponMount.add(initialGunMesh);

    const flashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.9 })
    );
    flashMesh.position.set(0, 0.05, 1.4);
    flashMesh.visible = false;
    weaponMount.add(flashMesh);
    pGroup.add(weaponMount);

    playerLimbsRef.current = {
      leftLeg,
      rightLeg,
      leftArmGroup,
      rightArmGroup,
      weaponMount,
      muzzleFlashMesh: flashMesh,
    };

    pGroup.position.set(0, 0, 0);
    scene.add(pGroup);

    // 10. DYNAMIC ENEMY SQUAD GENERATOR FOR 10 ESCALATING LEVELS
    const spawnWaveSquad = (waveNum: number) => {
      enemiesRef.current.forEach((bot) => scene.remove(bot.group));
      enemiesRef.current = [];

      const levelIndex = Math.min(waveNum - 1, WAVE_LEVELS.length - 1);
      const levelCfg = WAVE_LEVELS[levelIndex] || WAVE_LEVELS[0];

      const enemyList: EnemyBot3D[] = [];

      // Dynamic bot spawns around key tactical locations
      const tacticalSpawnPoints = [
        { name: 'Scout Bot', x: 28, z: 22, isBoss: false, scale: 0.9, hp: 50 + waveNum * 12, speed: 0.055 },
        { name: 'Assault Mecha', x: -28, z: -18, isBoss: false, scale: 1.0, hp: 70 + waveNum * 16, speed: 0.05 },
        { name: 'Container Flanker', x: 24, z: -22, isBoss: false, scale: 1.05, hp: 80 + waveNum * 18, speed: 0.058 },
        { name: 'Heavy Trooper', x: -30, z: 25, isBoss: false, scale: 1.15, hp: 95 + waveNum * 22, speed: 0.042 },
        { name: 'Rooftop Sniper', x: -36, z: -28, isBoss: false, scale: 1.0, hp: 75 + waveNum * 15, speed: 0.048 },
        { name: 'Syndicate Shockbot', x: 38, z: 25, isBoss: false, scale: 1.05, hp: 85 + waveNum * 20, speed: 0.06 },
        { name: 'Cyber Enforcer', x: 0, z: -25, isBoss: false, scale: 1.1, hp: 100 + waveNum * 25, speed: 0.05 },
        { name: 'Bunker Guard', x: 35, z: 12, isBoss: false, scale: 1.08, hp: 90 + waveNum * 20, speed: 0.045 },
        { name: 'Clocktower Stalker', x: -22, z: -35, isBoss: false, scale: 1.0, hp: 80 + waveNum * 18, speed: 0.055 },
        { name: 'Apartment Raider', x: -44, z: 20, isBoss: false, scale: 1.12, hp: 110 + waveNum * 28, speed: 0.048 },
        { name: 'Apex Vanguard', x: 15, z: 32, isBoss: false, scale: 1.15, hp: 120 + waveNum * 30, speed: 0.052 },
        { name: 'Shadow Shinobi', x: -15, z: 12, isBoss: false, scale: 0.95, hp: 85 + waveNum * 20, speed: 0.065 },
        { name: 'Dread Drone', x: 30, z: -35, isBoss: false, scale: 0.9, hp: 70 + waveNum * 15, speed: 0.06 },
      ];

      // Add regular squad bots up to levelCfg.botCount - 1
      const regularCount = Math.min(levelCfg.botCount - 1, tacticalSpawnPoints.length);
      for (let i = 0; i < regularCount; i++) {
        const cfg = tacticalSpawnPoints[i];
        createBotMesh(cfg.name, cfg.hp, cfg.speed, cfg.x, cfg.z, false, cfg.scale, enemyList);
      }

      // Add the Boss
      createBotMesh(levelCfg.bossName, levelCfg.bossHp, 0.045, 0, -36, true, 1.5, enemyList);

      enemiesRef.current = enemyList;
      setTotalEnemiesInWave(enemyList.length);
      setEnemiesEliminated(0);
      setIsVictory(false);
      setStormRadius(levelCfg.stormRadius);
      setStormSeconds(levelCfg.stormSeconds);
    };

    const createBotMesh = (
      name: string,
      hp: number,
      speed: number,
      x: number,
      z: number,
      isBoss: boolean,
      scale: number,
      targetList: EnemyBot3D[]
    ) => {
      const eGroup = new THREE.Group();
      const eMat = new THREE.MeshStandardMaterial({
        color: isBoss ? 0xdc2626 : 0x475569,
        metalness: 0.8,
        roughness: 0.3,
      });

      const bTorso = new THREE.Mesh(new THREE.BoxGeometry(1.0 * scale, 1.4 * scale, 0.7 * scale), eMat);
      bTorso.position.y = 1.9 * scale;
      bTorso.castShadow = true;
      eGroup.add(bTorso);

      const bCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.3 * scale, 12, 12),
        new THREE.MeshStandardMaterial({
          color: isBoss ? 0xff0000 : 0xf59e0b,
          emissive: isBoss ? 0xff0000 : 0xf59e0b,
          emissiveIntensity: 0.8,
        })
      );
      bCore.position.set(0, 1.9 * scale, 0.38 * scale);
      eGroup.add(bCore);

      const bLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.14 * scale, 1.3 * scale, 8), eMat);
      bLegL.position.set(-0.35 * scale, 0.65 * scale, 0);
      eGroup.add(bLegL);

      const bLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.14 * scale, 1.3 * scale, 8), eMat);
      bLegR.position.set(0.35 * scale, 0.65 * scale, 0);
      eGroup.add(bLegR);

      // Overhead HP bar sprite
      const hpCanvas = document.createElement('canvas');
      hpCanvas.width = 140;
      hpCanvas.height = 36;
      const hpCtx = hpCanvas.getContext('2d')!;
      hpCtx.fillStyle = '#0f172a';
      hpCtx.fillRect(0, 0, 140, 36);
      hpCtx.fillStyle = isBoss ? '#ef4444' : '#f59e0b';
      hpCtx.fillRect(2, 2, 136, 32);
      hpCtx.fillStyle = '#ffffff';
      hpCtx.font = 'bold 14px sans-serif';
      hpCtx.textAlign = 'center';
      hpCtx.fillText(name, 70, 24);

      const hpMap = new THREE.CanvasTexture(hpCanvas);
      const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpMap }));
      hpSprite.position.set(0, 3.9 * scale, 0);
      hpSprite.scale.set(2.6 * scale, 0.65 * scale, 1);
      eGroup.add(hpSprite);

      eGroup.position.set(x, 0, z);
      scene.add(eGroup);

      targetList.push({
        id: name + Math.random(),
        name,
        group: eGroup,
        leftLeg: bLegL,
        rightLeg: bLegR,
        hp,
        maxHp: hp,
        speed,
        fireCooldown: 70 + Math.random() * 50,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        strafeTimer: 50,
        isBoss,
        walkCycle: 0,
      });
    };

    spawnWaveRef.current = spawnWaveSquad;
    spawnWaveSquad(1);

    // 11. KEYBOARD & MOUSE CONTROLS
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }
      keysRef.current[e.key.toLowerCase()] = true;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isGroundedRef.current) {
          playerVelocityY.current = 14.5;
          isGroundedRef.current = false;
          sounds.playShield();
        }
      }

      if (e.code === 'KeyR' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleQuickReloadRef.current();
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5) {
        handleSelectWeaponRef.current(num - 1);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    const handleWindowBlur = () => {
      keysRef.current = {};
    };

    const handleCanvasClick = () => {
      if (!document.pointerLockElement) {
        container.requestPointerLock?.();
      } else {
        shootPlayerLaserRef.current();
      }
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === container;
      setIsPointerLocked(locked);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== container) return;
      const sensitivity = 0.0022;
      mouseLookRef.current.yaw -= e.movementX * sensitivity;
      mouseLookRef.current.pitch -= e.movementY * sensitivity;
      mouseLookRef.current.pitch = Math.max(-0.9, Math.min(0.85, mouseLookRef.current.pitch));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    container.addEventListener('click', handleCanvasClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('mousemove', handleMouseMove);

    // 12. RENDER LOOP
    let animId: number;
    let lastTime = performance.now();
    let walkAnimCycle = 0;

    const renderLoop = (time: number) => {
      animId = requestAnimationFrame(renderLoop);

      const dt = Math.min((time - lastTime) / 1000, 0.08);
      lastTime = time;

      // Storm animation
      if (stormMeshRef.current) {
        const curR = THREE.MathUtils.damp(stormMeshRef.current.scale.x, stormRadiusRef.current / 160, 4, dt);
        stormMeshRef.current.scale.set(curR, 1, curR);
        stormMeshRef.current.rotation.y += dt * 0.15;
      }

      // Collectible pick up animations
      goldPickupsRef.current.forEach((cp) => {
        if (cp.collected) return;
        cp.group.rotation.y += dt * 2.2;
        cp.coinMesh.position.y = cp.baseY + Math.sin(time * 0.003 + cp.x) * 0.35;
      });

      // Player Movement & Ramp Physics
      if (pGroup && !isDefeatedRef.current) {
        const keys = keysRef.current;
        const camYaw = mouseLookRef.current.yaw;
        const pitch = mouseLookRef.current.pitch;

        const forward = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
        const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (keys['w'] || keys['arrowup']) moveDir.add(forward);
        if (keys['s'] || keys['arrowdown']) moveDir.sub(forward);
        if (keys['a'] || keys['arrowleft']) moveDir.sub(right);
        if (keys['d'] || keys['arrowright']) moveDir.add(right);

        const isMoving = moveDir.lengthSq() > 0.001;
        let nextX = pGroup.position.x;
        let nextZ = pGroup.position.z;

        if (isMoving) {
          moveDir.normalize();
          const speed = 14.5 * dt;
          nextX = pGroup.position.x + moveDir.x * speed;
          nextZ = pGroup.position.z + moveDir.z * speed;

          walkAnimCycle += dt * 11;
          if (playerLimbsRef.current) {
            playerLimbsRef.current.leftLeg.rotation.x = Math.sin(walkAnimCycle) * 0.45;
            playerLimbsRef.current.rightLeg.rotation.x = -Math.sin(walkAnimCycle) * 0.45;
          }
        } else {
          if (playerLimbsRef.current) {
            playerLimbsRef.current.leftLeg.rotation.x = THREE.MathUtils.damp(
              playerLimbsRef.current.leftLeg.rotation.x,
              0,
              14,
              dt
            );
            playerLimbsRef.current.rightLeg.rotation.x = THREE.MathUtils.damp(
              playerLimbsRef.current.rightLeg.rotation.x,
              0,
              14,
              dt
            );
          }
        }

        // Ramp Collision
        let rampGroundHeight: number | null = null;
        for (const ramp of rampsRef.current) {
          if (
            nextX >= ramp.minX - 0.4 &&
            nextX <= ramp.maxX + 0.4 &&
            nextZ >= ramp.minZ - 0.4 &&
            nextZ <= ramp.maxZ + 0.4
          ) {
            const coord = ramp.axis === 'z' ? nextZ : nextX;
            const t = (coord - ramp.startCoord) / (ramp.endCoord - ramp.startCoord);
            if (t >= -0.08 && t <= 1.08) {
              const clampedT = Math.max(0, Math.min(1, t));
              const expectedY = ramp.baseHeight + clampedT * (ramp.topHeight - ramp.baseHeight);
              if (pGroup.position.y >= expectedY - 1.2 && pGroup.position.y <= expectedY + 2.6) {
                rampGroundHeight = expectedY;
                break;
              }
            }
          }
        }

        // Building Box Collision
        let boxGroundHeight = 0;
        let canMove = true;

        for (const box of obstaclesRef.current) {
          const isInside =
            nextX >= box.minX - 0.4 &&
            nextX <= box.maxX + 0.4 &&
            nextZ >= box.minZ - 0.4 &&
            nextZ <= box.maxZ + 0.4;

          if (isInside) {
            if (pGroup.position.y >= box.height - 0.75) {
              boxGroundHeight = Math.max(boxGroundHeight, box.height);
            } else {
              canMove = false;
            }
          }
        }

        if (canMove || rampGroundHeight !== null) {
          pGroup.position.x = nextX;
          pGroup.position.z = nextZ;
        }

        const effectiveGround = rampGroundHeight !== null ? rampGroundHeight : boxGroundHeight;

        playerVelocityY.current -= 36.0 * dt;
        pGroup.position.y += playerVelocityY.current * dt;

        if (pGroup.position.y <= effectiveGround) {
          pGroup.position.y = effectiveGround;
          playerVelocityY.current = 0;
          isGroundedRef.current = true;
        }

        if (playerLimbsRef.current?.weaponMount) {
          playerLimbsRef.current.weaponMount.rotation.x = pitch * 0.85;
        }

        pGroup.rotation.y = THREE.MathUtils.damp(pGroup.rotation.y, camYaw + Math.PI, 22, dt);

        pGroup.position.x = Math.max(-170, Math.min(170, pGroup.position.x));
        pGroup.position.z = Math.max(-170, Math.min(170, pGroup.position.z));

        // Throttled storm tick
        const now = performance.now();
        if (now - lastStormTickRef.current > 1000) {
          lastStormTickRef.current = now;
          const distFromCenter = Math.hypot(pGroup.position.x, pGroup.position.z);
          if (distFromCenter > stormRadiusRef.current && !isStormFrozenRef.current) {
            const nextHp = Math.max(0, playerHpRef.current - 6);
            playerHpRef.current = nextHp;
            setPlayerHp(nextHp);
            sounds.playDamage();
            addCombatTextRef.current('-6 STORM DMG', false);
            if (nextHp <= 0 && !isDefeatedRef.current) {
              isDefeatedRef.current = true;
              setIsDefeated(true);
            }
          }
        }

        // Camera Follow
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        const lookDir = new THREE.Vector3(
          -Math.sin(camYaw) * cosPitch,
          sinPitch,
          -Math.cos(camYaw) * cosPitch
        ).normalize();

        const camArmDist = 6.2;
        const rightShoulderOffset = right.clone().multiplyScalar(1.65);
        const playerHead = pGroup.position.clone().add(new THREE.Vector3(0, 2.0, 0));

        const targetCamPos = playerHead
          .clone()
          .add(rightShoulderOffset)
          .sub(lookDir.clone().multiplyScalar(camArmDist));

        targetCamPos.y = Math.max(effectiveGround + 1.4, targetCamPos.y);

        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamPos.x, 22, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamPos.y, 22, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamPos.z, 22, dt);

        const lookTarget = playerHead.clone().add(rightShoulderOffset.clone().multiplyScalar(0.4)).add(lookDir.clone().multiplyScalar(35));
        camera.lookAt(lookTarget);

        // Loot Pickups
        goldPickupsRef.current.forEach((cp) => {
          if (cp.collected) return;
          const dist = Math.hypot(pGroup.position.x - cp.x, pGroup.position.z - cp.z);
          const yDist = Math.abs(pGroup.position.y - cp.baseY);

          if (dist < 2.5 && yDist < 3.2) {
            cp.collected = true;
            scene.remove(cp.group);
            sounds.playSuccess();

            if (cp.type === 'chest') {
              playerShieldRef.current = 100;
              setPlayerShield(100);
              setWeapons((prev) => prev.map((w) => ({ ...w, currentAmmo: w.maxAmmo })));
              onUpdatePlayerRef.current((prev) => ({
                ...prev,
                vCoins: prev.vCoins + 60,
                xp: prev.xp + 50,
              }));
              addCombatTextRef.current(`🏆 CHEST! +60 V-COINS!`, true);
              setFeedbackBanner({
                text: '🏆 Opened Loot Chest! +60 V-Coins · 100% Shield · Weapons Reloaded!',
                type: 'success',
              });
            } else if (cp.type === 'slurp') {
              playerShieldRef.current = Math.min(100, playerShieldRef.current + 35);
              setPlayerShield(playerShieldRef.current);
              addCombatTextRef.current(`+35 SHIELD!`, false);
              setFeedbackBanner({ text: '🥤 Slurp Keg Consumed (+35 Shield)!', type: 'success' });
            } else if (cp.type === 'ammo') {
              setWeapons((prev) => prev.map((w) => ({ ...w, currentAmmo: w.maxAmmo })));
              onUpdatePlayerRef.current((prev) => ({ ...prev, vCoins: prev.vCoins + 20 }));
              addCombatTextRef.current(`ALL WEAPONS RELOADED!`, false);
              setFeedbackBanner({ text: '📦 Tactical Ammo Crate! Weapons reloaded + 20 V-Coins!', type: 'success' });
            } else {
              onUpdatePlayerRef.current((prev) => ({
                ...prev,
                vCoins: prev.vCoins + 35,
                xp: prev.xp + 25,
              }));
              addCombatTextRef.current(`+35 V-COINS!`, true);
              setFeedbackBanner({ text: '🪙 Golden Medallion (+35 V-Coins)!', type: 'success' });
            }
          }
        });

        // Shield Drops from Eliminated Bots
        potionDropsRef.current.forEach((pot) => {
          if (pot.collected) return;
          if (pGroup.position.distanceTo(pot.group.position) < 2.4) {
            pot.collected = true;
            scene.remove(pot.group);
            sounds.playShield();
            playerShieldRef.current = Math.min(100, playerShieldRef.current + 25);
            setPlayerShield(playerShieldRef.current);
            addCombatTextRef.current('+25 SHIELD!', false);
          }
        });
      }

      // Update Bullets
      bulletsRef.current = bulletsRef.current.filter((b) => {
        b.life -= dt * 60;
        b.mesh.position.addScaledVector(b.direction, b.speed * dt);

        if (b.life <= 0) {
          scene.remove(b.mesh);
          return false;
        }

        if (checkBulletObstacleHit(b.mesh.position)) {
          scene.remove(b.mesh);
          return false;
        }

        // Bullet Hit Player
        if (!b.isPlayer && pGroup && !isDefeatedRef.current) {
          const playerCenter = pGroup.position.clone().add(new THREE.Vector3(0, 1.4, 0));
          if (b.mesh.position.distanceTo(playerCenter) < 1.45) {
            sounds.playDamage();
            scene.remove(b.mesh);

            const curShield = playerShieldRef.current;
            const curHp = playerHpRef.current;
            const leftoverDmg = Math.max(0, b.damage - curShield);
            const nextShield = Math.max(0, curShield - b.damage);
            const nextHp = Math.max(0, curHp - leftoverDmg);

            playerShieldRef.current = nextShield;
            playerHpRef.current = nextHp;
            setPlayerShield(nextShield);
            setPlayerHp(nextHp);

            if (nextHp <= 0 && !isDefeatedRef.current) {
              isDefeatedRef.current = true;
              setIsDefeated(true);
            }
            return false;
          }
        }

        // Bullet Hit Enemy Bot
        if (b.isPlayer) {
          for (let i = 0; i < enemiesRef.current.length; i++) {
            const bot = enemiesRef.current[i];
            const botCenter = bot.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));

            if (b.mesh.position.distanceTo(botCenter) < (bot.isBoss ? 2.5 : 1.7)) {
              bot.hp -= b.damage;
              sounds.playDamage();
              addCombatTextRef.current(`-${b.damage}`, true);
              scene.remove(b.mesh);

              if (bot.hp <= 0) {
                scene.remove(bot.group);
                enemiesRef.current.splice(i, 1);
                sounds.playVictory();

                setEnemiesEliminated((k) => k + 1);
                onUpdatePlayerRef.current((prev) => ({
                  ...prev,
                  xp: prev.xp + 45,
                  vCoins: prev.vCoins + 35,
                }));

                const potGroup = new THREE.Group();
                const potMesh = new THREE.Mesh(
                  new THREE.CylinderGeometry(0.35, 0.45, 0.8, 12),
                  new THREE.MeshStandardMaterial({
                    color: 0x06b6d4,
                    emissive: 0x06b6d4,
                    emissiveIntensity: 0.6,
                  })
                );
                potGroup.add(potMesh);
                potGroup.position.copy(botCenter);
                potGroup.position.y = 0.4;
                scene.add(potGroup);
                potionDropsRef.current.push({ group: potGroup, collected: false });

                addCombatTextRef.current(`☠️ ELIMINATED ${bot.name}!`, true);
                setFeedbackBanner({
                  text: `☠️ Eliminated ${bot.name}! Shield Drop + 35 V-Coins!`,
                  type: 'success',
                });

                if (enemiesRef.current.length === 0) {
                  setIsVictory(true);
                }
              }
              return false;
            }
          }
        }

        return true;
      });

      // Update Bots AI
      enemiesRef.current.forEach((bot) => {
        if (!pGroup) return;

        const distToPlayer = bot.group.position.distanceTo(pGroup.position);
        if (distToPlayer < 95) {
          const toPlayer = new THREE.Vector3().subVectors(pGroup.position, bot.group.position).normalize();

          bot.strafeTimer -= dt * 60;
          if (bot.strafeTimer <= 0) {
            bot.strafeDir = Math.random() > 0.5 ? 1 : -1;
            bot.strafeTimer = 40 + Math.random() * 40;
          }

          const strafeVec = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(bot.strafeDir * 0.05);

          if (distToPlayer > 20) {
            bot.group.position.addScaledVector(toPlayer, bot.speed);
          }
          bot.group.position.add(strafeVec);

          bot.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

          bot.walkCycle += dt * 8;
          bot.leftLeg.rotation.x = Math.sin(bot.walkCycle) * 0.4;
          bot.rightLeg.rotation.x = -Math.sin(bot.walkCycle) * 0.4;

          bot.fireCooldown -= dt * 60;
          if (bot.fireCooldown <= 0 && distToPlayer < 65) {
            bot.fireCooldown = 85 + Math.random() * 55;

            const enemyBulletOrigin = bot.group.position.clone().add(new THREE.Vector3(0, 1.6, 0));
            const enemyFireDir = new THREE.Vector3().subVectors(pGroup.position, bot.group.position).normalize();
            enemyFireDir.x += (Math.random() - 0.5) * 0.09;
            enemyFireDir.z += (Math.random() - 0.5) * 0.09;
            enemyFireDir.normalize();

            const ebGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
            ebGeo.rotateX(Math.PI / 2);
            const ebMat = new THREE.MeshBasicMaterial({ color: bot.isBoss ? 0xef4444 : 0xf59e0b });
            const ebMesh = new THREE.Mesh(ebGeo, ebMat);
            ebMesh.position.copy(enemyBulletOrigin);
            ebMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), enemyFireDir);
            scene.add(ebMesh);

            bulletsRef.current.push({
              mesh: ebMesh,
              direction: enemyFireDir,
              speed: 45,
              life: 55,
              isPlayer: false,
              damage: bot.isBoss ? 20 : 10,
            });
          }
        }
      });

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      container.removeEventListener('click', handleCanvasClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Advance to Next Level (1 to 10)
  const handleNextWave = () => {
    const nextW = currentWave + 1;
    setCurrentWave(nextW);
    setPlayerHp(100);
    setPlayerShield(75);
    playerHpRef.current = 100;
    playerShieldRef.current = 75;
    setIsVictory(false);

    const levelCfg = WAVE_LEVELS[Math.min(currentWave - 1, WAVE_LEVELS.length - 1)];
    const bonusCoins = levelCfg?.rewardCoins || 150;

    onUpdatePlayerRef.current((prev) => ({
      ...prev,
      arenaVictories: prev.arenaVictories + 1,
      vCoins: prev.vCoins + bonusCoins,
      xp: prev.xp + 100,
    }));

    spawnWaveRef.current(nextW);
    addCombatTextRef.current(`🚨 LEVEL ${nextW} ENGAGED! 🚨`, true);
    setFeedbackBanner({
      text: `🚨 ADVANCED TO LEVEL ${nextW}! +${bonusCoins} V-Coins Bonus! Eliminate all rivals to conquer the island!`,
      type: 'info',
    });
  };

  const handleRestartBattle = () => {
    setPlayerHp(100);
    setPlayerShield(50);
    playerHpRef.current = 100;
    playerShieldRef.current = 50;
    setIsDefeated(false);
    setStormRadius(160);
    setStormSeconds(45);
    spawnWaveRef.current(currentWave);
  };

  const hpPercent = Math.max(0, Math.min(100, Math.round(playerHp)));
  const shieldPercent = Math.max(0, Math.min(100, Math.round(playerShield)));
  const activeW = weapons[activeWeaponIdx] || weapons[0];
  const currentWaveConfig = WAVE_LEVELS[Math.min(currentWave - 1, WAVE_LEVELS.length - 1)] || WAVE_LEVELS[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
      {/* 3D FORTNITE WORLD VIEWPORT */}
      <div className="relative bg-slate-950 border-2 border-cyan-500/40 rounded-3xl overflow-hidden shadow-2xl h-[500px] md:h-[600px]">
        {/* Three.js Canvas Container */}
        <div ref={mountRef} className="w-full h-full cursor-crosshair" />

        {/* 100% UNOBSTRUCTED CENTER CROSSHAIR */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-8 h-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-cyan-400 shadow-[0_0_5px_#22d3ee]" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-cyan-400 shadow-[0_0_5px_#22d3ee]" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-2.5 bg-cyan-400 shadow-[0_0_5px_#22d3ee]" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-2.5 bg-cyan-400 shadow-[0_0_5px_#22d3ee]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
          </div>
        </div>

        {/* FLOATING COMBAT TEXT */}
        {floatingTexts.map((txt) => (
          <div
            key={txt.id}
            style={{ left: `${txt.x}px`, top: `${txt.y}px` }}
            className={`absolute pointer-events-none font-black text-lg transition-all animate-bounce drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
              txt.isCrit ? 'text-amber-400 text-xl' : 'text-cyan-300'
            }`}
          >
            {txt.text}
          </div>
        ))}

        {/* FEEDBACK BANNER */}
        {feedbackBanner && (
          <div
            className={`absolute top-16 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-xs md:text-sm font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md transition-all z-20 ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                : feedbackBanner.type === 'error'
                ? 'bg-rose-950/90 text-rose-300 border border-rose-500/50'
                : 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50'
            }`}
          >
            {feedbackBanner.text}
          </div>
        )}

        {/* TOP STATUS BAR: Level, Storm, and Rivals Counter */}
        <div className="absolute top-4 inset-x-4 flex justify-between items-start pointer-events-none z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <div className="bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-cyan-500/50 text-cyan-300 text-xs font-black shadow-lg">
              <span className="text-amber-400 mr-1.5">⚡ LEVEL {currentWave}/10:</span>
              <span className="text-white">{currentWaveConfig.title.split(': ')[1] || 'Battle Island'}</span>
            </div>
            <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-purple-500/40 text-purple-300 text-xs font-black shadow-lg flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
              <span>STORM: {stormSeconds}s</span>
              <span className="text-[10px] text-purple-400/80">({Math.round(stormRadius)}m)</span>
            </div>
            <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-rose-500/40 text-rose-300 text-xs font-black shadow-lg">
              {totalEnemiesInWave - enemiesEliminated} RIVALS LEFT
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-amber-500/40 text-amber-300 text-xs font-black shadow-lg flex items-center gap-1.5">
              <span>🪙</span>
              <span>{player.vCoins} V-COINS</span>
            </div>
            <button
              onClick={() => setIsShopOpen(true)}
              className="pointer-events-auto bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              🛒 SHOP
            </button>
          </div>
        </div>

        {/* OUT OF AMMO ALERT */}
        {activeW.currentAmmo <= 0 && (
          <div className="absolute top-28 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-2 bg-rose-950/90 border-2 border-rose-500 px-6 py-3 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.4)] animate-pulse z-30">
            <div className="text-white font-black text-sm tracking-wide flex items-center gap-2">
              <span>⚠️</span>
              <span>OUT OF AMMO!</span>
            </div>
            <div className="text-xs text-rose-200 text-center font-medium">
              Press <span className="font-bold underline text-white">[R]</span> for quick reload, or answer Mandarin below to earn <span className="font-bold text-amber-300">WEAPON UPGRADE POINTS</span>!
            </div>
            <button
              onClick={handleQuickReload}
              className="mt-1 px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs tracking-wider transition-all"
            >
              QUICK RELOAD NOW [R]
            </button>
          </div>
        )}

        {/* BOTTOM-LEFT: FORTNITE HEALTH & SHIELD */}
        <div className="absolute bottom-4 left-4 z-10 w-64 md:w-72 space-y-1.5 pointer-events-none drop-shadow-md">
          <div className="relative h-5 bg-slate-900/90 rounded-lg overflow-hidden border border-cyan-500/50 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300 shadow-[0_0_12px_#22d3ee]"
              style={{ width: `${shieldPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-2.5 text-[11px] font-black text-white">
              <span className="flex items-center gap-1">🛡️ SHIELD</span>
              <span>{shieldPercent} / 100</span>
            </div>
          </div>

          <div className="relative h-5 bg-slate-900/90 rounded-lg overflow-hidden border border-emerald-500/50 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300 shadow-[0_0_12px_#10b981]"
              style={{ width: `${hpPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-2.5 text-[11px] font-black text-white">
              <span className="flex items-center gap-1">❤️ HEALTH</span>
              <span>{hpPercent} / 100</span>
            </div>
          </div>
        </div>

        {/* BOTTOM-RIGHT: 5-SLOT WEAPON INVENTORY HOTBAR WITH UPGRADE STATUS */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 pointer-events-auto">
          {weapons.map((w, idx) => {
            const isCur = idx === activeWeaponIdx;
            const rConfig = RARITY_COLORS[w.rarity];
            const progressPercent = Math.min(100, (w.upgradeProgress / w.upgradeTarget) * 100);

            return (
              <button
                key={w.id}
                onClick={() => handleSelectWeapon(idx)}
                className={`relative flex flex-col items-center justify-between p-1.5 rounded-xl border-2 transition-all w-14 md:w-16 h-18 shadow-lg backdrop-blur-md ${
                  isCur
                    ? `${rConfig.border} ${rConfig.bg} scale-105 shadow-[0_0_15px_${rConfig.glow}]`
                    : 'border-slate-800 bg-slate-900/70 opacity-70 hover:opacity-100 hover:border-slate-600'
                }`}
              >
                <div className="w-full flex justify-between items-center text-[10px] font-black text-slate-400">
                  <span className="bg-slate-950/80 px-1 rounded text-cyan-400">{idx + 1}</span>
                  <span className="text-[9px] uppercase tracking-tighter text-amber-300">
                    {'★'.repeat(w.stars)}
                  </span>
                </div>

                <div className="text-[10px] font-black text-center truncate w-full text-slate-200">
                  {w.name.split(' ')[0]}
                </div>

                <div className="text-[10px] font-black text-cyan-300">
                  {w.currentAmmo}/{w.maxAmmo}
                </div>

                {/* Upgrade progress mini-bar */}
                <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {isCur && (
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-cyan-400 border border-slate-950 shadow-sm" />
                )}
              </button>
            );
          })}

          <button
            onClick={handleQuickReload}
            title="Press [R] to reload active weapon"
            className={`h-18 px-2.5 rounded-xl border-2 font-black text-[11px] flex flex-col items-center justify-center gap-0.5 shadow-lg transition-all ${
              isReloading
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-spin'
                : 'bg-slate-900/90 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 active:scale-95'
            }`}
          >
            <span>🔄</span>
            <span>[R]</span>
            <span className="text-[9px] uppercase">Reload</span>
          </button>
        </div>

        {/* POINTER LOCK INSTRUCTION OVERLAY */}
        {!isPointerLocked && !isVictory && !isDefeated && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center z-20 pointer-events-none p-6 text-center">
            <div className="bg-slate-900 border-2 border-cyan-500/60 p-6 rounded-3xl shadow-2xl max-w-md pointer-events-auto">
              <h3 className="text-xl font-black text-cyan-400 mb-1">DEPLOY TO BATTLE ISLAND</h3>
              <p className="text-xs text-amber-300 font-bold mb-3">
                {currentWaveConfig.title}
              </p>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Aim and shoot with your mouse. Use <span className="font-bold text-white">WASD</span> to sprint,{' '}
                <span className="font-bold text-white">SPACE</span> to climb 45° ramps, and answer Mandarin questions to forge weapon upgrades!
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div><span className="text-cyan-400 font-bold">W A S D</span> : Sprint</div>
                <div><span className="text-cyan-400 font-bold">SPACE</span> : Jump / Climb</div>
                <div><span className="text-cyan-400 font-bold">1 - 5</span> : Switch Guns</div>
                <div><span className="text-amber-400 font-bold">R Key</span> : Tactical Reload</div>
              </div>
              <button
                onClick={() => mountRef.current?.requestPointerLock?.()}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                ENTER BATTLE ROYALE
              </button>
            </div>
          </div>
        )}

        {/* VICTORY OVERLAY (Supports all 10 Waves + Grand Champion) */}
        {isVictory && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500 p-8 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.3)] max-w-md">
              <div className="text-5xl mb-2 animate-bounce">
                {currentWave >= 10 ? '👑' : '🏆'}
              </div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mb-1">
                {currentWave >= 10 ? 'GRAND SOVEREIGN CHAMPION!' : 'WAVE CONQUERED!'}
              </h2>
              <p className="text-sm font-bold text-cyan-300 mb-2">
                {currentWaveConfig.title} Cleared!
              </p>
              <p className="text-xs text-slate-300 mb-5">
                {currentWave >= 10
                  ? 'Incredible mastery! You conquered all 10 Battle Royale danger levels and mastered Mandarin combat arts!'
                  : `You defeated all squad bots and the ${currentWaveConfig.bossName}! Prepare for the next level!`}
              </p>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 mb-5 text-xs flex justify-around">
                <div>
                  <div className="text-slate-400 text-[10px]">REWARD</div>
                  <div className="text-amber-400 font-black">+{currentWaveConfig.rewardCoins} COINS</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">XP EARNED</div>
                  <div className="text-cyan-400 font-black">+100 XP</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">PROGRESS</div>
                  <div className="text-emerald-400 font-black">{currentWave}/10 LEVELS</div>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                {currentWave < 10 ? (
                  <button
                    onClick={handleNextWave}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
                  >
                    Deploy to Level {currentWave + 1} →
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setCurrentWave(1);
                      handleRestartBattle();
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
                  >
                    Play Again (Prestige Loop) 🔁
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DEFEAT OVERLAY */}
        {isDefeated && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-rose-500 p-8 rounded-3xl shadow-[0_0_50px_rgba(244,63,94,0.3)] max-w-md">
              <div className="text-5xl mb-2">☠️</div>
              <h2 className="text-2xl font-black text-rose-400 mb-1">ELIMINATED</h2>
              <p className="text-xs text-slate-300 mb-4">
                You fell in battle on {currentWaveConfig.title}. Remember to climb high-ground ramps and answer questions below to upgrade your weapons!
              </p>
              <button
                onClick={handleRestartBattle}
                className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 text-white font-black text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                RETRY LEVEL {currentWave}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MANDARIN MASTERY & WEAPON FORGE STATION (Upgrades Require Chinese Learning!) */}
      <div className="bg-slate-900/90 border-2 border-cyan-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        {/* Active Weapon Upgrade Progress Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3 mb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wide">
                MANDARIN WEAPON FORGE & TACTICAL STATION
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${RARITY_COLORS[activeW.rarity].border} ${RARITY_COLORS[activeW.rarity].text} bg-slate-950`}>
                {activeW.rarity} · TIER {activeW.tier}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Answer Mandarin questions correctly to earn <span className="text-amber-300 font-bold">Mastery Points</span>. Reach the target to ascend {activeW.name} to the next tier! Wrong answers deduct 1 point!
            </p>
          </div>

          {/* Active Weapon Upgrade Pips */}
          <div className="flex items-center gap-3 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-mono">Upgrade Progress</div>
              <div className="text-xs font-black text-amber-300">
                {activeW.upgradeProgress} / {activeW.upgradeTarget} Points
              </div>
            </div>
            {/* Visual Pip Indicators */}
            <div className="flex items-center gap-1">
              {Array.from({ length: activeW.upgradeTarget }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-md border transition-all ${
                    i < activeW.upgradeProgress
                      ? 'bg-amber-400 border-amber-300 shadow-[0_0_8px_#f59e0b]'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mandarin Question Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => speakChinese(currentQ.hanzi)}
              className="w-11 h-11 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-xl border border-cyan-500/40 transition-all active:scale-95"
              title="Pronounce audio"
            >
              🔊
            </button>
            <div>
              <div className="text-2xl font-black text-white tracking-wider flex items-center gap-2">
                <span>{currentQ.hanzi}</span>
                {showPinyin && (
                  <span className="text-sm font-semibold text-cyan-400">({currentQ.pinyin})</span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                  {currentQ.category}
                </span>
              </div>
              <div className="text-xs text-slate-400">Choose the correct English translation to charge your weapon:</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setShowRadicalHint(!showRadicalHint)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-all text-[11px] font-bold"
            >
              💡 {showRadicalHint ? 'Hide Hint' : 'Radical Hint'}
            </button>
            <button
              onClick={() => setShowPinyin(!showPinyin)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all text-[11px]"
            >
              {showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
            </button>
          </div>
        </div>

        {/* Radical / Etymology Hint Card */}
        {showRadicalHint && currentQ.explanation && (
          <div className="mb-3 p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center gap-2">
            <span>💡</span>
            <span>{currentQ.explanation}</span>
          </div>
        )}

        {/* 4 Multi-Choice Tactical Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {currentQ.options.map((opt, idx) => {
            const isEliminated = eliminatedOptions.includes(idx);
            const isSelected = selectedAnswer === idx;
            const isCorrect = idx === currentQ.correctIndex;

            let btnStyle = 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700';

            if (isSelected) {
              if (answerState === 'correct') {
                btnStyle = 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_#10b981]';
              } else if (answerState === 'wrong') {
                btnStyle = 'bg-rose-600 border-rose-400 text-white';
              }
            } else if (answerState !== 'idle' && isCorrect) {
              btnStyle = 'bg-emerald-600/50 border-emerald-400 text-white';
            }

            return (
              <button
                key={idx}
                disabled={isEliminated || answerState !== 'idle'}
                onClick={() => handleAnswerQuestion(idx)}
                className={`p-3 rounded-xl border-2 font-bold text-xs text-left transition-all flex items-center justify-between ${btnStyle} ${
                  isEliminated ? 'opacity-30 cursor-not-allowed' : 'active:scale-98'
                }`}
              >
                <span>{opt}</span>
                <span className="text-[10px] text-slate-400 bg-slate-900/60 px-1.5 py-0.5 rounded">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GIMKIT POWER-UP COMBAT SHOP MODAL */}
      {isShopOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-amber-300">TACTICAL POWER-UP SHOP</h3>
                <p className="text-xs text-slate-400">Earn V-Coins through Mandarin questions and wave victories</p>
              </div>
              <button
                onClick={() => setIsShopOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {POWER_UPS.map((pu) => {
                const canAfford = player.vCoins >= pu.cost;
                return (
                  <button
                    key={pu.id}
                    disabled={!canAfford}
                    onClick={() => handleBuyCombatPowerUp(pu)}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                      canAfford
                        ? 'border-amber-500/40 bg-slate-800/80 hover:border-amber-400 hover:bg-slate-800'
                        : 'border-slate-800 bg-slate-900/50 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-2xl">{pu.icon}</span>
                      <div>
                        <div className="text-xs font-black text-white">{pu.name}</div>
                        <div className="text-[10px] text-amber-400 font-bold">{pu.cost} V-Coins</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">{pu.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
