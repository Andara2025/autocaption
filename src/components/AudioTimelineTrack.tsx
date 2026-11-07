import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AspectRatioMode,
  TimelineTool,
  TrackVisibilityState,
  WordCaption,
} from '../types/caption';
import { WaveformData } from '../services/audioWaveform';
import {
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Mic,
  Film,
  Type,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Scissors,
  MousePointer,
  Plus,
  Trash2,
  Magnet,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Maximize2,
} from 'lucide-react';

interface AudioTimelineTrackProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  words: WordCaption[];
  onWordsChange: (words: WordCaption[]) => void;
  selectedWordId: string | null;
  onSelectWord: (id: string | null) => void;
  waveformData: WaveformData | null;
  onSeek: (time: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  aspectRatio: AspectRatioMode;
  clipTitle: string;
  trackState: TrackVisibilityState;
  onTrackStateChange: (next: TrackVisibilityState) => void;
}

type DragInteraction =
  | { type: 'playhead' }
  | {
      type: 'move-word';
      wordId: string;
      initialStart: number;
      initialEnd: number;
      startClientX: number;
    }
  | {
      type: 'trim-left';
      wordId: string;
      initialStart: number;
      initialEnd: number;
      startClientX: number;
    }
  | {
      type: 'trim-right';
      wordId: string;
      initialStart: number;
      initialEnd: number;
      startClientX: number;
    };

