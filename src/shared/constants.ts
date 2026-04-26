export const ASSEMBLY_WS_BASE = 'wss://streaming.assemblyai.com/v3/ws';

export const ASSEMBLY_PARAMS = {
  sample_rate: 16000,
  encoding: 'pcm_s16le',
  speech_model: 'u3-rt-pro',
  language: 'fr',
  format_turns: true,
  // Turn-detection tuning (defaults: 160 / 2400 ms).
  // We bias toward more frequent finals so the audience sees committed text
  // on every breath/comma pause, not only at the end of a long utterance.
  min_end_of_turn_silence_when_confident: 100,
  max_turn_silence: 1400,
} as const;

export const TARGET_SAMPLE_RATE = 16000;
export const CHUNK_SAMPLES = 1600;

export const ASSEMBLY_DASHBOARD_URL = 'https://www.assemblyai.com/dashboard/account/billing';

export const DEFAULT_RATE_PER_HOUR = 0.45;

export const RECONNECT_BACKOFF_MS = [1000, 2000, 4000];

// If the current turn has been growing for this long without a final, send
// a ForceEndpoint to AssemblyAI to commit what's there. Without this, very
// long pause-free monologues (e.g. fast-paced podcast guests) only commit
// after the speaker finally breathes — and arrive on screen as one
// hard-to-follow block.
export const FORCE_ENDPOINT_MS = 5000;

export const USAGE_CHECKPOINT_INTERVAL_MS = 30_000;

export const MOCK_FRENCH_LINES = [
  "Demain dès l'aube, à l'heure où blanchit la campagne, je partirai.",
  "Vois-tu, je sais que tu m'attends.",
  "J'irai par la forêt, j'irai par la montagne.",
  "Je ne puis demeurer loin de toi plus longtemps.",
  "Je marcherai les yeux fixés sur mes pensées,",
  "sans rien voir au dehors, sans entendre aucun bruit,",
  "seul, inconnu, le dos courbé, les mains croisées,",
  "triste, et le jour pour moi sera comme la nuit.",
  "Je ne regarderai ni l'or du soir qui tombe,",
  "ni les voiles au loin descendant vers Harfleur,",
  "et quand j'arriverai, je mettrai sur ta tombe",
  "un bouquet de houx vert et de bruyère en fleur.",
];
