import React from 'react';
import { CaptionStyle, WordCaption } from '../types/caption';

interface CaptionWordProps {
  word: WordCaption;
  style: CaptionStyle;
  isActive: boolean;
  isPast: boolean;
  currentTime: number;
}

export const CaptionWord: React.FC<CaptionWordProps> = ({
  word,
  style,
  isActive,
  isPast,
  currentTime,
}) => {
  // Calculate relative progress inside active word (0 to 1)
  const duration = Math.max(0.08, word.end - word.start);
  const elapsed = Math.max(0, currentTime - word.start);
  const progress = Math.min(1, Math.max(0, elapsed / duration));

  // Determine colors based on active / past / preset
  let wordColor = style.textColor;
  let wordBg = 'transparent';
  let scale = 1;
  let rotation = 0;
  let textShadow = style.hasShadow
    ? `0 4px 12px ${style.shadowColor}, 0 2px 4px rgba(0,0,0,0.8)`
    : 'none';

  if (style.preset === 'karaoke') {
    if (isActive || isPast) {
      wordColor = word.customColor || style.highlightColor;
    } else {
      wordColor = style.textColor;
    }
  } else if (isActive) {
    wordColor = word.customColor || style.highlightColor;

    if (style.activeEffect === 'box') {
      wordBg = style.activeBgColor;
      wordColor = style.highlightColor === '#000000' ? '#000000' : '#FFFFFF';
    } else if (style.activeEffect === 'badge') {
      wordBg = '#EF4444';
      wordColor = '#FFFFFF';
      rotation = -3;
    }

    // Animation physics
    if (style.animationType === 'spring-pop') {
      // Spring pop curve: quick overshoot then settle
      const springPhase = Math.sin(progress * Math.PI);
      scale = 1 + (style.activeScale - 1) * (0.6 + 0.4 * springPhase);
    } else if (style.animationType === 'bounce') {
      const bounce = Math.abs(Math.sin(progress * Math.PI * 1.5));
      scale = 1 + (style.activeScale - 1) * bounce;
      rotation = (progress > 0.5 ? 1 : -1) * 2;
    } else if (style.animationType === 'glow') {
      scale = style.activeScale;
      textShadow = `0 0 20px ${style.highlightColor}, 0 0 35px ${style.highlightColor}`;
    } else if (style.animationType === 'scale-pulse') {
      scale = 1 + (style.activeScale - 1) * 0.8;
    } else {
      scale = style.activeScale;
    }
  } else if (word.highlight && !isPast) {
    // Keyword highlight even when not currently spoken
    if (style.preset === 'hormozi') {
      wordColor = style.highlightColor;
    }
  }

  // Text stroke styling
  const strokeStyle = style.strokeWidth > 0 ? {
    WebkitTextStroke: `${style.strokeWidth}px ${style.strokeColor}`,
    paintOrder: 'stroke fill',
  } : {};

  // Formatted display text
  let displayText = word.text;
  if (style.textTransform === 'uppercase') {
    displayText = displayText.toUpperCase();
  } else if (style.textTransform === 'capitalize') {
    displayText = displayText.charAt(0).toUpperCase() + displayText.slice(1);
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 transition-transform duration-75 select-none"
      style={{
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: 'center bottom',
      }}
    >
      <span
        className={`inline-block px-1.5 py-0.5 rounded-lg leading-tight tracking-tight ${
          wordBg !== 'transparent' ? 'shadow-lg' : ''
        }`}
        style={{
          fontFamily: style.fontFamily,
          color: wordColor,
          backgroundColor: wordBg,
          textShadow,
          ...strokeStyle,
        }}
      >
        {displayText}
      </span>

      {/* Optional contextual viral emoji */}
      {style.showEmojis && word.emoji && (
        <span
          className={`text-[0.9em] transition-transform duration-100 ${
            isActive ? 'scale-125 rotate-6' : 'scale-100'
          }`}
          style={{ textShadow: 'none' }}
        >
          {word.emoji}
        </span>
      )}
    </span>
  );
};
