import React, { useState, useEffect } from 'react';
import { GameView, PlayerProfile, SkinItem, PlayerAccount } from './types/game';
import { DEFAULT_SKINS } from './data/mandarinData';
import { sounds } from './utils/audio';
import { Navbar } from './components/Navbar';
import { Arena3DView } from './components/Arena3DView';
import { ArenaView } from './components/ArenaView';
import { MultiplayerView } from './components/MultiplayerView';
import { LeaderboardView } from './components/LeaderboardView';
import { StoryView } from './components/StoryView';
import { DojoView } from './components/DojoView';
import { LockerView } from './components/LockerView';
import { SquadCoachView } from './components/SquadCoachView';
import { SkinForgeModal } from './components/SkinForgeModal';
import { PlayerAccountsModal, getSavedAccounts, saveAllAccounts } from './components/PlayerAccountsModal';

const STORAGE_KEY_PLAYER = 'cybermandarin_player_v1';
const STORAGE_KEY_CUSTOM_SKINS = 'cybermandarin_custom_skins_v1';
const STORAGE_KEY_ACCOUNTS = 'cybermandarin_accounts_v1';
const STORAGE_KEY_ACTIVE_ID = 'cybermandarin_active_account_id';

export default function App() {
  const [currentView, setCurrentView] = useState<GameView>('arena');
  const [arenaMode, setArenaMode] = useState<'3d' | '2d'>('3d');
  const [isForgeOpen, setIsForgeOpen] = useState<boolean>(false);
  const [isAccountsOpen, setIsAccountsOpen] = useState<boolean>(false);

  const [activeAccountId, setActiveAccountId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || 'acc_primary';
    }
    return 'acc_primary';
  });

  // Player state persisted in localStorage & accounts with individual progression
  const [player, setPlayer] = useState<PlayerProfile>(() => {
    if (typeof window !== 'undefined') {
      const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      const rawAccounts = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (rawAccounts && activeId) {
        try {
          const accounts: PlayerAccount[] = JSON.parse(rawAccounts);
          const activeAcc = accounts.find((a) => a.id === activeId);
          if (activeAcc && activeAcc.profile) {
            const p = activeAcc.profile;
            if (!p.mandarinMastery) {
              p.mandarinMastery = {
                tier: 1,
                tierName: 'Tier 1: Initiate (基础初级 - HSK 1)',
                questionsAnswered: 0,
                correctAnswers: 0,
                consecutiveCorrect: 0,
                recentMistakes: [],
                masteryPoints: 0,
              };
            }
            return p;
          }
        } catch (e) {
          console.warn('Failed to parse active account profile:', e);
        }
      }

      const saved = localStorage.getItem(STORAGE_KEY_PLAYER);
      if (saved) {
        try {
          const p = JSON.parse(saved);
          if (!p.mandarinMastery) {
            p.mandarinMastery = {
              tier: 1,
              tierName: 'Tier 1: Initiate (基础初级 - HSK 1)',
              questionsAnswered: 0,
              correctAnswers: 0,
              consecutiveCorrect: 0,
              recentMistakes: [],
              masteryPoints: 0,
            };
          }
          return p;
        } catch (e) {
          console.warn('Failed to parse saved player profile:', e);
        }
      }
    }
    return {
      name: 'Austin',
      level: 1,
      xp: 0,
      maxXp: 100,
      vCoins: 150,
      equippedSkinId: 'skin_neon_ninja',
      unlockedSkinIds: ['skin_neon_ninja'],
      highestStreak: 0,
      arenaVictories: 0,
      completedStoryNodes: [],
      soundEnabled: true,
      pinyinDefaultVisible: true,
      mandarinMastery: {
        tier: 1,
        tierName: 'Tier 1: Initiate (基础初级 - HSK 1)',
        questionsAnswered: 0,
        correctAnswers: 0,
        consecutiveCorrect: 0,
        recentMistakes: [],
        masteryPoints: 0,
      },
    };
  });

  // Custom skins created via Matrix Skin Studio
  const [allSkins, setAllSkins] = useState<SkinItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_SKINS);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return [...parsed, ...DEFAULT_SKINS];
        } catch (e) {
          console.warn('Failed to parse custom skins:', e);
        }
      }
    }
    return DEFAULT_SKINS;
  });

  // Save player state changes & sync to active player account
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PLAYER, JSON.stringify(player));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeAccountId);
      // Sync into saved accounts array
      try {
        const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
        if (raw) {
          const accounts: PlayerAccount[] = JSON.parse(raw);
          const idx = accounts.findIndex((a) => a.id === activeAccountId || a.profile.name.toLowerCase() === player.name.toLowerCase());
          if (idx >= 0) {
            accounts[idx].profile = player;
            accounts[idx].lastPlayed = Date.now();
            localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
          } else {
            accounts.push({
              id: activeAccountId,
              name: player.name,
              avatarId: player.equippedSkinId,
              lastPlayed: Date.now(),
              profile: player,
            });
            localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
          }
        }
      } catch (e) {
        console.warn('Failed to sync account:', e);
      }
    }
    sounds.setMuted(!player.soundEnabled);
  }, [player, activeAccountId]);

  const equippedSkin =
    allSkins.find((s) => s.id === player.equippedSkinId) || allSkins[0] || DEFAULT_SKINS[0];

  const handleToggleSound = () => {
    setPlayer((prev) => ({
      ...prev,
      soundEnabled: !prev.soundEnabled,
    }));
  };

  const handleUpdatePlayer: React.Dispatch<React.SetStateAction<PlayerProfile>> = (action) => {
    setPlayer((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      let newLevel = next.level;
      let newXp = next.xp;
      let newMaxXp = next.maxXp;

      while (newXp >= newMaxXp) {
        newXp -= newMaxXp;
        newLevel += 1;
        newMaxXp = Math.round(newMaxXp * 1.35);
        sounds.playVictory();
      }

      return {
        ...next,
        level: newLevel,
        xp: newXp,
        maxXp: newMaxXp,
      };
    });
  };

  const handleSwitchPlayer = (account: PlayerAccount) => {
    const prof = account.profile;
    if (!prof.mandarinMastery) {
      prof.mandarinMastery = {
        tier: 1,
        tierName: 'Tier 1: Initiate (基础初级 - HSK 1)',
        questionsAnswered: 0,
        correctAnswers: 0,
        consecutiveCorrect: 0,
        recentMistakes: [],
        masteryPoints: 0,
      };
    }
    setActiveAccountId(account.id);
    setPlayer(prof);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, account.id);
    }
    sounds.playVictory();
  };

  const handleSkinCreated = (newSkin: SkinItem) => {
    setAllSkins((prev) => [newSkin, ...prev]);
    setPlayer((prev) => ({
      ...prev,
      equippedSkinId: newSkin.id,
      unlockedSkinIds: [...prev.unlockedSkinIds, newSkin.id],
    }));

    // Save custom skin to storage
    if (typeof window !== 'undefined') {
      const existing = localStorage.getItem(STORAGE_KEY_CUSTOM_SKINS);
      const list = existing ? JSON.parse(existing) : [];
      localStorage.setItem(STORAGE_KEY_CUSTOM_SKINS, JSON.stringify([newSkin, ...list]));
    }
  };

  const handleEquipSkin = (skinId: string) => {
    setPlayer((prev) => ({
      ...prev,
      equippedSkinId: skinId,
    }));
  };

  const handleBuySkin = (skin: SkinItem) => {
    if (player.vCoins < skin.price) {
      sounds.playError();
      return;
    }
    sounds.playVictory();
    setPlayer((prev) => ({
      ...prev,
      vCoins: prev.vCoins - skin.price,
      unlockedSkinIds: [...prev.unlockedSkinIds, skin.id],
      equippedSkinId: skin.id,
    }));
  };

  const handleEarnCoins = (amount: number) => {
    setPlayer((prev) => ({
      ...prev,
      vCoins: prev.vCoins + amount,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-['Plus_Jakarta_Sans'] flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      {/* Navigation Header */}
      <Navbar
        currentView={currentView}
        onSelectView={(view) => setCurrentView(view)}
        player={player}
        equippedSkin={equippedSkin}
        onToggleSound={handleToggleSound}
        onOpenForge={() => setIsForgeOpen(true)}
        onOpenAccounts={() => setIsAccountsOpen(true)}
      />

      {/* Main View Container */}
      <main className="flex-1 pb-12">
        {currentView === 'arena' && (
          <div className="space-y-2">
            {/* View Mode Toggle Pill (3D Fortnite Island vs 2D Action Arena) */}
            <div className="max-w-7xl mx-auto px-4 pt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setArenaMode('3d')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    arenaMode === '3d'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3D Fortnite World
                </button>
                <button
                  onClick={() => setArenaMode('2d')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    arenaMode === '2d'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2D Top-Down Arena
                </button>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Move with WASD · Aim & Shoot Rivals with Mouse · Press [R] or Answer to Reload
              </span>
            </div>

            {arenaMode === '3d' ? (
              <Arena3DView
                player={player}
                equippedSkin={equippedSkin}
                onUpdatePlayer={handleUpdatePlayer}
                onOpenForge={() => setIsForgeOpen(true)}
              />
            ) : (
              <ArenaView
                player={player}
                equippedSkin={equippedSkin}
                onUpdatePlayer={handleUpdatePlayer}
                onOpenForge={() => setIsForgeOpen(true)}
              />
            )}
          </div>
        )}

        {currentView === 'multiplayer' && (
          <MultiplayerView
            player={player}
            equippedSkin={equippedSkin}
            onEarnCoins={handleEarnCoins}
            onUpdatePlayer={handleUpdatePlayer}
          />
        )}

        {currentView === 'leaderboard' && (
          <LeaderboardView
            player={player}
            equippedSkin={equippedSkin}
          />
        )}

        {currentView === 'story' && (
          <StoryView
            player={player}
            onUpdatePlayer={handleUpdatePlayer}
            onOpenForge={() => setIsForgeOpen(true)}
          />
        )}

        {currentView === 'dojo' && (
          <DojoView player={player} onUpdatePlayer={handleUpdatePlayer} />
        )}

        {currentView === 'locker' && (
          <LockerView
            player={player}
            allSkins={allSkins}
            equippedSkin={equippedSkin}
            onEquipSkin={handleEquipSkin}
            onBuySkin={handleBuySkin}
            onOpenForge={() => setIsForgeOpen(true)}
          />
        )}

        {currentView === 'coach' && (
          <SquadCoachView onEarnCoins={handleEarnCoins} />
        )}
      </main>

      {/* Zero-Cost Custom Skin Studio Modal */}
      <SkinForgeModal
        isOpen={isForgeOpen}
        onClose={() => setIsForgeOpen(false)}
        onSkinCreated={handleSkinCreated}
        vCoins={player.vCoins}
      />

      {/* Multi-Player Profile & Login Switcher Modal */}
      <PlayerAccountsModal
        isOpen={isAccountsOpen}
        onClose={() => setIsAccountsOpen(false)}
        currentPlayer={player}
        onSwitchPlayer={handleSwitchPlayer}
        allSkins={allSkins}
      />

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CyberMandarin Royale · 4th Grade Immersion Language Arena · Zero API Cost</span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setCurrentView('arena')}
              className="hover:text-cyan-400 transition-colors"
            >
              Battle Arena
            </button>
            <button
              onClick={() => setCurrentView('multiplayer')}
              className="hover:text-cyan-400 transition-colors text-cyan-300 font-bold"
            >
              Online PvP
            </button>
            <button
              onClick={() => setCurrentView('leaderboard')}
              className="hover:text-amber-400 transition-colors text-amber-300 font-bold"
            >
              Leaderboard
            </button>
            <button
              onClick={() => setIsAccountsOpen(true)}
              className="hover:text-cyan-400 transition-colors"
            >
              Switch Player
            </button>
            <button
              onClick={() => setCurrentView('coach')}
              className="hover:text-cyan-400 transition-colors"
            >
              Squad Comms
            </button>
            <button
              onClick={() => setIsForgeOpen(true)}
              className="hover:text-cyan-400 transition-colors"
            >
              Skin Studio
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
