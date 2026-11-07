import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MainComposition } from './components/MainComposition';
import { ControlPanel } from './components/ControlPanel';
import { AudioTimelineTrack } from './components/AudioTimelineTrack';
import { PRESET_CONFIGS, SAMPLE_VIDEOS } from './services/presets';
import { CaptionStyle, WordCaption, RenderProgress } from './types/caption';
import { extractWaveformFromMedia, WaveformData } from './services/audioWaveform';
import { autoTranscribeMedia } from './services/transcriptionRouter';
import { createVoiceoverAudioForSample } from './services/sampleVoiceover';
import { getReliableSampleVideoUrl } from './services/sampleVideoGenerator';
import { exportVideoClientSide } from './services/videoExporter';
import { formatAndEnhanceWords } from './services/groq';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Download,
  Smartphone,
  Shield,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Volume2,
  VolumeX,
  Mic,
  Music,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  // State
  const [currentSampleIndex, setCurrentSampleIndex] = useState<number>(0);
  const currentSample = SAMPLE_VIDEOS[currentSampleIndex];

  const [videoUrl, setVideoUrl] = useState<string>(currentSample.videoUrl);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [videoDuration, setVideoDuration] = useState<number>(currentSample.duration);
  const [words, setWords] = useState<WordCaption[]>(currentSample.words);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [style, setStyle] = useState<CaptionStyle>(PRESET_CONFIGS.hormozi);

  // Audio Waveform Data
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState<boolean>(false);

  // Groq API Key
  const [groqApiKey, setGroqApiKey] = useState<string>(() => {
    return localStorage.getItem('groq_whisper_api_key') || '';
  });

  // Current media file (if user uploaded a custom file)
  const [currentUploadedFile, setCurrentUploadedFile] = useState<File | null>(null);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('');
  const [transcriptionSource, setTranscriptionSource] = useState<'groq' | 'gemini' | 'browser' | 'sample'>('sample');

  // Render & Export state
  const [renderProgress, setRenderProgress] = useState<RenderProgress>({
    isRendering: false,
    progress: 0,
    statusText: '',
    downloadUrl: null,
  });

  // Remotion Player Ref
  const playerRef = useRef<PlayerRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Sample Waveform & Synced Voiceover on first load
  useEffect(() => {
    let isCancelled = false;

    const setupSample = async () => {
      setIsLoadingWaveform(true);
      try {
        // Generate reliable 9:16 vertical video for sample to avoid CDN CORS Code 4 errors
        const themeColor =
          currentSampleIndex === 0 ? '#10B981' : currentSampleIndex === 1 ? '#F59E0B' : '#6366F1';
        const reliableVideo = await getReliableSampleVideoUrl(
          currentSample.id,
          currentSample.duration,
          themeColor
        );

        if (!isCancelled && reliableVideo) {
          setVideoUrl(reliableVideo);
        }

        // Generate synchronized sample voiceover audio so audio matches captions 100%
        const sampleVoiceUri = await createVoiceoverAudioForSample(
          currentSample.words,
          currentSample.duration
        );

        if (isCancelled) return;
        setAudioUrl(sampleVoiceUri);

        // Extract waveform from the synthesized voiceover audio
        const waveform = await extractWaveformFromMedia(sampleVoiceUri, 200);
        if (!isCancelled) {
          setWaveformData(waveform);
        }
      } catch (err) {
        console.warn('Sample setup error:', err);
      } finally {
        if (!isCancelled) setIsLoadingWaveform(false);
      }
    };

    setupSample();

    return () => {
      isCancelled = true;
    };
  }, [currentSampleIndex]);

  // Persist Groq key to localStorage
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
      const time = frame / 30;
      setCurrentTime(time);
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
  }, [playerRef.current]);

  // Play/Pause toggle
  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;

    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  };

  // Seek helper
  const handleSeek = useCallback((timeInSeconds: number) => {
    const player = playerRef.current;
    const clampedTime = Math.max(0, Math.min(videoDuration, timeInSeconds));
    setCurrentTime(clampedTime);
    if (player) {
      player.seekTo(Math.round(clampedTime * 30));
    }
  }, [videoDuration]);

  // Step frame (-0.1s or +0.1s)
  const stepFrame = (delta: number) => {
    handleSeek(currentTime + delta);
  };

  // Switch to built-in sample
  const handleSelectSample = async (index: number) => {
    const sample = SAMPLE_VIDEOS[index];
    if (!sample) return;

    setCurrentSampleIndex(index);
    const themeColor = index === 0 ? '#10B981' : index === 1 ? '#F59E0B' : '#6366F1';
    const reliableVideo = await getReliableSampleVideoUrl(sample.id, sample.duration, themeColor);
    setVideoUrl(reliableVideo || sample.videoUrl);
    setVideoDuration(sample.duration);
    setWords(sample.words);
    setCurrentUploadedFile(null);
    setTranscriptionSource('sample');
    setTranscriptionStatus(`Loaded demo clip: "${sample.title}" with synchronized voiceover track`);
    handleSeek(0);
  };

  // Auto add viral emojis
  const handleAutoAddEmojis = () => {
    setWords((prev) =>
      formatAndEnhanceWords(prev.map((w) => ({ word: w.text, start: w.start, end: w.end })))
    );
  };

  // Handle File Upload & Automated Audio Transcription
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTranscriptionError(null);
    setCurrentUploadedFile(file);
    const localVideoUrl = URL.createObjectURL(file);
    setVideoUrl(localVideoUrl);
    setAudioUrl(undefined); // use file's own audio track

    // Measure video duration
    const tempVideo = document.createElement('video');
    tempVideo.src = localVideoUrl;
    tempVideo.onloadedmetadata = () => {
      const dur = tempVideo.duration || 15;
      setVideoDuration(dur);
    };

    // 1. Extract Real Audio Waveform from user's video file
    setIsLoadingWaveform(true);
    try {
      const waveform = await extractWaveformFromMedia(file, 220);
      setWaveformData(waveform);
    } catch (waveErr) {
      console.warn('Failed to extract waveform:', waveErr);
    } finally {
      setIsLoadingWaveform(false);
    }

    // 2. Perform Automatic Speech Transcription (Groq or Gemini AI)
    setIsTranscribing(true);
    try {
      const result = await autoTranscribeMedia(file, groqApiKey, (status) => {
        setTranscriptionStatus(status);
      });

      if (result.words && result.words.length > 0) {
        setWords(result.words);
        setTranscriptionSource(result.source);
        const sourceName =
          result.source === 'groq'
            ? 'Groq Whisper Large v3'
            : result.source === 'gemini'
            ? 'Gemini AI Voice Model'
            : 'Speech Waveform Aligner';
        setTranscriptionStatus(
          `Success: Transcribed ${result.words.length} words with audio sync via ${sourceName}!`
        );
      } else {
        setTranscriptionError('No voice speech detected in uploaded video.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transcription failed';
      setTranscriptionError(msg);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Retranscribe uploaded file if user just added an API key
  const handleRetranscribe = async () => {
    if (!currentUploadedFile) return;
    setIsTranscribing(true);
    setTranscriptionError(null);
    try {
      const result = await autoTranscribeMedia(currentUploadedFile, groqApiKey, (s) => {
        setTranscriptionStatus(s);
      });
      if (result.words && result.words.length > 0) {
        setWords(result.words);
        setTranscriptionSource(result.source);
        setTranscriptionStatus(`Updated transcription (${result.words.length} words via ${result.source})!`);
      }
    } catch (err: unknown) {
      setTranscriptionError(err instanceof Error ? err.message : 'Re-transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Client-Side Video Export
  const handleExport = async () => {
    try {
      setRenderProgress({
        isRendering: true,
        progress: 0,
        statusText: 'Initializing client-side renderer...',
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
        }
      );

      const downloadUrl = URL.createObjectURL(blob);
      setRenderProgress((prev) => ({
        ...prev,
        isRendering: false,
        progress: 100,
        statusText: 'Render completed successfully!',
        downloadUrl,
      }));

      // Trigger automatic file download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `captioned-short-${Date.now()}.mp4`;
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

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = (secs % 60).toFixed(2);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.padStart(5, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* 1. TOP BAR */}
      <header className="flex items-center justify-between gap-8 px-6 py-3 bg-neutral-900 border-b border-neutral-800 shrink-0 z-20">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-neutral-950 font-black shadow-md">
            🎬
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold tracking-tight text-neutral-100">
              Auto-Caption Studio
            </span>
            <span className="text-[10px] text-neutral-400 font-medium hidden sm:inline">
              Remotion + Audio Waveform
            </span>
          </div>
        </div>

        {/* Center Indicators */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
          <button
            onClick={() => setStyle({ ...style, showSafeZones: !style.showSafeZones })}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              style.showSafeZones ? 'text-amber-400 font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Safe Zones: {style.showSafeZones ? 'On' : 'Off'}
          </button>

          <span className="flex items-center gap-1.5 text-neutral-300 whitespace-nowrap shrink-0">
            <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
            9:16 Vertical
          </span>

          <span className="flex items-center gap-1 text-sky-400 whitespace-nowrap shrink-0 font-medium">
            <Music className="w-3.5 h-3.5" />
            Audio Synced ({words.length} words)
          </span>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="video/*,audio/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-750 hover:text-neutral-100 rounded-lg border border-neutral-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            Upload Video With Voice
          </button>

          <button
            onClick={handleExport}
            disabled={renderProgress.isRendering}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {renderProgress.isRendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering {renderProgress.progress}%
              </>
            ) : (
              <>
                <Download className="w-4 h-4 stroke-[2.5]" />
                Export MP4
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* LEFT / CENTER STAGE */}
        <main className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative">
          {/* Sample Selector Bar */}
          <div className="flex items-center justify-between px-6 py-2 border-b border-neutral-850 bg-neutral-900/50 text-xs shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              <span className="text-neutral-500 font-medium whitespace-nowrap mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Sample Clips (With Audio Voiceover):
              </span>
              {SAMPLE_VIDEOS.map((sample, idx) => (
                <button
                  key={sample.id}
                  onClick={() => handleSelectSample(idx)}
                  className={`px-3 py-1 rounded-md transition-all font-medium whitespace-nowrap flex items-center gap-1.5 ${
                    currentSampleIndex === idx && !currentUploadedFile
                      ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40 shadow-sm'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  }`}
                >
                  <Mic className="w-3 h-3 text-sky-400" />
                  {sample.title}
                </button>
              ))}
            </div>

            {currentUploadedFile && (
              <button
                onClick={handleRetranscribe}
                disabled={isTranscribing}
                className="flex items-center gap-1 text-[11px] text-amber-300 bg-neutral-800 hover:bg-neutral-750 px-2 py-0.5 rounded border border-neutral-700 whitespace-nowrap"
                title="Re-run audio transcription"
              >
                <RefreshCw className={`w-3 h-3 ${isTranscribing ? 'animate-spin' : ''}`} />
                Re-sync Audio
              </button>
            )}
          </div>

          {/* Active Audio Status & Transcription Banner */}
          {(isTranscribing || transcriptionStatus || transcriptionError) && (
            <div className="px-6 py-2 bg-neutral-900/95 border-b border-neutral-800 flex items-center justify-between text-xs shrink-0 shadow-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                {isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                ) : transcriptionError ? (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span
                  className={`truncate ${
                    transcriptionError
                      ? 'text-red-300'
                      : isTranscribing
                      ? 'text-amber-300'
                      : 'text-neutral-300'
                  }`}
                >
                  {transcriptionError || transcriptionStatus}
                </span>
              </div>

              {transcriptionStatus && !isTranscribing && (
                <button
                  onClick={() => setTranscriptionStatus('')}
                  className="text-neutral-500 hover:text-neutral-300 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Center Stage: 9:16 Video Player Container */}
          <div className="flex-1 flex items-center justify-center p-3 min-h-0 relative bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Phone Bezel Frame */}
            <div
              className="relative aspect-[9/16] h-full max-h-[500px] bg-black rounded-[28px] overflow-hidden shadow-2xl border-4 border-neutral-800 ring-1 ring-neutral-700/50 flex flex-col justify-center items-center select-none"
              style={{ width: 'auto' }}
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-neutral-900 rounded-full z-30 pointer-events-none" />

              {/* Remotion Player Preview */}
              <Player
                ref={playerRef}
                component={MainComposition}
                inputProps={{
                  videoUrl,
                  audioUrl,
                  words,
                  style,
                  showSafeZoneOverlay: style.showSafeZones,
                  isMuted,
                }}
                durationInFrames={durationInFrames}
                compositionWidth={1080}
                compositionHeight={1920}
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

              {/* Click-to-Play Overlay */}
              <button
                onClick={togglePlay}
                className="absolute inset-0 z-20 flex items-center justify-center group focus:outline-none"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {!isPlaying && (
                  <div className="w-16 h-16 rounded-full bg-neutral-900/85 border border-neutral-700 text-amber-400 flex items-center justify-center shadow-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
                    <Play className="w-7 h-7 fill-amber-400 translate-x-0.5" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Quick Playback Bar (Above Audio Track) */}
          <div className="px-4 py-1.5 bg-neutral-900/90 border-t border-neutral-850 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-lg bg-amber-400 text-neutral-950 hover:bg-amber-300 flex items-center justify-center font-bold shadow-sm transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-neutral-950" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-neutral-950 translate-x-0.5" />
                )}
              </button>

              <button
                onClick={() => handleSeek(0)}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
                title="Reset to start"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center border border-neutral-800 rounded-lg overflow-hidden bg-neutral-950">
                <button
                  onClick={() => stepFrame(-0.1)}
                  className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
                  title="-0.1s"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => stepFrame(0.1)}
                  className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850 border-l border-neutral-800"
                  title="+0.1s"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isMuted
                    ? 'border-red-500/40 text-red-400 bg-red-500/10'
                    : 'border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Time code counter */}
            <div className="font-mono text-xs text-neutral-300 tabular-nums flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
              <span className="text-amber-400 font-semibold">{formatTime(currentTime)}</span>
              <span className="text-neutral-600">/</span>
              <span className="text-neutral-400">{formatTime(videoDuration)}</span>
            </div>
          </div>

          {/* 3. PROFESSIONAL AUDIO TIMELINE TRACK WITH REAL WAVEFORM */}
          <AudioTimelineTrack
            duration={videoDuration}
            currentTime={currentTime}
            words={words}
            waveformData={waveformData}
            onSeek={handleSeek}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
          />
        </main>

        {/* RIGHT: Control Panel Sidebar */}
        <ControlPanel
          style={style}
          onStyleChange={setStyle}
          words={words}
          onWordsChange={setWords}
          currentTime={currentTime}
          onSeek={handleSeek}
          groqApiKey={groqApiKey}
          onGroqApiKeyChange={handleApiKeyChange}
          onAutoAddEmojis={handleAutoAddEmojis}
          isTranscribing={isTranscribing}
        />
      </div>

      {/* Render / Export Progress Modal */}
      {(renderProgress.isRendering || renderProgress.downloadUrl || renderProgress.error) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-400/10 text-amber-400 mx-auto flex items-center justify-center">
              {renderProgress.isRendering ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : renderProgress.error ? (
                <AlertCircle className="w-6 h-6 text-red-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-neutral-100">
                {renderProgress.isRendering
                  ? 'Rendering Captioned Video...'
                  : renderProgress.error
                  ? 'Export Error'
                  : 'Video Ready for Download!'}
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                {renderProgress.statusText}
              </p>
            </div>

            {renderProgress.isRendering && (
              <div className="space-y-1.5">
                <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className="bg-amber-400 h-full transition-all duration-150"
                    style={{ width: `${renderProgress.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                  <span>Client-Side Canvas + Audio Sync</span>
                  <span className="text-amber-400 font-bold">
                    {renderProgress.progress}%
                  </span>
                </div>
              </div>
            )}

            {renderProgress.error && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-xs text-red-300 text-left">
                {renderProgress.error}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              {renderProgress.downloadUrl && (
                <a
                  href={renderProgress.downloadUrl}
                  download={`captioned-video-${Date.now()}.mp4`}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  Download Again
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
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-colors"
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
