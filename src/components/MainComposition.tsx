import React, { useState } from 'react';
import { AbsoluteFill, Video, Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionOverlay } from './CaptionOverlay';
import { AspectRatioMode, CaptionStyle, VideoFitMode, WordCaption } from '../types/caption';

export interface MainCompositionProps {
  videoUrl: string;
  audioUrl?: string;
  words: WordCaption[];
  style: CaptionStyle;
  showSafeZoneOverlay?: boolean;
  showGridGuides?: boolean;
  aspectRatio?: AspectRatioMode;
  videoFit?: VideoFitMode;
  captionsVisible?: boolean;
  videoVisible?: boolean;
  currentTimeProp?: number;
  isMuted?: boolean;
}

export const MainComposition: React.FC<MainCompositionProps> = ({
  videoUrl,
  audioUrl,
  words,
  style,
  showSafeZoneOverlay = false,
  showGridGuides = false,
  aspectRatio = '9:16',
  videoFit = 'cover',
  captionsVisible = true,
  videoVisible = true,
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

  React.useEffect(() => {
    setHasVideoError(false);
  }, [videoUrl]);

  return (
    <AbsoluteFill className="bg-neutral-950 flex items-center justify-center overflow-hidden">
      {/* V1 Video Layer */}
      {videoVisible ? (
        videoUrl && !hasVideoError ? (
          <Video
            src={videoUrl}
            className={`w-full h-full ${videoFit === 'contain' ? 'object-contain' : 'object-cover'}`}
            playsInline
            muted={isMuted || Boolean(audioUrl)}
            volume={isMuted ? 0 : 1}
            onError={(err) => {
              console.warn('Remotion Video playback handled gracefully:', err);
              setHasVideoError(true);
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-950 via-slate-900 to-neutral-950 flex flex-col items-center justify-center p-8 text-center text-neutral-400 relative overflow-hidden">
            <div className="absolute w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
            <div className="absolute w-64 h-64 rounded-full bg-amber-500/10 blur-2xl pointer-events-none translate-y-12" />
            <div className="relative z-10 space-y-2">
              <p className="text-xl font-bold tracking-tight text-neutral-200">
                Program Monitor ({aspectRatio})
              </p>
              <p className="text-sm font-mono text-neutral-500">
                V1 Video Track · Audio & Subtitle Sync Active
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="w-full h-full bg-neutral-950 flex items-center justify-center">
          <span className="text-lg font-mono text-neutral-700 uppercase tracking-widest">
            V1 Track Hidden
          </span>
        </div>
      )}

      {/* A1 Voiceover Audio Track */}
      {audioUrl && !isMuted && (
        <Audio
          src={audioUrl}
          volume={1}
          onError={(err) => {
            console.warn('Audio playback handled gracefully:', err);
          }}
        />
      )}

      {/* T1 Dynamic Animated Captions Overlay */}
      <CaptionOverlay
        words={words}
        currentTime={currentTime}
        style={style}
        showSafeZoneOverlay={showSafeZoneOverlay}
        showGridGuides={showGridGuides}
        aspectRatio={aspectRatio}
        captionsVisible={captionsVisible}
      />
    </AbsoluteFill>
  );
};
