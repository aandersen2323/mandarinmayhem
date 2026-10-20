import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Flame, Zap, Shield, RefreshCw, UploadCloud, CheckCircle2 } from 'lucide-react';
import { LeaderboardEntry, PlayerProfile, SkinItem } from '../types/game';
import { sounds } from '../utils/audio';

interface LeaderboardViewProps {
  player: PlayerProfile;
  equippedSkin: SkinItem;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ player, equippedSkin }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [filter, setFilter] = useState<'wins' | 'mandarin' | 'level'>('wins');

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.warn('Failed to fetch leaderboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleSubmitScore = async () => {
    setIsSubmitting(true);
    setSubmitSuccess(false);
    try {
      const res = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: player.name,
          level: player.level,
          wins: player.arenaVictories || 0,
          eliminations: (player.arenaVictories || 0) * 8 + Math.floor(player.xp / 15),
          mandarinScore: player.xp + (player.arenaVictories || 0) * 100,
          accuracy: 94,
          skinId: player.equippedSkinId,
          accentColor: equippedSkin.accentColor || '#06B6D4',
        }),
      });

      if (res.ok) {
        setSubmitSuccess(true);
        sounds.playVictory();
        await fetchLeaderboard();
        setTimeout(() => setSubmitSuccess(false), 3000);
      }
    } catch (e) {
      console.warn('Failed to submit score:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (filter === 'wins') return b.wins - a.wins;
    if (filter === 'mandarin') return b.mandarinScore - a.mandarinScore;
    return b.level - a.level;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy size={22} className="text-amber-400" />
            <h2 className="text-xl md:text-2xl font-extrabold text-white uppercase tracking-wider font-['Barlow_Condensed']">
              Neo-Shanghai Operative Leaderboard (排行榜)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global rankings of battle royale champions and Mandarin immersion masters
          </p>
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setFilter('wins')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'wins' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Victory Royales
            </button>
            <button
              onClick={() => setFilter('mandarin')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'mandarin' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mandarin Score
            </button>
            <button
              onClick={() => setFilter('level')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'level' ? 'bg-purple-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Level Rank
            </button>
          </div>

          <button
            onClick={fetchLeaderboard}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Leaderboard"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Your Rank Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-sm border"
            style={{
              backgroundColor: `${equippedSkin.accentColor || '#06B6D4'}22`,
              borderColor: equippedSkin.accentColor || '#06B6D4',
            }}
          >
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base">{player.name}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                You (当前玩家)
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
              <span>Level <strong className="text-white">{player.level}</strong></span>
              <span>·</span>
              <span>Wins: <strong className="text-amber-400">{player.arenaVictories || 0}</strong></span>
              <span>·</span>
              <span>XP: <strong className="text-cyan-400">{player.xp}</strong></span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmitScore}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
        >
          {submitSuccess ? (
            <>
              <CheckCircle2 size={16} className="text-slate-950" />
              <span>Rank Updated!</span>
            </>
          ) : (
            <>
              <UploadCloud size={16} />
              <span>{isSubmitting ? 'Syncing...' : 'Submit My Score to Board'}</span>
            </>
          )}
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="grid grid-cols-12 px-4 py-3 bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
          <div className="col-span-6 sm:col-span-5">Operative</div>
          <div className="col-span-2 sm:col-span-2 text-center">Level</div>
          <div className="col-span-2 sm:col-span-2 text-center">Wins</div>
          <div className="hidden sm:block sm:col-span-2 text-right">Mandarin Score</div>
        </div>

        <div className="divide-y divide-slate-800/60">
          {sortedLeaderboard.map((entry, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            const isCurrentPlayer = entry.name.toLowerCase() === player.name.toLowerCase();

            return (
              <div
                key={entry.id}
                className={`grid grid-cols-12 px-4 py-3.5 items-center transition-colors text-xs ${
                  isCurrentPlayer
                    ? 'bg-cyan-950/20 font-semibold'
                    : 'hover:bg-slate-900/40'
                }`}
              >
                {/* Rank Badge */}
                <div className="col-span-2 sm:col-span-1 flex items-center justify-center font-extrabold text-sm font-['Barlow_Condensed']">
                  {rank === 1 ? (
                    <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-[0_0_10px_rgba(251,191,36,0.5)]">
                      1
                    </span>
                  ) : rank === 2 ? (
                    <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-950 flex items-center justify-center">
                      2
                    </span>
                  ) : rank === 3 ? (
                    <span className="w-7 h-7 rounded-full bg-amber-700 text-amber-100 flex items-center justify-center">
                      3
                    </span>
                  ) : (
                    <span className="text-slate-400">#{rank}</span>
                  )}
                </div>

                {/* Name & Avatar */}
                <div className="col-span-6 sm:col-span-5 flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs border"
                    style={{
                      backgroundColor: `${entry.accentColor}22`,
                      borderColor: entry.accentColor,
                    }}
                  >
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{entry.name}</span>
                      {isCurrentPlayer && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {entry.eliminations} Eliminations · {entry.accuracy}% Accuracy
                    </div>
                  </div>
                </div>

                {/* Level */}
                <div className="col-span-2 sm:col-span-2 text-center font-mono font-bold text-purple-300">
                  Lv.{entry.level}
                </div>

                {/* Wins */}
                <div className="col-span-2 sm:col-span-2 text-center font-extrabold font-mono text-amber-400">
                  {entry.wins} 🏆
                </div>

                {/* Mandarin Score */}
                <div className="hidden sm:block sm:col-span-2 text-right font-mono font-bold text-cyan-400">
                  {entry.mandarinScore.toLocaleString()} PTS
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
