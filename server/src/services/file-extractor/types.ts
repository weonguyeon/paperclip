export type ExtractionStatus = "pending" | "processing" | "done" | "skipped" | "failed";

export interface ExtractionResult {
  status: Exclude<ExtractionStatus, "pending" | "processing">;
  text: string | null;
  meta: ExtractionMeta;
}

export interface ExtractionMeta {
  extractor: string;
  pages?: number;
  sheets?: string[];
  charCount?: number;
  kind?: "text" | "image" | "binary";
  error?: string;
  truncated?: boolean;
  durationMs?: number;
}

export interface ExtractionInput {
  buffer: Buffer;
  contentType: string;
  filename: string | null;
}

export const EXTRACTED_TEXT_HARD_LIMIT = 1_000_000;
