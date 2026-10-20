import React, { useState, useEffect } from 'react';
import { PlayerProfile, MandarinQuestion } from '../types/game';
import { MANDARIN_QUESTIONS } from '../data/mandarinData';
import { sounds, speakChinese } from '../utils/audio';
import {
  Gamepad2,
  Volume2,
  Clock,
  Sparkles,
  Trophy,
  RotateCcw,
  Zap,
  Check,
  Flame,
} from 'lucide-react';

interface DojoViewProps {
  player: PlayerProfile;
  onUpdatePlayer: (updater: (prev: PlayerProfile) => PlayerProfile) => void;
}

type MinigameMode = 'match' | 'sound_hunter' | 'speed_blitz';

export const DojoView: React.FC<DojoViewProps> = ({ player, onUpdatePlayer }) => {
  const [activeMode, setActiveMode] = useState<MinigameMode>('match');

  // MATCH MODE STATE
  interface MatchCard {
    id: string;
    text: string;
    pairKey: string;
    isPinyin: boolean;
    isMatched: boolean;
  }
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<MatchCard[]>([]);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [matchComplete, setMatchComplete] = useState<boolean>(false);

  // SOUND HUNTER STATE
  const [hunterRound, setHunterRound] = useState<number>(0);
  const [hunterScore, setHunterScore] = useState<number>(0);
  const [hunterTarget, setHunterTarget] = useState<MandarinQuestion>(MANDARIN_QUESTIONS[0]);
  const [hunterOptions, setHunterOptions] = useState<MandarinQuestion[]>([]);
  const [hunterFeedback, setHunterFeedback] = useState<string | null>(null);

  // SPEED BLITZ STATE
  const [blitzTimer, setBlitzTimer] = useState<number>(60);
  const [blitzActive, setBlitzActive] = useState<boolean>(false);
  const [blitzScore, setBlitzScore] = useState<number>(0);
  const [blitzQuestion, setBlitzQuestion] = useState<MandarinQuestion>(MANDARIN_QUESTIONS[0]);

  // Init Match Game
  const initMatchGame = () => {
    // Pick 6 random vocabulary words
    const shuffledQ = [...MANDARIN_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 6);
    const cards: MatchCard[] = [];

    shuffledQ.forEach((q) => {
      cards.push({
        id: `h_${q.id}`,
        text: q.hanzi,
        pairKey: q.id,
        isPinyin: false,
        isMatched: false,
      });
      cards.push({
        id: `p_${q.id}`,
        text: q.pinyin,
        pairKey: q.id,
        isPinyin: true,
        isMatched: false,
      });
    });

    setMatchCards(cards.sort(() => Math.random() - 0.5));
    setSelectedCards([]);
    setMatchScore(0);
    setMatchComplete(false);
  };

  // Init Sound Hunter Game
  const nextHunterRound = () => {
    const target = MANDARIN_QUESTIONS[Math.floor(Math.random() * MANDARIN_QUESTIONS.length)];
    const others = MANDARIN_QUESTIONS.filter((q) => q.id !== target.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const pool = [target, ...others].sort(() => Math.random() - 0.5);

    setHunterTarget(target);
    setHunterOptions(pool);
    setHunterFeedback(null);
    speakChinese(target.hanzi);
  };

  // Init Speed Blitz Game
  const startBlitzGame = () => {
    setBlitzTimer(60);
    setBlitzScore(0);
    setBlitzActive(true);
    setBlitzQuestion(MANDARIN_QUESTIONS[Math.floor(Math.random() * MANDARIN_QUESTIONS.length)]);
  };

  useEffect(() => {
    if (activeMode === 'match') {
      initMatchGame();
    } else if (activeMode === 'sound_hunter') {
      nextHunterRound();
    }
  }, [activeMode]);

  // Speed blitz timer countdown
  useEffect(() => {
    if (!blitzActive) return;
    const interval = setInterval(() => {
      setBlitzTimer((prev) => {
        if (prev <= 1) {
          setBlitzActive(false);
          sounds.playVictory();
          // Award coins based on blitz score
          onUpdatePlayer((p) => ({ ...p, vCoins: p.vCoins + blitzScore * 5 }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [blitzActive, blitzScore, onUpdatePlayer]);

  // Handle Match Card Click
  const handleCardClick = (card: MatchCard) => {
    if (card.isMatched || selectedCards.some((c) => c.id === card.id) || selectedCards.length >= 2) {
      return;
    }

    if (!card.isPinyin) {
      speakChinese(card.text);
    }

    const newSelected = [...selectedCards, card];
    setSelectedCards(newSelected);

    if (newSelected.length === 2) {
      const [c1, c2] = newSelected;
      if (c1.pairKey === c2.pairKey && c1.isPinyin !== c2.isPinyin) {
        // MATCH!
        sounds.playSuccess();
        setMatchCards((prev) =>
          prev.map((c) => (c.pairKey === c1.pairKey ? { ...c, isMatched: true } : c))
        );
        setSelectedCards([]);
        setMatchScore((s) => s + 25);

        onUpdatePlayer((p) => ({
          ...p,
          vCoins: p.vCoins + 10,
          xp: p.xp + 15,
        }));

        // Check if all matched
        setTimeout(() => {
          setMatchCards((current) => {
            if (current.every((c) => c.isMatched || c.pairKey === c1.pairKey)) {
              setMatchComplete(true);
              sounds.playVictory();
            }
            return current;
          });
        }, 300);
      } else {
        // Mismatch
        sounds.playError();
        setTimeout(() => {
          setSelectedCards([]);
        }, 900);
      }
    }
  };

  // Sound hunter option pick
  const handleHunterAnswer = (option: MandarinQuestion) => {
    if (hunterFeedback) return;

    if (option.id === hunterTarget.id) {
      sounds.playSuccess();
      setHunterScore((s) => s + 30);
      setHunterFeedback('正确！(Correct!) +30 Points');
      onUpdatePlayer((p) => ({ ...p, vCoins: p.vCoins + 15, xp: p.xp + 20 }));

      setTimeout(() => {
        nextHunterRound();
      }, 1100);
    } else {
      sounds.playError();
      setHunterFeedback(`不正确。The word was ${hunterTarget.hanzi} (${hunterTarget.pinyin} - ${hunterTarget.english})`);
      setTimeout(() => {
        nextHunterRound();
      }, 2000);
    }
  };

  // Speed blitz answer pick
  const handleBlitzAnswer = (idx: number) => {
    if (!blitzActive) return;

    if (idx === blitzQuestion.correctIndex) {
      sounds.playSuccess();
      setBlitzScore((s) => s + 1);
      setBlitzQuestion(MANDARIN_QUESTIONS[Math.floor(Math.random() * MANDARIN_QUESTIONS.length)]);
    } else {
      sounds.playError();
      setBlitzQuestion(MANDARIN_QUESTIONS[Math.floor(Math.random() * MANDARIN_QUESTIONS.length)]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Mode Navigation Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide uppercase font-['Barlow_Condensed']">
            Mandarin Skill Dojo (训练道场)
          </h2>
          <p className="text-xs text-slate-400">
            Speed recall, character matching, and auditory tone exercises designed for 4th-grade mastery
          </p>
        </div>

        {/* Segmented Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveMode('match')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'match'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Character Match
          </button>
          <button
            onClick={() => setActiveMode('sound_hunter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'sound_hunter'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sound Hunter
          </button>
          <button
            onClick={() => setActiveMode('speed_blitz')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeMode === 'speed_blitz'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Speed Fire 60s
          </button>
        </div>
      </div>

      {/* MINIGAME 1: CHARACTER TO PINYIN MATCH */}
      {activeMode === 'match' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block">
                Memory Matrix
              </span>
              <h3 className="text-lg font-bold text-white">Tap Hanzi & Matching Pinyin</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-amber-300 font-mono font-bold tabular-nums">
                Score: {matchScore} pts
              </span>
              <button
                onClick={initMatchGame}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Shuffle New Cards"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {matchCards.map((card) => {
              const isSelected = selectedCards.some((c) => c.id === card.id);
              return (
                <button
                  key={card.id}
                  disabled={card.isMatched}
                  onClick={() => handleCardClick(card)}
                  className={`h-24 md:h-28 rounded-2xl border-2 flex flex-col items-center justify-center p-2 text-center transition-all duration-200 active:scale-95 ${
                    card.isMatched
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 opacity-40 cursor-default'
                      : isSelected
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-900 border-slate-800 text-white hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <span
                    className={`font-bold transition-transform ${
                      card.isPinyin ? 'text-sm md:text-base font-mono text-cyan-300' : 'text-2xl md:text-3xl font-sans'
                    }`}
                  >
                    {card.text}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-mono mt-1">
                    {card.isPinyin ? 'Pinyin' : 'Hanzi'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Completion Banner */}
          {matchComplete && (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500 text-center space-y-2 animate-in fade-in zoom-in-95">
              <Trophy size={28} className="mx-auto text-emerald-400" />
              <h4 className="text-base font-bold text-white uppercase font-['Barlow_Condensed']">
                All Pairs Synchronized! (+150 XP)
              </h4>
              <button
                onClick={initMatchGame}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Play Next Round
              </button>
            </div>
          )}
        </div>
      )}

      {/* MINIGAME 2: SOUND HUNTER */}
      {activeMode === 'sound_hunter' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl text-center">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block">
                Auditory Recognition
              </span>
              <h3 className="text-lg font-bold text-white">Listen to Voice & Identify Hanzi</h3>
            </div>
            <span className="text-xs text-amber-300 font-mono font-bold tabular-nums">
              Score: {hunterScore} pts
            </span>
          </div>

          {/* Sound Trigger Orb */}
          <div className="py-4 space-y-3">
            <button
              onClick={() => speakChinese(hunterTarget.hanzi)}
              className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-emerald-600 to-cyan-500 hover:scale-105 active:scale-95 flex items-center justify-center text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
            >
              <Volume2 size={40} />
            </button>
            <p className="text-xs text-slate-400">
              Tap the speaker to replay native Mandarin pronunciation
            </p>
          </div>

          {/* Feedback banner */}
          {hunterFeedback && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-emerald-300 animate-in fade-in">
              {hunterFeedback}
            </div>
          )}

          {/* Choice Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {hunterOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleHunterAnswer(opt)}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-400 text-center transition-all group active:scale-95"
              >
                <div className="text-3xl font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                  {opt.hanzi}
                </div>
                <div className="text-xs text-slate-500 mt-1">{opt.english}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MINIGAME 3: SPEED FIRE 60S */}
      {activeMode === 'speed_blitz' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl text-center">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest block">
                60-Second Challenge
              </span>
              <h3 className="text-lg font-bold text-white">Quick-Fire Recall Rush</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 text-amber-300 font-mono font-bold text-sm">
                <Clock size={16} />
                <span>{blitzTimer}s</span>
              </div>
              <span className="text-xs text-cyan-300 font-mono font-bold">
                Answers: {blitzScore}
              </span>
            </div>
          </div>

          {!blitzActive && blitzTimer === 60 ? (
            <div className="py-12 space-y-4">
              <Zap size={48} className="mx-auto text-amber-400" />
              <h4 className="text-2xl font-bold text-white font-['Barlow_Condensed'] uppercase">
                Ready for the Speed Blitz?
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Test your reaction time! Answer as many Mandarin vocabulary questions as you can in 60 seconds to earn bonus V-Coins!
              </p>
              <button
                onClick={startBlitzGame}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-extrabold text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                Start 60s Blitz!
              </button>
            </div>
          ) : !blitzActive && blitzTimer === 0 ? (
            <div className="py-8 space-y-4">
              <Trophy size={48} className="mx-auto text-amber-400" />
              <h4 className="text-3xl font-extrabold text-white font-['Barlow_Condensed'] uppercase">
                Blitz Complete!
              </h4>
              <p className="text-sm text-slate-300">
                You correctly recalled <strong className="text-amber-400 font-mono">{blitzScore}</strong> words and earned <strong className="text-cyan-400 font-mono">+{blitzScore * 5}</strong> V-Coins!
              </p>
              <button
                onClick={startBlitzGame}
                className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase"
              >
                Play Again
              </button>
            </div>
          ) : (
            <div className="space-y-6 py-2">
              <div className="p-6 rounded-2xl bg-slate-900 border border-cyan-500/30">
                <h1 className="text-5xl font-extrabold text-white">{blitzQuestion.hanzi}</h1>
                <p className="text-lg text-cyan-400 font-mono mt-1">{blitzQuestion.pinyin}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {blitzQuestion.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleBlitzAnswer(i)}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-400 text-left text-sm font-semibold text-white transition-all active:scale-98"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
