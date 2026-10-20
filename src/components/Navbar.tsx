import React from 'react';
import { GameView, PlayerProfile, SkinItem } from '../types/game';
import { SkinVisual } from './SkinVisual';
import { Volume2, VolumeX, Sparkles, Coins } from 'lucide-react';

interface NavbarProps {
  currentView: GameView;
  onSelectView: (view: GameView) => void;
  player: PlayerProfile;
  equippedSkin: SkinItem;
  onToggleSound: () => void;
  onOpenForge: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  player,
  equippedSkin,
  onToggleSound,
  onOpenForge,
}) => {
  const navItems: { id: GameView; label: string; hanzi: string }[] = [
    { id: 'arena', label: 'Battle Arena', hanzi: '竞技场' },
    { id: 'story', label: 'Story Quest', hanzi: '故事剧情' },
    { id: 'dojo', label: 'Training Dojo', hanzi: '道场训练' },
    { id: 'locker', label: 'Locker & Gear', hanzi: '储物柜' },
    { id: 'coach', label: 'Squad Coach', hanzi: '战术导师' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-cyan-500/20 px-4 md:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div
          onClick={() => onSelectView('arena')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-400 p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-extrabold text-cyan-400 text-lg tracking-wider">
              汉
            </div>
          </div>
          <div>
            <span className="font-extrabold text-base md:text-lg tracking-tight text-white uppercase group-hover:text-cyan-400 transition-colors whitespace-nowrap block font-['Barlow_Condensed']">
              CyberMandarin <span className="text-cyan-400 font-['Outfit'] text-xs font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 ml-1">ROYALE</span>
            </span>
          </div>
        </div>

        {/* Zone 2: Single-line Clean Nav Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`px-3.5 py-1.5 text-xs xl:text-sm font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[11px] opacity-70 font-normal">({item.hanzi})</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Equipped Avatar, Stats, & Forge Action */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={player.soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors shrink-0"
          >
            {player.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* V-Coins Counter */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-amber-500/30 px-3 py-1.5 rounded-lg text-amber-300 font-mono text-xs md:text-sm font-bold tabular-nums shadow-sm">
            <Coins size={15} className="text-amber-400" />
            <span>{player.vCoins}</span>
          </div>

          {/* Level Progress */}
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              Battle Pass Lvl <strong className="text-white font-mono tabular-nums">{player.level}</strong>
            </span>
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, (player.xp / player.maxXp) * 100)}%` }}
              />
            </div>
          </div>

          {/* Skin Forge CTA */}
          <button
            onClick={onOpenForge}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs md:text-sm shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all whitespace-nowrap shrink-0 active:scale-95"
          >
            <Sparkles size={14} className="fill-slate-950" />
            <span>AI Skin Forge</span>
          </button>

          {/* Equipped Avatar Quick Inspect */}
          <div
            onClick={() => onSelectView('locker')}
            className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
            title={`Equipped: ${equippedSkin.name}`}
          >
            <SkinVisual skin={equippedSkin} size="sm" />
          </div>
        </div>
      </div>

      {/* Mobile Nav Bar Strip */}
      <div className="lg:hidden flex items-center justify-around gap-1 pt-2.5 mt-2 border-t border-slate-900 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
