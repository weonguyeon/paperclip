import { EXTRACTED_TEXT_HARD_LIMIT, type ExtractionInput, type ExtractionResult } from "./types.js";

export async function extractDocx({ buffer }: ExtractionInput): Promise<ExtractionResult> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  const truncated = value.length > EXTRACTED_TEXT_HARD_LIMIT;
  const text = truncated ? value.slice(0, EXTRACTED_TEXT_HARD_LIMIT) : value;
  const hasContent = text.trim().length > 0;
  return {
    status: hasContent ? "done" : "skipped",
    text: hasContent ? text : null,
    meta: {
      extractor: "mammoth",
      kind: "text",
      charCount: text.length,
      truncated,
    },
  };
}
