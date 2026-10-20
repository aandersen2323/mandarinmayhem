import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, CoachRole } from '../types/game';
import { Send, Volume2, Shield, Zap, Sparkles, Bot, User, Radio, RefreshCw } from 'lucide-react';
import { speakChinese, sounds } from '../utils/audio';

interface SquadCoachViewProps {
  onEarnCoins: (amount: number) => void;
}

export const SquadCoachView: React.FC<SquadCoachViewProps> = ({ onEarnCoins }) => {
  const [rolePreset, setRolePreset] = useState<CoachRole>('squadmate');
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'model',
      text: '你好，战友！(Nǐ hǎo, zhànyǒu! - Hello, squadmate!) I am Squadmate Neo. Ready to drop into Neo-Shanghai? Ask me anything in English or Chinese, and let’s get that Victory Royale!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.8-flash',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const roleConfigs: Record<
    CoachRole,
    { title: string; hanzi: string; model: string; tag: string; icon: typeof Shield; color: string; desc: string }
  > = {
    sifu: {
      title: 'Tactical Sifu',
      hanzi: '战术师父',
      model: 'gemini-4-argon',
      tag: 'Complex Lore & Deep Grammar',
      icon: Shield,
      color: 'text-amber-400 border-amber-500/40 bg-amber-950/20',
      desc: 'Deep explanation of Chinese characters, radicals, story lore, and advanced sentences.',
    },
    squadmate: {
      title: 'Squadmate Neo',
      hanzi: '战友尼奥',
      model: 'gemini-3.8-flash',
      tag: 'Conversational Partner',
      icon: Sparkles,
      color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20',
      desc: 'Fun gaming squadmate for daily dialogue, Fortnite-style callouts, and practice.',
    },
    lightning: {
      title: 'Lightning Drone',
      hanzi: '闪电无人机',
      model: 'gemini-3.1-flash-lite',
      tag: 'Ultra-Fast Flash Hints',
      icon: Zap,
      color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20',
      desc: 'Instant vocabulary translations, speed tips, and rapid tone pronunciation checks.',
    },
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputVal.trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputVal('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, text: m.text })),
          rolePreset,
        }),
      });

      const data = await res.json();
      const botReply: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'model',
        text: data.reply || '没有收到回复 (No response).',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed || roleConfigs[rolePreset].model,
      };

      setMessages((prev) => [...prev, botReply]);
      sounds.playSuccess();
      onEarnCoins(5); // Reward coins for practicing Chinese!
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackMsg: ChatMessage = {
        id: `bot_err_${Date.now()}`,
        role: 'model',
        text: '太棒了！(Tài bàng le! - Awesome!) Keep practicing! Check your network connection to reconnect to the live tactical comms.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'Offline Fallback',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      sounds.playError();
    } finally {
      setIsLoading(false);
    }
  };

  const currentConfig = roleConfigs[rolePreset];

  const quickPrompts = [
    'How do I say "Let’s drop at the Dragon Tower" in Mandarin?',
    'Explain the character 战 (zhàn) for battle',
    'Quiz me on 3 Chinese words for weapons or shields',
    'How do you say "Watch out for the storm!"?',
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header & Role Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-cyan-400 animate-pulse" />
              <h2 className="text-lg md:text-xl font-extrabold text-white uppercase tracking-wider font-['Barlow_Condensed']">
                Tactical Squad Comms & AI Coach
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-turn interactive Mandarin tutor powered by Gemini with adaptive model routing
            </p>
          </div>

          {/* Role Presets */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
            {(Object.keys(roleConfigs) as CoachRole[]).map((key) => {
              const cfg = roleConfigs[key];
              const Icon = cfg.icon;
              const isSelected = rolePreset === key;
              return (
                <button
                  key={key}
                  onClick={() => setRolePreset(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    isSelected
                      ? `${cfg.color} border shadow-sm font-bold`
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon size={14} />
                  <span>{cfg.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Role Meta Banner */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{currentConfig.title} ({currentConfig.hanzi})</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">{currentConfig.desc}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-400">Model Engine:</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold border border-slate-700">
              {currentConfig.model}
            </span>
          </div>
        </div>
      </div>

      {/* Chat Messages Scrollable Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl h-[520px] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isBot = msg.role === 'model';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isBot ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    isBot
                      ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                      : 'bg-blue-950 border-blue-500/40 text-blue-300'
                  }`}
                >
                  {isBot ? <Bot size={18} /> : <User size={18} />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl p-4 text-sm leading-relaxed ${
                    isBot
                      ? 'bg-slate-900 border border-slate-800 text-slate-100 shadow-md'
                      : 'bg-cyan-600 text-slate-950 font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px] opacity-75">
                    <span className="font-bold">
                      {isBot ? currentConfig.title : 'You (Warrior)'}
                    </span>
                    <div className="flex items-center gap-2">
                      {isBot && msg.modelUsed && (
                        <span className="font-mono text-[10px] bg-slate-950/60 px-1.5 py-0.5 rounded text-cyan-300 border border-cyan-500/20">
                          {msg.modelUsed}
                        </span>
                      )}
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                  {/* Audio Speaker Button for Bot Responses */}
                  {isBot && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center gap-2">
                      <button
                        onClick={() => speakChinese(msg.text)}
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/60 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition-colors"
                      >
                        <Volume2 size={14} />
                        <span>Listen to Chinese</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 mr-auto items-center text-slate-400 text-xs py-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                <RefreshCw size={15} className="animate-spin" />
              </div>
              <span className="animate-pulse">
                {currentConfig.title} is analyzing tactics ({currentConfig.model})...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-4 py-2 border-t border-slate-900 bg-slate-900/40 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] text-slate-500 shrink-0 font-semibold">Quick Ask:</span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp)}
              disabled={isLoading}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 whitespace-nowrap transition-colors border border-slate-700/60 disabled:opacity-50"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3"
        >
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={`Ask ${currentConfig.title} in Mandarin or English...`}
            disabled={isLoading}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={isLoading || !inputVal.trim()}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <span>Transmit</span>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
