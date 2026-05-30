/**
 * UTF-8 encoding helpers for the narrow cases where decoding genuinely goes wrong.
 *
 * IMPORTANT: We do NOT run a blanket "latin1 -> utf8" heuristic over request
 * bodies. JSON bodies are already decoded as UTF-8 by express.json() (RFC 8259),
 * so Korean/CJK text arrives intact. A blanket heuristic would corrupt
 * legitimately accented Latin-1 text (e.g. "Müller", "café", "Español").
 *
 * The one real mojibake source is multipart/form-data filenames, which multer
 * decodes as latin1 per RFC 7578 even though browsers send UTF-8.
 */

/**
 * Re-decode a multer filename from latin1 to UTF-8.
 * multer decodes multipart filenames as latin1 per RFC 7578,
 * but browsers send UTF-8, so non-ASCII names get mangled.
 */
export function fixMulterFilename(raw: string): string {
  if (!raw) return raw;
  try {
    const reDecoded = Buffer.from(raw, "latin1").toString("utf8");
    // If re-decoding produced U+FFFD, the original wasn't latin1-encoded UTF-8;
    // keep the original to avoid making things worse.
    if (reDecoded.includes("�")) return raw;
    return reDecoded;
  } catch {
    return raw;
  }
}
