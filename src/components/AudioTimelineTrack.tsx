import React, { useRef, useEffect, useState, useMemo } from 'react';
import { WordCaption } from '../types/caption';
import { WaveformData } from '../services/audioWaveform';
import {
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Mic,
  Film,
  Type,
  Music,
} from 'lucide-react';

interface AudioTimelineTrackProps {
  duration: number;
  currentTime: number;
  words: WordCaption[];
  waveformData: WaveformData | null;
  onSeek: (time: number) => void;
  onWordTimeChange?: (wordId: string, newStart: number, newEnd: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const AudioTimelineTrack: React.FC<AudioTimelineTrackProps> = ({
  duration,
  currentTime,
  words,
  waveformData,
  onSeek,
  onWordTimeChange,
  isMuted,
  onToggleMute,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1x to 3x
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState<boolean>(false);

  // Time markers (every 1 second)
  const timeTicks = useMemo(() => {
    const ticks: number[] = [];
    const totalSecs = Math.max(1, Math.ceil(duration));
    const step = zoomLevel >= 2 ? 0.5 : 1;
    for (let t = 0; t <= totalSecs; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [duration, zoomLevel]);

  // Draw Audio Waveform onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const peaks = waveformData?.peaks || [];
    const numBars = peaks.length > 0 ? peaks.length : 160;
    const barWidth = Math.max(2, (width / numBars) - 1.5);
    const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const currentBarIndex = Math.floor(progressRatio * numBars);

    for (let i = 0; i < numBars; i++) {
      const peakVal = peaks[i] !== undefined ? peaks[i] : (0.15 + 0.3 * Math.sin(i * 0.2));
      const barHeight = Math.max(4, peakVal * (height * 0.82));
      const x = (i / numBars) * width;
      const y = (height - barHeight) / 2;

      const isPast = i <= currentBarIndex;

      // Gradient color: vibrant cyan/amber for past played audio, muted slate for upcoming
      if (isPast) {
        ctx.fillStyle = '#38BDF8'; // Bright cyan for active sound
      } else {
        ctx.fillStyle = '#475569'; // Slate 600 for upcoming sound
      }

      // Rounded audio bar
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  }, [waveformData, currentTime, duration, zoomLevel]);

  // Handle Scrubbing Click & Drag
  const handleTimelineInteraction = (clientX: number) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const scrollLeft = containerRef.current.scrollLeft;
    const contentWidth = rect.width * zoomLevel;
    const effectiveX = Math.max(0, Math.min(contentWidth, clickX + scrollLeft));
    const ratio = effectiveX / contentWidth;
    const newTime = ratio * duration;
    onSeek(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDraggingPlayhead(true);
    handleTimelineInteraction(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead) {
        handleTimelineInteraction(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, duration, zoomLevel]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 flex flex-col shrink-0 select-none">
      {/* Timeline Header Track Info & Zoom */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-850 bg-neutral-950/60 text-xs text-neutral-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
            <Music className="w-3.5 h-3.5 text-sky-400" />
            <span>Audio Waveform Track</span>
          </div>

          <span className="text-[11px] text-neutral-500 hidden sm:inline">
            Voiceover amplitude & word sync
          </span>

          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isMuted
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-750'
            }`}
            title="Toggle audio mute"
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                Muted
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Audio Active
              </>
            )}
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-500">Timeline Zoom:</span>
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
              disabled={zoomLevel <= 1}
              className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-40 rounded"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono font-semibold text-neutral-300">
              {zoomLevel}x
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
              disabled={zoomLevel >= 3}
              className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-40 rounded"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Track Timeline Scrollable Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="relative overflow-x-auto overflow-y-hidden cursor-pointer"
        style={{ height: '148px' }}
      >
        <div
          className="relative h-full transition-all duration-75"
          style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
        >
          {/* 1. Time Ruler Header */}
          <div className="h-6 border-b border-neutral-800 bg-neutral-950/80 relative flex items-end">
            {timeTicks.map((tick) => {
              const tickLeftPct = (tick / duration) * 100;
              const isFullSec = Number.isInteger(tick);
              return (
                <div
                  key={tick}
                  className="absolute bottom-0 flex flex-col items-center pointer-events-none"
                  style={{ left: `${tickLeftPct}%` }}
                >
                  <span className="text-[9px] font-mono text-neutral-500 leading-none mb-1 -translate-x-1/2">
                    {isFullSec ? `${tick}s` : ''}
                  </span>
                  <div
                    className={`w-px ${
                      isFullSec ? 'h-2 bg-neutral-600' : 'h-1 bg-neutral-800'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* 2. AUDIO WAVEFORM TRACK (Visual Sound Peaks) */}
          <div className="h-14 relative bg-neutral-950/90 border-b border-neutral-850 flex items-center px-1">
            <div className="absolute left-2 top-1 flex items-center gap-1 text-[9px] font-mono uppercase text-sky-400/80 font-bold tracking-wider pointer-events-none z-10">
              <Mic className="w-2.5 h-2.5" />
              Voiceover Peaks
            </div>

            <canvas
              ref={canvasRef}
              width={1600}
              height={56}
              className="w-full h-full pointer-events-none"
            />
          </div>

          {/* 3. CAPTION WORD BLOCKS TRACK */}
          <div className="h-16 relative bg-neutral-900/60 p-1 flex items-center overflow-hidden">
            <div className="absolute left-2 top-1 flex items-center gap-1 text-[9px] font-mono uppercase text-amber-400/80 font-bold tracking-wider pointer-events-none z-10">
              <Type className="w-2.5 h-2.5" />
              Caption Sync Blocks ({words.length})
            </div>

            {/* Word Blocks aligned with Audio Waveform */}
            {words.map((word) => {
              const leftPct = (word.start / duration) * 100;
              const widthPct = Math.max(1.2, ((word.end - word.start) / duration) * 100);
              const isCurrent = currentTime >= word.start && currentTime <= word.end;

              return (
                <div
                  key={word.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(word.start);
                  }}
                  className={`absolute top-4 bottom-1 rounded-md px-1.5 flex items-center justify-between text-[10px] font-bold truncate transition-all border ${
                    isCurrent
                      ? 'bg-amber-400 text-neutral-950 border-amber-300 ring-2 ring-amber-400/50 shadow-lg z-20 scale-105'
                      : word.highlight
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/35'
                      : 'bg-neutral-800/90 text-neutral-300 border-neutral-700/80 hover:bg-neutral-750'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  title={`Word: "${word.text}" | Start: ${word.start.toFixed(2)}s | End: ${word.end.toFixed(2)}s`}
                >
                  <span className="truncate">{word.text}</span>
                  {word.emoji && (
                    <span className="ml-1 text-[11px] shrink-0">{word.emoji}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 4. Playhead Cursor Line with Glow */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
            style={{
              left: `${progressPercent}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {/* Playhead Head */}
            <div className="w-3.5 h-3.5 bg-amber-400 rounded-sm rotate-45 -translate-y-1 shadow-[0_0_10px_#F59E0B]" />
            {/* Playhead Vertical Line */}
            <div className="w-[2px] flex-1 bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
          </div>
        </div>
      </div>
    </div>
  );
};
