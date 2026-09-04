import type { CaseRecord, CauseHypothesis } from "@/domain/case";
import { SCHEMA_VERSION, createCase, normalizeCase } from "@/domain/case";
import { flattenTreeLabels, scoreOf } from "@/domain/analyze";
import { CAUSE_VERDICTS, whyLayerLabel } from "@/domain/cause";
import { EMPTY_SETTINGS, resolveSettings, type ModelSettings } from "@/domain/settings";

const CASES_KEY = "sansheng.cases.v1";
const SETTINGS_KEY = "sansheng.settings.v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listCases(): CaseRecord[] {
  return readJson<CaseRecord[]>(CASES_KEY, [])
    .map((item) => normalizeCase(item))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCase(id: string): CaseRecord | null {
  return listCases().find((item) => item.id === id) ?? null;
}

export function saveCase(record: CaseRecord): CaseRecord {
  const next = { ...record, updatedAt: new Date().toISOString() };
  const all = listCases();
  const index = all.findIndex((item) => item.id === next.id);
  if (index >= 0) all[index] = next;
  else all.unshift(next);
  writeJson(CASES_KEY, all);
  return next;
}

export function deleteCase(id: string) {
  writeJson(
    CASES_KEY,
    listCases().filter((item) => item.id !== id),
  );
}

export function loadSettings(): ModelSettings {
  const stored = readJson<Partial<ModelSettings> | null>(SETTINGS_KEY, null);
  return resolveSettings({ ...EMPTY_SETTINGS, ...stored });
}

export function saveSettings(settings: ModelSettings) {
  writeJson(SETTINGS_KEY, resolveSettings(settings));
}

export function exportCaseJson(record: CaseRecord): string {
  return JSON.stringify(
    {
      kind: "sansheng-case",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      case: record,
    },
    null,
    2,
  );
}

export function exportCaseMarkdown(record: CaseRecord): string {
  const g1 = record.gates.gate1;
  const g2 = record.gates.gate2;
  const g3 = record.gates.gate3;
  return `# ${record.title}

- 场景 / 任务：${record.define.scene || "（未填）"}
- 当前步骤：${record.currentStep}
- 更新时间：${record.updatedAt}

## 问题定义

- 差距陈述：${record.define.statement || "（未填）"}
- 附件：${record.define.attachments.map((file) => file.name).join("、") || "无"}
- 核心词：${record.define.keywords || "（未填）"}
- 边界：${record.define.boundary || "（未填）"}
- 暂不讨论：${record.define.outOfScope || "（未填）"}

## 人工判断

- 判断 1：${g1.passed ? `已确认 ${g1.passedAt}` : "未确认"}
  - 依据：${g1.rationale || "（空）"}
- 判断 2：${g2.passed ? `已确认 ${g2.passedAt}` : "未确认"}
  - 依据：${g2.rationale || "（空）"}
- 判断 3：${g3.passed ? `已确认 ${g3.passedAt}` : "未确认"}
  - 依据：${g3.rationale || "（空）"}

## 分解问题

- 切分标准：${record.analyze.dimension || "（未填）"}
- 问题树：${record.analyze.treeConfirmed ? "已确认" : "未确认"}
- 矩阵：${record.analyze.matrixConfirmed ? "已确认" : "未确认"}

### 问题树

${flattenTreeLabels(record.analyze.tree).join("\n") || "（尚未生成）"}

### 影响度 × 可行动性

${
  record.analyze.matrix
    .map((item) => `- ${item.label}：影响 ${item.impact} × 可行动 ${item.actionability} ＝ ${scoreOf(item)}`)
    .join("\n") || "（尚未评分）"
}

### 优先问题与取证

${
  record.analyze.focuses
    .map(
      (item) =>
        `- ${item.chosen ? "【带入下一步】" : ""}${item.label}（${item.score}分）\n${item.dataNeeds.filter(Boolean).map((need) => `  - ${need}`).join("\n") || "  - （未填）"}`,
    )
    .join("\n") || "（尚未形成清单）"
}

## 设定目标

${
  record.goal?.items
    .map(
      (item) =>
        `- ${item.problemLabel}：${item.statement || "（未填）"}\n  - 指标 ${item.metric || "（未填）"}，从 ${item.baseline || "（未填）"} 到 ${item.target || "（未填）"}，期限 ${item.deadline || "（未填）"}`,
    )
    .join("\n") || "（尚未填写）"
}

## 把握真因

${
  record.cause?.clusters
    .map((cluster) => {
      const rows = formatCauseTree(cluster.hypotheses);
      return `### ${cluster.problemLabel}\n\n${cluster.goalStatement || ""}\n\n${rows || "（尚未生成假设）"}`;
    })
    .join("\n\n") || "（尚未填写）"
}

