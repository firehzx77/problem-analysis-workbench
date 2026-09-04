import type { CaseRecord, GoalItem } from "@/domain/case";
import { composeGoalStatement, goalWarnings } from "@/domain/goal";
import { useStore } from "@/app/store";

export function StepGoal({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const items = record.goal.items;
  const chosen = record.analyze.focuses.filter((item) => item.chosen);

  function patchItem(id: string, partial: Partial<GoalItem>, refreshStatement = false) {
    patchCase(record.id, (prev) => ({
      ...prev,
      goal: {
        ...prev.goal,
        items: prev.goal.items.map((item) => {
          if (item.id !== id) return item;
          const next = { ...item, ...partial };
          if (refreshStatement) next.statement = composeGoalStatement(next);
          return next;
        }),
      },
    }));
  }

  if (items.length === 0) {
    return (
      <div className="form-grid">
        <p className="notice">还没有带入关键问题。请回到第二步，勾选要具体研究的问题后再进入本步。</p>
      </div>
    );
  }

  return (
    <div className="form-grid">
      <p className="coming">
        针对上一步勾选的关键问题，把目标写成「到什么时候、解决到什么程度」。不要把行动或手段写成目标。追问完可回第二步改选其他问题，已完成的目标会保留。
      </p>
      {chosen.length > 0 ? (
        <p className="hint">本步承接 {chosen.length} 条关键问题。指标可沿用差距陈述，也可按该问题改口径。</p>
      ) : null}
      {(record.goal.history ?? []).length > 0 ? (
        <p className="hint">
          另有 {record.goal.history.length} 条已研究问题的目标已保留。对应末端原因在第四步原因池中。
        </p>
      ) : null}
      {items.map((item, index) => {
        const warnings = goalWarnings(item);
        return (
          <article key={item.id} className="focus-card">
            <h3>
              {index + 1}. {item.problemLabel}
            </h3>
            <div className="form-grid two" style={{ marginTop: 8 }}>
              <label className="field">
                指标
                <input
                  value={item.metric}
                  onChange={(event) => patchItem(item.id, { metric: event.target.value }, true)}
                  placeholder="最好对照差距陈述的同一口径"
                />
              </label>
              <label className="field">
                期限（到什么时候）
                <input
                  value={item.deadline}
                  onChange={(event) => patchItem(item.id, { deadline: event.target.value }, true)}
                  placeholder="例如：四周内 / 10月15日前"
                />
              </label>
              <label className="field">
                现状 / 基线
                <input
                  value={item.baseline}
                  onChange={(event) => patchItem(item.id, { baseline: event.target.value }, true)}
                  placeholder="当前可验证的值"
                />
              </label>
              <label className="field">
                目标程度
                <input
                  value={item.target}
                  onChange={(event) => patchItem(item.id, { target: event.target.value }, true)}
                  placeholder="解决到什么程度，不要写行动"
                />
              </label>
              <label className="field">
                领先指标（可选）
                <input
                  value={item.leadIndicator}
                  onChange={(event) => patchItem(item.id, { leadIndicator: event.target.value })}
                  placeholder="过程中能先看到的信号"
                />
              </label>
              <label className="field">
                结果指标（可选）
                <input
                  value={item.resultIndicator}
                  onChange={(event) => patchItem(item.id, { resultIndicator: event.target.value })}
                  placeholder="最终用来验收的结果"
                />
              </label>
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              护栏指标（可选）
              <input
                value={item.guardIndicator}
                onChange={(event) => patchItem(item.id, { guardIndicator: event.target.value })}
                placeholder="不能为了达标而牺牲的底线"
              />
            </label>
            <label className="field" style={{ marginTop: 8 }}>
              目标陈述（可改）
              <textarea
                value={item.statement}
                onChange={(event) => patchItem(item.id, { statement: event.target.value })}
                placeholder="针对该问题，指标从现状到目标程度，期限……"
              />
            </label>
            {warnings.length > 0 ? (
              <ul className="hint" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="hint">这项目标已具备期限和程度，可再检查是否能量化、可验证。</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