export const AudioTimelineTrack: React.FC<AudioTimelineTrackProps> = ({
  duration,
  currentTime,
  isPlaying,
  onTogglePlay,
  words,
  onWordsChange,
  selectedWordId,
  onSelectWord,
  waveformData,
  onSeek,
  isMuted,
  onToggleMute,
  aspectRatio,
  clipTitle,
  trackState,
  onTrackStateChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackContentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1.5); // 1x to 6x
  const [activeTool, setActiveTool] = useState<TimelineTool>('select');
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [dragState, setDragState] = useState<DragInteraction | null>(null);
  const [inlineEditWordId, setInlineEditWordId] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState<string>('');

  const safeDuration = Math.max(1, duration);

  // Format SMPTE timecode MM:SS:FF (30fps)
  const formatSMPTE = useCallback((secs: number) => {
    const clamped = Math.max(0, secs);
    const mins = Math.floor(clamped / 60);
    const wholeSecs = Math.floor(clamped % 60);
    const frames = Math.floor((clamped % 1) * 30);
    return `${mins.toString().padStart(2, '0')}:${wholeSecs
      .toString()
      .padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }, []);

  // Format ruler label MM:SS or MM:SS:FF
  const formatRulerTime = useCallback((secs: number, showFrames: boolean) => {
    const mins = Math.floor(secs / 60);
    const wholeSecs = Math.floor(secs % 60);
    if (!showFrames) {
      return `${mins.toString().padStart(2, '0')}:${wholeSecs.toString().padStart(2, '0')}`;
    }
    const frames = Math.round((secs % 1) * 30);
    return `${mins.toString().padStart(2, '0')}:${wholeSecs
      .toString()
      .padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }, []);

  // Generate ruler ticks based on zoom level
  const timeTicks = useMemo(() => {
    const ticks: Array<{ time: number; isMajor: boolean }> = [];
    const totalSecs = Math.ceil(safeDuration);
    const step = zoomLevel >= 3.5 ? 0.25 : zoomLevel >= 2 ? 0.5 : 1;
    const majorEvery = zoomLevel >= 3.5 ? 0.5 : 1;

    for (let t = 0; t <= totalSecs * 4; t++) {
      const timeVal = t * step;
      if (timeVal > safeDuration) break;
      const isMajor = Math.abs(timeVal % majorEvery) < 0.001;
      ticks.push({ time: timeVal, isMajor });
    }
    return ticks;
  }, [safeDuration, zoomLevel]);

  // Generate filmstrip cell indices for V1 Video Track
  const filmstripCells = useMemo(() => {
    const count = Math.max(8, Math.min(36, Math.round(12 * zoomLevel)));
    return Array.from({ length: count }, (_, idx) => idx);
  }, [zoomLevel]);

  // Draw High-Resolution Studio Mirrored Audio Waveform on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Subtle dB reference lines (-6dB top/bottom and 0dB center line)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.moveTo(0, height * 0.22);
    ctx.lineTo(width, height * 0.22);
    ctx.moveTo(0, height * 0.78);
    ctx.lineTo(width, height * 0.78);
    ctx.stroke();

    const peaks = waveformData?.peaks || [];
    const numBars = peaks.length > 0 ? peaks.length : 220;
    const barSpacing = width / numBars;
    const barWidth = Math.max(1.5, barSpacing * 0.68);
    const progressRatio = Math.min(1, Math.max(0, currentTime / safeDuration));
    const currentBarIndex = Math.floor(progressRatio * numBars);

    for (let i = 0; i < numBars; i++) {
      const rawPeak =
        peaks[i] !== undefined
          ? peaks[i]
          : 0.18 + 0.35 * Math.abs(Math.sin(i * 0.23)) * Math.cos(i * 0.09);
      const amplitude = Math.max(0.06, Math.min(0.95, rawPeak));
      const halfHeight = amplitude * (height * 0.42);
      const x = i * barSpacing;

      const isPast = i <= currentBarIndex;

      if (isMuted) {
        ctx.fillStyle = isPast ? 'rgba(244, 63, 94, 0.45)' : 'rgba(115, 115, 115, 0.25)';
      } else if (isPast) {
        ctx.fillStyle = amplitude > 0.75 ? '#38BDF8' : '#0EA5E9';
      } else {
        ctx.fillStyle = amplitude > 0.75 ? '#64748B' : '#334155';
      }

      // Draw mirrored studio waveform bar (top + bottom symmetry)
      ctx.beginPath();
      ctx.roundRect(x, centerY - halfHeight, barWidth, halfHeight * 2, 1);
      ctx.fill();
    }
  }, [waveformData, currentTime, safeDuration, zoomLevel, isMuted]);

  // Convert clientX on timeline to timestamp in seconds
  const clientXToTime = useCallback(
    (clientX: number): number => {
      if (!trackContentRef.current) return 0;
      const rect = trackContentRef.current.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      return (relX / rect.width) * safeDuration;
    },
    [safeDuration]
  );

  // Snap helper
  const snapTime = useCallback(
    (val: number): number => {
      if (!snapEnabled) return Math.round(val * 100) / 100;
      // Snap to playhead if within 0.08s
      if (Math.abs(val - currentTime) < 0.08) {
        return Math.round(currentTime * 100) / 100;
      }
      // Snap to 0.05s grid
      return Math.round(val * 20) / 20;
    },
    [snapEnabled, currentTime]
  );

  // Handle mouse move & mouse up for playhead scrubbing and word clip dragging/trimming
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackContentRef.current) return;
      const rect = trackContentRef.current.getBoundingClientRect();
      const deltaSeconds = ((e.clientX - ('startClientX' in dragState ? dragState.startClientX : 0)) / rect.width) * safeDuration;

      if (dragState.type === 'playhead') {
        const nextTime = clientXToTime(e.clientX);
        onSeek(nextTime);
        return;
      }

      if (trackState.captionsLocked) return;

      if (dragState.type === 'move-word') {
        const clipDur = dragState.initialEnd - dragState.initialStart;
        const rawStart = Math.max(0, Math.min(safeDuration - clipDur, dragState.initialStart + deltaSeconds));
        const newStart = snapTime(rawStart);
        const newEnd = Math.round((newStart + clipDur) * 100) / 100;

        onWordsChange(
          words.map((w) =>
            w.id === dragState.wordId ? { ...w, start: newStart, end: newEnd } : w
          )
        );
      } else if (dragState.type === 'trim-left') {
        const maxStart = dragState.initialEnd - 0.1;
        const rawStart = Math.max(0, Math.min(maxStart, dragState.initialStart + deltaSeconds));
        const newStart = snapTime(rawStart);

        onWordsChange(
          words.map((w) =>
            w.id === dragState.wordId ? { ...w, start: newStart } : w
          )
        );
      } else if (dragState.type === 'trim-right') {
        const minEnd = dragState.initialStart + 0.1;
        const rawEnd = Math.max(minEnd, Math.min(safeDuration, dragState.initialEnd + deltaSeconds));
        const newEnd = snapTime(rawEnd);

        onWordsChange(
          words.map((w) =>
            w.id === dragState.wordId ? { ...w, end: newEnd } : w
          )
        );
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, safeDuration, clientXToTime, onSeek, onWordsChange, words, snapTime, trackState.captionsLocked]);

  // Split word clip at timestamp (or midpoint)
  const handleSplitWord = (word: WordCaption, splitTime?: number) => {
    if (trackState.captionsLocked) return;
    const dur = word.end - word.start;
    if (dur < 0.2) return; // too short to split

    const cutPoint =
      splitTime && splitTime > word.start + 0.08 && splitTime < word.end - 0.08
        ? Math.round(splitTime * 100) / 100
        : Math.round((word.start + dur / 2) * 100) / 100;

    const parts = word.text.trim().split(/\s+/);
    const firstText = parts.length > 1 ? parts[0] : word.text;
    const secondText = parts.length > 1 ? parts.slice(1).join(' ') : `${word.text}`;

    const firstClip: WordCaption = {
      ...word,
      text: firstText,
      end: cutPoint,
    };
    const secondClip: WordCaption = {
      ...word,
      id: `w-split-${Date.now()}`,
      text: secondText,
      start: cutPoint,
      end: word.end,
    };

    const idx = words.findIndex((w) => w.id === word.id);
    if (idx === -1) return;
    const next = [...words];
    next.splice(idx, 1, firstClip, secondClip);
    onWordsChange(next);
    onSelectWord(secondClip.id);
  };

  // Split at playhead button handler
  const handleSplitAtPlayhead = () => {
    if (trackState.captionsLocked) return;
    const target =
      words.find((w) => currentTime > w.start + 0.05 && currentTime < w.end - 0.05) ||
      words.find((w) => w.id === selectedWordId);
    if (target) {
      handleSplitWord(target, currentTime);
    }
  };

  // Insert a new caption word block at playhead
  const handleAddWordAtPlayhead = () => {
    if (trackState.captionsLocked) return;
    const start = Math.round(currentTime * 100) / 100;
    const end = Math.min(safeDuration, Math.round((start + 0.5) * 100) / 100);
    const newWord: WordCaption = {
      id: `w-new-${Date.now()}`,
      text: 'CAPTION',
      start,
      end,
      highlight: true,
    };
    const next = [...words, newWord].sort((a, b) => a.start - b.start);
    onWordsChange(next);
    onSelectWord(newWord.id);
  };

  // Delete selected word clip
  const handleDeleteSelected = () => {
    if (!selectedWordId || trackState.captionsLocked) return;
    onWordsChange(words.filter((w) => w.id !== selectedWordId));
    onSelectWord(null);
  };

  const commitInlineEdit = () => {
    if (!inlineEditWordId) return;
    const trimmed = inlineEditText.trim();
    if (trimmed) {
      onWordsChange(
        words.map((w) => (w.id === inlineEditWordId ? { ...w, text: trimmed } : w))
      );
    }
    setInlineEditWordId(null);
  };

  const selectedWord = useMemo(
    () => words.find((w) => w.id === selectedWordId) || null,
    [words, selectedWordId]
  );

  const progressPercent = (currentTime / safeDuration) * 100;
  const currentFrame = Math.round(currentTime * 30);
  const totalFrames = Math.round(safeDuration * 30);

  return (
    <section
      aria-label="Multi-Track Timeline Editor"
      className="bg-neutral-950 border-t border-neutral-800 flex flex-col shrink-0 select-none"
    >
      {/* 1. NLE TIMELINE COMMAND & TRANSPORT BAR */}
      <div className="h-10 px-3 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between gap-4 text-xs">
        {/* Left: Editing Tools (Select, Razor, Split, Add, Delete, Snap) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5">
            <button
              onClick={() => setActiveTool('select')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTool === 'select'
                  ? 'bg-amber-400 text-neutral-950 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Selection & Trim Tool (Drag clip or edges)"
            >
              <MousePointer className="w-3 h-3" />
              <span>Select</span>
            </button>
            <button
              onClick={() => setActiveTool('razor')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTool === 'razor'
                  ? 'bg-rose-500 text-white font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Razor Split Tool (Click any subtitle clip to cut)"
            >
              <Scissors className="w-3 h-3" />
              <span>Razor</span>
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-800 mx-0.5" />

          <button
            onClick={handleSplitAtPlayhead}
            disabled={trackState.captionsLocked}
            className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-[11px] font-medium transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
            title="Split subtitle clip at playhead"
          >
            <Scissors className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Split Clip</span>
          </button>

          <button
            onClick={handleAddWordAtPlayhead}
            disabled={trackState.captionsLocked}
            className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-[11px] font-medium transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
            title="Insert new subtitle block at playhead"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Add Subtitle</span>
          </button>

          <button
            onClick={handleDeleteSelected}
            disabled={!selectedWordId || trackState.captionsLocked}
            className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-950 hover:bg-rose-950/50 text-neutral-400 hover:text-rose-300 border border-neutral-800 text-[11px] font-medium transition-colors disabled:opacity-30 whitespace-nowrap shrink-0"
            title="Delete selected subtitle clip"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              snapEnabled
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'
            }`}
            title="Toggle magnetic timeline snapping"
          >
            <Magnet className="w-3 h-3" />
            <span className="hidden md:inline">Snap</span>
          </button>
        </div>

        {/* Center: NLE Transport Controls & SMPTE Timecode Readout */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5">
            <button
              onClick={() => onSeek(0)}
              className="p-1 text-neutral-400 hover:text-neutral-100 rounded hover:bg-neutral-800 transition-colors"
              title="Go to In Point (00:00:00)"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSeek(currentTime - 1 / 30)}
              className="p-1 text-neutral-400 hover:text-neutral-100 rounded hover:bg-neutral-800 transition-colors"
              title="Step Back 1 Frame (-1f)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onTogglePlay}
              className="px-2.5 py-1 mx-0.5 rounded bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold flex items-center justify-center transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-neutral-950" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-neutral-950 translate-x-0.5" />
              )}
            </button>
            <button
              onClick={() => onSeek(currentTime + 1 / 30)}
              className="p-1 text-neutral-400 hover:text-neutral-100 rounded hover:bg-neutral-800 transition-colors"
              title="Step Forward 1 Frame (+1f)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSeek(safeDuration)}
              className="p-1 text-neutral-400 hover:text-neutral-100 rounded hover:bg-neutral-800 transition-colors"
              title="Go to Out Point"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* SMPTE Master Timecode Display */}
          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded font-mono text-[11px] tabular-nums">
            <span className="text-amber-400 font-bold tracking-wider">
              {formatSMPTE(currentTime)}
            </span>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-400">{formatSMPTE(safeDuration)}</span>
            <span className="hidden xl:inline text-neutral-600">·</span>
            <span className="hidden xl:inline text-neutral-500">
              F {currentFrame.toString().padStart(3, '0')}/{totalFrames}
            </span>
          </div>
        </div>

        {/* Right: Selected Clip Timing & Timeline Zoom */}
        <div className="flex items-center gap-3">
          {selectedWord && (
            <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-neutral-400 tabular-nums bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded">
              <span className="text-amber-300 font-semibold truncate max-w-[90px]">
                "{selectedWord.text}"
              </span>
              <span>·</span>
              <span>IN {selectedWord.start.toFixed(2)}s</span>
              <span>·</span>
              <span>OUT {selectedWord.end.toFixed(2)}s</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
              disabled={zoomLevel <= 1}
              className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-30"
              title="Zoom Out Timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="1"
              max="6"
              step="0.25"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-16 accent-amber-400 bg-neutral-800 h-1 rounded cursor-pointer hidden sm:block"
              title={`Timeline Zoom: ${zoomLevel}x`}
            />
            <span className="font-mono text-[11px] text-neutral-300 tabular-nums w-9 text-center">
              {zoomLevel.toFixed(1)}x
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(6, Number((z + 0.5).toFixed(1))))}
              disabled={zoomLevel >= 6}
              className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-30"
              title="Zoom In Timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 text-neutral-400 hover:text-neutral-200 border-l border-neutral-800 pl-1.5"
              title="Fit Sequence to Window (1.0x)"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MULTI-TRACK NLE MATRIX (LEFT TRACK PATCHBAY + RIGHT SCROLLABLE TRACKS) */}
      <div className="flex h-[204px] overflow-hidden">
        {/* LEFT COLUMN: NLE Track Headers & Patchbay Controls */}
        <div className="w-48 sm:w-56 shrink-0 bg-neutral-950 border-r border-neutral-800 flex flex-col z-20">
          {/* Ruler Corner Header */}
          <div className="h-7 px-3 border-b border-neutral-800 bg-neutral-900/70 flex items-center justify-between text-[10px] font-mono text-neutral-400 tabular-nums">
            <span>TIMECODE · 30 FPS</span>
            <span className="text-neutral-500">{words.length} CLIPS</span>
          </div>

          {/* T1 Track Header: Subtitles / Captions */}
          <div className="h-14 px-3 border-b border-neutral-800/90 bg-neutral-900/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-bold">
                T1
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-neutral-200 truncate flex items-center gap-1">
                  <Type className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Subtitles</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono block truncate">
                  {trackState.captionsLocked ? 'Locked' : 'Word Sync Layer'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() =>
                  onTrackStateChange({
                    ...trackState,
                    captionsVisible: !trackState.captionsVisible,
                  })
                }
                className={`p-1.5 rounded border transition-colors ${
                  trackState.captionsVisible
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
                title={trackState.captionsVisible ? 'Hide Subtitle Track' : 'Show Subtitle Track'}
              >
                {trackState.captionsVisible ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() =>
                  onTrackStateChange({
                    ...trackState,
                    captionsLocked: !trackState.captionsLocked,
                  })
                }
                className={`p-1.5 rounded border transition-colors ${
                  trackState.captionsLocked
                    ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
                title={trackState.captionsLocked ? 'Unlock Subtitle Track' : 'Lock Subtitle Track'}
              >
                {trackState.captionsLocked ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* V1 Track Header: Master Video */}
          <div className="h-14 px-3 border-b border-neutral-800/90 bg-neutral-900/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-mono text-[10px] font-bold">
                V1
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-neutral-200 truncate flex items-center gap-1">
                  <Film className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>Video Master</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono block truncate">
                  {aspectRatio === '16:9' ? '1920×1080 HD' : '1080×1920 Vert'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() =>
                  onTrackStateChange({
                    ...trackState,
                    videoVisible: !trackState.videoVisible,
                  })
                }
                className={`p-1.5 rounded border transition-colors ${
                  trackState.videoVisible
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
                title={trackState.videoVisible ? 'Hide Video Track' : 'Show Video Track'}
              >
                {trackState.videoVisible ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() =>
                  onTrackStateChange({
                    ...trackState,
                    videoLocked: !trackState.videoLocked,
                  })
                }
                className={`p-1.5 rounded border transition-colors ${
                  trackState.videoLocked
                    ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
                title={trackState.videoLocked ? 'Unlock Video Track' : 'Lock Video Track'}
              >
                {trackState.videoLocked ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* A1 Track Header: Voiceover Audio */}
          <div className="flex-1 px-3 bg-neutral-900/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-300 font-mono text-[10px] font-bold">
                A1
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-neutral-200 truncate flex items-center gap-1">
                  <Mic className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>Voiceover</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono block truncate">
                  {isMuted ? 'Muted (-∞ dB)' : '48kHz Stereo'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onToggleMute}
                className={`p-1.5 rounded border transition-colors ${
                  isMuted
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : 'bg-neutral-900 border-neutral-800 text-emerald-400 hover:bg-neutral-800'
                }`}
                title={isMuted ? 'Unmute Audio Track (M)' : 'Mute Audio Track (M)'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() =>
                  onTrackStateChange({
                    ...trackState,
                    audioLocked: !trackState.audioLocked,
                  })
                }
                className={`p-1.5 rounded border transition-colors ${
                  trackState.audioLocked
                    ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
                title={trackState.audioLocked ? 'Unlock Audio Track' : 'Lock Audio Track'}
              >
                {trackState.audioLocked ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Scrollable Multi-Track Timeline Canvas */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative bg-neutral-950"
        >
          <div
            ref={trackContentRef}
            className="relative h-full"
            style={{ width: `${zoomLevel * 100}%`, minWidth: '100%' }}
          >
            {/* 1. SMPTE TIMECODE RULER */}
            <div
              onMouseDown={(e) => {
                setDragState({ type: 'playhead' });
                onSeek(clientXToTime(e.clientX));
              }}
              className="h-7 border-b border-neutral-800 bg-neutral-900/90 relative flex items-end cursor-pointer"
            >
              {timeTicks.map(({ time, isMajor }) => {
                const leftPct = (time / safeDuration) * 100;
                return (
                  <div
                    key={time}
                    className="absolute bottom-0 flex flex-col items-start pointer-events-none"
                    style={{ left: `${leftPct}%` }}
                  >
                    {isMajor && (
                      <span className="text-[10px] font-mono text-neutral-400 tabular-nums leading-none mb-1 pl-1">
                        {formatRulerTime(time, zoomLevel >= 3.5)}
                      </span>
                    )}
                    <div
                      className={`w-px ${
                        isMajor ? 'h-2.5 bg-neutral-500' : 'h-1.5 bg-neutral-700/80'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* 2. TRACK T1: INTERACTIVE CAPTION / SUBTITLE CLIPS */}
            <div
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  onSelectWord(null);
                  setDragState({ type: 'playhead' });
                  onSeek(clientXToTime(e.clientX));
                }
              }}
              className={`h-14 relative border-b border-neutral-800/90 bg-[linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] [background-size:48px_100%] ${
                !trackState.captionsVisible ? 'opacity-40' : ''
              }`}
            >
              {words.map((word) => {
                const leftPct = (word.start / safeDuration) * 100;
                const widthPct = Math.max(0.8, ((word.end - word.start) / safeDuration) * 100);
                const isCurrent = currentTime >= word.start && currentTime <= word.end;
                const isSelected = selectedWordId === word.id;
                const isEditingInline = inlineEditWordId === word.id;

                return (
                  <div
                    key={word.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onSelectWord(word.id);

                      if (activeTool === 'razor') {
                        const clickTime = clientXToTime(e.clientX);
                        handleSplitWord(word, clickTime);
                        return;
                      }

                      if (!trackState.captionsLocked && !isEditingInline) {
                        setDragState({
                          type: 'move-word',
                          wordId: word.id,
                          initialStart: word.start,
                          initialEnd: word.end,
                          startClientX: e.clientX,
                        });
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (trackState.captionsLocked) return;
                      setInlineEditWordId(word.id);
                      setInlineEditText(word.text);
                    }}
                    className={`group absolute top-1.5 bottom-1.5 rounded-sm flex items-center justify-between transition-colors border overflow-hidden ${
                      activeTool === 'razor'
                        ? 'cursor-crosshair hover:border-rose-400'
                        : trackState.captionsLocked
                        ? 'cursor-not-allowed'
                        : 'cursor-grab active:cursor-grabbing'
                    } ${
                      isSelected
                        ? 'bg-amber-400/25 border-amber-400 text-amber-100 ring-1 ring-amber-400/60 z-20'
                        : isCurrent
                        ? 'bg-amber-500/30 border-amber-300 text-white z-10'
                        : word.highlight
                        ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200 hover:bg-emerald-900/70'
                        : 'bg-neutral-800/90 border-neutral-700 text-neutral-200 hover:border-neutral-500'
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                    title={`"${word.text}" (${word.start.toFixed(2)}s – ${word.end.toFixed(
                      2
                    )}s) · Drag to move, drag edges to trim, double-click to edit`}
                  >
                    {/* Top NLE Clip Accent Bar */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 ${
                        isSelected || isCurrent
                          ? 'bg-amber-400'
                          : word.highlight
                          ? 'bg-emerald-400'
                          : 'bg-neutral-600'
                      }`}
                    />

                    {/* Left Trim Handle */}
                    {!trackState.captionsLocked && activeTool === 'select' && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectWord(word.id);
                          setDragState({
                            type: 'trim-left',
                            wordId: word.id,
                            initialStart: word.start,
                            initialEnd: word.end,
                            startClientX: e.clientX,
                          });
                        }}
                        className="w-1.5 h-full bg-transparent group-hover:bg-white/25 hover:!bg-amber-400 cursor-ew-resize shrink-0 z-10"
                      />
                    )}

                    {/* Clip Label or Inline Editor */}
                    <div className="flex-1 px-1.5 pt-0.5 flex items-center justify-between gap-1 min-w-0 overflow-hidden">
                      {isEditingInline ? (
                        <input
                          type="text"
                          value={inlineEditText}
                          autoFocus
                          onChange={(e) => setInlineEditText(e.target.value)}
                          onBlur={commitInlineEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitInlineEdit();
                            if (e.key === 'Escape') setInlineEditWordId(null);
                          }}
                          className="w-full bg-neutral-950 text-amber-300 font-mono text-[10px] px-1 py-0.5 rounded border border-amber-400 focus:outline-none"
                        />
                      ) : (
                        <>
                          <span className="text-[10px] font-semibold tracking-tight truncate">
                            {word.text}
                          </span>
                          {word.emoji && (
                            <span className="text-[10px] shrink-0">{word.emoji}</span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Right Trim Handle */}
                    {!trackState.captionsLocked && activeTool === 'select' && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectWord(word.id);
                          setDragState({
                            type: 'trim-right',
                            wordId: word.id,
                            initialStart: word.start,
                            initialEnd: word.end,
                            startClientX: e.clientX,
                          });
                        }}
                        className="w-1.5 h-full bg-transparent group-hover:bg-white/25 hover:!bg-amber-400 cursor-ew-resize shrink-0 z-10"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* 3. TRACK V1: MASTER VIDEO FILMSTRIP LAYER */}
            <div
              onMouseDown={(e) => {
                setDragState({ type: 'playhead' });
                onSeek(clientXToTime(e.clientX));
              }}
              className={`h-14 relative border-b border-neutral-800/90 p-1.5 cursor-pointer ${
                !trackState.videoVisible ? 'opacity-40' : ''
              }`}
            >
              <div className="w-full h-full rounded-sm bg-indigo-950/40 border border-indigo-500/40 overflow-hidden flex flex-col relative">
                {/* Video Clip Header Strip */}
                <div className="h-4 px-2 bg-indigo-500/30 border-b border-indigo-500/30 flex items-center justify-between text-[10px] font-mono text-indigo-200 shrink-0">
                  <span className="truncate font-semibold">
                    V1 · {clipTitle} ({aspectRatio})
                  </span>
                  <span className="text-indigo-300/80 tabular-nums">
                    00:00:00 – {formatSMPTE(safeDuration)}
                  </span>
                </div>

                {/* Simulated Filmstrip Cells */}
                <div className="flex-1 flex items-stretch divide-x divide-indigo-500/20 overflow-hidden">
                  {filmstripCells.map((cell) => (
                    <div
                      key={cell}
                      className="flex-1 bg-gradient-to-b from-slate-900 via-indigo-950/30 to-neutral-950 flex items-end justify-start p-1 relative overflow-hidden"
                    >
                      <div className="w-3 h-3 rounded-full bg-indigo-400/10 blur-sm absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      <span className="text-[8px] font-mono text-indigo-400/50 tabular-nums">
                        {((cell / filmstripCells.length) * safeDuration).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. TRACK A1: STUDIO WAVEFORM LAYER */}
            <div
              onMouseDown={(e) => {
                setDragState({ type: 'playhead' });
                onSeek(clientXToTime(e.clientX));
              }}
              className="h-16 relative p-1.5 cursor-pointer"
            >
              <div className="w-full h-full rounded-sm bg-sky-950/25 border border-sky-500/35 overflow-hidden flex flex-col relative">
                {/* Audio Clip Header Strip */}
                <div className="h-4 px-2 bg-sky-500/20 border-b border-sky-500/25 flex items-center justify-between text-[10px] font-mono text-sky-200 shrink-0 z-10">
                  <span className="truncate font-semibold">
                    A1 · Voiceover_Master.wav {isMuted ? '(MUTED)' : ''}
                  </span>
                  <span className="text-sky-300/80 tabular-nums">0.0 dB</span>
                </div>

                {/* Mirrored Waveform Canvas */}
                <div className="flex-1 relative">
                  <canvas
                    ref={canvasRef}
                    width={1800}
                    height={46}
                    className="w-full h-full block pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* 5. MASTER NLE PLAYHEAD CURSOR */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
              style={{
                left: `${progressPercent}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {/* Playhead Cap */}
              <div className="w-3 h-3.5 bg-amber-400 clip-path-polygon shadow-sm flex items-center justify-center rounded-t-xs">
                <div className="w-0.5 h-2 bg-neutral-950/60" />
              </div>
              {/* Playhead Vertical Line */}
              <div className="w-[1.5px] flex-1 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.75)]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
