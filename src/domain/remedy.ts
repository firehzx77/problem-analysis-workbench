import { clampScore, quadrantOf } from "@/domain/analyze";
import type {
  CaseRecord,
  FiveWKey,
  FiveWPrompt,
  RemedyDraft,
  RemedyOption,
  RemedyPhase,
  ScamperIdea,
  TerminalCause,
} from "@/domain/case";
import { keptTerminals } from "@/domain/cause";
import { handoffFromGoals } from "@/domain/goal";

export const FIVE_W: { key: FiveWKey; label: string; skeleton: string }[] = [
  { key: "who", label: "谁 Who", skeleton: "改变该机制时，最先改谁的工作方式、职责或协作对象？" },
  { key: "what", label: "什么 What", skeleton: "具体改哪条规则、接口、口径或交付物？" },
  { key: "when", label: "何时 When", skeleton: "在哪个时点或节奏上改，才能截住差距指标？" },
  { key: "where", label: "何处 Where", skeleton: "在哪个环节、场所或系统里改？" },
  { key: "why", label: "为何 Why", skeleton: "这次改变是为了撬动哪段已确认的因果机制？" },
];

export const SCAMPER_ACTIONS: { action: string; actionLabel: string; hint: string }[] = [
  { action: "S", actionLabel: "替代 Substitute", hint: "用什么替换现有规则、接口或责任人" },
  { action: "C", actionLabel: "合并 Combine", hint: "把哪两步或两份信息并成一次交付" },
  { action: "A", actionLabel: "适应 Adapt", hint: "别处已跑通的做法，怎样接到当前环节" },
  { action: "M", actionLabel: "改造 Modify", hint: "把频率、批量、阈值或检查点改成什么样" },
  { action: "P", actionLabel: "转用 Put to other uses", hint: "现有工具或数据还能用在哪个卡点" },
  { action: "E", actionLabel: "消除 Eliminate", hint: "删掉哪道重复确认、等待或转手" },
  { action: "R", actionLabel: "重组 Reverse", hint: "对调顺序、责任或输入输出会怎样" },
];

export const REMEDY_PHASES: { id: RemedyPhase; label: string }[] = [
  { id: "causes", label: "1 选末端原因" },
  { id: "fiveW", label: "2 5W 焦点" },
  { id: "scamper", label: "3 SCAMPER 发散" },
  { id: "matrix", label: "4 影响 × 可行" },
];

export function selectedCausesOf(record: CaseRecord): TerminalCause[] {
  const kept = keptTerminals(record.cause);
  const ids = new Set(record.remedy.selectedCauseIds);
  return kept.filter((item) => ids.has(item.id));
}

export function selectedFocuses(draft: RemedyDraft): FiveWPrompt[] {
  return draft.fiveW.filter((item) => item.selected);
}

export function selectedIdeas(draft: RemedyDraft): ScamperIdea[] {
  return draft.scamper.filter((item) => item.selected);
}

export function chosenRemedies(options: RemedyOption[]): RemedyOption[] {
  return options.filter((item) => item.chosen);
}

export function remedyScoreOf(item: RemedyOption): number {
  return item.impact * item.feasibility;
}

export function remedyQuadrant(item: RemedyOption): "priority" | "hard" | "easy" | "low" {
  return quadrantOf({
    id: item.id,
    label: item.text,
    impact: item.impact,
    actionability: item.feasibility,
  });
}

export function remedyBlockReason(draft: RemedyDraft, phase: RemedyPhase = draft.phase): string | null {
  if (phase === "causes" && draft.selectedCauseIds.length === 0) {
    return "请先勾选至少一条末端原因，再生成 5W 提问。";
  }
  if (phase === "fiveW" && !draft.fiveW.some((item) => item.selected)) {
    return "请先勾选至少一个变化焦点，再用 SCAMPER 发散。";
  }
  if (phase === "scamper" && !draft.scamper.some((item) => item.selected)) {
    return "请先勾选至少一条对策，再进入评估矩阵。";
  }
  if (phase === "matrix" && !draft.options.some((item) => item.chosen)) {
    return "请先勾选至少一条要推进的对策，并完成本步人工判断。";
  }
  return null;
}

export function handoffFromCauses(record: CaseRecord, causes: TerminalCause[]): string {
  const rows = causes
    .map((item) => {
      const kind = item.kind === "unknown" ? "待取证" : "候选机制";
      return [
        `- 【${kind}】${item.text}`,
        `  来自问题：${item.problemLabel || "（未标注）"}`,
        `  目标：${item.goalStatement || "（未填）"}`,
        `  追问链：${item.chain.filter(Boolean).join(" → ") || "（无）"}`,
        `  环节：${item.mechanism || "（未填）"}`,
        `  依据：${item.verdictReason || "（空）"}`,
      ].join("\n");
    })
    .join("\n");
  return [
    handoffFromGoals(record),
    "【本轮要做对策的末端原因】",
    rows || "（无）",
  ].join("\n");
}

