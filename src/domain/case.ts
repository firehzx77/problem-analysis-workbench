export const SCHEMA_VERSION = 1 as const;

export type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type GateId = "gate1" | "gate2" | "gate3";
export type ProblemKind = "restore" | "prevent" | "ideal" | "";
export type ProblemMode = "occurred" | "set" | "";
export type RouteChoice = "A" | "B" | "";
export type EvidenceState = "known" | "unknown" | "hypothesis";

export interface GateRecord {
  passed: boolean;
  checklist: Record<string, boolean>;
  rationale: string;
  passedAt: string | null;
}

export interface ScanItem {
  id: string;
  text: string;
  againType: "again-do" | "again-wrong" | "";
  easy: boolean;
  efficient: boolean;
  evaluable: boolean;
  economical: boolean;
  impact: number;
  actionability: number;
}

export interface CircleItem {
  id: string;
  text: string;
  circle: "control" | "influence" | "concern" | "";
  reason: string;
}

export interface AttachmentMeta {
  id: string;
  name: string;
  ext: string;
  size: number;
  extractedText: string;
  extractError: string;
  addedAt: string;
}

export interface GapStatement {
  who: string;
  whenWhere: string;
  metric: string;
  fromA: string;
  toB: string;
  impact: string;
}

export interface DefineDraft {
  sourceMaterial: string;
  attachments: AttachmentMeta[];
  scanItems: ScanItem[];
  circles: CircleItem[];
  scene: string;
  currentValue: string;
  expectedValue: string;
  gap: GapStatement;
  statement: string;
  keywords: string;
  kind: ProblemKind;
  mode: ProblemMode;
  baidu: {
    background: string;
    actual: string;
    impact: string;
    done: string;
    expected: string;
  };
  boundary: string;
  outOfScope: string;
}

export type AnalyzePhase = "tree" | "matrix" | "focus";

export interface ProblemNode {
  id: string;
  label: string;
  selected: boolean;
  children: ProblemNode[];
}

export interface MatrixItem {
  id: string;
  label: string;
  impact: number;
  actionability: number;
}

export interface FocusItem {
  id: string;
  label: string;
  impact: number;
  actionability: number;
  score: number;
  dataNeeds: string[];
  chosen: boolean;
}

export interface GoalItem {
  id: string;
  problemLabel: string;
  metric: string;
  baseline: string;
  target: string;
  deadline: string;
  leadIndicator: string;
  resultIndicator: string;
  guardIndicator: string;
  statement: string;
}

export interface GoalDraft {
  items: GoalItem[];
  history: GoalItem[];
}

export type CauseVerdict = "pending" | "hold" | "reject" | "unknown";

export interface CauseHypothesis {
  id: string;
  text: string;
  mechanism: string;
  confidence: number;
  support: string;
  counter: string;
  missing: string;
  verify: string;
  verdict: CauseVerdict;
  verdictReason: string;
  depth: number;
  whyQuestion: string;
  children: CauseHypothesis[];
}

export interface CauseCluster {
  goalId: string;
  problemLabel: string;
  goalStatement: string;
  hypotheses: CauseHypothesis[];
}

export type TerminalKind = "hold" | "unknown";

export interface TerminalCause {
  id: string;
  sourceHypothesisId: string;
  problemId: string;
  problemLabel: string;
  goalStatement: string;
  text: string;
  sourceText: string;
  mechanism: string;
  chain: string[];
  depth: number;
  kind: TerminalKind;
  verdictReason: string;
  support: string;
  verify: string;
  missing: string;
  kept: boolean;
  note: string;
  addedAt: string;
}

export interface CauseDraft {
  sourceSnapshot: string;
  ranAt: string | null;
  error: string;
  clusters: CauseCluster[];
  pool: TerminalCause[];
  ignoredSourceIds: string[];
}

export type RemedyPhase = "causes" | "fiveW" | "scamper" | "matrix";
export type FiveWKey = "who" | "what" | "when" | "where" | "why";

export interface FiveWPrompt {
  id: string;
  key: FiveWKey;
  label: string;
  question: string;
  selected: boolean;
}

export interface ScamperIdea {
  id: string;
  action: string;
  actionLabel: string;
  text: string;
  selected: boolean;
}

export interface RemedyOption {
  id: string;
  text: string;
  sourceCauseIds: string[];
  focusIds: string[];
  scamperAction: string;
  scamperLabel: string;
  impact: number;
  feasibility: number;
  chosen: boolean;
}

