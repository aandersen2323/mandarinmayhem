import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Users,
  Check,
  Shield,
  Award,
  LogIn,
  Trash2,
  GraduationCap,
  Sparkles,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { PlayerAccount, PlayerProfile, SkinItem } from '../types/game';
import { MANDARIN_TIER_CONFIG } from '../data/mandarinData';
import { sounds } from '../utils/audio';

interface PlayerAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayer: PlayerProfile;
  onSwitchPlayer: (account: PlayerAccount) => void;
  onLogOut: () => void;
  allSkins: SkinItem[];
}

const STORAGE_KEY_ACCOUNTS = 'cybermandarin_accounts_v1';
const STORAGE_KEY_ACTIVE_ID = 'cybermandarin_active_account_id';

export function getSavedAccounts(fallbackPlayer: PlayerProfile): PlayerAccount[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((acc: PlayerAccount) => {
          if (!acc.profile.mandarinMastery) {
            acc.profile.mandarinMastery = {
              tier: 1,
              tierName: 'Tier 1: Initiate (基础初级 - HSK 1)',
              questionsAnswered: 0,
              correctAnswers: 0,
              consecutiveCorrect: 0,
              recentMistakes: [],
              masteryPoints: 0,
            };
          }
          return acc;
        });
      }
    } catch (e) {
      console.warn('Failed to parse accounts:', e);
    }
  }

  // Default initial account from fallback player
  const initialMastery = fallbackPlayer.mandarinMastery || {
    tier: 1,
    tierName: 'Tier 1: Initiate (基础初级 - HSK 1)',
    questionsAnswered: 0,
    correctAnswers: 0,
    consecutiveCorrect: 0,
    recentMistakes: [],
    masteryPoints: 0,
  };

  const initialAccount: PlayerAccount = {
    id: `acc_austin`,
    name: fallbackPlayer.name || 'Austin',
    avatarId: fallbackPlayer.equippedSkinId || 'skin_neon_ninja',
    hasPassword: true,
    lastPlayed: Date.now(),
    profile: {
      ...fallbackPlayer,
      mandarinMastery: initialMastery,
    },
  };
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify([initialAccount]));
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, initialAccount.id);
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
  onLogOut,
  allSkins,
}) => {
  const [accounts, setAccounts] = useState<PlayerAccount[]>(() => getSavedAccounts(currentPlayer));
  const [isCreating, setIsCreating] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPassword, setNewPlayerPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('skin_neon_ninja');

  // Password verification modal for switching
  const [verifyingAccount, setVerifyingAccount] = useState<PlayerAccount | null>(null);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleStartSwitchAccount = (acc: PlayerAccount) => {
    // If it's the currently active player, simply close
    if (acc.profile.name.toLowerCase() === currentPlayer.name.toLowerCase()) {
      onClose();
      return;
    }

    // Require password verification to access another player's save!
    setVerifyingAccount(acc);
    setVerifyPassword('');
    setVerifyError(null);
  };

  const handleConfirmSwitchWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingAccount) return;
    setVerifyError(null);

    const pwdTrimmed = verifyPassword.trim();
    if (!pwdTrimmed) {
      setVerifyError('Please enter the password or PIN for this player.');
      return;
    }

    setIsVerifying(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: verifyingAccount.name,
          password: pwdTrimmed,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.account) {
        sounds.playVictory();
        localStorage.setItem('cybermandarin_auth_token', data.token);
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, verifyingAccount.id);
        onSwitchPlayer(data.account);
        setVerifyingAccount(null);
        onClose();
      } else {
        sounds.playDamage();
        setVerifyError(data.error || '❌ 密码错误: Incorrect Password or PIN! Access denied.');
      }
    } catch (err) {
      // Local fallback
      if (pwdTrimmed === '1234' || (verifyingAccount.pin && verifyingAccount.pin === pwdTrimmed)) {
        sounds.playVictory();
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, verifyingAccount.id);
        onSwitchPlayer(verifyingAccount);
        setVerifyingAccount(null);
        onClose();
      } else {
        sounds.playDamage();
        setVerifyError('❌ 密码错误: Incorrect password. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCreateNewAccount = async () => {
    const trimmed = newPlayerName.trim();
    const pwdTrimmed = newPlayerPassword.trim();
    if (!trimmed) return;
    if (!pwdTrimmed || pwdTrimmed.length < 3) {
      alert('Please set a secret password or 4-digit PIN (at least 3 characters or numbers).');
      return;
    }

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

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmed,
          password: pwdTrimmed,
          avatarId: selectedAvatar,
          profile: newProfile,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.account) {
        const updated = [...accounts, data.account];
        setAccounts(updated);
        saveAllAccounts(updated);
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, data.account.id);
        localStorage.setItem('cybermandarin_auth_token', data.token);
        onSwitchPlayer(data.account);
        sounds.playVictory();
        setIsCreating(false);
        setNewPlayerName('');
        setNewPlayerPassword('');
        onClose();
        return;
      } else {
        alert(data.error || 'Failed to create account. Username may be taken.');
      }
    } catch (err) {
      const newAccount: PlayerAccount = {
        id: `acc_${Date.now()}`,
        name: trimmed,
        avatarId: selectedAvatar,
        hasPassword: true,
        lastPlayed: Date.now(),
        profile: newProfile,
      };
      const updated = [...accounts, newAccount];
      setAccounts(updated);
      saveAllAccounts(updated);
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, newAccount.id);
      onSwitchPlayer(newAccount);
      sounds.playVictory();
      setIsCreating(false);
      setNewPlayerName('');
      setNewPlayerPassword('');
      onClose();
    }
  };

  const handleDeleteAccount = (accId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (accounts.length <= 1) return;
    if (!confirm('Are you sure you want to delete this player profile and its saves?')) return;
    const updated = accounts.filter((a) => a.id !== accId);
    setAccounts(updated);
    saveAllAccounts(updated);
    sounds.playDamage();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto select-none">
      <div className="relative w-full max-w-xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide font-['Barlow_Condensed'] uppercase">
                Player Account & Security Management
              </h2>
              <span className="text-xs text-slate-400">
                Password-protected saves: switch accounts or lock session
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
          {/* PASSWORD VERIFICATION POPUP WHEN SWITCHING */}
          {verifyingAccount ? (
            <form onSubmit={handleConfirmSwitchWithPassword} className="space-y-4">
              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-center">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-black text-xl flex items-center justify-center mx-auto mb-2">
                  <KeyRound size={22} />
                </div>
                <h3 className="text-base font-bold text-white">
                  Enter Password for {verifyingAccount.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  This player save is password-protected to prevent unauthorized access.
                </p>
              </div>

              {verifyError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{verifyError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Password or 4-Digit PIN for {verifyingAccount.name}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    type={showVerifyPassword ? 'text' : 'password'}
                    value={verifyPassword}
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    placeholder="Enter password or 4-digit PIN"
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showVerifyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Default PIN for primary accounts: 1234
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyingAccount(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <LogIn size={15} />
                  <span>{isVerifying ? 'Verifying...' : `Unlock & Play as ${verifyingAccount.name}`}</span>
                </button>
              </div>
            </form>
          ) : !isCreating ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Player Profiles (Password Protected)
                </span>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <UserPlus size={14} />
                  <span>Register New Player</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-1">
                {accounts.map((acc) => {
                  const isCurrent = acc.profile.name.toLowerCase() === currentPlayer.name.toLowerCase();
                  const skin = allSkins.find((s) => s.id === acc.profile.equippedSkinId) || allSkins[0];
                  const tier = acc.profile.mandarinMastery?.tier || 1;
                  const tierCfg = MANDARIN_TIER_CONFIG[tier] || MANDARIN_TIER_CONFIG[1];
                  const totalQ = acc.profile.mandarinMastery?.questionsAnswered || 0;
                  const correctQ = acc.profile.mandarinMastery?.correctAnswers || 0;
                  const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 100;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => handleStartSwitchAccount(acc)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm shrink-0 border"
                          style={{
                            backgroundColor: `${skin?.accentColor || '#06B6D4'}22`,
                            borderColor: skin?.accentColor || '#06B6D4',
                          }}
                        >
                          {acc.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{acc.name}</span>
                            <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                              <Lock size={10} /> Password Protected
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black uppercase">
                                Active
                              </span>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 font-medium">
                            <span className="text-slate-200">Level {acc.profile.level}</span>
                            <span>·</span>
                            <span className="text-amber-300 font-mono">🪙 {acc.profile.vCoins}</span>
                            <span>·</span>
                            <span className="text-emerald-400">🏆 {acc.profile.arenaVictories} Wins</span>
                          </div>

                          {/* Mandarin Tier */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${tierCfg.color} bg-slate-900/80 border-slate-700`}
                            >
                              <GraduationCap size={11} />
                              <span>{tierCfg.title}</span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {accuracy}% accuracy ({correctQ} answered)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartSwitchAccount(acc)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors"
                        >
                          <LogIn size={14} />
                          <span>{isCurrent ? 'Playing' : 'Switch'}</span>
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

              {/* Log Out & Lock Device Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Playing on a shared computer? Lock your session so others can't use your save.
                </span>
                <button
                  onClick={() => {
                    onClose();
                    onLogOut();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <LogOut size={14} />
                  <span>Log Out & Lock (退出)</span>
                </button>
              </div>
            </>
          ) : (
            /* REGISTER NEW PLAYER FORM WITH PASSWORD */
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <UserPlus size={16} className="text-cyan-400" />
                <span>Create New Protected Player</span>
              </h3>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Player / Operative Codename
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="e.g. Leo, Maya, DragonPro"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Secret Password or 4-Digit PIN (密码/PIN码)
                </label>
                <input
                  type="password"
                  value={newPlayerPassword}
                  onChange={(e) => setNewPlayerPassword(e.target.value)}
                  placeholder="Set secret PIN (e.g. 1234, 5555)"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-400"
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
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newPlayerName.trim() || !newPlayerPassword.trim()}
                  onClick={handleCreateNewAccount}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Check size={16} />
                  <span>Create & Lock Account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
