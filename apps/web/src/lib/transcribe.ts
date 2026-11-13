// Transcribing a lecture without the server doing the work: the browser
// decodes the sound track and either runs Whisper itself (WebGPU) or sends
// the audio, in pieces, to a transcription service with the member's own
// key. The key never leaves the browser.

import type { Locale } from "@study/shared";
import { t } from "../i18n";

export interface Segment {
  /** Seconds from the start. */
  start: number;
  end: number;
  text: string;
}

export type Phase = "audio" | "model" | "transcribing" | "uploading";
export type Progress = (phase: Phase, fraction: number) => void;

export const SAMPLE_RATE = 16_000;

export function timestamp(seconds: number): string {
  const s = Math.floor(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** How long a paragraph runs before a new one starts. */
const PARAGRAPH = 60;

/** The words of a transcript's header, in the course's language: everyone in the course reads it. */
const HEADER: Record<Locale, { duration: string; language: string; languages: Record<string, string>; auto: string; note: string; intl: string }> = {
  en: {
    duration: "Duration",
    language: "Language",
    languages: { de: "German", en: "English" },
    auto: "detected automatically",
    note: "*Transcribed automatically; names and technical terms may be misspelt.*",
    intl: "en-GB",
  },
  de: {
    duration: "Dauer",
    language: "Sprache",
    languages: { de: "Deutsch", en: "Englisch" },
    auto: "automatisch erkannt",
    note: "*Automatisch transkribiert; Namen und Fachbegriffe können falsch geschrieben sein.*",
    intl: "de-DE",
  },
};

/**
 * The transcript as Markdown: a header in the course's language, then
 * paragraphs of about a minute, each with when it was said.
 */
export function toMarkdown(
  title: string,
  course: { title: string; locale: Locale },
  day: string,
  language: string | null,
  duration: number,
  segments: Segment[],
): string {
  const words = HEADER[course.locale];
  const languageName = language ? (words.languages[language] ?? language) : words.auto;
  const date = new Date(`${day}T00:00:00`).toLocaleDateString(words.intl, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  let text = `# ${title}\n\n${course.title} · ${date} · ${words.duration} ${timestamp(duration)} · ${words.language}: ${languageName}\n\n${words.note}\n`;
  let paragraphStart: number | null = null;
  for (const segment of segments) {
    const words = segment.text.trim();
    if (!words) continue;
    const startsNew = paragraphStart === null || (segment.start - paragraphStart >= PARAGRAPH && /^\p{Lu}/u.test(words));
    if (startsNew) {
      text += `\n**[${timestamp(segment.start)}]** `;
      paragraphStart = segment.start;
    } else {
      text += " ";
    }
    text += words;
  }
  return `${text.replace(/\n\*\*\[/g, "\n\n**[")}\n`;
}

/** The sound of an audio or video file, as 16 kHz mono samples. */
export async function decodeAudio(file: File, progress: Progress): Promise<Float32Array> {
  progress("audio", 0);
  const bytes = await file.arrayBuffer();
  progress("audio", 0.4);
  // An audio context at 16 kHz resamples while decoding.
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const decoded = await context.decodeAudioData(bytes);
  progress("audio", 0.9);
  const mono = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const data = decoded.getChannelData(channel);
    for (let i = 0; i < data.length; i++) mono[i]! += data[i]! / decoded.numberOfChannels;
  }
  progress("audio", 1);
  return mono;
}

export interface BrowserCheck {
  /** A graphics card the browser can use. */
  webGpu: boolean;
  /** The card's maker and family, as far as the browser tells. */
  gpuName: string | null;
  /** 16-bit numbers on the card: less memory, faster model. */
  shaderF16: boolean;
  cores: number;
  /** Rounded by the browser; only Chrome and Edge tell. */
  memoryGb: number | null;
  freeStorageGb: number | null;
  /** Whether the model is already in the browser's cache. */
  modelCached: boolean;
}

/** What this browser brings for running Whisper. */
export async function checkBrowser(): Promise<BrowserCheck> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string>; info?: { vendor?: string; architecture?: string } } | null> } }).gpu;
  const adapter = await gpu?.requestAdapter().catch(() => null);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const modelCached = await caches
    .open("transformers-cache")
    .then(async (cache) => (await cache.keys()).some((request) => /whisper/.test(request.url)))
    .catch(() => false);
  return {
    webGpu: !!adapter,
    gpuName: [adapter?.info?.vendor, adapter?.info?.architecture].filter(Boolean).join(" ") || null,
    shaderF16: !!adapter?.features.has("shader-f16"),
    cores: navigator.hardwareConcurrency ?? 0,
    memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    freeStorageGb: estimate?.quota != null ? ((estimate.quota ?? 0) - (estimate.usage ?? 0)) / 1e9 : null,
    modelCached,
  };
}

export type Rating = "good" | "limited" | "slow";

export function rate(check: BrowserCheck): Rating {
  if (!check.webGpu) return "slow";
  return check.shaderF16 ? "good" : "limited";
}

const TEST_SECONDS = 30;

/** Half a minute of noise in the rhythm of speech; enough to time the model. */
function testAudio(): Float32Array {
  const samples = new Float32Array(TEST_SECONDS * SAMPLE_RATE);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const syllables = Math.max(0, Math.sin(2 * Math.PI * 4 * t)) * (Math.sin(2 * Math.PI * 0.3 * t) > -0.6 ? 1 : 0);
    samples[i] = 0.3 * syllables * (Math.random() - 0.5 + 0.5 * Math.sin(2 * Math.PI * 180 * t));
  }
  return samples;
}

