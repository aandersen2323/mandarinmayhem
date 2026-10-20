import React, { useState } from 'react';
import { PlayerProfile, StoryNode, StoryChoice } from '../types/game';
import { STORY_NODES } from '../data/mandarinData';
import { sounds, speakChinese } from '../utils/audio';
import {
  BookOpen,
  Volume2,
  ChevronRight,
  RotateCcw,
  Trophy,
  Award,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

interface StoryViewProps {
  player: PlayerProfile;
  onUpdatePlayer: (updater: (prev: PlayerProfile) => PlayerProfile) => void;
  onOpenForge: () => void;
}

export const StoryView: React.FC<StoryViewProps> = ({
  player,
  onUpdatePlayer,
  onOpenForge,
}) => {
  const [currentNodeId, setCurrentNodeId] = useState<string>('root');
  const [showPinyin, setShowPinyin] = useState<boolean>(true);
  const [showEnglish, setShowEnglish] = useState<boolean>(true);
  const [lastChoiceFeedback, setLastChoiceFeedback] = useState<string | null>(null);

  const currentNode: StoryNode = STORY_NODES[currentNodeId] || STORY_NODES.root;

  const handleMakeChoice = (choice: StoryChoice) => {
    setLastChoiceFeedback(choice.feedbackText);

    if (choice.isCorrectComprehension) {
      sounds.playSuccess();
      const earnedXp = choice.rewardXp || 25;
      const earnedCoins = choice.rewardCoins || 20;

      onUpdatePlayer((prev) => {
        const completed = prev.completedStoryNodes.includes(currentNodeId)
          ? prev.completedStoryNodes
          : [...prev.completedStoryNodes, currentNodeId];

        const newXp = prev.xp + earnedXp;
        let newLevel = prev.level;
        let newMaxXp = prev.maxXp;
        if (newXp >= prev.maxXp) {
          newLevel += 1;
          newMaxXp = Math.floor(prev.maxXp * 1.3);
          sounds.playVictory();
        }

        return {
          ...prev,
          completedStoryNodes: completed,
          xp: newXp >= prev.maxXp ? newXp - prev.maxXp : newXp,
          maxXp: newMaxXp,
          level: newLevel,
          vCoins: prev.vCoins + earnedCoins,
        };
      });
    } else {
      sounds.playError();
    }

    setTimeout(() => {
      setCurrentNodeId(choice.nextNodeId);
      setLastChoiceFeedback(null);
    }, 1200);
  };

  const handleRestartStory = () => {
    setCurrentNodeId('root');
    setLastChoiceFeedback(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide font-['Barlow_Condensed'] uppercase">
              Neo-Shanghai Chronicles: Battle Island Quest
            </h2>
            <p className="text-xs text-slate-400">
              Interactive narrative role-play: Read Chinese dialogues, make tactical choices, and unlock secret vaults
            </p>
          </div>
        </div>

        {/* Story Progress */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Quests Mastered
            </span>
            <span className="text-sm font-extrabold text-purple-300 font-mono">
              {player.completedStoryNodes.length} / {Object.keys(STORY_NODES).length}
            </span>
          </div>
          <button
            onClick={handleRestartStory}
            title="Restart from beginning"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Main Story Comic/Script Panel */}
      <div className="bg-slate-950 border border-purple-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Subtle Cyber Accent Ring */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Chapter Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-purple-400">
              {currentNode.chapter}
            </span>
            <h3 className="text-xl font-bold text-white">{currentNode.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPinyin(!showPinyin)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                showPinyin
                  ? 'bg-purple-950 border-purple-500/50 text-purple-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              Pinyin {showPinyin ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowEnglish(!showEnglish)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                showEnglish
                  ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              English {showEnglish ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Scene Backdrop Narrative */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs md:text-sm text-slate-300 leading-relaxed italic">
          &ldquo;{currentNode.sceneDescription}&rdquo;
        </div>

        {/* Speaker Dialogue Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs uppercase font-mono">
                {currentNode.speaker.charAt(0)}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">{currentNode.speaker}</span>
                <span className="text-[10px] text-purple-400">{currentNode.speakerRole}</span>
              </div>
            </div>

            {/* Audio Voice Playback */}
            <button
              onClick={() => speakChinese(currentNode.dialogueHanzi)}
              className="px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
            >
              <Volume2 size={16} />
              <span>Listen (朗读台词)</span>
            </button>
          </div>

          {/* Chinese Dialogue Text */}
          <div className="space-y-1.5 pt-1">
            <div className="text-2xl md:text-3xl font-extrabold text-white tracking-wide font-sans">
              &ldquo;{currentNode.dialogueHanzi}&rdquo;
            </div>
            {showPinyin && (
              <div className="text-sm md:text-base font-semibold text-purple-300 font-mono">
                {currentNode.dialoguePinyin}
              </div>
            )}
            {showEnglish && (
              <div className="text-xs text-slate-400 mt-1">
                {currentNode.dialogueEnglish}
              </div>
            )}
          </div>
        </div>

        {/* Last Choice Feedback Notification */}
        {lastChoiceFeedback && (
          <div className="p-3 rounded-xl bg-purple-950/70 border border-purple-500 text-purple-200 text-xs font-bold text-center animate-in fade-in zoom-in-95">
            {lastChoiceFeedback}
          </div>
        )}

        {/* Branching Choices Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Choose Your Action (点击选择回应):
          </h4>

          <div className="space-y-2.5">
            {currentNode.choices.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => handleMakeChoice(choice)}
                className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-400 hover:bg-slate-850 text-left transition-all group flex items-center justify-between gap-4 active:scale-[0.99]"
              >
                <div className="space-y-1 flex-1">
                  <div className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                    {choice.textHanzi}
                  </div>
                  {showPinyin && (
                    <div className="text-xs font-medium text-purple-400 font-mono">
                      {choice.textPinyin}
                    </div>
                  )}
                  {showEnglish && (
                    <div className="text-xs text-slate-400">{choice.textEnglish}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {choice.rewardCoins && (
                    <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded">
                      +{choice.rewardCoins} Coins
                    </span>
                  )}
                  <ChevronRight size={18} className="text-slate-500 group-hover:text-purple-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Ending Epilogue Card */}
        {currentNode.isEnding && (
          <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-center space-y-3">
            <Trophy size={32} className="mx-auto text-amber-400" />
            <h4 className="text-lg font-bold text-white uppercase font-['Barlow_Condensed']">
              Chapter Completed! (任务完成)
            </h4>
            <p className="text-xs text-slate-300">
              You used your Mandarin immersion knowledge to guide the squad to victory!
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={handleRestartStory}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Replay Mission
              </button>
              <button
                onClick={onOpenForge}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>Craft Chapter Skin</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
