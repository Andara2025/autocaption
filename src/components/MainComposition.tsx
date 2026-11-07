import React, { useState } from 'react';
import { AbsoluteFill, Video, Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionOverlay } from './CaptionOverlay';
import { CaptionStyle, WordCaption } from '../types/caption';

export interface MainCompositionProps {
  videoUrl: string;
  audioUrl?: string;
  words: WordCaption[];
  style: CaptionStyle;
  showSafeZoneOverlay?: boolean;
  currentTimeProp?: number;
  isMuted?: boolean;
}

export const MainComposition: React.FC<MainCompositionProps> = ({
  videoUrl,
  audioUrl,
  words,
  style,
  showSafeZoneOverlay = false,
  currentTimeProp,
  isMuted = false,
}) => {
  const [hasVideoError, setHasVideoError] = useState(false);
  let currentTime = currentTimeProp ?? 0;

  try {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    if (currentTimeProp === undefined) {
      currentTime = frame / fps;
    }
  } catch {
    currentTime = currentTimeProp ?? 0;
  }

  // If videoUrl changes, reset error state
  React.useEffect(() => {
    setHasVideoError(false);
  }, [videoUrl]);

  return (
    <AbsoluteFill className="bg-black flex items-center justify-center overflow-hidden">
      {/* Background Video Element or Resilient Fallback */}
      {videoUrl && !hasVideoError ? (
        <Video
          src={videoUrl}
          className="w-full h-full object-cover"
          playsInline
          muted={isMuted || Boolean(audioUrl)}
          volume={isMuted ? 0 : 1}
          onError={(err) => {
            console.warn('Remotion Video playback handled gracefully:', err);
            setHasVideoError(true);
          }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-slate-900 flex flex-col items-center justify-center p-8 text-center text-neutral-400 relative overflow-hidden">
          {/* Ambient studio stage glow */}
          <div className="absolute w-72 h-72 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
          <div className="absolute w-48 h-48 rounded-full bg-amber-500/10 blur-2xl pointer-events-none translate-y-16" />
          <div className="relative z-10 space-y-1">
            <span className="text-2xl">🎬</span>
            <p className="text-sm font-semibold text-neutral-200">Short-Form Studio Stage</p>
            <p className="text-[11px] text-neutral-500">Audio & Captions Synchronized</p>
          </div>
        </div>
      )}

      {/* Voiceover Audio Track */}
      {audioUrl && !isMuted && (
        <Audio
          src={audioUrl}
          volume={1}
          onError={(err) => {
            console.warn('Audio playback handled gracefully:', err);
          }}
        />
      )}

      {/* Dynamic Animated Captions Overlay */}
      <CaptionOverlay
        words={words}
        currentTime={currentTime}
        style={style}
        showSafeZoneOverlay={showSafeZoneOverlay}
      />
    </AbsoluteFill>
  );
};
