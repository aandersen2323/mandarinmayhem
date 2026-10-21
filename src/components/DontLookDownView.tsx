import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PlayerProfile, SkinItem, MandarinQuestion, MandarinPowerUp } from '../types/game';
import { MANDARIN_QUESTIONS } from '../data/mandarinData';
import { MANDARIN_POWER_UPS, isPowerUpUnlocked } from '../data/powerUpData';
import { buildCustomAvatarMesh, ArticulatedAvatar } from '../utils/avatar3d';
import { sounds } from '../utils/audio';
import {
  Volume2,
  VolumeX,
  Compass,
  Zap,
  Flag,
  Award,
  ArrowUp,
  Sparkles,
  HelpCircle,
  RotateCcw,
  Shield,
  Coins,
  ChevronRight,
  Flame,
  AlertTriangle,
} from 'lucide-react';

interface DontLookDownViewProps {
  player: PlayerProfile;
  equippedSkin: SkinItem;
  onUpdatePlayer: (updater: (prev: PlayerProfile) => PlayerProfile) => void;
  onExit: () => void;
}

interface PlatformCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
  height: number;
  isBouncePad?: boolean;
  bouncePower?: number;
  isMoving?: boolean;
  moveAxis?: 'x' | 'z';
  moveRange?: number;
  moveSpeed?: number;
  initialX?: number;
  initialZ?: number;
  mesh?: THREE.Mesh;
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

interface CheckpointLocation {
  id: number;
  name: string;
  hanziName: string;
  altitude: number;
  x: number;
  y: number;
  z: number;
  unlocked: boolean;
}

const CHECKPOINTS_DATA: CheckpointLocation[] = [
  { id: 0, name: 'Basecamp Landing', hanziName: '大本营', altitude: 0, x: 0, y: 1.5, z: 0, unlocked: true },
  { id: 1, name: 'Cloud Foothills', hanziName: '云海脚营', altitude: 40, x: 0, y: 41.5, z: 12, unlocked: false },
  { id: 2, name: 'Sky Bridges & Springs', hanziName: '天桥弹射台', altitude: 80, x: 10, y: 81.5, z: -10, unlocked: false },
  { id: 3, name: 'Floating Pagoda Tier', hanziName: '九霄宝塔阁', altitude: 130, x: -12, y: 131.5, z: 8, unlocked: false },
  { id: 4, name: 'Stratosphere Quantum Leap', hanziName: '平流层微光', altitude: 180, x: 6, y: 181.5, z: -14, unlocked: false },
  { id: 5, name: 'Celestial Summit Gateway', hanziName: '天门之巅 (登峰造极)', altitude: 220, x: 0, y: 221.5, z: 0, unlocked: false },
];