export interface RemedyDraft {
  phase: RemedyPhase;
  sourceSnapshot: string;
  ranAt: string | null;
  error: string;
  selectedCauseIds: string[];
  fiveW: FiveWPrompt[];
  scamper: ScamperIdea[];
  options: RemedyOption[];
}

export interface ExperimentPlan {
  id: string;
  remedyText: string;
  scamperLabel: string;
  who: string;
  what: string;
  when: string;
  where: string;
  why: string;
  how: string;
  cost: string;
  hypothesis: string;
  object: string;
  scope: string;
  period: string;
  baseline: string;
  leadIndicator: string;
  resultIndicator: string;
  guardIndicator: string;
  success: string;
  stop: string;
  expand: string;
  owner: string;
  record: string;
  confounders: string;
  checkpoints: string[];
  report: string;
  escalate: string;
}

export interface PlanDraft {
  sourceSnapshot: string;
  ranAt: string | null;
  error: string;
  items: ExperimentPlan[];
  history: ExperimentPlan[];
}

export type OutcomeLevel = "" | "met" | "exceeded" | "missed";
export type DeviationKind = "" | "result" | "execution" | "both" | "unknown";

export interface ReviewItem {
  id: string;
  planLabel: string;
  goalLabel: string;
  target: string;
  actual: string;
  outcome: OutcomeLevel;
  gap: string;
  appeared: string;
  disappeared: string;
  deviation: DeviationKind;
  deviationReason: string;
}

export interface ReviewDraft {
  items: ReviewItem[];
  skippedSteps: string;
  gateNotes: string;
  processNote: string;
}

export interface ConsolidateDraft {
  sop: string;
  checklist: string;
  caseLibrary: string;
  keepExperiment: string;
  spreadBoundary: string;
  nextImprove: string;
  confirmed: string;
  rejected: string;
  unknown: string;
  keyEvents: string;
  lessons: string;
  reflect1: string;
  reflect2: string;
  reflect3: string;
}

export interface AnalyzeDraft {
  markdown: string;
  sourceSnapshot: string;
  ranAt: string | null;
  error: string;
  phase: AnalyzePhase;
  dimension: string;
  tree: ProblemNode[];
  treeConfirmed: boolean;
  matrix: MatrixItem[];
  matrixConfirmed: boolean;
  focuses: FocusItem[];
}

export interface CaseRecord {
  id: string;
  schemaVersion: typeof SCHEMA_VERSION;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentStep: StepId;
  gates: Record<GateId, GateRecord>;
  define: DefineDraft;
  analyze: AnalyzeDraft;
  goal: GoalDraft;
  cause: CauseDraft;
  remedy: RemedyDraft;
  plan: PlanDraft;
  review: ReviewDraft;
  consolidate: ConsolidateDraft;
}

export const GATE_CHECKLISTS: Record<GateId, { id: string; label: string }[]> = {
  gate1: [
    { id: "data", label: "问题已数据化：有可观察的现状与期望，不是一句评价" },
    { id: "object", label: "问题已对象化：知道发生在谁 / 什么对象上" },
    { id: "bound", label: "问题已边界化：范围清楚，暂不讨论项已标出" },
  ],
  gate2: [
    { id: "tree", label: "问题树已确认，切分标准清楚，分支互不重叠" },
    { id: "matrix", label: "优先焦点来自高影响 × 高可行动，不是只选最严重的" },
    { id: "data", label: "已选出要具体研究的关键问题，且每条都写清了要收集哪些验证数据" },
  ],
  gate3: [
    { id: "risk", label: "主要风险可接受，不可逆项已经看过" },
    { id: "assumption", label: "关键假设可以先用小实验验证" },
    { id: "decide", label: "由我本人拍板推进，不是把决策交给 AI" },
  ],
};

export const STEPS: {
  id: StepId;
  name: string;
  short: string;
  gateAfter?: GateId;
  role: string;
}[] = [
  { id: 1, name: "明确问题", short: "选题与定义", gateAfter: "gate1", role: "问题雷达 / 定义教练" },
  { id: 2, name: "分解问题", short: "结构与假设", gateAfter: "gate2", role: "系统分析师" },
  { id: 3, name: "设定目标", short: "到何时、到何程度", role: "目标检查" },
  { id: 4, name: "把握真因", short: "带证据追问", role: "原因假设 / 学员判断" },
  { id: 5, name: "制定对策", short: "发散再取舍", gateAfter: "gate3", role: "创新引导师 / 红队" },
  { id: 6, name: "贯彻实施", short: "最小实验", role: "行动实验设计师" },
  { id: 7, name: "评价结果", short: "对照与偏差", role: "结果对照" },
  { id: 8, name: "巩固成果", short: "复盘与固化", role: "复盘教练" },
];

