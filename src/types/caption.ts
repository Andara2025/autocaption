export interface WordCaption {
  id: string;
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
  confidence?: number;
  highlight?: boolean;
  emoji?: string;
  customColor?: string;
}

export interface CaptionSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordCaption[];
}

export type AspectRatioMode = '9:16' | '16:9';

export type VideoFitMode = 'cover' | 'contain';

export type TimelineTool = 'select' | 'razor';

export interface TrackVisibilityState {
  captionsVisible: boolean;
  captionsLocked: boolean;
  videoVisible: boolean;
  videoLocked: boolean;
  audioMuted: boolean;
  audioLocked: boolean;
}

export type PresetTheme = 
  | 'hormozi'
  | 'mrbeast'
  | 'neon'
  | 'karaoke'
  | 'minimal'
  | 'comic'
  | 'cyberpunk';

export type CaptionFont = 
  | 'Montserrat'
  | 'Anton'
  | 'Bangers'
  | 'Bungee'
  | 'Plus Jakarta Sans'
  | 'Syne'
  | 'Titan One';

export type AnimationType = 
  | 'spring-pop'
  | 'bounce'
  | 'fade-slide'
  | 'scale-pulse'
  | 'glow'
  | 'none';

export type ActiveWordEffect = 
  | 'scale'
  | 'color'
  | 'box'
  | 'underline'
  | 'badge';

export interface CaptionStyle {
  preset: PresetTheme;
  fontFamily: CaptionFont;
  fontSize: number;          // relative size (e.g., 36-64)
  fontWeight: number;        // e.g. 700, 800, 900
  textColor: string;         // inactive / base text color
  highlightColor: string;    // active word text color
  activeBgColor: string;     // active word background box color
  strokeColor: string;       // outline stroke color
  strokeWidth: number;       // 0 to 6
  hasShadow: boolean;
  shadowColor: string;
  textTransform: 'uppercase' | 'capitalize' | 'none';
  positionY: number;         // percentage from top: e.g. 72%
  positionX: number;         // percentage from left: e.g. 50%
  wordsPerChunk: number;     // 1, 2, 3, 4, or 0 for dynamic sentence chunking
  animationType: AnimationType;
  activeEffect: ActiveWordEffect;
  activeScale: number;       // e.g. 1.2
  showEmojis: boolean;
  showSafeZones: boolean;
  showGridGuides?: boolean;
}

export interface VideoMetadata {
  url: string;
  name: string;
  duration: number; // in seconds
  width: number;
  height: number;
  aspectRatio: number; // e.g. 9/16
}

export interface RenderProgress {
  isRendering: boolean;
  progress: number; // 0 to 100
  statusText: string;
  downloadUrl: string | null;
  error?: string;
}