## 末端原因池

${
  record.cause?.pool
    ?.map((item) => {
      const kind = item.kind === "unknown" ? "待取证" : "候选机制";
      const kept = item.kept ? "保留" : "不纳入对策";
      return [
        `- 【${kind} / ${kept}】${item.text}`,
        `  - 来自问题：${item.problemLabel || "（未标注）"}`,
        `  - 追问链：${item.chain.filter(Boolean).join(" → ") || "（无）"}`,
        `  - 环节：${item.mechanism || "（未填）"}`,
        `  - 依据：${item.verdictReason || "（空）"}`,
        `  - 验证：${item.verify || "（未填）"}`,
        item.note ? `  - 备注：${item.note}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n") || "（尚未收入）"
}

## 制定对策

- 阶段：${phaseLabel(record.remedy?.phase)}
- 本轮末端原因：${
  record.remedy?.selectedCauseIds
    ?.map((id) => record.cause?.pool?.find((item) => item.id === id)?.text)
    .filter(Boolean)
    .map((text) => `\n  - ${text}`)
    .join("") || "（未选）"
}

### 5W 变化焦点

${
  record.remedy?.fiveW
    ?.map((item) => `- ${item.selected ? "【焦点】" : ""}${item.label}：${item.question}`)
    .join("\n") || "（尚未生成）"
}

### SCAMPER 发散

${
  record.remedy?.scamper
    ?.map((item) => `- ${item.selected ? "【对策】" : ""}${item.actionLabel}：${item.text}`)
    .join("\n") || "（尚未发散）"
}

### 影响性 × 可行性

${
  record.remedy?.options
    ?.map(
      (item) =>
        `- ${item.chosen ? "【推进】" : ""}${item.text}：影响 ${item.impact} × 可行 ${item.feasibility} ＝ ${item.impact * item.feasibility}`,
    )
    .join("\n") || "（尚未评分）"
}

## 贯彻实施

${
  record.plan?.items
    ?.map((item) =>
      [
        `### ${item.scamperLabel || "对策"}`,
        item.remedyText,
        `- 谁：${item.who || "（未填）"}`,
        `- 做什么：${item.what || "（未填）"}`,
        `- 何时：${item.when || "（未填）"}`,
        `- 何地：${item.where || "（未填）"}`,
        `- 为何：${item.why || "（未填）"}`,
        `- 如何：${item.how || "（未填）"}`,
        `- 费用：${item.cost || "（未填）"}`,
        `- 假设：${item.hypothesis || "（未填）"}`,
        `- 对象 / 范围 / 周期：${item.object || "（未填）"} / ${item.scope || "（未填）"} / ${item.period || "（未填）"}`,
        `- 基线：${item.baseline || "（未填）"}`,
        `- 领先 / 结果 / 护栏：${item.leadIndicator || "（未填）"} / ${item.resultIndicator || "（未填）"} / ${item.guardIndicator || "（未填）"}`,
        `- 成功 / 停止 / 扩大：${item.success || "（未填）"} / ${item.stop || "（未填）"} / ${item.expand || "（未填）"}`,
        `- 责任人：${item.owner || "（未填）"}`,
        `- 记录：${item.record || "（未填）"}`,
        `- 污染变量：${item.confounders || "（未填）"}`,
        `- 检查点：${(item.checkpoints ?? []).filter(Boolean).join("；") || "（未填）"}`,
        `- 汇报：${item.report || "（未填）"}`,
        `- 升级：${item.escalate || "（未填）"}`,
      ].join("\n"),
    )
    .join("\n\n") || "（尚未生成）"
}

## 评价结果

${
  record.review?.items
    ?.map((item) => {
      const outcome = item.outcome === "met" ? "达成" : item.outcome === "exceeded" ? "超过" : item.outcome === "missed" ? "未达成" : "未选";
      return [
        `- ${item.planLabel}：${outcome}`,
        `  - 目标：${item.target || "（未填）"}`,
        `  - 实际：${item.actual || "（未填）"}`,
        `  - 偏差：${item.gap || "（未填）"}`,
        `  - 类型：${item.deviation || "未选"}${item.deviationReason ? `。${item.deviationReason}` : ""}`,
        item.appeared ? `  - 新出现：${item.appeared}` : "",
        item.disappeared ? `  - 消失：${item.disappeared}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n") || "（尚未填写）"
}

- 跳过或补做：${record.review?.skippedSteps || "（未填）"}
- 闸门记录：${record.review?.gateNotes || "（未填）"}
- 过程备注：${record.review?.processNote || "（未填）"}

## 巩固成果

- SOP：${record.consolidate?.sop || "（未填）"}
- 检查表：${record.consolidate?.checklist || "（未填）"}
- 案例库：${record.consolidate?.caseLibrary || "（未填）"}
- 继续实验：${record.consolidate?.keepExperiment || "（未填）"}
- 横向边界：${record.consolidate?.spreadBoundary || "（未填）"}
- 下一轮改善：${record.consolidate?.nextImprove || "（未填）"}
- 被证实：${record.consolidate?.confirmed || "（未填）"}
- 被推翻：${record.consolidate?.rejected || "（未填）"}
- 仍未知：${record.consolidate?.unknown || "（未填）"}
- 关键事件：${record.consolidate?.keyEvents || "（未填）"}
- 经验：${record.consolidate?.lessons || "（未填）"}
- 反思 1：${record.consolidate?.reflect1 || "（未填）"}
- 反思 2：${record.consolidate?.reflect2 || "（未填）"}
- 反思 3：${record.consolidate?.reflect3 || "（未填）"}

${record.analyze.markdown ? `\n### 摘要\n\n${record.analyze.markdown}\n` : ""}
> 本导出不含 API Key。换设备请同时保留 JSON 备份。
`;
}

function phaseLabel(phase: string | undefined): string {
  if (phase === "fiveW") return "5W 焦点";
  if (phase === "scamper") return "SCAMPER 发散";
  if (phase === "matrix") return "影响性 × 可行性";
  if (phase === "causes") return "选末端原因";
  return "尚未开始";
}

function formatCauseTree(list: CauseHypothesis[], indent = ""): string {
  return list
    .map((item, index) => {
      const verdict = CAUSE_VERDICTS.find((row) => row.id === item.verdict)?.label ?? "尚未判断";
      const lines = [
        `${indent}${whyLayerLabel(item.depth ?? 0, index)} ${item.text}`,
        item.whyQuestion ? `${indent}   - 追问：${item.whyQuestion}` : "",
        `${indent}   - 环节：${item.mechanism || "（未填）"}`,
        `${indent}   - 优先验证：${item.confidence}/5`,
        `${indent}   - 支持：${item.support || "未知"}`,
        `${indent}   - 反证：${item.counter || "未知"}`,
        `${indent}   - 缺失证据：${item.missing || "（未填）"}`,
        `${indent}   - 最低成本验证：${item.verify || "（未填）"}`,
        `${indent}   - 判断：${verdict}${item.verdictReason ? `。依据：${item.verdictReason}` : ""}`,
      ].filter(Boolean);
      const kids =
        item.verdict === "hold" && item.children?.length ? `\n${formatCauseTree(item.children, `${indent}   `)}` : "";
      return lines.join("\n") + kids;
    })
    .join("\n");
}

export function parseImportedCase(raw: string): CaseRecord {
  const data = JSON.parse(raw) as { kind?: string; case?: CaseRecord } | CaseRecord;
  const record = "case" in data && data.case ? data.case : (data as CaseRecord);
  if (!record?.id || !record?.title || !record?.define) {
    throw new Error("无法识别的课题文件。请使用本工具导出的 JSON。");
  }
  const fresh = createCase({ title: record.title, scene: record.define.scene });
  return {
    ...fresh,
    ...record,
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