export function emptyGate(): GateRecord {
  return { passed: false, checklist: {}, rationale: "", passedAt: null };
}

export function emptyGap(): GapStatement {
  return { who: "", whenWhere: "", metric: "", fromA: "", toB: "", impact: "" };
}

export function emptyAnalyze(): AnalyzeDraft {
  return {
    markdown: "",
    sourceSnapshot: "",
    ranAt: null,
    error: "",
    phase: "tree",
    dimension: "",
    tree: [],
    treeConfirmed: false,
    matrix: [],
    matrixConfirmed: false,
    focuses: [],
  };
}

export function emptyGoal(): GoalDraft {
  return { items: [], history: [] };
}

export function emptyCause(): CauseDraft {
  return { sourceSnapshot: "", ranAt: null, error: "", clusters: [], pool: [], ignoredSourceIds: [] };
}

export function emptyRemedy(): RemedyDraft {
  return {
    phase: "causes",
    sourceSnapshot: "",
    ranAt: null,
    error: "",
    selectedCauseIds: [],
    fiveW: [],
    scamper: [],
    options: [],
  };
}

export function emptyPlan(): PlanDraft {
  return { sourceSnapshot: "", ranAt: null, error: "", items: [], history: [] };
}

export function emptyReview(): ReviewDraft {
  return { items: [], skippedSteps: "", gateNotes: "", processNote: "" };
}

export function emptyConsolidate(): ConsolidateDraft {
  return {
    sop: "",
    checklist: "",
    caseLibrary: "",
    keepExperiment: "",
    spreadBoundary: "",
    nextImprove: "",
    confirmed: "",
    rejected: "",
    unknown: "",
    keyEvents: "",
    lessons: "",
    reflect1: "",
    reflect2: "",
    reflect3: "",
  };
}

function normalizeHypothesis(item: CauseHypothesis, depth: number): CauseHypothesis {
  const nextDepth = item.depth ?? depth;
  return {
    ...item,
    verdict: item.verdict ?? "pending",
    verdictReason: item.verdictReason ?? "",
    confidence: item.confidence || 3,
    depth: nextDepth,
    whyQuestion: item.whyQuestion ?? "",
    children: (item.children ?? []).map((child) => normalizeHypothesis(child, nextDepth + 1)),
  };
}

export function composeGapStatement(gap: GapStatement): string {
  const who = gap.who.trim();
  const whenWhere = gap.whenWhere.trim();
  const metric = gap.metric.trim();
  const fromA = gap.fromA.trim();
  const toB = gap.toB.trim();
  const impact = gap.impact.trim();
  if (!who && !whenWhere && !metric && !fromA && !toB && !impact) return "";
  return `${who || "（谁）"}在${whenWhere || "（何时 / 何处）"}，${metric || "（指标）"}从${fromA || "A"}变成${toB || "B"}，造成${impact || "（影响）"}。`;
}

export function handoffFromDefine(record: CaseRecord): string {
  const d = record.define;
  const files = d.attachments
    .map((file) => {
      const body = file.extractError
        ? `（未能抽取：${file.extractError}）`
        : file.extractedText.slice(0, 8000);
      return `### ${file.name}\n${body}`;
    })
    .join("\n\n");
  return [
    `课题：${record.title}`,
    `场景 / 任务：${d.scene || "（未填）"}`,
    `问题类型：${d.kind || "（未选）"}`,
    `差距陈述：${d.statement || composeGapStatement(d.gap) || "（未填）"}`,
    `谁：${d.gap.who || "（未填）"}`,
    `何时 / 何处：${d.gap.whenWhere || "（未填）"}`,
    `指标：${d.gap.metric || "（未填）"}`,
    `现状 A：${d.gap.fromA || d.currentValue || "（未填）"}`,
    `期望 B：${d.gap.toB || d.expectedValue || "（未填）"}`,
    `影响：${d.gap.impact || "（未填）"}`,
    `核心词：${d.keywords || "（未填）"}`,
    `边界：${d.boundary || "（未填）"}`,
    `暂不讨论：${d.outOfScope || "（未填）"}`,
    `人工判断 1：${record.gates.gate1.passed ? "已确认" : "未确认"}`,
    `判断依据：${record.gates.gate1.rationale || "（空）"}`,
    files ? `附件摘录：\n${files}` : "附件：无",
  ].join("\n");
}

