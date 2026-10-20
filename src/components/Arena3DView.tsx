import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { PlayerProfile, SkinItem, PowerUpItem, MandarinQuestion, MandarinTier } from '../types/game';
import { MANDARIN_QUESTIONS, POWER_UPS, MANDARIN_TIER_CONFIG, getAdaptiveQuestionsForPlayer, getQuestionDifficulty } from '../data/mandarinData';
import { sounds, speakChinese } from '../utils/audio';

interface Arena3DViewProps {
  player: PlayerProfile;
  equippedSkin?: SkinItem;
  onUpdatePlayer: React.Dispatch<React.SetStateAction<PlayerProfile>>;
  onOpenForge: () => void;
}

export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type WeaponId = 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'rocket';

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
  unlockLocation: string;
  stars: number;
  bulletSpeed: number;
  bulletColor: number;
  pellets?: number;
  isExplosive?: boolean;
  upgradeProgress: number; // Correct answers towards next tier
  upgradeTarget: number;   // Correct answers required for next tier
  tier: number;            // 1 to 5
}

export type EnemyType = 'drone' | 'heavy' | 'ninja' | 'boss';

interface EnemyBot3D {
  id: string;
  name: string;
  enemyType: EnemyType;
  group: THREE.Group;
  leftLeg?: THREE.Mesh;
  rightLeg?: THREE.Mesh;
  spinningRing?: THREE.Group;
  hoverProp?: THREE.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  fireCooldown: number;
  strafeDir: number;
  strafeTimer: number;
  isBoss: boolean;
  walkCycle: number;
  hoverHeight?: number;
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

interface WorldPickup3D {
  group: THREE.Group;
  coinMesh: THREE.Mesh | THREE.Group;
  beaconMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  baseY: number;
  x: number;
  z: number;
  collected: boolean;
  type: 'coin' | 'chest' | 'ammo' | 'slurp' | 'weapon_crate';
  weaponIdToUnlock?: WeaponId;
}

interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  roofPlatform?: boolean;
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
  bossType: EnemyType;
  bossHp: number;
  stormRadius: number;
  stormSeconds: number;
  rewardCoins: number;
}

export const WAVE_LEVELS: WaveLevelConfig[] = [
  {
    levelNumber: 1,
    title: 'Level 1: Recon Sentry Incursion',
    subtitle: 'Rival scout drones have parachuted into the outer perimeter. Eliminate the squad!',
    botCount: 4,
    bossName: 'Alpha Scout Sentry',
    bossType: 'drone',
    bossHp: 130,
    stormRadius: 180,
    stormSeconds: 50,
    rewardCoins: 120,
  },
  {
    levelNumber: 2,
    title: 'Level 2: Drone Swarm Patrol',
    subtitle: 'Hover drones and agile raiders are scanning the bamboo forest!',
    botCount: 5,
    bossName: 'Sky Striker Drone Ω',
    bossType: 'drone',
    bossHp: 180,
    stormRadius: 175,
    stormSeconds: 48,
    rewardCoins: 140,
  },
  {
    levelNumber: 3,
    title: 'Level 3: Cyber Vanguard Assault',
    subtitle: 'Armored vanguard cyborgs with heavy pulse blasters are advancing from the south!',
    botCount: 6,
    bossName: 'Vanguard Heavy Cyborg',
    bossType: 'heavy',
    bossHp: 240,
    stormRadius: 170,
    stormSeconds: 45,
    rewardCoins: 160,
  },
  {
    levelNumber: 4,
    title: 'Level 4: Urban High-Rise Siege',
    subtitle: 'Enemies have fortified the Skyline Apartment balconies and ramps. Watch high ground!',
    botCount: 7,
    bossName: 'Apartment Siege Commander',
    bossType: 'heavy',
    bossHp: 310,
    stormRadius: 165,
    stormSeconds: 42,
    rewardCoins: 180,
  },
  {
    levelNumber: 5,
    title: 'Level 5: Shadow Syndicate Shinobi',
    subtitle: 'Stealth cyber ninjas with high-speed dash attacks are flanking through the shadows!',
    botCount: 8,
    bossName: 'Shadow Shinobi Kurogane',
    bossType: 'ninja',
    bossHp: 380,
    stormRadius: 155,
    stormSeconds: 40,
    rewardCoins: 210,
  },
  {
    levelNumber: 6,
    title: 'Level 6: Power Substation Generator Breach',
    subtitle: 'Rivals are attempting to siphon the central generator power coils! Defend the catwalks!',
    botCount: 9,
    bossName: 'Volt Dynamo Titan',
    bossType: 'boss',
    bossHp: 460,
    stormRadius: 145,
    stormSeconds: 38,
    rewardCoins: 250,
  },
  {
    levelNumber: 7,
    title: 'Level 7: Tactical Armory Counter-Attack',
    subtitle: 'Heavily armored troops have seized the military supply depot. Retake the weapon caches!',
    botCount: 10,
    bossName: 'Warlord Ironclad',
    bossType: 'heavy',
    bossHp: 540,
    stormRadius: 135,
    stormSeconds: 36,
    rewardCoins: 290,
  },
  {
    levelNumber: 8,
    title: 'Level 8: Container Yard Crossfire',
    subtitle: 'Intense close-quarters combat among stacked shipping containers and sky cranes!',
    botCount: 11,
    bossName: 'Gantry Goliath',
    bossType: 'boss',
    bossHp: 620,
    stormRadius: 125,
    stormSeconds: 34,
    rewardCoins: 330,
  },
  {
    levelNumber: 9,
    title: 'Level 9: Sky Sentry Aerial Swarm',
    subtitle: 'Coordinated drone swarm with rapid plasma cannons. Keep moving and climb ramps!',
    botCount: 12,
    bossName: 'Overlord Sky Sentry',
    bossType: 'drone',
    bossHp: 700,
    stormRadius: 115,
    stormSeconds: 32,
    rewardCoins: 380,
  },
  {
    levelNumber: 10,
    title: 'Level 10: Sovereign Pagoda Defense',
    subtitle: 'The Sovereign Dragon Mecha has landed atop the sacred Pagoda! Defend the realm!',
    botCount: 13,
    bossName: 'Dragon Mecha Patriarch',
    bossType: 'boss',
    bossHp: 800,
    stormRadius: 105,
    stormSeconds: 30,
    rewardCoins: 450,
  },
  {
    levelNumber: 11,
    title: 'Level 11: Quantum Storm Surge',
    subtitle: 'The storm has energized with electric pulses! Elite cyber assassins advance!',
    botCount: 14,
    bossName: 'Quantum Assassin Zero',
    bossType: 'ninja',
    bossHp: 900,
    stormRadius: 95,
    stormSeconds: 28,
    rewardCoins: 520,
  },
  {
    levelNumber: 12,
    title: 'Level 12: Armored Dreadnought Battalion',
    subtitle: 'Full battalion offensive! Use your upgraded mythic weapons and Chinese math mastery!',
    botCount: 15,
    bossName: 'Dreadnought Apex',
    bossType: 'heavy',
    bossHp: 1020,
    stormRadius: 85,
    stormSeconds: 26,
    rewardCoins: 600,
  },
  {
    levelNumber: 13,
    title: 'Level 13: Neon Matrix Siege',
    subtitle: 'Enemies storm all 6 tactical zones simultaneously. High-intensity multi-front warfare!',
    botCount: 16,
    bossName: 'Matrix Sovereign Core',
    bossType: 'boss',
    bossHp: 1150,
    stormRadius: 80,
    stormSeconds: 25,
    rewardCoins: 700,
  },
  {
    levelNumber: 14,
    title: 'Level 14: Cataclysm Overlord Final Gate',
    subtitle: 'The penultimate gatekeeper! Extreme close-range combat on the elevated catwalks!',
    botCount: 17,
    bossName: 'Cataclysm Behemoth Ω',
    bossType: 'boss',
    bossHp: 1300,
    stormRadius: 75,
    stormSeconds: 24,
    rewardCoins: 850,
  },
  {
    levelNumber: 15,
    title: 'Level 15: The Supreme Cyber Dragon Sovereign Ω',
    subtitle: 'The ultimate climax! Conquer the Supreme Dragon Sovereign Ω to become Master of Battle Island!',
    botCount: 18,
    bossName: 'The Supreme Cyber Dragon Sovereign Ω',
    bossType: 'boss',
    bossHp: 1600,
    stormRadius: 70,
    stormSeconds: 22,
    rewardCoins: 1500,
  },
];

const RARITY_COLORS: Record<WeaponRarity, { border: string; bg: string; text: string; glow: string; hex: number }> = {
  common: { border: 'border-slate-500', bg: 'bg-slate-800/80', text: 'text-slate-300', glow: '#94a3b8', hex: 0x94a3b8 },
  rare: { border: 'border-blue-500', bg: 'bg-blue-950/80', text: 'text-blue-300', glow: '#3b82f6', hex: 0x3b82f6 },
  epic: { border: 'border-purple-500', bg: 'bg-purple-950/80', text: 'text-purple-300', glow: '#a855f7', hex: 0xa855f7 },
  legendary: { border: 'border-amber-500', bg: 'bg-amber-950/80', text: 'text-amber-300', glow: '#f59e0b', hex: 0xf59e0b },
  mythic: { border: 'border-rose-500', bg: 'bg-rose-950/80', text: 'text-rose-300', glow: '#f43f5e', hex: 0xf43f5e },
};

