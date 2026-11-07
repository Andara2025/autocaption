import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MainComposition } from './components/MainComposition';
import { ControlPanel } from './components/ControlPanel';
import { AudioTimelineTrack } from './components/AudioTimelineTrack';
import { PRESET_CONFIGS } from './services/presets';
import {
  AspectRatioMode,
  CaptionStyle,
  RenderProgress,
  TrackVisibilityState,
  VideoFitMode,
  WordCaption,
} from './types/caption';
import { extractWaveformFromMedia, WaveformData } from './services/audioWaveform';
import { autoTranscribeMedia } from './services/transcriptionRouter';
import { exportVideoClientSide } from './services/videoExporter';
import { formatAndEnhanceWords } from './services/groq';
import {
  Upload,
  Download,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Volume2,
  VolumeX,
  Film,
  RefreshCw,
  Grid,
  FolderOpen,
  Trash2,
} from 'lucide-react';

interface ImportedMediaItem {
  id: string;
  file: File;
  url: string;
  duration: number;
  aspectRatio: AspectRatioMode;
  words: WordCaption[];
  waveformData: WaveformData | null;
}

export default function App() {
  // Sequence & Canvas State (No Demo Captions or Demo Videos)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('9:16');
  const [videoFit, setVideoFit] = useState<VideoFitMode>('cover');
  const [canvasZoom, setCanvasZoom] = useState<'fit' | '75' | '100'>('fit');
  const [showMediaBin, setShowMediaBin] = useState<boolean>(true);

  const [mediaBin, setMediaBin] = useState<ImportedMediaItem[]>([]);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [videoDuration, setVideoDuration] = useState<number>(15);
  const [words, setWords] = useState<WordCaption[]>([]);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [style, setStyle] = useState<CaptionStyle>({
    ...PRESET_CONFIGS.hormozi,
    showSafeZones: false,
    showGridGuides: false,
  });

  // Track Visibility & Lock State
  const [trackState, setTrackState] = useState<TrackVisibilityState>({
    captionsVisible: true,
    captionsLocked: false,
    videoVisible: true,
    videoLocked: false,
    audioMuted: false,
    audioLocked: false,
  });

  // Audio Waveform Data
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);

  // Groq API Key
  const [groqApiKey, setGroqApiKey] = useState<string>(() => {
    return localStorage.getItem('groq_whisper_api_key') || '';
  });

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('');

  // Render & Export state
  const [renderProgress, setRenderProgress] = useState<RenderProgress>({
    isRendering: false,
    progress: 0,
    statusText: '',
    downloadUrl: null,
  });

  // Refs
  const playerRef = useRef<PlayerRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMedia = mediaBin.find((m) => m.id === activeMediaId) || null;

  // Keep active media item words synced when user edits words on timeline/inspector
  const handleWordsChange = useCallback(
    (nextWords: WordCaption[]) => {
      setWords(nextWords);
      if (activeMediaId) {
        setMediaBin((prev) =>
          prev.map((item) => (item.id === activeMediaId ? { ...item, words: nextWords } : item))
        );
      }
    },
    [activeMediaId]
  );

  // Persist Groq key
  const handleApiKeyChange = (key: string) => {
    setGroqApiKey(key);
    localStorage.setItem('groq_whisper_api_key', key);
  };

  // Sync Remotion Player frame with currentTime state
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = () => {
      const frame = player.getCurrentFrame();
      setCurrentTime(frame / 30);
    };

    const onPlayState = () => {
      setIsPlaying(player.isPlaying());
    };

    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('play', onPlayState);
    player.addEventListener('pause', onPlayState);

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('play', onPlayState);
      player.removeEventListener('pause', onPlayState);
    };
  }, [playerRef.current, aspectRatio]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  }, []);

  // Seek helper
  const handleSeek = useCallback(
    (timeInSeconds: number) => {
      const player = playerRef.current;
      const clampedTime = Math.max(0, Math.min(videoDuration, timeInSeconds));
      setCurrentTime(clampedTime);
      if (player) {
        player.seekTo(Math.round(clampedTime * 30));
      }
    },
    [videoDuration]
  );

  // Keyboard shortcuts for NLE playback & frame stepping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(currentTime - (e.shiftKey ? 1 : 1 / 30));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(currentTime + (e.shiftKey ? 1 : 1 / 30));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleSeek, currentTime]);

  // Switch aspect ratio
  const handleAspectRatioChange = (nextRatio: AspectRatioMode) => {
    setAspectRatio(nextRatio);
    setStyle((prev) => ({
      ...prev,
      positionY: nextRatio === '16:9' && prev.positionY < 75 ? 82 : prev.positionY,
    }));
  };

  // Switch active clip from Media Bin
  const handleSelectMediaItem = (item: ImportedMediaItem) => {
    setActiveMediaId(item.id);
    setVideoUrl(item.url);
    setAudioUrl(undefined);
    setVideoDuration(item.duration);
    setWords(item.words);
    setWaveformData(item.waveformData);
    setAspectRatio(item.aspectRatio);
    setSelectedWordId(null);
    handleSeek(0);
  };

  // Remove item from Media Bin
  const handleDeleteMediaItem = (id: string) => {
    const remaining = mediaBin.filter((m) => m.id !== id);
    setMediaBin(remaining);
    if (activeMediaId === id) {
      if (remaining.length > 0) {
        handleSelectMediaItem(remaining[0]);
      } else {
        setActiveMediaId(null);
        setVideoUrl('');
        setAudioUrl(undefined);
        setVideoDuration(15);
        setWords([]);
        setWaveformData(null);
        setSelectedWordId(null);
        handleSeek(0);
      }
    }
  };

  // Auto add contextual emojis
  const handleAutoAddEmojis = () => {
    if (words.length === 0) return;
    const enhanced = formatAndEnhanceWords(
      words.map((w) => ({ word: w.text, start: w.start, end: w.end }))
    );
    handleWordsChange(enhanced);
  };

  // Handle File Upload & Automated Audio Transcription
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const itemId = `media-${Date.now()}`;
    const localVideoUrl = URL.createObjectURL(file);

    setTranscriptionError(null);
    setActiveMediaId(itemId);
    setVideoUrl(localVideoUrl);
    setAudioUrl(undefined);
    setWords([]);
    setSelectedWordId(null);
    handleSeek(0);

    let detectedDuration = 15;
    let detectedAspect: AspectRatioMode = aspectRatio;

    // Measure video dimensions & duration to auto-detect 16:9 vs 9:16
    await new Promise<void>((resolve) => {
      const tempVideo = document.createElement('video');
      tempVideo.src = localVideoUrl;
      tempVideo.onloadedmetadata = () => {
        detectedDuration = tempVideo.duration || 15;
        setVideoDuration(detectedDuration);
        if (tempVideo.videoWidth && tempVideo.videoHeight) {
          detectedAspect = tempVideo.videoWidth > tempVideo.videoHeight ? '16:9' : '9:16';
          handleAspectRatioChange(detectedAspect);
        }
        resolve();
      };
      tempVideo.onerror = () => resolve();
    });

    let extractedWave: WaveformData | null = null;
    try {
      extractedWave = await extractWaveformFromMedia(file, 240);
      setWaveformData(extractedWave);
    } catch (waveErr) {
      console.warn('Failed to extract waveform:', waveErr);
    }

    const newMediaItem: ImportedMediaItem = {
      id: itemId,
      file,
      url: localVideoUrl,
      duration: detectedDuration,
      aspectRatio: detectedAspect,
      words: [],
      waveformData: extractedWave,
    };

    setMediaBin((prev) => [newMediaItem, ...prev]);

    setIsTranscribing(true);
    try {
      const result = await autoTranscribeMedia(file, groqApiKey, (status) => {
        setTranscriptionStatus(status);
      });

      if (result.words && result.words.length > 0) {
        setWords(result.words);
        setMediaBin((prev) =>
          prev.map((m) => (m.id === itemId ? { ...m, words: result.words } : m))
        );
        const sourceName =
          result.source === 'groq'
            ? 'Groq Whisper Large v3'
            : result.source === 'gemini'
            ? 'Gemini Audio ASR'
            : 'Waveform Speech Aligner';
        setTranscriptionStatus(
          `Synced ${result.words.length} subtitle clips via ${sourceName}.`
        );
      } else {
        setTranscriptionError('No speech detected in uploaded media.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transcription failed';
      setTranscriptionError(msg);
    } finally {
      setIsTranscribing(false);
      if (event.target) event.target.value = '';
    }
  };

  // Retranscribe active uploaded file
  const handleRetranscribe = async () => {
    if (!activeMedia) return;
    setIsTranscribing(true);
    setTranscriptionError(null);
    try {
      const result = await autoTranscribeMedia(activeMedia.file, groqApiKey, (s) => {
        setTranscriptionStatus(s);
      });
      if (result.words && result.words.length > 0) {
        handleWordsChange(result.words);
        setTranscriptionStatus(`Updated ${result.words.length} subtitle clips.`);
      }
    } catch (err: unknown) {
      setTranscriptionError(err instanceof Error ? err.message : 'Re-transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Client-Side Video Export
  const handleExport = async () => {
    if (!videoUrl) return;
    try {
      setRenderProgress({
        isRendering: true,
        progress: 0,
        statusText: `Initializing ${aspectRatio} client-side renderer...`,
        downloadUrl: null,
      });

      const blob = await exportVideoClientSide(
        videoUrl,
        words,
        style,
        videoDuration,
        (progress, statusText) => {
          setRenderProgress((prev) => ({
            ...prev,
            progress,
            statusText,
          }));
        },
        aspectRatio,
        videoFit
      );

      const downloadUrl = URL.createObjectURL(blob);
      setRenderProgress((prev) => ({
        ...prev,
        isRendering: false,
        progress: 100,
        statusText: 'Sequence render completed.',
        downloadUrl,
      }));

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `sequence-${aspectRatio.replace(':', 'x')}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Render failed';
      setRenderProgress((prev) => ({
        ...prev,
        isRendering: false,
        statusText: 'Export error',
        error: msg,
      }));
    }
  };

  const durationInFrames = Math.max(30, Math.round(videoDuration * 30));
  const compWidth = aspectRatio === '16:9' ? 1920 : 1080;
  const compHeight = aspectRatio === '16:9' ? 1080 : 1920;
  const activeClipTitle = activeMedia ? activeMedia.file.name : null;

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* 1. TOP BAR CONTRACT (3 Zones: Wordmark — Concise Nav Links — 1 Primary Action) */}
      <header className="flex items-center justify-between gap-8 px-5 py-2.5 bg-neutral-900 border-b border-neutral-800 shrink-0 z-20">
        <a
          href="#workspace"
          onClick={(e) => e.preventDefault()}
          className="text-base font-extrabold tracking-tight text-neutral-100 whitespace-nowrap shrink-0"
        >
          Auto-Caption Studio
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
          <button
            onClick={() => setShowMediaBin(!showMediaBin)}
            className={`hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0 ${
              showMediaBin ? 'text-neutral-100 underline underline-offset-4 decoration-amber-400' : ''
            }`}
          >
            Media Bin
          </button>
          <button
            onClick={() => handleAspectRatioChange('9:16')}
            className={`hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0 ${
              aspectRatio === '9:16' ? 'text-neutral-100 underline underline-offset-4 decoration-amber-400' : ''
            }`}
          >
            9:16 Canvas
          </button>
          <button
            onClick={() => handleAspectRatioChange('16:9')}
            className={`hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0 ${
              aspectRatio === '16:9' ? 'text-neutral-100 underline underline-offset-4 decoration-amber-400' : ''
            }`}
          >
            16:9 Canvas
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0"
          >
            Import Media
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="video/*,audio/*"
            className="hidden"
          />
          <button
            onClick={handleExport}
            disabled={renderProgress.isRendering || !videoUrl}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title={!videoUrl ? 'Import a video to export MP4' : 'Export sequence to MP4'}
          >
            {renderProgress.isRendering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Rendering {renderProgress.progress}%</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Export MP4</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. UPPER NLE WORKSPACE (PROJECT MEDIA BIN + PROGRAM MONITOR CANVAS + INSPECTOR) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT PANEL: Project Media Bin (No Demo Clips) */}
        {showMediaBin && (
          <aside className="hidden lg:flex w-64 xl:w-72 flex-col bg-neutral-900 border-r border-neutral-800 shrink-0 select-none">
            <div className="h-9 px-3.5 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs font-semibold text-neutral-300">
              <div className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Project Media</span>
              </div>
              <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                {mediaBin.length} {mediaBin.length === 1 ? 'clip' : 'clips'}
              </span>
            </div>

            <div className="p-3 border-b border-neutral-800 space-y-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 bg-neutral-950 hover:bg-neutral-800 border border-dashed border-neutral-700 hover:border-amber-400/60 rounded text-xs font-medium text-neutral-200 flex items-center justify-center gap-2 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Import Video / Audio</span>
              </button>

              {activeMedia && (
                <button
                  onClick={handleRetranscribe}
                  disabled={isTranscribing}
                  className="w-full py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 rounded text-[11px] font-medium text-amber-300 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isTranscribing ? 'animate-spin' : ''}`} />
                  <span>Re-Sync Speech to Audio</span>
                </button>
              )}
            </div>

            {/* Imported Media List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {mediaBin.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-500 space-y-2">
                  <Film className="w-6 h-6 text-neutral-700 stroke-[1.5]" />
                  <p className="text-xs text-neutral-400 font-medium">Media Bin Empty</p>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Import a video or audio file to populate timeline tracks and generate word-level subtitles.
                  </p>
                </div>
              ) : (
                mediaBin.map((item) => {
                  const isSelected = item.id === activeMediaId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectMediaItem(item)}
                      className={`p-2.5 rounded border transition-colors text-xs space-y-1 cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-amber-400 bg-neutral-800/90 text-neutral-100'
                          : 'border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold truncate">
                          <Film className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{item.file.name}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono tabular-nums flex items-center gap-1.5">
                          <span>{item.duration.toFixed(1)}s</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.words.length} words</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.aspectRatio}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMediaItem(item.id);
                        }}
                        className="p-1 text-neutral-500 hover:text-rose-400 rounded hover:bg-neutral-900 shrink-0"
                        title="Remove from project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* CENTER PANEL: NLE Program Monitor (Plain Solid Viewport Surround, No Dots, No Phone Mockup) */}
        <main className="flex-1 flex flex-col bg-neutral-950 min-w-0 min-h-0 relative">
          {/* Program Monitor Toolbar */}
          <div className="h-9 px-4 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between gap-4 text-xs shrink-0 select-none">
            <div className="flex items-center gap-2 min-w-0 text-neutral-300">
              <span className="font-semibold text-neutral-100 whitespace-nowrap">
                Program Monitor
              </span>
              <span className="text-neutral-600" aria-hidden="true">·</span>
              <span className="truncate text-neutral-400 max-w-[180px] sm:max-w-[260px]">
                {activeClipTitle || 'Untitled Sequence'}
              </span>
            </div>

            {/* Center: Aspect Ratio Switcher (9:16 vs 16:9) & Fit Mode */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5">
                <button
                  onClick={() => handleAspectRatioChange('9:16')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    aspectRatio === '9:16'
                      ? 'bg-amber-400 text-neutral-950'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="9:16 Vertical Canvas (1080×1920)"
                >
                  9:16
                </button>
                <button
                  onClick={() => handleAspectRatioChange('16:9')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    aspectRatio === '16:9'
                      ? 'bg-amber-400 text-neutral-950'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="16:9 Widescreen Canvas (1920×1080)"
                >
                  16:9
                </button>
              </div>

              <div className="hidden sm:flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5">
                <button
                  onClick={() => setVideoFit('cover')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    videoFit === 'cover'
                      ? 'bg-neutral-800 text-neutral-100'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="Scale video to fill canvas"
                >
                  Fill
                </button>
                <button
                  onClick={() => setVideoFit('contain')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    videoFit === 'contain'
                      ? 'bg-neutral-800 text-neutral-100'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="Fit full video inside canvas"
                >
                  Fit
                </button>
              </div>

              <select
                value={canvasZoom}
                onChange={(e) => setCanvasZoom(e.target.value as 'fit' | '75' | '100')}
                className="hidden md:block bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-[11px] font-mono text-neutral-300 focus:outline-none focus:border-amber-400"
                title="Canvas Viewport Zoom"
              >
                <option value="fit">Fit</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
              </select>
            </div>

            {/* Right: Safe Zones, Grid Guides, Audio Mute */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setStyle({ ...style, showGridGuides: !style.showGridGuides })}
                className={`p-1.5 rounded border transition-colors ${
                  style.showGridGuides
                    ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
                title="Toggle Rule of Thirds & Broadcast Grid"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setStyle({ ...style, showSafeZones: !style.showSafeZones })}
                className={`p-1.5 rounded border transition-colors ${
                  style.showSafeZones
                    ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
                title="Toggle Safe Zone Overlay"
              >
                <Shield className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-1.5 rounded border transition-colors ${
                  isMuted
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'
                }`}
                title={isMuted ? 'Unmute Monitor' : 'Mute Monitor'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Transcription / Sync Notification Strip */}
          {(isTranscribing || transcriptionStatus || transcriptionError) && (
            <div className="px-4 py-1.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between text-xs shrink-0 z-10">
              <div className="flex items-center gap-2 overflow-hidden">
                {isTranscribing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                ) : transcriptionError ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span
                  className={`truncate ${
                    transcriptionError
                      ? 'text-rose-300'
                      : isTranscribing
                      ? 'text-amber-300'
                      : 'text-neutral-300'
                  }`}
                >
                  {transcriptionError || transcriptionStatus}
                </span>
              </div>

              {!isTranscribing && (
                <button
                  onClick={() => {
                    setTranscriptionStatus('');
                    setTranscriptionError(null);
                  }}
                  className="text-neutral-500 hover:text-neutral-300 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Plain Solid Studio Canvas Viewport (NO Dots, NO Phone Mockup — Pure 9:16 or 16:9 NLE Canvas) */}
          <div className="flex-1 flex items-center justify-center p-4 sm:p-6 min-h-0 overflow-hidden relative bg-neutral-950">
            <div
              className={`relative bg-black shadow-2xl border border-neutral-800 overflow-hidden flex items-center justify-center select-none transition-all duration-150 ${
                aspectRatio === '9:16'
                  ? 'aspect-[9/16] h-full max-h-full w-auto'
                  : 'aspect-[16/9] w-full max-w-[820px] max-h-full h-auto'
              }`}
              style={
                canvasZoom === '75'
                  ? { transform: 'scale(0.85)' }
                  : canvasZoom === '100'
                  ? { transform: 'scale(1.06)' }
                  : undefined
              }
            >
              <Player
                key={aspectRatio}
                ref={playerRef}
                component={MainComposition}
                inputProps={{
                  videoUrl,
                  audioUrl,
                  words,
                  style,
                  showSafeZoneOverlay: style.showSafeZones,
                  showGridGuides: style.showGridGuides,
                  aspectRatio,
                  videoFit,
                  captionsVisible: trackState.captionsVisible,
                  videoVisible: trackState.videoVisible,
                  isMuted,
                }}
                durationInFrames={durationInFrames}
                compositionWidth={compWidth}
                compositionHeight={compHeight}
                fps={30}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                controls={false}
                autoPlay={false}
                loop={true}
                onError={(err: unknown) => {
                  console.warn('Remotion Player event handled gracefully:', err);
                }}
              />
            </div>
          </div>
        </main>

        {/* RIGHT PANEL: NLE Inspector & Subtitle Editor */}
        <ControlPanel
          style={style}
          onStyleChange={setStyle}
          words={words}
          onWordsChange={handleWordsChange}
          selectedWordId={selectedWordId}
          onSelectWord={setSelectedWordId}
          currentTime={currentTime}
          onSeek={handleSeek}
          groqApiKey={groqApiKey}
          onGroqApiKeyChange={handleApiKeyChange}
          onAutoAddEmojis={handleAutoAddEmojis}
          isTranscribing={isTranscribing}
          aspectRatio={aspectRatio}
          onAspectRatioChange={handleAspectRatioChange}
          videoFit={videoFit}
          onVideoFitChange={setVideoFit}
        />
      </div>

      {/* 3. FULL-WIDTH BOTTOM MULTI-TRACK NLE TIMELINE */}
      <AudioTimelineTrack
        duration={videoDuration}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        words={words}
        onWordsChange={handleWordsChange}
        selectedWordId={selectedWordId}
        onSelectWord={setSelectedWordId}
        waveformData={waveformData}
        onSeek={handleSeek}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        aspectRatio={aspectRatio}
        clipTitle={activeClipTitle}
        trackState={trackState}
        onTrackStateChange={setTrackState}
      />

      {/* Render / Export Progress Modal */}
      {(renderProgress.isRendering || renderProgress.downloadUrl || renderProgress.error) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-lg bg-amber-400/10 text-amber-400 mx-auto flex items-center justify-center">
              {renderProgress.isRendering ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : renderProgress.error ? (
                <AlertCircle className="w-6 h-6 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-neutral-100">
                {renderProgress.isRendering
                  ? `Rendering ${aspectRatio} Video Sequence...`
                  : renderProgress.error
                  ? 'Export Error'
                  : 'Sequence Ready for Download'}
              </h3>
              <p className="text-xs text-neutral-400 mt-1">{renderProgress.statusText}</p>
            </div>

            {renderProgress.isRendering && (
              <div className="space-y-1.5">
                <div className="w-full bg-neutral-950 h-2 rounded overflow-hidden border border-neutral-800">
                  <div
                    className="bg-amber-400 h-full transition-all duration-150"
                    style={{ width: `${renderProgress.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-neutral-400 tabular-nums">
                  <span>{aspectRatio} Canvas + Audio Sync</span>
                  <span className="text-amber-400 font-bold">{renderProgress.progress}%</span>
                </div>
              </div>
            )}

            {renderProgress.error && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded text-xs text-rose-300 text-left">
                {renderProgress.error}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              {renderProgress.downloadUrl && (
                <a
                  href={renderProgress.downloadUrl}
                  download={`sequence-${aspectRatio.replace(':', 'x')}-${Date.now()}.mp4`}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download MP4</span>
                </a>
              )}

              <button
                onClick={() =>
                  setRenderProgress({
                    isRendering: false,
                    progress: 0,
                    statusText: '',
                    downloadUrl: null,
                    error: undefined,
                  })
                }
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded border border-neutral-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
