// Source for the AudioWorklet processor that downsamples mic input to 16 kHz PCM16.
// Inlined into the renderer at runtime via a Blob URL because AudioWorkletGlobalScope
// can't import from the bundle.
//
// Behavior:
//   - Averages stereo to mono.
//   - 1st-order lowpass pre-filter, then naive decimation to 16 kHz.
//   - Buffers ~100 ms (1600 samples) of int16 LE before posting.
//   - Periodically posts a normalized RMS value for the VU meter.

export const pcm16WorkletSource = String.raw`
class Pcm16Downsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.ratio = sampleRate / this.targetSampleRate; // typically 3 (48000/16000)
    this.bufferSize = 1600; // ~100 ms at 16 kHz
    this.outBuffer = new Int16Array(this.bufferSize);
    this.outIndex = 0;
    this.lpZ = 0; // 1st-order IIR state
    this.lpAlpha = 0.4; // gentle lowpass; adequate for speech
    this.frac = 0; // fractional counter for resampling
    this.rmsAcc = 0;
    this.rmsCount = 0;
    this.lastRmsPostFrame = 0;
    this.frameCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channels = input.length;
    const len = input[0].length;

    for (let i = 0; i < len; i++) {
      // average to mono
      let sum = 0;
      for (let c = 0; c < channels; c++) sum += input[c][i] || 0;
      const sample = sum / channels;
      // running RMS
      this.rmsAcc += sample * sample;
      this.rmsCount++;
      // lowpass
      this.lpZ = this.lpZ + this.lpAlpha * (sample - this.lpZ);
      // decimate (advance fractional counter)
      this.frac += 1;
      if (this.frac >= this.ratio) {
        this.frac -= this.ratio;
        let s = this.lpZ;
        if (s > 1) s = 1;
        else if (s < -1) s = -1;
        this.outBuffer[this.outIndex++] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
        if (this.outIndex >= this.bufferSize) {
          const copy = new Int16Array(this.outBuffer);
          this.port.postMessage({ type: 'pcm16', buffer: copy.buffer }, [copy.buffer]);
          this.outIndex = 0;
        }
      }
    }
    this.frameCount++;
    // post RMS roughly every ~50 ms (i.e. every 10 quanta of 128 samples at 48kHz ~= 26.6ms; tweak)
    if (this.frameCount - this.lastRmsPostFrame >= 8) {
      this.lastRmsPostFrame = this.frameCount;
      const rms = this.rmsCount > 0 ? Math.sqrt(this.rmsAcc / this.rmsCount) : 0;
      this.port.postMessage({ type: 'rms', value: rms });
      this.rmsAcc = 0;
      this.rmsCount = 0;
    }
    return true;
  }
}
registerProcessor('pcm16-downsampler', Pcm16Downsampler);
`;

let workletObjectUrl: string | null = null;

export function getWorkletObjectUrl(): string {
  if (workletObjectUrl) return workletObjectUrl;
  const blob = new Blob([pcm16WorkletSource], { type: 'application/javascript' });
  workletObjectUrl = URL.createObjectURL(blob);
  return workletObjectUrl;
}