// PROGRESSION WEAPONS: START WITH ONE GUN (PISTOL), FIND OTHERS IN MAP CRATES!
const INITIAL_WEAPONS: WeaponSlot[] = [
  {
    id: 'pistol',
    slotNum: 1,
    name: 'Tactical Pulse Pistol',
    hanziName: '基础脉冲手枪',
    pinyinName: 'Jīchǔ Màichōng Shǒuqiāng',
    rarity: 'common',
    damage: 28,
    fireCooldownMs: 240,
    maxAmmo: 16,
    currentAmmo: 16,
    isUnlocked: true, // STARTS UNLOCKED!
    unlockLocation: 'Starting Arsenal',
    stars: 1,
    bulletSpeed: 100,
    bulletColor: 0x38bdf8,
    upgradeProgress: 0,
    upgradeTarget: 3,
    tier: 1,
  },
  {
    id: 'rifle',
    slotNum: 2,
    name: 'Storm Assault Rifle',
    hanziName: '风暴突击步枪',
    pinyinName: 'Fēngbào Tūjī Bùqiāng',
    rarity: 'rare',
    damage: 32,
    fireCooldownMs: 140,
    maxAmmo: 30,
    currentAmmo: 30,
    isUnlocked: false, // FIND IN ARMORY!
    unlockLocation: 'Armory Bunker Roof (军火库)',
    stars: 2,
    bulletSpeed: 110,
    bulletColor: 0x3b82f6,
    upgradeProgress: 0,
    upgradeTarget: 4,
    tier: 2,
  },
  {
    id: 'shotgun',
    slotNum: 3,
    name: 'Havoc Plasma Shotgun',
    hanziName: '重型离子散弹枪',
    pinyinName: 'Zhòngxíng Lízǐ Sǎndànqiāng',
    rarity: 'rare',
    damage: 75,
    fireCooldownMs: 700,
    maxAmmo: 6,
    currentAmmo: 6,
    isUnlocked: false, // FIND IN CONTAINER YARD!
    unlockLocation: 'Shipping Container Hub (货运码头)',
    stars: 2,
    bulletSpeed: 85,
    bulletColor: 0xf59e0b,
    pellets: 6,
    upgradeProgress: 0,
    upgradeTarget: 4,
    tier: 2,
  },
  {
    id: 'sniper',
    slotNum: 4,
    name: 'Thermal Void Sniper',
    hanziName: '虚空狙击枪',
    pinyinName: 'Xūkōng Jūjīqiāng',
    rarity: 'epic',
    damage: 110,
    fireCooldownMs: 1200,
    maxAmmo: 4,
    currentAmmo: 4,
    isUnlocked: false, // FIND IN PAGODA BALCONY!
    unlockLocation: 'Dragon Pagoda Balcony (龙之阁)',
    stars: 3,
    bulletSpeed: 170,
    bulletColor: 0xa855f7,
    upgradeProgress: 0,
    upgradeTarget: 5,
    tier: 3,
  },
  {
    id: 'rocket',
    slotNum: 5,
    name: 'Quantum Rocket Launcher',
    hanziName: '量子火箭筒',
    pinyinName: 'Liàngzǐ Huǒjiàn Tǒng',
    rarity: 'legendary',
    damage: 160,
    fireCooldownMs: 1700,
    maxAmmo: 3,
    currentAmmo: 3,
    isUnlocked: false, // FIND IN SUBSTATION CATWALK!
    unlockLocation: 'Power Substation Skybridge (能量站)',
    stars: 4,
    bulletSpeed: 60,
    bulletColor: 0xef4444,
    isExplosive: true,
    upgradeProgress: 0,
    upgradeTarget: 6,
    tier: 4,
  },
];

