import { EXTRACTED_TEXT_HARD_LIMIT, type ExtractionInput, type ExtractionResult } from "./types.js";

export async function extractPdf({ buffer }: ExtractionInput): Promise<ExtractionResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    // isEvalSupported is a valid runtime option (disables eval for security) but
    // is missing from the legacy build's DocumentInitParameters typings.
    isEvalSupported: false,
    useSystemFonts: false,
  } as Parameters<typeof pdfjs.getDocument>[0]);
  const doc = await loadingTask.promise;
  try {
    const pages: string[] = [];
    let total = 0;
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str?: string }>;
      const pageText = items
        .map((item) => (typeof item.str === "string" ? item.str : ""))
        .join(" ")
        .replace(/\s+\n/g, "\n")
        .trim();
      pages.push(pageText);
      total += pageText.length;
      page.cleanup();
      if (total > EXTRACTED_TEXT_HARD_LIMIT) break;
    }
    const joined = pages
      .map((p, idx) => `--- Page ${idx + 1} ---\n${p}`)
      .join("\n\n");
    const truncated = joined.length > EXTRACTED_TEXT_HARD_LIMIT;
    const text = truncated ? joined.slice(0, EXTRACTED_TEXT_HARD_LIMIT) : joined;
    const isEmpty = text.trim().length === 0;
    return {
      status: isEmpty ? "skipped" : "done",
      text: isEmpty ? null : text,
      meta: {
        extractor: "pdfjs-dist",
        kind: isEmpty ? "binary" : "text",
        pages: doc.numPages,
        charCount: text.length,
        truncated,
      },
    };
  } finally {
    await doc.destroy();
  }
}
