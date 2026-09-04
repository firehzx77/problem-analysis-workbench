import { useRef, useState } from "react";
import type { AttachmentMeta } from "@/domain/case";
import { extractAttachmentText, fileExt, isAllowedAttachment } from "@/files/extract";

export function AttachmentField({
  files,
  onChange,
}: {
  files: AttachmentMeta[];
  onChange: (next: AttachmentMeta[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setHint("");
    const next = [...files];
    for (const file of [...list]) {
      if (!isAllowedAttachment(file.name)) {
        setHint(`${file.name} 格式不支持`);
        continue;
      }
      if (next.some((item) => item.name === file.name && item.size === file.size)) continue;
      const extracted = await extractAttachmentText(file);
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        ext: fileExt(file.name),
        size: file.size,
        extractedText: extracted.text,
        extractError: extracted.error,
        addedAt: new Date().toISOString(),
      });
    }
    onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="field">
      <span>相关附件</span>
      <p className="hint">上传 Word / Excel / PPT / PDF / Markdown / TXT。本步只抽取文字供后续分析，不上传到本产品服务器。</p>
      <div className="file-row">
        <button className="btn" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "正在读取…" : "选择文件"}
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.md,.txt"
          onChange={(event) => void add(event.target.files)}
        />
      </div>
      {files.length === 0 ? <p className="hint">还没有附件。</p> : null}
      <ul className="file-list">
        {files.map((file) => (
          <li key={file.id}>
            <div>
              <strong>{file.name}</strong>
              <div className="meta">
                {(file.size / 1024).toFixed(1)} KB
                {file.extractError
                  ? ` · ${file.extractError}`
                  : ` · 已抽取 ${file.extractedText.length} 字`}
              </div>
            </div>
            <button
              className="btn-danger"
              type="button"
              onClick={() => onChange(files.filter((item) => item.id !== file.id))}
            >
              移除
            </button>
          </li>
        ))}
      </ul>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
