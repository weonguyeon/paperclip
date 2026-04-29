import { EXTRACTED_TEXT_HARD_LIMIT, type ExtractionInput, type ExtractionResult } from "./types.js";

export async function extractPptx({ buffer }: ExtractionInput): Promise<ExtractionResult> {
  const officeparser = await import("officeparser");
  const parseFn: (b: Buffer) => Promise<string> = (officeparser as unknown as { parseOfficeAsync: (b: Buffer) => Promise<string> }).parseOfficeAsync;
  const raw = await parseFn(buffer);
  const truncated = raw.length > EXTRACTED_TEXT_HARD_LIMIT;
  const text = truncated ? raw.slice(0, EXTRACTED_TEXT_HARD_LIMIT) : raw;
  const hasContent = text.trim().length > 0;
  return {
    status: hasContent ? "done" : "skipped",
    text: hasContent ? text : null,
    meta: {
      extractor: "officeparser",
      kind: "text",
      charCount: text.length,
      truncated,
    },
  };
}
