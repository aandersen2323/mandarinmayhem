import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PlayerProfile, SkinItem, MandarinQuestion, MandarinPowerUp } from '../types/game';
import { MANDARIN_QUESTIONS } from '../data/mandarinData';
import { MANDARIN_POWER_UPS, isPowerUpUnlocked } from '../data/powerUpData';
import { buildCustomAvatarMesh, ArticulatedAvatar } from '../utils/avatar3d';
import { sounds } from '../utils/audio';
import {
  Compass,
  Zap,
  Flag,
  Award,
  Sparkles,
  HelpCircle,
  RotateCcw,
  Flame,
  AlertTriangle,
  Pause,
  Play,
  Shield,
  Volume2,
  X,
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
  mesh?: THREE.Mesh | THREE.Group;
  checkpointId?: number; // If this platform is the confirmed landing deck of a checkpoint
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
}

const CHECKPOINTS_DATA: CheckpointLocation[] = [
  { id: 0, name: 'Basecamp Landing', hanziName: '大本营', altitude: 0, x: 0, y: 1.5, z: 0 },
  { id: 1, name: 'Cloud Foothills Pavilion', hanziName: '云海脚营', altitude: 40, x: 0, y: 41.5, z: 28 },
  { id: 2, name: 'Jade Sky Springs Temple', hanziName: '天桥弹射台', altitude: 80, x: 14, y: 81.5, z: 0 },
  { id: 3, name: 'Cyber Pagoda Tier', hanziName: '九霄宝塔阁', altitude: 130, x: -12, y: 131.5, z: -14 },
  { id: 4, name: 'Stratosphere Quantum Leap', hanziName: '平流层微光', altitude: 180, x: 8, y: 181.5, z: 12 },
  { id: 5, name: 'Celestial Summit Gateway', hanziName: '天门之巅 (登峰造极)', altitude: 220, x: 0, y: 222.5, z: 0 },
];

