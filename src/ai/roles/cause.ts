import { chatComplete } from "@/ai/chat";
import { parseModelJson } from "@/ai/json";
import { fallbackWhyChildren, hydrateHypotheses, mergeCauseClusters, MAX_WHY_DEPTH } from "@/domain/cause";
import type { CauseCluster, CauseHypothesis, GoalItem } from "@/domain/case";
import type { ModelSettings } from "@/domain/settings";

const BASE = `你是“原因探索助手”。只基于学员已确认的关键问题与目标，提出竞争性原因假设，不宣布唯一真因，不编造数据。
事实 / 解释 / 假设必须分开。证据不足就写“未知”。
禁止把原因写成：意识不足、责任心不强、沟通不到位、管理要加强、缺乏培训、新员工、态度问题。
每条原因必须是可观察、可验证、团队有权改变的流程或机制。不要把相关当成因果。不要替学员做最终判断。`;

export async function generateCauseHypotheses(
  settings: ModelSettings,
  handoff: string,
  goals: GoalItem[],
): Promise<CauseCluster[]> {
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `请为下面每个关键问题各提出 3—5 条互相竞争的原因假设，帮助学员做判断。置信度用 1—5，表示“目前有多值得优先验证”，不是宣布真相。

【上一步输出】
${handoff}

只返回 JSON：
{
  "clusters": [
    {
      "goalId": "原目标id",
      "problemLabel": "关键问题原名",
      "hypotheses": [
        {
          "text": "一句可观察的机制原因",
          "mechanism": "具体发生在哪个流程环节 / 规则 / 接口",
          "confidence": 3,
          "support": "已知支持点，没有就写未知",
          "counter": "若成立，不该看到什么",
          "missing": "还缺哪类可核对数据",
          "verify": "最低成本的验证动作"
        }
      ]
    }
  ]
}
目标列表：
${goals.map((item) => `- ${item.id}｜${item.problemLabel}`).join("\n")}`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{
    clusters?: { goalId?: string; problemLabel?: string; hypotheses?: unknown }[];
  }>(text);
  const generated: CauseCluster[] = (data.clusters ?? []).map((row) => ({
    goalId: String(row.goalId ?? ""),
    problemLabel: String(row.problemLabel ?? ""),
    goalStatement: "",
    hypotheses: hydrateHypotheses(row.hypotheses),
  }));
  return mergeCauseClusters(goals, generated);
}

export async function generateWhyLayer(
  settings: ModelSettings,
  handoff: string,
  input: {
    problemLabel: string;
    goalStatement: string;
    parent: CauseHypothesis;
    chain: CauseHypothesis[];
  },
): Promise<CauseHypothesis[]> {
  const depth = Math.min((input.parent.depth ?? 0) + 1, MAX_WHY_DEPTH);
  const chainText = input.chain
    .map((item, index) => {
      const tag = index === 0 ? "WHY1" : `WHY${index + 1}`;
      return `${tag}：${item.text}
  环节：${item.mechanism || "（未填）"}
  学员判断：值得追。依据：${item.verdictReason || "（未写）"}`;
    })
    .join("\n");
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `学员已把上一层标成「值得追」。请做 5WHY 的下一层：只回答“为什么会出现上一层这个机制”，给出 2—4 条互相竞争的下层假设。
不要一次跳到最终根因，不要宣布唯一真相，不要编造数据。置信度 1—5 表示“多值得优先验证”。

【关键问题】${input.problemLabel}
【目标】${input.goalStatement || "（未填）"}

【课题背景】
${handoff}

【已确认值得追的链路】
${chainText}

只返回 JSON：
{
  "whyQuestion": "针对上一层的为什么追问，写成一句问句",
  "hypotheses": [
    {
      "text": "一句可观察的更底层机制",
      "mechanism": "发生在哪个规则 / 交接 / 接口",
      "confidence": 3,
      "support": "已知支持点，没有就写未知",
      "counter": "若成立，不该看到什么",
      "missing": "还缺哪类可核对数据",
      "verify": "最低成本的验证动作"
    }
  ]
}`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{ whyQuestion?: string; hypotheses?: unknown }>(text);
  const whyQuestion =
    String(data.whyQuestion ?? "").trim() || `为什么会出现「${input.parent.text.trim() || "上一层机制"}」？`;
  const hypotheses = hydrateHypotheses(data.hypotheses, depth, whyQuestion);
  return hypotheses.length ? hypotheses : fallbackWhyChildren(input.parent);
}