export const Arena3DView: React.FC<Arena3DViewProps> = ({
  player,
  equippedSkin,
  onUpdatePlayer,
  onOpenForge,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Progressive Danger Levels (1 to 15)
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
  const [nearbyChestPrompt, setNearbyChestPrompt] = useState<string | null>(null);

  // Weapon Hotbar & Active Weapon
  const [weapons, setWeapons] = useState<WeaponSlot[]>(INITIAL_WEAPONS);
  const [activeWeaponIdx, setActiveWeaponIdx] = useState<number>(0);

  // Mandarin & Chinese Math Answering State
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [feedbackBanner, setFeedbackBanner] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showPinyin, setShowPinyin] = useState<boolean>(true);
  const [showRadicalHint, setShowRadicalHint] = useState<boolean>(false);

  // Battle Royale Storm Circle
  const [stormRadius, setStormRadius] = useState<number>(180);
  const [stormSeconds, setStormSeconds] = useState<number>(50);
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
  const worldPickupsRef = useRef<WorldPickup3D[]>([]);
  const obstaclesRef = useRef<ObstacleBox[]>([]);
  const rampsRef = useRef<RampCollider[]>([]);
  const spawnWaveRef = useRef<(wave: number) => void>(() => {});
  const lastStormTickRef = useRef<number>(0);

  // Double Jump Mechanics
  const jumpsUsedRef = useRef<number>(0);
  const thrusterFlameMeshRef = useRef<THREE.Group | null>(null);

  // Player Limbs & Weapon Mount Refs
  const playerLimbsRef = useRef<{
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    leftArmGroup: THREE.Group;
    rightArmGroup: THREE.Group;
    torsoGroup: THREE.Group;
    weaponMount: THREE.Group;
    muzzleFlashMesh: THREE.Mesh;
    thrusterFlames: THREE.Group;
  } | null>(null);

  const stormRadiusRef = useRef(180);
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

  // Adaptive Question Pool based on current player's Mandarin Mastery Tier
  const playerTier: MandarinTier = player.mandarinMastery?.tier || 1;
  const recentMistakes = player.mandarinMastery?.recentMistakes || [];

  const [questionPool, setQuestionPool] = useState<MandarinQuestion[]>(() =>
    getAdaptiveQuestionsForPlayer(playerTier, recentMistakes)
  );

  // When player advances their Mandarin Mastery Tier, refresh the question pool with harder content!
  useEffect(() => {
    setQuestionPool(
      getAdaptiveQuestionsForPlayer(
        player.mandarinMastery?.tier || 1,
        player.mandarinMastery?.recentMistakes || []
      )
    );
  }, [player.mandarinMastery?.tier]);

  const currentQ: MandarinQuestion =
    questionPool[questionIndex % Math.max(1, questionPool.length)] || MANDARIN_QUESTIONS[0];
  const currentQRef = useRef(currentQ);
  useEffect(() => {
    currentQRef.current = currentQ;
  }, [currentQ]);

  // Auto-pronounce Chinese words/math on question change
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

  // High-Fidelity 3D Procedural Weapon Models
  const buildWeaponMesh = useCallback((wId: WeaponId, rarity?: WeaponRarity): THREE.Group => {
    const group = new THREE.Group();
    const rConfig = RARITY_COLORS[rarity || 'common'];
    const gunDarkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
    const gunAccentMat = new THREE.MeshStandardMaterial({
      color: rConfig.hex,
      metalness: 0.8,
      roughness: 0.25,
      emissive: rConfig.hex,
      emissiveIntensity: 0.45,
    });
    const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.95, roughness: 0.15 });

    switch (wId) {
      case 'pistol': {
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.75), gunDarkMat);
        slide.position.set(0, 0.12, 0.2);
        group.add(slide);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.16), gunAccentMat);
        grip.rotation.x = -0.3;
        grip.position.set(0, -0.12, -0.05);
        group.add(grip);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 12), gunMetalMat);
        barrel.rotateX(Math.PI / 2);
        barrel.position.set(0, 0.12, 0.45);
        group.add(barrel);
        const laserSight = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), gunAccentMat);
        laserSight.rotateX(Math.PI / 2);
        laserSight.position.set(0, 0.03, 0.35);
        group.add(laserSight);
        break;
      }
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
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.45), gunDarkMat);
        stock.position.set(0, -0.08, -0.6);
        group.add(stock);
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
        const bipod = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.06), gunDarkMat);
        bipod.position.set(0, -0.15, 0.9);
        group.add(bipod);
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
        const exhaust = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 12), gunAccentMat);
        exhaust.rotateX(-Math.PI / 2);
        exhaust.position.set(0, 0.05, -0.7);
        group.add(exhaust);
        break;
      }
    }

    return group;
  }, []);

  // Switch Weapon Slot
  const handleSelectWeapon = useCallback((idx: number) => {
    if (idx < 0 || idx >= weaponsRef.current.length) return;
    const targetW = weaponsRef.current[idx];
    if (!targetW.isUnlocked) {
      sounds.playError();
      setFeedbackBanner({
        text: `🔒 ${targetW.name} is LOCKED! Explore the island to find this weapon crate at: ${targetW.unlockLocation}!`,
        type: 'error',
      });
      return;
    }
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
    }, 700);
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
      .add(raycaster.ray.direction.clone().multiplyScalar(95));

    const weaponOrigin = playerGroupRef.current.position.clone().add(new THREE.Vector3(0.5, 1.6, 0.8));
    const fireDirection = targetPoint.clone().sub(weaponOrigin).normalize();

    const pelletCount = currentW.pellets || 1;
    for (let p = 0; p < pelletCount; p++) {
      const spreadDir = fireDirection.clone();
      if (pelletCount > 1) {
        spreadDir.x += (Math.random() - 0.5) * 0.08;
        spreadDir.y += (Math.random() - 0.5) * 0.08;
        spreadDir.z += (Math.random() - 0.5) * 0.08;
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

  // MANDARIN & CHINESE MATH ANSWERING: EARNS MASTERY POINTS & FORGES UPGRADES
  const handleAnswerQuestion = (idx: number) => {
    if (answerState !== 'idle' || isVictory || isDefeated) return;

    setSelectedAnswer(idx);
    const isCorrect = idx === currentQ.correctIndex;
    const currentMasteryTier: MandarinTier = player.mandarinMastery?.tier || 1;
    const tierCfg = MANDARIN_TIER_CONFIG[currentMasteryTier] || MANDARIN_TIER_CONFIG[1];

    if (isCorrect) {
      setAnswerState('correct');

      const baseMult = multiplierRemaining > 0 ? 2 : 1;
      const currentMult = Math.min(4, baseMult + Math.floor(streak / 3));
      const coinsEarned = 30 * currentMult;

      setStreak((s) => s + 1);
      setMultiplierRemaining((m) => Math.max(0, m - 1));

      // Shield replenish (+25)
      playerShieldRef.current = Math.min(100, playerShieldRef.current + 25);
      setPlayerShield(playerShieldRef.current);

      const nextConsecutive = (player.mandarinMastery?.consecutiveCorrect || 0) + 1;
      const nextTotalCorrect = (player.mandarinMastery?.correctAnswers || 0) + 1;
      const nextTotalAnswered = (player.mandarinMastery?.questionsAnswered || 0) + 1;

      // AUTOMATIC PROGRESSION: Check if player earned an Automatic Mandarin Progression Promotion!
      const shouldPromoteMandarin =
        currentMasteryTier < 5 &&
        (nextConsecutive >= tierCfg.requiredConsecutiveToPromote ||
          nextTotalCorrect >= tierCfg.requiredTotalCorrect);

      let promotedTier = currentMasteryTier;
      if (shouldPromoteMandarin) {
        promotedTier = (currentMasteryTier + 1) as MandarinTier;
        const nextTierCfg = MANDARIN_TIER_CONFIG[promotedTier];
        sounds.playVictory();
        addCombatTextRef.current(`🎓 MANDARIN PROMOTION! ${nextTierCfg.levelLabel.toUpperCase()}!`, true);
        setFeedbackBanner({
          text: `🎉 LEVEL UP IN CHINESE! ${player.name} promoted to ${nextTierCfg.title}! +${nextTierCfg.bonusCoinsOnPromotion} Bonus V-Coins! More advanced Chinese unlocked!`,
          type: 'success',
        });
      }

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
        const nextTarget = currentW.upgradeTarget + 2;

        setWeapons((prev) =>
          prev.map((w, wIdx) => {
            if (wIdx === activeWeaponIdx) {
              return {
                ...w,
                currentAmmo: Math.round(w.maxAmmo * 1.25),
                maxAmmo: Math.round(w.maxAmmo * 1.25),
                damage: Math.round(w.damage * 1.25),
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
        if (!shouldPromoteMandarin) {
          setFeedbackBanner({
            text: `🎉 TACTICAL ASCENSION! ${currentW.name} forged to ${nextRarity.toUpperCase()} (Tier ${nextTier})! +25% Damage & Capacity!`,
            type: 'success',
          });
        }
      } else if (!shouldPromoteMandarin) {
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

      // Update player profile with Mandarin Mastery progression & bonus coins
      const bonusPromotionCoins = shouldPromoteMandarin ? MANDARIN_TIER_CONFIG[promotedTier].bonusCoinsOnPromotion : 0;
      onUpdatePlayerRef.current((prev) => ({
        ...prev,
        xp: prev.xp + 40 + (shouldPromoteMandarin ? 120 : 0),
        vCoins: prev.vCoins + coinsEarned + bonusPromotionCoins,
        highestStreak: Math.max(prev.highestStreak, streak + 1),
        mandarinMastery: {
          tier: promotedTier,
          tierName: MANDARIN_TIER_CONFIG[promotedTier].title,
          questionsAnswered: nextTotalAnswered,
          correctAnswers: nextTotalCorrect,
          consecutiveCorrect: shouldPromoteMandarin ? 0 : nextConsecutive,
          recentMistakes: (prev.mandarinMastery?.recentMistakes || []).filter((id) => id !== currentQ.id),
          masteryPoints: (prev.mandarinMastery?.masteryPoints || 0) + 20 + (shouldPromoteMandarin ? 80 : 0),
        },
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

      // Wrong answer penalty: lose 1 upgrade progress point
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

      const nextTotalAnswered = (player.mandarinMastery?.questionsAnswered || 0) + 1;
      onUpdatePlayerRef.current((prev) => ({
        ...prev,
        mandarinMastery: {
          tier: prev.mandarinMastery?.tier || 1,
          tierName: prev.mandarinMastery?.tierName || 'Tier 1: Initiate (基础初级 - HSK 1)',
          questionsAnswered: nextTotalAnswered,
          correctAnswers: prev.mandarinMastery?.correctAnswers || 0,
          consecutiveCorrect: 0,
          recentMistakes: [
            ...(prev.mandarinMastery?.recentMistakes || []).filter((id) => id !== currentQ.id),
            currentQ.id,
          ].slice(-8),
          masteryPoints: Math.max(0, (prev.mandarinMastery?.masteryPoints || 0) - 5),
        },
      }));

      setFeedbackBanner({
        text: `加油！ Correct: ${currentQ.options[currentQ.correctIndex]} (${currentQ.pinyin}). Reviewing in spaced repetition!`,
        type: 'error',
      });

      setTimeout(() => {
        setSelectedAnswer(null);
        setAnswerState('idle');
      }, 1500);
    }
  };

  // Gimkit In-Game Power-Up Shop
  const handleBuyCombatPowerUp = (pu: PowerUpItem) => {
    if (player.vCoins < pu.cost) {
      sounds.playError();
      setFeedbackBanner({ text: 'Not enough V-Coins! Answer Mandarin & Math questions to earn coins!', type: 'error' });
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
    scene.background = new THREE.Color(0x0a1128);
    scene.fog = new THREE.FogExp2(0x0e172a, 0.0032);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // 2. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.replaceChildren(renderer.domElement);

    // 3. Cinematic Studio & Outdoor Lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.75);
    hemiLight.position.set(0, 90, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.45);
    sunLight.position.set(70, 100, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 320;
    sunLight.shadow.camera.left = -140;
    sunLight.shadow.camera.right = 140;
    sunLight.shadow.camera.top = 140;
    sunLight.shadow.camera.bottom = -140;
    scene.add(sunLight);

    // 4. BIGGER & MORE REALISTIC BATTLE ROYALE ISLAND TERRAIN (Radius: 220)
    const islandRadius = 220;
    const islandGeo = new THREE.CylinderGeometry(islandRadius, islandRadius + 18, 12, 64);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x14532d,
      roughness: 0.8,
      metalness: 0.1,
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -6;
    island.receiveShadow = true;
    scene.add(island);

    // Island shore beach ring
    const beachGeo = new THREE.RingGeometry(islandRadius - 12, islandRadius + 8, 48);
    const beachMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.rotateX(-Math.PI / 2);
    beach.position.y = 0.05;
    scene.add(beach);

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshStandardMaterial({
        color: 0x0369a1,
        roughness: 0.12,
        metalness: 0.65,
        transparent: true,
        opacity: 0.88,
      })
    );
    ocean.rotateX(-Math.PI / 2);
    ocean.position.y = -6.8;
    scene.add(ocean);

    // 5. 3D Purple Storm Cylinder
    const stormGeo = new THREE.CylinderGeometry(180, 180, 110, 48, 1, true);
    const stormMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });
    const stormMesh = new THREE.Mesh(stormGeo, stormMat);
    stormMesh.position.y = 55;
    scene.add(stormMesh);
    stormMeshRef.current = stormMesh;

    // 6. BUILDINGS, CLIMBABLE ACCESSIBLE RAMPS & PROPS
    const buildingGroup = new THREE.Group();
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.7, roughness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.7, roughness: 0.4 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6, roughness: 0.4 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.1,
    });
    const pagodaRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
    const pagodaGoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 });

    const obstacles: ObstacleBox[] = [];
    const ramps: RampCollider[] = [];

    // HELPER: Create a rock-solid, verified climbable ramp with side railings
    // Perfectly connects (x, startZ, 0) to (x, endZ, targetHeight) without collision snagging
    const createZAlignedRamp = (
      centerX: number,
      width: number,
      startZ: number,
      endZ: number,
      targetHeight: number
    ) => {
      const length = Math.abs(endZ - startZ);
      const angle = Math.atan2(targetHeight, length);
      const centerZ = (startZ + endZ) / 2;
      const centerY = targetHeight / 2;
      const hypot = Math.hypot(length, targetHeight);

      // Ramp mesh
      const rampGeo = new THREE.BoxGeometry(width, 0.4, hypot + 0.8);
      // Direction: if endZ > startZ, slope rises in +Z; if endZ < startZ, slope rises in -Z
      const rotX = endZ > startZ ? -angle : angle;
      const rampMesh = new THREE.Mesh(rampGeo, woodMat);
      rampMesh.position.set(centerX, centerY, centerZ);
      rampMesh.rotation.x = rotX;
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      buildingGroup.add(rampMesh);

      // Side guide railings for safety
      const railGeo = new THREE.BoxGeometry(0.2, 0.6, hypot + 0.8);
      const leftRail = new THREE.Mesh(railGeo, metalMat);
      leftRail.position.set(centerX - width / 2, centerY + 0.3, centerZ);
      leftRail.rotation.x = rotX;
      buildingGroup.add(leftRail);

      const rightRail = new THREE.Mesh(railGeo, metalMat);
      rightRail.position.set(centerX + width / 2, centerY + 0.3, centerZ);
      rightRail.rotation.x = rotX;
      buildingGroup.add(rightRail);

      // Register collision collider
      const minZ = Math.min(startZ, endZ) - 0.5;
      const maxZ = Math.max(startZ, endZ) + 0.5;
      ramps.push({
        minX: centerX - width / 2 - 0.4,
        maxX: centerX + width / 2 + 0.4,
        minZ,
        maxZ,
        axis: 'z',
        startCoord: startZ,
        endCoord: endZ,
        baseHeight: 0,
        topHeight: targetHeight,
      });
    };

    // HELPER: Create an X-aligned climbable ramp
    const createXAlignedRamp = (
      centerZ: number,
      width: number,
      startX: number,
      endX: number,
      targetHeight: number
    ) => {
      const length = Math.abs(endX - startX);
      const angle = Math.atan2(targetHeight, length);
      const centerX = (startX + endX) / 2;
      const centerY = targetHeight / 2;
      const hypot = Math.hypot(length, targetHeight);

      const rampGeo = new THREE.BoxGeometry(hypot + 0.8, 0.4, width);
      const rotZ = endX > startX ? angle : -angle;
      const rampMesh = new THREE.Mesh(rampGeo, woodMat);
      rampMesh.position.set(centerX, centerY, centerZ);
      rampMesh.rotation.z = rotZ;
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      buildingGroup.add(rampMesh);

      const minX = Math.min(startX, endX) - 0.5;
      const maxX = Math.max(startX, endX) + 0.5;
      ramps.push({
        minX,
        maxX,
        minZ: centerZ - width / 2 - 0.4,
        maxZ: centerZ + width / 2 + 0.4,
        axis: 'x',
        startCoord: startX,
        endCoord: endX,
        baseHeight: 0,
        topHeight: targetHeight,
      });
    };

    // Helper: Holographic Chinese Signboard
    const createChineseSign = (text: string, subText: string, width: number, height: number, color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 160;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 512, 160);
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, 500, 148);
      ctx.fillStyle = color;
      ctx.font = 'bold 58px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, 256, 80);
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(subText, 256, 128);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    };

    // ---------------------------------------------------------
    // ZONE 1: TILTED SKYLINE APARTMENT TOWER (-48, 0, 36)
    // ---------------------------------------------------------
    const aptGroup = new THREE.Group();
    const aptMain = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 20), brickMat);
    aptMain.position.set(0, 5, 0);
    aptMain.castShadow = true;
    aptMain.receiveShadow = true;
    aptGroup.add(aptMain);

    for (let floor = 1; floor <= 2; floor++) {
      for (let w = -2; w <= 2; w++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.2), windowMat);
        win.position.set(w * 4.0, floor * 3.4, 10.1);
        aptGroup.add(win);
        const winBack = win.clone();
        winBack.position.z = -10.1;
        aptGroup.add(winBack);
      }
    }

    const aptRoof = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.6, 20.6), concreteMat);
    aptRoof.position.set(0, 10.3, 0);
    aptGroup.add(aptRoof);

    // Helipad marking on roof
    const helipad = new THREE.Mesh(
      new THREE.RingGeometry(3.5, 4.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
    );
    helipad.rotateX(Math.PI / 2);
    helipad.position.set(0, 10.65, 0);
    aptGroup.add(helipad);

    // HVAC & Water tower
    const acUnit = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.4, 4.0), metalMat);
    acUnit.position.set(-6, 11.5, -5);
    acUnit.castShadow = true;
    aptGroup.add(acUnit);

    const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 3.5, 16), woodMat);
    waterTank.position.set(6, 12.2, 5);
    aptGroup.add(waterTank);

    const aptSign = createChineseSign('天际公寓', 'SKYLINE SUITES', 10, 3.2, '#38bdf8');
    aptSign.position.set(0, 8.8, 10.2);
    aptGroup.add(aptSign);

    aptGroup.position.set(-48, 0, 36);
    buildingGroup.add(aptGroup);
    obstacles.push({ minX: -59, maxX: -37, minZ: 26, maxZ: 46, height: 10, roofPlatform: true });

    // Wide, perfectly accessible ramp to Apartment Roof
    createZAlignedRamp(-48, 6.5, 12, 26, 10.0);

    // ---------------------------------------------------------
    // ZONE 2: NEOPAGODA DRAGON CITADEL (-40, 0, -36)
    // ---------------------------------------------------------
    const pagodaGroup = new THREE.Group();
    const pagodaBase = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 18), pagodaRedMat);
    pagodaBase.position.set(0, 6, 0);
    pagodaBase.castShadow = true;
    pagodaGroup.add(pagodaBase);

    // Curved Traditional Eaves
    const eave1 = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 22), pagodaGoldMat);
    eave1.position.set(0, 12.6, 0);
    pagodaGroup.add(eave1);

    const pagodaTopDeck = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 14), concreteMat);
    pagodaTopDeck.position.set(0, 15.6, 0);
    pagodaGroup.add(pagodaTopDeck);

    const pagodaTopRoof = new THREE.Mesh(new THREE.ConeGeometry(12, 4.5, 4), pagodaGoldMat);
    pagodaTopRoof.position.set(0, 20.8, 0);
    pagodaTopRoof.rotateY(Math.PI / 4);
    pagodaGroup.add(pagodaTopRoof);

    const pagodaSign = createChineseSign('龙之阁', 'DRAGON CITADEL', 9, 3, '#f59e0b');
    pagodaSign.position.set(0, 10, 9.15);
    pagodaGroup.add(pagodaSign);

    pagodaGroup.position.set(-40, 0, -36);
    buildingGroup.add(pagodaGroup);
    obstacles.push({ minX: -49, maxX: -31, minZ: -45, maxZ: -27, height: 12, roofPlatform: true });

    // Smooth climbable ramp from East ground to Pagoda Balcony
    createXAlignedRamp(-36, 6.5, -16, -31, 12.0);

    // ---------------------------------------------------------
    // ZONE 3: TACTICAL ARMORY & VEHICLE DEPOT (44, 0, 24)
    // ---------------------------------------------------------
    const armoryGroup = new THREE.Group();
    const armoryMain = new THREE.Mesh(new THREE.BoxGeometry(20, 6.5, 18), metalMat);
    armoryMain.position.set(0, 3.25, 0);
    armoryMain.castShadow = true;
    armoryGroup.add(armoryMain);

    const armoryCanopy = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 12), redMat);
    armoryCanopy.position.set(0, 5.8, 14);
    armoryGroup.add(armoryCanopy);

    const armorySign = createChineseSign('军火库', 'TACTICAL ARMORY', 10, 3.2, '#ef4444');
    armorySign.position.set(0, 5.0, 9.15);
    armoryGroup.add(armorySign);

    armoryGroup.position.set(44, 0, 24);
    buildingGroup.add(armoryGroup);
    obstacles.push({ minX: 34, maxX: 54, minZ: 15, maxZ: 33, height: 6.5, roofPlatform: true });

    // Smooth climbable ramp to Armory Roof
    createZAlignedRamp(44, 6.5, 6, 15, 6.5);

    // ---------------------------------------------------------
    // ZONE 4: SHIPPING CONTAINER LOGISTICS YARD (32, 0, -32)
    // ---------------------------------------------------------
    const cont1 = new THREE.Mesh(new THREE.BoxGeometry(8, 3.8, 18), blueMat);
    cont1.position.set(26, 1.9, -32);
    cont1.castShadow = true;
    buildingGroup.add(cont1);
    obstacles.push({ minX: 22, maxX: 30, minZ: -41, maxZ: -23, height: 3.8, roofPlatform: true });

    const cont2 = new THREE.Mesh(new THREE.BoxGeometry(8, 3.8, 18), redMat);
    cont2.position.set(26, 5.7, -32);
    cont2.castShadow = true;
    buildingGroup.add(cont2);
    obstacles.push({ minX: 22, maxX: 30, minZ: -41, maxZ: -23, height: 7.6, roofPlatform: true });

    const cont3 = new THREE.Mesh(new THREE.BoxGeometry(18, 3.8, 8), yellowMat);
    cont3.position.set(40, 1.9, -32);
    cont3.castShadow = true;
    buildingGroup.add(cont3);
    obstacles.push({ minX: 31, maxX: 49, minZ: -36, maxZ: -28, height: 3.8, roofPlatform: true });

    const yardSign = createChineseSign('货运码头', 'CARGO HARBOR', 8, 2.8, '#22c55e');
    yardSign.position.set(26, 6.2, -22.9);
    buildingGroup.add(yardSign);

    // Smooth climbable ramp onto Shipping Containers
    createZAlignedRamp(40, 6.0, -21, -28, 3.8);

    // Skybridge connecting Container 3 to Stacked Container 2
    const skybridge = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 4), metalMat);
    skybridge.position.set(33, 4.0, -32);
    buildingGroup.add(skybridge);

    // ---------------------------------------------------------
    // ZONE 5: POWER SUBSTATION & GENERATOR MATRIX (0, 0, 42)
    // ---------------------------------------------------------
    const subGroup = new THREE.Group();
    // Generator Turbine 1
    const turbine1 = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 8.5, 24), concreteMat);
    turbine1.position.set(-8, 4.25, 0);
    turbine1.castShadow = true;
    subGroup.add(turbine1);
    obstacles.push({ minX: -13, maxX: -3, minZ: 37, maxZ: 47, height: 8.5, roofPlatform: true });

    // Generator Turbine 2
    const turbine2 = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 8.5, 24), concreteMat);
    turbine2.position.set(8, 4.25, 0);
    turbine2.castShadow = true;
    subGroup.add(turbine2);
    obstacles.push({ minX: 3, maxX: 13, minZ: 37, maxZ: 47, height: 8.5, roofPlatform: true });

    // High Catwalk bridging Turbines
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 5), metalMat);
    catwalk.position.set(0, 8.5, 0);
    subGroup.add(catwalk);
    obstacles.push({ minX: -11, maxX: 11, minZ: 39.5, maxZ: 44.5, height: 8.5, roofPlatform: true });

    const powerSign = createChineseSign('能量站', 'POWER MATRIX', 8, 2.8, '#a855f7');
    powerSign.position.set(0, 7.0, 2.6);
    subGroup.add(powerSign);

    subGroup.position.set(0, 0, 42);
    buildingGroup.add(subGroup);

    // Wide ramp to Substation Catwalk
    createZAlignedRamp(0, 6.5, 28, 39.5, 8.5);

    // ---------------------------------------------------------
    // ZONE 6: CENTRAL TACTICAL FORTNITE 45° BUILDS (0, 0, -2)
    // ---------------------------------------------------------
    const centerPlat = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 8), woodMat);
    centerPlat.position.set(0, 4.5, -2);
    buildingGroup.add(centerPlat);
    obstacles.push({ minX: -4, maxX: 4, minZ: -6, maxZ: 2, height: 4.5, roofPlatform: true });

    // Central ramp from North ground up to platform
    createZAlignedRamp(0, 6.5, -12, -6, 4.5);

    // ---------------------------------------------------------
    // STREETLIGHTS & GROUND PROPS
    // ---------------------------------------------------------
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const lightPositions = [
      { x: -20, z: 15 },
      { x: 20, z: 15 },
      { x: -20, z: -15 },
      { x: 20, z: -15 },
      { x: 0, z: 20 },
      { x: 0, z: -25 },
    ];

    lightPositions.forEach(({ x, z }) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 8), poleMat);
      pole.position.set(x, 3, z);
      buildingGroup.add(pole);

      const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), lampGlowMat);
      lampHead.position.set(x, 6, z);
      buildingGroup.add(lampHead);
    });

    scene.add(buildingGroup);
    obstaclesRef.current = obstacles;
    rampsRef.current = ramps;

    // 7. PINE & CYBER BAMBOO TREES
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e1f07, roughness: 0.9 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45, emissive: 0x15803d, emissiveIntensity: 0.2 });

    for (let t = 0; t < 48; t++) {
      const angle = (t / 48) * Math.PI * 2 + Math.sin(t * 1.7) * 0.3;
      const dist = 70 + (t % 7) * 16;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;

      if (t % 3 === 0) {
        // Cyber Bamboo Cluster
        const bamboo = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 14, 8), bambooMat);
        bamboo.position.set(tx, 7, tz);
        scene.add(bamboo);
      } else {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.65, 4, 8), trunkMat);
        trunk.position.y = 2;
        tree.add(trunk);

        for (let lvl = 0; lvl < 3; lvl++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(3.5 - lvl * 0.7, 3.2, 8), pineMat);
          cone.position.y = 3.6 + lvl * 2.0;
          tree.add(cone);
        }
        tree.position.set(tx, 0, tz);
        scene.add(tree);
      }
    }

    // 8. WORLD LOOT PICKUPS & WEAPON CRATES
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15, emissive: 0xd97706, emissiveIntensity: 0.5 });
    const chestGoldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2, emissive: 0xf59e0b, emissiveIntensity: 0.6 });
    const slurpMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.7, roughness: 0.2, emissive: 0x0891b2, emissiveIntensity: 0.7 });
    const ammoMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, metalness: 0.6, roughness: 0.4, emissive: 0x4d7c0f, emissiveIntensity: 0.4 });
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.85, roughness: 0.25, emissive: 0x1d4ed8, emissiveIntensity: 0.7 });

    const pickups: WorldPickup3D[] = [];

    const spawnPickup = (
      x: number,
      y: number,
      z: number,
      type: 'coin' | 'chest' | 'ammo' | 'slurp' | 'weapon_crate',
      weaponIdToUnlock?: WeaponId
    ) => {
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
      } else if (type === 'weapon_crate') {
        const crateG = new THREE.Group();
        const crateBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 1.6), crateMat);
        crateBody.position.y = 0.65;
        crateG.add(crateBody);
        const lockLight = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
        lockLight.position.set(0, 0.65, 0.82);
        crateG.add(lockLight);
        mainMesh = crateG;
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

      // Vertical beacon of light pointing straight up
      const beaconGeo = new THREE.CylinderGeometry(0.15, 0.8, 22, 16, 1, true);
      const beaconColor =
        type === 'weapon_crate' ? 0x38bdf8 : type === 'slurp' ? 0x22d3ee : type === 'ammo' ? 0x84cc16 : 0xfbbf24;
      const beaconMat = new THREE.MeshBasicMaterial({
        color: beaconColor,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 11;
      g.add(beacon);

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 1.9, 24),
        new THREE.MeshBasicMaterial({ color: beaconColor, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
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
        weaponIdToUnlock,
      });
    };

    // WEAPON CRATES (Discoverable across tactical map hotspots!)
    // 1. Storm Assault Rifle at Armory Bunker Roof
    spawnPickup(44, 6.7, 24, 'weapon_crate', 'rifle');
    // 2. Havoc Plasma Shotgun at Shipping Container Hub
    spawnPickup(26, 7.8, -32, 'weapon_crate', 'shotgun');
    // 3. Thermal Void Sniper at Dragon Pagoda Balcony
    spawnPickup(-40, 12.8, -36, 'weapon_crate', 'sniper');
    // 4. Quantum Rocket Launcher at Substation Catwalk
    spawnPickup(0, 8.8, 42, 'weapon_crate', 'rocket');

    // VERIFIED ACCESSIBLE ROOFTOP & GROUND ITEMS (No floating out of reach!)
    spawnPickup(-48, 10.5, 36, 'chest');   // Apartment Rooftop Chest (reachable via ramp!)
    spawnPickup(0, 4.8, -2, 'chest');      // Central Platform Chest
    spawnPickup(40, 4.0, -32, 'ammo');     // Container 3 Deck
    spawnPickup(-48, 0.4, 14, 'slurp');    // Ramp Base
    spawnPickup(44, 0.4, 8, 'ammo');       // Armory Ground
    spawnPickup(-20, 0.4, 18, 'coin');
    spawnPickup(18, 0.4, 8, 'coin');
    spawnPickup(-14, 0.4, -18, 'coin');
    spawnPickup(12, 0.4, 25, 'coin');
    spawnPickup(0, 0.4, -18, 'slurp');

    worldPickupsRef.current = pickups;

    // 9. HIGH-FIDELITY ARTICULATED CYBER HERO CHARACTER MODEL
    const pGroup = new THREE.Group();
    playerGroupRef.current = pGroup;

    const suitColorHex = equippedSkin?.accentColor
      ? parseInt(equippedSkin.accentColor.replace('#', '0x'))
      : 0x0284c7;

    const suitMat = new THREE.MeshStandardMaterial({
      color: suitColorHex,
      metalness: 0.65,
      roughness: 0.3,
    });
    const armorDarkMat = new THREE.MeshStandardMaterial({ color: 0x0b1120, metalness: 0.9, roughness: 0.2 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.85,
      metalness: 0.95,
      roughness: 0.1,
    });
    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
    });

    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 1.7;

    // Ballistic chestplate
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.25, 0.55), suitMat);
    torsoMesh.castShadow = true;
    torsoGroup.add(torsoMesh);

    // Glowing Arc Core Reactor
    const arcCore = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), visorMat);
    arcCore.rotateX(Math.PI / 2);
    arcCore.position.set(0, 0.15, 0.3);
    torsoGroup.add(arcCore);

    // Shoulder Pauldrons (Left & Right)
    const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.45), armorDarkMat);
    pauldronL.position.set(-0.6, 0.5, 0);
    torsoGroup.add(pauldronL);

    const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.45), armorDarkMat);
    pauldronR.position.set(0.6, 0.5, 0);
    torsoGroup.add(pauldronR);

    // CYBER JETPACK / DUAL JUMP BOOSTER THRUSTERS ON BACK
    const jetpackBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.25), armorDarkMat);
    jetpackBody.position.set(0, 0.1, -0.38);
    torsoGroup.add(jetpackBody);

    const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 12), goldAccentMat);
    thrusterL.position.set(-0.2, -0.2, -0.42);
    torsoGroup.add(thrusterL);

    const thrusterR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 12), goldAccentMat);
    thrusterR.position.set(0.2, -0.2, -0.42);
    torsoGroup.add(thrusterR);

    // Dynamic Jetpack Flare Flame (Ignites on Jump & Double Jump!)
    const thrusterFlames = new THREE.Group();
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
    const flameL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), flameMat);
    flameL.rotateX(Math.PI);
    flameL.position.set(-0.2, -0.55, -0.42);
    thrusterFlames.add(flameL);

    const flameR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), flameMat);
    flameR.rotateX(Math.PI);
    flameR.position.set(0.2, -0.55, -0.42);
    thrusterFlames.add(flameR);
    thrusterFlames.visible = false;
    torsoGroup.add(thrusterFlames);
    thrusterFlameMeshRef.current = thrusterFlames;

    // Helm with Panoramic Visor and Chinese Crest
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.95, 0);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), armorDarkMat);
    helmet.castShadow = true;
    headGroup.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.22), visorMat);
    visor.position.set(0, 0.02, 0.3);
    headGroup.add(visor);

    // Ear Comms Antennas
    const antennaL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), goldAccentMat);
    antennaL.position.set(-0.38, 0.25, 0);
    headGroup.add(antennaL);

    const antennaR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), goldAccentMat);
    antennaR.position.set(0.38, 0.25, 0);
    headGroup.add(antennaR);

    torsoGroup.add(headGroup);
    pGroup.add(torsoGroup);

    // Armored Legs
    const legGeo = new THREE.CylinderGeometry(0.18, 0.15, 1.15, 8);
    const leftLeg = new THREE.Mesh(legGeo, armorDarkMat);
    leftLeg.position.set(-0.3, 0.6, 0);
    leftLeg.castShadow = true;
    pGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, armorDarkMat);
    rightLeg.position.set(0.3, 0.6, 0);
    rightLeg.castShadow = true;
    pGroup.add(rightLeg);

    // Articulated Arms holding weapon
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

    // Weapon Mount
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
      torsoGroup,
      weaponMount,
      muzzleFlashMesh: flashMesh,
      thrusterFlames,
    };

    pGroup.position.set(0, 0, 0);
    scene.add(pGroup);

    // 10. HIGH-FIDELITY PROCEDURAL ENEMY GENERATOR (4 DISTINCT CLASSES)
    const spawnWaveSquad = (waveNum: number) => {
      enemiesRef.current.forEach((bot) => scene.remove(bot.group));
      enemiesRef.current = [];

      const levelIndex = Math.min(waveNum - 1, WAVE_LEVELS.length - 1);
      const levelCfg = WAVE_LEVELS[levelIndex] || WAVE_LEVELS[0];

      const enemyList: EnemyBot3D[] = [];

      // Spawn distribution across tactical zones
      const tacticalSpawnPoints: Array<{ name: string; type: EnemyType; x: number; z: number; hp: number; speed: number }> = [
        { name: 'Sky Scout Drone', type: 'drone', x: 28, z: 22, hp: 55 + waveNum * 12, speed: 0.06 },
        { name: 'Vanguard Brute', type: 'heavy', x: -28, z: -18, hp: 85 + waveNum * 18, speed: 0.045 },
        { name: 'Shadow Shinobi', type: 'ninja', x: 24, z: -22, hp: 70 + waveNum * 15, speed: 0.065 },
        { name: 'Substation Trooper', type: 'heavy', x: -30, z: 25, hp: 95 + waveNum * 20, speed: 0.048 },
        { name: 'Balcony Drone Sentry', type: 'drone', x: -36, z: -28, hp: 65 + waveNum * 14, speed: 0.06 },
        { name: 'Armory Enforcer', type: 'heavy', x: 38, z: 25, hp: 90 + waveNum * 22, speed: 0.05 },
        { name: 'Cyber Assassin', type: 'ninja', x: 0, z: -25, hp: 80 + waveNum * 18, speed: 0.068 },
        { name: 'Container Raider', type: 'heavy', x: 35, z: 12, hp: 100 + waveNum * 25, speed: 0.048 },
        { name: 'Bamboo Stalker', type: 'ninja', x: -22, z: -35, hp: 75 + waveNum * 16, speed: 0.062 },
        { name: 'Skyline Striker', type: 'drone', x: -44, z: 20, hp: 85 + waveNum * 18, speed: 0.058 },
        { name: 'Apex Vanguard', type: 'heavy', x: 15, z: 32, hp: 120 + waveNum * 30, speed: 0.05 },
        { name: 'Blade Ronin', type: 'ninja', x: -15, z: 12, hp: 85 + waveNum * 20, speed: 0.065 },
        { name: 'Dread Drone', type: 'drone', x: 30, z: -35, hp: 70 + waveNum * 15, speed: 0.06 },
        { name: 'Iron Sentinel', type: 'heavy', x: -38, z: 8, hp: 130 + waveNum * 28, speed: 0.046 },
        { name: 'Phantom Striker', type: 'ninja', x: 18, z: -14, hp: 95 + waveNum * 22, speed: 0.064 },
        { name: 'Overlord Vanguard', type: 'heavy', x: 5, z: 25, hp: 140 + waveNum * 32, speed: 0.048 },
      ];

      // Add squad bots up to levelCfg.botCount - 1
      const regularCount = Math.min(levelCfg.botCount - 1, tacticalSpawnPoints.length);
      for (let i = 0; i < regularCount; i++) {
        const cfg = tacticalSpawnPoints[i];
        createProceduralBot(cfg.name, cfg.type, cfg.hp, cfg.speed, cfg.x, cfg.z, false, 1.0, enemyList);
      }

      // Add Level Boss
      createProceduralBot(levelCfg.bossName, levelCfg.bossType, levelCfg.bossHp, 0.045, 0, -38, true, 1.7, enemyList);

      enemiesRef.current = enemyList;
      setTotalEnemiesInWave(enemyList.length);
      setEnemiesEliminated(0);
      setIsVictory(false);
      setStormRadius(levelCfg.stormRadius);
      setStormSeconds(levelCfg.stormSeconds);
    };

    // Procedural Enemy Model Construction
    const createProceduralBot = (
      name: string,
      type: EnemyType,
      hp: number,
      speed: number,
      x: number,
      z: number,
      isBoss: boolean,
      scale: number,
      targetList: EnemyBot3D[]
    ) => {
      const eGroup = new THREE.Group();
      let leftLeg: THREE.Mesh | undefined;
      let rightLeg: THREE.Mesh | undefined;
      let spinningRing: THREE.Group | undefined;

      const baseMat = new THREE.MeshStandardMaterial({
        color: isBoss ? 0xdc2626 : type === 'drone' ? 0x0284c7 : type === 'ninja' ? 0x7c3aed : 0x475569,
        metalness: 0.85,
        roughness: 0.25,
      });

      const glowMat = new THREE.MeshBasicMaterial({
        color: isBoss ? 0xef4444 : type === 'drone' ? 0x38bdf8 : type === 'ninja' ? 0xc084fc : 0xf59e0b,
      });

      if (type === 'drone') {
        // DRONE SENTRY: Hovering multi-rotor chassis with spinning gyroscopic rings
        const droneBody = new THREE.Mesh(new THREE.ConeGeometry(0.9 * scale, 1.2 * scale, 6), baseMat);
        droneBody.rotateX(Math.PI);
        droneBody.position.y = 2.4 * scale;
        eGroup.add(droneBody);

        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 16, 16), glowMat);
        eye.position.set(0, 2.2 * scale, 0.45 * scale);
        eGroup.add(eye);

        spinningRing = new THREE.Group();
        spinningRing.position.set(0, 2.5 * scale, 0);
        const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.4 * scale, 0.1 * scale, 8, 24), glowMat);
        ringMesh.rotateX(Math.PI / 2);
        spinningRing.add(ringMesh);
        eGroup.add(spinningRing);

        // Twin cannons
        const cannonL = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.8 * scale, 8), baseMat);
        cannonL.rotateX(Math.PI / 2);
        cannonL.position.set(-0.6 * scale, 1.8 * scale, 0.5 * scale);
        eGroup.add(cannonL);

        const cannonR = cannonL.clone();
        cannonR.position.set(0.6 * scale, 1.8 * scale, 0.5 * scale);
        eGroup.add(cannonR);
      } else if (type === 'ninja') {
        // SHADOW SHINOBI: Sleek aerodynamic carbon chassis with dual energy katanas
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 1.3 * scale, 0.5 * scale), baseMat);
        torso.position.y = 1.8 * scale;
        eGroup.add(torso);

        const mask = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 16, 16), baseMat);
        mask.position.set(0, 2.7 * scale, 0);
        eGroup.add(mask);

        const visorSlit = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.08 * scale, 0.2 * scale), glowMat);
        visorSlit.position.set(0, 2.7 * scale, 0.26 * scale);
        eGroup.add(visorSlit);

        // Dual Neon Blades on arms
        const bladeGeo = new THREE.BoxGeometry(0.08 * scale, 1.2 * scale, 0.15 * scale);
        const bladeL = new THREE.Mesh(bladeGeo, glowMat);
        bladeL.position.set(-0.65 * scale, 1.4 * scale, 0.4 * scale);
        bladeL.rotateX(Math.PI / 3);
        eGroup.add(bladeL);

        const bladeR = bladeL.clone();
        bladeR.position.set(0.65 * scale, 1.4 * scale, 0.4 * scale);
        eGroup.add(bladeR);

        const legGeo = new THREE.CylinderGeometry(0.14 * scale, 0.12 * scale, 1.2 * scale, 8);
        leftLeg = new THREE.Mesh(legGeo, baseMat);
        leftLeg.position.set(-0.28 * scale, 0.6 * scale, 0);
        eGroup.add(leftLeg);

        rightLeg = new THREE.Mesh(legGeo, baseMat);
        rightLeg.position.set(0.28 * scale, 0.6 * scale, 0);
        eGroup.add(rightLeg);
      } else {
        // HEAVY CYBORG & BOSS TITAN: Bulky armor chassis with shoulder rocket batteries & massive pauldrons
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2 * scale, 1.5 * scale, 0.8 * scale), baseMat);
        torso.position.y = 2.0 * scale;
        torso.castShadow = true;
        eGroup.add(torso);

        const core = new THREE.Mesh(new THREE.SphereGeometry(0.35 * scale, 12, 12), glowMat);
        core.position.set(0, 2.0 * scale, 0.45 * scale);
        eGroup.add(core);

        const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 0.4 * scale, 0.6 * scale), baseMat);
        pauldronL.position.set(-0.9 * scale, 2.6 * scale, 0);
        eGroup.add(pauldronL);

        const pauldronR = pauldronL.clone();
        pauldronR.position.set(0.9 * scale, 2.6 * scale, 0);
        eGroup.add(pauldronR);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.55 * scale, 0.55 * scale), baseMat);
        head.position.set(0, 2.9 * scale, 0);
        eGroup.add(head);

        const eyeVisor = new THREE.Mesh(new THREE.BoxGeometry(0.45 * scale, 0.15 * scale, 0.2 * scale), glowMat);
        eyeVisor.position.set(0, 2.9 * scale, 0.25 * scale);
        eGroup.add(eyeVisor);

        const legGeo = new THREE.CylinderGeometry(0.2 * scale, 0.18 * scale, 1.35 * scale, 8);
        leftLeg = new THREE.Mesh(legGeo, baseMat);
        leftLeg.position.set(-0.4 * scale, 0.68 * scale, 0);
        eGroup.add(leftLeg);

        rightLeg = new THREE.Mesh(legGeo, baseMat);
        rightLeg.position.set(0.4 * scale, 0.68 * scale, 0);
        eGroup.add(rightLeg);
      }

      // Overhead HP bar sprite
      const hpCanvas = document.createElement('canvas');
      hpCanvas.width = 160;
      hpCanvas.height = 42;
      const hpCtx = hpCanvas.getContext('2d')!;
      hpCtx.fillStyle = '#0f172a';
      hpCtx.fillRect(0, 0, 160, 42);
      hpCtx.fillStyle = isBoss ? '#ef4444' : glowMat.color.getHexString() ? `#${glowMat.color.getHexString()}` : '#38bdf8';
      hpCtx.fillRect(3, 3, 154, 36);
      hpCtx.fillStyle = '#ffffff';
      hpCtx.font = 'bold 15px sans-serif';
      hpCtx.textAlign = 'center';
      hpCtx.fillText(name, 80, 27);

      const hpMap = new THREE.CanvasTexture(hpCanvas);
      const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: hpMap }));
      hpSprite.position.set(0, 4.3 * scale, 0);
      hpSprite.scale.set(3.0 * scale, 0.75 * scale, 1);
      eGroup.add(hpSprite);

      eGroup.position.set(x, type === 'drone' ? 1.5 : 0, z);
      scene.add(eGroup);

      targetList.push({
        id: name + Math.random(),
        name,
        enemyType: type,
        group: eGroup,
        leftLeg,
        rightLeg,
        spinningRing,
        hp,
        maxHp: hp,
        speed,
        fireCooldown: 60 + Math.random() * 50,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        strafeTimer: 40 + Math.random() * 40,
        isBoss,
        walkCycle: 0,
        hoverHeight: type === 'drone' ? 1.5 : 0,
      });
    };

    spawnWaveRef.current = spawnWaveSquad;
    spawnWaveSquad(1);

    // 11. KEYBOARD & MOUSE CONTROLS WITH DOUBLE SPACE JUMP & CHEST INTERACTION
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }
      keysRef.current[e.key.toLowerCase()] = true;

      // SPACE / DOUBLE SPACE JUMP HANDLING
      if (e.code === 'Space') {
        e.preventDefault();
        if (isGroundedRef.current) {
          // Ground Jump
          playerVelocityY.current = 14.5;
          isGroundedRef.current = false;
          jumpsUsedRef.current = 1;
          sounds.playShield();

          if (thrusterFlameMeshRef.current) {
            thrusterFlameMeshRef.current.visible = true;
            setTimeout(() => {
              if (thrusterFlameMeshRef.current) thrusterFlameMeshRef.current.visible = false;
            }, 300);
          }
        } else if (jumpsUsedRef.current === 1) {
          // DOUBLE JUMP! (MID-AIR ROCKET BOOST)
          playerVelocityY.current = 13.5;
          jumpsUsedRef.current = 2;
          sounds.playVictory();
          addCombatTextRef.current(`🚀 DOUBLE JUMP (双重跳跃)!`, true);

          if (thrusterFlameMeshRef.current) {
            thrusterFlameMeshRef.current.visible = true;
            thrusterFlameMeshRef.current.scale.set(1.5, 1.8, 1.5);
            setTimeout(() => {
              if (thrusterFlameMeshRef.current) {
                thrusterFlameMeshRef.current.visible = false;
                thrusterFlameMeshRef.current.scale.set(1, 1, 1);
              }
            }, 450);
          }
        }
      }

      // Quick Reload
      if (e.code === 'KeyR' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleQuickReloadRef.current();
      }

      // Weapon Slots 1 to 5
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5) {
        handleSelectWeaponRef.current(num - 1);
      }

      // Proximity chest unlock key [E]
      if (e.code === 'KeyE' || e.key.toLowerCase() === 'e') {
        if (pGroup) {
          worldPickupsRef.current.forEach((cp) => {
            if (cp.collected || cp.type !== 'weapon_crate') return;
            const dist = Math.hypot(pGroup.position.x - cp.x, pGroup.position.z - cp.z);
            if (dist < 4.0 && cp.weaponIdToUnlock) {
              const targetWeaponId = cp.weaponIdToUnlock;
              cp.collected = true;
              scene.remove(cp.group);
              sounds.playVictory();

              setWeapons((prev) =>
                prev.map((w, idx) => {
                  if (w.id === targetWeaponId) {
                    setActiveWeaponIdx(idx);
                    return { ...w, isUnlocked: true };
                  }
                  return w;
                })
              );

              const unlockedW = weaponsRef.current.find((w) => w.id === targetWeaponId);
              addCombatTextRef.current(`🎉 UNLOCKED ${unlockedW?.name || 'NEW WEAPON'}!`, true);
              setFeedbackBanner({
                text: `🎉 ARSENAL EXPANDED! You discovered and unlocked the ${unlockedW?.name || 'Weapon'} (${unlockedW?.hanziName})!`,
                type: 'success',
              });
              setNearbyChestPrompt(null);
            }
          });
        }
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
        const curR = THREE.MathUtils.damp(stormMeshRef.current.scale.x, stormRadiusRef.current / 180, 4, dt);
        stormMeshRef.current.scale.set(curR, 1, curR);
        stormMeshRef.current.rotation.y += dt * 0.15;
      }

      // Collectible pick up animations
      worldPickupsRef.current.forEach((cp) => {
        if (cp.collected) return;
        cp.group.rotation.y += dt * 2.0;
        cp.coinMesh.position.y = cp.baseY + Math.sin(time * 0.003 + cp.x) * 0.35;
      });

      // Player Movement & Smooth Ramp Physics
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
          const speed = 15.0 * dt;
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

        // PERFECT RAMP COLLISION & SMOOTH STEP-UP
        let rampGroundHeight: number | null = null;
        for (const ramp of rampsRef.current) {
          if (
            nextX >= ramp.minX &&
            nextX <= ramp.maxX &&
            nextZ >= ramp.minZ &&
            nextZ <= ramp.maxZ
          ) {
            const coord = ramp.axis === 'z' ? nextZ : nextX;
            const t = (coord - ramp.startCoord) / (ramp.endCoord - ramp.startCoord);
            if (t >= -0.1 && t <= 1.1) {
              const clampedT = Math.max(0, Math.min(1, t));
              const expectedY = ramp.baseHeight + clampedT * (ramp.topHeight - ramp.baseHeight);
              // Allow smooth walk-on from floor or walk-off onto roof
              if (pGroup.position.y >= expectedY - 1.5 && pGroup.position.y <= expectedY + 3.0) {
                rampGroundHeight = expectedY;
                break;
              }
            }
          }
        }

        // BUILDING BOX COLLISION & ROOFTOP PLATFORM SUPPORT
        let boxGroundHeight = 0;
        let canMove = true;

        for (const box of obstaclesRef.current) {
          const isInside =
            nextX >= box.minX - 0.4 &&
            nextX <= box.maxX + 0.4 &&
            nextZ >= box.minZ - 0.4 &&
            nextZ <= box.maxZ + 0.4;

          if (isInside) {
            // If already on or above the roof platform, support the player standing on it
            if (pGroup.position.y >= box.height - 1.0) {
              boxGroundHeight = Math.max(boxGroundHeight, box.height);
            } else if (rampGroundHeight !== null && rampGroundHeight >= box.height - 1.0) {
              // Transitioning from top of ramp onto roof platform smoothly
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
          jumpsUsedRef.current = 0; // Reset double jump on landing
        }

        if (playerLimbsRef.current?.weaponMount) {
          playerLimbsRef.current.weaponMount.rotation.x = pitch * 0.85;
        }

        pGroup.rotation.y = THREE.MathUtils.damp(pGroup.rotation.y, camYaw + Math.PI, 22, dt);

        pGroup.position.x = Math.max(-210, Math.min(210, pGroup.position.x));
        pGroup.position.z = Math.max(-210, Math.min(210, pGroup.position.z));

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

        const camArmDist = 6.4;
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

        const lookTarget = playerHead
          .clone()
          .add(rightShoulderOffset.clone().multiplyScalar(0.4))
          .add(lookDir.clone().multiplyScalar(35));
        camera.lookAt(lookTarget);

        // Check Weapon Crate Proximity Prompt
        let activePrompt: string | null = null;
        worldPickupsRef.current.forEach((cp) => {
          if (cp.collected) return;
          const dist = Math.hypot(pGroup.position.x - cp.x, pGroup.position.z - cp.z);
          const yDist = Math.abs(pGroup.position.y - cp.baseY);

          if (cp.type === 'weapon_crate' && cp.weaponIdToUnlock) {
            if (dist < 3.8 && yDist < 3.0) {
              const targetW = weaponsRef.current.find((w) => w.id === cp.weaponIdToUnlock);
              activePrompt = `Press [E] to unlock ${targetW?.name || 'Weapon'} (${targetW?.hanziName})!`;
            }
          }

          // Auto-pickup items (Coins, Chests, Slurp, Ammo)
          if (dist < 2.6 && yDist < 3.2 && cp.type !== 'weapon_crate') {
            cp.collected = true;
            scene.remove(cp.group);
            sounds.playSuccess();

            if (cp.type === 'chest') {
              playerShieldRef.current = 100;
              setPlayerShield(100);
              setWeapons((prev) => prev.map((w) => ({ ...w, currentAmmo: w.maxAmmo })));
              onUpdatePlayerRef.current((prev) => ({
                ...prev,
                vCoins: prev.vCoins + 75,
                xp: prev.xp + 60,
              }));
              addCombatTextRef.current(`🏆 CHEST! +75 V-COINS!`, true);
              setFeedbackBanner({
                text: '🏆 Opened Loot Chest! +75 V-Coins · 100% Shield · All Weapons Reloaded!',
                type: 'success',
              });
            } else if (cp.type === 'slurp') {
              playerShieldRef.current = Math.min(100, playerShieldRef.current + 40);
              setPlayerShield(playerShieldRef.current);
              addCombatTextRef.current(`+40 SHIELD!`, false);
              setFeedbackBanner({ text: '🥤 Slurp Keg Consumed (+40 Shield)!', type: 'success' });
            } else if (cp.type === 'ammo') {
              setWeapons((prev) => prev.map((w) => ({ ...w, currentAmmo: w.maxAmmo })));
              onUpdatePlayerRef.current((prev) => ({ ...prev, vCoins: prev.vCoins + 25 }));
              addCombatTextRef.current(`ALL WEAPONS RELOADED!`, false);
              setFeedbackBanner({ text: '📦 Tactical Ammo Crate! Weapons reloaded + 25 V-Coins!', type: 'success' });
            } else {
              onUpdatePlayerRef.current((prev) => ({
                ...prev,
                vCoins: prev.vCoins + 40,
                xp: prev.xp + 30,
              }));
              addCombatTextRef.current(`+40 V-COINS!`, true);
              setFeedbackBanner({ text: '🪙 Golden Medallion (+40 V-Coins)!', type: 'success' });
            }
          }
        });
        setNearbyChestPrompt(activePrompt);

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

            if (b.mesh.position.distanceTo(botCenter) < (bot.isBoss ? 2.6 : 1.7)) {
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
                  new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.6 })
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

      // Update Bots AI & Animations
      enemiesRef.current.forEach((bot) => {
        if (!pGroup) return;

        // Drone spinning ring animation
        if (bot.spinningRing) {
          bot.spinningRing.rotation.z += dt * 5.0;
        }

        const distToPlayer = bot.group.position.distanceTo(pGroup.position);
        if (distToPlayer < 100) {
          const toPlayer = new THREE.Vector3().subVectors(pGroup.position, bot.group.position).normalize();

          bot.strafeTimer -= dt * 60;
          if (bot.strafeTimer <= 0) {
            bot.strafeDir = Math.random() > 0.5 ? 1 : -1;
            bot.strafeTimer = 40 + Math.random() * 40;
          }

          const strafeVec = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(bot.strafeDir * 0.05);

          if (distToPlayer > 18) {
            bot.group.position.addScaledVector(toPlayer, bot.speed);
          }
          bot.group.position.add(strafeVec);

          bot.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

          if (bot.leftLeg && bot.rightLeg) {
            bot.walkCycle += dt * 8;
            bot.leftLeg.rotation.x = Math.sin(bot.walkCycle) * 0.4;
            bot.rightLeg.rotation.x = -Math.sin(bot.walkCycle) * 0.4;
          }

          // Drone hover bob
          if (bot.enemyType === 'drone') {
            bot.group.position.y = 1.8 + Math.sin(time * 0.004 + bot.group.position.x) * 0.4;
          }

          bot.fireCooldown -= dt * 60;
          if (bot.fireCooldown <= 0 && distToPlayer < 70) {
            bot.fireCooldown = 85 + Math.random() * 55;

            const enemyBulletOrigin = bot.group.position.clone().add(new THREE.Vector3(0, 1.6, 0));
            const enemyFireDir = new THREE.Vector3().subVectors(pGroup.position, bot.group.position).normalize();
            enemyFireDir.x += (Math.random() - 0.5) * 0.08;
            enemyFireDir.z += (Math.random() - 0.5) * 0.08;
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
              speed: 46,
              life: 55,
              isPlayer: false,
              damage: bot.isBoss ? 22 : 11,
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

  // Advance to Next Level (1 to 15)
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
    setStormRadius(180);
    setStormSeconds(50);
    spawnWaveRef.current(currentWave);
  };

  const currentWaveConfig = WAVE_LEVELS[Math.min(currentWave - 1, WAVE_LEVELS.length - 1)] || WAVE_LEVELS[0];
  const hpPercent = Math.max(0, Math.min(100, playerHp));
  const shieldPercent = Math.max(0, Math.min(100, playerShield));
  const activeW = weapons[activeWeaponIdx] || weapons[0];

  return (
    <div className="relative w-full space-y-4 select-none">
      {/* 3D FORTNITE WORLD VIEWPORT */}
      <div className="relative bg-slate-950 border-2 border-cyan-500/40 rounded-3xl overflow-hidden shadow-2xl h-[520px] md:h-[620px]">
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

        {/* NEARBY WEAPON CRATE PROMPT */}
        {nearbyChestPrompt && !isVictory && !isDefeated && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs md:text-sm shadow-2xl flex items-center gap-2 animate-bounce z-20">
            <span>📦</span>
            <span>{nearbyChestPrompt}</span>
          </div>
        )}

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
              <span className="text-amber-400 mr-1.5">⚡ LEVEL {currentWave}/15:</span>
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
              Press <span className="font-bold underline text-white">[R]</span> for quick reload, or answer Chinese / Math below to earn <span className="font-bold text-amber-300">WEAPON UPGRADE POINTS</span>!
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

        {/* BOTTOM-RIGHT: 5-SLOT WEAPON INVENTORY HOTBAR WITH UNLOCK & UPGRADE STATUS */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 pointer-events-auto">
          {weapons.map((w, idx) => {
            const isCur = idx === activeWeaponIdx;
            const rConfig = RARITY_COLORS[w.rarity];
            const progressPercent = Math.min(100, (w.upgradeProgress / w.upgradeTarget) * 100);

            return (
              <button
                key={w.id}
                onClick={() => handleSelectWeapon(idx)}
                title={w.isUnlocked ? `${w.name} (Slot ${idx + 1})` : `LOCKED: Find at ${w.unlockLocation}`}
                className={`relative flex flex-col items-center justify-between p-1.5 rounded-xl border-2 transition-all w-14 md:w-16 h-18 shadow-lg backdrop-blur-md ${
                  !w.isUnlocked
                    ? 'border-slate-800 bg-slate-950/80 opacity-50 cursor-not-allowed'
                    : isCur
                    ? `${rConfig.border} ${rConfig.bg} scale-105 shadow-[0_0_15px_${rConfig.glow}]`
                    : 'border-slate-800 bg-slate-900/70 opacity-70 hover:opacity-100 hover:border-slate-600'
                }`}
              >
                <div className="w-full flex justify-between items-center text-[10px] font-black text-slate-400">
                  <span className="bg-slate-950/80 px-1 rounded text-cyan-400">{idx + 1}</span>
                  {w.isUnlocked ? (
                    <span className="text-[9px] uppercase tracking-tighter text-amber-300">
                      {'★'.repeat(w.stars)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">🔒</span>
                  )}
                </div>

                <div className="text-[10px] font-black text-center truncate w-full text-slate-200">
                  {w.isUnlocked ? w.name.split(' ')[0] : 'Locked'}
                </div>

                <div className="text-[10px] font-black text-cyan-300">
                  {w.isUnlocked ? `${w.currentAmmo}/${w.maxAmmo}` : 'FIND'}
                </div>

                {/* Upgrade progress mini-bar */}
                {w.isUnlocked && (
                  <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}

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
                Aim and shoot with mouse. Use <span className="font-bold text-white">WASD</span> to sprint,{' '}
                <span className="font-bold text-amber-300">DOUBLE SPACE</span> to Double Jump, and explore the map to find weapon crates!
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-left">
                <div><span className="text-cyan-400 font-bold">W A S D</span> : Sprint</div>
                <div><span className="text-amber-400 font-bold">SPACE x2</span> : Double Jump</div>
                <div><span className="text-cyan-400 font-bold">E Key</span> : Open Crate</div>
                <div><span className="text-cyan-400 font-bold">1 - 5</span> : Switch Guns</div>
                <div><span className="text-amber-400 font-bold">R Key</span> : Tactical Reload</div>
                <div><span className="text-emerald-400 font-bold">Ramps</span> : 100% Climbable</div>
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

        {/* VICTORY OVERLAY (Supports all 15 Waves + Grand Sovereign Champion) */}
        {isVictory && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500 p-8 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.3)] max-w-md">
              <div className="text-5xl mb-2 animate-bounce">
                {currentWave >= 15 ? '👑' : '🏆'}
              </div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mb-1">
                {currentWave >= 15 ? 'GRAND SOVEREIGN CHAMPION!' : 'WAVE CONQUERED!'}
              </h2>
              <p className="text-sm font-bold text-cyan-300 mb-2">
                {currentWaveConfig.title} Cleared!
              </p>
              <p className="text-xs text-slate-300 mb-5">
                {currentWave >= 15
                  ? 'Incredible mastery! You conquered all 15 Battle Royale danger levels and mastered Mandarin & Math combat arts!'
                  : `You defeated all squad rivals and the ${currentWaveConfig.bossName}! Prepare for the next level!`}
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
                  <div className="text-emerald-400 font-black">{currentWave}/15 LEVELS</div>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                {currentWave < 15 ? (
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
                You fell in battle on {currentWaveConfig.title}. Remember to use <span className="text-amber-300 font-bold">Double Space</span> to leap over enemy fire, climb ramps for high-ground advantage, and answer Chinese & Math questions below!
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

      {/* MANDARIN & CHINESE MATH MASTERY WEAPON FORGE STATION */}
      <div className="bg-slate-900/90 border-2 border-cyan-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        {/* Active Weapon Upgrade Progress Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3 mb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wide">
                MANDARIN & CHINESE MATH WEAPON FORGE
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${RARITY_COLORS[activeW.rarity].border} ${RARITY_COLORS[activeW.rarity].text} bg-slate-950`}>
                {activeW.rarity} · TIER {activeW.tier}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Answer Chinese & Math questions correctly to earn <span className="text-amber-300 font-bold">Mastery Points</span>. Reach the target to ascend {activeW.name} to the next tier (+25% damage & capacity)! Wrong answers deduct 1 point!
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
                      : 'bg-slate-900 border-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* MANDARIN TIER PROGRESSION BANNER FOR CURRENT PLAYER */}
        {(() => {
          const tier = player.mandarinMastery?.tier || 1;
          const cfg = MANDARIN_TIER_CONFIG[tier] || MANDARIN_TIER_CONFIG[1];
          const consecutive = player.mandarinMastery?.consecutiveCorrect || 0;
          const targetConsecutive = cfg.requiredConsecutiveToPromote;
          const streakPercent = Math.min(100, Math.round((consecutive / targetConsecutive) * 100));
          const totalQ = player.mandarinMastery?.questionsAnswered || 0;
          const correctQ = player.mandarinMastery?.correctAnswers || 0;
          const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 100;

          return (
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-xl">
                  🎓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">{player.name}'s Progression:</span>
                    <span className={`text-xs font-black uppercase ${cfg.color}`}>{cfg.title}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                      {cfg.hskLevel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {cfg.description}
                  </div>
                </div>
              </div>

              {tier < 5 ? (
                <div className="w-full md:w-64 space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-400">Next Tier Promotion:</span>
                    <span className="text-amber-300 font-mono">
                      {consecutive}/{targetConsecutive} Streak ({accuracy}% Acc)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-300"
                      style={{ width: `${streakPercent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black">
                  👑 Grandmaster Tier Reached!
                </div>
              )}
            </div>
          );
        })()}

        {/* QUESTION DISPLAY: HANZI, PINYIN & CHINESE ARITHMETIC */}
        {currentQ && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800 gap-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-wide">
                  {currentQ.hanzi}
                </span>
                {showPinyin && (
                  <span className="text-sm font-semibold text-cyan-300 font-mono">
                    [{currentQ.pinyin}]
                  </span>
                )}
                <button
                  onClick={() => speakChinese(currentQ.hanzi)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Listen pronunciation"
                >
                  🔊
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {currentQ.difficulty ? `Tier ${currentQ.difficulty}` : 'Tier 1'} · {currentQ.category === 'math' ? '🧮 MATH' : '🇨🇳 MANDARIN'}
                </span>
                <button
                  onClick={() => setShowPinyin((p) => !p)}
                  className="text-[10px] px-2 py-1 rounded border border-slate-700 hover:border-slate-500 text-slate-300"
                >
                  {showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
                </button>
                {currentQ.explanation && (
                  <button
                    onClick={() => setShowRadicalHint((r) => !r)}
                    className="text-[10px] px-2 py-1 rounded border border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
                  >
                    💡 Hint
                  </button>
                )}
              </div>
            </div>

            {showRadicalHint && currentQ.explanation && (
              <div className="text-xs text-amber-200 bg-amber-950/40 border border-amber-500/40 p-2.5 rounded-xl">
                💡 <span className="font-bold">Grammar & Lore:</span> {currentQ.explanation}
              </div>
            )}

            {/* ANSWER OPTIONS (4 Choices) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentQ.options.map((opt, idx) => {
                const isEliminated = eliminatedOptions.includes(idx);
                const isChosen = selectedAnswer === idx;
                const isCorrect = idx === currentQ.correctIndex;

                let btnStyle = 'bg-slate-950/80 border-slate-800 hover:border-cyan-500/60 text-slate-200';
                if (answerState !== 'idle') {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-[0_0_15px_#10b981]';
                  } else if (isChosen) {
                    btnStyle = 'bg-rose-950/90 border-rose-500 text-rose-200';
                  }
                }

                if (isEliminated) {
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-900 bg-slate-950/40 text-slate-600 line-through text-xs font-medium cursor-not-allowed"
                    >
                      {opt} (Eliminated)
                    </div>
                  );
                }

                return (
                  <button
                    key={idx}
                    disabled={answerState !== 'idle'}
                    onClick={() => handleAnswerQuestion(idx)}
                    className={`p-3 rounded-xl border-2 text-left font-bold text-xs sm:text-sm transition-all active:scale-[0.98] ${btnStyle}`}
                  >
                    <span className="text-cyan-400 font-mono mr-2">{['A', 'B', 'C', 'D'][idx]}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* GIMKIT POWER-UP SHOP MODAL */}
      {isShopOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-amber-500 p-6 rounded-3xl shadow-2xl max-w-lg w-full">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-amber-400 flex items-center gap-2">
                  <span>🛒</span>
                  <span>TACTICAL POWER-UP SHOP</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Spend V-Coins earned from eliminating rivals & answering Chinese questions!
                </p>
              </div>
              <button
                onClick={() => setIsShopOpen(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {POWER_UPS.map((pu) => {
                const canAfford = player.vCoins >= pu.cost;
                return (
                  <div
                    key={pu.id}
                    className="flex justify-between items-center p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-200">{pu.name}</div>
                      <div className="text-[11px] text-slate-400">{pu.description}</div>
                    </div>
                    <button
                      disabled={!canAfford}
                      onClick={() => handleBuyCombatPowerUp(pu)}
                      className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                        canAfford
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {pu.cost} V-COINS
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">Current Balance:</span>
              <span className="font-black text-amber-400 text-sm">🪙 {player.vCoins} V-COINS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
