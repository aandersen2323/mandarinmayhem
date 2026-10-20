import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Shield, Zap, Sparkles, Radio, Send, CheckCircle2, Award, BookOpen, Target, Crosshair } from 'lucide-react';
import { speakChinese, sounds } from '../utils/audio';

interface SquadCoachViewProps {
  onEarnCoins: (amount: number) => void;
}

interface TacticalCallout {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  category: 'combat' | 'survival' | 'loot' | 'tactics';
  botReplyHanzi: string;
  botReplyPinyin: string;
  botReplyEnglish: string;
}

const TACTICAL_CALLOUTS: TacticalCallout[] = [
  {
    id: 'c1',
    hanzi: '敌人在240方向！',
    pinyin: 'dí rén zài èr bǎi sì shí fāng xiàng!',
    english: 'Enemies at 240 degrees!',
    category: 'combat',
    botReplyHanzi: '收到！正在架枪掩护！',
    botReplyPinyin: 'shōu dào! zhèng zài jià qiāng yǎn hù!',
    botReplyEnglish: 'Copy that! Setting up crossfire to cover you!',
  },
  {
    id: 'c2',
    hanzi: '我需要换弹，掩护我！',
    pinyin: 'wǒ xū yào huàn dàn, yǎn hù wǒ!',
    english: 'I need to reload, cover me!',
    category: 'combat',
    botReplyHanzi: '没问题，火力压制中！按 [R] 快速换弹！',
    botReplyPinyin: 'méi wèn tí, huǒ lì yā zhì zhōng! àn [R] kuài sù huàn dàn!',
    botReplyEnglish: 'No problem, suppressing fire active! Press [R] to tactical reload!',
  },
  {
    id: 'c3',
    hanzi: '毒圈正在缩小，快跑！',
    pinyin: 'dú quān zhèng zài suō xiǎo, kuài pǎo!',
    english: 'The storm circle is shrinking, run!',
    category: 'survival',
    botReplyHanzi: '跟着我！往中央钟楼撤退！',
    botReplyPinyin: 'gēn zhe wǒ! wǎng zhōng yāng zhōng lóu chè tuì!',
    botReplyEnglish: 'Follow me! Retreating toward the Central Clocktower!',
  },
  {
    id: 'c4',
    hanzi: '这里有大护盾药水！',
    pinyin: 'zhè lǐ yǒu dà hù dùn yào shuǐ!',
    english: 'Big shield potion here (+50 Shield)!',
    category: 'loot',
    botReplyHanzi: '太棒了！先喝药水把护盾补满！',
    botReplyPinyin: 'tài bàng le! xiān hē yào shuǐ bǎ hù dùn bǔ mǎn!',
    botReplyEnglish: 'Awesome! Drink the potion first to max out shields!',
  },
  {
    id: 'c5',
    hanzi: '我们占领屋顶制高点！',
    pinyin: 'wǒ men zhàn lǐng wū dǐng zhì gāo diǎn!',
    english: 'Let’s take the rooftop high ground!',
    category: 'tactics',
    botReplyHanzi: '踩木斜坡上去，我在集装箱顶上架狙！',
    botReplyPinyin: 'cǎi mù xié pō shàng qù, wǒ zài jí zhuāng xiāng dǐng shàng jià jū!',
    botReplyEnglish: 'Climb the wooden ramps up, I am sniping from the container rooftop!',
  },
  {
    id: 'c6',
    hanzi: '击倒一个敌人！漂亮！',
    pinyin: 'jī dǎo yí gè dí rén! piào liang!',
    english: 'Knocked down an enemy! Nice shot!',
    category: 'combat',
    botReplyHanzi: '干得好！还剩最后一个小队，大吉大利！',
    botReplyPinyin: 'gàn de hǎo! hái shèng zuì hòu yí gè xiǎo duì, dà jí dà lì!',
    botReplyEnglish: 'Great work! Only one squad remaining, Victory Royale in sight!',
  },
  {
    id: 'c7',
    hanzi: '我这里有黄金宝箱！',
    pinyin: 'wǒ zhè lǐ yǒu huáng jīn bǎo xiāng!',
    english: 'I have a Golden Chest here!',
    category: 'loot',
    botReplyHanzi: '快打开！里面有传奇金色武器！',
    botReplyPinyin: 'kuài dǎ kāi! lǐ miàn yǒu chuán qí jīn sè wǔ qì!',
    botReplyEnglish: 'Open it fast! There is a legendary golden weapon inside!',
  },
  {
    id: 'c8',
    hanzi: '别放弃，我们能赢！',
    pinyin: 'bié fàng qì, wǒ men néng yíng!',
    english: 'Don’t give up, we can win this!',
    category: 'survival',
    botReplyHanzi: '加油！保持专注，夺取第一名！',
    botReplyPinyin: 'jiā yóu! bǎo chí zhuān zhù, duó qǔ dì yī míng!',
    botReplyEnglish: 'Let’s go! Stay focused and seize 1st place!',
  },
];

