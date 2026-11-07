import React, { useState } from 'react';
import {
  CaptionFont,
  CaptionStyle,
  PresetTheme,
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
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface ControlPanelProps {
  style: CaptionStyle;
  onStyleChange: (newStyle: CaptionStyle) => void;
  words: WordCaption[];
  onWordsChange: (newWords: WordCaption[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  groqApiKey: string;
  onGroqApiKeyChange: (key: string) => void;
  onAutoAddEmojis: () => void;
  isTranscribing: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  style,
  onStyleChange,
  words,
  onWordsChange,
  currentTime,
  onSeek,
  groqApiKey,
  onGroqApiKeyChange,
  onAutoAddEmojis,
  isTranscribing,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'style' | 'transcript' | 'settings'>('presets');
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);

  const presetsList: Array<{ id: PresetTheme; name: string; tag: string; description: string }> = [
    { id: 'hormozi', name: 'Alex Hormozi', tag: 'Most Popular', description: 'Emerald/Yellow punch with dynamic spring pop' },
    { id: 'mrbeast', name: 'MrBeast', tag: 'High CTR', description: 'Bright yellow badge box with bouncy tilt' },
    { id: 'neon', name: 'Neon Cyber', tag: 'Tech / AI', description: 'Electric cyan glow with futuristic Syne font' },
    { id: 'karaoke', name: 'Karaoke Flow', tag: 'Smooth', description: 'Word-by-word active color fill with no jumps' },
    { id: 'comic', name: 'Comic Pop', tag: 'Storytelling', description: 'Bangers chunky font with comic red accent' },
    { id: 'minimal', name: 'Minimal Modern', tag: 'Aesthetic', description: 'Clean luxury aesthetic without thick strokes' },
    { id: 'cyberpunk', name: 'Cyberpunk', tag: 'Bold', description: 'Ultra-condensed Anton with dual-color pop' },
  ];

  const handlePresetSelect = (presetKey: PresetTheme) => {
    const config = PRESET_CONFIGS[presetKey];
    if (config) {
      onStyleChange({
        ...config,
        showSafeZones: style.showSafeZones,
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
  };

  const handleAddWord = (afterIndex: number) => {
    const targetWord = words[afterIndex];
    const newStart = targetWord ? targetWord.end + 0.05 : 0;
    const newEnd = newStart + 0.4;
    const newWord: WordCaption = {
      id: `w-custom-${Date.now()}`,
      text: 'WORD',
      start: Math.round(newStart * 100) / 100,
      end: Math.round(newEnd * 100) / 100,
      highlight: false,
    };
    const nextWords = [...words];
    nextWords.splice(afterIndex + 1, 0, newWord);
    onWordsChange(nextWords);
  };

  return (
    <aside className="w-full lg:w-96 flex flex-col bg-neutral-900 border-l border-neutral-800 h-full text-neutral-200">
      {/* Sidebar Navigation Tabs */}
      <div className="flex items-center border-b border-neutral-800 bg-neutral-950/70 p-1.5 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'presets'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Presets
        </button>
        <button
          onClick={() => setActiveTab('style')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'style'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Style
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'transcript'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Words ({words.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'settings'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          Groq API
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* PRESETS TAB */}
        {activeTab === 'presets' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Viral Creator Presets
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Pre-configured typography, colors, strokes and spring animations.
              </p>
            </div>

            <div className="space-y-2.5">
              {presetsList.map((preset) => {
                const isSelected = style.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all text-neutral-200 relative overflow-hidden group ${
                      isSelected
                        ? 'border-amber-400/80 bg-neutral-800/90 shadow-md ring-1 ring-amber-400/30'
                        : 'border-neutral-800 bg-neutral-950/50 hover:border-neutral-700 hover:bg-neutral-850'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-100">
                          {preset.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-neutral-800 text-neutral-300">
                          {preset.tag}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                      {preset.description}
                    </p>

                    {/* Preview Badge Mock */}
                    <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-neutral-500 font-mono">
                        Font: {PRESET_CONFIGS[preset.id].fontFamily}
                      </span>
                      <div
                        className="px-2 py-0.5 rounded text-[11px] font-bold"
                        style={{
                          backgroundColor: PRESET_CONFIGS[preset.id].activeBgColor !== 'transparent' ? PRESET_CONFIGS[preset.id].activeBgColor : '#262626',
                          color: PRESET_CONFIGS[preset.id].highlightColor,
                          fontFamily: PRESET_CONFIGS[preset.id].fontFamily,
                        }}
                      >
                        SAMPLE POP ⚡
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STYLE CUSTOMIZER TAB */}
        {activeTab === 'style' && (
          <div className="space-y-5 text-xs">
            {/* Typography */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-amber-400" />
                Typography
              </label>

              <div>
                <span className="text-neutral-400 block mb-1.5">Font Family</span>
                <select
                  value={style.fontFamily}
                  onChange={(e) =>
                    onStyleChange({ ...style, fontFamily: e.target.value as CaptionFont })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-200 font-medium focus:outline-none focus:border-amber-400"
                >
                  <option value="Montserrat">Montserrat (Extra Bold)</option>
                  <option value="Anton">Anton (Viral Condensed)</option>
                  <option value="Bangers">Bangers (Comic & Pop)</option>
                  <option value="Bungee">Bungee (Ultra Chunky)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Modern Clean)</option>
                  <option value="Syne">Syne (Futuristic Cyber)</option>
                  <option value="Titan One">Titan One (Playful Bubble)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Font Size</span>
                  <span className="font-mono text-neutral-200">{style.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="28"
                  max="72"
                  value={style.fontSize}
                  onChange={(e) =>
                    onStyleChange({ ...style, fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-amber-400 bg-neutral-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <span className="text-neutral-400 block mb-1.5">Letter Casing</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['uppercase', 'capitalize', 'none'] as const).map((casing) => (
                    <button
                      key={casing}
                      onClick={() => onStyleChange({ ...style, textTransform: casing })}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-colors font-medium capitalize ${
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

            {/* Colors */}
            <div className="space-y-3 pt-3 border-t border-neutral-800">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                Colors & Highlights
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-neutral-400 block mb-1">Text Color</span>
                  <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg p-1.5">
                    <input
                      type="color"
                      value={style.textColor}
                      onChange={(e) => onStyleChange({ ...style, textColor: e.target.value })}
                      className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-[11px] text-neutral-300 uppercase">
                      {style.textColor}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-neutral-400 block mb-1">Highlight Color</span>
                  <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg p-1.5">
                    <input
                      type="color"
                      value={style.highlightColor}
                      onChange={(e) =>
                        onStyleChange({ ...style, highlightColor: e.target.value })
                      }
                      className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-[11px] text-neutral-300 uppercase">
                      {style.highlightColor}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stroke Width */}
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Text Stroke (Outline)</span>
                  <span className="font-mono text-neutral-200">{style.strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="7"
                  value={style.strokeWidth}
                  onChange={(e) =>
                    onStyleChange({ ...style, strokeWidth: Number(e.target.value) })
                  }
                  className="w-full accent-amber-400 bg-neutral-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Layout & Safe Zone */}
            <div className="space-y-3 pt-3 border-t border-neutral-800">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Placement & TikTok Safe Zone
              </label>

              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Vertical Position (Y)</span>
                  <span className="font-mono text-neutral-200">{style.positionY}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="85"
                  value={style.positionY}
                  onChange={(e) =>
                    onStyleChange({ ...style, positionY: Number(e.target.value) })
                  }
                  className="w-full accent-amber-400 bg-neutral-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-lg border border-neutral-800">
                <div>
                  <span className="text-neutral-200 font-medium block">
                    TikTok / Reels Safe Zone
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    Show safe margin overlays
                  </span>
                </div>
                <button
                  onClick={() =>
                    onStyleChange({ ...style, showSafeZones: !style.showSafeZones })
                  }
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    style.showSafeZones
                      ? 'bg-amber-400 text-neutral-950'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {style.showSafeZones ? 'Active' : 'Off'}
                </button>
              </div>

              {/* Words per screen */}
              <div>
                <span className="text-neutral-400 block mb-1.5">Words Per Screen</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      onClick={() => onStyleChange({ ...style, wordsPerChunk: count })}
                      className={`py-1.5 rounded-md border text-center transition-colors font-medium ${
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

              {/* Viral Emojis Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-lg border border-neutral-800">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-neutral-200 font-medium block">
                      Display Viral Emojis
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Auto-pairs emojis on impact words
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    onStyleChange({ ...style, showEmojis: !style.showEmojis })
                  }
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    style.showEmojis
                      ? 'bg-amber-400 text-neutral-950'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {style.showEmojis ? 'Enabled' : 'Hidden'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TRANSCRIPT WORDS EDITOR TAB */}
        {activeTab === 'transcript' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-100">
                  Word Timestamps ({words.length})
                </h2>
                <p className="text-xs text-neutral-400">
                  Click a word to seek video. Edit text or toggle highlight.
                </p>
              </div>
              <button
                onClick={onAutoAddEmojis}
                className="flex items-center gap-1.5 text-xs bg-neutral-800 hover:bg-neutral-750 text-amber-300 px-2.5 py-1.5 rounded-lg border border-neutral-700 transition-colors"
                title="Detect impact keywords and add contextual emojis"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Add Emojis
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {words.map((word, idx) => {
                const isActive =
                  currentTime >= word.start && currentTime <= word.end;

                return (
                  <div
                    key={word.id}
                    className={`p-2.5 rounded-lg border transition-all text-xs flex items-center justify-between gap-2 ${
                      isActive
                        ? 'border-amber-400/80 bg-neutral-800/90 shadow-sm'
                        : 'border-neutral-800/90 bg-neutral-950/60 hover:border-neutral-700'
                    }`}
                  >
                    {/* Timestamp seek button */}
                    <button
                      onClick={() => onSeek(word.start)}
                      className="font-mono text-[11px] text-neutral-400 hover:text-amber-400 tabular-nums shrink-0 px-1 py-0.5 rounded hover:bg-neutral-800"
                    >
                      {word.start.toFixed(2)}s
                    </button>

                    {/* Word text edit */}
                    <div className="flex-1 flex items-center gap-1.5">
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
                              handleWordUpdate(word.id, { text: (e.target as HTMLInputElement).value.trim() });
                              setEditingWordId(null);
                            }
                          }}
                          className="bg-neutral-900 border border-amber-400 rounded px-2 py-0.5 text-neutral-100 font-semibold text-xs w-full focus:outline-none"
                        />
                      ) : (
                        <span
                          onClick={() => setEditingWordId(word.id)}
                          className="font-semibold text-neutral-200 cursor-pointer hover:underline flex items-center gap-1"
                        >
                          {word.text}
                          {word.emoji && <span>{word.emoji}</span>}
                        </span>
                      )}
                    </div>

                    {/* Highlight switch */}
                    <button
                      onClick={() =>
                        handleWordUpdate(word.id, { highlight: !word.highlight })
                      }
                      className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                        word.highlight
                          ? 'bg-amber-400 text-neutral-950 font-bold'
                          : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                      title="Toggle viral highlight color"
                    >
                      {word.highlight ? 'Pop' : 'Dim'}
                    </button>

                    {/* Add Word after */}
                    <button
                      onClick={() => handleAddWord(idx)}
                      className="text-neutral-500 hover:text-neutral-300 p-1 rounded hover:bg-neutral-800"
                      title="Add word after"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Word */}
                    <button
                      onClick={() => handleWordDelete(word.id)}
                      className="text-neutral-500 hover:text-red-400 p-1 rounded hover:bg-neutral-800"
                      title="Delete word"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GROQ API SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                Groq Cloud API Key
              </h2>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Connect your Groq Cloud API key to transcribe uploaded videos and audio files with <span className="text-neutral-200 font-mono">whisper-large-v3</span> in &lt;2 seconds.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-300 font-medium block">
                Groq API Key (starts with <span className="font-mono text-neutral-400">gsk_</span>)
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={groqApiKey}
                  onChange={(e) => onGroqApiKeyChange(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-3 pr-10 py-2.5 text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                <span className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      groqApiKey ? 'bg-emerald-400' : 'bg-neutral-600'
                    }`}
                  />
                  {groqApiKey ? 'API Key Configured' : 'No Key (Using Demo Samples)'}
                </span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline flex items-center gap-1"
                >
                  Get free Groq key
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 text-xs text-neutral-400">
              <span className="font-semibold text-neutral-300 block">
                Why Groq Whisper?
              </span>
              <p className="leading-relaxed">
                Groq LPUs process Whisper Large v3 at ~200-300x realtime speed. Word-level timestamps are extracted client-side with millisecond accuracy for TikTok/Reels captions.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
