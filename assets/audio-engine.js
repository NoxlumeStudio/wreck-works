/**
 * インチキ解体業者 — Web Audio BGM & SE Engine + Volume Settings Controller
 * Warm Osaka Jazz-Funk / Caper Comedy soundtrack + tactile demolition foley SE.
 */

const STORAGE_KEY = "inchiki_kaitai_audio_v2";

const DEFAULT_SETTINGS = {
  master: 40,
  bgm: 45,
  se: 60,
  masterMuted: false,
  bgmMuted: false,
  seMuted: false,
};

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      master: clampInt(parsed.master, 0, 100, DEFAULT_SETTINGS.master),
      bgm: clampInt(parsed.bgm, 0, 100, DEFAULT_SETTINGS.bgm),
      se: clampInt(parsed.se, 0, 100, DEFAULT_SETTINGS.se),
      masterMuted: Boolean(parsed.masterMuted),
      bgmMuted: Boolean(parsed.bgmMuted),
      seMuted: Boolean(parsed.seMuted),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Perceptual volume curve (0..100 -> 0..1)
function gainCurve(pct) {
  const norm = Math.max(0, Math.min(1, pct / 100));
  return norm === 0 ? 0 : Math.pow(norm, 1.8);
}

// ---------------------------------------------------------------------------
// Musical compositions (each track is an array of 8th-note or 16th-note steps)
// Note values are MIDI numbers; null = rest.
// ---------------------------------------------------------------------------

const TRACK_LABELS = {
  title: "難波のインチキ解体屋",
  plan1: "図面とにらめっこ（下町編）",
  plan2: "図面とにらめっこ（繁華街編）",
  plan3: "図面とにらめっこ（難関物件編）",
  action: "ドカンといこか！",
  story: "ゲンさんとミキ",
  ending: "ほんまもんの解体屋",
};

// 1) TITLE THEME: Cheeky Osaka Jazz-Funk Caper (Key of F, 114 BPM, 64 eighth steps = 8 bars)
const TRACK_TITLE = {
  bpm: 114,
  stepSubdiv: 2, // 8th notes
  swing: 0.24,
  length: 64,
  leadType: "brass",
  bass: [
    // Bar 1: F7
    41, null, 45, null, 48, null, 50, 51,
    // Bar 2: Bb7
    46, null, 50, null, 53, null, 50, 48,
    // Bar 3: F7 -> D7
    41, null, 45, null, 48, null, 50, null,
    // Bar 4: Gm7 -> C7
    43, null, 46, null, 48, null, 52, 47,
    // Bar 5: F7
    41, null, 45, null, 48, null, 50, 51,
    // Bar 6: Bb7 -> Bdim7
    46, null, 50, null, 47, null, 50, 53,
    // Bar 7: Am7 -> D7b9
    45, null, 48, null, 50, null, 45, null,
    // Bar 8: Gm7 -> C7 turnaround
    43, null, 46, 47, 48, null, 43, 40,
  ],
  chords: {
    0: [57, 60, 63, 67],   // F9
    5: [57, 60, 63, 67],
    8: [56, 60, 62, 65],   // Bb9
    13: [56, 60, 62, 65],
    16: [57, 60, 63, 67],  // F9
    20: [54, 57, 60, 64],  // D9
    24: [53, 58, 62, 65],  // Gm7
    28: [58, 62, 64, 67],  // C9
    32: [57, 60, 63, 67],  // F9
    37: [57, 60, 63, 67],
    40: [56, 60, 62, 65],  // Bb9
    44: [56, 59, 62, 65],  // Bdim7
    48: [55, 60, 64, 67],  // Am7
    52: [54, 60, 63, 66],  // D7b9
    56: [53, 58, 62, 65],  // Gm7
    60: [58, 62, 64, 69],  // C13
  },
  lead: [
    // Cheeky swaggering horn phrase A
    69, null, 72, 74, null, 72, 69, null,
    70, null, 69, 65, null, null, 62, 65,
    69, null, 72, 74, 75, 74, 72, null,
    70, null, 67, null, 64, null, null, null,
    // Phrase B (higher, playful bounce)
    72, null, 74, 77, null, 74, 72, 69,
    70, null, 74, 77, null, 74, 71, null,
    72, 74, 72, 69, 66, null, 69, null,
    67, null, 70, 72, null, 67, 65, null,
  ],
  drums: "swing",
};

// 2A) PLANNING MODE (Chapters 1-2): Warm Cozy Blueprint Jazz (Key of C/Am, 96 BPM, 64 8th steps)
const TRACK_PLAN_1 = {
  bpm: 96,
  stepSubdiv: 2,
  swing: 0.16,
  length: 64,
  leadType: "marimba",
  bass: [
    // Cmaj7
    48, null, null, 55, 52, null, 55, null,
    // Am7
    45, null, null, 52, 48, null, 52, null,
    // Dm7
    50, null, null, 57, 53, null, 50, null,
    // G9
    43, null, null, 50, 47, null, 50, 52,
    // Em7 -> A7
    52, null, null, 55, 45, null, 49, null,
    // Dm7 -> G7
    50, null, null, 53, 43, null, 47, null,
    // Cmaj7 -> A7
    48, null, 52, null, 45, null, 49, null,
    // Dm7 -> G13
    50, null, 53, null, 43, null, 47, null,
  ],
  chords: {
    0: [59, 62, 64, 67],   // Cmaj9
    6: [59, 62, 64, 67],
    8: [57, 60, 64, 67],   // Am7
    14: [57, 60, 64, 67],
    16: [60, 64, 65, 69],  // Dm9
    22: [60, 64, 65, 69],
    24: [59, 62, 65, 69],  // G13
    32: [59, 62, 64, 67],  // Em7
    36: [55, 61, 64, 67],  // A7
    40: [60, 64, 65, 69],  // Dm9
    44: [59, 62, 65, 69],  // G13
    48: [59, 62, 64, 67],  // Cmaj9
    52: [55, 61, 64, 67],  // A7
    56: [60, 64, 65, 69],  // Dm9
    60: [59, 62, 65, 69],  // G13
  },
  lead: [
    72, null, 76, null, 79, null, 76, null,
    74, 72, null, 69, null, null, null, null,
    74, null, 77, null, 76, null, 72, null,
    71, null, 74, null, null, null, 67, null,
    76, null, 79, null, 76, 73, null, null,
    74, null, 77, null, 79, null, 74, null,
    76, null, 72, null, 73, null, 69, null,
    72, null, 74, null, 71, null, null, null,
  ],
  drums: "brush",
};

// 2B) PLANNING MODE (Chapters 3-4): Downtown Funky Puzzle (Key of Gm/C9, 102 BPM)
const TRACK_PLAN_2 = {
  bpm: 102,
  stepSubdiv: 2,
  swing: 0.18,
  length: 64,
  leadType: "marimba",
  bass: [
    // Gm7
    43, null, 46, null, 50, null, 48, 46,
    // C9
    48, null, 52, null, 55, null, 52, 48,
    // Gm7
    43, null, 46, null, 50, null, 53, null,
    // Cm7 -> F9
    48, null, 51, null, 41, null, 45, 46,
    // Bbmaj7 -> Eb7
    46, null, 50, null, 51, null, 55, null,
    // Am7b5 -> D7
    45, null, 48, null, 50, null, 54, null,
    // Gm7 -> C9
    43, null, 50, null, 48, null, 52, null,
    // Cm7 -> D7b9
    48, null, 51, null, 50, null, 45, 42,
  ],
  chords: {
    0: [58, 62, 65, 69],   // Gm9
    5: [58, 62, 65, 69],
    8: [58, 62, 64, 67],   // C9
    14: [58, 62, 64, 67],
    16: [58, 62, 65, 69],  // Gm9
    24: [58, 62, 63, 67],  // Cm9
    28: [57, 60, 63, 67],  // F9
    32: [57, 60, 62, 65],  // Bbmaj9
    36: [58, 61, 63, 67],  // Eb7
    40: [57, 60, 63, 67],  // Am7b5
    44: [57, 60, 63, 66],  // D7b9
    48: [58, 62, 65, 69],  // Gm9
    52: [58, 62, 64, 67],  // C9
    56: [58, 62, 63, 67],  // Cm9
    60: [57, 60, 63, 66],  // D7b9
  },
  lead: [
    70, null, 74, 77, null, 74, 70, null,
    72, null, 76, null, 74, null, null, null,
    70, null, 74, 77, 79, null, 77, 74,
    75, null, 72, null, 69, null, null, null,
    74, null, 77, null, 75, null, 70, null,
    72, null, 75, null, 74, null, 69, null,
    70, null, 74, null, 76, null, 72, null,
    75, null, 72, 70, 69, null, null, null,
  ],
  drums: "brush",
};

