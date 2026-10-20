export type GameView = 'arena' | 'story' | 'dojo' | 'locker' | 'forge' | 'coach';

export type QuestionCategory = 'combat' | 'school' | 'actions' | 'elements' | 'food' | 'phrases';

export interface MandarinQuestion {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  category: QuestionCategory;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface PlayerProfile {
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  vCoins: number;
  equippedSkinId: string;
  unlockedSkinIds: string[];
  highestStreak: number;
  arenaVictories: number;
  completedStoryNodes: string[];
  soundEnabled: boolean;
  pinyinDefaultVisible: boolean;
}

export type SkinRarity = 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface SkinItem {
  id: string;
  name: string;
  hanziName: string;
  pinyinName: string;
  description: string;
  rarity: SkinRarity;
  theme: string;
  imageSrc?: string;
  svgType: 'ninja' | 'mecha' | 'dragon' | 'ronin' | 'phoenix' | 'cybercat';
  accentColor: string;
  unlockLevel: number;
  price: number;
  isCustom?: boolean;
}

export interface PowerUpItem {
  id: string;
  name: string;
  hanziName: string;
  pinyin: string;
  description: string;
  cost: number;
  icon: string;
  type: 'shield' | 'heal' | 'multiplier' | 'freeze' | 'radar';
  duration?: number;
}

export interface StoryChoice {
  textHanzi: string;
  textPinyin: string;
  textEnglish: string;
  nextNodeId: string;
  rewardXp?: number;
  rewardCoins?: number;
  requiredItem?: string;
  isCorrectComprehension: boolean;
  feedbackText: string;
}

export interface StoryNode {
  id: string;
  chapter: string;
  title: string;
  speaker: string;
  speakerRole: string;
  dialogueHanzi: string;
  dialoguePinyin: string;
  dialogueEnglish: string;
  sceneDescription: string;
  choices: StoryChoice[];
  isEnding?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

export type CoachRole = 'sifu' | 'squadmate' | 'lightning';
