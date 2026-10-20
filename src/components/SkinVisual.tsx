import React from 'react';
import { SkinItem } from '../types/game';

interface SkinVisualProps {
  skin?: SkinItem;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  className?: string;
}

export const SkinVisual: React.FC<SkinVisualProps> = ({
  skin,
  size = 'md',
  showBadge = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  const rarityBorders = {
    uncommon: 'border-slate-600 shadow-slate-900/40',
    rare: 'border-cyan-500 shadow-cyan-500/20',
    epic: 'border-purple-500 shadow-purple-500/25',
    legendary: 'border-amber-400 shadow-amber-400/30',
  };

  const rarityGradients = {
    uncommon: 'from-slate-800 to-slate-950',
    rare: 'from-cyan-950/80 to-slate-950',
    epic: 'from-purple-950/80 to-slate-950',
    legendary: 'from-amber-950/70 to-slate-950',
  };

  const rarity = skin?.rarity || 'rare';
  const type = skin?.svgType || 'ninja';

  // If custom AI image is available
  if (skin?.imageSrc) {
    return (
      <div
        className={`relative ${sizeClasses[size]} rounded-2xl border-2 overflow-hidden shadow-lg ${rarityBorders[rarity]} ${className}`}
      >
        <img
          src={skin.imageSrc}
          alt={skin.name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {showBadge && (
          <span className="absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/80 text-cyan-300 uppercase tracking-wider">
            AI 4K
          </span>
        )}
      </div>
    );
  }

  // High-fidelity vector illustrations
  return (
    <div
      className={`relative ${sizeClasses[size]} rounded-2xl border-2 overflow-hidden shadow-lg bg-gradient-to-br ${rarityGradients[rarity]} ${rarityBorders[rarity]} flex items-center justify-center ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-4/5 h-4/5 transition-transform duration-300 hover:scale-105"
      >
        {type === 'ninja' && (
          <g>
            {/* Ninja Hood */}
            <path
              d="M20 75 Q15 35 50 15 Q85 35 80 75 Z"
              fill="#0F172A"
              stroke="#06B6D4"
              strokeWidth="2.5"
            />
            {/* Cyber Visor Slit */}
            <rect
              x="28"
              y="42"
              width="44"
              height="10"
              rx="4"
              fill="#06B6D4"
              className="drop-shadow-[0_0_8px_#06b6d4]"
            />
            <rect x="36" y="45" width="28" height="4" rx="2" fill="#FFFFFF" opacity="0.9" />
            {/* Mouth Guard */}
            <polygon points="35,62 50,78 65,62" fill="#1E293B" stroke="#06B6D4" strokeWidth="1.5" />
            {/* Shuriken Crest */}
            <circle cx="50" cy="28" r="4" fill="#06B6D4" />
          </g>
        )}

        {type === 'mecha' && (
          <g>
            {/* Mecha Angular Helmet */}
            <polygon
              points="20,70 18,35 50,15 82,35 80,70 50,85"
              fill="#1E293B"
              stroke="#3B82F6"
              strokeWidth="3"
            />
            {/* Dual Visor Optics */}
            <polygon points="28,45 46,45 42,55 32,55" fill="#60A5FA" />
            <polygon points="54,45 72,45 68,55 58,55" fill="#60A5FA" />
            {/* Plasma Glow Core */}
            <circle
              cx="50"
              cy="68"
              r="7"
              fill="#3B82F6"
              className="drop-shadow-[0_0_10px_#3b82f6]"
            />
            <circle cx="50" cy="68" r="3" fill="#FFFFFF" />
            {/* Side Ear Antennas */}
            <line x1="18" y1="35" x2="10" y2="22" stroke="#60A5FA" strokeWidth="2.5" />
            <line x1="82" y1="35" x2="90" y2="22" stroke="#60A5FA" strokeWidth="2.5" />
          </g>
        )}

        {type === 'dragon' && (
          <g>
            {/* Dragon Crest Horns */}
            <path d="M25 40 Q10 20 20 5 Q32 25 35 38 Z" fill="#10B981" />
            <path d="M75 40 Q90 20 80 5 Q68 25 65 38 Z" fill="#10B981" />
            {/* Dragon Mask Face */}
            <polygon
              points="25,75 22,40 50,22 78,40 75,75 50,90"
              fill="#064E3B"
              stroke="#10B981"
              strokeWidth="3"
            />
            {/* Dragon Eyes */}
            <polygon points="32,48 44,52 38,58" fill="#FBBF24" />
            <polygon points="68,48 56,52 62,58" fill="#FBBF24" />
            {/* Dragon Whiskers/Fangs */}
            <path
              d="M36 72 Q25 80 18 90"
              stroke="#34D399"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M64 72 Q75 80 82 90"
              stroke="#34D399"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}

        {type === 'ronin' && (
          <g>
            {/* Cyber Kasa / Conical Hat */}
            <polygon
              points="8,40 50,15 92,40 50,34"
              fill="#2E1065"
              stroke="#A855F7"
              strokeWidth="2.5"
            />
            {/* Face Shadow & Glowing Katana Eye */}
            <ellipse cx="50" cy="58" rx="24" ry="26" fill="#0F172A" />
            <line
              x1="34"
              y1="54"
              x2="66"
              y2="54"
              stroke="#C084FC"
              strokeWidth="4"
              strokeLinecap="round"
              className="drop-shadow-[0_0_8px_#c084fc]"
            />
            {/* Lightning Scarf */}
            <path
              d="M32 75 Q50 90 68 75 Q72 88 50 95 Q28 88 32 75 Z"
              fill="#7E22CE"
              stroke="#A855F7"
              strokeWidth="1.5"
            />
          </g>
        )}

        {type === 'phoenix' && (
          <g>
            {/* Phoenix Crown Feathers */}
            <path d="M50 8 L54 28 L50 24 L46 28 Z" fill="#F59E0B" />
            <path d="M38 14 L46 32 L40 28 L34 32 Z" fill="#EF4444" />
            <path d="M62 14 L54 32 L60 28 L66 32 Z" fill="#EF4444" />
            {/* Golden Helm */}
            <path
              d="M24 72 Q20 38 50 25 Q80 38 76 72 Q50 86 24 72 Z"
              fill="#78350F"
              stroke="#F59E0B"
              strokeWidth="3"
            />
            {/* Solar Flare Visor */}
            <polygon
              points="30,46 50,40 70,46 66,56 50,62 34,56"
              fill="#F59E0B"
              className="drop-shadow-[0_0_12px_#f59e0b]"
            />
            <polygon points="38,48 50,44 62,48 58,54 50,58 42,54" fill="#FEF08A" />
          </g>
        )}

        {type === 'cybercat' && (
          <g>
            {/* Cyber Cat Ears */}
            <polygon points="20,40 30,10 44,34" fill="#831843" stroke="#EC4899" strokeWidth="2" />
            <polygon points="80,40 70,10 56,34" fill="#831843" stroke="#EC4899" strokeWidth="2" />
            {/* Head */}
            <ellipse
              cx="50"
              cy="56"
              rx="30"
              ry="26"
              fill="#18181B"
              stroke="#F472B6"
              strokeWidth="2.5"
            />
            {/* Visor Eyes */}
            <ellipse cx="38" cy="52" rx="7" ry="5" fill="#F472B6" />
            <ellipse cx="62" cy="52" rx="7" ry="5" fill="#F472B6" />
            {/* Nose & Whiskers */}
            <polygon points="48,62 52,62 50,65" fill="#FFFFFF" />
            <line x1="20" y1="60" x2="32" y2="62" stroke="#F472B6" strokeWidth="1.5" />
            <line x1="20" y1="66" x2="32" y2="65" stroke="#F472B6" strokeWidth="1.5" />
            <line x1="80" y1="60" x2="68" y2="62" stroke="#F472B6" strokeWidth="1.5" />
            <line x1="80" y1="66" x2="68" y2="65" stroke="#F472B6" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {showBadge && (
        <span className="absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/80 text-cyan-300 uppercase tracking-wider">
          {rarity}
        </span>
      )}
    </div>
  );
};
