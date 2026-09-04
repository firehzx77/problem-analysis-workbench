import type {
  ConsolidateDraft,
  ExperimentPlan,
  GoalItem,
  ReviewDraft,
  ReviewItem,
} from "@/domain/case";

export const OUTCOMES: { id: Exclude<ReviewItem["outcome"], "">; label: string }[] = [
  { id: "met", label: "达成" },
  { id: "exceeded", label: "超过" },
  { id: "missed", label: "未达成" },
];

export const DEVIATIONS: { id: Exclude<ReviewItem["deviation"], "">; label: string; hint: string }[] = [
  { id: "result", label: "结果偏差", hint: "做对了，但假设或目标没对上" },
  { id: "execution", label: "执行偏差", hint: "计划没按写的做" },
  { id: "both", label: "两者都有", hint: "既没做全，结果也对不上" },
  { id: "unknown", label: "尚难区分", hint: "证据还不够，先标未知" },
];

export function emptyReviewItem(plan: ExperimentPlan, goal?: GoalItem): ReviewItem {
  return {
    id: plan.id,
    planLabel: plan.what || plan.remedyText || plan.scamperLabel || "未命名实验",
    goalLabel: goal?.problemLabel || "",
    target: plan.success || goal?.target || "",
    actual: "",
    outcome: "",
    gap: "",
    appeared: "",
    disappeared: "",
    deviation: "",
    deviationReason: "",
  };
}

export function reviewsFromPlans(plans: ExperimentPlan[], goals: GoalItem[], draft: ReviewDraft): ReviewDraft {
  const known = draft.items ?? [];
  const items = plans.map((plan, index) => {
    const prior = known.find((row) => row.id === plan.id);
    const goal = goals[index] ?? goals[0];
    if (!prior) return emptyReviewItem(plan, goal);
    return {
      ...prior,
      planLabel: plan.what || plan.remedyText || prior.planLabel,
      goalLabel: prior.goalLabel || goal?.problemLabel || "",
      target: prior.target || plan.success || goal?.target || "",
    };
  });
  return { ...draft, items };
}

export function reviewBlockReason(draft: ReviewDraft): string | null {
  if (draft.items.length === 0) return "没有对照卡。请先在第六步写好实施计划，再进入评价结果。";
  if (draft.items.some((item) => !item.outcome || !item.actual.trim())) {
    return "每张对照卡都要填写实际结果，并选择达成 / 超过 / 未达成。";
  }
  if (draft.items.some((item) => !item.deviation)) {
    return "请区分每项是结果偏差、执行偏差，还是两者都有 / 尚难区分。";
  }
  return null;
}

export function reviewWarnings(item: ReviewItem): string[] {
  const warnings: string[] = [];
  if (!item.actual.trim()) warnings.push("还没有实际结果，对照目标写可观察的事实。");
  if (!item.outcome) warnings.push("请选择达成 / 超过 / 未达成。");
  if (!item.deviation) warnings.push("请区分结果偏差与执行偏差。");
  if (/不错|很好|还可以|顺利/.test(item.actual) && item.actual.trim().length < 12) {
    warnings.push("避免只写评价，写清指标或现象发生了什么。");
  }
  return warnings;
}

export function consolidateWarnings(draft: ConsolidateDraft): string[] {
  const warnings: string[] = [];
  if (!draft.sop.trim() && !draft.checklist.trim() && !draft.caseLibrary.trim()) {
    warnings.push("固化三件套还是空的：至少写清什么进 SOP / 检查表 / 案例库。");
  }
  if (!draft.spreadBoundary.trim()) warnings.push("还没有横向推广边界：哪些情况不能照搬。");
  if (!draft.nextImprove.trim()) warnings.push("还没有下一轮改善点。");
  if (!draft.confirmed.trim() && !draft.rejected.trim() && !draft.unknown.trim()) {
    warnings.push("复盘假设：哪些被证实、被推翻、仍未知。");
  }
  return warnings;
}
