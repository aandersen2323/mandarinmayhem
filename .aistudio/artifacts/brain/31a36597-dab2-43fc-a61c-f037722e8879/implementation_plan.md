# CyberMandarin Royale: Battle Island Mandarin Adventure

A high-energy, Fortnite- and Gimkit-inspired Mandarin learning game designed for a 10-year-old 4th grader, blending fast-paced arena battles, power-up shops, branching sci-fi story quests, an unlockable Cyber/Mecha skin locker, 1K/2K/4K AI skin generation, and an interactive Gemini tactical squad coach.

### User Review & Critical Decisions

> [!IMPORTANT]
> The game design unites all three core modes requested (Gimkit rapid action arena, Fortnite battle island survival, and arcade boss battling) with audio pronunciation, character matching, branching narrative quests, and custom skin generation.

- **Confirmed Decision 1 (Core Gameplay)**: Hybrid Battle Royale + Gimkit Arena loop featuring lightning recall rounds, a live power-up shop (Shield Potions, Multiplier Streaks, Slurp Health, Radar Hack), and boss showdowns where correct Mandarin answers launch shield barriers and laser strikes.
- **Confirmed Decision 2 (Mandarin Learning & Audio)**: Dual-support learning with Hanzi (characters), toggleable Pinyin pronunciation guides, English hints, native Chinese audio pronunciation playback (Web Speech API / browser TTS), and optional voice speaking practice checks so he can practice reading, listening, and speaking without penalty if a microphone isn't available.
- **Confirmed Decision 3 (Visual Theme & Skins)**: Neon Cyberpunk & Battle Royale aesthetic featuring Mecha warriors, Stealth Ninjas, Cyber Samurais, and high-tech pickaxes and gliders.
- **Confirmed Decision 4 (AI Skin Studio & Gemini Coach)**: Embedded AI Skin Crafter powered by `gemini-3-pro-image-preview` with 1K, 2K, and 4K resolution options, plus a multi-turn Tactical Squad Coach chatbot with model routing (`gemini-4-argon` for advanced grammar/story, `gemini-3.8-flash` for squad chat, `gemini-3.1-flash-lite` for rapid flash-hints).

---

### 1. Overview & Core Concept

- **What It Does**: CyberMandarin Royale turns Mandarin practice into a high-stakes gaming experience. Players drop into Neo-Shanghai Battle Island, complete rapid-fire Mandarin challenges (matching characters to Pinyin, quick translations, tone detection, and sentence assembly), survive the closing storm circle, purchase Gimkit-style in-game power-ups, explore branching narrative story missions, and unlock legendary Cyberpunk/Ninja skins and accessories.
- **Target Audience / Persona**: A 10-year-old 4th grader with 5 years of Mandarin immersion experience who loves Fortnite, Gimkit, and competitive gaming. The language curriculum matches 4th grade immersion benchmarks (daily life, action verbs, gaming/combat terms, travel, food, and common idioms) while keeping tone guides and pronunciation always accessible.
- **Key Value**: Prevents language decay after school immersion programs end by replacing boring flashcards with the thrilling progression mechanics, skin collection, and adrenaline of his favorite games.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Lobby & Battle Pass Hub**:
   - Displays player's active 3D/stylized avatar, current Battle Star level, V-Coins, XP streak, and equipped gear (Skin, Pickaxe, Back Bling).
   - Mode Selector:
     - **Mode A: Gimkit Battle Arena** (Survival waves, storm timer, quick-fire answers, power-up shop).
     - **Mode B: Cyber Quest Story Adventure** (Branching RPG narrative in Neo-Shanghai where choices and dialogue comprehension unlock secret loot vaults and new areas).
     - **Mode C: Training Dojo & Mini-Games** (Character-to-Pinyin speed match, sound recall, sentence runner).
     - **Mode D: Skin Locker & AI Skin Forge** (Equip unlocked gear or craft custom 1K/2K/4K Mecha/Ninja skins using `gemini-3-pro-image-preview`).
     - **Mode E: Tactical Squad Coach** (Multi-turn Gemini chat with audio playback and role switching).
