import { clampScore } from "@/domain/analyze";
import type {
  CauseCluster,
  CauseHypothesis,
  CauseDraft,
  CauseVerdict,
  GoalItem,
  TerminalCause,
} from "@/domain/case";

/** 0 = 第一层竞争性假设，最多追到第 5 层（depth 0–4）。 */
export const MAX_WHY_DEPTH = 4;

export const CAUSE_VERDICTS: { id: CauseVerdict; label: string; hint: string }[] = [
  { id: "pending", label: "尚未判断", hint: "先看完再判" },
  { id: "hold", label: "值得追", hint: "可选：再 5WHY，不是必须" },
  { id: "reject", label: "排除", hint: "目前不像" },
  { id: "unknown", label: "证据不足", hint: "先取证再判" },
];

export function newHypothesis(
  text = "可观察的流程机制原因（可改）",
  extras?: { depth?: number; whyQuestion?: string },
): CauseHypothesis {
  return {
    id: crypto.randomUUID(),
    text,
    mechanism: "",
    confidence: 3,
    support: "未知",
    counter: "未知",
    missing: "需要能对照差距指标的记录",
    verify: "抽同一批对象做一次对照",
    verdict: "pending",
    verdictReason: "",
    depth: extras?.depth ?? 0,
    whyQuestion: extras?.whyQuestion ?? "",
    children: [],
  };
}

export function fallbackCauseClusters(goals: GoalItem[]): CauseCluster[] {
  return goals.map((goal) => ({
    goalId: goal.id,
    problemLabel: goal.problemLabel,
    goalStatement: goal.statement,
    hypotheses: [
      newHypothesis("流程规则或交接环节有缺口（可改成具体机制）"),
      newHypothesis("输入信息不完整或口径不一致（可改）"),
      newHypothesis("外部依赖节奏与本团队排期错位（可改）"),
    ],
  }));
}

export function fallbackWhyChildren(parent: CauseHypothesis): CauseHypothesis[] {
  const depth = Math.min((parent.depth ?? 0) + 1, MAX_WHY_DEPTH);
  const whyQuestion = parent.whyQuestion?.trim() || `为什么会出现「${parent.text.trim() || "上一层机制"}」？`;
  return [
    newHypothesis("更底层的规则、交接或排队方式有缺口（可改成具体机制）", { depth, whyQuestion }),
    newHypothesis("更底层的输入信息不完整或口径不一致（可改）", { depth, whyQuestion }),
    newHypothesis("更底层的外部依赖与本环节节奏错位（可改）", { depth, whyQuestion }),
  ];
}

export function hydrateHypotheses(raw: unknown, depth = 0, whyQuestion = ""): CauseHypothesis[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const item = row as Partial<CauseHypothesis> & { children?: unknown };
    const question = String(item.whyQuestion ?? whyQuestion).trim();
    const next: CauseHypothesis = {
      id: crypto.randomUUID(),
      text: String(item.text ?? "").trim() || "未命名原因假设",
      mechanism: String(item.mechanism ?? "").trim(),
      confidence: clampScore(Number(item.confidence ?? 3)),
      support: String(item.support ?? "未知").trim() || "未知",
      counter: String(item.counter ?? "未知").trim() || "未知",
      missing: String(item.missing ?? "").trim(),
      verify: String(item.verify ?? "").trim(),
      verdict: "pending",
      verdictReason: "",
      depth,
      whyQuestion: question,
      children: [],
    };
    next.children = hydrateHypotheses(item.children, depth + 1, question);
    return next;
  });
}

export function mapHypothesis(
  list: CauseHypothesis[],
  id: string,
  fn: (item: CauseHypothesis) => CauseHypothesis,
): CauseHypothesis[] {
  return list.map((item) => {
    const children = item.children ?? [];
    if (item.id === id) return fn({ ...item, children });
    if (children.length === 0) return { ...item, children };
    return { ...item, children: mapHypothesis(children, id, fn) };
  });
}

export function removeHypothesis(list: CauseHypothesis[], id: string): CauseHypothesis[] {
  return list
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, children: removeHypothesis(item.children ?? [], id) }));
}

export function findHypothesis(list: CauseHypothesis[], id: string): CauseHypothesis | null {
  for (const item of list) {
    if (item.id === id) return item;
    const hit = findHypothesis(item.children, id);
    if (hit) return hit;
  }
  return null;
}

export function findChain(list: CauseHypothesis[], id: string, acc: CauseHypothesis[] = []): CauseHypothesis[] | null {
  for (const item of list) {
    const next = [...acc, item];
    if (item.id === id) return next;
    const hit = findChain(item.children, id, next);
    if (hit) return hit;
  }
  return null;
}

export function keptTerminals(draft: CauseDraft): TerminalCause[] {
  return (draft.pool ?? []).filter((item) => item.kept !== false);
}

function reasonText(item: { verdictReason?: string } | null | undefined): string {
  return (item?.verdictReason ?? "").trim();
}

export function findHypothesisReason(clusters: CauseCluster[], sourceId: string): string {
  if (!sourceId) return "";
  for (const cluster of clusters ?? []) {
    const node = findHypothesis(cluster.hypotheses ?? [], sourceId);
    if (node) return reasonText(node);
  }
  return "";
}

