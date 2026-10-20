import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const port = process.env.PORT || 3000;

// Initialize GoogleGenAI SDK server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// System role instructions tailored for 10-year-old 4th grader Mandarin gamer
const ROLE_SYSTEM_INSTRUCTIONS: Record<string, { roleName: string; model: string; instruction: string }> = {
  sifu: {
    roleName: 'Tactical Sifu (Master Tactician)',
    model: 'gemini-4-argon',
    instruction: `You are Tactical Sifu, a wise, legendary sci-fi mecha commander and master Mandarin tutor for a 10-year-old 4th grade gamer who has been in Mandarin immersion since kindergarten.
Your mission is to help him master complex Mandarin grammar, Chinese character radicals, idioms (成语), and tactical story challenges in CyberMandarin Royale.
Format your responses with:
1. Enthusiastic, respectful master tone (gamified with XP, level-ups, mecha lore).
2. Always write Chinese characters (Hanzi), followed by Pinyin with tone marks in parentheses, and the English meaning.
3. Break down interesting character origins or radicals simply so a 4th grader gets excited.
4. Keep answers concise, inspiring, and engaging. Never be dry or academic.`,
  },
  squadmate: {
    roleName: 'Squadmate Neo (Tactical Wingman)',
    model: 'gemini-3.8-flash',
    instruction: `You are Squadmate Neo, a cool, friendly cyberpunk battle-royale squad teammate in CyberMandarin Royale.
You chat with the player (a 10-year-old 4th grade immersion student) like a fun gaming buddy in Fortnite/Gimkit.
You love using gaming terms (GG, loot crate, storm circle, power-up, Victory Royale).
You practice conversational Mandarin: daily life, food, gaming, hobbies, and sports.
Always include Hanzi, Pinyin with tone marks, and English translation.
Keep the dialogue conversational, friendly, funny, and supportive!`,
  },
  lightning: {
    roleName: 'Lightning Drone (Rapid Tutor)',
    model: 'gemini-3.1-flash-lite',
    instruction: `You are Lightning Drone, a hyper-fast tactical combat drone in CyberMandarin Royale.
Your job is to provide ultra-fast vocabulary hints, pronunciation checks, and rapid translations in 1 to 2 punchy sentences.
Always format with: Hanzi | Pinyin | English.
Keep it extremely snappy, energetic, and immediate so the player can get back into battle quickly!`,
  },
};

// API: Multi-turn Chatbot with Model Routing
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { messages, rolePreset = 'squadmate' } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const config = ROLE_SYSTEM_INSTRUCTIONS[rolePreset] || ROLE_SYSTEM_INSTRUCTIONS.squadmate;
    const modelToUse = config.model;

    // Convert messages to GenAI contents format
    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    // If API key is not configured, supply helpful fallback response
    if (!process.env.GEMINI_API_KEY) {
      const lastMsg = messages[messages.length - 1]?.text || 'Hello';
      return res.json({
        reply: `[${config.roleName} Offline Link] 太棒了！(Tài bàng le! - Awesome!) I hear you: "${lastMsg}". Please ensure GEMINI_API_KEY is configured in your settings for live AI tactical analysis!`,
        modelUsed: `${modelToUse} (Simulated)`,
      });
    }

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents,
      config: {
        systemInstruction: config.instruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || '没有收到回复 (No response received). Let us try again!';

    return res.json({
      reply: replyText,
      modelUsed: modelToUse,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in /api/gemini/chat:', err);

    // Fallback response so the user UI doesn't crash
    return res.status(200).json({
      reply: `[Tactical Comm Relay]: 太酷了！(Tài kù le! - Super cool!) I received your transmission. (Note: ${err.message || 'Transmission interrupted'}). 加油！(Jiāyóu! - Keep it up!)`,
      modelUsed: 'Fallback Comm Relay',
      error: err.message,
    });
  }
});

