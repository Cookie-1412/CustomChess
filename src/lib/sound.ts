export type SoundName = 'move' | 'capture' | 'check' | 'end' | 'shot' | 'spawn' | 'scream' | 'portal' | 'boom' | 'snap' | 'snatch' | 'dig' | 'gold' | 'magnet' | 'foal';

let context: AudioContext | null = null;

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, volume: number, type: OscillatorType) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

/** Short synthesised effects, so the app ships no audio files. */
export function playSound(name: SoundName) {
  try {
    context ??= new AudioContext();
    const ctx = context;
    if (ctx.state === 'suspended') void ctx.resume();
    if (name === 'move') tone(ctx, 190, 0, 0.07, 0.35, 'triangle');
    if (name === 'capture') {
      tone(ctx, 150, 0, 0.06, 0.4, 'square');
      tone(ctx, 240, 0.05, 0.08, 0.3, 'triangle');
    }
    if (name === 'check') {
      tone(ctx, 520, 0, 0.09, 0.22, 'triangle');
      tone(ctx, 700, 0.09, 0.12, 0.22, 'triangle');
    }
    if (name === 'shot') {
      tone(ctx, 1400, 0, 0.05, 0.3, 'sawtooth');
      tone(ctx, 110, 0.02, 0.2, 0.45, 'square');
    }
    if (name === 'spawn') {
      tone(ctx, 330, 0, 0.07, 0.25, 'sine');
      tone(ctx, 660, 0.05, 0.1, 0.22, 'sine');
    }
    if (name === 'scream') {
      tone(ctx, 880, 0, 0.3, 0.16, 'sawtooth');
      tone(ctx, 1240, 0.02, 0.28, 0.12, 'square');
      tone(ctx, 90, 0.18, 0.18, 0.4, 'square');
    }
    if (name === 'portal') {
      tone(ctx, 420, 0, 0.12, 0.22, 'sine');
      tone(ctx, 840, 0.06, 0.14, 0.2, 'sine');
      tone(ctx, 1260, 0.12, 0.14, 0.16, 'sine');
    }
    if (name === 'boom') {
      tone(ctx, 70, 0, 0.5, 0.6, 'square');
      tone(ctx, 45, 0.03, 0.6, 0.55, 'sawtooth');
      tone(ctx, 180, 0, 0.14, 0.3, 'sawtooth');
    }
    if (name === 'snap') {
      tone(ctx, 1900, 0, 0.035, 0.4, 'square');
      tone(ctx, 240, 0.02, 0.09, 0.4, 'square');
    }
    if (name === 'snatch') {
      tone(ctx, 620, 0, 0.05, 0.2, 'triangle');
      tone(ctx, 930, 0.06, 0.08, 0.2, 'triangle');
    }
    if (name === 'dig') {
      tone(ctx, 140, 0, 0.2, 0.4, 'triangle');
      tone(ctx, 80, 0.08, 0.26, 0.4, 'sine');
    }
    if (name === 'gold') {
      tone(ctx, 1320, 0, 0.18, 0.18, 'sine');
      tone(ctx, 1760, 0.07, 0.22, 0.15, 'sine');
      tone(ctx, 2640, 0.14, 0.3, 0.1, 'sine');
    }
    if (name === 'magnet') {
      tone(ctx, 300, 0, 0.22, 0.22, 'sawtooth');
      tone(ctx, 600, 0.04, 0.2, 0.12, 'sine');
    }
    if (name === 'foal') {
      tone(ctx, 660, 0, 0.1, 0.18, 'triangle');
      tone(ctx, 880, 0.09, 0.1, 0.18, 'triangle');
      tone(ctx, 1100, 0.18, 0.16, 0.16, 'triangle');
    }
    if (name === 'end') {
      tone(ctx, 392, 0, 0.16, 0.25, 'sine');
      tone(ctx, 523, 0.15, 0.16, 0.25, 'sine');
      tone(ctx, 659, 0.3, 0.3, 0.25, 'sine');
    }
  } catch {
    // Audio is optional, so a browser without it just stays silent.
  }
}
