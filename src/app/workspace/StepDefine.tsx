import type { CaseRecord, GapStatement } from "@/domain/case";
import { composeGapStatement } from "@/domain/case";
import { useStore } from "@/app/store";
import { AttachmentField } from "@/app/workspace/AttachmentField";

export function StepDefine({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const d = record.define;
  const composed = composeGapStatement(d.gap);

  function patch(partial: Partial<typeof d>) {
    patchCase(record.id, (prev) => ({
      ...prev,
      define: { ...prev.define, ...partial },
    }));
  }

  function patchGap(partial: Partial<GapStatement>) {
    patchCase(record.id, (prev) => {
      const gap = { ...prev.define.gap, ...partial };
      const statement = composeGapStatement(gap);
      return {
        ...prev,
        define: {
          ...prev.define,
          gap,
          statement,
          currentValue: gap.fromA,
          expectedValue: gap.toB,
        },
      };
    });
  }

  return (
    <div className="form-grid">
      <p className="coming">
        先用附件和差距陈述把问题写清楚。不要急着解释原因。进入下一步前完成本步人工判断。
      </p>

      <AttachmentField
        files={d.attachments}
        onChange={(attachments) => patch({ attachments })}
      />

      <div className="form-grid two">
        <label className="field">
          场景 / 任务
          <textarea
            value={d.scene}
            onChange={(event) => patch({ scene: event.target.value })}
            placeholder="发生在哪里、涉及谁"
          />
        </label>
        <label className="field">
          问题类型
          <select value={d.kind} onChange={(event) => patch({ kind: event.target.value as typeof d.kind })}>
            <option value="">未选择</option>
            <option value="restore">恢复原状</option>
            <option value="prevent">防范潜在</option>
            <option value="ideal">追求理想</option>
          </select>
        </label>
      </div>

      <section className="field">
        <span>差距陈述</span>
        <p className="hint">谁 / 何时 / 何处，什么指标从 A 变成 B，造成何种影响。先填格子，下面会合成一句。</p>
        <div className="form-grid two" style={{ marginTop: 8 }}>
          <label className="field">
            谁
            <input
              value={d.gap.who}
              onChange={(event) => patchGap({ who: event.target.value })}
              placeholder="对象或责任范围"
            />
          </label>
          <label className="field">
            何时 / 何处
            <input
              value={d.gap.whenWhere}
              onChange={(event) => patchGap({ whenWhere: event.target.value })}
              placeholder="时间范围与地点"
            />
          </label>
          <label className="field">
            什么指标
            <input
              value={d.gap.metric}
              onChange={(event) => patchGap({ metric: event.target.value })}
              placeholder="可观察的指标名称"
            />
          </label>
          <label className="field">
            现状 A
            <input
              value={d.gap.fromA}
              onChange={(event) => patchGap({ fromA: event.target.value })}
              placeholder="当前可验证的值"
            />
          </label>
          <label className="field">
            期望 / 基准 B
            <input
              value={d.gap.toB}
              onChange={(event) => patchGap({ toB: event.target.value })}
              placeholder="目标或原来应有的值"
            />
          </label>
          <label className="field">
            造成何种影响
            <input
              value={d.gap.impact}
              onChange={(event) => patchGap({ impact: event.target.value })}
              placeholder="对谁、什么后果"
            />
          </label>
        </div>
        <label className="field" style={{ marginTop: 8 }}>
          合成句（可改）
          <textarea
            value={d.statement || composed}
            onChange={(event) => patch({ statement: event.target.value })}
            placeholder="谁在何时/何处，什么指标从 A 变成 B，造成何种影响。"
          />
        </label>
      </section>

      <label className="field">
        核心词定义
        <textarea
          value={d.keywords}
          onChange={(event) => patch({ keywords: event.target.value })}
          placeholder="关键名词是什么意思；若是数据，写出口径或公式"
        />
      </label>
      <div className="form-grid two">
        <label className="field">
          问题边界
          <textarea
            value={d.boundary}
            onChange={(event) => patch({ boundary: event.target.value })}
            placeholder="这次分析覆盖什么"
          />
        </label>
        <label className="field">
          暂不讨论
          <textarea
            value={d.outOfScope}
            onChange={(event) => patch({ outOfScope: event.target.value })}
            placeholder="明确先不处理什么"
          />
        </label>
      </div>
    </div>
  );
}