// 2C) PLANNING MODE (Chapters 5-6): Sly Caper Noir Jazz (Key of Dm, 98 BPM)
const TRACK_PLAN_3 = {
  bpm: 98,
  stepSubdiv: 2,
  swing: 0.22,
  length: 64,
  leadType: "vibe",
  bass: [
    // Dm9
    50, null, 53, null, 57, null, 56, null,
    // Dm7 -> A7
    55, null, 53, null, 45, null, 49, null,
    // Gm9
    43, null, 46, null, 50, null, 53, null,
    // Em7b5 -> A7b9
    52, null, 55, null, 45, null, 49, 52,
    // Bbmaj7
    46, null, 50, null, 53, null, 57, null,
    // A7b9
    45, null, 49, null, 52, null, 55, null,
    // Gm7 -> C9
    43, null, 46, null, 48, null, 52, null,
    // Em7b5 -> A7
    52, null, 46, null, 45, null, 40, 45,
  ],
  chords: {
    0: [60, 64, 65, 69],   // Dm9
    6: [60, 64, 65, 69],
    12: [55, 58, 61, 64],  // A7b9
    16: [58, 62, 65, 69],  // Gm9
    24: [58, 62, 64, 67],  // Em7b5
    28: [55, 58, 61, 64],  // A7b9
    32: [57, 60, 62, 65],  // Bbmaj9
    40: [55, 58, 61, 64],  // A7b9
    48: [58, 62, 65, 69],  // Gm9
    52: [58, 62, 64, 67],  // C9
    56: [58, 62, 64, 67],  // Em7b5
    60: [55, 58, 61, 64],  // A7b9
  },
  lead: [
    69, null, 72, null, 74, null, 76, null,
    77, null, 76, 74, 73, null, null, null,
    74, null, 77, null, 79, null, 77, null,
    76, null, 74, 73, 69, null, null, null,
    77, null, 74, null, 72, null, 69, null,
    73, null, 76, null, 79, null, 76, null,
    77, null, 74, null, 76, null, 72, null,
    74, null, 70, null, 69, null, null, null,
  ],
  drums: "brush",
};

// 3) DEMOLITION ACTION MODE: High-Energy Big-Band Caper Funk (Key of Gm, 136 BPM, 64 8th steps)
const TRACK_ACTION = {
  bpm: 136,
  stepSubdiv: 2,
  swing: 0.14,
  length: 64,
  leadType: "brass",
  bass: [
    // Driving syncopated funk bass
    43, 43, null, 46, 50, null, 48, 46,
    43, null, 46, 48, 50, null, 53, 50,
    48, 48, null, 51, 55, null, 53, 51,
    43, null, 46, 50, 53, null, 50, 46,
    51, 51, null, 55, 58, null, 55, 51,
    50, 50, null, 54, 57, null, 54, 50,
    43, null, 46, 50, 48, null, 52, 55,
    50, null, 50, 54, 57, null, 50, null,
  ],
  chords: {
    0: [58, 62, 65, 70],
    3: [58, 62, 65, 70],
    6: [58, 62, 65, 70],
    10: [58, 62, 64, 69],
    14: [58, 62, 65, 70],
    16: [58, 63, 67, 70],
    19: [58, 63, 67, 70],
    24: [58, 62, 65, 70],
    28: [58, 62, 65, 70],
    32: [58, 63, 67, 70],
    35: [58, 63, 67, 70],
    40: [57, 60, 66, 69],
    43: [57, 60, 66, 69],
    48: [58, 62, 65, 70],
    52: [58, 62, 64, 67],
    56: [57, 60, 66, 69],
    60: [57, 60, 66, 69],
  },
  lead: [
    74, null, 77, 79, null, 77, 74, null,
    70, 74, null, 77, 79, null, null, null,
    75, null, 79, 82, null, 79, 75, null,
    74, null, 77, 74, 70, null, null, null,
    79, null, 82, null, 81, null, 79, 75,
    74, null, 78, null, 81, null, 78, null,
    79, null, 77, 74, 76, null, 79, null,
    78, null, 74, 78, 81, null, 74, null,
  ],
  drums: "action",
};

// 4) STORY MODE: Warm Osaka Comedy Banter Swing (Key of Eb, 102 BPM)
const TRACK_STORY = {
  bpm: 102,
  stepSubdiv: 2,
  swing: 0.2,
  length: 64,
  leadType: "marimba",
  bass: [
    // Ebmaj7
    51, null, null, 55, 58, null, 55, null,
    // Cm7
    48, null, null, 51, 55, null, 51, null,
    // Fm7
    53, null, null, 56, 60, null, 56, null,
    // Bb9
    46, null, null, 50, 53, null, 50, 48,
    // Gm7 -> C7
    43, null, 46, null, 48, null, 52, null,
    // Fm7 -> Bb7
    53, null, 56, null, 46, null, 50, null,
    // Ebmaj7 -> C7
    51, null, 55, null, 48, null, 52, null,
    // Fm7 -> Bb9
    53, null, 56, null, 46, null, 50, null,
  ],
  chords: {
    0: [58, 62, 63, 67],   // Ebmaj7
    8: [58, 62, 63, 67],   // Cm9
    16: [60, 63, 65, 68],  // Fm7
    24: [56, 60, 62, 65],  // Bb9
    32: [58, 62, 65, 67],  // Gm7
    36: [58, 61, 64, 67],  // C7b9
    40: [60, 63, 65, 68],  // Fm7
    44: [56, 60, 62, 65],  // Bb9
    48: [58, 62, 63, 67],  // Ebmaj7
    52: [58, 61, 64, 67],  // C7
    56: [60, 63, 65, 68],  // Fm7
    60: [56, 60, 62, 65],  // Bb9
  },
  lead: [
    75, null, 74, 70, null, 74, 75, null,
    72, null, 70, 67, null, null, null, null,
    72, null, 75, 77, null, 75, 72, null,
    74, null, 70, null, null, null, 67, null,
    74, null, 77, null, 76, null, 72, null,
    77, null, 75, 72, 74, null, 70, null,
    75, null, 79, null, 76, null, 72, null,
    75, null, 72, null, 74, null, null, null,
  ],
  drums: "brush",
};

// 5) ENDING THEME: Heartwarming Sunset Brass & Rhodes (Key of G Major, 92 BPM)
const TRACK_ENDING = {
  bpm: 92,
  stepSubdiv: 2,
  swing: 0.12,
  length: 64,
  leadType: "warmHorn",
  bass: [
    // Gmaj7
    43, null, null, 47, 50, null, 47, null,
    // Em7
    40, null, null, 47, 52, null, 47, null,
    // Cmaj7
    48, null, null, 52, 55, null, 52, null,
    // D9
    50, null, null, 54, 57, null, 54, 50,
    // Bm7
    47, null, null, 50, 54, null, 50, null,
    // Em7
    40, null, null, 47, 52, null, 47, null,
    // Am7
    45, null, null, 48, 52, null, 48, null,
    // D13
    50, null, null, 54, 57, null, 50, null,
  ],
  chords: {
    0: [59, 62, 66, 69],   // Gmaj9
    8: [59, 62, 64, 67],   // Em7
    16: [59, 62, 64, 67],  // Cmaj9
    24: [60, 64, 66, 69],  // D9
    32: [59, 62, 66, 69],  // Bm7
    40: [59, 62, 64, 67],  // Em7
    48: [59, 60, 64, 67],  // Am9
    56: [60, 64, 66, 71],  // D13
  },
  lead: [
    74, null, 76, 79, null, 78, 76, null,
    74, null, 71, null, null, null, 67, 71,
    72, null, 74, 76, null, 79, 76, null,
    74, null, null, null, null, null, 74, 76,
    78, null, 79, 81, null, 79, 78, null,
    76, null, 74, 71, null, null, 69, 71,
    72, null, 76, 74, null, 72, 71, null,
    74, null, null, null, null, null, null, null,
  ],
  drums: "brush",
};

const TRACKS = {
  title: TRACK_TITLE,
  plan1: TRACK_PLAN_1,
  plan2: TRACK_PLAN_2,
  plan3: TRACK_PLAN_3,
  action: TRACK_ACTION,
  story: TRACK_STORY,
  ending: TRACK_ENDING,
};

