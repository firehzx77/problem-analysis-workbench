import { chatComplete } from "@/ai/chat";
import { parseModelJson } from "@/ai/json";
import type { FiveWPrompt, ScamperIdea, TerminalCause } from "@/domain/case";
import { hydrateFiveW, hydrateScamper } from "@/domain/remedy";
import type { ModelSettings } from "@/domain/settings";

const BASE = `你是“创新对策引导师”。只扩展方案空间，不替学员做最终决策，不宣布唯一对策。
只基于学员已选的末端原因和变化焦点提问或发散。不编造数据。证据不足就写“未知”，不要补故事。
禁止把对策写成：加强意识、提高责任心、加强沟通、加强培训、加强管理、新员工适应。
每条提问或想法必须落到可观察的规则、接口、节奏、职责或交付物上。不要替人拍板。`;

export async function generateFiveW(
  settings: ModelSettings,
  handoff: string,
  causes: TerminalCause[],
): Promise<FiveWPrompt[]> {
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `请针对学员勾选的末端原因，给出 5W 提问，帮助学员选择“从哪里改”。每个 W 只出 1 个具体问题，要能直接勾选为变化焦点。不要给对策，只提问。

【上一步输出与本轮原因】
${handoff}

【末端原因】
${causes.map((item) => `- ${item.id}｜${item.text}`).join("\n")}

只返回 JSON：
{
  "prompts": [
    { "key": "who", "label": "谁 Who", "question": "具体问谁的职责 / 工作方式要改" },
    { "key": "what", "label": "什么 What", "question": "具体问改哪条规则 / 接口 / 交付物" },
    { "key": "when", "label": "何时 When", "question": "具体问在哪个时点或节奏上改" },
    { "key": "where", "label": "何处 Where", "question": "具体问在哪个环节 / 场所 / 系统改" },
    { "key": "why", "label": "为何 Why", "question": "具体问这次改变要撬动哪段机制" }
  ]
}`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{ prompts?: unknown }>(text);
  return hydrateFiveW(data.prompts, causes);
}

export async function generateScamper(
  settings: ModelSettings,
  handoff: string,
  causes: TerminalCause[],
  focuses: FiveWPrompt[],
): Promise<ScamperIdea[]> {
  const focusText = focuses
    .filter((item) => item.selected)
    .map((item) => `- ${item.key}｜${item.question}`)
    .join("\n");
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `学员已选变化焦点。请用 SCAMPER 七个动作各给出 1 条可执行的对策想法，帮助发散，不要收敛成唯一答案。
每条必须能对照末端原因，写清改什么规则 / 接口 / 节奏 / 职责。不要写空话口号。

【上一步输出与本轮原因】
${handoff}

【变化焦点】
${focusText || "（未标注）"}

只返回 JSON：
{
  "ideas": [
    { "action": "S", "actionLabel": "替代 Substitute", "text": "一条具体想法" },
    { "action": "C", "actionLabel": "合并 Combine", "text": "一条具体想法" },
    { "action": "A", "actionLabel": "适应 Adapt", "text": "一条具体想法" },
    { "action": "M", "actionLabel": "改造 Modify", "text": "一条具体想法" },
    { "action": "P", "actionLabel": "转用 Put to other uses", "text": "一条具体想法" },
    { "action": "E", "actionLabel": "消除 Eliminate", "text": "一条具体想法" },
    { "action": "R", "actionLabel": "重组 Reverse", "text": "一条具体想法" }
  ]
}`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{ ideas?: unknown }>(text);
  return hydrateScamper(data.ideas, causes, focuses);
}

export async function suggestRemedyScores(
  settings: ModelSettings,
  handoff: string,
  options: { id: string; text: string; scamperLabel: string }[],
): Promise<{ id?: string; text?: string; impact?: number; feasibility?: number }[]> {
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `学员已选出这些候选对策。请为每项给出影响性、可行性的建议分（1—5 整数）。
影响性：对差距指标和已选末端原因的撬动程度。可行性：学员现在能推动、两周内可试的程度。不要只把“听起来最完整”的打高分。这是建议分，最终由学员改。

【上一步输出】
${handoff}

【候选对策】
${options.map((item) => `- ${item.id}｜${item.scamperLabel}｜${item.text}`).join("\n")}

只返回 JSON：
{ "scores": [ { "id": "原id", "text": "原对策", "impact": 4, "feasibility": 3 } ] }`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{
    scores?: { id?: string; text?: string; impact?: number; feasibility?: number }[];
  }>(text);
  return data.scores ?? [];
}
