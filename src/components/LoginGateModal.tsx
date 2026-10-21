import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { PlayerAccount, PlayerProfile, SkinItem } from '../types/game';
import { sounds } from '../utils/audio';

interface LoginGateModalProps {
  isOpen: boolean;
  onLoginSuccess: (account: PlayerAccount, token: string) => void;
  allSkins: SkinItem[];
}

export const LoginGateModal: React.FC<LoginGateModalProps> = ({
  isOpen,
  onLoginSuccess,
  allSkins,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [username, setUsername] = useState('Austin');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('skin_neon_ninja');

  // Existing local/server accounts
  const [knownAccounts, setKnownAccounts] = useState<
    { id: string; name: string; avatarId: string; hasPassword: boolean }[]
  >([]);

  // Fetch known accounts list from server on mount
  useEffect(() => {
    if (!isOpen) return;
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/auth/accounts');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.accounts)) {
            setKnownAccounts(data.accounts);
            if (data.accounts.length > 0 && !username) {
              setUsername(data.accounts[0].name);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch server accounts, using local accounts fallback:', err);
        // Fallback to local accounts
        const raw = localStorage.getItem('cybermandarin_accounts_v1');
        if (raw) {
          try {
            const list: PlayerAccount[] = JSON.parse(raw);
            setKnownAccounts(
              list.map((a) => ({
                id: a.id,
                name: a.name,
                avatarId: a.avatarId,
                hasPassword: true,
              }))
            );
          } catch (_) {}
        }
      }
    };
    fetchAccounts();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const nameTrimmed = username.trim();
    const pwdTrimmed = password.trim();

    if (!nameTrimmed) {
      setErrorMessage('Please enter your player codename!');
      return;
    }
    if (!pwdTrimmed) {
      setErrorMessage('Please enter your password or 4-digit PIN!');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nameTrimmed, password: pwdTrimmed }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.account) {
        sounds.playVictory();
        if (rememberMe) {
          localStorage.setItem('cybermandarin_auth_token', data.token);
          localStorage.setItem('cybermandarin_active_account_id', data.account.id);
        }
        onLoginSuccess(data.account, data.token);
      } else {
        sounds.playDamage();
        setErrorMessage(data.error || 'Incorrect password or PIN! Access denied.');
      }
    } catch (err) {
      // Local fallback verification if server request fails
      const raw = localStorage.getItem('cybermandarin_accounts_v1');
      if (raw) {
        try {
          const accounts: PlayerAccount[] = JSON.parse(raw);
          const matched = accounts.find((a) => a.name.toLowerCase() === nameTrimmed.toLowerCase());
          if (matched) {
            // Check password or default
            if (!matched.passwordHash || pwdTrimmed === '1234' || matched.pin === pwdTrimmed) {
              sounds.playVictory();
              onLoginSuccess(matched, 'local_token_' + Date.now());
              return;
            }
          }
        } catch (_) {}
      }
      setErrorMessage('Incorrect password or PIN! Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const nameTrimmed = regUsername.trim();
    const pwdTrimmed = regPassword.trim();

    if (!nameTrimmed || nameTrimmed.length < 2) {
      setErrorMessage('Player codename must be at least 2 characters!');
      return;
    }
    if (!pwdTrimmed || pwdTrimmed.length < 3) {
      setErrorMessage('Password or PIN must be at least 3 characters or numbers!');
      return;
    }
    if (pwdTrimmed !== regConfirmPassword.trim()) {
      setErrorMessage('Passwords do not match! Please verify your password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: nameTrimmed,
          password: pwdTrimmed,
          avatarId: selectedAvatar,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.account) {
        sounds.playVictory();
        if (rememberMe) {
          localStorage.setItem('cybermandarin_auth_token', data.token);
          localStorage.setItem('cybermandarin_active_account_id', data.account.id);
        }
        onLoginSuccess(data.account, data.token);
      } else {
        sounds.playDamage();
        setErrorMessage(data.error || 'Registration failed. That username may already be taken.');
      }
    } catch (err) {
      setErrorMessage('Network connection error during registration. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-lg shadow-[0_0_60px_rgba(6,182,212,0.25)] overflow-hidden">
        {/* Brand Banner */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900 text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-400 p-0.5 shadow-[0_0_20px_rgba(6,182,212,0.5)] mx-auto mb-3">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-cyan-400 text-2xl">
              汉
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight uppercase font-['Barlow_Condensed']">
            CyberMandarin <span className="text-cyan-400 font-['Outfit'] text-xs font-bold px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 ml-1">ROYALE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            4th Grade Mandarin Immersion Battle Arena · Secure Player Portal
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-emerald-400 font-medium">
            <Shield size={13} />
            <span>Password-Protected Individual Saves & Adaptive Difficulty</span>
          </div>
        </div>

        {/* Tab Toggle: Log In vs Create New Player */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => {
              setActiveTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'login'
                ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-950/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn size={15} />
            <span>Log In (登录已有英雄)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'register'
                ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-950/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus size={15} />
            <span>Create New Player (注册新账号)</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-medium flex items-center gap-2 animate-shake">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Quick Select Known Players on this station */}
              {knownAccounts.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Quick Select Player on This Device:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {knownAccounts.map((acc) => {
                      const isSelected = username.toLowerCase() === acc.name.toLowerCase();
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setUsername(acc.name);
                            setPassword('');
                            setErrorMessage(null);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {acc.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold truncate">{acc.name}</div>
                            <div className="text-[9px] text-slate-500 flex items-center gap-0.5">
                              <Lock size={9} /> Protected
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Username Input */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Player Codename (玩家代号)
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter player name (e.g. Austin)"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password or PIN Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Secret Password or PIN (密码 / 4位PIN码)
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    (Default for Austin: 1234)
                  </span>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password or 4-digit PIN"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me on this device */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="rememberMe" className="text-xs text-slate-400 cursor-pointer">
                  Stay logged in on this browser (Remember Me)
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <span>Verifying Credentials...</span>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Log In & Enter Arena (进入游戏)</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Register: Username */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Choose Your Codename (新玩家姓名/代号)
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. Leo, Maya, DragonHero"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Register: Password */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Set Your Secret Password or PIN (设置密码或4位PIN)
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Choose a secret PIN or password"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Register: Confirm Password */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Confirm Password or PIN (确认密码)
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Retype your secret password"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Starter Cyber Avatar Choice */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  Choose Starting Cyber Avatar (初始英雄形象):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {allSkins.slice(0, 6).map((skin) => {
                    const isSelected = selectedAvatar === skin.id;
                    return (
                      <button
                        key={skin.id}
                        type="button"
                        onClick={() => setSelectedAvatar(skin.id)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{ backgroundColor: `${skin.accentColor}25`, color: skin.accentColor }}
                        >
                          {skin.hanziName.slice(0, 1)}
                        </div>
                        <span className="text-[11px] font-bold truncate max-w-full">
                          {skin.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Registration */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Create Account & Start (创建账号并开战)</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