/** 勾选入池且纳入后续对策的条目即可进入下一步。 */
export function causeBlockReason(draft: CauseDraft, _activeGoalIds?: string[]): string | null {
  const pool = draft.pool ?? [];
  if (pool.length === 0) {
    return "请先勾选至少一条末端原因（在假设卡片上勾选「选入末端原因池」）。";
  }
  if (keptTerminals(draft).length === 0) {
    return "原因池里还没有勾选「纳入后续对策」的条目。请至少勾选一条再进入下一步。";
  }
  return null;
}

export function backfillPoolReasons(draft: CauseDraft): CauseDraft {
  const clusters = draft.clusters ?? [];
  return {
    ...draft,
    pool: (draft.pool ?? []).map((item) => {
      const current = reasonText(item);
      if (current) return { ...item, verdictReason: item.verdictReason ?? "" };
      const fromSource = findHypothesisReason(clusters, item.sourceHypothesisId);
      return {
        ...item,
        verdictReason: fromSource || item.verdictReason || "",
      };
    }),
  };
}

export function newManualTerminal(problemLabel = "手写补充", problemId = ""): TerminalCause {
  const text = "可观察、可验证、团队有权改变的末端机制（可改）";
  return {
    id: crypto.randomUUID(),
    sourceHypothesisId: "",
    problemId,
    problemLabel,
    goalStatement: "",
    text,
    sourceText: text,
    mechanism: "",
    chain: [text],
    depth: 0,
    kind: "hold",
    verdictReason: "",
    support: "未知",
    verify: "",
    missing: "",
    kept: true,
    note: "",
    addedAt: new Date().toISOString(),
  };
}

export function isInPool(pool: TerminalCause[], sourceHypothesisId: string): boolean {
  return pool.some((item) => item.sourceHypothesisId && item.sourceHypothesisId === sourceHypothesisId);
}

/** 只追加，绝不覆盖已入池的条目。同一假设重复点选会被忽略。 */
export function addNodeToPool(draft: CauseDraft, cluster: CauseCluster, nodeId: string): CauseDraft {
  const pool = draft.pool ?? [];
  if (isInPool(pool, nodeId)) return draft;
  const chain = findChain(cluster.hypotheses, nodeId);
  if (!chain?.length) return draft;
  const node = chain[chain.length - 1];
  const item: TerminalCause = {
    id: crypto.randomUUID(),
    sourceHypothesisId: node.id,
    problemId: cluster.goalId,
    problemLabel: cluster.problemLabel,
    goalStatement: cluster.goalStatement,
    text: node.text,
    sourceText: node.text,
    mechanism: node.mechanism,
    chain: chain.map((row) => row.text),
    depth: node.depth ?? Math.max(0, chain.length - 1),
    kind: node.verdict === "unknown" ? "unknown" : "hold",
    verdictReason: node.verdictReason ?? "",
    support: node.support,
    verify: node.verify,
    missing: node.missing,
    kept: true,
    note: "",
    addedAt: new Date().toISOString(),
  };
  return { ...draft, pool: [...pool, item] };
}

export function removeNodeFromPool(draft: CauseDraft, nodeId: string): CauseDraft {
  return {
    ...draft,
    pool: (draft.pool ?? []).filter((item) => item.sourceHypothesisId !== nodeId),
  };
}

export function groupPoolByProblem(pool: TerminalCause[]): { problemId: string; problemLabel: string; items: TerminalCause[] }[] {
  const order: string[] = [];
  const map = new Map<string, TerminalCause[]>();
  for (const item of pool) {
    const key = item.problemId || item.problemLabel || "其他";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  return order.map((key) => {
    const items = map.get(key) ?? [];
    return {
      problemId: key,
      problemLabel: items[0]?.problemLabel || "未标注问题",
      items,
    };
  });
}

export function mergeCauseClusters(
  goals: GoalItem[],
  generated: CauseCluster[],
  previous: CauseCluster[] = [],
): CauseCluster[] {
  return goals.map((goal, index) => {
    const hit =
      generated.find((item) => item.goalId === goal.id) ||
      generated.find((item) => item.problemLabel && item.problemLabel === goal.problemLabel) ||
      (generated.length === goals.length ? generated[index] : undefined);
    const prior = previous.find((item) => item.goalId === goal.id);
    const hypotheses = hit?.hypotheses?.length
      ? hit.hypotheses
      : prior?.hypotheses?.length
        ? prior.hypotheses
        : fallbackCauseClusters([goal])[0].hypotheses;
    return {
      goalId: goal.id,
      problemLabel: goal.problemLabel,
      goalStatement: goal.statement,
      hypotheses,
    };
  });
}

export function assembleClusters(
  previous: CauseCluster[],
  incoming: CauseCluster[],
  currentGoalIds: string[],
): CauseCluster[] {
  const byId = new Map(previous.map((item) => [item.goalId, item]));
  for (const row of incoming) byId.set(row.goalId, row);
  const current = currentGoalIds.map((id) => byId.get(id)).filter((item): item is CauseCluster => Boolean(item));
  const archived = previous.filter((item) => !currentGoalIds.includes(item.goalId));
  return [...current, ...archived];
}

export function whyLayerLabel(depth: number, index: number): string {
  if (depth <= 0) return `假设 ${index + 1}`;
  return `WHY${depth + 1} · ${index + 1}`;
}