// ---------------------------------------------------------------------------
// Core Web Audio Engine
// ---------------------------------------------------------------------------

class GameAudioEngine {
  constructor() {
    this.settings = loadSettings();
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.bgmDuckGain = null;
    this.seGain = null;
    this.bgmFilter = null;
    this.delaySend = null;
    this.noiseBuffer = null;

    this.desiredTrack = "title";
    this.activeTrackName = null;
    this.activeTrack = null;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.schedulerId = null;

    this.currentChapter = 1;
    this.inTitle = true;
    this.inStory = false;
    this.storyId = null;
    this.mode = "edit"; // edit | running | result
    this.paused = false;

    // Throttling timestamps (seconds in ctx.currentTime) for dense physics SE
    this.lastSeTime = Object.create(null);
    this.uiListeners = new Set();
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();

      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      // Gentle master limiter/compressor per bus so dense explosions + BGM stay clean
      const bgmComp = this.ctx.createDynamicsCompressor();
      bgmComp.threshold.value = -16;
      bgmComp.knee.value = 18;
      bgmComp.ratio.value = 3;
      bgmComp.attack.value = 0.008;
      bgmComp.release.value = 0.16;

      this.bgmFilter = this.ctx.createBiquadFilter();
      this.bgmFilter.type = "lowpass";
      this.bgmFilter.frequency.value = 8800;
      this.bgmFilter.Q.value = 0.5;

      this.bgmDuckGain = this.ctx.createGain();
      this.bgmDuckGain.gain.value = 1;

      this.bgmGain = this.ctx.createGain();

      // Subtle warm studio delay/room send for BGM
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.value = 0.24;
      const delayFb = this.ctx.createGain();
      delayFb.gain.value = 0.22;
      const delayLp = this.ctx.createBiquadFilter();
      delayLp.type = "lowpass";
      delayLp.frequency.value = 2200;
      const delayWet = this.ctx.createGain();
      delayWet.gain.value = 0.18;

      this.delaySend = this.ctx.createGain();
      this.delaySend.gain.value = 1;
      this.delaySend.connect(delay);
      delay.connect(delayLp);
      delayLp.connect(delayFb);
      delayFb.connect(delay);
      delayLp.connect(delayWet);
      delayWet.connect(this.bgmFilter);

      this.bgmFilter.connect(bgmComp);
      bgmComp.connect(this.bgmDuckGain);
      this.bgmDuckGain.connect(this.bgmGain);
      this.bgmGain.connect(this.masterGain);

      const seComp = this.ctx.createDynamicsCompressor();
      seComp.threshold.value = -10;
      seComp.knee.value = 12;
      seComp.ratio.value = 6;
      seComp.attack.value = 0.003;
      seComp.release.value = 0.12;

      this.seGain = this.ctx.createGain();
      seComp.connect(this.seGain);
      this.seGain.connect(this.masterGain);
      this.seInput = seComp;

      // Pre-build 2s white noise buffer for drums, explosions, sparks, debris
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 2);
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;

