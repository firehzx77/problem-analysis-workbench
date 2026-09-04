import type { CaseRecord, CauseHypothesis, ExperimentPlan, ReviewItem } from "@/domain/case";
import { emptyConsolidate } from "@/domain/case";
import { flattenTreeLabels, scoreOf } from "@/domain/analyze";
import { CAUSE_VERDICTS, whyLayerLabel } from "@/domain/cause";
import { DEVIATIONS, OUTCOMES } from "@/domain/review";

export interface ReportSlide {
  heading: string;
  lines: string[];
}

export function buildReport(record: CaseRecord): ReportSlide[] {
  const slides: ReportSlide[] = [
    {
      heading: record.title || "课题档案",
      lines: [
        `场景 / 任务：${record.define.scene || "（未填）"}`,
        `当前步骤：第 ${record.currentStep} 步`,
        `导出时间：${new Date().toLocaleString("zh-CN")}`,
        "本档案不含 API Key。换设备请同时保留 JSON 备份。",
      ],
    },
    {
      heading: "人工判断",
      lines: [
        gateLine("判断 1", record.gates.gate1),
        gateLine("判断 2", record.gates.gate2),
        gateLine("判断 3", record.gates.gate3),
      ],
    },
    {
      heading: "1 明确问题",
      lines: [
        `差距陈述：${record.define.statement || "（未填）"}`,
        `谁：${record.define.gap.who || "（未填）"}`,
        `何时 / 何处：${record.define.gap.whenWhere || "（未填）"}`,
        `指标：${record.define.gap.metric || "（未填）"}`,
        `现状：${record.define.gap.fromA || "（未填）"} → 期望：${record.define.gap.toB || "（未填）"}`,
        `影响：${record.define.gap.impact || "（未填）"}`,
        `边界：${record.define.boundary || "（未填）"}`,
        `暂不讨论：${record.define.outOfScope || "（未填）"}`,
      ],
    },
    {
      heading: "2 分解问题",
      lines: [
        `切分标准：${record.analyze.dimension || "（未填）"}`,
        ...(flattenTreeLabels(record.analyze.tree).slice(0, 16) || ["（尚未生成问题树）"]),
        ...record.analyze.matrix.map(
          (item) => `矩阵：${item.label} 影响 ${item.impact} × 可行动 ${item.actionability} ＝ ${scoreOf(item)}`,
        ),
        ...record.analyze.focuses.map(
          (item) => `${item.chosen ? "【研究】" : ""}${item.label}（${item.score}分）`,
        ),
      ],
    },
    {
      heading: "3 设定目标",
      lines: record.goal.items.length
        ? record.goal.items.map(
            (item) =>
              `${item.problemLabel}：${item.metric || "（指标）"} 从 ${item.baseline || "（现状）"} 到 ${item.target || "（程度）"}，期限 ${item.deadline || "（未填）"}`,
          )
        : ["（尚未填写）"],
    },
    {
      heading: "4 把握真因",
      lines: [
        ...record.cause.clusters.flatMap((cluster) => [
          `问题：${cluster.problemLabel}`,
          ...formatCauseLines(cluster.hypotheses),
        ]),
        ...(record.cause.pool ?? []).length
          ? (record.cause.pool ?? []).map(
              (item) =>
                `【${item.kept !== false ? "纳入对策" : "不纳入"}】${item.text}${item.mechanism ? ` · ${item.mechanism}` : ""}`,
            )
          : ["末端原因池尚未收入"],
      ],
    },
    {
      heading: "5 制定对策",
      lines: [
        ...(record.remedy.fiveW ?? []).map(
          (item) => `${item.selected ? "【焦点】" : ""}${item.label}：${item.question}`,
        ),
        ...(record.remedy.scamper ?? []).map(
          (item) => `${item.selected ? "【对策】" : ""}${item.actionLabel}：${item.text}`,
        ),
        ...(record.remedy.options ?? []).map(
          (item) =>
            `${item.chosen ? "【推进】" : ""}${item.text}：影响 ${item.impact} × 可行 ${item.feasibility}`,
        ),
      ],
    },
    {
      heading: "6 贯彻实施",
      lines: (record.plan?.items ?? []).flatMap(planLines),
    },
    {
      heading: "7 评价结果",
      lines: [
        ...(record.review?.items ?? []).flatMap(reviewLines),
        record.review?.skippedSteps ? `跳过或补做的步骤：${record.review.skippedSteps}` : "",
        record.review?.gateNotes ? `闸门：${record.review.gateNotes}` : "",
        record.review?.processNote ? `过程评价：${record.review.processNote}` : "",
      ].filter(Boolean),
    },
    {
      heading: "8 巩固成果",
      lines: consolidateLines(record.consolidate ?? emptyConsolidate()),
    },
  ];
  return slides.map((slide) => ({
    ...slide,
    lines: slide.lines.map((line) => line.trim()).filter(Boolean),
  }));
}

