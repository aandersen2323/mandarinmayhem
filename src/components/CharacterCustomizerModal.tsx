import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CharacterAvatarConfig,
  PlayerProfile,
  CosmeticOption,
  MandarinTier,
} from '../types/game';
import {
  COSMETIC_OPTIONS,
  DEFAULT_AVATAR_CONFIG,
  isCosmeticUnlocked,
} from '../data/powerUpData';
import { buildCustomAvatarMesh, ArticulatedAvatar } from '../utils/avatar3d';
import { sounds } from '../utils/audio';
import {
  Sparkles,
  Shield,
  Palette,
  Lock,
  Check,
  RotateCw,
  Award,
  Crown,
  ChevronRight,
} from 'lucide-react';

interface CharacterCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerProfile;
  onSaveConfig: (newConfig: CharacterAvatarConfig) => void;
}

type TabSlot = 'base' | 'hair' | 'hat' | 'armor' | 'back' | 'colors';

export const CharacterCustomizerModal: React.FC<CharacterCustomizerModalProps> = ({
  isOpen,
  onClose,
  player,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<TabSlot>('base');
  const [currentConfig, setCurrentConfig] = useState<CharacterAvatarConfig>(
    player.avatarConfig || DEFAULT_AVATAR_CONFIG
  );

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const avatarRef = useRef<ArticulatedAvatar | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const rotAngleRef = useRef<number>(0);

  // Initialize & Update 3D Preview
  useEffect(() => {
    if (!isOpen) return;
    const container = previewContainerRef.current;
    if (!container) return;

    // Create scene, camera, renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.4, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa855f7, 0.9);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x10b981, 1.0);
    rimLight.position.set(0, 5, -4);
    scene.add(rimLight);

    // Circular pedestal platform
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.5, 0.15, 32),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.8,
        roughness: 0.2,
      })
    );
    platform.position.y = -0.08;
    scene.add(platform);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.03, 8, 32),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.8,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0;
    scene.add(ring);

    // Build Avatar
    const avatar = buildCustomAvatarMesh(currentConfig, 0.85);
    scene.add(avatar.group);
    avatarRef.current = avatar;

    // Animation loop: subtle rotation
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (avatarRef.current) {
        avatarRef.current.group.rotation.y = rotAngleRef.current;
        // Idle breathing motion
        const breathe = Math.sin(performance.now() * 0.002) * 0.03;
        avatarRef.current.group.position.y = breathe;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isOpen]);

  // Rebuild avatar mesh when currentConfig changes
  useEffect(() => {
    if (!sceneRef.current) return;
    if (avatarRef.current) {
      sceneRef.current.remove(avatarRef.current.group);
    }
    const avatar = buildCustomAvatarMesh(currentConfig, 0.85);
    sceneRef.current.add(avatar.group);
    avatarRef.current = avatar;
  }, [currentConfig]);

  if (!isOpen) return null;

  const handleSelectItem = (item: CosmeticOption) => {
    sounds.playPowerUp();
    setCurrentConfig((prev) => {
      if (item.slot === 'base') return { ...prev, baseModelId: item.id as any };
      if (item.slot === 'hair') return { ...prev, hairstyleId: item.id as any };
      if (item.slot === 'hat') return { ...prev, hatId: item.id as any };
      if (item.slot === 'armor') return { ...prev, armorId: item.id as any };
      if (item.slot === 'back') return { ...prev, backItemId: item.id as any };
      return prev;
    });
  };

  const handleSave = () => {
    sounds.playSuccess();
    onSaveConfig(currentConfig);
    onClose();
  };

  const tabs: { id: TabSlot; label: string; hanzi: string }[] = [
    { id: 'base', label: 'Base Body', hanzi: '身体型号' },
    { id: 'hair', label: 'Hair & Helms', hanzi: '发型战盔' },
    { id: 'hat', label: 'Hats & Acc', hanzi: '帽子头饰' },
    { id: 'armor', label: 'Armor & Robes', hanzi: '战甲道袍' },
    { id: 'back', label: 'Back Gear', hanzi: '背部挂件' },
    { id: 'colors', label: 'Color Matrix', hanzi: '战甲配色' },
  ];

  const currentOptions = COSMETIC_OPTIONS.filter((c) => c.slot === activeTab);

  const COLOR_PALETTES = [
    { name: 'Neon Cyber Cyan', hex: '#06b6d4' },
    { name: 'Dragon Emerald', hex: '#10b981' },
    { name: 'Solar Amber Gold', hex: '#f59e0b' },
    { name: 'Phantom Violet', hex: '#8b5cf6' },
    { name: 'Crimson Phoenix', hex: '#ef4444' },
    { name: 'Midnight Titanium', hex: '#1e293b' },
    { name: 'Pure White Frost', hex: '#f8fafc' },
    { name: 'Electric Pink', hex: '#ec4899' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                Character Customizer
                <span className="text-xs font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30 font-mono">
                  角色自定义
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Unlock legendary cyber robes, mythical hats & katanas by mastering Mandarin modules!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            >
              Equip & Save (保存)
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Body: 3D Left Viewport + Right Option Grid */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: 3D Character Stage */}
          <div className="w-full md:w-2/5 h-64 md:h-full relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-800">
            <div ref={previewContainerRef} className="w-full h-full" />

            {/* Orbit Controls Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-400 pointer-events-none">
              <span className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                Mandarin Tier: <strong className="text-cyan-400">Tier {player.mandarinMastery?.tier || 1}</strong>
              </span>

              <div className="pointer-events-auto flex items-center gap-1.5">
                <button
                  onClick={() => {
                    rotAngleRef.current -= Math.PI / 4;
                  }}
                  className="p-2 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white active:scale-95 transition-all"
                  title="Rotate Left"
                >
                  <RotateCw size={14} className="-scale-x-100" />
                </button>
                <button
                  onClick={() => {
                    rotAngleRef.current += Math.PI / 4;
                  }}
                  className="p-2 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white active:scale-95 transition-all"
                  title="Rotate Right"
                >
                  <RotateCw size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Category Tabs & Item Grid */}
          <div className="w-full md:w-3/5 h-full flex flex-col bg-slate-900/95">
            {/* Category Subnav */}
            <div className="flex items-center gap-1.5 p-3 border-b border-slate-800 overflow-x-auto shrink-0 bg-slate-950/40">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-70">({tab.hanzi})</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {activeTab === 'colors' ? (
                /* Color Palette Selectors */
                <div className="space-y-6">
                  {/* Primary Color */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2.5">
                      Primary Suit Armor Color (主战甲色彩)
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                      {COLOR_PALETTES.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => setCurrentConfig((prev) => ({ ...prev, primaryColor: c.hex }))}
                          className={`h-11 rounded-xl border-2 transition-all flex items-center justify-center ${
                            currentConfig.primaryColor === c.hex
                              ? 'border-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                              : 'border-slate-800 hover:border-slate-500'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {currentConfig.primaryColor === c.hex && (
                            <Check size={16} className="text-white drop-shadow-md stroke-[3]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Secondary Color */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2.5">
                      Secondary Accent Color (副色装甲)
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                      {COLOR_PALETTES.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => setCurrentConfig((prev) => ({ ...prev, secondaryColor: c.hex }))}
                          className={`h-11 rounded-xl border-2 transition-all flex items-center justify-center ${
                            currentConfig.secondaryColor === c.hex
                              ? 'border-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                              : 'border-slate-800 hover:border-slate-500'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {currentConfig.secondaryColor === c.hex && (
                            <Check size={16} className="text-white drop-shadow-md stroke-[3]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Neon Glow Color */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2.5">
                      Visor & Qi Glow Emission (全息目镜与真气光效)
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                      {COLOR_PALETTES.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => setCurrentConfig((prev) => ({ ...prev, glowColor: c.hex }))}
                          className={`h-11 rounded-xl border-2 transition-all flex items-center justify-center ${
                            currentConfig.glowColor === c.hex
                              ? 'border-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                              : 'border-slate-800 hover:border-slate-500'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {currentConfig.glowColor === c.hex && (
                            <Check size={16} className="text-white drop-shadow-md stroke-[3]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Cosmetic Option Cards Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentOptions.map((item) => {
                    const isUnlocked = isCosmeticUnlocked(item, player);
                    const isEquipped =
                      (item.slot === 'base' && currentConfig.baseModelId === item.id) ||
                      (item.slot === 'hair' && currentConfig.hairstyleId === item.id) ||
                      (item.slot === 'hat' && currentConfig.hatId === item.id) ||
                      (item.slot === 'armor' && currentConfig.armorId === item.id) ||
                      (item.slot === 'back' && currentConfig.backItemId === item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => isUnlocked && handleSelectItem(item)}
                        className={`p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between ${
                          isUnlocked
                            ? isEquipped
                              ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-600 hover:bg-slate-800/40 cursor-pointer active:scale-98'
                            : 'bg-slate-950/40 border-slate-900 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <h4 className="font-extrabold text-white text-sm">
                                {item.name}
                              </h4>
                              <div className="text-xs text-cyan-400 font-medium">
                                {item.hanziName} · <span className="font-mono text-[11px] text-slate-400">{item.pinyinName}</span>
                              </div>
                            </div>

                            {isEquipped ? (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-500 text-slate-950 font-black text-[10px] uppercase">
                                Equipped
                              </span>
                            ) : !isUnlocked ? (
                              <Lock size={15} className="text-slate-500" />
                            ) : null}
                          </div>

                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        </div>

                        {/* Unlock requirement footnote */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          {isUnlocked ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <Check size={12} /> Unlocked
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold flex items-center gap-1">
                              <Lock size={12} /> {item.unlockRequirement}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
