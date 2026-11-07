import React, { useState } from 'react';
import {
  AspectRatioMode,
  CaptionFont,
  CaptionStyle,
  PresetTheme,
  VideoFitMode,
  WordCaption,
} from '../types/caption';
import { PRESET_CONFIGS } from '../services/presets';
import {
  Key,
  Sparkles,
  Type,
  Palette,
  Sliders,
  ListOrdered,
  Eye,
  EyeOff,
  Check,
  Shield,
  Smile,
  Plus,
  Trash2,
  ExternalLink,
  Grid,
  Clock,
} from 'lucide-react';

interface ControlPanelProps {
  style: CaptionStyle;
  onStyleChange: (newStyle: CaptionStyle) => void;
  words: WordCaption[];
  onWordsChange: (newWords: WordCaption[]) => void;
  selectedWordId: string | null;
  onSelectWord: (id: string | null) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  groqApiKey: string;
  onGroqApiKeyChange: (key: string) => void;
  onAutoAddEmojis: () => void;
  isTranscribing: boolean;
  aspectRatio: AspectRatioMode;
  onAspectRatioChange: (ratio: AspectRatioMode) => void;
  videoFit: VideoFitMode;
  onVideoFitChange: (fit: VideoFitMode) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  style,
  onStyleChange,
  words,
  onWordsChange,
  selectedWordId,
  onSelectWord,
  currentTime,
  onSeek,
  groqApiKey,
  onGroqApiKeyChange,
  onAutoAddEmojis,
  aspectRatio,
  onAspectRatioChange,
  videoFit,
  onVideoFitChange,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'presets' | 'transcript' | 'settings'>('inspector');
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const presetsList: Array<{ id: PresetTheme; name: string; tag: string; description: string }> = [
    { id: 'hormozi', name: 'Alex Hormozi', tag: 'Dynamic Pop', description: 'High-contrast emerald & yellow punch with spring scale' },
    { id: 'mrbeast', name: 'MrBeast', tag: 'Creator Box', description: 'Bold yellow active word box with energetic bounce' },
    { id: 'neon', name: 'Neon Studio', tag: 'Electric Glow', description: 'Clean cyan outer glow with geometric Syne display type' },
    { id: 'karaoke', name: 'Karaoke Fill', tag: 'Progressive', description: 'Smooth word-by-word progression without layout shift' },
    { id: 'comic', name: 'Comic Impact', tag: 'Storytelling', description: 'Heavy Titan One lettering with crimson accent badge' },
    { id: 'minimal', name: 'Broadcast Minimal', tag: 'Editorial', description: 'Subtle cinematic lower-third styling without heavy strokes' },
    { id: 'cyberpunk', name: 'Condensed Punch', tag: 'High Impact', description: 'Ultra-condensed Anton display with dual-tone contrast' },
  ];

  const handlePresetSelect = (presetKey: PresetTheme) => {
    const config = PRESET_CONFIGS[presetKey];
    if (config) {
      onStyleChange({
        ...config,
        showSafeZones: style.showSafeZones,
        showGridGuides: style.showGridGuides,
      });
    }
  };