      this.applyVolumes(true);
    }

    if (this.ctx.state === "suspended" && !document.hidden) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        this.syncBgm();
      }).catch(() => {});
    } else {
      this.syncBgm();
    }
  }

  applyVolumes(immediate = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const m = this.settings.masterMuted ? 0 : gainCurve(this.settings.master);
    const b = this.settings.bgmMuted ? 0 : gainCurve(this.settings.bgm) * 0.28;
    const s = this.settings.seMuted ? 0 : gainCurve(this.settings.se) * 0.52;

    if (immediate) {
      this.masterGain.gain.setValueAtTime(m, now);
      this.bgmGain.gain.setValueAtTime(b, now);
      this.seGain.gain.setValueAtTime(s, now);
    } else {
      this.masterGain.gain.setTargetAtTime(m, now, 0.02);
      this.bgmGain.gain.setTargetAtTime(b, now, 0.025);
      this.seGain.gain.setTargetAtTime(s, now, 0.02);
    }
  }

  updateSettings(patch) {
    Object.assign(this.settings, patch);
    saveSettings(this.settings);
    this.applyVolumes(false);
    this.notifyUI();
  }

  resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    saveSettings(this.settings);
    this.applyVolumes(false);
    this.notifyUI();
  }

  onUIChange(fn) {
    this.uiListeners.add(fn);
    return () => this.uiListeners.delete(fn);
  }

  notifyUI() {
    for (const fn of this.uiListeners) {
      try {
        fn(this.settings, this.desiredTrack);
      } catch {
        // ignore
      }
    }
  }

  getTrackLabel() {
    return TRACK_LABELS[this.desiredTrack] || TRACK_LABELS.title;
  }

  // Decide which BGM should play based on current game state
  resolveDesiredTrack() {
    if (this.inStory) {
      return this.storyId === "ed" ? "ending" : "story";
    }
    if (this.inTitle) {
      return "title";
    }
    if (this.mode === "running") {
      return "action";
    }
    if (this.currentChapter >= 5) return "plan3";
    if (this.currentChapter >= 3) return "plan2";
    return "plan1";
  }

  syncBgm() {
    const target = this.resolveDesiredTrack();
    this.desiredTrack = target;
    this.notifyUI();

    if (!this.ctx || this.ctx.state !== "running") return;

    if (this.activeTrackName !== target) {
      this.switchTrack(target);
    } else if (!this.schedulerId) {
      this.startScheduler();
    }

    // Muffle BGM slightly when simulation is paused
    const now = this.ctx.currentTime;
    const targetCutoff = this.paused && this.mode === "running" ? 1100 : 8800;
    this.bgmFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);
  }

  switchTrack(name) {
    const track = TRACKS[name];
    if (!track || !this.ctx) return;
    this.activeTrackName = name;
    this.activeTrack = track;
    this.stepIndex = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;

    // Gentle fade-in envelope on track change
    const now = this.ctx.currentTime;
    this.bgmDuckGain.gain.cancelScheduledValues(now);
    this.bgmDuckGain.gain.setValueAtTime(Math.min(0.2, this.bgmDuckGain.gain.value), now);
    this.bgmDuckGain.gain.linearRampToValueAtTime(1.0, now + 0.32);

    this.startScheduler();
  }

  duckBgm(level = 0.16, holdSec = 2.0, recoverSec = 0.7) {
    if (!this.ctx || !this.bgmDuckGain) return;
    const now = this.ctx.currentTime;
    this.bgmDuckGain.gain.cancelScheduledValues(now);
    this.bgmDuckGain.gain.setValueAtTime(this.bgmDuckGain.gain.value, now);
    this.bgmDuckGain.gain.linearRampToValueAtTime(level, now + 0.06);
    this.bgmDuckGain.gain.setValueAtTime(level, now + holdSec);
    this.bgmDuckGain.gain.linearRampToValueAtTime(1.0, now + holdSec + recoverSec);
  }

  startScheduler() {
    if (this.schedulerId) return;
    this.schedulerId = window.setInterval(() => this.schedulerTick(), 25);
  }

  stopScheduler() {
    if (this.schedulerId) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  schedulerTick() {
    if (!this.ctx || this.ctx.state !== "running" || !this.activeTrack || document.hidden) {
      return;
    }
    const lookahead = 0.12;
    const track = this.activeTrack;
    const baseStepDur = 60 / track.bpm / track.stepSubdiv;

    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      const step = this.stepIndex % track.length;
      const isOffbeat = step % 2 === 1;
      const swingOffset = isOffbeat ? baseStepDur * (track.swing || 0) : 0;
      const playTime = this.nextNoteTime + swingOffset;

      if (!(this.paused && this.mode === "running")) {
        this.scheduleStep(track, step, playTime, baseStepDur);
      }

      this.nextNoteTime += baseStepDur;
      this.stepIndex = (this.stepIndex + 1) % track.length;
    }
  }

  // -------------------------------------------------------------------------
  // BGM Instrument Synthesizers
  // -------------------------------------------------------------------------

  scheduleStep(track, step, time, stepDur) {
    // 1. Bass
    const bassNote = track.bass[step];
    if (bassNote != null) {
      this.playBass(midiToFreq(bassNote), time, stepDur * 1.45, track === TRACK_ACTION ? 0.34 : 0.28);
    }

    // 2. Rhodes / Electric Piano Chords
    const chord = track.chords[step];
    if (chord) {
      const dur = track === TRACK_ACTION ? stepDur * 1.6 : stepDur * 4.4;
      const vol = track === TRACK_ACTION ? 0.12 : 0.105;
      this.playRhodesChord(chord, time, dur, vol);
    }

    // 3. Melody Lead
    const leadNote = track.lead[step];
    if (leadNote != null) {
      const nextStep = track.lead[(step + 1) % track.length];
      const dur = nextStep == null ? stepDur * 1.75 : stepDur * 0.92;
      const freq = midiToFreq(leadNote);
      if (track.leadType === "brass") {
        this.playBrass(freq, time, dur, track === TRACK_ACTION ? 0.145 : 0.13);
      } else if (track.leadType === "warmHorn") {
        this.playWarmHorn(freq, time, dur * 1.35, 0.14);
      } else if (track.leadType === "vibe") {
        this.playVibe(freq, time, dur * 1.4, 0.14);
      } else {
        this.playMarimba(freq, time, dur, 0.16);
      }
    }

    // 4. Drums / Percussion
    this.scheduleDrumStep(track.drums, step, time);
  }

  playBass(freq, time, dur, vol) {
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = "triangle";
    osc2.type = "sawtooth";
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq, time);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.28;

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(920, time);
    filter.frequency.exponentialRampToValueAtTime(210, time + Math.min(0.22, dur));
    filter.Q.value = 1.4;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + dur);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmFilter);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.03);
    osc2.stop(time + dur + 0.03);
  }

  playRhodesChord(midiNotes, time, dur, vol) {
    const ctx = this.ctx;
    const perNote = vol / Math.sqrt(midiNotes.length);
    for (let i = 0; i < midiNotes.length; i++) {
      const t = time + i * 0.008; // gentle strum
      const freq = midiToFreq(midiNotes[i]);
      const osc = ctx.createOscillator();
      const tine = ctx.createOscillator();
      const gain = ctx.createGain();
      const tineGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);

      tine.type = "triangle";
      tine.frequency.setValueAtTime(freq * 2, t);
      tineGain.gain.setValueAtTime(perNote * 0.22, t);
      tineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(perNote, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(perNote * 0.42, t + Math.min(0.28, dur * 0.4));
      gain.gain.exponentialRampToValueAtTime(0.0004, t + dur);

      osc.connect(gain);
      tine.connect(tineGain);
      tineGain.connect(this.bgmFilter);
      gain.connect(this.bgmFilter);
      gain.connect(this.delaySend);

      osc.start(t);
      tine.start(t);
      osc.stop(t + dur + 0.04);
      tine.stop(t + 0.18);
    }
  }

  playBrass(freq, time, dur, vol) {
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    // Slight cheeky jazz pitch scoop on attack
    osc1.frequency.setValueAtTime(freq * 0.985, time);
    osc1.frequency.exponentialRampToValueAtTime(freq, time + 0.028);
    osc2.frequency.setValueAtTime(freq * 1.004, time);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, time);
    filter.frequency.exponentialRampToValueAtTime(2200, time + 0.045);
    filter.frequency.exponentialRampToValueAtTime(1050, time + dur);
    filter.Q.value = 2.4;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.022);
    gain.gain.setValueAtTime(vol * 0.82, time + Math.max(0.04, dur * 0.65));
    gain.gain.exponentialRampToValueAtTime(0.0005, time + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmFilter);
    gain.connect(this.delaySend);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.04);
    osc2.stop(time + dur + 0.04);
  }

  playWarmHorn(freq, time, dur, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    sub.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    sub.frequency.setValueAtTime(freq, time);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, time);
    filter.frequency.linearRampToValueAtTime(1350, time + 0.14);
    filter.frequency.linearRampToValueAtTime(860, time + dur);
    filter.Q.value = 1.2;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.07);
    gain.gain.setValueAtTime(vol * 0.85, time + Math.max(0.1, dur * 0.7));
    gain.gain.exponentialRampToValueAtTime(0.0005, time + dur);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmFilter);
    gain.connect(this.delaySend);

    osc.start(time);
    sub.start(time);
    osc.stop(time + dur + 0.05);
    sub.stop(time + dur + 0.05);
  }

  playMarimba(freq, time, dur, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    const ovGain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 4, time);

    const decay = Math.min(0.32, dur);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0004, time + decay);

    ovGain.gain.setValueAtTime(vol * 0.25, time);
    ovGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

    osc.connect(gain);
    overtone.connect(ovGain);
    ovGain.connect(this.bgmFilter);
    gain.connect(this.bgmFilter);
    gain.connect(this.delaySend);

    osc.start(time);
    overtone.start(time);
    osc.stop(time + decay + 0.03);
    overtone.stop(time + 0.06);
  }

  playVibe(freq, time, dur, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    lfo.frequency.setValueAtTime(5.6, time);
    lfoGain.gain.setValueAtTime(vol * 0.16, time);

    const decay = Math.min(0.7, dur);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + decay);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(this.bgmFilter);
    gain.connect(this.delaySend);

    osc.start(time);
    lfo.start(time);
    osc.stop(time + decay + 0.04);
    lfo.stop(time + decay + 0.04);
  }

  scheduleDrumStep(style, step, time) {
    const barStep = step % 8;
    if (style === "swing") {
      if (barStep === 0 || barStep === 4) this.playKick(time, 0.22);
      if (barStep === 2 || barStep === 6) this.playSnare(time, 0.11, true);
      if (barStep === 0 || barStep === 2 || barStep === 3 || barStep === 4 || barStep === 6 || barStep === 7) {
        this.playHat(time, barStep === 3 || barStep === 7 ? 0.065 : 0.045, barStep === 2 || barStep === 6);
      }
    } else if (style === "brush") {
      if (barStep === 0) this.playKick(time, 0.15);
      if (barStep === 4) this.playKick(time, 0.11);
      if (barStep === 2 || barStep === 6) this.playHat(time, 0.055, true);
      else if (barStep % 2 === 1) this.playHat(time, 0.025, false);
    } else if (style === "action") {
      if (barStep === 0 || barStep === 3 || barStep === 4) this.playKick(time, 0.28);
      if (barStep === 2 || barStep === 6) this.playSnare(time, 0.19, false);
      if (step % 16 === 15) this.playSnare(time, 0.14, true);
      this.playHat(time, barStep % 2 === 0 ? 0.06 : 0.04, barStep === 6);
    }
  }

  playKick(time, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.11);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.16);
    osc.connect(gain);
    gain.connect(this.bgmFilter);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  playSnare(time, vol, soft = false) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = soft ? 2600 : 1900;
    filter.Q.value = soft ? 1.4 : 0.8;
    const gain = ctx.createGain();
    const dur = soft ? 0.09 : 0.14;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmFilter);
    src.start(time);
    src.stop(time + dur + 0.02);

    if (!soft) {
      const body = ctx.createOscillator();
      const bGain = ctx.createGain();
      body.type = "triangle";
      body.frequency.setValueAtTime(195, time);
      body.frequency.exponentialRampToValueAtTime(115, time + 0.06);
      bGain.gain.setValueAtTime(vol * 0.65, time);
      bGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.08);
      body.connect(bGain);
      bGain.connect(this.bgmFilter);
      body.start(time);
      body.stop(time + 0.09);
    }
  }

  playHat(time, vol, open = false) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6400;
    const gain = ctx.createGain();
    const dur = open ? 0.11 : 0.042;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0004, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmFilter);
    src.start(time);
    src.stop(time + dur + 0.01);
  }

  // -------------------------------------------------------------------------
  // Sound Effects (SE) — Tactile UI, Tools, Physics Demolition, Jingles
  // -------------------------------------------------------------------------

  canTrigger(key, minGapSec) {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    const prev = this.lastSeTime[key] || 0;
    if (now - prev < minGapSec) return false;
    this.lastSeTime[key] = now;
    return true;
  }

  seTone({ type = "sine", freq = 440, endFreq = null, dur = 0.1, vol = 0.25, delay = 0, attack = 0.005, filterFreq = null }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0004, t + dur);

    if (filterFreq) {
      const flt = ctx.createBiquadFilter();
      flt.type = "lowpass";
      flt.frequency.setValueAtTime(filterFreq, t);
      osc.connect(flt);
      flt.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this.seInput);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  seNoise({ dur = 0.15, vol = 0.25, delay = 0, filterType = "bandpass", freq = 1200, endFreq = null, q = 1, attack = 0.004 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t);
    if (endFreq != null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + dur);
    }
    filter.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0004, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.seInput);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  playSE(name, data = {}) {
    const ctx = this.ensureContext();
    if (!ctx || this.settings.masterMuted || this.settings.seMuted) return;

    switch (name) {
      case "uiClick":
        if (!this.canTrigger("uiClick", 0.04)) return;
        this.seTone({ type: "triangle", freq: 680, endFreq: 420, dur: 0.055, vol: 0.16 });
        this.seNoise({ dur: 0.025, vol: 0.08, filterType: "highpass", freq: 2400 });
        break;

      case "uiConfirm":
        this.seTone({ type: "triangle", freq: 523.25, dur: 0.08, vol: 0.2 });
        this.seTone({ type: "triangle", freq: 783.99, dur: 0.14, vol: 0.22, delay: 0.055 });
        break;

      case "uiOpen":
        this.seTone({ type: "sine", freq: 380, endFreq: 620, dur: 0.09, vol: 0.16 });
        this.seNoise({ dur: 0.06, vol: 0.07, filterType: "bandpass", freq: 1800 });
        break;

      case "uiClose":
        this.seTone({ type: "sine", freq: 560, endFreq: 340, dur: 0.08, vol: 0.15 });
        break;

      case "uiError":
        if (!this.canTrigger("uiError", 0.12)) return;
        this.seTone({ type: "sawtooth", freq: 185, endFreq: 165, dur: 0.11, vol: 0.16, filterFreq: 750 });
        this.seTone({ type: "sawtooth", freq: 150, endFreq: 125, dur: 0.16, vol: 0.18, delay: 0.09, filterFreq: 650 });
        break;

      case "hint":
        this.seTone({ type: "sine", freq: 880, dur: 0.12, vol: 0.2 });
        this.seTone({ type: "sine", freq: 1318.5, dur: 0.26, vol: 0.22, delay: 0.07 });
        break;

      case "storyLine": {
        if (!this.canTrigger("storyLine", 0.04)) return;
        const speaker = data.speaker || "";
        const isGen = speaker.includes("ゲン");
        const base = isGen ? 320 : speaker.includes("ミキ") ? 580 : 440;
        const jitter = 0.94 + Math.random() * 0.12;
        this.seTone({ type: "triangle", freq: base * jitter, endFreq: base * 0.85, dur: 0.05, vol: 0.13 });
        break;
      }

      case "toolSelect":
        this.seTone({ type: "triangle", freq: data.tool ? 540 : 390, endFreq: data.tool ? 740 : 300, dur: 0.07, vol: 0.18 });
        this.seNoise({ dur: 0.03, vol: 0.1, filterType: "bandpass", freq: 2800, q: 2 });
        break;

      case "anchorPick":
        this.seTone({ type: "triangle", freq: 440, endFreq: 660, dur: 0.08, vol: 0.2 });
        this.seTone({ type: "sine", freq: 1120, endFreq: 880, dur: 0.06, vol: 0.14 });
        break;

      case "toolPlace": {
        const tool = data.tool;
        if (tool === "cut") {
          // Metallic bolt-cutter snip
          this.seNoise({ dur: 0.07, vol: 0.22, filterType: "bandpass", freq: 3400, endFreq: 1800, q: 2.2 });
          this.seTone({ type: "square", freq: 920, endFreq: 420, dur: 0.06, vol: 0.14, filterFreq: 2400 });
        } else if (tool === "weight") {
          // Heavy iron drop
          this.seTone({ type: "sine", freq: 160, endFreq: 54, dur: 0.18, vol: 0.34 });
          this.seTone({ type: "triangle", freq: 420, endFreq: 280, dur: 0.09, vol: 0.16 });
        } else if (tool === "wire") {
          // Steel cable hook & twang
          this.seTone({ type: "sawtooth", freq: 260, endFreq: 490, dur: 0.14, vol: 0.15, filterFreq: 1900 });
          this.seTone({ type: "sine", freq: 1040, endFreq: 880, dur: 0.07, vol: 0.14 });
        } else if (tool === "jack") {
          // Hydraulic ratchet click-clunk
          this.seTone({ type: "sawtooth", freq: 190, endFreq: 280, dur: 0.1, vol: 0.18, filterFreq: 950 });
          this.seTone({ type: "triangle", freq: 520, endFreq: 380, dur: 0.06, vol: 0.16, delay: 0.05 });
        } else if (tool === "pad") {
          // Soft cushion thump
          this.seTone({ type: "sine", freq: 220, endFreq: 95, dur: 0.13, vol: 0.24 });
          this.seNoise({ dur: 0.08, vol: 0.12, filterType: "lowpass", freq: 650 });
        } else if (tool === "blast") {
          // Dynamite strap & menacing wooden clunk
          this.seTone({ type: "triangle", freq: 240, endFreq: 110, dur: 0.12, vol: 0.26 });
          this.seNoise({ dur: 0.09, vol: 0.16, filterType: "bandpass", freq: 2200, q: 1.5, delay: 0.04 });
        } else if (tool === "precise") {
          // Precision shaped-charge arming beep
          this.seTone({ type: "sine", freq: 1046, dur: 0.06, vol: 0.16 });
          this.seTone({ type: "sine", freq: 1568, dur: 0.08, vol: 0.16, delay: 0.055 });
        } else {
          this.seTone({ type: "triangle", freq: 520, endFreq: 360, dur: 0.08, vol: 0.2 });
        }
        break;
      }

      case "toolRemove":
        // Detach snap + cheerful yen refund chime
        this.seTone({ type: "triangle", freq: 480, endFreq: 260, dur: 0.07, vol: 0.16 });
        this.seTone({ type: "sine", freq: 987.77, dur: 0.09, vol: 0.15, delay: 0.05 });
        this.seTone({ type: "sine", freq: 1318.5, dur: 0.16, vol: 0.16, delay: 0.1 });
        break;

      case "reset":
        this.seNoise({ dur: 0.18, vol: 0.15, filterType: "bandpass", freq: 1400, endFreq: 600 });
        this.seTone({ type: "triangle", freq: 420, endFreq: 240, dur: 0.14, vol: 0.15 });
        break;

      case "startRun":
        // Construction whistle / lever clunk!
        this.seTone({ type: "sawtooth", freq: 160, endFreq: 95, dur: 0.1, vol: 0.2, filterFreq: 700 });
        this.seTone({ type: "sine", freq: 1180, endFreq: 1420, dur: 0.11, vol: 0.16, delay: 0.04 });
        this.seTone({ type: "sine", freq: 1420, endFreq: 1360, dur: 0.16, vol: 0.16, delay: 0.15 });
        break;

      case "pauseToggle":
        this.seTone({ type: "triangle", freq: data.paused ? 440 : 620, endFreq: data.paused ? 310 : 760, dur: 0.08, vol: 0.18 });
        break;

      // --- Physics Simulation Foley SE ---

      case "blast": {
        if (!this.canTrigger("blast", 0.06)) return;
        // Massive layered dynamite explosion!
        this.seTone({ type: "sine", freq: 135, endFreq: 26, dur: 0.62, vol: 0.55, attack: 0.004 });
        this.seTone({ type: "triangle", freq: 90, endFreq: 30, dur: 0.45, vol: 0.35, attack: 0.005 });
        this.seNoise({ dur: 0.72, vol: 0.48, filterType: "lowpass", freq: 1600, endFreq: 140, attack: 0.005 });
        this.seNoise({ dur: 0.28, vol: 0.3, filterType: "bandpass", freq: 2400, endFreq: 700, q: 0.9, delay: 0.02 });
        // Debris crackle tail
        this.seNoise({ dur: 0.34, vol: 0.16, filterType: "bandpass", freq: 3200, endFreq: 1100, q: 2.5, delay: 0.14 });
        break;
      }

      case "precise": {
        if (!this.canTrigger("precise", 0.05)) return;
        // Tight surgical shaped-charge crack!
        this.seTone({ type: "sine", freq: 260, endFreq: 52, dur: 0.24, vol: 0.42, attack: 0.002 });
        this.seNoise({ dur: 0.18, vol: 0.4, filterType: "bandpass", freq: 2600, endFreq: 520, q: 1.1, attack: 0.002 });
        this.seTone({ type: "square", freq: 1480, endFreq: 420, dur: 0.08, vol: 0.15, filterFreq: 3200 });
        break;
      }

      case "cut": {
        if (!this.canTrigger("cut", 0.045)) return;
        // Metallic shear / spark slice
        const pitch = 0.92 + Math.random() * 0.18;
        this.seNoise({ dur: 0.16, vol: 0.28, filterType: "bandpass", freq: 3800 * pitch, endFreq: 1400, q: 2.2 });
        this.seTone({ type: "sawtooth", freq: 880 * pitch, endFreq: 260, dur: 0.12, vol: 0.2, filterFreq: 2800 });
        break;
      }

      case "break": {
        if (!this.canTrigger("break", 0.055)) return;
        // Structural beam/joint snapping & splintering!
        const p = 0.85 + Math.random() * 0.32;
        this.seNoise({ dur: 0.17, vol: 0.3, filterType: "bandpass", freq: 1450 * p, endFreq: 420, q: 1.4 });
        this.seTone({ type: "triangle", freq: 280 * p, endFreq: 75, dur: 0.14, vol: 0.26 });
        this.seNoise({ dur: 0.07, vol: 0.18, filterType: "highpass", freq: 2600, delay: 0.03 });
        break;
      }

      case "wire": {
        if (!this.canTrigger("wire", 0.22)) return;
        // Taut steel cable twang & creak
        const p = 0.92 + Math.random() * 0.16;
        this.seTone({ type: "sawtooth", freq: 210 * p, endFreq: 390 * p, dur: 0.24, vol: 0.16, filterFreq: 1500 });
        this.seTone({ type: "triangle", freq: 620 * p, endFreq: 480 * p, dur: 0.18, vol: 0.12, delay: 0.02 });
        break;
      }

      case "jack": {
        if (!this.canTrigger("jack", 0.28)) return;
        // Hydraulic lift whine & clunk
        this.seTone({ type: "sawtooth", freq: 145, endFreq: 230, dur: 0.26, vol: 0.16, filterFreq: 800 });
        this.seNoise({ dur: 0.18, vol: 0.12, filterType: "bandpass", freq: 1900, q: 2.5 });
        break;
      }

      case "weight": {
        if (!this.canTrigger("weight", 0.12)) return;
        const intensity = Math.min(1, Math.max(0.35, (data.impact || 120) / 360));
        this.seTone({ type: "sine", freq: 140, endFreq: 42, dur: 0.24, vol: 0.42 * intensity });
        this.seTone({ type: "triangle", freq: 340, endFreq: 180, dur: 0.12, vol: 0.22 * intensity });
        this.seNoise({ dur: 0.14, vol: 0.22 * intensity, filterType: "lowpass", freq: 900 });
        break;
      }

      case "pad": {
        if (!this.canTrigger("pad", 0.12)) return;
        const intensity = Math.min(1, Math.max(0.35, (data.impact || 120) / 360));
        // Soft rubbery cushion absorb thump
        this.seTone({ type: "sine", freq: 185, endFreq: 72, dur: 0.18, vol: 0.34 * intensity });
        this.seTone({ type: "sine", freq: 95, endFreq: 155, dur: 0.12, vol: 0.14 * intensity, delay: 0.05 });
        this.seNoise({ dur: 0.1, vol: 0.14 * intensity, filterType: "lowpass", freq: 480 });
        break;
      }

      case "impact": {
        if (!this.canTrigger("impact", 0.065)) return;
        const impulse = data.impulse || 160;
        const norm = Math.min(1, Math.max(0.18, (impulse - 90) / 480));
        const p = 0.82 + Math.random() * 0.36;
        // Heavy rubble / beam impact rumble
        this.seTone({ type: "sine", freq: 118 * p, endFreq: 36, dur: 0.16 + norm * 0.18, vol: 0.34 * norm });
        this.seNoise({
          dur: 0.14 + norm * 0.22,
          vol: 0.32 * norm,
          filterType: "lowpass",
          freq: (650 + norm * 1100) * p,
          endFreq: 160,
        });
        break;
      }

      case "dangerHit": {
        if (!this.canTrigger("dangerHit", 0.18)) return;
        // Protected asset damaged: crunch + alarm warning pip!
        this.seNoise({ dur: 0.2, vol: 0.3, filterType: "bandpass", freq: 2200, endFreq: 600, q: 1.1 });
        this.seTone({ type: "square", freq: 740, dur: 0.08, vol: 0.15, filterFreq: 1800 });
        this.seTone({ type: "square", freq: 520, dur: 0.12, vol: 0.16, delay: 0.085, filterFreq: 1600 });
        break;
      }

      // --- Result Jingles ---

      case "clear": {
        const stars = clampInt(data.stars, 1, 3, 1);
        this.duckBgm(0.15, stars === 3 ? 2.4 : 1.8, 0.75);
        // Upbeat Osaka Jazz-Brass Victory Fanfare!
        const notes =
          stars === 3
            ? [
                [65, 0, 0.12],
                [69, 0.11, 0.12],
                [72, 0.22, 0.12],
                [77, 0.34, 0.16],
                [76, 0.5, 0.12],
                [77, 0.62, 0.14],
                [81, 0.78, 0.65],
              ]
            : stars === 2
              ? [
                  [65, 0, 0.12],
                  [69, 0.12, 0.12],
                  [72, 0.24, 0.14],
                  [77, 0.4, 0.52],
                ]
              : [
                  [65, 0, 0.13],
                  [69, 0.13, 0.13],
                  [72, 0.28, 0.42],
                ];

        for (const [midi, delay, dur] of notes) {
          const f = midiToFreq(midi);
          this.seTone({ type: "sawtooth", freq: f, dur, vol: 0.18, delay, filterFreq: 2100 });
          this.seTone({ type: "triangle", freq: f * 0.5, dur, vol: 0.16, delay });
        }
        // Final warm major chord shimmer
        const chordDelay = stars === 3 ? 0.78 : stars === 2 ? 0.4 : 0.28;
        for (const m of [65, 69, 72, 76]) {
          this.seTone({ type: "sine", freq: midiToFreq(m), dur: 0.75, vol: 0.11, delay: chordDelay });
        }
        break;
      }

      case "fail": {
        this.duckBgm(0.14, 1.9, 0.8);
        // Comedic shady-contractor muted trombone "wah-wah-waaaah"
        const steps = [
          [62, 61.4, 0, 0.26],
          [61, 60.3, 0.28, 0.26],
          [60, 59.3, 0.56, 0.26],
          [59, 56.5, 0.84, 0.72],
        ];
        for (const [startM, endM, delay, dur] of steps) {
          this.seTone({
            type: "sawtooth",
            freq: midiToFreq(startM),
            endFreq: midiToFreq(endM),
            dur,
            vol: 0.2,
            delay,
            attack: 0.02,
            filterFreq: 980,
          });
        }
        break;
      }

      case "testSE": {
        // Fun preview combo: quick tool click + mini pop + chime
        this.seTone({ type: "triangle", freq: 523.25, dur: 0.09, vol: 0.2 });
        this.seTone({ type: "sine", freq: 140, endFreq: 48, dur: 0.16, vol: 0.28, delay: 0.08 });
        this.seNoise({ dur: 0.12, vol: 0.2, filterType: "lowpass", freq: 1400, endFreq: 240, delay: 0.08 });
        this.seTone({ type: "sine", freq: 783.99, dur: 0.12, vol: 0.2, delay: 0.18 });
        this.seTone({ type: "sine", freq: 1046.5, dur: 0.24, vol: 0.22, delay: 0.26 });
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Unified Event Router (called from surgical game hooks & DOM observers)
  // -------------------------------------------------------------------------

  emit(event, payload = {}) {
    switch (event) {
      case "enterGame":
        this.inTitle = false;
        if (payload.chapter) this.currentChapter = payload.chapter;
        this.syncBgm();
        break;

      case "returnTitle":
        this.inTitle = true;
        this.inStory = false;
        this.mode = "edit";
        this.paused = false;
        this.syncBgm();
        break;

      case "stageLoad":
        if (payload.chapter) this.currentChapter = payload.chapter;
        this.mode = "edit";
        this.paused = false;
        this.syncBgm();
        break;

      case "storyStart":
        this.inStory = true;
        this.storyId = payload.id || null;
        this.syncBgm();
        break;

      case "storyEnd":
        this.inStory = false;
        this.storyId = null;
        this.syncBgm();
        break;

      case "storyLine":
        this.playSE("storyLine", payload);
        break;

      case "toolSelect":
        this.playSE("toolSelect", payload);
        break;

      case "anchorPick":
        this.playSE("anchorPick", payload);
        break;

      case "toolPlace":
        this.playSE("toolPlace", payload);
        break;

      case "toolRemove":
        this.playSE("toolRemove", payload);
        break;

      case "error":
        this.playSE("uiError");
        break;

      case "runStart":
        this.mode = "running";
        this.paused = false;
        if (payload.chapter) this.currentChapter = payload.chapter;
        this.playSE("startRun");
        this.syncBgm();
        break;

      case "pauseToggle":
        this.paused = Boolean(payload.paused);
        this.playSE("pauseToggle", payload);
        this.syncBgm();
        break;

      case "editMode":
        this.mode = "edit";
        this.paused = false;
        this.syncBgm();
        break;

      case "result":
        this.mode = "result";
        this.paused = false;
        this.syncBgm();
        if (payload.success) {
          this.playSE("clear", { stars: payload.stars });
        } else {
          this.playSE("fail");
        }
        break;

      case "simEvent": {
        const k = payload.kind;
        if (k === "blast") this.playSE("blast");
        else if (k === "precise") this.playSE("precise");
        else if (k === "cut") this.playSE("cut");
        else if (k === "break") this.playSE("break");
        else if (k === "wire") this.playSE("wire");
        else if (k === "jack") this.playSE("jack");
        else if (k === "weight") this.playSE("weight", payload);
        else if (k === "pad") this.playSE("pad", payload);
        else if (k === "neighborHit" || k === "safeHit") this.playSE("dangerHit", payload);
        break;
      }

      case "simImpact":
        this.playSE("impact", payload);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Gameplay & Display Preferences Controller
// ---------------------------------------------------------------------------

const PREFS_STORAGE_KEY = "inchiki_kaitai_prefs_v1";

const DEFAULT_PREFS = {
  defaultSpeed: 1,       // 0.5 | 1 | 2
  showOutline: false,    // keep original building outline during demolition
  showGuide: true,       // show floating quick-guide tips
  reducedMotion: false,  // reduce explosion rings, dust, and pulsing rings
  invertZoom: false,     // invert wheel zoom direction
};

function sanitizeSpeed(v) {
  const n = Number(v);
  if (n === 0.5 || n === 1 || n === 2) return n;
  return DEFAULT_PREFS.defaultSpeed;
}

class GamePreferences {
  constructor() {
    this.prefs = this.load();
    this.listeners = new Set();
    this.applyDOM();
  }

  load() {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw);
      return {
        defaultSpeed: sanitizeSpeed(parsed.defaultSpeed),
        showOutline: Boolean(parsed.showOutline),
        showGuide: parsed.showGuide === undefined ? DEFAULT_PREFS.showGuide : Boolean(parsed.showGuide),
        reducedMotion: Boolean(parsed.reducedMotion),
        invertZoom: Boolean(parsed.invertZoom),
      };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  save() {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // ignore storage errors
    }
  }

  get() {
    return this.prefs;
  }

  isReducedMotion() {
    return this.prefs.reducedMotion || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  applyDOM() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.reducedMotion = String(this.prefs.reducedMotion);
    root.dataset.hideGuide = String(!this.prefs.showGuide);
  }

  update(patch) {
    if ("defaultSpeed" in patch) patch.defaultSpeed = sanitizeSpeed(patch.defaultSpeed);
    Object.assign(this.prefs, patch);
    this.save();
    this.applyDOM();
    for (const fn of this.listeners) {
      try {
        fn(this.prefs);
      } catch {
        // ignore
      }
    }
  }

  reset() {
    this.prefs = { ...DEFAULT_PREFS };
    this.save();
    this.applyDOM();
    for (const fn of this.listeners) {
      try {
        fn(this.prefs);
      } catch {
        // ignore
      }
    }
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

// ---------------------------------------------------------------------------
// Settings UI Builder & DOM Integration
// ---------------------------------------------------------------------------

const ICON_SPEAKER_ON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.8 5.8a9 9 0 0 1 0 12.4"/></svg>`;
const ICON_SPEAKER_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`;
const ICON_NOTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

function mountAudioUI(engine, prefsStore) {
  const dialog = document.getElementById("title-options-dialog");
  if (!dialog) return;

  const body = dialog.querySelector(".dialog-body");
  const existingForm = body?.querySelector("form");
  const closeBtn = existingForm?.querySelector('button[type="submit"]');
  if (!body || !existingForm || !closeBtn) return;

  existingForm.classList.add("dialog-footer");

  // Insert subtitle under <h2>設定</h2>
  const heading = document.getElementById("title-options-heading");
  const subtitle = document.createElement("p");
  subtitle.className = "audio-settings-subtitle";
  subtitle.textContent = "サウンド・操作・表示の設定を変更できます（自動保存）";
  heading?.insertAdjacentElement("afterend", subtitle);

  // Build settings panel
  const container = document.createElement("div");
  container.className = "audio-settings";
  container.innerHTML = `
    <p class="settings-section-title">サウンド</p>
    <div class="audio-settings-card" role="group" aria-label="音量調整">
      ${renderChannelRow("master", "全体音量", "MASTER")}
      ${renderChannelRow("bgm", "BGM音量", "BGM")}
      ${renderChannelRow("se", "効果音音量", "SE")}
      <div class="audio-now-playing">
        <span>${ICON_NOTE} 再生中BGM</span>
        <strong id="audio-track-name"></strong>
      </div>
      <div class="audio-settings-tools">
        <button type="button" class="audio-mini-btn" id="audio-test-se">効果音テスト</button>
      </div>
    </div>

    <p class="settings-section-title">ゲームプレイ・表示</p>
    <div class="audio-settings-card" role="group" aria-label="ゲームプレイ・表示設定">
      <div class="pref-row">
        <div class="pref-copy">
          <span class="pref-title">解体時の標準再生速度</span>
          <span class="pref-desc">解体開始時のスピードをあらかじめ指定します</span>
        </div>
        <div class="pref-segment" role="group" aria-label="標準再生速度">
          <button type="button" data-pref-speed="0.5" aria-pressed="false">0.5×</button>
          <button type="button" data-pref-speed="1" aria-pressed="true">1×</button>
          <button type="button" data-pref-speed="2" aria-pressed="false">2×</button>
        </div>
      </div>

      ${renderSwitchRow("showOutline", "解体中に元の形を表示", "建物が崩れる前の輪郭をうっすら残して見比べやすくします")}
      ${renderSwitchRow("showGuide", "操作ガイドを表示", "新しい道具が登場したときの説明パネルを表示します")}
      ${renderSwitchRow("reducedMotion", "演出をひかえめにする", "爆発の波紋・砂煙・点滅アニメーションを抑えます")}
      ${renderSwitchRow("invertZoom", "ホイールズームを反転", "マウスホイール／トラックパッドの拡大縮小方向を逆にします")}
    </div>

    <div class="audio-settings-tools">
      <button type="button" class="audio-mini-btn" id="audio-reset-defaults">設定を初期値に戻す</button>
      <button type="button" class="audio-mini-btn danger" id="settings-reset-save">進行データを初期化…</button>
    </div>
  `;

  existingForm.insertAdjacentElement("beforebegin", container);

  const channels = ["master", "bgm", "se"];
  const refs = {};
  for (const ch of channels) {
    refs[ch] = {
      row: container.querySelector(`.audio-row[data-channel="${ch}"]`),
      slider: container.querySelector(`.audio-slider[data-channel="${ch}"]`),
      muteBtn: container.querySelector(`.audio-mute-btn[data-channel="${ch}"]`),
      value: container.querySelector(`.audio-row-value[data-channel="${ch}"]`),
    };
  }
  const trackNameEl = container.querySelector("#audio-track-name");
  const speedBtns = [...container.querySelectorAll("[data-pref-speed]")];
  const switchBtns = [...container.querySelectorAll("[data-pref-switch]")];
  const resetSaveBtn = container.querySelector("#settings-reset-save");

  function syncAudioControls(settings) {
    for (const ch of channels) {
      const muted = settings[`${ch}Muted`];
      const val = settings[ch];
      const { row, slider, muteBtn, value } = refs[ch];
      row.dataset.muted = String(muted);
      slider.value = String(val);
      slider.style.setProperty("--pct", `${val}%`);
      muteBtn.setAttribute("aria-pressed", String(muted));
      muteBtn.setAttribute("aria-label", `${ch.toUpperCase()}を${muted ? "ミュート解除" : "ミュート"}`);
      muteBtn.innerHTML = muted ? ICON_SPEAKER_OFF : ICON_SPEAKER_ON;
      value.textContent = muted ? "MUTE" : `${val}%`;
    }
    if (trackNameEl) {
      trackNameEl.textContent = engine.getTrackLabel();
    }
  }

  function syncPrefControls(prefs) {
    for (const btn of speedBtns) {
      btn.setAttribute("aria-pressed", String(Number(btn.dataset.prefSpeed) === prefs.defaultSpeed));
    }
    for (const btn of switchBtns) {
      const key = btn.dataset.prefSwitch;
      btn.setAttribute("aria-checked", String(Boolean(prefs[key])));
    }
    if (resetSaveBtn) {
      const continueBtn = document.getElementById("title-continue");
      resetSaveBtn.disabled = Boolean(continueBtn?.disabled);
    }
  }

  for (const ch of channels) {
    const { slider, muteBtn } = refs[ch];
    let lastPreview = 0;

    slider.addEventListener("input", () => {
      engine.unlock();
      const val = clampInt(slider.value, 0, 100, DEFAULT_SETTINGS[ch]);
      const patch = { [ch]: val };
      if (val > 0 && engine.settings[`${ch}Muted`]) {
        patch[`${ch}Muted`] = false;
      }
      engine.updateSettings(patch);

      if (ch === "se" || ch === "master") {
        const now = performance.now();
        if (now - lastPreview > 180) {
          lastPreview = now;
          engine.playSE("uiClick");
        }
      }
    });

    muteBtn.addEventListener("click", () => {
      engine.unlock();
      const key = `${ch}Muted`;
      const nextMuted = !engine.settings[key];
      engine.updateSettings({ [key]: nextMuted });
      if (!nextMuted) engine.playSE("uiClick");
    });
  }

  for (const btn of speedBtns) {
    btn.addEventListener("click", () => {
      engine.unlock();
      prefsStore.update({ defaultSpeed: Number(btn.dataset.prefSpeed) });
      engine.playSE("uiClick");
    });
  }

  for (const btn of switchBtns) {
    btn.addEventListener("click", () => {
      engine.unlock();
      const key = btn.dataset.prefSwitch;
      const next = !prefsStore.get()[key];
      prefsStore.update({ [key]: next });
      engine.playSE("uiClick");
    });
  }

  container.querySelector("#audio-test-se")?.addEventListener("click", () => {
    engine.unlock();
    engine.playSE("testSE");
  });

  container.querySelector("#audio-reset-defaults")?.addEventListener("click", () => {
    engine.unlock();
    engine.resetSettings();
    prefsStore.reset();
    engine.playSE("uiConfirm");
  });

  resetSaveBtn?.addEventListener("click", () => {
    engine.unlock();
    const newGameDialog = document.getElementById("new-game-dialog");
    const err = document.getElementById("new-game-error");
    if (err) err.hidden = true;
    dialog.close();
    if (newGameDialog && !newGameDialog.open) {
      newGameDialog.showModal();
    }
  });

  // Update close button label depending on whether opened from Title or In-Game
  function openOptionsDialog(fromInGame) {
    engine.unlock();
    closeBtn.textContent = fromInGame ? "閉じる" : "タイトルへ戻る";
    syncAudioControls(engine.settings);
    syncPrefControls(prefsStore.get());
    if (!dialog.open) {
      engine.playSE("uiOpen");
      dialog.showModal();
    }
  }

  // Update label whenever opened from title screen's #title-options button
  document.getElementById("title-options")?.addEventListener(
    "click",
    () => {
      engine.unlock();
      closeBtn.textContent = "タイトルへ戻る";
      syncAudioControls(engine.settings);
      syncPrefControls(prefsStore.get());
      engine.playSE("uiOpen");
    },
    true
  );

  dialog.addEventListener("close", () => {
    engine.playSE("uiClose");
  });

  dialog.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") e.stopPropagation();
  });

  // Convenient in-game "設定" access in #menu-panel & .toolbox-actions
  const returnTitleBtn = document.getElementById("return-title");
  if (returnTitleBtn && !document.getElementById("menu-audio-options")) {
    const menuAudioBtn = document.createElement("button");
    menuAudioBtn.type = "button";
    menuAudioBtn.id = "menu-audio-options";
    menuAudioBtn.className = "button menu-audio-btn";
    menuAudioBtn.textContent = "設定";
    menuAudioBtn.addEventListener("click", () => {
      const menuPanel = document.getElementById("menu-panel");
      if (menuPanel) menuPanel.hidden = true;
      document.getElementById("game-menu")?.setAttribute("aria-expanded", "false");
      openOptionsDialog(true);
    });
    returnTitleBtn.insertAdjacentElement("beforebegin", menuAudioBtn);
  }

  const toolboxActions = document.querySelector(".toolbox-actions");
  const helpBtn = document.getElementById("help");
  if (toolboxActions && helpBtn && !document.getElementById("toolbox-audio-options")) {
    const railAudioBtn = document.createElement("button");
    railAudioBtn.type = "button";
    railAudioBtn.id = "toolbox-audio-options";
    railAudioBtn.textContent = "設定";
    railAudioBtn.addEventListener("click", () => openOptionsDialog(true));
    helpBtn.insertAdjacentElement("afterend", railAudioBtn);
  }

  engine.onUIChange((settings) => syncAudioControls(settings));
  prefsStore.onChange((prefs) => syncPrefControls(prefs));
  syncAudioControls(engine.settings);
  syncPrefControls(prefsStore.get());
}

function renderChannelRow(channel, label, tag) {
  return `
    <div class="audio-row" data-channel="${channel}" data-muted="false">
      <div class="audio-row-header">
        <label class="audio-row-label" for="audio-slider-${channel}">
          <span>${label}</span>
          <span class="audio-row-tag">${tag}</span>
        </label>
        <output class="audio-row-value" data-channel="${channel}" for="audio-slider-${channel}">${DEFAULT_SETTINGS[channel]}%</output>
      </div>
      <button type="button" class="audio-mute-btn" data-channel="${channel}" aria-pressed="false" aria-label="${label}をミュート">${ICON_SPEAKER_ON}</button>
      <input type="range" id="audio-slider-${channel}" class="audio-slider" data-channel="${channel}" min="0" max="100" step="1" value="${DEFAULT_SETTINGS[channel]}">
    </div>
  `;
}

function renderSwitchRow(key, title, desc) {
  return `
    <div class="pref-row">
      <div class="pref-copy">
        <span class="pref-title" id="pref-label-${key}">${title}</span>
        <span class="pref-desc">${desc}</span>
      </div>
      <button type="button" class="pref-switch" role="switch" data-pref-switch="${key}" aria-checked="false" aria-labelledby="pref-label-${key}"></button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Global Initialization & Automatic UI Sound Binding
// ---------------------------------------------------------------------------

const engine = new GameAudioEngine();
const prefsStore = new GamePreferences();
window.__gameAudio = engine;
window.__gamePrefs = prefsStore;

function bindGlobalInteractions() {
  const unlockHandler = () => engine.unlock();
  window.addEventListener("pointerdown", unlockHandler, { capture: true, passive: true });
  window.addEventListener("keydown", unlockHandler, { capture: true, passive: true });

  document.addEventListener("visibilitychange", () => {
    if (!engine.ctx) return;
    if (document.hidden) {
      engine.ctx.suspend().catch(() => {});
    } else if (engine.ctx.state === "suspended") {
      engine.ctx.resume().then(() => engine.syncBgm()).catch(() => {});
    }
  });

  // Tactile click SE across standard UI buttons
  document.addEventListener("click", (e) => {
    const btn = e.target instanceof Element ? e.target.closest("button") : null;
    if (!btn || btn.disabled) return;
    engine.unlock();

    const id = btn.id;
    // Buttons that already emit dedicated SE via game hooks or custom handlers
    if (
      btn.hasAttribute("data-tool") ||
      btn.hasAttribute("data-pref-speed") ||
      btn.hasAttribute("data-pref-switch") ||
      id === "run" ||
      id === "remove-equipment" ||
      id === "pause" ||
      id === "story-next" ||
      id === "title-options" ||
      id === "audio-test-se" ||
      id === "audio-reset-defaults" ||
      btn.classList.contains("audio-mute-btn")
    ) {
      return;
    }

    if (id === "title-continue" || id === "title-new") {
      engine.playSE("uiConfirm");
    } else if (id === "next-hint") {
      engine.playSE("hint");
    } else if (id === "reset") {
      engine.playSE("reset");
    } else if (id === "help" || id === "title-story" || id === "game-menu" || id === "settings-reset-save") {
      engine.playSE("uiOpen");
    } else if (id === "close-help" || id === "close-equipment" || id === "cancel-new-game" || id === "story-skip") {
      engine.playSE("uiClose");
    } else {
      engine.playSE("uiClick");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    mountAudioUI(engine, prefsStore);
    bindGlobalInteractions();
  });
} else {
  mountAudioUI(engine, prefsStore);
  bindGlobalInteractions();
}