2. **Gimkit Battle Arena Loop**:
   - Player enters the arena with 100 HP and 0 Shield.
   - Storm countdown begins (shrinking boundary).
   - Rapid Mandarin questions appear: Hanzi character, optional Pinyin, audio playback button, and 4 interactive choices (or voice-input toggle).
   - Streak multipliers multiply earned V-Coins.
   - Live Power-Up Shop drawer can be opened mid-round to buy:
     - *Mini Shield Potion (+25 Shield)*
     - *Slurp Juice (Gradual HP regen)*
     - *Damage 2x Multiplier (Double attack on rival bots)*
     - *Time Freeze (Stops storm for 15s)*
     - *Radar Scan (Eliminates 2 wrong answers)*
   - Boss / Rival Bot showdown at wave end: hitting correct answers executes animated laser/blade attacks on the rival!
3. **Interactive Story Adventure (Neo-Shanghai Chronicles)**:
   - Branching episodic storyline where the player investigates a mystery in the Cyber District.
   - Encounters friendly squadmates and cyber guards who speak in Mandarin dialogue.
   - Player choices (comprehension prompts, dialogue responses, and direction deciphering) branch the story, unlock secret gear, and award rare Battle Pass badges.
4. **Custom Skin Crafter (Gemini Image Generation)**:
   - Player selects skin archetype (Neon Ninja, Mecha Vanguard, Cyber Dragon, Stealth Assassin), customized prompt input, and target resolution (**1K**, **2K**, or **4K**).
   - Calls backend `/api/gemini/generate-skin` using `gemini-3-pro-image-preview`.
   - Generates high-res skin portrait and immediately adds it to their equipped wardrobe!
5. **Tactical Squad Coach (Gemini Chat)**:
   - Dedicated communications thread with a cybernetic squad mate (e.g., "Unit 88 - Tactical Sifu").
   - Multi-turn conversation history with scrollable thread.
   - Role switcher presets:
     - *Tactical Sifu (Story & Deep Grammar)* -> routed to `gemini-4-argon`
     - *Squadmate Neo (Casual banter & practice)* -> routed to `gemini-3.8-flash`
     - *Lightning Drone (Quick vocabulary hint & instant feedback)* -> routed to `gemini-3.1-flash-lite`

#### Visual Identity & Theme
- **Aesthetic Direction**: Sleek, high-voltage futuristic battle royale with dark obsidian slate (`#0B0F19`), electric cyan accents (`#06B6D4`), neon lime victory highlights (`#10B981`), and plasma purple gradients (`#8B5CF6`).
- **Typography**: Athletic, high-impact condensed display font (`Outfit` and `Barlow Condensed`) paired with ultra-clean readable body sans (`Plus Jakarta Sans`) and tabular numerals (`font-mono tabular-nums`) for scores, health, and coin tickers.
- **Top Bar Contract**:
  - Zone 1 (Wordmark): `CYBERMANDARIN ROYALE`
  - Zone 2 (Navigation): `Arena · Story · Dojo · Locker · AI Forge · Squad Coach`
  - Zone 3 (Action): Equipped Avatar mini-badge + V-Coin & Level Pill-free counter.
- **Audio & Haptics**: Web Audio synthesized retro sound effects (level-up fanfares, laser hits, power-up slurp sfx, buzzer on errors) + Native SpeechSynthesis Chinese pronunciation.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual Audio & Microphone Architecture**:
  - *Chosen Approach*: Implement Web Speech API for both Chinese voice synthesis (`SpeechSynthesisUtterance` with `zh-CN` voice fallback) and Speech Recognition (`webkitSpeechRecognition`) as an optional bonus mode.
  - *Why*: The user noted that speaking is great but might be hard with microphones or pronunciation; by providing both one-click audio playback and multi-choice fallback alongside voice check, the 10-year-old never gets stuck or frustrated.
- **Decision 2: Gimkit Energy & Multiplier Economy**:
  - *Chosen Approach*: Correct answers award both XP and in-game V-Coins that can be spent either during the round for active power-ups (shields, freezes) or in the permanent locker for skins and accessories.
  - *Why*: Directly replicates the dopamine loop of Gimkit and Fortnite that 10-year-olds find addictive.
- **Decision 3: Server-Side Gemini API Proxy with Model Routing**:
  - *Chosen Approach*: Express server backend with endpoints `/api/gemini/generate-skin` (using `gemini-3-pro-image-preview` with 1K/2K/4K config) and `/api/gemini/chat` (dynamically routing to `gemini-4-argon`, `gemini-3.8-flash`, or `gemini-3.1-flash-lite` based on user-selected coach mode).
  - *Why*: Conforms strictly to Google GenAI server-side security guidelines, protects user keys, and meets all prompt specifications.
