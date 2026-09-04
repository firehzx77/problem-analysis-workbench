import type { CaseRecord, ExperimentPlan, PlanDraft, RemedyOption } from "@/domain/case";
import { selectedCausesOf } from "@/domain/remedy";
import { handoffFromGoals } from "@/domain/goal";

export function fallbackPlan(remedy: RemedyOption, extras?: { baseline?: string; metric?: string }): ExperimentPlan {
  const action = remedy.text.trim() || "该对策";
  const metric = extras?.metric?.trim() || "差距指标";
  return {
    id: remedy.id,
    remedyText: remedy.text,
    scamperLabel: remedy.scamperLabel,
    who: "",
    what: action,
    when: "两周内完成第一轮并看到信号（可改）",
    where: "",
    why: "用最小可恢复的动作验证该对策是否撬动末端原因（可改）",
    how: "",
    cost: "",
    hypothesis: `如果执行「${clip(action, 36)}」，${metric}应出现可观察的方向性变化（可改）`,
    object: "",
    scope: "先取一小段范围，失败可退回原做法（可改）",
    period: "14 天内出信号",
    baseline: extras?.baseline ?? "",
    leadIndicator: "",
    resultIndicator: metric,
    guardIndicator: "",
    success: "",
    stop: "出现不可逆损失、或领先指标连续两次明显变差（可改）",
    expand: "",
    owner: "",
    record: "",
    confounders: "",
    checkpoints: ["第 3 天：动作是否按计划发生", "第 7 天：领先指标有无方向性变化", "第 14 天：决定停止 / 继续 / 扩大"],
    report: "每周一次，对照基线和领先指标（可改）",
    escalate: "",
  };
}

export function hydratePlan(raw: unknown, remedy: RemedyOption, extras?: { baseline?: string; metric?: string }): ExperimentPlan {
  const seed = fallbackPlan(remedy, extras);
  const item = (raw ?? {}) as Partial<ExperimentPlan> & { checkpoints?: unknown };
  const checkpoints = Array.isArray(item.checkpoints)
    ? item.checkpoints.map((row) => String(row ?? "").trim()).filter(Boolean)
    : [];
  return {
    ...seed,
    who: String(item.who ?? seed.who).trim(),
    what: String(item.what ?? seed.what).trim() || seed.what,
    when: String(item.when ?? seed.when).trim() || seed.when,
    where: String(item.where ?? seed.where).trim(),
    why: String(item.why ?? seed.why).trim() || seed.why,
    how: String(item.how ?? seed.how).trim(),
    cost: String(item.cost ?? seed.cost).trim(),
    hypothesis: String(item.hypothesis ?? seed.hypothesis).trim() || seed.hypothesis,
    object: String(item.object ?? seed.object).trim(),
    scope: String(item.scope ?? seed.scope).trim() || seed.scope,
    period: String(item.period ?? seed.period).trim() || seed.period,
    baseline: String(item.baseline ?? seed.baseline).trim() || seed.baseline,
    leadIndicator: String(item.leadIndicator ?? seed.leadIndicator).trim(),
    resultIndicator: String(item.resultIndicator ?? seed.resultIndicator).trim() || seed.resultIndicator,
    guardIndicator: String(item.guardIndicator ?? seed.guardIndicator).trim(),
    success: String(item.success ?? seed.success).trim(),
    stop: String(item.stop ?? seed.stop).trim() || seed.stop,
    expand: String(item.expand ?? seed.expand).trim(),
    owner: String(item.owner ?? seed.owner).trim(),
    record: String(item.record ?? seed.record).trim(),
    confounders: String(item.confounders ?? seed.confounders).trim(),
    checkpoints: checkpoints.length ? checkpoints : seed.checkpoints,
    report: String(item.report ?? seed.report).trim() || seed.report,
    escalate: String(item.escalate ?? seed.escalate).trim(),
  };
}

