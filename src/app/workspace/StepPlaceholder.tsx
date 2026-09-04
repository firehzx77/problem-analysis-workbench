import { STEPS, type StepId } from "@/domain/case";

export function StepPlaceholder({ step }: { step: StepId }) {
  const meta = STEPS.find((item) => item.id === step);
  const copy: Record<StepId, string> = {
    1: "",
    2: "承接上一步差距陈述，由系统分析师拆问题树。完成本步人工判断后才能设定目标。",
    3: "把目标写成到什么时候、解决到什么程度。不要把行动或手段写成目标。",
    4: "对关键分支做带证据的 5WHY。禁止停在“意识不足 / 沟通不到位”。",
    5: "用 5W × SCAMPER 发散，再用红队攻击。完成本步人工判断后才能做实验。",
    6: "把方案改成两周内可停止的最小实验，写清成功 / 停止 / 扩大标准。",
    7: "对照目标看结果，区分执行偏差和假设偏差。",
    8: "决定什么进入标准，什么继续实验，并写下可迁移的边界。",
  };

  return (
    <div className="empty">
      <h3>
        第 {step} 步 · {meta?.name}
      </h3>
      <p>{copy[step]}</p>
      <p className="hint">本步表单与对应 AI 角色将按切片陆续接入。结构位已留好，不会丢当前课题。</p>
    </div>
  );
}
