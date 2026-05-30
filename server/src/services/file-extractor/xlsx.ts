import { EXTRACTED_TEXT_HARD_LIMIT, type ExtractionInput, type ExtractionResult } from "./types.js";

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as { result?: unknown; richText?: Array<{ text?: string }>; text?: string; hyperlink?: string };
    if (typeof v.result !== "undefined") return cellToString(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text ?? "").join("");
    if (typeof v.text === "string") return v.text;
    if (typeof v.hyperlink === "string") return v.hyperlink;
  }
  return String(value);
}

export async function extractXlsx({ buffer }: ExtractionInput): Promise<ExtractionResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  // exceljs bundles an older non-generic Buffer type; @types/node now models
  // Buffer as Buffer<ArrayBufferLike>. Bridge them with a type-only cast to
  // exceljs's own expected parameter type (runtime behavior is unchanged).
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const sheets: string[] = [];
  const sections: string[] = [];
  let totalChars = 0;
  for (const sheet of wb.worksheets) {
    sheets.push(sheet.name);
    const lines: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        cells.push(cellToString(cell.value));
      });
      const line = cells.join("\t").trim();
      if (line.length > 0) lines.push(line);
    });
    if (lines.length > 0) {
      const block = `## Sheet: ${sheet.name}\n${lines.join("\n")}`;
      sections.push(block);
      totalChars += block.length;
      if (totalChars > EXTRACTED_TEXT_HARD_LIMIT) break;
    }
  }
  const joined = sections.join("\n\n");
  const truncated = joined.length > EXTRACTED_TEXT_HARD_LIMIT;
  const text = truncated ? joined.slice(0, EXTRACTED_TEXT_HARD_LIMIT) : joined;
  return {
    status: text.trim().length > 0 ? "done" : "skipped",
    text: text.trim().length > 0 ? text : null,
    meta: {
      extractor: "exceljs",
      kind: "text",
      sheets,
      charCount: text.length,
      truncated,
    },
  };
}