interface CharacterRadical {
  hanzi: string;
  pinyin: string;
  meaning: string;
  radical: string;
  radicalMeaning: string;
  breakdown: string;
  gamingUsage: string;
}

const RADICAL_LESSONS: CharacterRadical[] = [
  {
    hanzi: '枪',
    pinyin: 'qiāng',
    meaning: 'Gun / Rifle / Spear',
    radical: '木 (Wood)',
    radicalMeaning: 'Originally ancient Chinese spears were carved from wood shafts!',
    breakdown: '木 (Wood shaft) + 仓 (Barn/Storage) = 枪 (Weapon/Spear/Gun)',
    gamingUsage: '冲锋枪 (SMG), 狙击步枪 (Sniper Rifle), 步枪 (Assault Rifle)',
  },
  {
    hanzi: '弹',
    pinyin: 'dàn',
    meaning: 'Bullet / Ammo / Projectile',
    radical: '弓 (Bow)',
    radicalMeaning: 'Bow that shoots arrows or round pellets at high speed!',
    breakdown: '弓 (Bow) + 单 (Single pellet) = 弹 (Bullet / Cartridge)',
    gamingUsage: '换弹 (Reload ammo), 弹药箱 (Ammo crate), 防弹衣 (Body armor)',
  },
  {
    hanzi: '盾',
    pinyin: 'dùn',
    meaning: 'Shield / Defense',
    radical: '目 (Eye) / 盾 (Shield)',
    radicalMeaning: 'A handheld barrier with a slit for your eyes to peer through!',
    breakdown: '厂 (Cliff/Cover) + 十 + 目 (Eye) = 盾 (Defensive shield)',
    gamingUsage: '护盾药水 (Shield potion), 满盾 (100% full shield), 破盾 (Shield broken)',
  },
  {
    hanzi: '战',
    pinyin: 'zhàn',
    meaning: 'Battle / War / Combat',
    radical: '戈 (Dagger-axe / Halberd weapon)',
    radicalMeaning: 'Ancient bronze weapon on a staff used by warriors!',
    breakdown: '占 (Fortune/Territory) + 戈 (Dagger-axe weapon) = 战 (Fight for territory)',
    gamingUsage: '战术 (Tactics), 战友 (Squadmate), 决赛圈 (Final battle storm circle)',
  },
  {
    hanzi: '胜',
    pinyin: 'shèng',
    meaning: 'Victory / Win',
    radical: '力 (Strength / Power)',
    radicalMeaning: 'Physical force and energy needed to triumph!',
    breakdown: '月 (Body flesh) + 券 (Ticket) + 力 (Power) = 胜 (Triumphant victory)',
    gamingUsage: '胜利 (Victory), 第一名 (1st Place), 大吉大利 (Victory Royale)',
  },
  {
    hanzi: '药',
    pinyin: 'yào',
    meaning: 'Medicine / Healing',
    radical: '艹 (Grass / Herbal medicine)',
    radicalMeaning: 'Herbal plants harvested for healing potions!',
    breakdown: '艹 (Healing plant) + 约 (Agreement/Harmonize) = 药 (Medicine / Potion)',
    gamingUsage: '医疗箱 (Medkit), 喝药 (Drink potion), 回血 (Restore HP)',
  },
];

