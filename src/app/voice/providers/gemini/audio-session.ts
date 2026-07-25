/** Browser mic capture (16 kHz PCM) and model audio playback (24 kHz PCM). */

const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === INPUT_SAMPLE_RATE) {
    const pcm = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm;
  }

  const ratio = inputSampleRate / INPUT_SAMPLE_RATE;
  const length = Math.round(input.length / ratio);
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, input[idx]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export class GeminiLiveAudio {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private playbackTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();

  async start(onPcmChunk: (pcm16: ArrayBuffer) => void): Promise<void> {
    this.audioContext = new AudioContext();
    await this.audioContext.resume();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    // ScriptProcessor is deprecated but widely supported and keeps the adapter self-contained.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    const sampleRate = this.audioContext.sampleRate;

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = downsampleTo16k(input, sampleRate);
      onPcmChunk(new Uint8Array(pcm).buffer);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.playbackTime = this.audioContext.currentTime;
  }

  playModelAudio(base64Pcm: string): void {
    if (!this.audioContext || !base64Pcm) return;

    const int16 = base64ToInt16Array(base64Pcm);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = this.audioContext.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const node = this.audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(this.audioContext.destination);

    const startAt = Math.max(this.playbackTime, this.audioContext.currentTime);
    node.start(startAt);
    this.playbackTime = startAt + buffer.duration;

    this.activeSources.add(node);
    node.onended = () => this.activeSources.delete(node);
  }

  clearPlayback(): void {
    for (const node of this.activeSources) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.activeSources.clear();
    if (this.audioContext) {
      this.playbackTime = this.audioContext.currentTime;
    }
  }

  stop(): void {
    this.clearPlayback();
    this.processor?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.source = null;
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    void this.audioContext?.close();
    this.audioContext = null;
  }

  sendChunkAsBase64(pcm16: ArrayBuffer): { data: string; mimeType: string } {
    return {
      data: arrayBufferToBase64(pcm16),
      mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
    };
  }
}
