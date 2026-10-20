export type GameView = 'arena' | 'multiplayer' | 'leaderboard' | 'story' | 'dojo' | 'locker' | 'forge' | 'coach';

export type QuestionCategory = 'combat' | 'school' | 'actions' | 'elements' | 'food' | 'phrases' | 'math';

export type MandarinTier = 1 | 2 | 3 | 4 | 5;

export interface MandarinMastery {
  tier: MandarinTier;
  tierName: string;
  questionsAnswered: number;
  correctAnswers: number;
  consecutiveCorrect: number;
  recentMistakes: string[];
  masteryPoints: number;
}

export interface MandarinQuestion {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  category: QuestionCategory;
  difficulty?: MandarinTier;
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
  mandarinMastery?: MandarinMastery;
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

export interface PlayerAccount {
  id: string;
  name: string;
  avatarId: string;
  pin?: string;
  lastPlayed: number;
  profile: PlayerProfile;
}

export interface RemotePlayer {
  id: string;
  name: string;
  level: number;
  skinId: string;
  accentColor: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  shield: number;
  kills: number;
  isShooting: boolean;
  activeWeaponName?: string;
  lastActive: number;
}

export interface MultiplayerChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  hanzi?: string;
  pinyin?: string;
  timestamp: string;
  isTacticalCallout?: boolean;
}

export interface MultiplayerRoom {
  id: string;
  name: string;
  hostId: string;
  gameMode: 'pvp_battle_royale' | 'mandarin_duel' | 'coop_survival';
  maxPlayers: number;
  players: Record<string, RemotePlayer>;
  messages: MultiplayerChatMessage[];
  status: 'lobby' | 'playing' | 'ended';
  stormRadius: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  level: number;
  wins: number;
  eliminations: number;
  mandarinScore: number;
  accuracy: number;
  skinId: string;
  accentColor: string;
  rank?: number;
}
