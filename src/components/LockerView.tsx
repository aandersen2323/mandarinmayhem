import React from 'react';
import { PlayerProfile, SkinItem } from '../types/game';
import { SkinVisual } from './SkinVisual';
import { sounds } from '../utils/audio';
import {
  Sparkles,
  Lock,
  Check,
  Coins,
  ShieldCheck,
  Layers,
  Award,
  Shirt,
} from 'lucide-react';

interface LockerViewProps {
  player: PlayerProfile;
  allSkins: SkinItem[];
  equippedSkin: SkinItem;
  onEquipSkin: (skinId: string) => void;
  onBuySkin: (skin: SkinItem) => void;
  onOpenForge: () => void;
  onOpenCustomizer?: () => void;
}

export const LockerView: React.FC<LockerViewProps> = ({
  player,
  allSkins,
  equippedSkin,
  onEquipSkin,
  onBuySkin,
  onOpenForge,
  onOpenCustomizer,
}) => {
  const battlePassTiers = [
    { level: 1, title: 'Starter Operative', reward: 'Neon Shadow Ninja' },
    { level: 2, title: 'Titan Vanguard', reward: 'Titan Mecha' },
    { level: 4, title: 'Dragon Warrior', reward: 'Emerald Dragon' },
    { level: 6, title: 'Storm Master', reward: 'Storm Cyber Ronin' },
    { level: 8, title: 'Shadow Infiltrator', reward: 'Shadow Infiltrator' },
    { level: 10, title: 'Solar Champion', reward: 'Solar Phoenix Blade' },
    { level: 12, title: 'Void Valkyrie', reward: 'Void Valkyrie' },
    { level: 15, title: 'Quantum Overlord', reward: 'Quantum Cyber Cat' },
    { level: 20, title: 'Cyber Warlord', reward: 'Cyber Warlord Sovereign' },
    { level: 25, title: 'Mythic Sovereign God', reward: 'Mythic Dragon God' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide uppercase font-['Barlow_Condensed']">
            Cyber Locker & Battle Pass Wardrobe
          </h2>
          <p className="text-xs text-slate-400">
            Unlock cybernetic heroes and mythical avatars by advancing your Mandarin immersion level
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-amber-500/30 text-amber-300 font-mono text-sm font-bold shadow-sm">
            <Coins size={16} className="text-amber-400" />
            <span>{player.vCoins} V-Coins</span>
          </div>

          {onOpenCustomizer && (
            <button
              onClick={onOpenCustomizer}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/30 text-cyan-300 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow-sm"
            >
              <Shirt size={14} className="text-cyan-400" />
              <span>3D Customizer</span>
            </button>
          )}

          <button
            onClick={onOpenForge}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95"
          >
            <Sparkles size={14} />
            <span>Skin Crafter</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Active Showcase + Skin Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Equipped Hero Inspection Card */}
        <div className="bg-slate-950 border border-cyan-500/30 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 shadow-xl">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-400">
            Active Combat Skin
          </span>

          <SkinVisual skin={equippedSkin} size="xl" showBadge />

          <div className="space-y-1">
            <h3 className="text-2xl font-black text-white font-['Barlow_Condensed'] uppercase tracking-wide">
              {equippedSkin.name}
            </h3>
            <p className="text-base font-bold text-cyan-300 font-sans">
              {equippedSkin.hanziName}{' '}
              <span className="text-xs font-normal text-slate-400">({equippedSkin.pinyinName})</span>
            </p>
            <p className="text-xs text-slate-400 max-w-xs mt-2">{equippedSkin.description}</p>
          </div>

          <div className="w-full pt-3 border-t border-slate-900 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Rarity</span>
              <span className="font-bold uppercase text-white font-mono">{equippedSkin.rarity}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Theme</span>
              <span className="font-bold text-cyan-300 truncate block">{equippedSkin.theme}</span>
            </div>
          </div>
        </div>

        {/* Right Col: Skin Wardrobe Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" />
              <span>Available Hero Outfits ({allSkins.length})</span>
            </h3>
            <span className="text-xs text-slate-500">
              Battle Pass Lvl <strong className="text-white font-mono">{player.level}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allSkins.map((skin) => {
              const isEquipped = equippedSkin.id === skin.id;
              const isUnlocked =
                player.unlockedSkinIds.includes(skin.id) ||
                player.level >= skin.unlockLevel ||
                skin.isCustom;
              const canAfford = player.vCoins >= skin.price;

              return (
                <div
                  key={skin.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isEquipped
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400'
                      : isUnlocked
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SkinVisual skin={skin} size="md" />
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">{skin.name}</h4>
                      <div className="text-xs text-cyan-300 font-sans mt-0.5">
                        {skin.hanziName}{' '}
                        <span className="text-[10px] text-slate-400">({skin.pinyinName})</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-500 block mt-1">
                        {skin.rarity} · Lvl {skin.unlockLevel}+
                      </span>
                    </div>
                  </div>

                  {/* Actions: Equip, Buy, or Locked */}
                  <div className="shrink-0">
                    {isEquipped ? (
                      <span className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1">
                        <Check size={14} />
                        <span>Equipped</span>
                      </span>
                    ) : isUnlocked ? (
                      <button
                        onClick={() => {
                          sounds.playSuccess();
                          onEquipSkin(skin.id);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                      >
                        Equip
                      </button>
                    ) : skin.price > 0 ? (
                      <button
                        disabled={!canAfford}
                        onClick={() => onBuySkin(skin)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                          canAfford
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {skin.price} Coins
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-slate-500 text-xs font-mono">
                        <Lock size={14} />
                        <span>Lvl {skin.unlockLevel}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Battle Pass Progression Track */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-400" />
            <h3 className="text-base font-bold text-white uppercase font-['Barlow_Condensed']">
              Battle Pass Milestones (Mandarin Immersion Track)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Earn XP in Arena & Story Quests
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {battlePassTiers.map((tier) => {
            const isUnlocked = player.level >= tier.level;
            return (
              <div
                key={tier.level}
                className={`p-3.5 rounded-2xl border text-center transition-all ${
                  isUnlocked
                    ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                    : 'bg-slate-900 border-slate-800/80 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {isUnlocked ? (
                    <ShieldCheck size={14} className="text-cyan-400" />
                  ) : (
                    <Lock size={14} className="text-slate-600" />
                  )}
                  <span className="text-xs font-mono font-bold">Level {tier.level}</span>
                </div>
                <div className="text-xs font-bold text-white truncate">{tier.reward}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{tier.title}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