interface ToneQuiz {
  hanzi: string;
  pinyinWithoutTone: string;
  correctTone: 1 | 2 | 3 | 4;
  fullPinyin: string;
  english: string;
}

const TONE_QUIZZES: ToneQuiz[] = [
  { hanzi: '枪', pinyinWithoutTone: 'qiang', correctTone: 1, fullPinyin: 'qiāng', english: 'Gun / Rifle' },
  { hanzi: '毒', pinyinWithoutTone: 'du', correctTone: 2, fullPinyin: 'dú', english: 'Poison / Storm' },
  { hanzi: '盾', pinyinWithoutTone: 'dun', correctTone: 4, fullPinyin: 'dùn', english: 'Shield' },
  { hanzi: '买', pinyinWithoutTone: 'mai', correctTone: 3, fullPinyin: 'mǎi', english: 'To Buy' },
  { hanzi: '快', pinyinWithoutTone: 'kuai', correctTone: 4, fullPinyin: 'kuài', english: 'Fast / Quick' },
  { hanzi: '赢', pinyinWithoutTone: 'ying', correctTone: 2, fullPinyin: 'yíng', english: 'To Win' },
  { hanzi: '跑', pinyinWithoutTone: 'pao', correctTone: 3, fullPinyin: 'pǎo', english: 'To Run' },
  { hanzi: '车', pinyinWithoutTone: 'che', correctTone: 1, fullPinyin: 'chē', english: 'Vehicle / Car' },
];

