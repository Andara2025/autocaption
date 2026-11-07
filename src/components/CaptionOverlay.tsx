import React, { useMemo } from 'react';
import { CaptionSegment, CaptionStyle, WordCaption } from '../types/caption';
import { CaptionWord } from './CaptionWord';

interface CaptionOverlayProps {
  words: WordCaption[];
  currentTime: number;
  style: CaptionStyle;
  showSafeZoneOverlay?: boolean;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  words,
  currentTime,
  style,
  showSafeZoneOverlay = false,
}) => {
  // Group words into display segments / chunks
  const segments: CaptionSegment[] = useMemo(() => {
    if (!words || words.length === 0) return [];

    const chunkSize = style.wordsPerChunk > 0 ? style.wordsPerChunk : 3;
    const result: CaptionSegment[] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      const slice = words.slice(i, i + chunkSize);
      const start = slice[0].start;
      // Provide a tiny grace period (0.25s) after the last word so captions don't blink away
      const end = slice[slice.length - 1].end + 0.25;
      const text = slice.map((w) => w.text).join(' ');

      result.push({
        id: `seg-${i}`,
        start,
        end,
        text,
        words: slice,
      });
    }

    return result;
  }, [words, style.wordsPerChunk]);

  // Find active segment for the current timestamp
  const activeSegment = useMemo(() => {
    return segments.find(
      (seg) => currentTime >= seg.start && currentTime <= seg.end
    );
  }, [segments, currentTime]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      {/* Safe Zone Visualizer (TikTok / Reels layout overlay) */}
      {showSafeZoneOverlay && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top header safe margin */}
          <div className="absolute top-0 left-0 right-0 h-[14%] border-b border-dashed border-red-500/40 bg-red-500/5 flex items-start justify-center pt-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-red-400 font-semibold px-2 py-0.5 rounded bg-black/40">
              Header Safe Zone (Follow / Live)
            </span>
          </div>

          {/* Right side interaction buttons margin */}
          <div className="absolute top-[20%] right-0 bottom-[22%] w-[18%] border-l border-dashed border-red-500/40 bg-red-500/5 flex items-center justify-center p-1">
            <span className="text-[9px] uppercase font-mono text-center text-red-400 font-semibold rotate-90 whitespace-nowrap bg-black/40 px-1 py-0.5 rounded">
              Icons Safe Zone
            </span>
          </div>

          {/* Bottom user caption & audio safe margin */}
          <div className="absolute bottom-0 left-0 right-0 h-[22%] border-t border-dashed border-red-500/40 bg-red-500/5 flex items-end justify-center pb-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-red-400 font-semibold px-2 py-0.5 rounded bg-black/40">
              Bottom Description & Audio Area
            </span>
          </div>

          {/* Sweet Spot Box */}
          <div className="absolute top-[62%] bottom-[24%] left-[10%] right-[20%] border-2 border-emerald-400/60 rounded-xl pointer-events-none flex items-center justify-center">
            <span className="text-[9px] uppercase font-mono tracking-widest text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-black/60">
              Optimal Caption Sweet Spot
            </span>
          </div>
        </div>
      )}

      {/* Render Current Active Caption Words */}
      {activeSegment && (
        <div
          className="absolute w-full px-6 flex justify-center text-center transition-all duration-75"
          style={{
            top: `${style.positionY}%`,
            left: `${style.positionX}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 max-w-[90%]"
            style={{
              fontSize: `${style.fontSize}px`,
              fontWeight: style.fontWeight,
            }}
          >
            {activeSegment.words.map((word) => {
              const isActive =
                currentTime >= word.start && currentTime <= word.end;
              const isPast = currentTime > word.end;

              return (
                <CaptionWord
                  key={word.id}
                  word={word}
                  style={style}
                  isActive={isActive}
                  isPast={isPast}
                  currentTime={currentTime}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
