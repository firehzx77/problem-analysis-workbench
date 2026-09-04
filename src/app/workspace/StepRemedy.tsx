import { useEffect, useRef } from "react";
import type { CaseRecord, FiveWPrompt, RemedyOption, RemedyPhase, ScamperIdea } from "@/domain/case";
import { groupPoolByProblem, keptTerminals } from "@/domain/cause";
import {
  REMEDY_PHASES,
  handoffFromCauses,
  newManualIdea,
  remedyQuadrant,
  remedyScoreOf,
  seedSelectedCauseIds,
} from "@/domain/remedy";
import { useStore } from "@/app/store";

export function StepRemedy({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const remedy = record.remedy;
  const order: RemedyPhase[] = ["causes", "fiveW", "scamper", "matrix"];
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    patchCase(record.id, (prev) => {
      const ids = seedSelectedCauseIds(prev);
      const needsIds = prev.remedy.selectedCauseIds.length === 0 && ids.length > 0;
      const needsHandoff = !prev.remedy.sourceSnapshot.trim();
      if (!needsIds && !needsHandoff) return prev;
      const selectedCauseIds = needsIds ? ids : prev.remedy.selectedCauseIds;
      const causes = keptTerminals(prev.cause).filter((item) => selectedCauseIds.includes(item.id));
      return {
        ...prev,
        remedy: {
          ...prev.remedy,
          selectedCauseIds,
          sourceSnapshot: needsHandoff ? handoffFromCauses(prev, causes) : prev.remedy.sourceSnapshot,
        },
      };
    });
  }, [record.id, patchCase]);

  function goPhase(id: RemedyPhase) {
    if (order.indexOf(id) >= order.indexOf(remedy.phase)) return;
    if (id === "fiveW" && remedy.fiveW.length === 0) return;
    if (id === "scamper" && remedy.scamper.length === 0) return;
    if (id === "matrix" && remedy.options.length === 0) return;
    patchCase(record.id, (prev) => ({
      ...prev,
      remedy: { ...prev.remedy, phase: id },
    }));
  }

  return (
    <div className="form-grid">
      <section className="field">
        <span>上一步输出（末端原因池）</span>
        <p className="handoff">
          {remedy.sourceSnapshot || "尚未从「把握真因」带入。请回到第四步勾选末端原因后点下一步。"}
        </p>
      </section>

      <div className="phase-tabs">
        {REMEDY_PHASES.map((item) => {
          const earlier = order.indexOf(item.id) < order.indexOf(remedy.phase);
          return (
            <button
              key={item.id}
              type="button"
              className={item.id === remedy.phase ? "phase on" : earlier ? "phase done" : "phase"}
              onClick={() => goPhase(item.id)}
              disabled={!earlier && item.id !== remedy.phase}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {remedy.phase === "causes" ? <CausesPhase record={record} /> : null}
      {remedy.phase === "fiveW" ? <FiveWPhase record={record} /> : null}
      {remedy.phase === "scamper" ? <ScamperPhase record={record} /> : null}
      {remedy.phase === "matrix" ? <MatrixPhase record={record} /> : null}
      {remedy.error ? <p className="notice">{remedy.error}</p> : null}
    </div>
  );
}

function CausesPhase({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const kept = keptTerminals(record.cause);
  const selected = new Set(record.remedy.selectedCauseIds);
  const groups = groupPoolByProblem(kept);

  function toggle(id: string, checked: boolean) {
    patchCase(record.id, (prev) => {
      const current = prev.remedy.selectedCauseIds.length
        ? prev.remedy.selectedCauseIds
        : keptTerminals(prev.cause).map((item) => item.id);
      const next = checked ? [...new Set([...current, id])] : current.filter((item) => item !== id);
      return { ...prev, remedy: { ...prev.remedy, selectedCauseIds: next } };
    });
  }

  return (
    <section className="field">
      <span>选择本轮要做对策的末端原因</span>
      <p className="hint">
        第四步收入并勾选「纳入后续对策」的条目都在这里。可多选；下一步会按你勾选的原因生成 5W 提问。当前已选{" "}
        {record.remedy.selectedCauseIds.length} 条。
      </p>
      {kept.length === 0 ? (
        <p className="notice">没有可带入的末端原因。请回到第四步勾选「选入末端原因池」并纳入后续对策。</p>
      ) : (
        groups.map((group) => (
          <section key={group.problemId} className="cause-cluster">
            <h3>来自问题 · {group.problemLabel}</h3>
            {group.items.map((item) => (
              <article key={item.id} className={selected.has(item.id) ? "focus-card chosen" : "focus-card"}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={(event) => toggle(item.id, event.target.checked)}
                  />
                  <span>本轮针对这条原因制定对策</span>
                </label>
                <h3>{item.text}</h3>
                <p className="meta">
                  {item.kind === "unknown" ? "待取证" : "候选机制"}
                  {item.mechanism ? ` · ${item.mechanism}` : ""}
                </p>
                <p className="hint">追问链：{item.chain.filter(Boolean).join(" → ") || "（直接入池）"}</p>
                {item.verdictReason ? <p className="hint">依据：{item.verdictReason}</p> : null}
              </article>
            ))}
          </section>
        ))
      )}
    </section>
  );
}

function FiveWPhase({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const prompts = record.remedy.fiveW;
  const picked = prompts.filter((item) => item.selected).length;

  function patchPrompt(id: string, partial: Partial<FiveWPrompt>) {
    patchCase(record.id, (prev) => ({
      ...prev,
      remedy: {
        ...prev.remedy,
        fiveW: prev.remedy.fiveW.map((item) => (item.id === id ? { ...item, ...partial } : item)),
      },
    }));
  }

  return (
    <section className="field">
      <span>5W 提问 · 选择变化焦点</span>
      <p className="hint">
        AI 只提问、不给对策。勾选你认为最值得改的焦点（可多选）。可改问题表述。当前已选 {picked} 个。
      </p>
      {prompts.map((item) => (
        <article key={item.id} className={item.selected ? "focus-card chosen" : "focus-card"}>
          <label className="check">
            <input
              type="checkbox"
              checked={item.selected}
              onChange={(event) => patchPrompt(item.id, { selected: event.target.checked })}
            />
            <span>作为本轮变化焦点</span>
          </label>
          <p className="meta">{item.label}</p>
          <label className="field">
            提问（可改）
            <textarea
              value={item.question}
              onChange={(event) => patchPrompt(item.id, { question: event.target.value })}
              placeholder="写成能勾选的具体问题，不要写成口号"
            />
          </label>
        </article>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn"
          type="button"
          onClick={() => patchCase(record.id, (prev) => ({ ...prev, remedy: { ...prev.remedy, phase: "causes" } }))}
        >
          返回修改末端原因
        </button>
      </div>
    </section>
  );
}

function ScamperPhase({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const ideas = record.remedy.scamper;
  const picked = ideas.filter((item) => item.selected).length;

  function patchIdea(id: string, partial: Partial<ScamperIdea>) {
    patchCase(record.id, (prev) => ({
      ...prev,
      remedy: {
        ...prev.remedy,
        scamper: prev.remedy.scamper.map((item) => (item.id === id ? { ...item, ...partial } : item)),
      },
    }));
  }

  function addManual() {
    patchCase(record.id, (prev) => ({
      ...prev,
      remedy: { ...prev.remedy, scamper: [...prev.remedy.scamper, newManualIdea()] },
    }));
  }

  function removeIdea(id: string) {
    patchCase(record.id, (prev) => ({
      ...prev,
      remedy: { ...prev.remedy, scamper: prev.remedy.scamper.filter((item) => item.id !== id) },
    }));
  }

  return (
    <section className="field">
      <span>SCAMPER 发散 · 选择要评估的对策</span>
      <p className="hint">
        七个变换动作帮助发散，不是标准答案。勾选你要带入矩阵评估的对策（建议 2—3 条，至少 1 条）。可改文字、可手写补充。当前已选{" "}
        {picked} 条。
      </p>
      {ideas.map((item) => (
        <article key={item.id} className={item.selected ? "focus-card chosen" : "focus-card"}>
          <div className="workspace-head" style={{ padding: 0 }}>
            <label className="check">
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(event) => patchIdea(item.id, { selected: event.target.checked })}
              />
              <span>作为要评估的对策</span>
            </label>
            <button className="btn-danger" type="button" onClick={() => removeIdea(item.id)}>
              删
            </button>
          </div>
          <p className="meta">{item.actionLabel}</p>
          <label className="field">
            对策想法（可改）
            <textarea
              value={item.text}
              onChange={(event) => patchIdea(item.id, { text: event.target.value })}
              placeholder="写成可观察、本人能推动的动作，不要写加强意识"
            />
          </label>
        </article>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" type="button" onClick={addManual}>
          补充一条对策
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => patchCase(record.id, (prev) => ({ ...prev, remedy: { ...prev.remedy, phase: "fiveW" } }))}
        >
          返回修改 5W 焦点
        </button>
      </div>
    </section>
  );
}

function MatrixPhase({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const items = record.remedy.options;
  const chosen = items.filter((item) => item.chosen).length;

  function patchItem(id: string, partial: Partial<RemedyOption>) {
    patchCase(record.id, (prev) => ({
      ...prev,
      remedy: {
        ...prev.remedy,
        options: prev.remedy.options.map((item) => (item.id === id ? { ...item, ...partial } : item)),
      },
    }));
  }

  const groups = {
    priority: items.filter((item) => remedyQuadrant(item) === "priority"),
    hard: items.filter((item) => remedyQuadrant(item) === "hard"),
    easy: items.filter((item) => remedyQuadrant(item) === "easy"),
    low: items.filter((item) => remedyQuadrant(item) === "low"),
  };

  return (
    <section className="field">
      <span>影响性 × 可行性</span>
      <p className="hint">
        不是选听起来最完整的方案，而是选现在最值得试的。影响性、可行性各打 1—5 分；右上角（≥4 × ≥4）是优先推进区。勾选要带入实施的对策。当前已选{" "}
        {chosen} 条。
      </p>
      <div className="matrix">
        <div className="quad">
          <strong>高影响 × 低可行</strong>
          <QuadList items={groups.hard} />
        </div>
        <div className="quad hot">
          <strong>优先推进区 · 高影响 × 高可行</strong>
          <QuadList items={groups.priority} />
        </div>
        <div className="quad">
          <strong>低影响 × 低可行</strong>
          <QuadList items={groups.low} />
        </div>
        <div className="quad">
          <strong>低影响 × 高可行</strong>
          <QuadList items={groups.easy} />
        </div>
      </div>
      <table className="score-table">
        <thead>
          <tr>
            <th>候选对策</th>
            <th>影响性</th>
            <th>可行性</th>
            <th>得分</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div>
                  <span className="meta">{item.scamperLabel}</span>
                  <div>{item.text}</div>
                </div>
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={item.impact}
                  onChange={(event) => patchItem(item.id, { impact: clampBox(event.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={item.feasibility}
                  onChange={(event) => patchItem(item.id, { feasibility: clampBox(event.target.value) })}
                />
              </td>
              <td>{remedyScoreOf(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.map((item) => (
        <article key={`card-${item.id}`} className={item.chosen ? "focus-card chosen" : "focus-card"}>
          <label className="check">
            <input
              type="checkbox"
              checked={item.chosen}
              onChange={(event) => patchItem(item.id, { chosen: event.target.checked })}
            />
            <span>作为要推进的对策</span>
          </label>
          <p className="meta">
            {item.scamperLabel} · 影响 {item.impact} × 可行 {item.feasibility} ＝ {remedyScoreOf(item)}
          </p>
          <label className="field">
            对策表述（可改）
            <textarea value={item.text} onChange={(event) => patchItem(item.id, { text: event.target.value })} />
          </label>
        </article>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn"
          type="button"
          onClick={() => patchCase(record.id, (prev) => ({ ...prev, remedy: { ...prev.remedy, phase: "scamper" } }))}
        >
          返回修改对策
        </button>
      </div>
    </section>
  );
}

function QuadList({ items }: { items: RemedyOption[] }) {
  if (items.length === 0) return <p className="hint">暂无</p>;
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.text}
          <span className="meta"> {remedyScoreOf(item)}分</span>
        </li>
      ))}
    </ul>
  );
}

function clampBox(value: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 3;
  return Math.min(5, Math.max(1, Math.round(num)));
}
