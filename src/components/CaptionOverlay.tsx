import React, { useMemo } from 'react';
import { AspectRatioMode, CaptionSegment, CaptionStyle, WordCaption } from '../types/caption';
import { CaptionWord } from './CaptionWord';

interface CaptionOverlayProps {
  words: WordCaption[];
  currentTime: number;
  style: CaptionStyle;
  showSafeZoneOverlay?: boolean;
  showGridGuides?: boolean;
  aspectRatio?: AspectRatioMode;
  captionsVisible?: boolean;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  words,
  currentTime,
  style,
  showSafeZoneOverlay = false,
  showGridGuides = false,
  aspectRatio = '9:16',
  captionsVisible = true,
}) => {
  // Group words into display segments / chunks
  const segments: CaptionSegment[] = useMemo(() => {
    if (!words || words.length === 0) return [];

    const chunkSize = style.wordsPerChunk > 0 ? style.wordsPerChunk : 3;
    const result: CaptionSegment[] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      const slice = words.slice(i, i + chunkSize);
      const start = slice[0].start;
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
      {/* NLE Rule-of-Thirds & Center Crosshair Grid Guides */}
      {showGridGuides && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Vertical Thirds */}
          <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/15" />
          <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/15" />
          {/* Horizontal Thirds */}
          <div className="absolute left-0 right-0 top-1/3 h-px bg-white/15" />
          <div className="absolute left-0 right-0 top-2/3 h-px bg-white/15" />
          {/* Center Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-px bg-amber-400/50" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-px bg-amber-400/50" />
          {/* Broadcast Action Safe 90% & Title Safe 80% */}
          <div className="absolute inset-[5%] border border-white/10" />
          <div className="absolute inset-[10%] border border-dashed border-cyan-400/20" />
        </div>
      )}

      {/* Safe Zone Visualizer (Adaptable for 9:16 Vertical or 16:9 Widescreen) */}
      {showSafeZoneOverlay && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {aspectRatio === '9:16' ? (
            <>
              {/* Top header safe margin */}
              <div className="absolute top-0 left-0 right-0 h-[13%] border-b border-dashed border-rose-500/45 bg-rose-500/5 flex items-start justify-center pt-3">
                <span className="text-[18px] uppercase font-mono tracking-wider text-rose-300 font-semibold px-3 py-1 bg-black/60">
                  UI Header Zone (9:16)
                </span>
              </div>

              {/* Right side interaction buttons margin */}
              <div className="absolute top-[18%] right-0 bottom-[22%] w-[16%] border-l border-dashed border-rose-500/45 bg-rose-500/5 flex items-center justify-center p-1">
                <span className="text-[16px] uppercase font-mono text-center text-rose-300 font-semibold rotate-90 whitespace-nowrap bg-black/60 px-2.5 py-1">
                  Social Actions Zone
                </span>
              </div>

              {/* Bottom user caption & audio safe margin */}
              <div className="absolute bottom-0 left-0 right-0 h-[21%] border-t border-dashed border-rose-500/45 bg-rose-500/5 flex items-end justify-center pb-3">
                <span className="text-[18px] uppercase font-mono tracking-wider text-rose-300 font-semibold px-3 py-1 bg-black/60">
                  Metadata & Audio Scrubber Zone
                </span>
              </div>

              {/* Optimal Subtitle Area */}
              <div className="absolute top-[60%] bottom-[23%] left-[8%] right-[18%] border-2 border-emerald-400/60 pointer-events-none flex items-start justify-start p-2">
                <span className="text-[15px] uppercase font-mono tracking-widest text-emerald-300 font-semibold px-2 py-0.5 bg-black/70">
                  Subtitle Safe Area
                </span>
              </div>
            </>
          ) : (
            <>
              {/* 16:9 Broadcast Title Safe & Lower Third Zone */}
              <div className="absolute inset-[8%] border border-dashed border-amber-400/45 pointer-events-none flex items-start justify-between p-2">
                <span className="text-[16px] uppercase font-mono tracking-wider text-amber-300 font-semibold px-2.5 py-0.5 bg-black/65">
                  16:9 Title Safe (84%)
                </span>
              </div>
              <div className="absolute bottom-[10%] left-[12%] right-[12%] h-[22%] border-2 border-emerald-400/55 bg-emerald-500/5 pointer-events-none flex items-start justify-start p-2">
                <span className="text-[15px] uppercase font-mono tracking-widest text-emerald-300 font-semibold px-2 py-0.5 bg-black/70">
                  16:9 Lower-Third Subtitle Zone
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Render Current Active Caption Words */}
      {captionsVisible && activeSegment && (
        <div
          className="absolute w-full px-8 flex justify-center text-center transition-all duration-75 z-20"
          style={{
            top: `${style.positionY}%`,
            left: `${style.positionX}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 max-w-[88%]"
            style={{
              fontSize: `${aspectRatio === '16:9' ? Math.round(style.fontSize * 1.15) : style.fontSize}px`,
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