export function nextStepId(step: StepId): StepId | null {
  return step < 8 ? ((step + 1) as StepId) : null;
}

export function judgmentToLeave(step: StepId): GateId | null {
  return STEPS.find((item) => item.id === step)?.gateAfter ?? null;
}

export function normalizeCase(record: CaseRecord): CaseRecord {
  const analyze = { ...emptyAnalyze(), ...record.analyze };
  return {
    ...record,
    define: {
      ...record.define,
      attachments: record.define.attachments ?? [],
      gap: { ...emptyGap(), ...record.define.gap },
    },
    analyze: {
      ...analyze,
      focuses: (analyze.focuses ?? []).map((item) => ({
        ...item,
        dataNeeds: item.dataNeeds ?? [],
        chosen: Boolean(item.chosen),
      })),
    },
    goal: {
      ...emptyGoal(),
      ...record.goal,
      items: record.goal?.items ?? [],
      history: record.goal?.history ?? [],
    },
    cause: {
      ...emptyCause(),
      ...record.cause,
      clusters: (record.cause?.clusters ?? []).map((cluster) => ({
        ...cluster,
        hypotheses: (cluster.hypotheses ?? []).map((item) => normalizeHypothesis(item, 0)),
      })),
      pool: (record.cause?.pool ?? []).map((item) => ({
        ...item,
        kept: item.kept !== false,
        note: item.note ?? "",
        sourceText: item.sourceText ?? item.text ?? "",
        chain: item.chain ?? [],
        kind: item.kind === "unknown" ? "unknown" : "hold",
        verdictReason: item.verdictReason ?? "",
      })),
      ignoredSourceIds: record.cause?.ignoredSourceIds ?? [],
    },
    remedy: {
      ...emptyRemedy(),
      ...record.remedy,
      phase: normalizeRemedyPhase(record.remedy?.phase),
      selectedCauseIds: record.remedy?.selectedCauseIds ?? [],
      fiveW: (record.remedy?.fiveW ?? []).map((item) => ({
        ...item,
        selected: Boolean(item.selected),
        question: item.question ?? "",
        label: item.label ?? "",
        key: normalizeFiveWKey(item.key),
      })),
      scamper: (record.remedy?.scamper ?? []).map((item) => ({
        ...item,
        selected: Boolean(item.selected),
        text: item.text ?? "",
        action: item.action ?? "",
        actionLabel: item.actionLabel ?? item.action ?? "",
      })),
      options: (record.remedy?.options ?? []).map((item) => ({
        ...item,
        text: item.text ?? "",
        sourceCauseIds: item.sourceCauseIds ?? [],
        focusIds: item.focusIds ?? [],
        scamperAction: item.scamperAction ?? "",
        scamperLabel: item.scamperLabel ?? item.scamperAction ?? "",
        impact: item.impact || 3,
        feasibility: item.feasibility || 3,
        chosen: Boolean(item.chosen),
      })),
    },
    plan: {
      ...emptyPlan(),
      ...record.plan,
      items: (record.plan?.items ?? []).map(normalizePlanItem),
      history: (record.plan?.history ?? []).map(normalizePlanItem),
    },
    review: {
      ...emptyReview(),
      ...record.review,
      items: (record.review?.items ?? []).map(normalizeReviewItem),
    },
    consolidate: {
      ...emptyConsolidate(),
      ...record.consolidate,
    },
  };
}

function normalizeRemedyPhase(phase: RemedyDraft["phase"] | undefined): RemedyPhase {
  if (phase === "fiveW" || phase === "scamper" || phase === "matrix") return phase;
  return "causes";
}

function normalizeFiveWKey(key: FiveWPrompt["key"] | undefined): FiveWKey {
  if (key === "who" || key === "what" || key === "when" || key === "where" || key === "why") return key;
  return "what";
}

function normalizePlanItem(item: ExperimentPlan): ExperimentPlan {
  return {
    ...item,
    remedyText: item.remedyText ?? "",
    scamperLabel: item.scamperLabel ?? "",
    who: item.who ?? "",
    what: item.what ?? "",
    when: item.when ?? "",
    where: item.where ?? "",
    why: item.why ?? "",
    how: item.how ?? "",
    cost: item.cost ?? "",
    hypothesis: item.hypothesis ?? "",
    object: item.object ?? "",
    scope: item.scope ?? "",
    period: item.period ?? "",
    baseline: item.baseline ?? "",
    leadIndicator: item.leadIndicator ?? "",
    resultIndicator: item.resultIndicator ?? "",
    guardIndicator: item.guardIndicator ?? "",
    success: item.success ?? "",
    stop: item.stop ?? "",
    expand: item.expand ?? "",
    owner: item.owner ?? "",
    record: item.record ?? "",
    confounders: item.confounders ?? "",
    checkpoints: item.checkpoints ?? [],
    report: item.report ?? "",
    escalate: item.escalate ?? "",
  };
}

