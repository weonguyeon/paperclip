import { EXTRACTED_TEXT_HARD_LIMIT, type ExtractionInput, type ExtractionResult } from "./types.js";

export async function extractPlain({ buffer }: ExtractionInput): Promise<ExtractionResult> {
  const raw = buffer.toString("utf8");
  const truncated = raw.length > EXTRACTED_TEXT_HARD_LIMIT;
  const text = truncated ? raw.slice(0, EXTRACTED_TEXT_HARD_LIMIT) : raw;
  return {
    status: "done",
    text,
    meta: {
      extractor: "plain",
      kind: "text",
      charCount: text.length,
      truncated,
    },
  };
}