export const DontLookDownView: React.FC<DontLookDownViewProps> = ({
  player,
  equippedSkin,
  onUpdatePlayer,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // HUD & UI States
  const [currentAltitude, setCurrentAltitude] = useState<number>(0);
  const [maxAltitudeReached, setMaxAltitudeReached] = useState<number>(
    player.dontLookDownBestAltitude || 0
  );
  const [activeCheckpoint, setActiveCheckpoint] = useState<number>(0);
  const [unlockedCheckpoints, setUnlockedCheckpoints] = useState<number[]>([0]);
  const [jumpFuel, setJumpFuel] = useState<number>(6);
  const [earnedCoins, setEarnedCoins] = useState<number>(0);
  const [consecutiveAnswers, setConsecutiveAnswers] = useState<number>(0);
  const [isLookingDown, setIsLookingDown] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [bounceNotification, setBounceNotification] = useState<string | null>(null);

  // Pause & Reload Shield States
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [outOfReloadsModal, setOutOfReloadsModal] = useState<boolean>(false);

  // Question Kiosk Modal State
  const [kioskOpen, setKioskOpen] = useState<boolean>(false);
  const [kioskSource, setKioskSource] = useState<'normal' | 'emergency_reload'>('normal');
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
  const safetyShieldMeshRef = useRef<THREE.Mesh | null>(null);
  const platformsRef = useRef<PlatformCollider[]>([]);
  const rampsRef = useRef<RampCollider[]>([]);
  const terminalsRef = useRef<{ id: number; x: number; y: number; z: number; mesh: THREE.Group }[]>([]);
  const movingMeshesRef = useRef<{ collider: PlatformCollider; mesh: THREE.Mesh | THREE.Group }[]>([]);
  const rotatingGearsRef = useRef<THREE.Group[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Player Kinematics
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.5, 0));
  const playerVelRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef<boolean>(true);
  const doubleJumpAvailableRef = useRef<boolean>(true);
  const cameraPitchRef = useRef<number>(0.2); // vertical tilt
  const cameraYawRef = useRef<number>(0); // horizontal orbit

  // Game Runtime State REFS (Crucial: prevents Three.js from resetting!)
  const activeCheckpointRef = useRef<number>(0);
  const unlockedCheckpointsRef = useRef<Set<number>>(new Set([0]));
  const jumpFuelRef = useRef<number>(6);
  const isPausedRef = useRef<boolean>(false);
  const isKioskOpenRef = useRef<boolean>(false);
  const isOutOfReloadsRef = useRef<boolean>(false);
  const activeBuffRef = useRef(activeBuff);
  const onUpdatePlayerRef = useRef(onUpdatePlayer);
  const maxAltitudeReachedRef = useRef<number>(player.dontLookDownBestAltitude || 0);

  // Keep refs in sync with external props/state without re-running Three.js effect
  useEffect(() => {
    activeBuffRef.current = activeBuff;
  }, [activeBuff]);

  useEffect(() => {
    onUpdatePlayerRef.current = onUpdatePlayer;
  }, [onUpdatePlayer]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isKioskOpenRef.current = kioskOpen;
  }, [kioskOpen]);

  useEffect(() => {
    isOutOfReloadsRef.current = outOfReloadsModal;
  }, [outOfReloadsModal]);

  // Controls Keys
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Question Bank Filtered by Tier
  const getRelevantQuestions = useCallback(() => {
    const playerTier = player.mandarinMastery?.tier || 1;
    return MANDARIN_QUESTIONS.filter((q) => !q.difficulty || q.difficulty <= playerTier);
  }, [player.mandarinMastery?.tier]);

  // Open Terminal
  const openQuestionTerminal = useCallback((source: 'normal' | 'emergency_reload' = 'normal') => {
    const pool = getRelevantQuestions();
    const rand = pool[Math.floor(Math.random() * pool.length)] || MANDARIN_QUESTIONS[0];
    setCurrentQuestion(rand);
    setSelectedOption(null);
    setQuestionAnswered(false);
    setKioskSource(source);
    setKioskOpen(true);
    isKioskOpenRef.current = true;
    // Auto-freeze player motion when kiosk opens
    playerVelRef.current.set(0, 0, 0);
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
      const bonusCoins = 50 * (activeBuffRef.current?.multiplier || 1);
      const bonusXp = 60 * (activeBuffRef.current?.multiplier || 1);

      setEarnedCoins((c) => c + bonusCoins);
      setConsecutiveAnswers((s) => s + 1);

      // Add +4 Boost Jumps / Reloads!
      const newFuel = Math.min(12, jumpFuelRef.current + 4);
      jumpFuelRef.current = newFuel;
      setJumpFuel(newFuel);

      // If this was an emergency reload, close the modal and resume safely!
      if (kioskSource === 'emergency_reload') {
        setOutOfReloadsModal(false);
        isOutOfReloadsRef.current = false;
        setIsPaused(false);
        isPausedRef.current = false;
        setBounceNotification('⚡ BOOST RELOADED! +4 JUMPS READY!');
        setTimeout(() => setBounceNotification(null), 1800);
      }

      onUpdatePlayerRef.current((prev) => ({
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
      // Give 2 pity reloads so player is never trapped forever
      const newFuel = Math.max(jumpFuelRef.current, 2);
      jumpFuelRef.current = newFuel;
      setJumpFuel(newFuel);
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
      const newFuel = jumpFuelRef.current + 4;
      jumpFuelRef.current = newFuel;
      setJumpFuel(newFuel);
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

  // Respawn safely at the confirmed active checkpoint
  const respawnAtCheckpoint = useCallback(() => {
    const cpId = activeCheckpointRef.current;
    const cp = CHECKPOINTS_DATA[cpId] || CHECKPOINTS_DATA[0];
    playerPosRef.current.set(cp.x, cp.y + 1.2, cp.z);
    playerVelRef.current.set(0, 0, 0);
    isGroundedRef.current = true;
    doubleJumpAvailableRef.current = true;

    // Replenish at least 4 jumps on respawn
    const restoredFuel = Math.max(jumpFuelRef.current, 4);
    jumpFuelRef.current = restoredFuel;
    setJumpFuel(restoredFuel);

    setOutOfReloadsModal(false);
    isOutOfReloadsRef.current = false;
    setIsPaused(false);
    isPausedRef.current = false;

    sounds.playDamage();
    setBounceNotification(`Respawned at ${cp.name}`);
    setTimeout(() => setBounceNotification(null), 1500);
  }, []);

  // Build Floating 3D Text Label Sprite
  const makeTextSprite = (text: string, bgColor: string = '#0284c7', textColor: string = '#ffffff') => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = bgColor;
      ctx.roundRect(8, 8, 496, 112, 24);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.font = 'bold 42px sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(6, 1.5, 1);
    return sprite;
  };

  // Toggle Pause
  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      isPausedRef.current = next;
      if (next) {
        playerVelRef.current.set(0, 0, 0);
        sounds.playShoot();
      } else {
        sounds.playPowerUp();
      }
      return next;
    });
  }, []);

  // ==========================================
  // INITIALIZE 3D WORLD SCENE ONCE
  // ==========================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    scene.background = new THREE.Color(0x0a192f);
    scene.fog = new THREE.FogExp2(0x0a192f, 0.007);

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
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    sunLight.position.set(50, 150, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 500;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x06b6d4, 0x1e1b4b, 0.7);
    scene.add(hemiLight);

    // 3. Materials
    const baseGreenMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 });
    const walkwayMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.6,
      roughness: 0.3,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.4,
      roughness: 0.6,
    });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 });
    const pagodaRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45 });
    const pagodaGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
    });
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
    });

    const platforms: PlatformCollider[] = [];
    const ramps: RampCollider[] = [];
    const movingList: { collider: PlatformCollider; mesh: THREE.Mesh | THREE.Group }[] = [];
    const gearsList: THREE.Group[] = [];
    const terminals: { id: number; x: number; y: number; z: number; mesh: THREE.Group }[] = [];

    // Helper: Add static platform with optional railings & backstops
    const addPlatform = (
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      h: number = 0.8,
      mat: THREE.Material = walkwayMat,
      withRails: boolean = false,
      checkpointId?: number
    ) => {
      const group = new THREE.Group();
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Add guard railings if requested
      if (withRails) {
        const railMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.8 });
        const railL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, d), railMat);
        railL.position.set(x - w / 2 + 0.15, y + h + 0.45, z);
        group.add(railL);

        const railR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, d), railMat);
        railR.position.set(x + w / 2 - 0.15, y + h + 0.45, z);
        group.add(railR);
      }

      scene.add(group);

      const collider: PlatformCollider = {
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        y: y + h,
        height: h,
        mesh,
        checkpointId,
      };
      platforms.push(collider);
      return group;
    };

    // Helper: Add Overshoot Backstop Wall behind bouncy landing decks
    const addBackstopWall = (x: number, y: number, z: number, w: number, h: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), barrierMat);
      wall.position.set(x, y + h / 2, z);
      scene.add(wall);
    };

    // Helper: Add Super Bounce Pad with Glowing Launch Rings & Sign
    const addSuperBouncePad = (
      x: number,
      y: number,
      z: number,
      w: number = 7,
      d: number = 7,
      bouncePower: number = 29
    ) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      // Base frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.5, d + 1), frameMat);
      frame.position.y = 0.25;
      group.add(frame);

      // Glowing Spring Bed
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.9,
        roughness: 0.15,
      });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), padMat);
      pad.position.y = 0.5;
      pad.castShadow = true;
      group.add(pad);

      // Hovering Energetic Jump Rings
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.4, 0.12, 8, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.1;
      group.add(ring);

      // Floating 3D Sign above pad
      const sign = makeTextSprite('🚀 SUPER BOUNCE (跳跃弹射)', '#059669');
      sign.position.set(0, 3.4, 0);
      group.add(sign);

      scene.add(group);

      const collider: PlatformCollider = {
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        y: y + 0.8,
        height: 0.8,
        isBouncePad: true,
        bouncePower,
        mesh: pad,
      };
      platforms.push(collider);
    };

    // Helper: Add Moving Platform
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
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: 0x0284c7,
          emissiveIntensity: 0.6,
          metalness: 0.7,
          roughness: 0.2,
        })
      );
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

      const geo = new THREE.BoxGeometry(width, 0.5, hypot);
      const rotX = endZ > startZ ? -angle : angle;
      const mesh = new THREE.Mesh(geo, woodMat);
      mesh.position.set(centerX, centerY, centerZ);
      mesh.rotation.x = rotX;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      ramps.push({
        minX: centerX - width / 2 - 0.4,
        maxX: centerX + width / 2 + 0.4,
        minZ: Math.min(startZ, endZ) - 0.5,
        maxZ: Math.max(startZ, endZ) + 0.5,
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
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.4, 8), pagodaGoldMat);
      ped.position.y = 0.7;
      termGroup.add(ped);

      // Holographic Chinese Character Octagon
      const holo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 0.25, 8),
        new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.9,
          roughness: 0.1,
        })
      );
      holo.position.y = 1.6;
      holo.rotation.x = 0.3;
      termGroup.add(holo);

      // Floating Beacon Light
      const beaconLight = new THREE.PointLight(0x06b6d4, 2.5, 12);
      beaconLight.position.set(0, 2.4, 0);
      termGroup.add(beaconLight);

      // Floating sign
      const sign = makeTextSprite(`🏮 ${label} [E]`, '#0891b2');
      sign.position.set(0, 2.8, 0);
      termGroup.add(sign);

      scene.add(termGroup);
      terminals.push({ id, x, y, z, mesh: termGroup });
    };

    // Helper: Add Directional Guidance Sign in 3D
    const addGuidanceSign = (x: number, y: number, z: number, text: string) => {
      const sprite = makeTextSprite(text, '#1e293b', '#38bdf8');
      sprite.position.set(x, y + 2.0, z);
      scene.add(sprite);
    };

    // ==========================================
    // BUILD DIVERSE VERTICAL 3D COURSE (0m to 220m)
    // ==========================================

    // ZONE 0: BASECAMP (0m - 10m)
    addPlatform(0, 0, 0, 22, 22, 1.2, baseGreenMat, true, 0);
    addTerminal(0, 0, 1.2, -6, 'Basecamp Reload Kiosk');
    addGuidanceSign(0, 1.8, 8, '➔ CLIMB PATHWAY (由此向前攀登) ➔');

    // ZONE 1: CLOUD FOOTHILLS (10m - 40m)
    addPlatform(0, 4, 14, 8, 10, 0.8, walkwayMat, true);
    addRamp(0, 5, 18, 28, 4.8, 16);

    // Pagoda Terrace at 16m
    addPlatform(0, 16, 32, 12, 12, 1.0, pagodaGoldMat);
    addGuidanceSign(0, 18, 32, '壹 ➔ 贰 ➔ 叁 STEPPING STONES');

    // Numbered Stepping Stones
    const stones = [
      { num: '壹 1', x: 7, y: 20, z: 32 },
      { num: '贰 2', x: 13, y: 24, z: 28 },
      { num: '叁 3', x: 14, y: 28, z: 20 },
      { num: '肆 4', x: 8, y: 32, z: 16 },
    ];
    stones.forEach((s) => {
      addPlatform(s.x, s.y, s.z, 5.5, 5.5, 0.8, stoneMat);
      addGuidanceSign(s.x, s.y + 0.8, s.z, s.num);
    });

    // Launch Deck 1: Super Bounce Pad to Floor 1
    addPlatform(0, 34, 18, 11, 11, 0.8, walkwayMat);
    addSuperBouncePad(0, 34.8, 23, 7, 7, 27);

    // CHECKPOINT 1: CLOUD FOOTHILLS PAVILION (40m)
    // Generously sized 18x18 landing deck directly catching the launch!
    addPlatform(0, 40, 28, 18, 18, 1.2, pagodaGoldMat, false, 1);
    addBackstopWall(0, 41.2, 37, 18, 6); // Safety backstop so player never overshoots!
    addTerminal(1, 0, 41.2, 24, 'Cloud Temple Checkpoint 1');
    addGuidanceSign(0, 43, 33, '⛩️ CHECKPOINT 1 (第一营地 - 40m) ⛩️');

    // ZONE 2: JADE SKY BRIDGES (40m - 80m)
    addMovingPlatform(0, 47, 18, 8, 8, 'x', 10, 2.2);
    addPlatform(0, 52, 6, 11, 11, 0.8, walkwayMat);
    addGuidanceSign(0, 54, 6, '➔ MOVING SKYWAYS (横渡天桥)');

    addRamp(0, 4.5, 5, -8, 52.8, 64);
    addPlatform(0, 64, -12, 10, 10, 1.0, stoneMat);

    addMovingPlatform(0, 70, -2, 7, 7, 'z', 7, 2.4);

    // Super Bounce Pad 2 launching directly onto Checkpoint 2 (80m)
    addPlatform(10, 72, 0, 10, 10, 0.8, walkwayMat);
    addSuperBouncePad(14, 72.8, 0, 7, 7, 27);

    // CHECKPOINT 2: SKY SPRINGS TEMPLE (80m)
    addPlatform(14, 80, 0, 18, 18, 1.4, pagodaRedMat, false, 2);
    addBackstopWall(14, 81.4, 9, 18, 6);
    addTerminal(2, 14, 81.4, -4, 'Sky Springs Checkpoint 2');
    addGuidanceSign(14, 83.2, 5, '⛩️ CHECKPOINT 2 (第二营地 - 80m) ⛩️');

    // ZONE 3: CYBER PAGODA & ROTATING GEARS (80m - 130m)
    addPlatform(4, 88, -6, 8, 8, 0.8, walkwayMat);
    addPlatform(-4, 96, -10, 9, 9, 0.8, walkwayMat);
    addRamp(-4, 4.5, -9, -18, 96.8, 108);

    addPlatform(-4, 108, -22, 11, 11, 1.0, pagodaGoldMat);
    addGuidanceSign(-4, 110, -22, '➔ ROTATING CELESTIAL GEARS');

    // Rotating Celestial Gear
    const gearGroup = new THREE.Group();
    gearGroup.position.set(-12, 116, -18);
    const gearHub = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.8, 16), pagodaGoldMat);
    gearGroup.add(gearHub);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(11, 0.6, 3), walkwayMat);
      spoke.rotation.y = (i * Math.PI) / 2;
      gearGroup.add(spoke);
    }
    scene.add(gearGroup);
    gearsList.push(gearGroup);

    platforms.push({
      minX: -18,
      maxX: -6,
      minZ: -24,
      maxZ: -12,
      y: 116.8,
      height: 0.8,
      mesh: gearGroup,
    });

    // Super Bounce Pad 3 launching onto Checkpoint 3 (130m)
    addPlatform(-12, 122, -14, 10, 10, 0.8, walkwayMat);
    addSuperBouncePad(-12, 122.8, -14, 7, 7, 27);

    // CHECKPOINT 3: NINE HEAVENS CYBER PAGODA (130m)
    addPlatform(-12, 130, -14, 19, 19, 1.5, pagodaGoldMat, false, 3);
    addBackstopWall(-12, 131.5, -5, 19, 6);
    addTerminal(3, -12, 131.5, -18, 'Nine Heavens Pagoda Checkpoint 3');
    addGuidanceSign(-12, 133.5, -9, '⛩️ CHECKPOINT 3: CYBER PAGODA (130m) ⛩️');

    // ZONE 4: STRATOSPHERE QUANTUM LEAP (130m - 180m)
    addPlatform(-2, 139, -6, 8, 8, 0.8, walkwayMat);
    addPlatform(6, 148, 0, 8, 8, 0.8, walkwayMat);
    addMovingPlatform(8, 156, 8, 7, 7, 'x', 9, 2.8);

    addRamp(8, 4.5, 9, 19, 160, 172);
    addPlatform(8, 172, 22, 10, 10, 1.0, stoneMat);

    // Super Bounce Pad 4 to Checkpoint 4 (180m)
    addSuperBouncePad(8, 172.8, 14, 7, 7, 27);

    // CHECKPOINT 4: STRATOSPHERE SANCTUARY (180m)
    addPlatform(8, 180, 12, 19, 19, 1.5, pagodaRedMat, false, 4);
    addBackstopWall(8, 181.5, 21, 19, 6);
    addTerminal(4, 8, 181.5, 8, 'Stratosphere Sanctuary Checkpoint 4');
    addGuidanceSign(8, 183.5, 17, '⛩️ CHECKPOINT 4: STRATOSPHERE (180m) ⛩️');

    // ZONE 5: CELESTIAL SUMMIT GATEWAY (180m - 220m)
    addPlatform(4, 190, 4, 7, 7, 0.8, walkwayMat);
    addGuidanceSign(4, 192, 4, '登 ➔ ASCEND');

    addPlatform(0, 200, 0, 8, 8, 0.8, walkwayMat);
    addGuidanceSign(0, 202, 0, '峰 ➔ SUMMIT');

    // Grand Launching Pad 5 directly into Summit Dragon Gate (220m)!
    addSuperBouncePad(0, 208, 0, 8, 8, 30);

    // SUMMIT PALACE (220m)
    addPlatform(0, 220, 0, 26, 26, 2.5, pagodaGoldMat, false, 5);
    addTerminal(5, 0, 222.5, -8, 'Summit Dragon Bell');

    // Grand Archway at the Summit
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 222.5, 0);

    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 14, 16), pagodaRedMat);
    pillarL.position.set(-7, 7, 0);
    archGroup.add(pillarL);

    const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 14, 16), pagodaRedMat);
    pillarR.position.set(7, 7, 0);
    archGroup.add(pillarR);

    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(18, 2.5, 3), pagodaGoldMat);
    archBeam.position.set(0, 14, 0);
    archGroup.add(archBeam);

    const dragonCrown = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.7, 16, 32),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
      })
    );
    dragonCrown.position.set(0, 16.5, 0);
    archGroup.add(dragonCrown);

    const summitSign = makeTextSprite('👑 登峰造极 · 胜者为王 (SUMMIT CONQUERED) 👑', '#d97706');
    summitSign.position.set(0, 19, 0);
    archGroup.add(summitSign);

    scene.add(archGroup);

    platformsRef.current = platforms;
    rampsRef.current = ramps;
    movingMeshesRef.current = movingList;
    rotatingGearsRef.current = gearsList;
    terminalsRef.current = terminals;

    // 4. Build Safety Forcefield Sphere around avatar (visible when paused / out of fuel)
    const shieldGeo = new THREE.SphereGeometry(1.6, 24, 24);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.45,
      wireframe: true,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.visible = false;
    scene.add(shieldMesh);
    safetyShieldMeshRef.current = shieldMesh;

    // 5. Player Avatar Model
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
    const initialCp = CHECKPOINTS_DATA[activeCheckpointRef.current] || CHECKPOINTS_DATA[0];
    playerPosRef.current.set(initialCp.x, initialCp.y + 1.2, initialCp.z);

    // 6. Input Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      // Toggle Pause with Escape or P key
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        togglePause();
        return;
      }

      // If paused or in kiosk, ignore movement keys
      if (isPausedRef.current || isKioskOpenRef.current || isOutOfReloadsRef.current) {
        return;
      }

      keysRef.current[e.key.toLowerCase()] = true;

      // Space Jump
      if (e.code === 'Space') {
        if (isGroundedRef.current) {
          playerVelRef.current.y = 13.5;
          isGroundedRef.current = false;
          doubleJumpAvailableRef.current = true;
          sounds.playShoot();
        } else if (doubleJumpAvailableRef.current) {
          if (jumpFuelRef.current > 0) {
            // Rocket Double Jump
            playerVelRef.current.y = 15.5;
            doubleJumpAvailableRef.current = false;

            const remaining = jumpFuelRef.current - 1;
            jumpFuelRef.current = remaining;
            setJumpFuel(remaining);
            sounds.playPowerUp();

            // Thruster fire flash
            if (avatar.flameMeshL) avatar.flameMeshL.visible = true;
            if (avatar.flameMeshR) avatar.flameMeshR.visible = true;
            setTimeout(() => {
              if (avatar.flameMeshL) avatar.flameMeshL.visible = false;
              if (avatar.flameMeshR) avatar.flameMeshR.visible = false;
            }, 350);

            // If we just exhausted our last reload:
            if (remaining === 0) {
              setBounceNotification('⚠️ LAST RELOAD USED! Answer question to recharge!');
              setTimeout(() => setBounceNotification(null), 2000);
            }
          } else {
            // Out of Reloads! Don't let player die!
            // Activate anti-gravity safety lock and pause game!
            isOutOfReloadsRef.current = true;
            setOutOfReloadsModal(true);
            playerVelRef.current.set(0, 0, 0); // freeze motion
            sounds.playDamage();
          }
        }
      }

      // E to interact with question terminal
      if (e.key.toLowerCase() === 'e') {
        const pPos = playerPosRef.current;
        const nearest = terminalsRef.current.find((t) => {
          const dist = Math.hypot(pPos.x - t.x, pPos.y - t.y, pPos.z - t.z);
          return dist <= 7.0;
        });
        if (nearest) {
          openQuestionTerminal('normal');
        } else {
          // Open normal reload kiosk anywhere with E
          openQuestionTerminal('normal');
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

    // 7. Game Loop Clock
    let lastTime = performance.now();
    let altitudeThrottle = 0;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Check if paused or out of reloads
      const isGamePaused =
        isPausedRef.current || isKioskOpenRef.current || isOutOfReloadsRef.current;

      const pPos = playerPosRef.current;
      const pVel = playerVelRef.current;

      // Sync safety shield mesh visibility
      if (safetyShieldMeshRef.current) {
        safetyShieldMeshRef.current.position.set(pPos.x, pPos.y + 0.9, pPos.z);
        safetyShieldMeshRef.current.visible = isGamePaused;
        if (isGamePaused) {
          safetyShieldMeshRef.current.rotation.y += 0.02;
        }
      }

      // If game is paused, DO NOT advance physics, DO NOT apply gravity, DO NOT trigger falls!
      if (isGamePaused) {
        pVel.set(0, 0, 0); // Completely frozen safely in place
        // Still render scene so camera and visuals stay active
        if (avatarRef.current) {
          avatarRef.current.group.position.copy(pPos);
        }
        renderer.render(scene, camera);
        return;
      }

      // Animate Moving Platforms
      const tSec = now / 1000;
      movingMeshesRef.current.forEach(({ collider, mesh }) => {
        if (!collider.moveRange || collider.initialX === undefined || collider.initialZ === undefined) return;
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

      // Animate Rotating Gears
      rotatingGearsRef.current.forEach((g) => {
        g.rotation.y += 0.008;
      });

      // Animate Terminals
      terminalsRef.current.forEach((t) => {
        t.mesh.rotation.y += 0.015;
      });

      // ==========================================
      // THIRD-PERSON CAMERA-RELATIVE MOVEMENT
      // ==========================================
      const keys = keysRef.current;
      let forward = 0;
      let strafe = 0;

      if (keys['w'] || keys['arrowup']) forward += 1;
      if (keys['s'] || keys['arrowdown']) forward -= 1;
      if (keys['d'] || keys['arrowright']) strafe += 1;
      if (keys['a'] || keys['arrowleft']) strafe -= 1;

      const buff = activeBuffRef.current;
      const moveSpeed = (9.5 + (buff?.speedBonus ? 6.0 : 0)) * dt;

      if (forward !== 0 || strafe !== 0) {
        const len = Math.hypot(forward, strafe);
        const nFwd = forward / len;
        const nStr = strafe / len;

        // Camera horizontal forward vector
        const fwdX = Math.sin(cameraYawRef.current);
        const fwdZ = Math.cos(cameraYawRef.current);

        // Camera horizontal right vector
        const rightX = fwdZ;
        const rightZ = -fwdX;

        // World displacement
        const worldMoveX = (fwdX * nFwd + rightX * nStr) * moveSpeed;
        const worldMoveZ = (fwdZ * nFwd + rightZ * nStr) * moveSpeed;

        pPos.x += worldMoveX;
        pPos.z += worldMoveZ;

        // Rotate avatar toward movement
        if (avatarRef.current) {
          avatarRef.current.group.rotation.y = Math.atan2(worldMoveX, worldMoveZ);

          const legSwing = Math.sin(now * 0.014) * 0.5;
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
      const gravity = 25 * (1 - (buff?.gravityReduction || 0));
      pVel.y -= gravity * dt;
      pPos.y += pVel.y * dt;

      // ==========================================
      // PLATFORM & BOUNCE PAD COLLISION
      // ==========================================
      let landed = false;
      let confirmedCheckpointLanded: number | null = null;

      // 1. Check Super Bounce Pads FIRST with generous volume trigger
      for (const p of platformsRef.current) {
        if (p.isBouncePad) {
          const padMargin = 1.2;
          if (
            pPos.x >= p.minX - padMargin &&
            pPos.x <= p.maxX + padMargin &&
            pPos.z >= p.minZ - padMargin &&
            pPos.z <= p.maxZ + padMargin &&
            pPos.y >= p.y - 1.5 &&
            pPos.y <= p.y + 2.5
          ) {
            pPos.y = p.y + 0.8;
            pVel.y = p.bouncePower || 27;
            doubleJumpAvailableRef.current = true;
            sounds.playPowerUp();
            setBounceNotification('🚀 SUPER LAUNCH! SKYWARD ASCENT!');
            setTimeout(() => setBounceNotification(null), 1200);

            landed = true;
            break;
          }
        }
      }

      // 2. Check Standard Walkable Platforms
      if (!landed) {
        for (const p of platformsRef.current) {
          if (!p.isBouncePad) {
            if (
              pPos.x >= p.minX &&
              pPos.x <= p.maxX &&
              pPos.z >= p.minZ &&
              pPos.z <= p.maxZ
            ) {
              if (pPos.y <= p.y + 0.7 && pPos.y >= p.y - 1.8 && pVel.y <= 0) {
                pPos.y = p.y;
                pVel.y = 0;
                landed = true;
                doubleJumpAvailableRef.current = true;

                if (p.checkpointId !== undefined) {
                  confirmedCheckpointLanded = p.checkpointId;
                }
                break;
              }
            }
          }
        }
      }

      // 3. Check Climbable Ramps
      if (!landed) {
        for (const r of rampsRef.current) {
          if (
            pPos.x >= r.minX &&
            pPos.x <= r.maxX &&
            pPos.z >= r.minZ &&
            pPos.z <= r.maxZ
          ) {
            const progress = (pPos.z - r.startCoord) / (r.endCoord - r.startCoord);
            if (progress >= 0 && progress <= 1) {
              const rampY = r.baseHeight + progress * (r.topHeight - r.baseHeight);
              if (pPos.y <= rampY + 0.8 && pPos.y >= rampY - 1.5 && pVel.y <= 0) {
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

      // Update Altitude (throttled for smooth HUD performance)
      const currentY = Math.max(0, Math.round(pPos.y));
      altitudeThrottle += dt;
      if (altitudeThrottle > 0.1) {
        altitudeThrottle = 0;
        setCurrentAltitude(currentY);

        if (currentY > maxAltitudeReachedRef.current) {
          maxAltitudeReachedRef.current = currentY;
          setMaxAltitudeReached(currentY);
          onUpdatePlayerRef.current((prev) => ({
            ...prev,
            dontLookDownBestAltitude: Math.max(prev.dontLookDownBestAltitude || 0, currentY),
          }));
        }
      }

      // CRITICAL: Checkpoint Unlock & Activation ONLY WHEN SAFELY GROUNDED!
      if (landed && confirmedCheckpointLanded !== null) {
        const cpId = confirmedCheckpointLanded;
        if (!unlockedCheckpointsRef.current.has(cpId)) {
          unlockedCheckpointsRef.current.add(cpId);
          activeCheckpointRef.current = cpId;
          setActiveCheckpoint(cpId);
          setUnlockedCheckpoints(Array.from(unlockedCheckpointsRef.current));
          sounds.playSuccess();
          setBounceNotification(`🎉 CHECKPOINT UNLOCKED: ${CHECKPOINTS_DATA[cpId].name}!`);
          setTimeout(() => setBounceNotification(null), 2500);
        } else if (activeCheckpointRef.current !== cpId) {
          activeCheckpointRef.current = cpId;
          setActiveCheckpoint(cpId);
        }
      }

      // Victory Condition: Summit reached (>= 220m)
      if (currentY >= 220 && !isVictory) {
        setIsVictory(true);
        sounds.playVictory();
        onUpdatePlayerRef.current((prev) => ({
          ...prev,
          vCoins: prev.vCoins + 500,
          xp: prev.xp + 600,
          arenaVictories: prev.arenaVictories + 1,
        }));
      }

      // OUT OF RELOADS EMERGENCY HOVER CHECK:
      // If player is out of reloads (fuel === 0) and falling below their safe landing zone,
      // PAUSE THE GAME IMMEDIATELY AND DON'T LET THEM DIE!
      const currentSafeY = CHECKPOINTS_DATA[activeCheckpointRef.current]?.altitude || 0;
      if (jumpFuelRef.current === 0 && pPos.y < currentSafeY - 2 && pVel.y < -3) {
        isOutOfReloadsRef.current = true;
        setOutOfReloadsModal(true);
        pVel.set(0, 0, 0); // freeze motion
        sounds.playDamage();
      }

      // Abyss Fall Check: Only triggers if player falls far below the CURRENT confirmed checkpoint
      if (pPos.y < currentSafeY - 20 && pVel.y < -10) {
        respawnAtCheckpoint();
      }

      // Sync Avatar 3D Position
      if (avatarRef.current) {
        avatarRef.current.group.position.copy(pPos);
      }

      // Orbit Camera Follow
      const camDist = 7.0;
      const camHeight = 3.5;
      const camX = pPos.x - Math.sin(cameraYawRef.current) * Math.cos(cameraPitchRef.current) * camDist;
      const camY = pPos.y + camHeight + Math.sin(cameraPitchRef.current) * camDist;
      const camZ = pPos.z - Math.cos(cameraYawRef.current) * Math.cos(cameraPitchRef.current) * camDist;

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.15);
      camera.lookAt(pPos.x, pPos.y + 1.8, pPos.z);

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
  }, [equippedSkin, openQuestionTerminal, player, respawnAtCheckpoint, togglePause, isVictory]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden select-none">
      {/* 3D Canvas Viewport */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP HUD: Altitude Bar & Zone Badge */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none">
        {/* Left: Altitude Progress Tracker */}
        <div className="pointer-events-auto bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 shadow-xl min-w-[270px]">
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

          {/* Altitude Gauge */}
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-cyan-500/20">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (currentAltitude / 220) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>Base 0m</span>
            <span>CP1 40m</span>
            <span>CP2 80m</span>
            <span>CP3 130m</span>
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

        {/* Center: Vertigo Warning & Bounce Toast */}
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          {bounceNotification && (
            <div className="animate-bounce bg-emerald-600/95 backdrop-blur-md text-white font-black px-5 py-2.5 rounded-2xl shadow-2xl border border-emerald-400 flex items-center gap-2 text-sm">
              <Zap size={18} className="text-yellow-300 fill-yellow-300" />
              <span>{bounceNotification}</span>
            </div>
          )}

          {isLookingDown && (
            <div className="animate-pulse bg-rose-600/90 backdrop-blur-md text-white font-extrabold px-4 py-2 rounded-xl shadow-2xl border border-rose-400 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-300" />
              <span>⚠️ 不要往下看! DON'T LOOK DOWN! (Vertigo Warning)</span>
            </div>
          )}
        </div>

        {/* Right: Fuel & Stats & Pause / Exit Actions */}
        <div className="pointer-events-auto flex flex-col items-end gap-2.5">
          {/* Boost Jump Fuel / Reloads */}
          <div className="bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
              <Flame size={16} className="text-amber-400 fill-amber-400" />
              <span>Boost Reloads (双跳燃料):</span>
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
            <button
              onClick={() => openQuestionTerminal('normal')}
              className="ml-1 text-[11px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
              title="Answer question to add +4 Boost Reloads"
            >
              +Reload
            </button>
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

          {/* Pause, Reset & Exit Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePause}
              className={`border px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                isPaused
                  ? 'bg-amber-600 border-amber-400 text-white animate-pulse'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-cyan-500/40 text-cyan-300 hover:text-white'
              }`}
              title="Pause Game & Freeze Hazards (P or Esc)"
            >
              {isPaused ? <Play size={13} /> : <Pause size={13} />}
              <span>{isPaused ? 'Resume' : 'Pause (P)'}</span>
            </button>
            <button
              onClick={respawnAtCheckpoint}
              className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              title="Reset to last activated checkpoint (R)"
            >
              <RotateCcw size={13} />
              <span>Respawn (R)</span>
            </button>
            <button
              onClick={onExit}
              className="bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM-LEFT: CONTROLS DOCK */}
      <div className="absolute bottom-4 left-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-300 max-w-sm pointer-events-none hidden sm:block shadow-xl">
        <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
          <Sparkles size={14} className="text-cyan-400" />
          <span>Don't Look Down Course Guide</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <div><strong className="text-cyan-300">W:</strong> Forward (Camera view)</div>
          <div><strong className="text-cyan-300">S:</strong> Backward</div>
          <div><strong className="text-cyan-300">A / D:</strong> Strafe Left / Right</div>
          <div><strong className="text-cyan-300">Space:</strong> Jump</div>
          <div><strong className="text-cyan-300">Double Space:</strong> Boost Jump (Reload)</div>
          <div><strong className="text-cyan-300">P / Esc:</strong> Pause Game & Safe Freeze</div>
          <div><strong className="text-cyan-300">[E]:</strong> Question Kiosk (Recharge)</div>
          <div><strong className="text-cyan-300">[R]:</strong> Respawn at Checkpoint</div>
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
          onClick={() => openQuestionTerminal('normal')}
          className="sm:hidden p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-black shadow-xl active:scale-95 flex items-center gap-1.5"
        >
          <HelpCircle size={18} />
          <span className="text-xs">Answer (E)</span>
        </button>
      </div>

      {/* PAUSE MENU MODAL (FREEZES PHYSICS, PLAYER CANNOT DIE) */}
      {isPaused && !kioskOpen && !outOfReloadsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mx-auto mb-3 text-cyan-400">
              <Shield size={32} />
            </div>

            <h3 className="text-2xl font-black text-white uppercase tracking-tight">
              Game Paused (游戏暂停)
            </h3>
            <p className="text-xs text-cyan-300 mt-1 mb-5">
              🛡️ Emergency Safety Field is active! Player is invulnerable and frozen safely.
            </p>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Current Altitude:</span>
                <span className="font-bold text-cyan-400">{currentAltitude}m / 220m</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Active Checkpoint:</span>
                <span className="font-bold text-emerald-400">
                  {CHECKPOINTS_DATA[activeCheckpoint]?.name}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Boost Reloads Available:</span>
                <span className="font-bold text-amber-400">{jumpFuel} / 12</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={togglePause}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Play size={16} />
                <span>Resume Climbing (继续攀登)</span>
              </button>

              <button
                onClick={() => {
                  setIsPaused(false);
                  openQuestionTerminal('normal');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-sm border border-cyan-500/30 flex items-center justify-center gap-2 transition-all"
              >
                <HelpCircle size={15} />
                <span>Answer Mandarin Question (+4 Reloads)</span>
              </button>

              <button
                onClick={respawnAtCheckpoint}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw size={14} />
                <span>Safely Return to Checkpoint</span>
              </button>

              <button
                onClick={onExit}
                className="w-full py-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-950/60 font-semibold text-xs transition-all mt-1"
              >
                Exit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OUT OF RELOADS / EMERGENCY ANTI-GRAVITY PAUSE MODAL */}
      {outOfReloadsModal && !kioskOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center mx-auto mb-3 text-amber-400 animate-pulse">
              <Flame size={32} />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              Boost Reloads Exhausted! (燃料耗尽)
            </h3>
            <div className="text-amber-400 font-bold text-xs my-1.5 flex items-center justify-center gap-1.5">
              <Shield size={14} />
              <span>Game Paused: Emergency Anti-Gravity Lock Engaged</span>
            </div>
            <p className="text-xs text-slate-300 mb-5">
              You ran out of Boost Reloads, so the game paused to keep you safe from falling or dying!
              Answer a quick Mandarin question to immediately reload <strong className="text-cyan-300">+4 Boost Jumps</strong>!
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => openQuestionTerminal('emergency_reload')}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-400 hover:from-amber-400 text-slate-950 font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                <span>Answer Mandarin Question (+4 Reloads)</span>
              </button>

              <button
                onClick={() => {
                  setOutOfReloadsModal(false);
                  isOutOfReloadsRef.current = false;
                  setIsPaused(false);
                  isPausedRef.current = false;
                  setBounceNotification('Careful! No boost jumps remaining.');
                  setTimeout(() => setBounceNotification(null), 1500);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all"
              >
                Resume Climbing on Foot (步行攀登)
              </button>

              <button
                onClick={respawnAtCheckpoint}
                className="w-full py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
              >
                Return to Checkpoint Deck Safely
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <h3 className="font-extrabold text-white text-base">
                    {kioskSource === 'emergency_reload'
                      ? '⚡ Emergency Boost Reload Terminal'
                      : 'Ascension Question Terminal'}
                  </h3>
                  <p className="text-[11px] text-cyan-400">
                    Answer correctly to gain +4 Boost Reloads & continue safely
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setKioskOpen(false);
                  isKioskOpenRef.current = false;
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm font-bold"
              >
                <X size={18} />
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
                      <span className="text-xs font-mono font-bold text-emerald-200">✓ Correct (+4 Reloads)</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation & Action Footer */}
            {questionAnswered && (
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 mb-4 animate-in fade-in">
                <div className="font-bold text-cyan-400 mb-1">
                  {isAnswerCorrect ? '🎉 Great Job! Boost Jump Reloads Charged!' : '💡 Tip / 提示:'}
                </div>
                <div>{currentQuestion.explanation || currentQuestion.english}</div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setKioskOpen(false);
                  isKioskOpenRef.current = false;
                  if (kioskSource === 'emergency_reload') {
                    setOutOfReloadsModal(false);
                    isOutOfReloadsRef.current = false;
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg transition-all"
              >
                {questionAnswered ? 'Resume Climbing (继续攀登)' : 'Close & Resume'}
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
                  activeCheckpointRef.current = 0;
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
