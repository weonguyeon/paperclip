import { extractDocx } from "./docx.js";
import { extractHwp } from "./hwp.js";
import { extractHwpx } from "./hwpx.js";
import { extractImage } from "./image.js";
import { extractPdf } from "./pdf.js";
import { extractPlain } from "./plain.js";
import { extractPptx } from "./pptx.js";
import { extractXlsx } from "./xlsx.js";
import type { ExtractionInput, ExtractionResult } from "./types.js";

export type { ExtractionInput, ExtractionResult, ExtractionStatus, ExtractionMeta } from "./types.js";

const PLAIN_TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
]);

function extension(filename: string | null): string {
  if (!filename) return "";
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx + 1).toLowerCase();
}

function pickExtractor(input: ExtractionInput): ((i: ExtractionInput) => Promise<ExtractionResult>) | null {
  const ct = input.contentType.toLowerCase();
  const ext = extension(input.filename);

  if (ct.startsWith("image/")) return extractImage;
  if (ct === "application/pdf" || ext === "pdf") return extractPdf;
  if (
    ct === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) return extractDocx;
  if (
    ct === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ext === "xlsx" ||
    ext === "xlsm"
  ) return extractXlsx;
  if (
    ct === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) return extractPptx;
  if (ct === "application/vnd.hancom.hwpx" || ct === "application/x-hwpx" || ext === "hwpx") return extractHwpx;
  if (ct === "application/x-hwp" || ct === "application/haansofthwp" || ext === "hwp") return extractHwp;
  if (PLAIN_TEXT_TYPES.has(ct) || ct.startsWith("text/")) return extractPlain;

  // Fallback: try plain text decode if reasonably small
  if (input.buffer.length < 256 * 1024) return extractPlain;
  return null;
}

export async function extractFile(input: ExtractionInput): Promise<ExtractionResult> {
  const start = Date.now();
  const extractor = pickExtractor(input);
  if (!extractor) {
    return {
      status: "skipped",
      text: null,
      meta: {
        extractor: "none",
        kind: "binary",
        error: `unsupported content-type: ${input.contentType}`,
        durationMs: Date.now() - start,
      },
    };
  }
  try {
    const result = await extractor(input);
    return {
      ...result,
      meta: { ...result.meta, durationMs: Date.now() - start },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      text: null,
      meta: {
        extractor: "error",
        kind: "binary",
        error: message,
        durationMs: Date.now() - start,
      },
    };
  }
}
