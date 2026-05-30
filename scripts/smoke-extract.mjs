#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);

// Generate tiny synthetic samples in scripts/.tmp-samples/
const samplesDir = join(root, "scripts", ".tmp-samples");
if (!existsSync(samplesDir)) mkdirSync(samplesDir, { recursive: true });

// Plain text
writeFileSync(join(samplesDir, "note.txt"), "안녕하세요, 이건 일반 텍스트 첨부 테스트입니다.\nLine 2.");

// CSV
writeFileSync(join(samplesDir, "data.csv"), "name,score\nAlice,90\nBob,85\n홍길동,77\n");

// PDF (minimal valid one-page)
const pdfBytes = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
    "4 0 obj<</Length 62>>stream\n" +
    "BT /F1 18 Tf 50 200 Td (Hello Paperclip) Tj 0 -30 Td (PDF test) Tj ET\n" +
    "endstream endobj\n" +
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "xref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000054 00000 n\n0000000100 00000 n\n0000000197 00000 n\n0000000277 00000 n\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n340\n%%EOF\n",
  "latin1",
);
writeFileSync(join(samplesDir, "hello.pdf"), pdfBytes);

// Tiny PNG (1x1 red dot)
const pngBytes = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc000000003000180e9c1aa0000000049454e44ae426082",
  "hex",
);
writeFileSync(join(samplesDir, "dot.png"), pngBytes);

console.log("[smoke] samples written to", samplesDir);

// Run extractor on each
const { extractFile } = await import(join(root, "server", "node_modules", "tsx", "esm.mjs").replace(/\\/g, "/")).catch(() => null) ?? {};
// We can't import .ts files directly here; instead spawn tsx to run a TS shim
import { spawnSync } from "node:child_process";

const shim = `
import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { extractFile } from "${join(root, "server", "src", "services", "file-extractor", "index.ts").replace(/\\/g, "/")}";

const dir = "${samplesDir.replace(/\\/g, "/")}";
const files = readdirSync(dir);
for (const name of files) {
  const buf = readFileSync(join(dir, name));
  const ct = name.endsWith(".pdf") ? "application/pdf"
    : name.endsWith(".png") ? "image/png"
    : name.endsWith(".csv") ? "text/csv"
    : name.endsWith(".txt") ? "text/plain"
    : "application/octet-stream";
  const result = await extractFile({ buffer: buf, contentType: ct, filename: name });
  const preview = (result.text ?? "").slice(0, 120).replace(/\\s+/g, " ");
  console.log("\\n[" + name + "] status=" + result.status + " extractor=" + result.meta.extractor + " chars=" + (result.meta.charCount ?? 0));
  if (preview) console.log("  preview: " + preview);
  if (result.meta.error) console.log("  error: " + result.meta.error);
}
`;

const shimPath = join(samplesDir, "_shim.mts");
writeFileSync(shimPath, shim);

const result = spawnSync("pnpm", ["--filter", "@paperclipai/server", "exec", "tsx", shimPath], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
