/**
 * Generates local 9:16 vertical video backgrounds in-browser
 * using Canvas + MediaRecorder so demo clips NEVER fail due to external CDN CORS or 404 errors.
 */

const videoCache = new Map<string, string>();

export async function getReliableSampleVideoUrl(
  sampleId: string,
  duration = 15,
  themeColor = '#3B82F6'
): Promise<string> {
  if (videoCache.has(sampleId)) {
    return videoCache.get(sampleId)!;
  }

  // Create an offscreen canvas to render a stylish 9:16 vertical background
  const width = 540;
  const height = 960;
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
        videoBitsPerSecond: 2500000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        videoCache.set(sampleId, blobUrl);
        resolve(blobUrl);
      };

      recorder.start();

      const startTime = performance.now();
      const totalFrames = Math.min(300, Math.round(duration * 30)); // max 10s loop
      let frame = 0;

      const particles: Array<{ x: number; y: number; r: number; speed: number; opacity: number }> = [];
      for (let p = 0; p < 24; p++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 3 + Math.random() * 8,
          speed: 0.5 + Math.random() * 1.5,
          opacity: 0.2 + Math.random() * 0.5,
        });
      }

      const drawLoop = () => {
        if (frame >= totalFrames || recorder.state !== 'recording') {
          if (recorder.state === 'recording') recorder.stop();
          return;
        }

        const t = frame / 30;

        // 1. Deep cinematic background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#090D16');
        bgGrad.addColorStop(0.5, '#0F172A');
        bgGrad.addColorStop(1, '#050811');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // 2. Dynamic ambient glow orb
        const glowX = width / 2 + Math.sin(t * 0.8) * 60;
        const glowY = height * 0.42 + Math.cos(t * 0.6) * 70;
        const glowRadius = 240 + Math.sin(t * 1.5) * 40;

        const orbGrad = ctx.createRadialGradient(glowX, glowY, 10, glowX, glowY, glowRadius);
        orbGrad.addColorStop(0, themeColor + '55'); // transparent glow
        orbGrad.addColorStop(0.6, themeColor + '15');
        orbGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = orbGrad;
        ctx.fillRect(0, 0, width, height);

        // 3. Subtle grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const gridSize = 40;
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
          if (p.y < -10) p.y = height + 10;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = themeColor;
          ctx.globalAlpha = p.opacity;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });

        // 5. Stylized phone UI speaker / stage watermark
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.font = '700 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AI STUDIO SHORT-FORM DEMO', width / 2, height * 0.16);

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