export function plansFromRemedies(
  remedies: RemedyOption[],
  generated: ExperimentPlan[],
  draft: PlanDraft = { sourceSnapshot: "", ranAt: null, error: "", items: [], history: [] },
): PlanDraft {
  const known = [...(draft.items ?? []), ...(draft.history ?? [])];
  const currentIds = new Set(remedies.map((item) => item.id));
  const items = remedies.map((remedy, index) => {
    const prior = known.find((row) => row.id === remedy.id);
    const incoming =
      generated.find((row) => row.id === remedy.id) ??
      (generated.length === remedies.length ? generated[index] : undefined);
    if (prior && hasUserContent(prior)) {
      return {
        ...prior,
        remedyText: remedy.text,
        scamperLabel: remedy.scamperLabel,
      };
    }
    return incoming ? { ...incoming, id: remedy.id, remedyText: remedy.text, scamperLabel: remedy.scamperLabel } : fallbackPlan(remedy);
  });
  const history: ExperimentPlan[] = [];
  const seen = new Set(items.map((item) => item.id));
  for (const row of known) {
    if (seen.has(row.id) || currentIds.has(row.id)) continue;
    seen.add(row.id);
    history.push(row);
  }
  return { ...draft, items, history };
}

export function planBlockReason(items: ExperimentPlan[]): string | null {
  if (items.length === 0) return "没有实施计划。请先在第五步勾选要推进的对策。";
  const incomplete = items.find((item) => !filled(item.who) || !filled(item.what) || !filled(item.when) || !filled(item.how));
  if (incomplete) return "每张计划都要写清谁、做什么、何时、如何，再进入评价结果。";
  if (items.some((item) => !filled(item.hypothesis) || !filled(item.success) || !filled(item.stop) || !filled(item.owner))) {
    return "每张计划都要写清核心假设、成功标准、停止标准和责任人。";
  }
  if (items.some((item) => !item.checkpoints.some((row) => row.trim()))) {
    return "每张计划至少写一条中间检查点。";
  }
  return null;
}

export function planWarnings(item: ExperimentPlan): string[] {
  const warnings: string[] = [];
  if (!filled(item.who) || !filled(item.what) || !filled(item.when) || !filled(item.how)) {
    warnings.push("5W2H 还缺谁 / 做什么 / 何时 / 如何。");
  }
  if (!filled(item.hypothesis)) warnings.push("还没有核心假设：写成“如果做 X，Y 会怎样变”。");
  if (!filled(item.success) || !filled(item.stop)) warnings.push("还要写清成功标准和停止标准，失败必须可退回。");
  if (!filled(item.owner)) warnings.push("还没有责任人：由谁推动、谁记录。");
  if (!item.checkpoints.some((row) => row.trim())) warnings.push("至少设一条中间检查点。");
  if (/加强意识|提高责任心|加强沟通|加强培训|加强管理/.test(`${item.what} ${item.how}`)) {
    warnings.push("不要把“加强意识 / 沟通 / 培训”写成行动。");
  }
  if (/全面推广|永久|不可逆|上线全量/.test(`${item.scope} ${item.how} ${item.expand}`)) {
    warnings.push("先做两周内可停止的最小实验，不要一上来全量铺开。");
  }
  return warnings;
}

export function handoffFromRemedies(record: CaseRecord): string {
  const causes = selectedCausesOf(record);
  const chosen = record.remedy.options.filter((item) => item.chosen);
  const causeText = causes
    .map((item) => `- ${item.text}${item.mechanism ? `（${item.mechanism}）` : ""}`)
    .join("\n");
  const remedyText = chosen
    .map((item) => `- ${item.id}｜${item.scamperLabel}｜影响${item.impact}×可行${item.feasibility}｜${item.text}`)
    .join("\n");
  return [
    handoffFromGoals(record),
    "【本轮末端原因】",
    causeText || "（无）",
    "【要推进的对策】",
    remedyText || "（无）",
  ].join("\n");
}

function filled(value: string): boolean {
  return value.trim().length > 0 && !/^（可改）/.test(value.trim());
}

function hasUserContent(item: ExperimentPlan): boolean {
  return [item.who, item.how, item.owner, item.success, item.object, item.record].some((field) => field.trim().length > 0);
}

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}
