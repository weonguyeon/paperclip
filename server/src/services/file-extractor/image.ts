import type { ExtractionInput, ExtractionResult } from "./types.js";

export async function extractImage(_input: ExtractionInput): Promise<ExtractionResult> {
  return {
    status: "skipped",
    text: null,
    meta: {
      extractor: "image-vision-passthrough",
      kind: "image",
    },
  };
}
