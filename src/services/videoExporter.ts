import { CaptionStyle, WordCaption } from '../types/caption';

export interface ExportProgressCallback {
  (progress: number, statusText: string): void;
}

/**
 * Export the video with captions rendered directly on canvas 100% client-side
 * using HTML5 Canvas + MediaRecorder and Web Audio API.
 */
export async function exportVideoClientSide(
  videoSourceUrl: string,
  words: WordCaption[],
  style: CaptionStyle,
  duration: number,
  onProgress: ExportProgressCallback
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    onProgress(5, 'Initializing video decoding & canvas pipeline...');

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoSourceUrl;
    video.muted = false; // ensure audio is available for decoding
    video.playsInline = true;

    // 9:16 vertical resolution
    const canvasWidth = 720;
    const canvasHeight = 1280;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to create canvas 2D rendering context'));
      return;
    }

    video.onloadedmetadata = async () => {
      try {
        onProgress(15, 'Setting up real-time audio sync & capture...');

        // Set up Web Audio to capture video soundtrack
        let audioContext: AudioContext | null = null;
        let mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
        let sourceNode: MediaElementAudioSourceNode | null = null;

        try {
          audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          sourceNode = audioContext.createMediaElementSource(video);
          mediaStreamDest = audioContext.createMediaStreamDestination();
          sourceNode.connect(mediaStreamDest);
          // Also connect to context destination if we want audio or keep isolated
        } catch (audioErr) {
          console.warn('Audio capture warning, rendering video track only:', audioErr);
        }

        const canvasStream = canvas.captureStream(30); // 30 FPS
        const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

        if (mediaStreamDest && mediaStreamDest.stream.getAudioTracks().length > 0) {
          tracks.push(...mediaStreamDest.stream.getAudioTracks());
        }

        const combinedStream = new MediaStream(tracks);

        // Detect supported mime type
        let mimeType = 'video/webm;codecs=vp9,opus';
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
          mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        }

        const recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 6000000, // 6 Mbps high quality
        });

        const recordedChunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const finalBlob = new Blob(recordedChunks, { type: mimeType });
          if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
          }
          onProgress(100, 'Export complete!');
          resolve(finalBlob);
        };

        // Chunk words for pagination
        const chunkSize = style.wordsPerChunk > 0 ? style.wordsPerChunk : 3;
        const segments: Array<{ start: number; end: number; words: WordCaption[] }> = [];
        for (let i = 0; i < words.length; i += chunkSize) {
          const slice = words.slice(i, i + chunkSize);
          segments.push({
            start: slice[0].start,
            end: slice[slice.length - 1].end + 0.25,
            words: slice,
          });
        }

        video.currentTime = 0;
        await video.play();
        recorder.start(100);

        const totalDuration = Math.min(duration || 15, video.duration || 15);

        // Render loop
        const drawFrame = () => {
          if (video.paused || video.ended || video.currentTime >= totalDuration) {
            if (recorder.state === 'recording') {
              recorder.stop();
            }
            video.pause();
            return;
          }

          const curTime = video.currentTime;
          const pct = Math.min(99, Math.round((curTime / totalDuration) * 85) + 15);
          onProgress(pct, `Rendering frame at ${curTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s...`);

          // 1. Draw video background centered & cropped to 9:16
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);

          const vW = video.videoWidth || 1080;
          const vH = video.videoHeight || 1920;
          const videoAspect = vW / vH;
          const canvasAspect = canvasWidth / canvasHeight;

          let renderW = canvasWidth;
          let renderH = canvasHeight;
          let offsetX = 0;
          let offsetY = 0;

          if (videoAspect > canvasAspect) {
            // Video is wider than canvas: crop sides
            renderH = canvasHeight;
            renderW = renderH * videoAspect;
            offsetX = (canvasWidth - renderW) / 2;
          } else {
            // Video is taller than canvas
            renderW = canvasWidth;
            renderH = renderW / videoAspect;
            offsetY = (canvasHeight - renderH) / 2;
          }

          ctx.drawImage(video, offsetX, offsetY, renderW, renderH);

          // 2. Find active caption segment
          const activeSegment = segments.find(
            (seg) => curTime >= seg.start && curTime <= seg.end
          );

          if (activeSegment) {
            drawCaptionsOnCanvas(ctx, activeSegment.words, curTime, style, canvasWidth, canvasHeight);
          }

          requestAnimationFrame(drawFrame);
        };

        requestAnimationFrame(drawFrame);
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video file for export. Please verify format.'));
    };
  });
}

/**
 * Draws words with fonts, strokes, scales, and active highlights onto the 2D canvas
 */
function drawCaptionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  words: WordCaption[],
  curTime: number,
  style: CaptionStyle,
  canvasWidth: number,
  canvasHeight: number
) {
  const posY = (style.positionY / 100) * canvasHeight;
  const posX = (style.positionX / 100) * canvasWidth;

  const baseFontSize = (style.fontSize / 52) * 58; // scale to 720p
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Measure all words to compute total width
  ctx.font = `${style.fontWeight} ${baseFontSize}px "${style.fontFamily}", sans-serif`;

  const wordMetrics = words.map((w) => {
    let text = w.text;
    if (style.textTransform === 'uppercase') text = text.toUpperCase();
    if (style.textTransform === 'capitalize') text = text.charAt(0).toUpperCase() + text.slice(1);
    if (style.showEmojis && w.emoji) text += ` ${w.emoji}`;

    const metrics = ctx.measureText(text);
    return {
      word: w,
      text,
      width: metrics.width,
    };
  });

  const spacing = 18;
  const totalWidth = wordMetrics.reduce((sum, item) => sum + item.width, 0) + (words.length - 1) * spacing;
  let currentX = posX - totalWidth / 2;

  wordMetrics.forEach((item) => {
    const isActive = curTime >= item.word.start && curTime <= item.word.end;
    const isPast = curTime > item.word.end;

    let textColor = style.textColor;
    let bgColor = 'transparent';
    let scale = 1;

    if (style.preset === 'karaoke') {
      textColor = isActive || isPast ? style.highlightColor : style.textColor;
    } else if (isActive) {
      textColor = item.word.customColor || style.highlightColor;
      if (style.activeEffect === 'box') {
        bgColor = style.activeBgColor;
        textColor = style.highlightColor === '#000000' ? '#000000' : '#FFFFFF';
      }
      scale = style.activeScale;
    } else if (item.word.highlight && !isPast && style.preset === 'hormozi') {
      textColor = style.highlightColor;
    }

    const wordCenterX = currentX + item.width / 2;
    const wordCenterY = posY;

    ctx.save();
    ctx.translate(wordCenterX, wordCenterY);
    ctx.scale(scale, scale);

    // Background box if active
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      const padX = 14;
      const padY = 8;
      ctx.beginPath();
      ctx.roundRect(
        -item.width / 2 - padX,
        -baseFontSize / 2 - padY,
        item.width + padX * 2,
        baseFontSize + padY * 2,
        8
      );
      ctx.fill();
    }

    // Shadow
    if (style.hasShadow) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
    }

    // Stroke
    if (style.strokeWidth > 0) {
      ctx.lineWidth = style.strokeWidth * 2;
      ctx.strokeStyle = style.strokeColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(item.text, 0, 0);
    }

    // Text Fill
    ctx.fillStyle = textColor;
    ctx.fillText(item.text, 0, 0);

    ctx.restore();

    currentX += item.width + spacing;
  });

  ctx.restore();
}
