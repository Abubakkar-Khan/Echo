let audioCtx: AudioContext | null = null;
let droneOscs: { osc: OscillatorNode; gain: GainNode }[] = [];
let droneFilter: BiquadFilterNode | null = null;
let droneGain: GainNode | null = null;
let lfoOsc: OscillatorNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const AudioSystem = {
  unlock: () => {
    getAudioContext();
  },
  startDrone: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    // If already playing, don't double start
    if (droneOscs.length > 0) return;

    try {
      // 1. Create a filter to warm up the oscillators
      droneFilter = ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(250, ctx.currentTime);

      // 2. Create main drone gain node
      droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0, ctx.currentTime);
      // Fade in the drone slowly
      droneGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 2.0);

      droneFilter.connect(droneGain);
      droneGain.connect(ctx.destination);

      // 3. Create oscillators for a low minor triad drone (A2, C3, E3)
      const freqs = [110.00, 130.81, 164.81]; // A2, C3, E3
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.33, ctx.currentTime); // balance three voices

        osc.connect(oscGain);
        oscGain.connect(droneFilter!);
        osc.start();

        droneOscs.push({ osc, gain: oscGain });
      });

      // 4. Create an LFO to slowly modulate the filter frequency for movement
      lfoOsc = ctx.createOscillator();
      lfoOsc.type = 'sine';
      lfoOsc.frequency.setValueAtTime(0.15, ctx.currentTime); // 0.15Hz - very slow

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(80, ctx.currentTime); // Modulate by +/- 80Hz

      lfoOsc.connect(lfoGain);
      if (droneFilter.frequency) {
        lfoGain.connect(droneFilter.frequency);
      }
      lfoOsc.start();
    } catch (e) {
      console.warn('Failed to start audio drone:', e);
    }
  },

  stopDrone: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (droneGain) {
      const currentGain = droneGain.gain;
      try {
        currentGain.cancelScheduledValues(ctx.currentTime);
        // Fade out drone
        currentGain.setValueAtTime(currentGain.value || 0.06, ctx.currentTime);
        currentGain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      } catch (e) {}
    }

    setTimeout(() => {
      droneOscs.forEach(({ osc }) => {
        try { osc.stop(); } catch (e) {}
      });
      droneOscs = [];
      
      try { lfoOsc?.stop(); } catch (e) {}
      lfoOsc = null;
      droneFilter = null;
      droneGain = null;
    }, 600);
  },

  playChime: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // High chime combining A5 (880Hz), C#6 (1109Hz), E6 (1318Hz), and A6 (1760Hz)
      const freqs = [880, 1109, 1318, 1760];
      const durations = [0.6, 0.8, 1.0, 1.4];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        // Slightly detune to sound lush
        osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.12, now + 0.02); // quick attack
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + durations[idx]); // long decay

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + durations[idx] + 0.1);
      });
    } catch (e) {
      console.warn('Failed to play chime:', e);
    }
  },

  playWhoosh: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.5;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
      // Pitch sweeps upwards from 100Hz to 550Hz for a reverse whoosh effect
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(550, now + duration);

      // Volume ramps up, then drops instantly
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0.001, now + duration);

      // Add a small filter sweep as well
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(2000, now + duration);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    } catch (e) {
      console.warn('Failed to play whoosh:', e);
    }
  },

  playImpact: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const duration = 0.8;

      // 1. Bass thump oscillator
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
      // Pitch sweeps downwards from 160Hz to 40Hz
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + duration);

      gainNode.gain.setValueAtTime(0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.1);

      // 2. High frequency crack / noise crunch
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);

      // Procedural white noise buffer
      const bufferSize = ctx.sampleRate * 0.3; // 0.3 seconds
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.3);
    } catch (e) {
      console.warn('Failed to play impact:', e);
    }
  },

  playShieldCollect: () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.3);
      osc2.frequency.setValueAtTime(1100, now);
      osc2.frequency.exponentialRampToValueAtTime(2200, now + 0.3);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch(e) {}
  },

  playShieldBreak: () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch(e) {}
  },

  playSlowMo: () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(70, now + 0.6);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.6);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch(e) {}
  },

  playEraser: () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(5, now);

      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start(now);
      source.stop(now + 0.35);
    } catch(e) {}
  }
};
