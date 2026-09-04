import type { AnalyzeDraft, FocusItem, MatrixItem, ProblemNode } from "@/domain/case";

export interface DimensionPreset {
  id: string;
  label: string;
  hint: string;
  branches: string[];
}

export const DIMENSION_PRESETS: DimensionPreset[] = [
  {
    id: "process",
    label: "流程环节",
    hint: "按工作步骤拆。结构不清时优先用这个。",
    branches: ["接收与计划", "执行与协作", "检查与纠偏", "交付与验收"],
  },
  {
    id: "ipo",
    label: "输入—过程—输出",
    hint: "按 IPO 拆：进来的、加工中的、出去的。",
    branches: ["输入（需求 / 材料 / 信息）", "过程（加工 / 流转 / 决策）", "输出（交付物 / 结果）"],
  },
  {
    id: "object",
    label: "对象类型",
    hint: "按谁或什么对象拆，如客户、产品、岗位。",
    branches: ["对象 A（可改成具体客户 / 产品）", "对象 B", "对象 C"],
  },
  {
    id: "time",
    label: "时间阶段",
    hint: "按何时发生拆，便于对照同一指标。",
    branches: ["问题出现前", "集中发生期", "最近一次"],
  },
  {
    id: "place",
    label: "地点或渠道",
    hint: "按哪里发生拆，如门店、线上、仓库。",
    branches: ["地点 / 渠道 A", "地点 / 渠道 B", "其他场所"],
  },
  {
    id: "inout",
    label: "内部 / 外部",
    hint: "先分自己能推动的，和要协同外部的。",
    branches: ["内部可控", "跨团队协同", "外部依赖"],
  },
  {
    id: "symptom",
    label: "问题表现",
    hint: "按可观察的现象拆，先不要写成原因。",
    branches: ["表现 1（可改成具体现象）", "表现 2", "表现 3"],
  },
  {
    id: "4m1e",
    label: "人机料法环",
    hint: "现场类问题常用：人、机、料、法、环。",
    branches: ["人（谁在做）", "机（工具 / 系统）", "料（输入物）", "法（规则 / 方法）", "环（环境 / 约束）"],
  },
];

export function usableDimension(value: string): string {
  const text = value.trim();
  if (!text || /待补充|未标明|未填/.test(text)) return "";
  return text;
}

export function matchDimension(value: string): DimensionPreset | null {
  const text = usableDimension(value);
  if (!text) return null;
  return (
    DIMENSION_PRESETS.find((item) => item.label === text) ??
    DIMENSION_PRESETS.find((item) => text.startsWith(item.label) || item.label.startsWith(text)) ??
    null
  );
}

export function treeForDimension(rootLabel: string, dimension: string): { dimension: string; tree: ProblemNode[] } {
  const preset = matchDimension(dimension);
  if (!preset) return fallbackTree(rootLabel);
  return {
    dimension: preset.label,
    tree: [newNode(rootLabel || "待分解的问题", preset.branches.map((label) => newNode(label)))],
  };
}

export function looksLikeSkeletonTree(nodes: ProblemNode[]): boolean {
  if (nodes.length === 0) return true;
  return /分支 [ABC]（可改名）/.test(flattenTreeLabels(nodes).join("\n"));
}

export function newNode(label: string, children: ProblemNode[] = []): ProblemNode {
  return { id: crypto.randomUUID(), label, selected: true, children };
}

export function fallbackTree(rootLabel: string): { dimension: string; tree: ProblemNode[] } {
  return {
    dimension: "待补充切分标准（每层只用一个标准）",
    tree: [
      newNode(rootLabel || "待分解的问题", [
        newNode("分支 A（可改名）"),
        newNode("分支 B（可改名）"),
        newNode("分支 C（可改名）"),
      ]),
    ],
  };
}

export function hydrateTree(raw: unknown): ProblemNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const node = item as { label?: string; selected?: boolean; children?: unknown };
    return {
      id: crypto.randomUUID(),
      label: String(node.label ?? "").trim() || "未命名",
      selected: node.selected !== false,
      children: hydrateTree(node.children),
    };
  });
}

export function mapTree(nodes: ProblemNode[], id: string, fn: (node: ProblemNode) => ProblemNode): ProblemNode[] {
  return nodes.map((node) => {
    if (node.id === id) return fn(node);
    return { ...node, children: mapTree(node.children, id, fn) };
  });
}

export function removeNode(nodes: ProblemNode[], id: string): ProblemNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeNode(node.children, id) }));
}

function branchSelected(node: ProblemNode): boolean {
  return node.selected || node.children.some(branchSelected);
}