export interface SpeedResult {
  model: string;
  /** How many seconds of audio one second of work gets through. */
  factor: number;
}

/** Times Whisper on half a minute of audio. The first time, this loads the model. */
export function testSpeed(progress: Progress, signal: AbortSignal): Promise<SpeedResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
    signal.addEventListener("abort", () => {
      worker.terminate();
      reject(new DOMException("Abgebrochen", "AbortError"));
    });
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "progress") progress(message.phase, message.value);
      else if (message.type === "speed") {
        worker.terminate();
        resolve({ model: message.model, factor: TEST_SECONDS / message.seconds });
      } else if (message.type === "error") {
        worker.terminate();
        reject(new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || t.lectures.workerCrashed));
    };
    const samples = testAudio();
    worker.postMessage({ type: "test", samples, language: "de" }, [samples.buffer]);
  });
}

/** Runs Whisper in a worker in this browser. */
export function transcribeInBrowser(samples: Float32Array, language: string | null, progress: Progress, signal: AbortSignal): Promise<Segment[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
    const segments: Segment[] = [];
    signal.addEventListener("abort", () => {
      worker.terminate();
      reject(new DOMException("Abgebrochen", "AbortError"));
    });
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "progress") progress(message.phase, message.value);
      else if (message.type === "segments") segments.push(...message.segments);
      else if (message.type === "done") {
        worker.terminate();
        resolve(segments);
      } else if (message.type === "error") {
        worker.terminate();
        reject(new Error(message.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || t.lectures.workerCrashed));
    };
    worker.postMessage({ type: "run", samples, language }, [samples.buffer]);
  });
}

export const PROVIDERS = {
  groq: { name: "Groq", url: "https://api.groq.com/openai/v1/audio/transcriptions", model: "whisper-large-v3-turbo" },
  openai: { name: "OpenAI", url: "https://api.openai.com/v1/audio/transcriptions", model: "whisper-1" },
} as const;
export type Provider = keyof typeof PROVIDERS;

/** Ten minutes of 16 kHz mono as 16-bit WAV: about 19 MB, below the services' limits. */
const PIECE_SECONDS = 600;

function wav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Sends the audio in ten-minute pieces to a transcription service with the member's key. */
export async function transcribeWithApi(
  samples: Float32Array,
  options: { provider: Provider; key: string; language: string | null },
  progress: Progress,
  signal: AbortSignal,
): Promise<Segment[]> {
  const provider = PROVIDERS[options.provider];
  const piece = PIECE_SECONDS * SAMPLE_RATE;
  const pieces = Math.ceil(samples.length / piece);
  const segments: Segment[] = [];
  for (let i = 0; i < pieces; i++) {
    progress("transcribing", i / pieces);
    const form = new FormData();
    form.append("file", wav(samples.subarray(i * piece, (i + 1) * piece)), `teil-${i + 1}.wav`);
    form.append("model", provider.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    if (options.language) form.append("language", options.language);
    const response = await fetch(provider.url, { method: "POST", headers: { Authorization: `Bearer ${options.key}` }, body: form, signal });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`${provider.name}: ${response.status} ${detail.slice(0, 200)}`);
    }
    const data = (await response.json()) as { segments?: { start: number; end: number; text: string }[]; text?: string };
    const offset = i * PIECE_SECONDS;
    if (data.segments?.length) {
      segments.push(...data.segments.map((s) => ({ start: s.start + offset, end: s.end + offset, text: s.text })));
    } else if (data.text) {
      segments.push({ start: offset, end: offset + PIECE_SECONDS, text: data.text });
    }
  }
  progress("transcribing", 1);
  return segments;
}

/** Tries a key on one second of silence, the same way a lecture is sent. */
export async function testKey(providerId: Provider, key: string): Promise<void> {
  const provider = PROVIDERS[providerId];
  const form = new FormData();
  form.append("file", wav(new Float32Array(SAMPLE_RATE)), "test.wav");
  form.append("model", provider.model);
  const response = await fetch(provider.url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!response.ok) throw new Error(String(response.status));
}

const KEY_STORE = "study.transcription-key";
const METHOD_STORE = "study.transcription-method";
const PROVIDER_STORE = "study.transcription-provider";

export type Method = "browser" | "api";

const read = (name: string) => {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
};
const write = (name: string, value: string) => {
  try {
    localStorage.setItem(name, value);
  } catch {
    // Private windows may refuse; the choice then lasts until the page is left.
  }
};

/** How this browser transcribes; a matter of the device, so it stays here too. */
export const storedMethod = (): Method => (read(METHOD_STORE) === "api" ? "api" : "browser");
export const storeMethod = (method: Method) => write(METHOD_STORE, method);
export const storedProvider = (): Provider => (read(PROVIDER_STORE) === "openai" ? "openai" : "groq");
export const storeProvider = (provider: Provider) => write(PROVIDER_STORE, provider);

/** The member's key for a service, kept only in this browser. */
export function storedKey(provider: Provider): string {
  try {
    return localStorage.getItem(`${KEY_STORE}.${provider}`) ?? "";
  } catch {
    return "";
  }
}

export function storeKey(provider: Provider, key: string) {
  try {
    if (key) localStorage.setItem(`${KEY_STORE}.${provider}`, key);
    else localStorage.removeItem(`${KEY_STORE}.${provider}`);
  } catch {
    // Private windows may refuse; the key is then asked for again.
  }
}
