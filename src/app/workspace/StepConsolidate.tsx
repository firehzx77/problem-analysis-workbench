import type { CaseRecord, ConsolidateDraft } from "@/domain/case";
import { consolidateWarnings } from "@/domain/review";
import { useStore } from "@/app/store";

export function StepConsolidate({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const draft = record.consolidate;
  const warnings = consolidateWarnings(draft);

  function patch(partial: Partial<ConsolidateDraft>) {
    patchCase(record.id, (prev) => ({ ...prev, consolidate: { ...prev.consolidate, ...partial } }));
  }

  return (
    <div className="form-grid">
      <p className="coming">
        决定什么留下、什么继续试、什么不能照搬。由你填写，不要写成总结腔。对照「原始问题—原因假设—方案假设—实际行动—实际结果」。
      </p>

      <article className="focus-card">
        <h3>固化三件套</h3>
        <p className="hint">标准化、横向展开、下一步改善。没有就写「无」或「暂不进入」。 </p>
        <label className="field" style={{ marginTop: 8 }}>
          进入 SOP / 标准作业
          <textarea
            value={draft.sop}
            onChange={(event) => patch({ sop: event.target.value })}
            placeholder="哪条规则或步骤可以写成标准，谁维护"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          进入检查表
          <textarea
            value={draft.checklist}
            onChange={(event) => patch({ checklist: event.target.value })}
            placeholder="以后每次都要核对的几项"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          进入案例库
          <textarea
            value={draft.caseLibrary}
            onChange={(event) => patch({ caseLibrary: event.target.value })}
            placeholder="这份课题里什么值得留给后人，前提条件是什么"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          还要继续实验
          <textarea
            value={draft.keepExperiment}
            onChange={(event) => patch({ keepExperiment: event.target.value })}
            placeholder="哪条假设还没被验证，下一轮最小实验是什么"
          />
        </label>
      </article>

      <article className="focus-card">
        <h3>横向推广与下一轮</h3>
        <label className="field">
          横向推广边界（什么情况不能照搬）
          <textarea
            value={draft.spreadBoundary}
            onChange={(event) => patch({ spreadBoundary: event.target.value })}
            placeholder="适用对象、流程、规模；超出这些边界不要直接复制"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          下一轮改善点
          <textarea
            value={draft.nextImprove}
            onChange={(event) => patch({ nextImprove: event.target.value })}
            placeholder="下一件要处理的可观察问题"
          />
        </label>
      </article>

      <article className="focus-card">
        <h3>假设对照</h3>
        <p className="hint">被证实、被推翻、仍未知都要写。只写“做得不错”不算复盘。</p>
        <label className="field" style={{ marginTop: 8 }}>
          被证实的假设
          <textarea
            value={draft.confirmed}
            onChange={(event) => patch({ confirmed: event.target.value })}
            placeholder="哪条原因或对策假设被证据支持"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          被推翻的假设
          <textarea
            value={draft.rejected}
            onChange={(event) => patch({ rejected: event.target.value })}
            placeholder="原来以为成立、现在看来不成立的"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          仍未知
          <textarea
            value={draft.unknown}
            onChange={(event) => patch({ unknown: event.target.value })}
            placeholder="还缺哪类证据，不能假装已经知道"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          关键事件（避免事后合理化）
          <textarea
            value={draft.keyEvents}
            onChange={(event) => patch({ keyEvents: event.target.value })}
            placeholder="实施中实际发生、可能改变判断的事件"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          可迁移经验
          <textarea
            value={draft.lessons}
            onChange={(event) => patch({ lessons: event.target.value })}
            placeholder="规律是什么，边界是什么"
          />
        </label>
      </article>

      <article className="focus-card">
        <h3>三个反思问题（自己答）</h3>
        <label className="field">
          反思 1
          <textarea
            value={draft.reflect1}
            onChange={(event) => patch({ reflect1: event.target.value })}
            placeholder="如果重来，哪一步不该跳"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          反思 2
          <textarea
            value={draft.reflect2}
            onChange={(event) => patch({ reflect2: event.target.value })}
            placeholder="哪条证据其实不够，却被当成了结论"
          />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          反思 3
          <textarea
            value={draft.reflect3}
            onChange={(event) => patch({ reflect3: event.target.value })}
            placeholder="下一次最小实验会改哪一个变量"
          />
        </label>
      </article>

      {warnings.length > 0 ? (
        <ul className="hint" style={{ margin: 0, paddingLeft: 18 }}>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p className="hint">固化、边界和假设对照都有内容了。可随时导出 Word 或 PPT。</p>
      )}
    </div>
  );
}
