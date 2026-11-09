// Turns text into vectors that are close when the meaning is: a small
// multilingual model (German and English) run on the server's processor.
export interface Embedder {
  /** One normalised 384-dimensional vector per text. */
  embed(texts: string[], kind: "query" | "passage"): Promise<number[][]>;
}

export const DIMENSIONS = 384;
const MODEL = "Xenova/multilingual-e5-small";

export function localEmbedder(cacheDir = process.env.MODELS_DIR ?? "/data/models"): Embedder {
  let extractor: Promise<(texts: string[], options: object) => Promise<{ tolist(): number[][] }>> | null = null;
  const load = async () => {
    const transformers = await import("@huggingface/transformers");
    transformers.env.cacheDir = cacheDir;
    return (await transformers.pipeline("feature-extraction", MODEL, { dtype: "q8" })) as unknown as (
      texts: string[],
      options: object,
    ) => Promise<{ tolist(): number[][] }>;
  };
  return {
    async embed(texts, kind) {
      extractor ??= load();
      const run = await extractor;
      // The e5 models expect to be told which side of the search a text is on.
      const output = await run(
        texts.map((t) => `${kind}: ${t}`),
        { pooling: "mean", normalize: true },
      );
      return output.tolist();
    },
  };
}

/**
 * For tests: vectors from the words of a text, so that texts sharing words
 * are close. Deterministic and instant.
 */
export function wordEmbedder(): Embedder {
  return {
    async embed(texts) {
      return texts.map((text) => {
        const vector = new Array<number>(DIMENSIONS).fill(0);
        for (const word of text.toLowerCase().match(/\p{L}{3,}/gu) ?? []) {
          let hash = 0;
          for (const c of word) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
          vector[hash % DIMENSIONS]! += 1;
        }
        const length = Math.hypot(...vector) || 1;
        return vector.map((v) => v / length);
      });
    },
  };
}
