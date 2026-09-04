import type { CaseRecord, ExperimentPlan } from "@/domain/case";
import { chosenRemedies } from "@/domain/remedy";
import { planWarnings } from "@/domain/plan";
import { useStore } from "@/app/store";

export function StepPlan({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const items = record.plan.items;
  const chosen = chosenRemedies(record.remedy.options);

  function patchItem(id: string, partial: Partial<ExperimentPlan>) {
    patchCase(record.id, (prev) => ({
      ...prev,
      plan: {
        ...prev.plan,
        items: prev.plan.items.map((item) => (item.id === id ? { ...item, ...partial } : item)),
      },
    }));
  }

  function patchCheckpoint(id: string, index: number, value: string) {
    patchCase(record.id, (prev) => ({
      ...prev,
      plan: {
        ...prev.plan,
        items: prev.plan.items.map((item) =>
          item.id === id
            ? { ...item, checkpoints: item.checkpoints.map((row, i) => (i === index ? value : row)) }
            : item,
        ),
      },
    }));
  }

  function addCheckpoint(id: string) {
    patchCase(record.id, (prev) => ({
      ...prev,
      plan: {
        ...prev.plan,
        items: prev.plan.items.map((item) => {
          if (item.id !== id) return item;
          const rows = item.checkpoints;
          if (rows.length > 0 && !rows[rows.length - 1].trim()) return item;
          return { ...item, checkpoints: [...rows, ""] };
        }),
      },
    }));
  }

  function removeCheckpoint(id: string, index: number) {
    patchCase(record.id, (prev) => ({
      ...prev,
      plan: {
        ...prev.plan,
        items: prev.plan.items.map((item) =>
          item.id === id ? { ...item, checkpoints: item.checkpoints.filter((_, i) => i !== index) } : item,
        ),
      },
    }));
  }

  if (items.length === 0) {
    return (
      <div className="form-grid">
        <p className="notice">
          还没有实施计划。请回到第五步勾选要推进的对策，再点「贯彻实施」生成可填写的计划。
        </p>
      </div>
    );
  }

  return (
    <div className="form-grid">
      <p className="coming">
        把已拍板的对策改成两周内可停止的最小实验。AI 只给骨架，由你补全 5W2H、假设和成功 / 停止标准。失败必须能退回原做法。
      </p>
      {chosen.length > 0 ? (
        <p className="hint">本步承接 {chosen.length} 条要推进的对策，生成 {items.length} 张计划卡。</p>
      ) : null}
      {(record.plan.history ?? []).length > 0 ? (
        <p className="hint">另有 {record.plan.history.length} 张此前对策的计划已保留。</p>
      ) : null}
      {record.plan.error ? <p className="notice">{record.plan.error}</p> : null}

      <section className="field">
        <span>上一步输出（要推进的对策）</span>
        <p className="handoff">{record.plan.sourceSnapshot || "尚未从「制定对策」带入。"}</p>
      </section>

      {items.map((item, index) => {
        const warnings = planWarnings(item);
        return (
          <article key={item.id} className="focus-card">
            <h3>
              {index + 1}. {item.scamperLabel || "对策"}
            </h3>
            <p className="hint">{item.remedyText}</p>

            <p className="meta" style={{ marginTop: 10 }}>
              5W2H 行动计划
            </p>
            <div className="form-grid two" style={{ marginTop: 8 }}>
              <Field label="谁 Who" value={item.who} placeholder="哪个角色做，不要虚构人名" onChange={(value) => patchItem(item.id, { who: value })} />
              <Field label="做什么 What" value={item.what} placeholder="可观察的动作或规则变化" onChange={(value) => patchItem(item.id, { what: value })} />
              <Field label="何时 When" value={item.when} placeholder="何时开始、何时看到信号" onChange={(value) => patchItem(item.id, { when: value })} />
              <Field label="何地 Where" value={item.where} placeholder="环节 / 场所 / 系统" onChange={(value) => patchItem(item.id, { where: value })} />
              <Field label="为何 Why" value={item.why} placeholder="撬动哪段已选末端原因" onChange={(value) => patchItem(item.id, { why: value })} />
              <Field label="费用 How much" value={item.cost} placeholder="投入或费用，未知就写未知" onChange={(value) => patchItem(item.id, { cost: value })} />
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              如何 How
              <textarea
                value={item.how}
                onChange={(event) => patchItem(item.id, { how: event.target.value })}
                placeholder="写成可观察的步骤，失败可退回"
              />
            </label>

            <p className="meta" style={{ marginTop: 14 }}>
              最小实验卡
            </p>
            <label className="field" style={{ marginTop: 8 }}>
              核心假设（如果做 X，Y 如何变）
              <textarea
                value={item.hypothesis}
                onChange={(event) => patchItem(item.id, { hypothesis: event.target.value })}
                placeholder="如果……那么……对照的指标是……"
              />
            </label>
            <div className="form-grid two" style={{ marginTop: 8 }}>
              <Field label="实验对象" value={item.object} placeholder="先在谁 / 哪一批上试" onChange={(value) => patchItem(item.id, { object: value })} />
              <Field label="范围" value={item.scope} placeholder="小范围，失败可退回" onChange={(value) => patchItem(item.id, { scope: value })} />
              <Field label="周期" value={item.period} placeholder="默认 14 天内出信号" onChange={(value) => patchItem(item.id, { period: value })} />
              <Field label="基线" value={item.baseline} placeholder="对照现状" onChange={(value) => patchItem(item.id, { baseline: value })} />
              <Field label="领先指标" value={item.leadIndicator} placeholder="过程中先看到的信号" onChange={(value) => patchItem(item.id, { leadIndicator: value })} />
              <Field label="结果指标" value={item.resultIndicator} placeholder="最终用来验收" onChange={(value) => patchItem(item.id, { resultIndicator: value })} />
              <Field label="护栏指标" value={item.guardIndicator} placeholder="不能为了达标而牺牲的底线" onChange={(value) => patchItem(item.id, { guardIndicator: value })} />
              <Field label="责任人" value={item.owner} placeholder="谁推动、谁记录" onChange={(value) => patchItem(item.id, { owner: value })} />
              <Field label="成功标准" value={item.success} placeholder="怎样算这轮实验成立" onChange={(value) => patchItem(item.id, { success: value })} />
              <Field label="停止标准" value={item.stop} placeholder="怎样算该停、如何退回" onChange={(value) => patchItem(item.id, { stop: value })} />
              <Field label="扩大标准" value={item.expand} placeholder="怎样才扩大范围" onChange={(value) => patchItem(item.id, { expand: value })} />
              <Field label="记录方式" value={item.record} placeholder="记在哪、谁记、记什么" onChange={(value) => patchItem(item.id, { record: value })} />
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              可能污染结果的变量
              <textarea
                value={item.confounders}
                onChange={(event) => patchItem(item.id, { confounders: event.target.value })}
                placeholder="同期还有哪些变化可能干扰判断"
              />
            </label>

            <p className="meta" style={{ marginTop: 14 }}>
              检查点、汇报与升级
            </p>
            <p className="hint">轻量检查点，不做重型项目计划。可改、可增删。</p>
            {item.checkpoints.map((row, rowIndex) => (
              <div key={`${item.id}-cp-${rowIndex}`} className="need-row">
                <span className="need-index">{rowIndex + 1}</span>
                <input
                  value={row}
                  placeholder="何时看什么信号"
                  onChange={(event) => patchCheckpoint(item.id, rowIndex, event.target.value)}
                />
                <button className="btn-danger" type="button" onClick={() => removeCheckpoint(item.id, rowIndex)}>
                  删
                </button>
              </div>
            ))}
            <button className="btn" type="button" onClick={() => addCheckpoint(item.id)}>
              增加一条检查点
            </button>
            <div className="form-grid two" style={{ marginTop: 8 }}>
              <Field label="汇报节奏" value={item.report} placeholder="多久对照一次基线" onChange={(value) => patchItem(item.id, { report: value })} />
              <Field label="障碍升级" value={item.escalate} placeholder="卡住时升级给谁、何时升级" onChange={(value) => patchItem(item.id, { escalate: value })} />
            </div>

            {warnings.length > 0 ? (
              <ul className="hint" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="hint">这张计划已具备 5W2H、假设和成功 / 停止标准，可再检查是否两周内能出信号。</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
