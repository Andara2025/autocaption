import { WordCaption } from '../types/caption';

export interface GroqTranscriptionResponse {
  task?: string;
  language?: string;
  duration?: number;
  text: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    words?: Array<{
      word: string;
      start: number;
      end: number;
    }>;
  }>;
}

const COMMON_EMOJIS: Record<string, string> = {
  money: '💰',
  cash: '💵',
  dollar: '💵',
  rich: '🤑',
  grow: '📈',
  growth: '📈',
  scale: '🚀',
  rocket: '🚀',
  future: '🔮',
  fast: '⚡',
  quick: '⚡',
  speed: '🏎️',
  stop: '🛑',
  fire: '🔥',
  hot: '🔥',
  viral: '🔥',
  time: '⏳',
  hours: '⏰',
  seconds: '⏱️',
  secret: '🤫',
  mindset: '🧠',
  brain: '🧠',
  focus: '🎯',
  goal: '🎯',
  target: '🎯',
  ai: '🤖',
  algorithm: '🤖',
  robot: '🤖',
  video: '🎬',
  tiktok: '📱',
  instagram: '📸',
  youtube: '▶️',
  phone: '📱',
  million: '💎',
  billion: '👑',
  strong: '💪',
  power: '⚡',
  love: '❤️',
  danger: '⚠️',
  warning: '⚠️',
  idea: '💡',
  light: '💡',
  win: '🏆',
  winner: '🥇',
  hook: '🪝',
};

const HIGH_IMPACT_WORDS = new Set([
  'secret', 'stop', 'never', 'always', 'money', 'grow', 'viral', 'fast',
  'million', 'billion', 'free', 'crazy', 'insane', 'proven', 'huge',
  'three', 'one', 'two', 'future', 'power', 'stronger', 'hack', 'rule',
  'hook', 'algorithm', 'tiktok', 'instagram', 'warning', 'best', 'worst'
]);

/**
 * Extracts audio from a video or audio file directly in the browser
 * and encodes it as a lightweight 16kHz mono WAV file to send to Whisper.
 */
export async function extractAudioBlob(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
    sampleRate: 16000,
  });

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBlob = audioBufferToWav(audioBuffer);
    return wavBlob;
  } finally {
    if (audioCtx.state !== 'closed') {
      await audioCtx.close();
    }
  }
}

/**
 * Encodes an AudioBuffer into standard 16-bit PCM WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = 1; // mono
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels: Float32Array[] = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // Mix down channels to mono
  const inputL = buffer.getChannelData(0);
  const inputR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : inputL;

  while (offset < buffer.length) {
    const monoSample = (inputL[offset] + inputR[offset]) / (buffer.numberOfChannels > 1 ? 2 : 1);
    const clamped = Math.max(-1, Math.min(1, monoSample));
    view.setInt16(pos, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    pos += 2;
    offset++;
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Transcribe media using Groq Cloud Whisper API (whisper-large-v3)
 * with precise word-level timestamps.
 */
export async function transcribeWithGroq(
  mediaFile: File | Blob,
  apiKey: string,
  options: {
    language?: string;
    prompt?: string;
  } = {}
): Promise<WordCaption[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Groq API Key is missing. Please enter your Groq API key.');
  }

  const formData = new FormData();
  
  // Name the file properly for the API
  const filename = mediaFile instanceof File ? mediaFile.name : 'audio.wav';
  formData.append('file', mediaFile, filename.endsWith('.wav') ? filename : `${filename}.wav`);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  if (options.language) {
    formData.append('language', options.language);
  }
  if (options.prompt) {
    formData.append('prompt', options.prompt);
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = `Groq API Error (${response.status}): ${response.statusText}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error && parsed.error.message) {
        message = parsed.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  const data: GroqTranscriptionResponse = await response.json();

  // Extract word-level timestamps
  let wordsList: Array<{ word: string; start: number; end: number }> = [];

  if (data.words && Array.isArray(data.words) && data.words.length > 0) {
    wordsList = data.words;
  } else if (data.segments && Array.isArray(data.segments)) {
    // If top-level words is empty, check segments words
    for (const seg of data.segments) {
      if (seg.words && seg.words.length > 0) {
        wordsList.push(...seg.words);
      } else {
        // Fallback: estimate word timestamps from segment duration
        const wordsInSeg = seg.text.trim().split(/\s+/).filter(Boolean);
        const segDuration = Math.max(0.2, seg.end - seg.start);
        const wordDuration = segDuration / Math.max(1, wordsInSeg.length);
        wordsInSeg.forEach((w, idx) => {
          wordsList.push({
            word: w,
            start: seg.start + idx * wordDuration,
            end: seg.start + (idx + 1) * wordDuration,
          });
        });
      }
    }
  }

  if (wordsList.length === 0 && data.text) {
    // Total fallback if whisper verbose format had no words array
    const rawWords = data.text.trim().split(/\s+/).filter(Boolean);
    const estTotalDuration = data.duration || 10;
    const durPerWord = estTotalDuration / Math.max(1, rawWords.length);
    wordsList = rawWords.map((w, i) => ({
      word: w,
      start: i * durPerWord,
      end: (i + 1) * durPerWord,
    }));
  }

  // Format into WordCaption format with smart highlighting & emojis
  return formatAndEnhanceWords(wordsList);
}

/**
 * Format raw Whisper words and enrich with high-engagement viral touches
 */
export function formatAndEnhanceWords(
  rawWords: Array<{ word: string; start: number; end: number }>
): WordCaption[] {
  return rawWords.map((item, index) => {
    const cleanWord = item.word.trim();
    const normalized = cleanWord.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check for high impact word
    const isHighlight = HIGH_IMPACT_WORDS.has(normalized) || (!isNaN(Number(normalized)) && normalized.length > 0);
    const emoji = COMMON_EMOJIS[normalized] || undefined;

    return {
      id: `w-${index}-${Date.now().toString(36)}`,
      text: cleanWord,
      start: Math.round(item.start * 100) / 100,
      end: Math.round(item.end * 100) / 100,
      highlight: isHighlight,
      emoji: emoji,
    };
  });
}
