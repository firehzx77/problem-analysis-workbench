const MAX_CHARS = 20000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "pdf",
  "md",
  "txt",
]);

export function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedAttachment(name: string): boolean {
  return ALLOWED.has(fileExt(name));
}

export async function extractAttachmentText(file: File): Promise<{ text: string; error: string }> {
  if (file.size > MAX_FILE_BYTES) {
    return { text: "", error: "单份附件不超过 15MB" };
  }
  const ext = fileExt(file.name);
  if (!ALLOWED.has(ext)) {
    return { text: "", error: "仅支持 Word / Excel / PPT / PDF / Markdown / TXT" };
  }
  if (ext === "doc" || ext === "ppt") {
    return { text: "", error: `请另存为 .${ext}x 后再上传` };
  }

  try {
    if (ext === "txt" || ext === "md") {
      return { text: clip(await file.text()), error: "" };
    }
    if (ext === "docx") return { text: clip(await fromDocx(file)), error: "" };
    if (ext === "xlsx" || ext === "xls") return { text: clip(await fromExcel(file)), error: "" };
    if (ext === "pptx") return { text: clip(await fromPptx(file)), error: "" };
    if (ext === "pdf") return { text: clip(await fromPdf(file)), error: "" };
    return { text: "", error: "暂不支持该格式" };
  } catch (error) {
    return { text: "", error: error instanceof Error ? error.message : "无法读取附件" };
  }
}

function clip(text: string): string {
  const cleaned = text.replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned.length > MAX_CHARS ? `${cleaned.slice(0, MAX_CHARS)}\n\n…（已截断）` : cleaned;
}

async function fromDocx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("text");
  if (!xml) throw new Error("不是有效的 Word 文件");
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
}

async function fromExcel(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return `# ${name}\n${csv}`;
  }).join("\n\n");
}

async function fromPptx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
  const parts: string[] = [];
  for (const path of slides) {
    const xml = await zip.files[path].async("text");
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter(Boolean);
    if (texts.length) parts.push(texts.join("\n"));
  }
  return parts.join("\n\n");
}

async function fromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" "),
    );
  }
  return pages.join("\n\n");
}
