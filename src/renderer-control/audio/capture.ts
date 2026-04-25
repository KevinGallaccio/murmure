import { getWorkletObjectUrl } from './pcm16-worklet';

export type AudioCaptureCallbacks = {
  onChunk: (buffer: ArrayBuffer) => void;
  onRms: (rms: number) => void;
  onError: (err: Error) => void;
};

export class AudioCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private deviceId: string | null = null;

  constructor(private cb: AudioCaptureCallbacks) {}

  async start(deviceId: string | null): Promise<void> {
    await this.stop();
    this.deviceId = deviceId;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId
        ? {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: { ideal: 2 },
          }
        : {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: { ideal: 2 },
          },
      video: false,
    });
    this.stream = stream;

    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.context = ctx;
    if (ctx.state === 'suspended') await ctx.resume();

    await ctx.audioWorklet.addModule(getWorkletObjectUrl());
    const node = new AudioWorkletNode(ctx, 'pcm16-downsampler', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
    node.port.onmessage = (ev) => {
      const data = ev.data as { type: string };
      if (data.type === 'pcm16') {
        this.cb.onChunk((ev.data as { buffer: ArrayBuffer }).buffer);
      } else if (data.type === 'rms') {
        this.cb.onRms((ev.data as { value: number }).value);
      }
    };
    this.node = node;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(node);
    this.source = source;

    // detect device disappearance
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => this.cb.onError(new Error("Le périphérique audio a été déconnecté."));
    });
  }

  async stop(): Promise<void> {
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }
    if (this.node) {
      try {
        this.node.port.onmessage = null;
        this.node.disconnect();
      } catch {
        // ignore
      }
      this.node = null;
    }
    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // ignore
      }
      this.context = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  isRunning(): boolean {
    return this.context !== null;
  }

  currentDeviceId(): string | null {
    return this.deviceId;
  }
}
