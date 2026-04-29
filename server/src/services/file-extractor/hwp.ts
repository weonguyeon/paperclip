import type { ExtractionInput, ExtractionResult } from "./types.js";

export async function extractHwp(_input: ExtractionInput): Promise<ExtractionResult> {
  return {
    status: "skipped",
    text: null,
    meta: {
      extractor: "hwp-legacy",
      kind: "binary",
      error: "Legacy .hwp format requires HWPX conversion or LibreOffice. Convert to .hwpx and re-upload.",
    },
  };
}
