import { Readable } from "node:stream";
import { EXTRACTED_TEXT_HARD_LIMIT, type ExtractionInput, type ExtractionResult } from "./types.js";

interface ZipEntry {
  path: string;
  type: "File" | "Directory";
  buffer(): Promise<Buffer>;
  autodrain(): void;
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<\?xml[\s\S]*?\?>/g, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export async function extractHwpx({ buffer }: ExtractionInput): Promise<ExtractionResult> {
  const unzipper = (await import("unzipper")).default ?? (await import("unzipper"));
  const sections: Array<{ name: string; text: string }> = [];
  let total = 0;

  const stream = Readable.from(buffer).pipe(
    (unzipper as unknown as { Parse: () => NodeJS.ReadWriteStream }).Parse(),
  );

  await new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.on("entry", (entry: ZipEntry) => {
      const path = entry.path;
      const isContentsXml = /^Contents\/.*\.xml$/i.test(path) || /^Preview\/PrvText\.txt$/i.test(path);
      if (entry.type === "File" && isContentsXml) {
        entry
          .buffer()
          .then((buf) => {
            const raw = buf.toString("utf8");
            const text = path.endsWith(".txt") ? raw : stripXmlTags(raw);
            if (text.length > 0) {
              sections.push({ name: path, text });
              total += text.length;
            }
          })
          .catch(reject);
      } else {
        entry.autodrain();
      }
    });
    stream.on("close", () => resolve());
    stream.on("end", () => resolve());
  });

  sections.sort((a, b) => a.name.localeCompare(b.name));
  const joined = sections.map((s) => s.text).join("\n\n");
  const truncated = joined.length > EXTRACTED_TEXT_HARD_LIMIT;
  const text = truncated ? joined.slice(0, EXTRACTED_TEXT_HARD_LIMIT) : joined;
  const hasContent = text.trim().length > 0;
  return {
    status: hasContent ? "done" : "skipped",
    text: hasContent ? text : null,
    meta: {
      extractor: "hwpx-zip",
      kind: "text",
      charCount: text.length,
      pages: sections.filter((s) => /section\d+\.xml/i.test(s.name)).length || undefined,
      truncated,
    },
  };
}
