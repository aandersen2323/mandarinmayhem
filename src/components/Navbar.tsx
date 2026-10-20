import React from 'react';
import { GameView, PlayerProfile, SkinItem } from '../types/game';
import { SkinVisual } from './SkinVisual';
import { Volume2, VolumeX, Sparkles, Coins, Users, Swords, Trophy } from 'lucide-react';

interface NavbarProps {
  currentView: GameView;
  onSelectView: (view: GameView) => void;
  player: PlayerProfile;
  equippedSkin: SkinItem;
  onToggleSound: () => void;
  onOpenForge: () => void;
  onOpenAccounts: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  player,
  equippedSkin,
  onToggleSound,
  onOpenForge,
  onOpenAccounts,
}) => {
  const navItems: { id: GameView; label: string; hanzi: string }[] = [
    { id: 'arena', label: 'Battle Arena', hanzi: '竞技场' },
    { id: 'multiplayer', label: 'Online PvP', hanzi: '多人对战' },
    { id: 'leaderboard', label: 'Leaderboard', hanzi: '排行榜' },
    { id: 'story', label: 'Story Quest', hanzi: '故事剧情' },
    { id: 'dojo', label: 'Training Dojo', hanzi: '道场训练' },
    { id: 'locker', label: 'Locker & Gear', hanzi: '储物柜' },
    { id: 'coach', label: 'Squad Comms', hanzi: '战术通讯' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-cyan-500/20 px-4 md:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div
          onClick={() => onSelectView('arena')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-400 p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center font-extrabold text-cyan-400 text-base tracking-wider">
              汉
            </div>
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-white uppercase group-hover:text-cyan-400 transition-colors whitespace-nowrap block font-['Barlow_Condensed']">
              CyberMandarin <span className="text-cyan-400 font-['Outfit'] text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 ml-1">ROYALE</span>
            </span>
          </div>
        </div>

        {/* Zone 2: Single-line Clean Nav Links */}
        <nav className="hidden xl:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)] font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[10px] opacity-70 font-normal">({item.hanzi})</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Player Profile Selector, Stats, Sound, & Customizer */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Player Account Switcher Button */}
          <button
            onClick={onOpenAccounts}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-200 hover:text-cyan-300 transition-all shadow-sm group"
            title="Switch Player Account / Login"
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-white text-xs border"
              style={{
                backgroundColor: `${equippedSkin.accentColor || '#06B6D4'}22`,
                borderColor: equippedSkin.accentColor || '#06B6D4',
              }}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold leading-none text-white group-hover:text-cyan-300">
                {player.name}
              </div>
              <div className="text-[9px] text-slate-400 leading-none mt-0.5">Switch Player ▾</div>
            </div>
          </button>

          {/* V-Coins Counter */}
          <div className="flex items-center gap-1 bg-slate-900/90 border border-amber-500/30 px-2.5 py-1.5 rounded-lg text-amber-300 font-mono text-xs font-bold tabular-nums shadow-sm">
            <Coins size={14} className="text-amber-400" />
            <span>{player.vCoins}</span>
          </div>

          {/* Level Progress */}
          <div className="hidden md:flex flex-col items-end text-right">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Lvl <strong className="text-white font-mono">{player.level}</strong>
            </span>
            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, (player.xp / player.maxXp) * 100)}%` }}
              />
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={player.soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors shrink-0"
          >
            {player.soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {/* Skin Studio CTA */}
          <button
            onClick={onOpenForge}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all whitespace-nowrap shrink-0 active:scale-95"
          >
            <Sparkles size={13} className="fill-slate-950" />
            <span className="hidden sm:inline">Skin Studio</span>
          </button>
        </div>
      </div>

      {/* Subnav strip on medium/small screens */}
      <div className="xl:hidden flex items-center justify-start gap-1 pt-2 mt-2 border-t border-slate-900 overflow-x-auto pb-0.5">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
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
