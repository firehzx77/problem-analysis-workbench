import { chatComplete } from "@/ai/chat";
import { parseModelJson } from "@/ai/json";
import type { ExperimentPlan, RemedyOption } from "@/domain/case";
import { hydratePlan } from "@/domain/plan";
import type { ModelSettings } from "@/domain/settings";

const BASE = `你是“行动实验设计师”。把学员已拍板的对策改成两周内可停止的最小实验计划，供学员填写和修改。
不编造数据。证据不足就写“未知”或留待学员填。不要规划无法停止的大项目，不要替学员指定无法改的责任人姓名。
禁止把行动写成：加强意识、提高责任心、加强沟通、加强培训、加强管理。
每张计划必须落到可观察的规则、接口、节奏或交付物。失败必须可退回原做法。`;

export async function generateExperimentPlans(
  settings: ModelSettings,
  handoff: string,
  remedies: RemedyOption[],
  extras?: { baseline?: string; metric?: string },
): Promise<ExperimentPlan[]> {
  const text = await chatComplete(
    settings,
    [
      { role: "system", content: BASE },
      {
        role: "user",
        content: `请为下面每条要推进的对策各生成 1 张可填写的实施计划骨架。字段都要具体、可改，不要写成口号。周期默认 14 天内出信号。责任人写成角色而不是虚构人名。费用未知就写“未知”。

【上一步输出】
${handoff}

只返回 JSON：
{
  "plans": [
    {
      "id": "对策原id",
      "who": "由哪个角色做",
      "what": "具体做什么",
      "when": "何时开始、何时看到信号",
      "where": "在哪个环节 / 场所 / 系统",
      "why": "为了撬动哪段机制",
      "how": "怎么做，步骤可观察",
      "cost": "费用或投入，未知就写未知",
      "hypothesis": "如果做 X，Y 如何变",
      "object": "实验对象",
      "scope": "范围，失败可退回",
      "period": "14 天内出信号",
      "baseline": "对照基线",
      "leadIndicator": "过程信号",
      "resultIndicator": "结果指标",
      "guardIndicator": "不能牺牲的底线",
      "success": "成功标准",
      "stop": "停止标准",
      "expand": "扩大标准",
      "owner": "推动与记录的角色",
      "record": "记录方式",
      "confounders": "可能污染结果的变量",
      "checkpoints": ["第 3 天：……", "第 7 天：……", "第 14 天：……"],
      "report": "汇报节奏",
      "escalate": "障碍升级给谁、何时升级"
    }
  ]
}
对策列表：
${remedies.map((item) => `- ${item.id}｜${item.scamperLabel}｜${item.text}`).join("\n")}`,
      },
    ],
    { json: true },
  );
  const data = parseModelJson<{
    plans?: (Partial<ExperimentPlan> & { id?: string })[];
  }>(text);
  const rows = data.plans ?? [];
  return remedies.map((remedy, index) => {
    const hit =
      rows.find((row) => row.id === remedy.id) ??
      (rows.length === remedies.length ? rows[index] : undefined);
    return hydratePlan(hit, remedy, extras);
  });
}
