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
    <AbsoluteFill className="bg-black flex items-center justify-center overflow-hidden">
      {/* V1 Video Layer */}
      {videoVisible && videoUrl && !hasVideoError && (
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
      )}

      {/* A1 Audio Track */}
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
