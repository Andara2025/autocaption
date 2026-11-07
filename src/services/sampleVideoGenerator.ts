import { AspectRatioMode } from '../types/caption';

/**
 * Generates local 9:16 vertical or 16:9 widescreen video backgrounds in-browser
 * using Canvas + MediaRecorder so demo clips never fail due to external CDN CORS or 404 errors.
 */

const videoCache = new Map<string, string>();

export async function getReliableSampleVideoUrl(
  sampleId: string,
  duration = 15,
  themeColor = '#3B82F6',
  aspectRatio: AspectRatioMode = '9:16'
): Promise<string> {
  const cacheKey = `${sampleId}_${aspectRatio}`;
  if (videoCache.has(cacheKey)) {
    return videoCache.get(cacheKey)!;
  }

  const width = aspectRatio === '16:9' ? 960 : 540;
  const height = aspectRatio === '16:9' ? 540 : 960;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  return new Promise((resolve) => {
    try {
      const stream = canvas.captureStream(30); // 30 fps
      let mimeType = 'video/webm;codecs=vp8';
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2800000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        videoCache.set(cacheKey, blobUrl);
        resolve(blobUrl);
      };

      recorder.start();

      const totalFrames = Math.min(240, Math.round(duration * 30)); // fast 8s seamless loop
      let frame = 0;

      const particles: Array<{ x: number; y: number; r: number; speed: number; opacity: number; drift: number }> = [];
      for (let p = 0; p < 28; p++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 2 + Math.random() * 6,
          speed: 0.6 + Math.random() * 1.4,
          opacity: 0.15 + Math.random() * 0.45,
          drift: (Math.random() - 0.5) * 0.6,
        });
      }

      const drawLoop = () => {
        if (frame >= totalFrames || recorder.state !== 'recording') {
          if (recorder.state === 'recording') recorder.stop();
          return;
        }

        const t = frame / 30;

        // 1. Deep cinematic background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#070A12');
        bgGrad.addColorStop(0.5, '#0D1322');
        bgGrad.addColorStop(1, '#05070E');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // 2. Dynamic ambient light waves
        const glowX = width * 0.5 + Math.sin(t * 0.9) * (width * 0.18);
        const glowY = height * 0.45 + Math.cos(t * 0.7) * (height * 0.12);
        const glowRadius = Math.max(width, height) * 0.42 + Math.sin(t * 1.5) * 35;

        const orbGrad = ctx.createRadialGradient(glowX, glowY, 10, glowX, glowY, glowRadius);
        orbGrad.addColorStop(0, themeColor + '48');
        orbGrad.addColorStop(0.55, themeColor + '16');
        orbGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = orbGrad;
        ctx.fillRect(0, 0, width, height);

        // Secondary subtle counter-glow
        const glow2X = width * 0.3 + Math.cos(t * 0.6) * (width * 0.15);
        const glow2Y = height * 0.65 + Math.sin(t * 0.8) * (height * 0.1);
        const orb2Grad = ctx.createRadialGradient(glow2X, glow2Y, 10, glow2X, glow2Y, glowRadius * 0.7);
        orb2Grad.addColorStop(0, '#38BDF825');
        orb2Grad.addColorStop(1, 'transparent');
        ctx.fillStyle = orb2Grad;
        ctx.fillRect(0, 0, width, height);

        // 3. Subtle studio perspective grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 1;
        const gridSize = 48;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // 4. Floating bokeh particles
        particles.forEach((p) => {
          p.y -= p.speed;
          p.x += p.drift;
          if (p.y < -10) p.y = height + 10;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = themeColor;
          ctx.globalAlpha = p.opacity;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });

        frame++;
        requestAnimationFrame(drawLoop);
      };

      drawLoop();
    } catch (e) {
      console.warn('Canvas video generation failed, resolving empty:', e);
      resolve('');
    }
  });
}
