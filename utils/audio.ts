
import { TowerType } from '../constants';

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
const soundBuffers: Record<string, AudioBuffer> = {};

export const setSoundEnabled = (enabled: boolean) => {
  soundEnabled = enabled;
};

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  // Attempt to load custom sound files
  // Place these files in your public/root directory under /sounds/
  // Note: Using relative paths for GitHub Pages compatibility
  loadSound('rocket_fire', './sounds/rocket_fire.wav');
  loadSound('rocket_hit', './sounds/rocket_hit.wav');
  loadSound('sniper_fire', './sounds/sniper_fire.wav');
  loadSound('tesla_fire', './sounds/tesla_fire.wav');
  loadSound('turret_fire', './sounds/turret_fire.wav');
  loadSound('m45_fire', './sounds/m45_fire.wav');
  loadSound('mg42_fire', './sounds/mg42_fire.wav');
};

const loadSound = async (key: string, url: string) => {
    if (!audioCtx) return;
    if (soundBuffers[key]) return; 

    try {
        const res = await fetch(url);
        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            soundBuffers[key] = audioBuffer;
        }
    } catch (e) {
        // Silent fail, will use fallback synthesis if file not found
    }
};

const playBuffer = (key: string, vol: number = 0.4) => {
    if (!audioCtx || !soundEnabled || !soundBuffers[key]) return false;
    
    const source = audioCtx.createBufferSource();
    source.buffer = soundBuffers[key];
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    
    source.connect(gain);
    gain.connect(audioCtx.destination);
    
    source.start();
    return true;
};

export const playRocketHitSound = () => {
    if (playBuffer('rocket_hit', 0.6)) return;
    
    // Fallback Explosion Synthesis (if no file)
    if (!audioCtx || !soundEnabled) return;
    const t = audioCtx.currentTime;
    
    // Create noise burst
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + 0.4);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
};

export const playShootSound = (type: TowerType) => {
  if (!audioCtx || !soundEnabled) return;

  // 1. Try to play custom audio files first
  
  if (type === TowerType.ROCKET) {
      if (playBuffer('rocket_fire', 0.5)) return;
  }
  
  if (type === TowerType.SNIPER) {
      if (playBuffer('sniper_fire', 0.6)) return;
  }
  
  if (type === TowerType.TESLA) {
      if (playBuffer('tesla_fire', 0.4)) return;
  }
  
  // Updated: M45 Quad Mount
  if (type === TowerType.RAPID) {
      if (playBuffer('m45_fire', 0.4)) return;
  }

  // Updated: MG42 Nest
  if (type === TowerType.TURRET) {
      // Try specific MG42 sound first, then legacy turret sound
      if (playBuffer('mg42_fire', 0.35) || playBuffer('turret_fire', 0.3)) return;
  }

  // 2. Fallback to Synthesis if files not loaded or missing
  const now = audioCtx.currentTime;
  let duration = 0.15;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  switch (type) {
    case TowerType.SNIPER: // AT Gun - Deep heavy thud (Fallback)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      duration = 0.4;
      gain.gain.setValueAtTime(0.2, now);
      break;

    case TowerType.ROCKET: // Katyusha (Fallback)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
      duration = 0.5;
      gain.gain.setValueAtTime(0.15, now);
      break;

    case TowerType.TESLA: // Experimental (Fallback)
      osc.type = 'square';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.15);
      duration = 0.15;
      gain.gain.setValueAtTime(0.12, now);
      break;

    default:
        // No synthesized fallback for TURRET (MG42) or RAPID (M45)
        // This prevents annoying synthesized beeps if audio files fail to load.
        return;
  }
  
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
};

export const playDeathSound = () => {
    if (!audioCtx || !soundEnabled) return;

    const bufferSize = audioCtx.sampleRate * 0.3; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const gain = audioCtx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    noise.start(now);
};
