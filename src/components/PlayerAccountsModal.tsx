import React, { useState } from 'react';
import { X, UserPlus, Users, Check, Shield, Award, LogIn, Trash2 } from 'lucide-react';
import { PlayerAccount, PlayerProfile, SkinItem } from '../types/game';
import { sounds } from '../utils/audio';

interface PlayerAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayer: PlayerProfile;
  onSwitchPlayer: (account: PlayerAccount) => void;
  allSkins: SkinItem[];
}

const STORAGE_KEY_ACCOUNTS = 'cybermandarin_accounts_v1';

export function getSavedAccounts(fallbackPlayer: PlayerProfile): PlayerAccount[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.warn('Failed to parse accounts:', e);
    }
  }

  // Default initial account from fallback player
  const initialAccount: PlayerAccount = {
    id: `acc_primary`,
    name: fallbackPlayer.name || 'Austin',
    avatarId: fallbackPlayer.equippedSkinId || 'skin_neon_ninja',
    lastPlayed: Date.now(),
    profile: fallbackPlayer,
  };
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify([initialAccount]));
  return [initialAccount];
}

export function saveAllAccounts(accounts: PlayerAccount[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
  }
}

export const PlayerAccountsModal: React.FC<PlayerAccountsModalProps> = ({
  isOpen,
  onClose,
  currentPlayer,
  onSwitchPlayer,
  allSkins,
}) => {
  const [accounts, setAccounts] = useState<PlayerAccount[]>(() => getSavedAccounts(currentPlayer));
  const [isCreating, setIsCreating] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('skin_neon_ninja');

  if (!isOpen) return null;

  const handleCreateNewAccount = () => {
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;

    const newProfile: PlayerProfile = {
      name: trimmed,
      level: 1,
      xp: 0,
      maxXp: 100,
      vCoins: 150,
      equippedSkinId: selectedAvatar,
      unlockedSkinIds: [selectedAvatar],
      highestStreak: 0,
      arenaVictories: 0,
      completedStoryNodes: [],
      soundEnabled: true,
      pinyinDefaultVisible: true,
    };

    const newAccount: PlayerAccount = {
      id: `acc_${Date.now()}`,
      name: trimmed,
      avatarId: selectedAvatar,
      lastPlayed: Date.now(),
      profile: newProfile,
    };

    const updated = [...accounts, newAccount];
    setAccounts(updated);
    saveAllAccounts(updated);
    onSwitchPlayer(newAccount);
    sounds.playVictory();
    setIsCreating(false);
    setNewPlayerName('');
    onClose();
  };

  const handleSelectAccount = (acc: PlayerAccount) => {
    // Update last played timestamp
    const updated = accounts.map((a) => (a.id === acc.id ? { ...a, lastPlayed: Date.now() } : a));
    setAccounts(updated);
    saveAllAccounts(updated);
    onSwitchPlayer(acc);
    sounds.playSuccess();
    onClose();
  };

  const handleDeleteAccount = (accId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (accounts.length <= 1) return; // keep at least 1 account
    const updated = accounts.filter((a) => a.id !== accId);
    setAccounts(updated);
    saveAllAccounts(updated);
    sounds.playDamage();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.25)] overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide font-['Barlow_Condensed'] uppercase">
                Player Login & Profile Switcher
              </h2>
              <span className="text-xs text-slate-400">
                Save & return as each player with dedicated level, skins, and stats
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {!isCreating ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Select Player Profile to Login
                </span>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <UserPlus size={14} />
                  <span>New Player</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {accounts.map((acc) => {
                  const isCurrent = acc.profile.name === currentPlayer.name;
                  const skin = allSkins.find((s) => s.id === acc.profile.equippedSkinId) || allSkins[0];

                  return (
                    <div
                      key={acc.id}
                      onClick={() => handleSelectAccount(acc)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-sm shrink-0 border"
                          style={{
                            backgroundColor: `${skin?.accentColor || '#06B6D4'}22`,
                            borderColor: skin?.accentColor || '#06B6D4',
                          }}
                        >
                          {acc.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white">{acc.name}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 text-[10px] font-black uppercase">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Level {acc.profile.level}</span>
                            <span>·</span>
                            <span className="text-amber-300 font-mono">{acc.profile.vCoins} V</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectAccount(acc)}
                          className="p-2 rounded-lg bg-slate-800 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors"
                          title="Login as this player"
                        >
                          <LogIn size={15} />
                        </button>
                        {accounts.length > 1 && !isCurrent && (
                          <button
                            onClick={(e) => handleDeleteAccount(acc.id, e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                            title="Delete profile"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <UserPlus size={16} className="text-cyan-400" />
                <span>Create New Player Profile</span>
              </h3>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Player / Operative Name
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="e.g. Austin, NinjaKai, DragonPro"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                  Choose Starter Avatar Skin
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {allSkins.slice(0, 4).map((skin) => (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => setSelectedAvatar(skin.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedAvatar === skin.id
                          ? 'border-cyan-400 bg-cyan-950/30 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{skin.name}</div>
                      <div className="text-[10px] text-cyan-400 truncate">{skin.hanziName}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!newPlayerName.trim()}
                  onClick={handleCreateNewAccount}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Check size={16} />
                  <span>Start Playing as {newPlayerName.trim() || 'New Player'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