// API: Generate Custom Skins with gemini-3-pro-image-preview and 1K, 2K, 4K sizing
app.post('/api/gemini/generate-skin', async (req, res) => {
  try {
    const { prompt, imageSize = '1K', archetype = 'cyber_ninja' } = req.body;

    const validSizes = ['1K', '2K', '4K'];
    const chosenSize = validSizes.includes(imageSize) ? imageSize : '1K';
    const fullPrompt = `Epic stylized Fortnite and Gimkit battle royale hero skin concept art portrait: ${prompt || 'futuristic neon armored champion'}. Character archetype: ${archetype}. Glowing neon highlights, futuristic visor, sci-fi cyber armor, esports avatar style, ultra-crisp game character art, clean dark backdrop, digital illustration.`;

    // If API key is present, attempt gemini-3-pro-image-preview
    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: {
            parts: [{ text: fullPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: '1:1',
              imageSize: chosenSize,
            },
          },
        });

        let imageUrl: string | null = null;
        let descriptionText = '';

        const candidates = response.candidates || [];
        for (const candidate of candidates) {
          for (const part of candidate.content?.parts || []) {
            if (part.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || 'image/png';
              imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
              break;
            } else if (part.text) {
              descriptionText += part.text;
            }
          }
          if (imageUrl) break;
        }

        if (imageUrl) {
          return res.json({
            imageUrl,
            prompt: fullPrompt,
            size: chosenSize,
            description: descriptionText || 'High-res AI-generated battle royale skin.',
          });
        }
      } catch (genError: unknown) {
        console.warn('Gemini 3 Pro Image generation failed/quota exhausted, engaging Cyber Matrix Studio fallback:', (genError as Error).message);
      }
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.warn('Gemini image generation warning, falling back to Cyber Matrix Generator:', err.message);

    // High-resolution procedural vector skin avatar as resilient fallback
    const { archetype = 'cyber_ninja', imageSize = '1K', prompt = 'Neon Hero' } = req.body;
    const colors: Record<string, { main: string; glow: string; crest: string; name: string }> = {
      cyber_ninja: { main: '#06B6D4', glow: '#22D3EE', crest: '忍', name: 'Neon Shadow Ninja' },
      mecha_titan: { main: '#3B82F6', glow: '#60A5FA', crest: '甲', name: 'Titan Mecha' },
      dragon_knight: { main: '#10B981', glow: '#34D399', crest: '龙', name: 'Dragon Striker' },
      stealth_ronin: { main: '#8B5CF6', glow: '#A855F7', crest: '浪', name: 'Storm Ronin' },
    };
    const c = colors[archetype] || colors.cyber_ninja;
    const resPx = imageSize === '4K' ? 4096 : imageSize === '2K' ? 2048 : 1024;

    const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${resPx} ${resPx}" width="${resPx}" height="${resPx}">
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0F172A" />
          <stop offset="60%" stop-color="#020617" />
          <stop offset="100%" stop-color="#000000" />
        </radialGradient>
        <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c.main}" />
          <stop offset="100%" stop-color="${c.glow}" />
        </linearGradient>
        <filter id="bloom">
          <feGaussianBlur stdDeviation="${resPx * 0.015}" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGlow)"/>
      <circle cx="${resPx * 0.5}" cy="${resPx * 0.5}" r="${resPx * 0.42}" fill="none" stroke="${c.main}" stroke-width="${resPx * 0.004}" opacity="0.4" stroke-dasharray="16 8"/>
      <path d="M${resPx * 0.25} ${resPx * 0.85} L${resPx * 0.35} ${resPx * 0.55} L${resPx * 0.65} ${resPx * 0.55} L${resPx * 0.75} ${resPx * 0.85} Z" fill="#1E293B" stroke="${c.main}" stroke-width="${resPx * 0.008}"/>
      <polygon points="${resPx * 0.25},${resPx * 0.85} ${resPx * 0.5},${resPx * 0.72} ${resPx * 0.75},${resPx * 0.85} ${resPx * 0.5},${resPx * 0.95}" fill="#0F172A" stroke="${c.glow}" stroke-width="${resPx * 0.006}"/>
      <circle cx="${resPx * 0.5}" cy="${resPx * 0.78}" r="${resPx * 0.06}" fill="${c.main}" opacity="0.8" filter="url(#bloom)"/>
      <text x="${resPx * 0.5}" y="${resPx * 0.805}" font-family="sans-serif" font-weight="900" font-size="${resPx * 0.07}" fill="#FFFFFF" text-anchor="middle">${c.crest}</text>
      <path d="M${resPx * 0.34} ${resPx * 0.58} Q${resPx * 0.3} ${resPx * 0.25} ${resPx * 0.5} ${resPx * 0.18} Q${resPx * 0.7} ${resPx * 0.25} ${resPx * 0.66} ${resPx * 0.58} Z" fill="#090D16" stroke="${c.main}" stroke-width="${resPx * 0.01}"/>
      <rect x="${resPx * 0.36}" y="${resPx * 0.36}" width="${resPx * 0.28}" height="${resPx * 0.08}" rx="${resPx * 0.03}" fill="url(#neonGlow)" filter="url(#bloom)"/>
      <line x1="${resPx * 0.38}" y1="${resPx * 0.4}" x2="${resPx * 0.62}" y2="${resPx * 0.4}" stroke="#FFFFFF" stroke-width="${resPx * 0.015}" stroke-linecap="round"/>
      <polygon points="${resPx * 0.42},${resPx * 0.48} ${resPx * 0.58},${resPx * 0.48} ${resPx * 0.5},${resPx * 0.58}" fill="#1E293B" stroke="${c.main}" stroke-width="${resPx * 0.004}"/>
      <text x="${resPx * 0.5}" y="${resPx * 0.92}" font-family="sans-serif" font-weight="bold" font-size="${resPx * 0.032}" fill="${c.glow}" text-anchor="middle" letter-spacing="4">ULTRA ${imageSize} CYBER MATRIX</text>
    </svg>`;

    const base64Svg = Buffer.from(fallbackSvg).toString('base64');
    const fallbackUrl = `data:image/svg+xml;base64,${base64Svg}`;

    return res.json({
      imageUrl: fallbackUrl,
      prompt,
      size: imageSize,
      description: `Synthesized via Cyber Matrix Studio (Ultra ${imageSize} Resolution). High-tech armor calibrated!`,
      isFallback: true,
    });
  }
});

// Setup Vite middlewares in development or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`CyberMandarin Royale server listening on port ${port}`);
  });
}

startServer();