  const handleWordUpdate = (id: string, updates: Partial<WordCaption>) => {
    onWordsChange(
      words.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  };

  const handleWordDelete = (id: string) => {
    onWordsChange(words.filter((w) => w.id !== id));
    if (selectedWordId === id) onSelectWord(null);
  };

  const handleAddWord = (afterIndex: number) => {
    const targetWord = words[afterIndex];
    const newStart = targetWord ? targetWord.end + 0.05 : 0;
    const newEnd = newStart + 0.45;
    const newWord: WordCaption = {
      id: `w-custom-${Date.now()}`,
      text: 'SUBTITLE',
      start: Math.round(newStart * 100) / 100,
      end: Math.round(newEnd * 100) / 100,
      highlight: false,
    };
    const nextWords = [...words];
    nextWords.splice(afterIndex + 1, 0, newWord);
    onWordsChange(nextWords);
    onSelectWord(newWord.id);
  };

  const selectedWord = words.find((w) => w.id === selectedWordId) || null;

  const filteredWords = words.filter((w) =>
    w.text.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <aside className="w-full lg:w-88 xl:w-96 flex flex-col bg-neutral-900 border-l border-neutral-800 h-full text-neutral-200 shrink-0 select-none">
      {/* NLE Inspector Header Tabs */}
      <div className="flex items-center border-b border-neutral-800 bg-neutral-950 p-1 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'inspector'
              ? 'bg-neutral-800 text-amber-400'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'presets'
              ? 'bg-neutral-800 text-amber-400'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Styles</span>
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'transcript'
              ? 'bg-neutral-800 text-amber-400'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>Captions ({words.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'settings'
              ? 'bg-neutral-800 text-amber-400'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>ASR Key</span>
        </button>
      </div>

      {/* Inspector Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 1. INSPECTOR TAB (Canvas Geometry, Selected Clip Timing & Typography) */}
        {activeTab === 'inspector' && (
          <div className="space-y-5 text-xs">
            {/* Selected Clip Quick Inspector (if a word clip is selected on T1) */}
            {selectedWord && (
              <div className="p-3 bg-neutral-950 border border-amber-400/40 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Selected T1 Clip Properties
                  </span>
                  <button
                    onClick={() => onSelectWord(null)}
                    className="text-[11px] text-neutral-400 hover:text-neutral-200"
                  >
                    Deselect
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Subtitle Text</label>
                    <input
                      type="text"
                      value={selectedWord.text}
                      onChange={(e) => handleWordUpdate(selectedWord.id, { text: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 font-semibold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Emoji Tag</label>
                    <input
                      type="text"
                      value={selectedWord.emoji || ''}
                      placeholder="e.g. 🔥"
                      onChange={(e) => handleWordUpdate(selectedWord.id, { emoji: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">In Point (s)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={selectedWord.start}
                      onChange={(e) =>
                        handleWordUpdate(selectedWord.id, {
                          start: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Out Point (s)</label>
                    <input
                      type="number"
                      step="0.05"
                      min={selectedWord.start + 0.05}
                      value={selectedWord.end}
                      onChange={(e) =>
                        handleWordUpdate(selectedWord.id, {
                          end: Math.max(selectedWord.start + 0.05, Number(e.target.value)),
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() =>
                      handleWordUpdate(selectedWord.id, { highlight: !selectedWord.highlight })
                    }
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                      selectedWord.highlight
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    {selectedWord.highlight ? 'Keyword Highlight: ON' : 'Keyword Highlight: OFF'}
                  </button>

                  <button
                    onClick={() => handleWordDelete(selectedWord.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-rose-400 hover:bg-rose-950/40 border border-rose-500/30"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete Clip
                  </button>
                </div>
              </div>
            )}

            {/* Sequence Canvas Format & Framing */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span>Sequence Canvas Format</span>
                <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                  {aspectRatio === '16:9' ? '1920×1080' : '1080×1920'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onAspectRatioChange('9:16')}
                  className={`py-2 px-3 rounded border text-left transition-colors ${
                    aspectRatio === '9:16'
                      ? 'bg-neutral-800 border-amber-400 text-amber-300 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="text-xs">9:16 Vertical</div>
                  <div className="text-[10px] font-mono text-neutral-500">Reels · Shorts · TikTok</div>
                </button>
                <button
                  onClick={() => onAspectRatioChange('16:9')}
                  className={`py-2 px-3 rounded border text-left transition-colors ${
                    aspectRatio === '16:9'
                      ? 'bg-neutral-800 border-amber-400 text-amber-300 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="text-xs">16:9 Widescreen</div>
                  <div className="text-[10px] font-mono text-neutral-500">YouTube · Broadcast HD</div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onVideoFitChange('cover')}
                  className={`py-1.5 px-2.5 rounded border text-center transition-colors font-medium ${
                    videoFit === 'cover'
                      ? 'bg-neutral-800 border-amber-400 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  Scale to Fill (Cover)
                </button>
                <button
                  onClick={() => onVideoFitChange('contain')}
                  className={`py-1.5 px-2.5 rounded border text-center transition-colors font-medium ${
                    videoFit === 'contain'
                      ? 'bg-neutral-800 border-amber-400 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  Fit Entire Frame
                </button>
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-3 pt-4 border-t border-neutral-800">
              <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-amber-400" />
                <span>Subtitle Typography</span>
              </div>

              <div>
                <span className="text-neutral-400 block mb-1.5">Font Family</span>
                <select
                  value={style.fontFamily}
                  onChange={(e) =>
                    onStyleChange({ ...style, fontFamily: e.target.value as CaptionFont })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-neutral-200 font-medium focus:outline-none focus:border-amber-400"
                >
                  <option value="Montserrat">Montserrat (Extra Bold)</option>
                  <option value="Anton">Anton (Condensed Impact)</option>
                  <option value="Bangers">Bangers (Creator Pop)</option>
                  <option value="Bungee">Bungee (Heavy Block)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Studio Sans)</option>
                  <option value="Syne">Syne (Geometric Wide)</option>
                  <option value="Titan One">Titan One (Display Round)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Font Size</span>
                  <span className="font-mono text-neutral-200 tabular-nums">{style.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="28"
                  max="76"
                  value={style.fontSize}
                  onChange={(e) =>
                    onStyleChange({ ...style, fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-amber-400 bg-neutral-800 h-1.5 rounded cursor-pointer"
                />
              </div>

              <div>
                <span className="text-neutral-400 block mb-1.5">Case Transform</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['uppercase', 'capitalize', 'none'] as const).map((casing) => (
                    <button
                      key={casing}
                      onClick={() => onStyleChange({ ...style, textTransform: casing })}
                      className={`py-1.5 px-2 rounded border text-center transition-colors font-medium capitalize ${
                        style.textTransform === casing
                          ? 'bg-neutral-800 border-amber-400 text-amber-300'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {casing}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Colors & Stroke */}
            <div className="space-y-3 pt-4 border-t border-neutral-800">
              <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>Color & Outline</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-neutral-400 block mb-1">Base Color</span>
                  <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded p-1.5">
                    <input
                      type="color"
                      value={style.textColor}
                      onChange={(e) => onStyleChange({ ...style, textColor: e.target.value })}
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-[11px] text-neutral-300 uppercase tabular-nums">
                      {style.textColor}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-neutral-400 block mb-1">Active Highlight</span>
                  <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded p-1.5">
                    <input
                      type="color"
                      value={style.highlightColor}
                      onChange={(e) =>
                        onStyleChange({ ...style, highlightColor: e.target.value })
                      }
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-[11px] text-neutral-300 uppercase tabular-nums">
                      {style.highlightColor}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Outline Stroke Width</span>
                  <span className="font-mono text-neutral-200 tabular-nums">{style.strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="7"
                  value={style.strokeWidth}
                  onChange={(e) =>
                    onStyleChange({ ...style, strokeWidth: Number(e.target.value) })
                  }
                  className="w-full accent-amber-400 bg-neutral-800 h-1.5 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Position & Monitor Overlays */}
            <div className="space-y-3 pt-4 border-t border-neutral-800">
              <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Canvas Placement & Monitor Guides</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1">
                    <span>Position X</span>
                    <span className="font-mono text-neutral-200 tabular-nums">{style.positionX}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="85"
                    value={style.positionX}
                    onChange={(e) =>
                      onStyleChange({ ...style, positionX: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400 bg-neutral-800 h-1.5 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1">
                    <span>Position Y</span>
                    <span className="font-mono text-neutral-200 tabular-nums">{style.positionY}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="88"
                    value={style.positionY}
                    onChange={(e) =>
                      onStyleChange({ ...style, positionY: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400 bg-neutral-800 h-1.5 rounded cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <span className="text-neutral-400 block mb-1.5">Words Per Phrase Chunk</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      onClick={() => onStyleChange({ ...style, wordsPerChunk: count })}
                      className={`py-1.5 rounded border text-center transition-colors font-medium ${
                        style.wordsPerChunk === count
                          ? 'bg-neutral-800 border-amber-400 text-amber-300'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      {count} {count === 1 ? 'Word' : 'Words'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() =>
                    onStyleChange({ ...style, showSafeZones: !style.showSafeZones })
                  }
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded border text-xs font-medium transition-colors ${
                    style.showSafeZones
                      ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Safe Zones</span>
                </button>

                <button
                  onClick={() =>
                    onStyleChange({ ...style, showGridGuides: !style.showGridGuides })
                  }
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded border text-xs font-medium transition-colors ${
                    style.showGridGuides
                      ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Rule of Thirds</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded border border-neutral-800">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-neutral-200 font-medium block">
                      Contextual Emoji Layer
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Render paired emojis on keywords
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    onStyleChange({ ...style, showEmojis: !style.showEmojis })
                  }
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    style.showEmojis
                      ? 'bg-amber-400 text-neutral-950'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {style.showEmojis ? 'Visible' : 'Hidden'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. PRESETS TAB */}
        {activeTab === 'presets' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Subtitle Animation Presets
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Select a typography and motion template for your sequence.
              </p>
            </div>

            <div className="space-y-2">
              {presetsList.map((preset) => {
                const isSelected = style.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-neutral-200 relative overflow-hidden ${
                      isSelected
                        ? 'border-amber-400 bg-neutral-800/90'
                        : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-sm text-neutral-100">
                          {preset.name}
                        </span>
                        <span className="text-neutral-600" aria-hidden="true">·</span>
                        <span className="text-neutral-400 font-medium">
                          {preset.tag}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-amber-400 stroke-[2.5]" />
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                      {preset.description}
                    </p>

                    <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {PRESET_CONFIGS[preset.id].fontFamily} · {PRESET_CONFIGS[preset.id].fontSize}px
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-bold"
                        style={{
                          backgroundColor:
                            PRESET_CONFIGS[preset.id].activeBgColor !== 'transparent'
                              ? PRESET_CONFIGS[preset.id].activeBgColor
                              : '#171717',
                          color: PRESET_CONFIGS[preset.id].highlightColor,
                          fontFamily: PRESET_CONFIGS[preset.id].fontFamily,
                        }}
                      >
                        PREVIEW
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. TRANSCRIPT / CAPTIONS LIST TAB */}
        {activeTab === 'transcript' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter words..."
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={onAutoAddEmojis}
                disabled={words.length === 0}
                className="flex items-center gap-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-amber-300 px-2.5 py-1.5 rounded border border-neutral-700 transition-colors whitespace-nowrap shrink-0"
                title="Auto-detect keywords and pair emojis"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto Emoji</span>
              </button>
            </div>

            {words.length === 0 ? (
              <div className="p-6 rounded border border-dashed border-neutral-800 bg-neutral-950/50 text-center space-y-2.5">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  No subtitle clips in sequence. Import a video to auto-transcribe or add a manual subtitle block.
                </p>
                <button
                  onClick={() => handleAddWord(-1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-amber-300 border border-neutral-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Subtitle</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {filteredWords.map((word, idx) => {
                  const isActive = currentTime >= word.start && currentTime <= word.end;
                  const isSelected = selectedWordId === word.id;

                  return (
                    <div
                      key={word.id}
                      onClick={() => onSelectWord(word.id)}
                      className={`p-2 rounded border transition-colors text-xs flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-neutral-800'
                          : isActive
                          ? 'border-amber-400/50 bg-neutral-800/60'
                          : 'border-neutral-800/90 bg-neutral-950/60 hover:border-neutral-700'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek(word.start);
                        }}
                        className="font-mono text-[11px] text-neutral-400 hover:text-amber-400 tabular-nums shrink-0 px-1 py-0.5 rounded hover:bg-neutral-900"
                      >
                        {word.start.toFixed(2)}s
                      </button>

                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        {editingWordId === word.id ? (
                          <input
                            type="text"
                            defaultValue={word.text}
                            autoFocus
                            onBlur={(e) => {
                              handleWordUpdate(word.id, { text: e.target.value.trim() });
                              setEditingWordId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleWordUpdate(word.id, {
                                  text: (e.target as HTMLInputElement).value.trim(),
                                });
                                setEditingWordId(null);
                              }
                            }}
                            className="bg-neutral-900 border border-amber-400 rounded px-2 py-0.5 text-neutral-100 font-semibold text-xs w-full focus:outline-none"
                          />
                        ) : (
                          <span
                            onDoubleClick={() => setEditingWordId(word.id)}
                            className="font-semibold text-neutral-200 truncate flex items-center gap-1"
                            title="Double-click to edit text"
                          >
                            {word.text}
                            {word.emoji && <span>{word.emoji}</span>}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWordUpdate(word.id, { highlight: !word.highlight });
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                          word.highlight
                            ? 'bg-amber-400 text-neutral-950 font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {word.highlight ? 'Pop' : 'Base'}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddWord(idx);
                        }}
                        className="text-neutral-500 hover:text-neutral-200 p-1 rounded hover:bg-neutral-900"
                        title="Insert word after"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWordDelete(word.id);
                        }}
                        className="text-neutral-500 hover:text-rose-400 p-1 rounded hover:bg-neutral-900"
                        title="Delete word"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. GROQ WHISPER ASR SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Whisper ASR Engine Configuration
              </h2>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Optional Groq Cloud key for high-speed <span className="text-neutral-200 font-mono">whisper-large-v3</span> word-level timestamp alignment. If left blank, the studio falls back to server-side Gemini Audio transcription.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-300 font-medium block">
                Groq API Key (<span className="font-mono text-neutral-400">gsk_...</span>)
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={groqApiKey}
                  onChange={(e) => onGroqApiKeyChange(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded pl-3 pr-10 py-2 text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                <span>
                  {groqApiKey ? 'Custom Groq Whisper Key Active' : 'Default Gemini ASR Active'}
                </span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline flex items-center gap-1"
                >
                  <span>Groq Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
