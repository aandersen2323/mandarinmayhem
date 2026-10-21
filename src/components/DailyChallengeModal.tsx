import React, { useState } from 'react';
import {
  DailyChallenge,
  PlayerProfile,
  MandarinQuestion,
} from '../types/game';
import { getTodayDailyChallenge } from '../data/powerUpData';
import { MANDARIN_QUESTIONS } from '../data/mandarinData';
import { sounds } from '../utils/audio';
import {
  Calendar,
  Sparkles,
  Award,
  CheckCircle2,
  Lock,
  Gift,
  Coins,
  ChevronRight,
  Flame,
  HelpCircle,
} from 'lucide-react';

interface DailyChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerProfile;
  onUpdatePlayer: (updater: (prev: PlayerProfile) => PlayerProfile) => void;
}

export const DailyChallengeModal: React.FC<DailyChallengeModalProps> = ({
  isOpen,
  onClose,
  player,
  onUpdatePlayer,
}) => {
  const challenge = getTodayDailyChallenge();
  const todayDateStr = new Date().toISOString().slice(0, 10);

  // Challenge progress from player profile
  const dailyState =
    player.dailyChallenge?.date === todayDateStr
      ? player.dailyChallenge
      : { date: todayDateStr, progress: 0, completed: false, claimed: false };

  // In-modal interactive practice question
  const [activeQuestion, setActiveQuestion] = useState<MandarinQuestion | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answered, setAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);

  if (!isOpen) return null;

  // Filter questions matching today's challenge category
  const topicQuestions = MANDARIN_QUESTIONS.filter((q) => {
    if (!challenge.categoryFilter) return true;
    return q.category === challenge.categoryFilter;
  });

  const handleStartPracticeQuestion = () => {
    const list = topicQuestions.length > 0 ? topicQuestions : MANDARIN_QUESTIONS;
    const rand = list[Math.floor(Math.random() * list.length)];
    setActiveQuestion(rand);
    setSelectedIdx(null);
    setAnswered(false);
    sounds.playPowerUp();
  };

  const handleAnswer = (idx: number) => {
    if (answered || !activeQuestion) return;
    setSelectedIdx(idx);
    setAnswered(true);

    const correct = idx === activeQuestion.correctIndex;
    setIsCorrect(correct);

    if (correct) {
      sounds.playSuccess();
      const newProgress = Math.min(challenge.targetCount, dailyState.progress + 1);
      const isComplete = newProgress >= challenge.targetCount;

      onUpdatePlayer((prev) => ({
        ...prev,
        dailyChallenge: {
          date: todayDateStr,
          progress: newProgress,
          completed: isComplete,
          claimed: prev.dailyChallenge?.claimed || false,
        },
        mandarinMastery: prev.mandarinMastery
          ? {
              ...prev.mandarinMastery,
              questionsAnswered: prev.mandarinMastery.questionsAnswered + 1,
              correctAnswers: prev.mandarinMastery.correctAnswers + 1,
            }
          : undefined,
      }));
    } else {
      sounds.playDamage();
    }
  };

  const handleClaimReward = () => {
    if (dailyState.claimed || !dailyState.completed) return;
    sounds.playVictory();

    onUpdatePlayer((prev) => {
      const unlockedCosmetics = prev.unlockedCosmeticIds || [];
      if (!unlockedCosmetics.includes(challenge.rewardCosmeticId)) {
        unlockedCosmetics.push(challenge.rewardCosmeticId);
      }

      return {
        ...prev,
        xp: prev.xp + challenge.rewardXp,
        vCoins: prev.vCoins + challenge.rewardCoins,
        unlockedCosmeticIds: [...unlockedCosmetics],
        dailyChallenge: {
          date: todayDateStr,
          progress: dailyState.progress,
          completed: true,
          claimed: true,
        },
      };
    });
  };

  const progressPercent = Math.min(100, (dailyState.progress / challenge.targetCount) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Calendar size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                  Daily Mission · 每日任务
                </span>
                <span className="text-xs text-slate-400 font-mono">{todayDateStr}</span>
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight mt-0.5">
                {challenge.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Challenge Topic Banner */}
        <div className="p-6 space-y-6">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 font-medium">Today's Mandarin Focus:</span>
                <div className="text-xl font-black text-amber-300 font-['Noto_Sans_SC',sans-serif] mt-0.5">
                  {challenge.hanziTitle}
                </div>
                <div className="text-xs text-amber-400/80 font-mono mt-0.5">
                  {challenge.topic} ({challenge.topicPinyin})
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black font-mono text-cyan-300">
                  {dailyState.progress} / {challenge.targetCount}
                </div>
                <div className="text-[10px] text-slate-400 uppercase">Correct Answers</div>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              {challenge.description}
            </p>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 mt-3 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Reward Bundle Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-950 border border-amber-500/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gift size={15} />
                Daily Completion Rewards (丰厚通关大礼)
              </span>
              {dailyState.claimed && (
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Claimed
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Bonus XP</div>
                <div className="text-base font-black text-cyan-300 font-mono">+{challenge.rewardXp}</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-mono">V-Coins</div>
                <div className="text-base font-black text-amber-300 font-mono">+{challenge.rewardCoins}</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/40">
                <div className="text-[10px] text-amber-400 uppercase font-bold">Exclusive Cosmetic</div>
                <div className="text-xs font-bold text-white truncate mt-0.5">
                  {challenge.rewardCosmeticName}
                </div>
              </div>
            </div>

            {/* Claim Action Button */}
            {dailyState.completed && !dailyState.claimed && (
              <button
                onClick={handleClaimReward}
                className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl animate-pulse transition-all"
              >
                Claim Daily Cosmetic & Coins (领取大奖)
              </button>
            )}
          </div>

          {/* Practice Question Card (Directly inside modal for instant progress) */}
          <div className="border-t border-slate-800 pt-4">
            {!activeQuestion ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Flame size={14} className="text-amber-400" />
                    Quick Practice Challenge
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Solve today's focus questions right here or in Arena!
                  </div>
                </div>
                <button
                  onClick={handleStartPracticeQuestion}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs transition-all active:scale-95"
                >
                  Start Practice (开始答题)
                </button>
              </div>
            ) : (
              <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/30">
                <div className="text-center mb-3">
                  <div className="text-2xl font-black text-white font-['Noto_Sans_SC',sans-serif]">
                    {activeQuestion.hanzi}
                  </div>
                  <div className="text-xs font-mono text-cyan-400">{activeQuestion.pinyin}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {activeQuestion.options.map((opt, i) => {
                    let style = 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800';
                    if (answered) {
                      if (i === activeQuestion.correctIndex) {
                        style = 'bg-emerald-600 border-emerald-400 text-white font-bold';
                      } else if (i === selectedIdx) {
                        style = 'bg-rose-600 border-rose-400 text-white';
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        disabled={answered}
                        className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${style}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {answered && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs font-bold text-cyan-300">
                      {isCorrect ? '✓ Correct! +1 Progress!' : '💡 Keep practicing!'}
                    </span>
                    <button
                      onClick={handleStartPracticeQuestion}
                      className="text-xs text-slate-300 hover:text-white underline font-semibold"
                    >
                      Next Question ➔
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
