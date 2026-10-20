import React, { useState } from 'react';
import { X, Sparkles, Check, AlertCircle, Shield, Zap, Flame, Eye, Palette } from 'lucide-react';
import { SkinItem } from '../types/game';
import { sounds } from '../utils/audio';

interface SkinForgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkinCreated: (newSkin: SkinItem) => void;
  vCoins: number;
}

export const SkinForgeModal: React.FC<SkinForgeModalProps> = ({
  isOpen,
  onClose,
  onSkinCreated,
  vCoins,
}) => {
  const [prompt, setPrompt] = useState<string>('Cyberpunk Mecha Ninja warrior with glowing neon blades and holographic dragon visor');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [archetype, setArchetype] = useState<string>('cyber_ninja');
  const [selectedCrest, setSelectedCrest] = useState<string>('龙');
  const [accentColor, setAccentColor] = useState<string>('#06B6D4');
  const [skinName, setSkinName] = useState<string>('Neon Apex Striker');
  const [hanziName, setHanziName] = useState<string>('极光先锋');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<{
    imageUrl: string;
    description?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const presetArchetypes = [
    { id: 'cyber_ninja', label: 'Cyber Ninja (暗影忍者)', icon: Zap, color: 'text-cyan-400', defaultColor: '#06B6D4', defaultCrest: '忍' },
    { id: 'mecha_titan', label: 'Titan Mecha (泰坦机甲)', icon: Shield, color: 'text-blue-400', defaultColor: '#3B82F6', defaultCrest: '甲' },
    { id: 'dragon_knight', label: 'Dragon Warrior (龙魂战士)', icon: Flame, color: 'text-emerald-400', defaultColor: '#10B981', defaultCrest: '龙' },
    { id: 'stealth_ronin', label: 'Storm Ronin (暴风浪人)', icon: Eye, color: 'text-purple-400', defaultColor: '#8B5CF6', defaultCrest: '浪' },
  ];

  const crestOptions = [
    { hanzi: '龙', label: 'Dragon (Lóng)' },
    { hanzi: '忍', label: 'Ninja (Rěn)' },
    { hanzi: '甲', label: 'Armor (Jiǎ)' },
    { hanzi: '浪', label: 'Ronin (Làng)' },
    { hanzi: '战', label: 'Warrior (Zhàn)' },
    { hanzi: '胜', label: 'Victory (Shèng)' },
    { hanzi: '雷', label: 'Thunder (Léi)' },
    { hanzi: '光', label: 'Light (Guāng)' },
  ];

  const colorPalettes = [
    { hex: '#06B6D4', name: 'Cyan Neon' },
    { hex: '#10B981', name: 'Jade Matrix' },
    { hex: '#F59E0B', name: 'Imperial Gold' },
    { hex: '#EF4444', name: 'Plasma Crimson' },
    { hex: '#8B5CF6', name: 'Void Violet' },
    { hex: '#EC4899', name: 'Cyber Pink' },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setGeneratedResult(null);

    try {
      // 100% Free Client & Server Procedural Synthesis - zero AI cost, zero API calls
      const resPx = imageSize === '4K' ? 4096 : imageSize === '2K' ? 2048 : 1024;
      const clientSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${resPx} ${resPx}" width="${resPx}" height="${resPx}">
        <defs>
          <radialGradient id="bgG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0F172A" />
            <stop offset="65%" stop-color="#020617" />
            <stop offset="100%" stop-color="#000000" />
          </radialGradient>
          <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${accentColor}" />
            <stop offset="100%" stop-color="#FFFFFF" />
          </linearGradient>
          <filter id="bloom">
            <feGaussianBlur stdDeviation="${resPx * 0.015}" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bgG)" />
        <circle cx="${resPx * 0.5}" cy="${resPx * 0.5}" r="${resPx * 0.42}" fill="none" stroke="${accentColor}" stroke-width="${resPx * 0.005}" opacity="0.4" stroke-dasharray="16 8"/>
        <!-- Armored shoulders -->
        <path d="M${resPx * 0.22} ${resPx * 0.88} L${resPx * 0.35} ${resPx * 0.54} L${resPx * 0.65} ${resPx * 0.54} L${resPx * 0.78} ${resPx * 0.88} Z" fill="#1E293B" stroke="${accentColor}" stroke-width="${resPx * 0.008}"/>
        <polygon points="${resPx * 0.22},${resPx * 0.88} ${resPx * 0.5},${resPx * 0.72} ${resPx * 0.78},${resPx * 0.88} ${resPx * 0.5},${resPx * 0.96}" fill="#0F172A" stroke="${accentColor}" stroke-width="${resPx * 0.006}"/>
        <!-- Energy Core with Chinese Crest -->
        <circle cx="${resPx * 0.5}" cy="${resPx * 0.78}" r="${resPx * 0.07}" fill="${accentColor}" opacity="0.85" filter="url(#bloom)"/>
        <text x="${resPx * 0.5}" y="${resPx * 0.81}" font-family="system-ui, sans-serif" font-weight="900" font-size="${resPx * 0.08}" fill="#FFFFFF" text-anchor="middle">${selectedCrest}</text>
        <!-- Cyber Helmet / Visor -->
        <path d="M${resPx * 0.33} ${resPx * 0.56} Q${resPx * 0.28} ${resPx * 0.22} ${resPx * 0.5} ${resPx * 0.16} Q${resPx * 0.72} ${resPx * 0.22} ${resPx * 0.67} ${resPx * 0.56} Z" fill="#090D16" stroke="${accentColor}" stroke-width="${resPx * 0.01}"/>
        <!-- Glowing Visor Eye Screen -->
        <rect x="${resPx * 0.35}" y="${resPx * 0.34}" width="${resPx * 0.3}" height="${resPx * 0.09}" rx="${resPx * 0.035}" fill="url(#neonGlow)" filter="url(#bloom)"/>
        <line x1="${resPx * 0.37}" y1="${resPx * 0.385}" x2="${resPx * 0.63}" y2="${resPx * 0.385}" stroke="#FFFFFF" stroke-width="${resPx * 0.016}" stroke-linecap="round"/>
        <!-- Faceplate detail -->
        <polygon points="${resPx * 0.42},${resPx * 0.47} ${resPx * 0.58},${resPx * 0.47} ${resPx * 0.5},${resPx * 0.56}" fill="#1E293B" stroke="${accentColor}" stroke-width="${resPx * 0.005}"/>
        <text x="${resPx * 0.5}" y="${resPx * 0.93}" font-family="system-ui, sans-serif" font-weight="bold" font-size="${resPx * 0.032}" fill="${accentColor}" text-anchor="middle" letter-spacing="4">MATRIX ${imageSize} EDITION</text>
      </svg>`;

      const base64Url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(clientSvg)))}`;
      
      // Simulate quick high-tech synthesis
      setTimeout(() => {
        setGeneratedResult({
          imageUrl: base64Url,
          description: `Custom ${skinName} (${hanziName}) synthesized with ${selectedCrest} crest and ${accentColor} matrix armor. Zero API cost!`,
        });
        sounds.playVictory();
        setIsGenerating(false);
      }, 400);
    } catch (err: unknown) {
      console.warn('Handling client skin forge:', err);
      setIsGenerating(false);
    }
  };

  const handleEquipGenerated = () => {
    if (!generatedResult) return;

    const newSkin: SkinItem = {
      id: `custom_skin_${Date.now()}`,
      name: skinName || 'Custom Battle Skin',
      hanziName: hanziName || '自定战士',
      pinyinName: 'Zìdìng Zhànshì',
      description: `${prompt} · Crest: ${selectedCrest}`,
      rarity: 'legendary',
      theme: 'Matrix Studio',
      svgType: archetype === 'mecha_titan' ? 'mecha' : archetype === 'dragon_knight' ? 'dragon' : archetype === 'stealth_ronin' ? 'ronin' : 'ninja',
      accentColor: accentColor,
      unlockLevel: 1,
      price: 0,
      imageSrc: generatedResult.imageUrl,
      isCustom: true,
    };

    onSkinCreated(newSkin);
    sounds.playSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.25)] overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide font-['Barlow_Condensed'] uppercase">
                Cyber Matrix Skin Studio
              </h2>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <span>100% Free Client-Side Vector Engine · Zero API Cost</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Resolution Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Select Render Resolution
              </label>
              <span className="text-[11px] text-cyan-400 font-mono">Instant Vector Canvas</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['1K', '2K', '4K'] as const).map((size) => {
                const isSelected = imageSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setImageSize(size)}
                    className={`py-2.5 px-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-base font-extrabold font-mono">{size}</div>
                    <div className="text-[10px] opacity-80 uppercase tracking-wider">
                      {size === '1K' ? 'Standard (1024)' : size === '2K' ? 'Crisp (2048)' : 'Ultra (4096)'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Archetype Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
              Hero Class Archetype
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {presetArchetypes.map((arch) => {
                const Icon = arch.icon;
                const isSelected = archetype === arch.id;
                return (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => {
                      setArchetype(arch.id);
                      setAccentColor(arch.defaultColor);
                      setSelectedCrest(arch.defaultCrest);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Icon size={16} className={arch.color} />
                    <span className="text-xs font-semibold leading-tight">{arch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chinese Crest Selection */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
              Core Energy Crest (胸口战纹 / 能量标志)
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {crestOptions.map((c) => {
                const isSelected = selectedCrest === c.hanzi;
                return (
                  <button
                    key={c.hanzi}
                    type="button"
                    onClick={() => setSelectedCrest(c.hanzi)}
                    className={`py-2 px-1 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-lg font-extrabold">{c.hanzi}</div>
                    <div className="text-[9px] text-slate-400 truncate">{c.label.split(' ')[0]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Neon Armor Accent Color */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-1.5">
              <Palette size={14} className="text-cyan-400" />
              <span>Neon Matrix Armor Color</span>
            </label>
            <div className="flex flex-wrap gap-2.5">
              {colorPalettes.map((pal) => (
                <button
                  key={pal.hex}
                  type="button"
                  onClick={() => setAccentColor(pal.hex)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    accentColor === pal.hex
                      ? 'border-white text-white shadow-md ring-1 ring-white'
                      : 'border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                  style={{ backgroundColor: `${pal.hex}18` }}
                >
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: pal.hex }} />
                  <span>{pal.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Skin Identity Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                Skin English Name
              </label>
              <input
                type="text"
                value={skinName}
                onChange={(e) => setSkinName(e.target.value)}
                placeholder="e.g. Neon Apex Striker"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                Mandarin Name (中文名称)
              </label>
              <input
                type="text"
                value={hanziName}
                onChange={(e) => setHanziName(e.target.value)}
                placeholder="e.g. 极光先锋"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-cyan-300 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Prompt/Description */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
              Hero Theme & Background Story
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your hero character lore..."
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice</p>
                <p className="text-red-400/90 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Generated Result Preview */}
          {generatedResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-emerald-400 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-slate-900">
                <img
                  src={generatedResult.imageUrl}
                  alt={skinName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-2 text-center sm:text-left flex-1">
                <div className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  {imageSize} High-Res Skin Ready! (Zero Cost)
                </div>
                <h4 className="text-base font-bold text-white">{skinName} ({hanziName})</h4>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {generatedResult.description || prompt}
                </p>
                <button
                  type="button"
                  onClick={handleEquipGenerated}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Check size={15} />
                  <span>Equip Skin to Locker</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            Balance: <strong className="text-amber-300">{vCoins}</strong> V-Coins · <span className="text-emerald-400 font-bold">100% Free</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs tracking-wider uppercase flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Sparkles size={16} />
              <span>{isGenerating ? 'Synthesizing...' : `Forge Custom Skin (${imageSize})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
