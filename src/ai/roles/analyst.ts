import { chatComplete } from "@/ai/chat";
import { parseModelJson } from "@/ai/json";
import { hydrateTree } from "@/domain/analyze";
import type { MatrixItem, ProblemNode } from "@/domain/case";
import type { ModelSettings } from "@/domain/settings";

const BASE = `你是“系统分析师”。只基于学员上一步「明确问题」的输出做分解，不重新选题，不编造数据。
事实 / 解释 / 假设必须分开。每层问题树只用一个 MECE 切分标准。
禁止把“意识不足 / 沟通不到位 / 管理要加强”写成节点。不要替学员做最终判断。`;

export async function generateProblemTree(
  settings: ModelSettings,
  handoff: string,
  dimension = "",
): Promise<{ dimension: string; tree: ProblemNode[] }> {
  const chosen = dimension.trim();
  const dimensionRule = chosen
    ? `学员已选定本层切分标准：${chosen}。一级分支必须按这一个标准拆，不要换成别的标准，也不要在同一层混用两个标准。dimension 请写回该标准，必要时可写得更具体，例如「流程环节：从接单到验收」。`
    : `请从常用标准里选一个最贴切的（流程环节 / 输入—过程—输出 / 对象类型 / 时间阶段 / 地点或渠道 / 内部与外部 / 问题表现 / 人机料法环），并在 dimension 写明。`;
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `请根据上一步输出，生成一棵可修改、可勾选的问题树（问题树回答“要分析哪些方面”，先不要追根因）。

【上一步输出】
${handoff}

【切分要求】
${dimensionRule}

只返回 JSON：
{
  "dimension": "本层切分标准，例如流程环节 / 对象类型 / 时间阶段",
  "nodes": [
    {
      "label": "分支名称，写成可观察的问题侧面",
      "selected": true,
      "children": [
        { "label": "更具体的子问题", "selected": true, "children": [] }
      ]
    }
  ]
}
要求：3—6 个一级分支；叶子尽量具体；信息不足的分支也要标出并保持 selected 为 true。`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{ dimension?: string; nodes?: unknown }>(text);
  const tree = hydrateTree(data.nodes);
  if (tree.length === 0) throw new Error("问题树是空的，请重试或手动补充分支");
  return { dimension: data.dimension?.trim() || "未标明切分标准", tree };
}

export async function suggestMatrixScores(
  settings: ModelSettings,
  handoff: string,
  items: MatrixItem[],
): Promise<{ id?: string; label?: string; impact?: number; actionability?: number }[]> {
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `学员已确认问题树中的这些候选问题。请为每项给出影响度、可行动性的建议分（1—5 整数）。
影响度：对差距指标的影响。可行动性：学员现在能推动的程度。不要只把“最严重”打高分。

【上一步输出】
${handoff}

【候选问题】
${items.map((item) => `- ${item.id}｜${item.label}`).join("\n")}

只返回 JSON：
{ "scores": [ { "id": "原id", "label": "原名称", "impact": 4, "actionability": 3 } ] }`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{ scores?: { id?: string; label?: string; impact?: number; actionability?: number }[] }>(text);
  return data.scores ?? [];
}

export async function suggestDataNeeds(
  settings: ModelSettings,
  handoff: string,
  items: MatrixItem[],
): Promise<Record<string, string[]>> {
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `以下是优先焦点问题。请为每一项列出 2—4 条“需要收集哪些数据才能验证它是否成立”。
数据必须可观察、可对照到差距指标；写清口径或来源，不要写“加强调研”这种空话。

【上一步输出】
${handoff}

【优先问题】
${items.map((item) => `- ${item.id}｜${item.label}（影响${item.impact} × 行动${item.actionability}）`).join("\n")}

只返回 JSON：
{ "needs": [ { "id": "原id", "label": "原名称", "data": ["数据1", "数据2"] } ] }`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{
    needs?: { id?: string; label?: string; data?: string[] }[];
  }>(text);
  const map: Record<string, string[]> = {};
  for (const row of data.needs ?? []) {
    const list = (row.data ?? []).map((item) => item.trim()).filter(Boolean);
    if (row.id) map[row.id] = list;
    if (row.label) map[row.label] = list;
  }
  return map;
}