export const SquadCoachView: React.FC<SquadCoachViewProps> = ({ onEarnCoins }) => {
  const [activeTab, setActiveTab] = useState<'radio' | 'radicals' | 'tones'>('radio');
  const [commsFeed, setCommsFeed] = useState<Array<{ sender: string; hanzi: string; pinyin: string; english: string; isBot: boolean }>>([
    {
      sender: 'Squadmate Neo (战友尼奥)',
      hanzi: '你好，战友！Neo-Shanghai 战场频道已连接！',
      pinyin: 'nǐ hǎo, zhànyǒu! Neo-Shanghai zhàn chǎng pín dào yǐ lián jiē!',
      english: 'Hello squadmate! Neo-Shanghai battlefield comms channel online! Zero API cost.',
      isBot: true,
    },
  ]);
  const [toneIndex, setToneIndex] = useState(0);
  const [toneFeedback, setToneFeedback] = useState<{ isCorrect: boolean; text: string } | null>(null);
  const commsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    commsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commsFeed]);

  const handleSendCallout = (callout: TacticalCallout) => {
    // Play native speech
    speakChinese(callout.hanzi);
    sounds.playShoot();

    // Add user callout to feed
    setCommsFeed((prev) => [
      ...prev,
      {
        sender: 'You (你)',
        hanzi: callout.hanzi,
        pinyin: callout.pinyin,
        english: callout.english,
        isBot: false,
      },
    ]);

    // Squadmate responds automatically
    setTimeout(() => {
      setCommsFeed((prev) => [
        ...prev,
        {
          sender: 'Squadmate Neo (战友尼奥)',
          hanzi: callout.botReplyHanzi,
          pinyin: callout.botReplyPinyin,
          english: callout.botReplyEnglish,
          isBot: true,
        },
      ]);
      speakChinese(callout.botReplyHanzi);
      sounds.playSuccess();
      onEarnCoins(5);
    }, 600);
  };

  const handleAnswerTone = (tone: 1 | 2 | 3 | 4) => {
    const currentQuiz = TONE_QUIZZES[toneIndex];
    if (tone === currentQuiz.correctTone) {
      setToneFeedback({
        isCorrect: true,
        text: `太棒了！(Correct!) ${currentQuiz.hanzi} is Tone ${currentQuiz.correctTone} (${currentQuiz.fullPinyin} - ${currentQuiz.english})! +10 V-Coins!`,
      });
      sounds.playVictory();
      onEarnCoins(10);
      speakChinese(currentQuiz.hanzi);
      setTimeout(() => {
        setToneFeedback(null);
        setToneIndex((prev) => (prev + 1) % TONE_QUIZZES.length);
      }, 1600);
    } else {
      setToneFeedback({
        isCorrect: false,
        text: `再试一次！(Try again!) ${currentQuiz.hanzi} is Tone ${currentQuiz.correctTone} (${currentQuiz.fullPinyin}). Listen to the pitch!`,
      });
      sounds.playError();
      speakChinese(currentQuiz.hanzi);
    }
  };

  const currentQuiz = TONE_QUIZZES[toneIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio size={20} className="text-cyan-400 animate-pulse" />
            <h2 className="text-xl md:text-2xl font-extrabold text-white uppercase tracking-wider font-['Barlow_Condensed']">
              Tactical Squad Comms & Training Station
            </h2>
          </div>
          <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            <span>100% Free Client-Side Audio & Callouts · Zero API Usage</span>
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('radio')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'radio'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Radio size={14} />
            <span>Squad Battle Radio</span>
          </button>
          <button
            onClick={() => setActiveTab('radicals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'radicals'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BookOpen size={14} />
            <span>Sifu Character Lore</span>
          </button>
          <button
            onClick={() => setActiveTab('tones')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'tones'
                ? 'bg-emerald-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Target size={14} />
            <span>Speed Tone Radar</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Squad Battle Radio */}
      {activeTab === 'radio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tactical Callout Buttons (Left 7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Crosshair size={16} className="text-cyan-400" />
                <span>Battlefield Tactical Callouts (战术语音)</span>
              </h3>
              <span className="text-[11px] text-slate-400">Tap to broadcast to squadmates (+5 V-Coins)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TACTICAL_CALLOUTS.map((callout) => (
                <div
                  key={callout.id}
                  className="p-3 bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-xl transition-all flex flex-col justify-between gap-2 group hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                        {callout.hanzi}
                      </span>
                      <button
                        onClick={() => speakChinese(callout.hanzi)}
                        className="p-1 rounded bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-colors"
                        title="Listen to native pronunciation"
                      >
                        <Volume2 size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-cyan-400/90 font-mono mt-0.5">{callout.pinyin}</div>
                    <div className="text-xs text-slate-400 mt-1">{callout.english}</div>
                  </div>

                  <button
                    onClick={() => handleSendCallout(callout)}
                    className="w-full py-1.5 px-3 bg-slate-950 hover:bg-cyan-500 text-slate-300 hover:text-slate-950 rounded-lg text-xs font-bold border border-slate-800 hover:border-cyan-400 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <Send size={12} />
                    <span>Transmit Comms</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Live Squad Comms Log (Right 5 Cols) */}
          <div className="lg:col-span-5 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden h-[540px]">
            <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Live Battle Comms Stream
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                100% Free Local Comms
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
              {commsFeed.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl max-w-[92%] transition-all ${
                    item.isBot
                      ? 'bg-slate-900 border border-cyan-500/30 text-slate-200 self-start shadow-sm'
                      : 'bg-cyan-950/40 border border-cyan-500/50 text-cyan-100 ml-auto'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1 font-bold">
                    <span className={item.isBot ? 'text-cyan-400' : 'text-amber-300'}>{item.sender}</span>
                    <button
                      onClick={() => speakChinese(item.hanzi)}
                      className="p-1 rounded text-slate-400 hover:text-cyan-300 transition-colors"
                    >
                      <Volume2 size={13} />
                    </button>
                  </div>
                  <div className="text-sm font-bold text-white mb-0.5">{item.hanzi}</div>
                  <div className="text-[11px] text-cyan-300/80 font-mono mb-1">{item.pinyin}</div>
                  <div className="text-[11px] text-slate-400 italic">{item.english}</div>
                </div>
              ))}
              <div ref={commsEndRef} />
            </div>

            <div className="p-3 bg-slate-900/60 border-t border-slate-800 text-center">
              <span className="text-[11px] text-slate-400">
                Tap any callout on the left to transmit orders to your squad!
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sifu Radical & Character Lore */}
      {activeTab === 'radicals' && (
        <div className="space-y-4">
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 flex items-start gap-3">
            <BookOpen size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-300">Tactical Sifu Secret: How Chinese Characters Work</h4>
              <p className="mt-1 leading-relaxed text-amber-200/90">
                Most Chinese characters have a <strong>Radical (部首)</strong> that hints at the category (wood, weapon, water, bow), plus a phonetic or secondary component. Master these battle characters to read weapon loot crates in an instant!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {RADICAL_LESSONS.map((lesson) => (
              <div
                key={lesson.hanzi}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-extrabold text-amber-400">{lesson.hanzi}</span>
                      <div>
                        <div className="text-xs font-mono text-cyan-400">{lesson.pinyin}</div>
                        <div className="text-xs font-bold text-white">{lesson.meaning}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => speakChinese(lesson.hanzi)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 transition-colors"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Radical: </span>
                      <strong className="text-amber-300 font-bold">{lesson.radical}</strong>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px] bg-slate-950 p-2 rounded-lg border border-slate-800">
                      {lesson.radicalMeaning}
                    </p>
                    <div className="text-[11px] text-cyan-300 font-mono">
                      {lesson.breakdown}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span className="text-slate-500 font-semibold">Battle Arena Usage: </span>
                  <span className="text-white font-medium">{lesson.gamingUsage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Speed Tone Radar */}
      {activeTab === 'tones' && (
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 text-center">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-2">
              <Award size={14} />
              <span>Speed Tone Radar Training</span>
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider font-['Barlow_Condensed']">
              Identify the Correct Tone Pitch
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Listen to the Mandarin character and identify its tone: 1 (Flat), 2 (Rising), 3 (Dip-Rise), or 4 (Falling)!
            </p>
          </div>

          {/* Big Flashcard */}
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-4 shadow-inner">
            <span className="text-6xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              {currentQuiz.hanzi}
            </span>
            <div className="text-base text-slate-300 font-mono">
              Base Sound: <strong className="text-white">{currentQuiz.pinyinWithoutTone}</strong> · Meaning: {currentQuiz.english}
            </div>
            <button
              onClick={() => speakChinese(currentQuiz.hanzi)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 border border-slate-700 hover:border-cyan-400 flex items-center gap-2 text-xs font-bold transition-all"
            >
              <Volume2 size={16} />
              <span>Listen to Pronunciation</span>
            </button>
          </div>

          {/* 4 Tone Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { tone: 1 as const, label: 'Tone 1: High Flat (—)', pitch: 'High & Level (e.g. mā)' },
              { tone: 2 as const, label: 'Tone 2: Rising (／)', pitch: 'Question rising (e.g. má)' },
              { tone: 3 as const, label: 'Tone 3: Dip & Rise (∨)', pitch: 'Deep dip then up (e.g. mǎ)' },
              { tone: 4 as const, label: 'Tone 4: Sharp Falling (＼)', pitch: 'Firm drop down (e.g. mà)' },
            ].map((btn) => (
              <button
                key={btn.tone}
                onClick={() => handleAnswerTone(btn.tone)}
                className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-400 text-slate-200 rounded-xl transition-all flex flex-col items-center text-center gap-1 active:scale-95 group"
              >
                <span className="text-base font-extrabold text-emerald-400 group-hover:scale-110 transition-transform">
                  Tone {btn.tone}
                </span>
                <span className="text-[11px] font-semibold text-white">{btn.label.split(':')[1]}</span>
                <span className="text-[10px] text-slate-500">{btn.pitch}</span>
              </button>
            ))}
          </div>

          {/* Feedback banner */}
          {toneFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold animate-in fade-in ${
                toneFeedback.isCorrect
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              {toneFeedback.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