- **Decision 4: Local Storage Persistence**:
  - *Chosen Approach*: Persist Battle Pass XP, inventory, unlocked skins, equipped gear, and story quest progress in `localStorage` with export/reset options.
  - *Why*: Instant, zero-latency startup with no complicated database login hurdles for a 10-year-old.

---

### 4. Technical Architecture & Data Strategy (Technical Reference)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CYBERMANDARIN ROYALE                          │
└────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│  GAME ENGINE & MODES   │  │   PROGRESSION & SHOP   │  │    AI FORGE & CHAT     │
│ ├─ Gimkit Battle Arena │  │ ├─ Battle Pass (Lvl 1-50)│  │ ├─ AI Skin Generator  │
│ ├─ Neo-Shanghai Story  │  │ ├─ V-Coins & Streaks   │  │ │  (gemini-3-pro-image │
│ ├─ Speed Dojo Minigames│  │ ├─ Power-Up Inventory  │  │ │   1K / 2K / 4K)      │
│ └─ Audio & Voice Input │  │ └─ Skin/Pickaxe Locker │  │ └─ Tactical Squad Coach│
│    (zh-CN TTS & Mic)   │  │                        │  │    (Argon/Flash/Lite)  │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │    SERVER-SIDE PROXY        │
                         │    (Node.js / Express)      │
                         │ ├─ POST /api/gemini/chat    │
                         │ └─ POST /api/gemini/skin    │
                         │    (@google/genai SDK)      │
                         └─────────────────────────────┘
```

#### Core Data Entities
- `PlayerProfile`: `{ level: number, xp: number, coins: number, streak: number, equippedSkinId: string, unlockedSkinIds: string[], completedStoryNodes: string[] }`
- `MandarinQuestion`: `{ id: string, hanzi: string, pinyin: string, english: string, options: string[], correctIndex: number, category: string, difficulty: 1|2|3 }`
- `PowerUpItem`: `{ id: string, name: string, cost: number, icon: string, effect: 'shield' | 'heal' | 'freeze' | 'multiplier' | 'reveal' }`
- `StoryNode`: `{ id: string, chapter: string, title: string, dialogueHanzi: string, dialoguePinyin: string, dialogueEnglish: string, choices: { textHanzi: string, textEnglish: string, nextNodeId: string, rewardXp: number }[] }`
- `SkinItem`: `{ id: string, name: string, rarity: 'rare'|'epic'|'legendary', theme: string, imageSrc: string, unlockLevel: number, price: number, isCustom: boolean }`

#### Step-by-Step Implementation Flow
1. **Server Setup (`server.ts`)**:
   - Initialize `@google/genai` with `process.env.GEMINI_API_KEY` and `User-Agent: 'aistudio-build'`.
   - Setup Express proxy routes for image generation (`gemini-3-pro-image-preview` with 1K, 2K, 4K resolution) and chat with model selection (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.1-flash-lite`).
2. **Audio & Sound Engine (`src/utils/audio.ts`)**:
   - Browser Web Audio API synthesizer for retro combat/game sounds (lasers, shields, level up, fail buzzer).
   - Native Chinese Text-to-Speech playback helper (`zh-CN`).
   - Web Speech API microphone speech recognition for voice practice.
3. **Curriculum & Question Bank (`src/data/mandarinData.ts`)**:
   - Comprehensive bank of 100+ 4th-grade immersion vocabulary words, verbs, food, school, action, and dialogue prompts with Hanzi, Pinyin, English, and audio tags.
4. **Game Modes**:
   - **Gimkit Arena (`src/components/ArenaView.tsx`)**: Wave survival, storm timer, answer grid, real-time power-up shop drawer, boss damage bar.
   - **Story Adventure (`src/components/StoryView.tsx`)**: Branching cyberpunk comic/interactive story with dialogue audio and choices.
   - **Training Dojo (`src/components/DojoView.tsx`)**: Rapid character matching, tone identification, and word recall.
5. **Skin Locker & AI Forge (`src/components/LockerView.tsx` & `SkinForgeModal.tsx`)**:
   - Display pre-made legendary skins (Neon Mecha, Cyber Ninja, Dragon Knight) + Custom Skin Generator with 1K/2K/4K resolution affordance.
6. **Gemini Squad Coach (`src/components/SquadCoachView.tsx`)**:
   - Multi-turn scrollable chat interface with persona switcher (Sifu, Squadmate, Lightning Tutor).
