import type { FocusItem, GapStatement, GoalItem } from "@/domain/case";

export function composeGoalStatement(item: GoalItem): string {
  const problem = item.problemLabel.trim() || "（关键问题）";
  const metric = item.metric.trim() || "（指标）";
  const baseline = item.baseline.trim() || "（现状）";
  const target = item.target.trim() || "（目标程度）";
  const deadline = item.deadline.trim() || "（期限）";
  return `针对「${problem}」，${metric}从${baseline}到${target}，期限${deadline}。`;
}

export function goalsFromFocuses(
  focuses: FocusItem[],
  gap: GapStatement,
  draft: { items?: GoalItem[]; history?: GoalItem[] } = {},
): { items: GoalItem[]; history: GoalItem[] } {
  const known = [...(draft.items ?? []), ...(draft.history ?? [])];
  const chosenIds = new Set(focuses.filter((item) => item.chosen).map((item) => item.id));
  const items = focuses
    .filter((item) => item.chosen)
    .map((item) => {
      const prior = known.find((row) => row.id === item.id);
      const next: GoalItem = {
        id: item.id,
        problemLabel: item.label,
        metric: prior?.metric || gap.metric,
        baseline: prior?.baseline || gap.fromA,
        target: prior?.target || gap.toB,
        deadline: prior?.deadline || "",
        leadIndicator: prior?.leadIndicator || "",
        resultIndicator: prior?.resultIndicator || "",
        guardIndicator: prior?.guardIndicator || "",
        statement: prior?.statement || "",
      };
      return { ...next, statement: next.statement || composeGoalStatement(next) };
    });
  const seen = new Set(items.map((item) => item.id));
  const history: GoalItem[] = [];
  for (const row of known) {
    if (seen.has(row.id) || chosenIds.has(row.id)) continue;
    seen.add(row.id);
    history.push(row);
  }
  return { items, history };
}

export function goalsBlockReason(items: GoalItem[]): string | null {
  if (items.length === 0) return "没有关键问题目标。请先回到第二步勾选要研究的问题。";
  if (items.some((item) => !item.metric.trim() || !item.deadline.trim() || !item.target.trim())) {
    return "每条关键问题目标都要写清指标、期限和目标程度，再进入把握真因。";
  }
  return null;
}

export function handoffFromGoals(record: { title: string; define: { statement: string; gap: GapStatement; scene: string }; analyze: { focuses: FocusItem[]; sourceSnapshot: string }; goal: { items: GoalItem[] } }): string {
  const goals = record.goal.items
    .map((item) => {
      const focus = record.analyze.focuses.find((row) => row.id === item.id);
      const needs = (focus?.dataNeeds ?? []).filter(Boolean).join("；") || "（未填）";
      return [
        `### ${item.problemLabel}`,
        `目标：${item.statement || composeGoalStatement(item)}`,
        `指标：${item.metric}，从 ${item.baseline} 到 ${item.target}，期限 ${item.deadline}`,
        `领先指标：${item.leadIndicator || "（未填）"}`,
        `结果指标：${item.resultIndicator || "（未填）"}`,
        `护栏：${item.guardIndicator || "（未填）"}`,
        `建议收集的验证数据：${needs}`,
      ].join("\n");
    })
    .join("\n\n");
  return [
    `课题：${record.title}`,
    `场景：${record.define.scene || "（未填）"}`,
    `差距陈述：${record.define.statement || "（未填）"}`,
    "【关键问题目标】",
    goals || "（无）",
  ].join("\n");
}

export function goalWarnings(item: GoalItem): string[] {
  const text = `${item.target} ${item.statement}`;
  const warnings: string[] = [];
  if (!item.deadline.trim()) warnings.push("还没有期限：目标要写清到什么时候。");
  if (!item.target.trim()) warnings.push("还没有程度：目标要写清解决到什么程度。");
  if (!item.metric.trim()) warnings.push("还没有指标：最好能对照差距陈述里的同一口径。");
  if (/努力|彻底|妥善|全面提升|加强管理|提高意识/.test(text)) {
    warnings.push("避免“努力 / 彻底 / 妥善 / 提高意识”这类抽象词。");
  }
  if (/通过|采取|实施培训|上系统|加强沟通/.test(text)) {
    warnings.push("不要把手段或行动写成目标。");
  }
  return warnings;
}