export const DontLookDownView: React.FC<DontLookDownViewProps> = ({
  player,
  equippedSkin,
  onUpdatePlayer,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Gameplay State
  const [currentAltitude, setCurrentAltitude] = useState<number>(0);
  const [maxAltitudeReached, setMaxAltitudeReached] = useState<number>(
    player.dontLookDownBestAltitude || 0
  );
  const [activeCheckpoint, setActiveCheckpoint] = useState<number>(0);
  const [jumpFuel, setJumpFuel] = useState<number>(5);
  const [earnedCoins, setEarnedCoins] = useState<number>(0);
  const [consecutiveAnswers, setConsecutiveAnswers] = useState<number>(0);
  const [isLookingDown, setIsLookingDown] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);

  // Question Kiosk Modal State
  const [kioskOpen, setKioskOpen] = useState<boolean>(false);
  const [currentQuestion, setCurrentQuestion] = useState<MandarinQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [questionAnswered, setQuestionAnswered] = useState<boolean>(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean>(false);

  // Active Power-Up State
  const [activeBuff, setActiveBuff] = useState<{
    id: string;
    name: string;
    secondsLeft: number;
    multiplier: number;
    speedBonus: number;
    gravityReduction: number;
  } | null>(null);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const avatarRef = useRef<ArticulatedAvatar | null>(null);
  const platformsRef = useRef<PlatformCollider[]>([]);
  const rampsRef = useRef<RampCollider[]>([]);
  const terminalsRef = useRef<{ id: number; x: number; y: number; z: number; mesh: THREE.Group }[]>([]);
  const movingMeshesRef = useRef<{ collider: PlatformCollider; mesh: THREE.Mesh }[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Player Kinematics
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.5, 0));
  const playerVelRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef<boolean>(true);
  const doubleJumpAvailableRef = useRef<boolean>(true);
  const cameraPitchRef = useRef<number>(0.2); // vertical tilt
  const cameraYawRef = useRef<number>(0); // horizontal orbit

  // Controls Keys
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Question Bank Filtered by Tier
  const getRelevantQuestions = useCallback(() => {
    const playerTier = player.mandarinMastery?.tier || 1;
    return MANDARIN_QUESTIONS.filter((q) => !q.difficulty || q.difficulty <= playerTier);
  }, [player.mandarinMastery?.tier]);

  // Open Terminal
  const openQuestionTerminal = useCallback((checkpointId?: number) => {
    const pool = getRelevantQuestions();
    const rand = pool[Math.floor(Math.random() * pool.length)] || MANDARIN_QUESTIONS[0];
    setCurrentQuestion(rand);
    setSelectedOption(null);
    setQuestionAnswered(false);
    setKioskOpen(true);
    sounds.playPowerUp();
  }, [getRelevantQuestions]);

  // Handle Question Answer
  const handleAnswerQuestion = (idx: number) => {
    if (questionAnswered || !currentQuestion) return;
    setSelectedOption(idx);
    setQuestionAnswered(true);

    const correct = idx === currentQuestion.correctIndex;
    setIsAnswerCorrect(correct);

    if (correct) {
      sounds.playSuccess();
      const bonusCoins = 40 * (activeBuff?.multiplier || 1);
      const bonusXp = 50 * (activeBuff?.multiplier || 1);

      setEarnedCoins((c) => c + bonusCoins);
      setJumpFuel((f) => Math.min(12, f + 4));
      setConsecutiveAnswers((s) => s + 1);

      // Checkpoint upgrade
      const currentY = playerPosRef.current.y;
      CHECKPOINTS_DATA.forEach((cp) => {
        if (currentY >= cp.altitude - 5 && !cp.unlocked) {
          cp.unlocked = true;
          setActiveCheckpoint(cp.id);
        }
      });

      onUpdatePlayer((prev) => ({
        ...prev,
        xp: prev.xp + bonusXp,
        vCoins: prev.vCoins + bonusCoins,
        highestStreak: Math.max(prev.highestStreak, consecutiveAnswers + 1),
        mandarinMastery: prev.mandarinMastery
          ? {
              ...prev.mandarinMastery,
              questionsAnswered: prev.mandarinMastery.questionsAnswered + 1,
              correctAnswers: prev.mandarinMastery.correctAnswers + 1,
              consecutiveCorrect: prev.mandarinMastery.consecutiveCorrect + 1,
            }
          : undefined,
      }));
    } else {
      sounds.playDamage();
      setConsecutiveAnswers(0);
    }
  };

  // Trigger Power-Up
  const handleTriggerPowerUp = (pu: MandarinPowerUp) => {
    if (activeBuff) return;
    sounds.playPowerUp();

    let speedBonus = 0;
    let multiplier = 1;
    let gravityReduction = 0;

    if (pu.effectType === 'speed_boost') speedBonus = 0.6;
    if (pu.effectType === 'score_multiplier') multiplier = 2;
    if (pu.effectType === 'feather_leap') {
      gravityReduction = 0.55;
      setJumpFuel((f) => f + 3);
    }

    setActiveBuff({
      id: pu.id,
      name: pu.name,
      secondsLeft: pu.durationSeconds,
      multiplier,
      speedBonus,
      gravityReduction,
    });
  };

  // Active Buff Countdown Timer
  useEffect(() => {
    if (!activeBuff) return;
    const timer = setInterval(() => {
      setActiveBuff((prev) => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) return null;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeBuff]);

  // Respawn at Last Checkpoint
  const respawnAtCheckpoint = useCallback(() => {
    const cp = CHECKPOINTS_DATA[activeCheckpoint] || CHECKPOINTS_DATA[0];
    playerPosRef.current.set(cp.x, cp.y + 1.2, cp.z);
    playerVelRef.current.set(0, 0, 0);
    sounds.playDamage();
  }, [activeCheckpoint]);

  // Initialize 3D World Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Sky with vertical color gradient (Fog changes with altitude)
    scene.background = new THREE.Color(0x0a192f);
    scene.fog = new THREE.FogExp2(0x0a192f, 0.012);

    const camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    sunLight.position.set(40, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x06b6d4, 0x1e1b4b, 0.5);
    scene.add(hemiLight);

    // 3. Materials
    const baseGreenMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.8 });
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    });
    const neonCyanMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    const bouncePadMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const pagodaRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 });
    const pagodaGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
    });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });

    const platforms: PlatformCollider[] = [];
    const ramps: RampCollider[] = [];
    const movingList: { collider: PlatformCollider; mesh: THREE.Mesh }[] = [];
    const terminals: { id: number; x: number; y: number; z: number; mesh: THREE.Group }[] = [];

    // Helper: Add static platform
    const addPlatform = (
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      h: number = 0.8,
      mat: THREE.Material = neonCyanMat,
      isBounce: boolean = false
    ) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const collider: PlatformCollider = {
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        y: y + h,
        height: h,
        isBouncePad: isBounce,
        bouncePower: isBounce ? 22 : 0,
        mesh,
      };
      platforms.push(collider);
      return mesh;
    };

    // Helper: Add moving platform
    const addMovingPlatform = (
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      axis: 'x' | 'z',
      range: number,
      speed: number = 2.0
    ) => {
      const geo = new THREE.BoxGeometry(w, 0.8, d);
      const mesh = new THREE.Mesh(geo, neonCyanMat);
      mesh.position.set(x, y + 0.4, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const collider: PlatformCollider = {
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        y: y + 0.8,
        height: 0.8,
        isMoving: true,
        moveAxis: axis,
        moveRange: range,
        moveSpeed: speed,
        initialX: x,
        initialZ: z,
        mesh,
      };
      platforms.push(collider);
      movingList.push({ collider, mesh });
    };

    // Helper: Add climbable ramp
    const addRamp = (
      centerX: number,
      width: number,
      startZ: number,
      endZ: number,
      baseY: number,
      topY: number
    ) => {
      const length = Math.abs(endZ - startZ);
      const heightDiff = topY - baseY;
      const angle = Math.atan2(heightDiff, length);
      const centerZ = (startZ + endZ) / 2;
      const centerY = baseY + heightDiff / 2;
      const hypot = Math.hypot(length, heightDiff);

      const geo = new THREE.BoxGeometry(width, 0.4, hypot);
      const rotX = endZ > startZ ? -angle : angle;
      const mesh = new THREE.Mesh(geo, woodMat);
      mesh.position.set(centerX, centerY, centerZ);
      mesh.rotation.x = rotX;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      ramps.push({
        minX: centerX - width / 2 - 0.3,
        maxX: centerX + width / 2 + 0.3,
        minZ: Math.min(startZ, endZ) - 0.4,
        maxZ: Math.max(startZ, endZ) + 0.4,
        axis: 'z',
        startCoord: startZ,
        endCoord: endZ,
        baseHeight: baseY,
        topHeight: topY,
      });
    };

    // Helper: Add Mandarin Question Kiosk Terminal
    const addTerminal = (id: number, x: number, y: number, z: number, label: string) => {
      const termGroup = new THREE.Group();
      termGroup.position.set(x, y, z);

      // Pedestal
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 8), pagodaGoldMat);
      ped.position.y = 0.6;
      termGroup.add(ped);

      // Holographic Chinese Character Octagon
      const holo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.2, 8),
        new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.9,
          roughness: 0.1,
        })
      );
      holo.position.y = 1.4;
      holo.rotation.x = 0.3;
      termGroup.add(holo);

      // Floating Chinese Calligraphy Beacon
      const beaconLight = new THREE.PointLight(0x06b6d4, 2, 8);
      beaconLight.position.set(0, 2.2, 0);
      termGroup.add(beaconLight);

      scene.add(termGroup);
      terminals.push({ id, x, y, z, mesh: termGroup });
    };

    // ==========================================
    // BUILD THE VERTICAL 3D COURSE (0m to 220m)
    // ==========================================

    // ZONE 0: BASECAMP (0m - 10m)
    addPlatform(0, 0, 0, 18, 18, 1.2, baseGreenMat);
    addTerminal(0, 0, 1.2, -5, 'Basecamp Terminal');

    // ZONE 1: CLOUD FOOTHILLS (10m - 40m)
    addPlatform(0, 6, 8, 8, 8, 0.8, cloudMat);
    addRamp(0, 3.5, 9, 17, 6.8, 16);
    addPlatform(0, 16, 21, 9, 9, 0.8, neonCyanMat);

    // Stepping stones
    addPlatform(6, 22, 19, 4, 4, 0.6, cloudMat);
    addPlatform(12, 28, 15, 4, 4, 0.6, cloudMat);
    addPlatform(8, 34, 10, 5, 5, 0.6, cloudMat);

    // Bounce Pad launch up to Checkpoint 1
    addPlatform(0, 36, 12, 4, 4, 0.6, bouncePadMat, true);

    // CHECKPOINT 1 (40m)
    addPlatform(0, 40, 12, 12, 12, 1.0, pagodaGoldMat);
    addTerminal(1, 0, 41, 10, 'Cloud Foothills Checkpoint');

    // ZONE 2: JADE SKY BRIDGES & SPRING PADS (40m - 80m)
    addMovingPlatform(0, 47, 0, 6, 6, 'z', 10, 2.2);
    addPlatform(0, 54, -12, 7, 7, 0.8, cloudMat);
    addRamp(0, 3, -12, -22, 54.8, 64);
    addPlatform(0, 64, -25, 8, 8, 0.8, neonCyanMat);

    // Moving X-axis platform
    addMovingPlatform(0, 71, -18, 6, 6, 'x', 12, 2.5);
    addPlatform(10, 75, -10, 4, 4, 0.6, bouncePadMat, true);

    // CHECKPOINT 2 (80m)
    addPlatform(10, 80, -10, 14, 14, 1.0, pagodaRedMat);
    addTerminal(2, 10, 81, -8, 'Sky Springs Checkpoint');

    // ZONE 3: FLOATING CYBER PAGODA TIER (80m - 130m)
    addPlatform(2, 88, -2, 6, 6, 0.8, cloudMat);
    addPlatform(-6, 96, 4, 6, 6, 0.8, cloudMat);
    addRamp(-6, 3, 5, 14, 96.8, 107);
    addPlatform(-6, 107, 18, 7, 7, 0.8, neonCyanMat);
    addMovingPlatform(-6, 115, 10, 5, 5, 'z', 8, 2.8);
    addPlatform(-12, 122, 8, 4, 4, 0.6, bouncePadMat, true);

    // CHECKPOINT 3 (130m)
    addPlatform(-12, 130, 8, 15, 15, 1.2, pagodaGoldMat);
    addTerminal(3, -12, 131.2, 6, 'Floating Pagoda Checkpoint');

    // ZONE 4: STRATOSPHERE QUANTUM LEAP (130m - 180m)
    addPlatform(-3, 139, 0, 5, 5, 0.6, cloudMat);
    addPlatform(5, 148, -6, 5, 5, 0.6, neonCyanMat);
    addMovingPlatform(12, 157, -10, 5, 5, 'x', 10, 3.2);
    addRamp(6, 3, -11, -21, 162, 172);
    addPlatform(6, 172, -24, 6, 6, 0.8, neonCyanMat);
    addPlatform(6, 175, -14, 4, 4, 0.6, bouncePadMat, true);

    // CHECKPOINT 4 (180m)
    addPlatform(6, 180, -14, 14, 14, 1.2, pagodaRedMat);
    addTerminal(4, 6, 181.2, -12, 'Stratosphere Checkpoint');

    // ZONE 5: CELESTIAL SUMMIT GATEWAY (180m - 220m)
    addPlatform(0, 190, -4, 5, 5, 0.6, cloudMat);
    addPlatform(0, 200, 4, 5, 5, 0.6, cloudMat);
    addPlatform(0, 210, 0, 4, 4, 0.6, bouncePadMat, true);

    // SUMMIT PALACE (220m)
    addPlatform(0, 220, 0, 24, 24, 2.0, pagodaGoldMat);
    addTerminal(5, 0, 222, -6, 'Summit Dragon Bell');

    // Grand Archway at the Summit
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 222, 0);

    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 12, 16), pagodaRedMat);
    pillarL.position.set(-6, 6, 0);
    archGroup.add(pillarL);

    const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 12, 16), pagodaRedMat);
    pillarR.position.set(6, 6, 0);
    archGroup.add(pillarR);

    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 2.5), pagodaGoldMat);
    archBeam.position.set(0, 12, 0);
    archGroup.add(archBeam);

    const dragonCrown = new THREE.Mesh(new THREE.TorusGeometry(3, 0.6, 16, 32), neonCyanMat);
    dragonCrown.position.set(0, 14, 0);
    archGroup.add(dragonCrown);

    scene.add(archGroup);

    platformsRef.current = platforms;
    rampsRef.current = ramps;
    movingMeshesRef.current = movingList;
    terminalsRef.current = terminals;

    // 4. Player Avatar Model
    const avatarConfig = player.avatarConfig || {
      baseModelId: 'agent_cyber',
      hairstyleId: 'spiky_cyber',
      hatId: 'cyber_goggles',
      armorId: 'stealth_nanosuit',
      backItemId: 'cyber_katana',
      primaryColor: equippedSkin.accentColor || '#06b6d4',
      secondaryColor: '#1e293b',
      glowColor: '#10b981',
    };

    const avatar = buildCustomAvatarMesh(avatarConfig, 0.9);
    scene.add(avatar.group);
    avatarRef.current = avatar;

    // Position player at current checkpoint
    const initialCp = CHECKPOINTS_DATA[activeCheckpoint] || CHECKPOINTS_DATA[0];
    playerPosRef.current.set(initialCp.x, initialCp.y + 1.2, initialCp.z);

    // 5. Input Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;

      // Space Jump
      if (e.code === 'Space') {
        if (isGroundedRef.current) {
          playerVelRef.current.y = 12.5;
          isGroundedRef.current = false;
          doubleJumpAvailableRef.current = true;
          sounds.playShoot();
        } else if (doubleJumpAvailableRef.current && jumpFuel > 0) {
          // Double Space Boost Jump!
          playerVelRef.current.y = 14.5;
          doubleJumpAvailableRef.current = false;
          setJumpFuel((f) => Math.max(0, f - 1));
          sounds.playPowerUp();

          // Flash thruster flames
          if (avatar.flameMeshL) avatar.flameMeshL.visible = true;
          if (avatar.flameMeshR) avatar.flameMeshR.visible = true;
          setTimeout(() => {
            if (avatar.flameMeshL) avatar.flameMeshL.visible = false;
            if (avatar.flameMeshR) avatar.flameMeshR.visible = false;
          }, 350);
        }
      }

      // E to interact with nearby question terminal
      if (e.key.toLowerCase() === 'e') {
        const pPos = playerPosRef.current;
        const nearest = terminalsRef.current.find((t) => {
          const dist = Math.hypot(pPos.x - t.x, pPos.y - t.y, pPos.z - t.z);
          return dist <= 5.0;
        });
        if (nearest) {
          openQuestionTerminal(nearest.id);
        }
      }

      // R to return to checkpoint
      if (e.key.toLowerCase() === 'r') {
        respawnAtCheckpoint();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mouse drag to orbit camera
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      cameraYawRef.current -= dx * 0.005;
      cameraPitchRef.current = Math.max(-0.6, Math.min(1.2, cameraPitchRef.current + dy * 0.005));

      // Check if looking straight down for vertigo warning!
      setIsLookingDown(cameraPitchRef.current > 0.85);
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Resize Handler
    const onResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // 6. Game Loop Clock
    let lastTime = performance.now();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const keys = keysRef.current;
      const pPos = playerPosRef.current;
      const pVel = playerVelRef.current;

      // Update Moving Platforms
      const tSec = now / 1000;
      movingMeshesRef.current.forEach(({ collider, mesh }) => {
        if (!collider.moveRange || !collider.initialX || !collider.initialZ) return;
        const offset = Math.sin(tSec * (collider.moveSpeed || 2)) * collider.moveRange;
        if (collider.moveAxis === 'x') {
          mesh.position.x = collider.initialX + offset;
          const w = collider.maxX - collider.minX;
          collider.minX = mesh.position.x - w / 2;
          collider.maxX = mesh.position.x + w / 2;
        } else {
          mesh.position.z = collider.initialZ + offset;
          const d = collider.maxZ - collider.minZ;
          collider.minZ = mesh.position.z - d / 2;
          collider.maxZ = mesh.position.z + d / 2;
        }
      });

      // Animate Kiosk Terminals
      terminalsRef.current.forEach((t) => {
        t.mesh.rotation.y += 0.015;
      });

      // Player Movement Kinematics
      const moveSpeed = (8.5 + (activeBuff?.speedBonus ? 5.0 : 0)) * dt;
      let moveX = 0;
      let moveZ = 0;

      if (keys['w'] || keys['arrowup']) moveZ -= 1;
      if (keys['s'] || keys['arrowdown']) moveZ += 1;
      if (keys['a'] || keys['arrowleft']) moveX -= 1;
      if (keys['d'] || keys['arrowright']) moveX += 1;

      if (moveX !== 0 || moveZ !== 0) {
        const len = Math.hypot(moveX, moveZ);
        const normX = (moveX / len) * moveSpeed;
        const normZ = (moveZ / len) * moveSpeed;

        // Rotate movement by camera yaw
        const sinYaw = Math.sin(cameraYawRef.current);
        const cosYaw = Math.cos(cameraYawRef.current);

        const worldMoveX = normX * cosYaw + normZ * sinYaw;
        const worldMoveZ = -normX * sinYaw + normZ * cosYaw;

        pPos.x += worldMoveX;
        pPos.z += worldMoveZ;

        // Rotate avatar toward movement
        if (avatarRef.current) {
          avatarRef.current.group.rotation.y = Math.atan2(worldMoveX, worldMoveZ);

          // Leg running swing animation
          const legSwing = Math.sin(now * 0.012) * 0.45;
          avatarRef.current.leftLeg.rotation.x = legSwing;
          avatarRef.current.rightLeg.rotation.x = -legSwing;
          avatarRef.current.leftArm.rotation.x = -legSwing;
          avatarRef.current.rightArm.rotation.x = legSwing;
        }
      } else {
        if (avatarRef.current) {
          avatarRef.current.leftLeg.rotation.x = 0;
          avatarRef.current.rightLeg.rotation.x = 0;
        }
      }

      // Apply Gravity
      const gravity = 25 * (1 - (activeBuff?.gravityReduction || 0));
      pVel.y -= gravity * dt;
      pPos.y += pVel.y * dt;

      // Platform Collision Detection
      let landed = false;

      // Check static & moving platforms
      for (const p of platformsRef.current) {
        if (
          pPos.x >= p.minX &&
          pPos.x <= p.maxX &&
          pPos.z >= p.minZ &&
          pPos.z <= p.maxZ
        ) {
          // Player is within horizontal bounds
          if (pPos.y <= p.y + 0.5 && pPos.y >= p.y - 1.5 && pVel.y <= 0) {
            if (p.isBouncePad) {
              pVel.y = p.bouncePower || 22;
              sounds.playPowerUp();
              landed = false;
            } else {
              pPos.y = p.y;
              pVel.y = 0;
              landed = true;
              doubleJumpAvailableRef.current = true;
            }
            break;
          }
        }
      }

      // Check climbable ramps
      if (!landed) {
        for (const r of rampsRef.current) {
          if (
            pPos.x >= r.minX &&
            pPos.x <= r.maxX &&
            pPos.z >= r.minZ &&
            pPos.z <= r.maxZ
          ) {
            const length = Math.abs(r.endCoord - r.startCoord);
            const progress = (pPos.z - r.startCoord) / (r.endCoord - r.startCoord);
            if (progress >= 0 && progress <= 1) {
              const rampY = r.baseHeight + progress * (r.topHeight - r.baseHeight);
              if (pPos.y <= rampY + 0.6 && pPos.y >= rampY - 1.2 && pVel.y <= 0) {
                pPos.y = rampY;
                pVel.y = 0;
                landed = true;
                doubleJumpAvailableRef.current = true;
                break;
              }
            }
          }
        }
      }

      isGroundedRef.current = landed;

      // Update Altitude
      const currentY = Math.max(0, Math.round(pPos.y));
      setCurrentAltitude(currentY);

      if (currentY > maxAltitudeReached) {
        setMaxAltitudeReached(currentY);
        onUpdatePlayer((prev) => ({
          ...prev,
          dontLookDownBestAltitude: Math.max(prev.dontLookDownBestAltitude || 0, currentY),
        }));
      }

      // Checkpoint activation on pass
      CHECKPOINTS_DATA.forEach((cp) => {
        if (currentY >= cp.altitude && !cp.unlocked) {
          cp.unlocked = true;
          setActiveCheckpoint(cp.id);
          sounds.playSuccess();
        }
      });

      // Victory Condition: Summit reached (>= 220m)
      if (currentY >= 220 && !isVictory) {
        setIsVictory(true);
        sounds.playVictory();
        onUpdatePlayer((prev) => ({
          ...prev,
          vCoins: prev.vCoins + 500,
          xp: prev.xp + 600,
          arenaVictories: prev.arenaVictories + 1,
        }));
      }

      // Abyss Fall Check: If fell below current zone base or -15, respawn
      const currentMinSafeY = CHECKPOINTS_DATA[activeCheckpoint]?.altitude || 0;
      if (pPos.y < currentMinSafeY - 20) {
        respawnAtCheckpoint();
      }

      // Sync Avatar 3D Position
      if (avatarRef.current) {
        avatarRef.current.group.position.copy(pPos);
      }

      // Orbit Camera Follow
      const camDist = 6.8;
      const camHeight = 3.2;
      const camX = pPos.x - Math.sin(cameraYawRef.current) * Math.cos(cameraPitchRef.current) * camDist;
      const camY = pPos.y + camHeight + Math.sin(cameraPitchRef.current) * camDist;
      const camZ = pPos.z - Math.cos(cameraYawRef.current) * Math.cos(cameraPitchRef.current) * camDist;

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.15);
      camera.lookAt(pPos.x, pPos.y + 1.6, pPos.z);

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [
    activeCheckpoint,
    activeBuff,
    consecutiveAnswers,
    isVictory,
    jumpFuel,
    maxAltitudeReached,
    onUpdatePlayer,
    openQuestionTerminal,
    player,
    equippedSkin,
    respawnAtCheckpoint,
  ]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden select-none">
      {/* 3D Canvas Viewport */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP HUD: Altitude Bar & Zone Badge */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
        {/* Left: Altitude Progress Tracker */}
        <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 shadow-xl min-w-[260px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Compass className="text-cyan-400" size={18} />
              <span className="font-extrabold text-white text-sm uppercase tracking-wider">
                Altitude (高度)
              </span>
            </div>
            <span className="text-2xl font-mono font-black text-cyan-300">
              {currentAltitude}m <span className="text-xs text-slate-400 font-normal">/ 220m</span>
            </span>
          </div>

          {/* Vertical/Horizontal Altitude Gauge */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-cyan-500/20">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (currentAltitude / 220) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>Basecamp 0m</span>
            <span>Pagoda 130m</span>
            <span className="text-amber-400 font-bold">Summit 220m</span>
          </div>

          {/* Current Checkpoint Indicator */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Flag size={13} className="text-emerald-400" />
              Checkpoint:
            </span>
            <span className="font-bold text-emerald-300">
              {CHECKPOINTS_DATA[activeCheckpoint]?.name} (
              {CHECKPOINTS_DATA[activeCheckpoint]?.hanziName})
            </span>
          </div>
        </div>

        {/* Center: Vertigo Warning when Looking Down */}
        {isLookingDown && (
          <div className="pointer-events-none animate-bounce bg-rose-600/90 backdrop-blur-md text-white font-extrabold px-4 py-2 rounded-xl shadow-2xl border border-rose-400 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-300" />
            <span>⚠️ 不要往下看! DON'T LOOK DOWN! (Vertigo Warning)</span>
          </div>
        )}

        {/* Right: Fuel & Stats & Power-Ups */}
        <div className="pointer-events-auto flex flex-col items-end gap-2.5">
          {/* Boost Jump Fuel */}
          <div className="bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
              <Flame size={16} className="text-amber-400 fill-amber-400" />
              <span>Boost Jumps (双跳燃料):</span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-5 rounded-sm transition-all ${
                    i < jumpFuel
                      ? 'bg-gradient-to-t from-cyan-500 to-emerald-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                      : 'bg-slate-800 border border-slate-700'
                  }`}
                />
              ))}
            </div>
            <span className="font-mono text-cyan-300 font-black text-sm">{jumpFuel}</span>
          </div>

          {/* Active Buff Indicator */}
          {activeBuff && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg">
              <Zap size={14} className="text-emerald-400 fill-emerald-400" />
              <span>{activeBuff.name}</span>
              <span className="font-mono bg-emerald-900/60 px-1.5 py-0.5 rounded text-[10px]">
                {activeBuff.secondsLeft}s
              </span>
            </div>
          )}

          {/* Exit / Return Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={respawnAtCheckpoint}
              className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              title="Reset to last activated checkpoint (R)"
            >
              <RotateCcw size={13} />
              <span>Checkpoint (R)</span>
            </button>
            <button
              onClick={onExit}
              className="bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Exit Course
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM-LEFT: CONTROLS DOCK */}
      <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-300 max-w-sm pointer-events-none hidden sm:block shadow-xl">
        <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
          <Sparkles size={14} className="text-cyan-400" />
          <span>Don't Look Down Parkour Controls</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <div><strong className="text-cyan-300">WASD / Arrows:</strong> Move</div>
          <div><strong className="text-cyan-300">Space:</strong> Jump</div>
          <div><strong className="text-cyan-300">Double Space:</strong> Boost Jump</div>
          <div><strong className="text-cyan-300">Mouse Drag:</strong> Tilt Camera</div>
          <div><strong className="text-cyan-300">[E]:</strong> Answer Terminal</div>
          <div><strong className="text-cyan-300">[R]:</strong> Respawn at CP</div>
        </div>
      </div>

      {/* BOTTOM-RIGHT: MANDARIN POWER-UP BAR */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 pointer-events-auto">
        {MANDARIN_POWER_UPS.map((pu) => {
          const unlocked = isPowerUpUnlocked(pu, player);
          return (
            <button
              key={pu.id}
              onClick={() => unlocked && handleTriggerPowerUp(pu)}
              disabled={!unlocked || !!activeBuff}
              className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 group relative ${
                unlocked
                  ? 'bg-slate-900/90 border-cyan-500/40 hover:border-cyan-400 text-white shadow-lg active:scale-95 hover:bg-cyan-950/40'
                  : 'bg-slate-950/60 border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
              }`}
              title={unlocked ? `${pu.name} (${pu.hanziName})` : pu.unlockRequirementText}
            >
              <Zap
                size={18}
                style={{ color: unlocked ? pu.color : '#64748b' }}
                className={unlocked ? 'group-hover:scale-110 transition-transform' : ''}
              />
              <span className="text-[10px] font-bold font-['Barlow_Condensed'] uppercase tracking-wider">
                {pu.hanziName.slice(0, 2)}
              </span>
            </button>
          );
        })}

        {/* Mobile Quick Answer Station Trigger */}
        <button
          onClick={() => openQuestionTerminal()}
          className="sm:hidden p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-black shadow-xl active:scale-95 flex items-center gap-1.5"
        >
          <HelpCircle size={18} />
          <span className="text-xs">Answer (E)</span>
        </button>
      </div>

      {/* QUESTION KIOSK MODAL */}
      {kioskOpen && currentQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
                  题
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Ascension Question Terminal</h3>
                  <p className="text-[11px] text-cyan-400">Answer correctly to recharge Boost Jump & unlock CP</p>
                </div>
              </div>
              <button
                onClick={() => setKioskOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Hanzi Card */}
            <div className="my-5 p-5 bg-gradient-to-b from-slate-950 to-cyan-950/40 border border-cyan-500/30 rounded-2xl text-center">
              <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 tracking-wide font-['Noto_Sans_SC',sans-serif]">
                {currentQuestion.hanzi}
              </div>
              <div className="text-sm font-mono text-cyan-300 mt-1.5">
                {currentQuestion.pinyin}
              </div>
              <div className="text-xs text-slate-400 mt-2 font-medium">
                Choose the correct English meaning:
              </div>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-1 gap-2.5 mb-5">
              {currentQuestion.options.map((opt, idx) => {
                let btnStyle = 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200';
                if (questionAnswered) {
                  if (idx === currentQuestion.correctIndex) {
                    btnStyle = 'bg-emerald-600/90 border-emerald-400 text-white font-bold shadow-lg';
                  } else if (idx === selectedOption) {
                    btnStyle = 'bg-rose-600/80 border-rose-400 text-white';
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerQuestion(idx)}
                    disabled={questionAnswered}
                    className={`w-full py-3 px-4 rounded-xl border text-sm font-semibold transition-all text-left flex items-center justify-between ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {questionAnswered && idx === currentQuestion.correctIndex && (
                      <span className="text-xs font-mono font-bold text-emerald-200">✓ Correct</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation & Action Footer */}
            {questionAnswered && (
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 mb-4 animate-in fade-in">
                <div className="font-bold text-cyan-400 mb-1">
                  {isAnswerCorrect ? '🎉 Great Job! Boost Jump Fuel Recharged!' : '💡 Tip / 提示:'}
                </div>
                <div>{currentQuestion.explanation || currentQuestion.english}</div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setKioskOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg transition-all"
              >
                {questionAnswered ? 'Resume Climbing (继续攀登)' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUMMIT VICTORY MODAL */}
      {isVictory && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <Award size={36} />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Celestial Summit Conquered!
            </h2>
            <div className="text-base font-extrabold text-amber-400 my-1 font-['Noto_Sans_SC',sans-serif]">
              登峰造极 · 胜者为王
            </div>
            <p className="text-xs text-slate-300 mb-6">
              You ascended 220 meters through the clouds and answered the Mandarin challenge stations!
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Bonus XP</div>
                <div className="text-lg font-black text-cyan-300">+600 XP</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">V-Coins</div>
                <div className="text-lg font-black text-amber-300">+500</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setIsVictory(false);
                  playerPosRef.current.set(0, 1.5, 0);
                  setActiveCheckpoint(0);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-extrabold text-sm shadow-xl transition-all"
              >
                Play Again from Basecamp
              </button>
              <button
                onClick={onExit}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all"
              >
                Back to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
