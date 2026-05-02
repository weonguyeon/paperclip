import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// jszip ships as transitive of exceljs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JSZip = require("jszip") as any;
import { extractFile } from "../src/services/file-extractor/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(here, ".tmp-samples");
if (!existsSync(samplesDir)) mkdirSync(samplesDir, { recursive: true });

// --- DOCX (minimal Office Open XML) ---
async function makeDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>안녕하세요 워드 테스트입니다.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph for DOCX extraction.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );
  return await zip.generateAsync({ type: "nodebuffer" });
}

// --- XLSX via exceljs ---
async function makeXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sales");
  ws.addRow(["Region", "Q1", "Q2"]);
  ws.addRow(["서울", 1200, 1500]);
  ws.addRow(["부산", 800, 950]);
  const ws2 = wb.addWorksheet("Notes");
  ws2.addRow(["메모", "엑셀 추출 테스트"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// --- HWPX (minimal: section0.xml inside Contents/) ---
async function makeHwpx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/hwp+zip");
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="Contents/header.xml" media-type="application/hwpml-header+xml"/></rootfiles></container>`,
  );
  zip.file(
    "Contents/section0.xml",
    `<?xml version="1.0"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/section">
  <hp:p><hp:run><hp:t>한글 HWPX 추출 테스트입니다.</hp:t></hp:run></hp:p>
  <hp:p><hp:run><hp:t>두 번째 단락.</hp:t></hp:run></hp:p>
</hp:sec>`,
  );
  return await zip.generateAsync({ type: "nodebuffer" });
}

const docx = await makeDocx();
const xlsx = await makeXlsx();
const hwpx = await makeHwpx();
writeFileSync(join(samplesDir, "report.docx"), docx);
writeFileSync(join(samplesDir, "sales.xlsx"), xlsx);
writeFileSync(join(samplesDir, "doc.hwpx"), hwpx);

const cases = [
  { name: "report.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buf: docx },
  { name: "sales.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf: xlsx },
  { name: "doc.hwpx", contentType: "application/vnd.hancom.hwpx", buf: hwpx },
];

for (const c of cases) {
  const result = await extractFile({ buffer: c.buf, contentType: c.contentType, filename: c.name });
  const preview = (result.text ?? "").slice(0, 200).replace(/\s+/g, " ");
  console.log(`\n[${c.name}] status=${result.status} extractor=${result.meta.extractor} chars=${result.meta.charCount ?? 0}`);
  if (result.meta.sheets) console.log(`  sheets: ${(result.meta.sheets as string[]).join(", ")}`);
  if (preview) console.log(`  preview: ${preview}`);
  if (result.meta.error) console.log(`  error: ${result.meta.error}`);
}
