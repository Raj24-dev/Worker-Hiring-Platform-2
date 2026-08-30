/**
 * Browser-side audio for Setu. Runs in the client only.
 *
 * Sarvam wants a real WAV, and every browser hands MediaRecorder back in a
 * different container (webm/opus in Chrome, mp4/aac in Safari). Rather than
 * hope, decode whatever we got and re-render it to 16 kHz mono PCM, which is
 * exactly what the speech model wants and a fraction of the upload size.
 */

const TARGET_RATE = 16_000;

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function toWav(recorded: Blob) {
  const AudioCtx = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await recorded.arrayBuffer());
    const frames = Math.ceil(decoded.duration * TARGET_RATE);
    if (!frames) return null;

    // An offline context does the downmix and resample for us.
    const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), TARGET_RATE);
  } finally {
    void ctx.close();
  }
}

export type Recorder = {
  stop: () => Promise<Blob | null>;
  cancel: () => void;
  /** 0..1, smoothed — drives the orb. */
  level: () => number;
};

/**
 * Starts recording and resolves once the mic is live. `onSilence` fires when
 * the speaker has clearly stopped, so nobody has to find a stop button.
 */
export async function startRecording(onSilence: () => void): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  const AudioCtx = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.75;
  ctx.createMediaStreamSource(stream).connect(analyser);

  const bins = new Uint8Array(analyser.frequencyBinCount);
  let level = 0;
  let spoke = false;
  let quietSince = 0;
  let raf = 0;
  let finished = false;

  const tick = () => {
    analyser.getByteTimeDomainData(bins);
    let peak = 0;
    for (let i = 0; i < bins.length; i++) peak = Math.max(peak, Math.abs(bins[i] - 128) / 128);
    level = level * 0.7 + peak * 0.3;

    const now = performance.now();
    if (level > 0.06) {
      spoke = true;
      quietSince = now;
    } else if (spoke && now - quietSince > 1400 && !finished) {
      // They have said their piece and gone quiet — stop for them.
      finished = true;
      onSilence();
    }
    raf = requestAnimationFrame(tick);
  };
  quietSince = performance.now();
  raf = requestAnimationFrame(tick);

  const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find(
    (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
  );
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start();

  const teardown = () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    level: () => level,
    cancel: () => {
      finished = true;
      try {
        recorder.stop();
      } catch {}
      teardown();
    },
    stop: () =>
      new Promise<Blob | null>((resolve) => {
        finished = true;
        recorder.onstop = async () => {
          teardown();
          const raw = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          resolve(raw.size ? await toWav(raw).catch(() => null) : null);
        };
        try {
          recorder.stop();
        } catch {
          teardown();
          resolve(null);
        }
      }),
  };
}

/** Plays base64 WAV from Sarvam and reports its level for the orb. */
export function playAudio(base64: string, onLevel: (v: number) => void, onEnd: () => void) {
  const audio = new Audio(`data:audio/wav;base64,${base64}`);
  const AudioCtx = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  let ctx: AudioContext | null = null;
  let raf = 0;

  const cleanup = () => {
    cancelAnimationFrame(raf);
    onLevel(0);
    if (ctx) void ctx.close();
    ctx = null;
  };

  audio.onplay = () => {
    try {
      ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const bins = new Uint8Array(analyser.frequencyBinCount);
      let level = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(bins);
        let peak = 0;
        for (let i = 0; i < bins.length; i++) peak = Math.max(peak, Math.abs(bins[i] - 128) / 128);
        level = level * 0.6 + peak * 0.4;
        onLevel(Math.min(1, level * 2.2));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      // Analysis is decoration; the voice still plays without it.
    }
  };

  audio.onended = () => {
    cleanup();
    onEnd();
  };
  audio.onerror = () => {
    cleanup();
    onEnd();
  };

  const played = audio.play();
  if (played) played.catch(() => { cleanup(); onEnd(); });

  return () => {
    audio.pause();
    cleanup();
  };
}
