import type { Page } from "@playwright/test";
import type { RuntimeTestSnapshot } from "../../src/app/runtimeTestBridge";

type AudioProbe = {
  elements: HTMLAudioElement[];
  analysers: AnalyserNode[];
  contexts: AudioContext[];
  sources: number;
  assignments: { url: string; crossOrigin: string | null }[];
};

declare global {
  interface Window {
    __DSFM_AUDIO_TEST__?: AudioProbe;
  }
}

export async function instrumentAudio(page: Page) {
  await page.addInitScript(() => {
    const probe: AudioProbe = {
      elements: [],
      analysers: [],
      contexts: [],
      sources: 0,
      assignments: [],
    };
    window.__DSFM_AUDIO_TEST__ = probe;
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super(src);
        probe.elements.push(this);
      }
    };
    const src = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "src",
    )!;
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      ...src,
      set(value: string) {
        probe.assignments.push({ url: value, crossOrigin: this.crossOrigin });
        src.set!.call(this, value);
      },
    });
    const createAnalyser = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function () {
      const analyser = createAnalyser.call(this);
      probe.analysers.push(analyser);
      probe.contexts.push(this);
      return analyser;
    };
    const createSource = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (element) {
      probe.sources += 1;
      return createSource.call(this, element);
    };
  });
}

export async function readAudio(page: Page) {
  return page.evaluate(() => {
    const probe = window.__DSFM_AUDIO_TEST__!;
    const audio = probe.elements[0];
    const analyser = probe.analysers[0];
    const data = new Uint8Array(analyser?.frequencyBinCount ?? 0);
    const waveform = new Float32Array(analyser?.fftSize ?? 0);
    analyser?.getByteFrequencyData(data);
    analyser?.getFloatTimeDomainData(waveform);
    return {
      elementCount: probe.elements.length,
      analyserCount: probe.analysers.length,
      sourceCount: probe.sources,
      contextStates: probe.contexts.map((context) => context.state),
      assignments: probe.assignments,
      src: audio?.currentSrc,
      paused: audio?.paused,
      volume: audio?.volume,
      error: audio?.error?.message ?? null,
      currentTime: audio?.currentTime ?? 0,
      frequencySum: data.reduce((sum, value) => sum + value, 0),
      rms: waveform.length
        ? Math.sqrt(waveform.reduce((sum, value) => sum + value * value, 0) / waveform.length)
        : 0,
      runtime: window.__DSFM_TEST__ as RuntimeTestSnapshot | undefined,
    };
  });
}