export function collectSelectedTips(nodes: ProblemNode[]): ProblemNode[] {
  const tips: ProblemNode[] = [];
  for (const node of nodes) {
    if (!branchSelected(node)) continue;
    const selectedKids = node.children.filter(branchSelected);
    if (node.selected && selectedKids.length === 0) tips.push(node);
    else tips.push(...collectSelectedTips(node.children));
  }
  return tips;
}

export function toMatrixItems(nodes: ProblemNode[]): MatrixItem[] {
  return collectSelectedTips(nodes).map((node) => ({
    id: node.id,
    label: node.label,
    impact: 3,
    actionability: 3,
  }));
}

export function applyScores(items: MatrixItem[], scores: { id?: string; label?: string; impact?: number; actionability?: number }[]): MatrixItem[] {
  return items.map((item) => {
    const hit =
      scores.find((row) => row.id === item.id) ??
      scores.find((row) => row.label === item.label);
    if (!hit) return item;
    return {
      ...item,
      impact: clampScore(hit.impact ?? item.impact),
      actionability: clampScore(hit.actionability ?? item.actionability),
    };
  });
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function scoreOf(item: MatrixItem): number {
  return item.impact * item.actionability;
}

export function quadrantOf(item: MatrixItem): "priority" | "hard" | "easy" | "low" {
  const highImpact = item.impact >= 4;
  const highAction = item.actionability >= 4;
  if (highImpact && highAction) return "priority";
  if (highImpact && !highAction) return "hard";
  if (!highImpact && highAction) return "easy";
  return "low";
}

export function pickFocuses(items: MatrixItem[]): MatrixItem[] {
  const ranked = [...items].sort((a, b) => scoreOf(b) - scoreOf(a));
  const priority = ranked.filter((item) => quadrantOf(item) === "priority");
  const rest = ranked.filter((item) => quadrantOf(item) !== "priority");
  return [...priority, ...rest].slice(0, 3);
}

export function toFocusItems(items: MatrixItem[], needs: Record<string, string[]>): FocusItem[] {
  return pickFocuses(items).map((item) => ({
    id: item.id,
    label: item.label,
    impact: item.impact,
    actionability: item.actionability,
    score: scoreOf(item),
    dataNeeds: needs[item.id] ?? needs[item.label] ?? defaultDataNeeds(item.label),
    chosen: quadrantOf(item) === "priority",
  }));
}

export function chosenFocuses(items: FocusItem[]): FocusItem[] {
  return items.filter((item) => item.chosen);
}

export function defaultDataNeeds(label: string): string[] {
  return [
    `「${label}」在观察期内的发生次数与时间分布`,
    "该分支与差距指标之间的对照数据（能对应到同一批对象）",
    "现场、系统或记录中可核对的原始凭证",
  ];
}

export function flattenTreeLabels(nodes: ProblemNode[], prefix = ""): string[] {
  const lines: string[] = [];
  nodes.forEach((node, index) => {
    const mark = node.selected ? "✓" : "·";
    const line = `${prefix}${index + 1}. ${mark} ${node.label}`;
    lines.push(line);
    lines.push(...flattenTreeLabels(node.children, `${prefix}  `));
  });
  return lines;
}

export function summarizeAnalyze(analyze: AnalyzeDraft): string {
  const matrixLines = analyze.matrix.map(
    (item) => `- ${item.label}：影响 ${item.impact} × 可行动 ${item.actionability} ＝ ${scoreOf(item)}（${quadrantLabel(item)}）`,
  );
  const focusLines = analyze.focuses.map((item) => {
    const needs = item.dataNeeds.filter(Boolean).map((need) => `    - ${need}`).join("\n");
    return `- ${item.chosen ? "【带入下一步】" : ""}${item.label}（${item.score}分）\n${needs || "    - （尚未填写取证数据）"}`;
  });
  return [
    `切分标准：${analyze.dimension || "（未填）"}`,
    analyze.treeConfirmed ? "问题树：已确认" : "问题树：未确认",
    ...flattenTreeLabels(analyze.tree),
    analyze.matrixConfirmed ? "矩阵：已确认" : "矩阵：未确认",
    ...matrixLines,
    "优先问题与取证：",
    ...(focusLines.length ? focusLines : ["- （尚未形成）"]),
  ].join("\n");
}

function quadrantLabel(item: MatrixItem): string {
  const map = {
    priority: "优先焦点",
    hard: "高影响低行动",
    easy: "低影响高行动",
    low: "低影响低行动",
  };
  return map[quadrantOf(item)];
}
