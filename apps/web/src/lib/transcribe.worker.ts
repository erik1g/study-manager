// Whisper in the browser, in a worker so that the page stays usable. The
// model (about 1 GB) is downloaded once and kept in the browser's cache.
import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

const SAMPLE_RATE = 16_000;
/** The audio goes through Whisper in blocks of five minutes, for progress and memory. */
const BLOCK_SECONDS = 300;

let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let modelName = "";

const post = (message: unknown) => (self as unknown as Worker).postMessage(message);

async function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  const adapter = await gpu?.requestAdapter().catch(() => null);
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (info: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (info.status === "progress" && info.file && info.total) {
      files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
      const all = [...files.values()];
      post({ type: "progress", phase: "model", value: all.reduce((s, f) => s + f.loaded, 0) / all.reduce((s, f) => s + f.total, 0) });
    }
  };
  // With a graphics card the large model; without it a small one, still slow.
  modelName = adapter ? "Whisper large-v3-turbo" : "Whisper small";
  return adapter
    ? ((await pipeline("automatic-speech-recognition", "onnx-community/whisper-large-v3-turbo", {
        device: "webgpu",
        dtype: { encoder_model: adapter.features.has("shader-f16") ? "fp16" : "fp32", decoder_model_merged: "q4" },
        progress_callback,
      })) as AutomaticSpeechRecognitionPipeline)
    : ((await pipeline("automatic-speech-recognition", "onnx-community/whisper-small", {
        device: "wasm",
        dtype: "q8",
        progress_callback,
      })) as AutomaticSpeechRecognitionPipeline);
}

self.onmessage = async (event: MessageEvent<{ type: "run" | "test"; samples: Float32Array; language: string | null }>) => {
  const { type, samples, language } = event.data;
  try {
    recognizer ??= load();
    const asr = await recognizer;
    post({ type: "progress", phase: "transcribing", value: 0 });
    if (type === "test") {
      // The first run also prepares the graphics card, so only the second counts.
      await asr(samples.subarray(0, 5 * SAMPLE_RATE), { chunk_length_s: 30, language: "de", task: "transcribe" });
      post({ type: "progress", phase: "transcribing", value: 0.3 });
      const started = performance.now();
      await asr(samples, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, language: "de", task: "transcribe" });
      post({ type: "speed", seconds: (performance.now() - started) / 1000, model: modelName });
      return;
    }
    const block = BLOCK_SECONDS * SAMPLE_RATE;
    const blocks = Math.ceil(samples.length / block);
    for (let i = 0; i < blocks; i++) {
      const audio = samples.subarray(i * block, (i + 1) * block);
      const result = (await asr(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        ...(language && { language, task: "transcribe" }),
      })) as { chunks?: { timestamp: [number, number | null]; text: string }[]; text: string };
      const offset = i * BLOCK_SECONDS;
      const segments = (result.chunks ?? [{ timestamp: [0, BLOCK_SECONDS], text: result.text }]).map((chunk) => ({
        start: offset + (chunk.timestamp[0] ?? 0),
        end: offset + (chunk.timestamp[1] ?? chunk.timestamp[0] ?? 0),
        text: chunk.text,
      }));
      post({ type: "segments", segments });
      post({ type: "progress", phase: "transcribing", value: (i + 1) / blocks });
    }
    post({ type: "done" });
  } catch (error) {
    post({ type: "error", message: String((error as Error).message ?? error) });
  }
};