export function reportToMarkdown(record: CaseRecord): string {
  const slides = buildReport(record);
  return slides
    .map((slide, index) => `${index === 0 ? "#" : "##"} ${slide.heading}\n\n${slide.lines.map((line) => `- ${line}`).join("\n")}`)
    .join("\n\n");
}

function gateLine(label: string, gate: CaseRecord["gates"]["gate1"]): string {
  return `${label}：${gate.passed ? `已确认 ${gate.passedAt || ""}` : "未确认"}。依据：${gate.rationale || "（空）"}`;
}

function formatCauseLines(list: CauseHypothesis[], indent = ""): string[] {
  return list.flatMap((item, index) => {
    const verdict = CAUSE_VERDICTS.find((row) => row.id === item.verdict)?.label ?? "尚未判断";
    const lines = [`${indent}${whyLayerLabel(item.depth ?? 0, index)} ${item.text}（${verdict}）`];
    if (item.children?.length) lines.push(...formatCauseLines(item.children, `${indent}  `));
    return lines;
  });
}

function planLines(item: ExperimentPlan): string[] {
  return [
    `${item.scamperLabel || "对策"}：${item.what || item.remedyText}`,
    `谁 ${item.who || "（未填）"} · 何时 ${item.when || "（未填）"} · 何地 ${item.where || "（未填）"}`,
    `如何：${item.how || "（未填）"}`,
    `假设：${item.hypothesis || "（未填）"}`,
    `成功 / 停止：${item.success || "（未填）"} / ${item.stop || "（未填）"}`,
    `责任人：${item.owner || "（未填）"}`,
  ];
}

function reviewLines(item: ReviewItem): string[] {
  const outcome = OUTCOMES.find((row) => row.id === item.outcome)?.label || "未选";
  const deviation = DEVIATIONS.find((row) => row.id === item.deviation)?.label || "未选";
  return [
    `${item.planLabel}：${outcome}`,
    `目标：${item.target || "（未填）"}`,
    `实际：${item.actual || "（未填）"}`,
    `偏差：${item.gap || "（未填）"} · ${deviation}${item.deviationReason ? `（${item.deviationReason}）` : ""}`,
    item.appeared ? `新出现：${item.appeared}` : "",
    item.disappeared ? `消失：${item.disappeared}` : "",
  ].filter(Boolean);
}

function consolidateLines(draft: CaseRecord["consolidate"]): string[] {
  return [
    `SOP：${draft.sop || "（未填）"}`,
    `检查表：${draft.checklist || "（未填）"}`,
    `案例库：${draft.caseLibrary || "（未填）"}`,
    `继续实验：${draft.keepExperiment || "（未填）"}`,
    `横向边界：${draft.spreadBoundary || "（未填）"}`,
    `下一轮改善：${draft.nextImprove || "（未填）"}`,
    `被证实：${draft.confirmed || "（未填）"}`,
    `被推翻：${draft.rejected || "（未填）"}`,
    `仍未知：${draft.unknown || "（未填）"}`,
    `关键事件：${draft.keyEvents || "（未填）"}`,
    `经验：${draft.lessons || "（未填）"}`,
    draft.reflect1 ? `反思 1：${draft.reflect1}` : "",
    draft.reflect2 ? `反思 2：${draft.reflect2}` : "",
    draft.reflect3 ? `反思 3：${draft.reflect3}` : "",
  ].filter(Boolean);
}
