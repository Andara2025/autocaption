import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Server-side Gemini AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Transcribe audio using Gemini AI with word-level timestamps.
 * Provides instant speech-to-text when Groq API key is not configured.
 */
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/wav', duration = 15 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 data' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Server Gemini API key is not configured. Please use a Groq API Key or check secrets.',
      });
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/wav',
        data: audioBase64,
      },
    };

    const promptText = `
Transcribe the speech in this audio clip with exact word-level start and end timestamps in seconds.
The audio duration is approximately ${duration} seconds.
Identify each spoken word precisely. If there are periods of silence, do not create words for silence.
Return the output in JSON format with an array of words where each word has:
- word: the spoken text
- start: time in seconds (float, e.g. 0.45)
- end: time in seconds (float, e.g. 0.82)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [audioPart, { text: promptText }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            language: { type: Type.STRING },
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                },
                required: ['word', 'start', 'end'],
              },
            },
          },
          required: ['words'],
        },
      },
    });

    const parsed = JSON.parse(response.text ?? '{"words":[]}');
    return res.json({
      words: parsed.words || [],
      language: parsed.language || 'en',
    });
  } catch (error: unknown) {
    console.error('Audio transcription error:', error);
    const msg = error instanceof Error ? error.message : 'Transcription failed';
    return res.status(500).json({ error: msg });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

/**
 * Proxy external videos to guarantee CORS and Range header support
 * for Remotion <Video /> elements, preventing Code 4 errors.
 */
app.get('/api/proxy-video', async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).send('Missing url parameter');
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await fetch(videoUrl, { headers });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');

    if (response.headers.get('content-range')) {
      res.setHeader('Content-Range', response.headers.get('content-range')!);
      res.status(206);
    }
    if (response.headers.get('content-length')) {
      res.setHeader('Content-Length', response.headers.get('content-length')!);
    }
    if (response.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', response.headers.get('accept-ranges')!);
    }

    const arrayBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Proxy failed';
    return res.status(500).send(msg);
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