export function fallbackFiveW(causes: TerminalCause[]): FiveWPrompt[] {
  const sample = causes
    .slice(0, 2)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("；") || "该末端机制";
  return FIVE_W.map((row) => ({
    id: crypto.randomUUID(),
    key: row.key,
    label: row.label,
    question: `${row.skeleton.replace("该机制", `「${sample}」`).replace("这次改变", `针对「${sample}」的改变`)}（可改）`,
    selected: false,
  }));
}

export function hydrateFiveW(raw: unknown, causes: TerminalCause[]): FiveWPrompt[] {
  const fallback = fallbackFiveW(causes);
  if (!Array.isArray(raw)) return fallback;
  return FIVE_W.map((meta, index) => {
    const hit =
      raw.find((row) => String((row as { key?: string }).key ?? "").toLowerCase() === meta.key) ??
      raw[index];
    const item = (hit ?? {}) as Partial<FiveWPrompt>;
    return {
      id: crypto.randomUUID(),
      key: meta.key,
      label: String(item.label ?? meta.label).trim() || meta.label,
      question: String(item.question ?? "").trim() || fallback[index].question,
      selected: false,
    };
  });
}

export function fallbackScamper(causes: TerminalCause[], focuses: FiveWPrompt[]): ScamperIdea[] {
  const cause = causes[0]?.text.trim() || "该末端机制";
  const focus =
    focuses
      .filter((item) => item.selected)
      .map((item) => item.question.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("；") || "所选变化焦点";
  return SCAMPER_ACTIONS.map((row) => ({
    id: crypto.randomUUID(),
    action: row.action,
    actionLabel: row.actionLabel,
    text: `${row.hint}，用来处理「${cause}」，并回应：${clip(focus, 48)}（可改）`,
    selected: false,
  }));
}

export function hydrateScamper(raw: unknown, causes: TerminalCause[], focuses: FiveWPrompt[]): ScamperIdea[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallbackScamper(causes, focuses);
  const ideas: ScamperIdea[] = [];
  for (const row of raw) {
    const item = row as Partial<ScamperIdea> & { idea?: string };
    const action = String(item.action ?? "").trim().toUpperCase().slice(0, 1);
    const meta = SCAMPER_ACTIONS.find((row) => row.action === action) ?? SCAMPER_ACTIONS[3];
    const text = String(item.text ?? item.idea ?? "").trim();
    if (!text) continue;
    ideas.push({
      id: crypto.randomUUID(),
      action: meta.action,
      actionLabel: String(item.actionLabel ?? meta.actionLabel).trim() || meta.actionLabel,
      text,
      selected: false,
    });
  }
  return ideas.length ? ideas : fallbackScamper(causes, focuses);
}

export function newManualIdea(): ScamperIdea {
  return {
    id: crypto.randomUUID(),
    action: "M",
    actionLabel: "改造 Modify",
    text: "一条可观察、本人能推动的对策（可改）",
    selected: true,
  };
}

export function optionsFromScamper(
  ideas: ScamperIdea[],
  causeIds: string[],
  focusIds: string[],
  previous: RemedyOption[],
): RemedyOption[] {
  return ideas
    .filter((item) => item.selected)
    .map((idea) => {
      const prior = previous.find((item) => item.id === idea.id);
      return {
        id: idea.id,
        text: idea.text,
        sourceCauseIds: prior?.sourceCauseIds?.length ? prior.sourceCauseIds : causeIds,
        focusIds: prior?.focusIds?.length ? prior.focusIds : focusIds,
        scamperAction: idea.action,
        scamperLabel: idea.actionLabel,
        impact: prior?.impact ?? 3,
        feasibility: prior?.feasibility ?? 3,
        chosen: prior?.chosen ?? false,
      };
    });
}

export function applyRemedyScores(
  items: RemedyOption[],
  scores: { id?: string; text?: string; impact?: number; feasibility?: number; actionability?: number }[],
): RemedyOption[] {
  return items.map((item) => {
    const hit =
      scores.find((row) => row.id === item.id) ??
      scores.find((row) => row.text && row.text === item.text);
    if (!hit) return item;
    return {
      ...item,
      impact: clampScore(hit.impact ?? item.impact),
      feasibility: clampScore(hit.feasibility ?? hit.actionability ?? item.feasibility),
    };
  });
}

export function seedSelectedCauseIds(record: CaseRecord): string[] {
  const keptIds = keptTerminals(record.cause).map((item) => item.id);
  const still = record.remedy.selectedCauseIds.filter((id) => keptIds.includes(id));
  return still.length ? still : keptIds;
}

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}
