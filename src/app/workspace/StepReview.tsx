import type { CaseRecord, ReviewDraft, ReviewItem } from "@/domain/case";
import { DEVIATIONS, OUTCOMES, reviewWarnings } from "@/domain/review";
import { useStore } from "@/app/store";

export function StepReview({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const draft = record.review;

  function patchDraft(partial: Partial<ReviewDraft>) {
    patchCase(record.id, (prev) => ({ ...prev, review: { ...prev.review, ...partial } }));
  }

  function patchItem(id: string, partial: Partial<ReviewItem>) {
    patchCase(record.id, (prev) => ({
      ...prev,
      review: {
        ...prev.review,
        items: prev.review.items.map((item) => (item.id === id ? { ...item, ...partial } : item)),
      },
    }));
  }

  if (draft.items.length === 0) {
    return (
      <div className="form-grid">
        <p className="notice">还没有对照卡。请回到第六步写好实施计划，再点下一步生成空白评价表。</p>
      </div>
    );
  }

  return (
    <div className="form-grid">
      <p className="coming">
        对照目标看实际结果。由你填写，AI 不代写结论。先写可观察的事实，再判断是达成、超过还是未达成，并区分结果偏差与执行偏差。
      </p>
      {draft.items.map((item, index) => {
        const warnings = reviewWarnings(item);
        return (
          <article key={item.id} className="focus-card">
            <h3>
              {index + 1}. {item.planLabel}
            </h3>
            {item.goalLabel ? <p className="hint">对应目标：{item.goalLabel}</p> : null}
            <div className="form-grid two" style={{ marginTop: 8 }}>
              <label className="field">
                原定目标 / 成功标准
                <input
                  value={item.target}
                  onChange={(event) => patchItem(item.id, { target: event.target.value })}
                  placeholder="实验卡上的成功标准或目标程度"
                />
              </label>
              <label className="field">
                实际结果
                <input
                  value={item.actual}
                  onChange={(event) => patchItem(item.id, { actual: event.target.value })}
                  placeholder="可观察的事实或指标，不要只写“还行”"
                />
              </label>
            </div>
            <p className="meta" style={{ marginTop: 10 }}>
              达成情况
            </p>
            <div className="verdict-row" style={{ marginTop: 8 }}>
              {OUTCOMES.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={item.outcome === row.id ? "verdict on hold" : "verdict"}
                  onClick={() => patchItem(item.id, { outcome: row.id })}
                >
                  <strong>{row.label}</strong>
                </button>
              ))}
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              偏差说明
              <textarea
                value={item.gap}
                onChange={(event) => patchItem(item.id, { gap: event.target.value })}
                placeholder="和目标差在哪里，用事实写"
              />
            </label>
            <div className="form-grid two" style={{ marginTop: 8 }}>
              <label className="field">
                新出现的现象
                <input
                  value={item.appeared}
                  onChange={(event) => patchItem(item.id, { appeared: event.target.value })}
                  placeholder="没有也可以写无"
                />
              </label>
              <label className="field">
                消失的现象
                <input
                  value={item.disappeared}
                  onChange={(event) => patchItem(item.id, { disappeared: event.target.value })}
                  placeholder="没有也可以写无"
                />
              </label>
            </div>
            <p className="meta" style={{ marginTop: 10 }}>
              偏差类型
            </p>
            <div className="verdict-row" style={{ marginTop: 8 }}>
              {DEVIATIONS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={item.deviation === row.id ? "verdict on" : "verdict"}
                  onClick={() => patchItem(item.id, { deviation: row.id })}
                >
                  <strong>{row.label}</strong>
                  <span>{row.hint}</span>
                </button>
              ))}
            </div>
            <label className="field" style={{ marginTop: 8 }}>
              为何这样判（可改）
              <textarea
                value={item.deviationReason}
                onChange={(event) => patchItem(item.id, { deviationReason: event.target.value })}
                placeholder="依据哪些记录区分执行问题还是假设问题"
              />
            </label>
            {warnings.length > 0 ? (
              <ul className="hint" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}

      <section className="field">
        <span>过程评价</span>
        <p className="hint">哪些步骤被跳过或补做，闸门依据是否事后补写。这也由你自己填。</p>
        <label className="field" style={{ marginTop: 8 }}>
          跳过或补做的步骤
          <textarea
            value={draft.skippedSteps}
            onChange={(event) => patchDraft({ skippedSteps: event.target.value })}
            placeholder="例如：第二步矩阵是补打的；第五步没做红队"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          闸门记录
          <textarea
            value={draft.gateNotes}
            onChange={(event) => patchDraft({ gateNotes: event.target.value })}
            placeholder="三道判断是当时写的，还是后来补的"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          过程备注
          <textarea
            value={draft.processNote}
            onChange={(event) => patchDraft({ processNote: event.target.value })}
            placeholder="执行中还发生了什么，可能影响对结果的解释"
          />
        </label>
      </section>
    </div>
  );
}