function normalizeReviewItem(item: ReviewItem): ReviewItem {
  const outcome = item.outcome;
  const deviation = item.deviation;
  return {
    ...item,
    planLabel: item.planLabel ?? "",
    goalLabel: item.goalLabel ?? "",
    target: item.target ?? "",
    actual: item.actual ?? "",
    outcome: outcome === "met" || outcome === "exceeded" || outcome === "missed" ? outcome : "",
    gap: item.gap ?? "",
    appeared: item.appeared ?? "",
    disappeared: item.disappeared ?? "",
    deviation:
      deviation === "result" || deviation === "execution" || deviation === "both" || deviation === "unknown"
        ? deviation
        : "",
    deviationReason: item.deviationReason ?? "",
  };
}

export function createCase(input: { title: string; scene: string }): CaseRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    title: input.title.trim(),
    createdAt: now,
    updatedAt: now,
    currentStep: 1,
    gates: {
      gate1: emptyGate(),
      gate2: emptyGate(),
      gate3: emptyGate(),
    },
    define: {
      sourceMaterial: "",
      attachments: [],
      scanItems: [],
      circles: [],
      scene: input.scene.trim(),
      currentValue: "",
      expectedValue: "",
      gap: emptyGap(),
      statement: "",
      keywords: "",
      kind: "",
      mode: "",
      baidu: {
        background: "",
        actual: "",
        impact: "",
        done: "",
        expected: "",
      },
      boundary: "",
      outOfScope: "",
    },
    analyze: emptyAnalyze(),
    goal: emptyGoal(),
    cause: emptyCause(),
    remedy: emptyRemedy(),
    plan: emptyPlan(),
    review: emptyReview(),
    consolidate: emptyConsolidate(),
  };
}

export function requiredGateForStep(step: StepId): GateId | null {
  if (step >= 6) return "gate3";
  if (step >= 3) return "gate2";
  if (step >= 2) return "gate1";
  return null;
}

export function isStepUnlocked(record: CaseRecord, step: StepId): boolean {
  if (step === 1) return true;
  const gate = requiredGateForStep(step);
  if (!gate) return true;
  return record.gates[gate].passed;
}

export function maxUnlockedStep(record: CaseRecord): StepId {
  if (record.gates.gate3.passed) return 8;
  if (record.gates.gate2.passed) return 5;
  if (record.gates.gate1.passed) return 2;
  return 1;
}

export function canPassGate(gate: GateRecord, gateId: GateId): string | null {
  const items = GATE_CHECKLISTS[gateId];
  const missing = items.filter((item) => !gate.checklist[item.id]);
  if (missing.length > 0) return "请先勾完本次人工判断的全部检查项。";
  const rationale = gate.rationale.trim();
  if (rationale.length < 12) return "判断依据至少写 12 个字，不能空过。";
  if (/^(没问题|通过|ok|OK|可以|是)$/.test(rationale)) {
    return "请写具体依据，不要只填“没问题 / 通过”。";
  }
  return null;
}

export function passGate(record: CaseRecord, gateId: GateId): CaseRecord {
  const error = canPassGate(record.gates[gateId], gateId);
  if (error) throw new Error(error);
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    gates: {
      ...record.gates,
      [gateId]: {
        ...record.gates[gateId],
        passed: true,
        passedAt: new Date().toISOString(),
      },
    },
  };
}

export function reopenGate(record: CaseRecord, gateId: GateId): CaseRecord {
  const resetFrom: Record<GateId, GateId[]> = {
    gate1: ["gate1", "gate2", "gate3"],
    gate2: ["gate2", "gate3"],
    gate3: ["gate3"],
  };
  const gates = { ...record.gates };
  for (const id of resetFrom[gateId]) {
    gates[id] = {
      ...gates[id],
      passed: false,
      passedAt: null,
    };
  }
  const currentStep: StepId = gateId === "gate1" ? 1 : gateId === "gate2" ? 2 : 5;
  return {
    ...record,
    currentStep,
    updatedAt: new Date().toISOString(),
    gates,
  };
}

export function touch(record: CaseRecord, patch: Partial<CaseRecord>): CaseRecord {
  return { ...record, ...patch, updatedAt: new Date().toISOString() };
}
