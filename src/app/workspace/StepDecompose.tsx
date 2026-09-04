import { useState } from "react";
import { generateProblemTree } from "@/ai/roles/analyst";
import {
  DIMENSION_PRESETS,
  clampScore,
  collectSelectedTips,
  looksLikeSkeletonTree,
  mapTree,
  matchDimension,
  newNode,
  quadrantOf,
  removeNode,
  scoreOf,
  treeForDimension,
  usableDimension,
} from "@/domain/analyze";
import { handoffFromDefine, type AnalyzePhase, type CaseRecord, type MatrixItem, type ProblemNode } from "@/domain/case";
import { settingsBlockReason } from "@/domain/settings";
import { loadSettings } from "@/storage/db";
import { useStore } from "@/app/store";

const PHASES: { id: AnalyzePhase; label: string }[] = [
  { id: "tree", label: "1 问题树" },
  { id: "matrix", label: "2 影响 × 行动" },
  { id: "focus", label: "3 优先清单" },
];

export function StepDecompose({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const analyze = record.analyze;
  const order: AnalyzePhase[] = ["tree", "matrix", "focus"];

  function goPhase(id: AnalyzePhase) {
    if (order.indexOf(id) >= order.indexOf(analyze.phase)) return;
    if (id === "matrix" && analyze.matrix.length === 0) return;
    patchCase(record.id, (prev) => ({
      ...prev,
      analyze: {
        ...prev.analyze,
        phase: id,
        treeConfirmed: id !== "tree",
        matrixConfirmed: id === "focus",
      },
    }));
  }

  return (
    <div className="form-grid">
      <section className="field">
        <span>上一步输出（明确问题）</span>
        <p className="handoff">{analyze.sourceSnapshot || "尚未从「明确问题」带入。请回到上一步点下一步。"}</p>
      </section>

      <div className="phase-tabs">
        {PHASES.map((item) => {
          const earlier = order.indexOf(item.id) < order.indexOf(analyze.phase);
          return (
            <button
              key={item.id}
              type="button"
              className={item.id === analyze.phase ? "phase on" : earlier ? "phase done" : "phase"}
              onClick={() => goPhase(item.id)}
              disabled={!earlier && item.id !== analyze.phase}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {analyze.phase === "tree" ? <TreePhase record={record} /> : null}
      {analyze.phase === "matrix" ? <MatrixPhase record={record} /> : null}
      {analyze.phase === "focus" ? <FocusPhase record={record} /> : null}
      {analyze.error ? <p className="notice">{analyze.error}</p> : null}
    </div>
  );
}

function TreePhase({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const analyze = record.analyze;
  const selected = collectSelectedTips(analyze.tree).length;
  const [busy, setBusy] = useState(false);

  function patchTree(tree: ProblemNode[]) {
    patchCase(record.id, (prev) => ({ ...prev, analyze: { ...prev.analyze, tree } }));
  }

  async function regenerate() {
    setBusy(true);
    const snapshot = analyze.sourceSnapshot || handoffFromDefine(record);
    const seed = record.define.statement || record.title;
    try {
      const live = loadSettings();
      const blocked = settingsBlockReason(live);
      const chosen = usableDimension(analyze.dimension);
      if (blocked) {
        const fallback = treeForDimension(seed, chosen);
        patchCase(record.id, (prev) => ({
          ...prev,
          analyze: {
            ...prev.analyze,
            ...fallback,
            sourceSnapshot: snapshot,
            treeConfirmed: false,
            error: `${blocked}已重新给出可改骨架。`,
          },
        }));
        return;
      }
      const result = await generateProblemTree(live, snapshot, chosen);
      patchCase(record.id, (prev) => ({
        ...prev,
        analyze: {
          ...prev.analyze,
          ...result,
          sourceSnapshot: snapshot,
          treeConfirmed: false,
          error: "",
          ranAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      const fallback = treeForDimension(seed, analyze.dimension);
      patchCase(record.id, (prev) => ({
        ...prev,
        analyze: {
          ...prev.analyze,
          ...fallback,
          sourceSnapshot: snapshot,
          error: error instanceof Error ? `${error.message}。已给出可改骨架。` : "重新生成失败。",
        },
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="field">
      <span>问题树</span>
      <p className="hint">
        先拆“要分析哪些方面”，不要急着写根因。勾选要带入矩阵的分支，可改名称、增删节点。当前已选 {selected} 个末端问题。
      </p>
      <label className="field" style={{ marginTop: 8 }}>
        切分标准
        <input
          value={analyze.dimension}
          onChange={(event) =>
            patchCase(record.id, (prev) => ({
              ...prev,
              analyze: { ...prev.analyze, dimension: event.target.value },
            }))
          }
          placeholder="先点选一个建议，或自己写。每层只用一个标准。"
        />
      </label>
      <DimensionPicker
        value={analyze.dimension}
        onPick={(preset) => {
          const seed = record.define.statement || record.title;
          patchCase(record.id, (prev) => {
            const skeleton = looksLikeSkeletonTree(prev.analyze.tree);
            const next = skeleton ? treeForDimension(seed, preset.label) : { dimension: preset.label };
            return {
              ...prev,
              analyze: {
                ...prev.analyze,
                ...next,
                treeConfirmed: false,
              },
            };
          });
        }}
      />
      {analyze.tree.length === 0 ? (
        <p className="hint">还没有问题树。从第一步点「下一步」会自动生成；没有 API 时会给出可改的空白树。</p>
      ) : (
        <div className="tree">
          {analyze.tree.map((node) => (
            <TreeNodeEditor
              key={node.id}
              node={node}
              depth={0}
              onChange={(next) => patchTree(mapTree(analyze.tree, node.id, () => next))}
              onRemove={() => patchTree(removeNode(analyze.tree, node.id))}
            />
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn"
          type="button"
          onClick={() => patchTree([...analyze.tree, newNode("新的分析分支")])}
        >
          增加一级分支
        </button>
        <button className="btn" type="button" disabled={busy} onClick={() => void regenerate()}>
          {busy
            ? "正在重新生成…"
            : usableDimension(analyze.dimension)
              ? `按「${usableDimension(analyze.dimension)}」重新生成`
              : "重新生成问题树"}
        </button>
      </div>
    </section>
  );
}

function DimensionPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (preset: (typeof DIMENSION_PRESETS)[number]) => void;
}) {
  const current = matchDimension(value);
  return (
    <div className="dim-box">
      <p className="hint">每层只用一个标准。点选建议后可改名称；已有问题树时，再点重新生成才会按新标准重拆。</p>
      <div className="dim-chips">
        {DIMENSION_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={current?.id === item.id ? "dim-chip on" : "dim-chip"}
            onClick={() => onPick(item)}
          >
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>
      {current ? (
        <p className="hint">
          参考分支：{current.branches.join("、")}
        </p>
      ) : null}
    </div>
  );
}

function TreeNodeEditor({
  node,
  depth,
  onChange,
  onRemove,
}: {
  node: ProblemNode;
  depth: number;
  onChange: (node: ProblemNode) => void;
  onRemove: () => void;
}) {
  return (
    <div className="tree-node" style={{ marginLeft: depth * 18 }}>
      <div className="tree-row">
        <input
          type="checkbox"
          checked={node.selected}
          onChange={(event) => onChange({ ...node, selected: event.target.checked })}
        />
        <input
          value={node.label}
          onChange={(event) => onChange({ ...node, label: event.target.value })}
        />
        <button
          className="btn"
          type="button"
          onClick={() => onChange({ ...node, children: [...node.children, newNode("子问题")] })}
        >
          加子项
        </button>
        <button className="btn-danger" type="button" onClick={onRemove}>
          删
        </button>
      </div>
      {node.children.map((child) => (
        <TreeNodeEditor
          key={child.id}
          node={child}
          depth={depth + 1}
          onChange={(next) =>
            onChange({
              ...node,
              children: node.children.map((item) => (item.id === child.id ? next : item)),
            })
          }
          onRemove={() =>
            onChange({ ...node, children: node.children.filter((item) => item.id !== child.id) })
          }
        />
      ))}
    </div>
  );
}

function MatrixPhase({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const items = record.analyze.matrix;

  function patchItem(id: string, partial: Partial<MatrixItem>) {
    patchCase(record.id, (prev) => ({
      ...prev,
      analyze: {
        ...prev.analyze,
        matrix: prev.analyze.matrix.map((item) => (item.id === id ? { ...item, ...partial } : item)),
      },
    }));
  }

  const groups = {
    priority: items.filter((item) => quadrantOf(item) === "priority"),
    hard: items.filter((item) => quadrantOf(item) === "hard"),
    easy: items.filter((item) => quadrantOf(item) === "easy"),
    low: items.filter((item) => quadrantOf(item) === "low"),
  };

  return (
    <section className="field">
      <span>影响度 × 可行动性</span>
      <p className="hint">
        不是选最严重的，而是选现在最值得动手的。影响、可行动各打 1—5 分；右上角（≥4 × ≥4）是优先焦点区。
      </p>
      <div className="matrix">
        <div className="quad">
          <strong>高影响 × 低行动</strong>
          <QuadList items={groups.hard} />
        </div>
        <div className="quad hot">
          <strong>优先焦点区 · 高影响 × 高行动</strong>
          <QuadList items={groups.priority} />
        </div>
        <div className="quad">
          <strong>低影响 × 低行动</strong>
          <QuadList items={groups.low} />
        </div>
        <div className="quad">
          <strong>低影响 × 高行动</strong>
          <QuadList items={groups.easy} />
        </div>
      </div>
      <table className="score-table">
        <thead>
          <tr>
            <th>候选问题</th>
            <th>影响度</th>
            <th>可行动性</th>
            <th>得分</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.label}</td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={item.impact}
                  onChange={(event) => patchItem(item.id, { impact: clampScore(Number(event.target.value)) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={item.actionability}
                  onChange={(event) =>
                    patchItem(item.id, { actionability: clampScore(Number(event.target.value)) })
                  }
                />
              </td>
              <td>{scoreOf(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn"
          type="button"
          onClick={() =>
            patchCase(record.id, (prev) => ({
              ...prev,
              analyze: { ...prev.analyze, phase: "tree", treeConfirmed: false },
            }))
          }
        >
          返回修改问题树
        </button>
      </div>
    </section>
  );
}

function QuadList({ items }: { items: MatrixItem[] }) {
  if (items.length === 0) return <p className="hint">暂无</p>;
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          {item.label}
          <span className="meta"> {scoreOf(item)}分</span>
        </li>
      ))}
    </ul>
  );
}

function FocusPhase({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const focuses = record.analyze.focuses;
  const chosenCount = focuses.filter((item) => item.chosen).length;
  const investigated = new Set([
    ...record.cause.clusters.map((item) => item.goalId),
    ...(record.cause.pool ?? []).map((item) => item.problemId),
  ]);
  const poolCount = (record.cause.pool ?? []).filter((item) => item.kept).length;

  function patchFocus(id: string, partial: Partial<(typeof focuses)[number]>) {
    patchCase(record.id, (prev) => ({
      ...prev,
      analyze: {
        ...prev.analyze,
        focuses: prev.analyze.focuses.map((item) => (item.id === id ? { ...item, ...partial } : item)),
      },
    }));
  }

  function patchNeed(id: string, index: number, value: string) {
    patchCase(record.id, (prev) => ({
      ...prev,
      analyze: {
        ...prev.analyze,
        focuses: prev.analyze.focuses.map((item) =>
          item.id === id
            ? { ...item, dataNeeds: item.dataNeeds.map((need, i) => (i === index ? value : need)) }
            : item,
        ),
      },
    }));
  }

  function addNeed(id: string) {
    patchCase(record.id, (prev) => ({
      ...prev,
      analyze: {
        ...prev.analyze,
        focuses: prev.analyze.focuses.map((item) => {
          if (item.id !== id) return item;
          const needs = item.dataNeeds;
          if (needs.length > 0 && !needs[needs.length - 1].trim()) return item;
          return { ...item, dataNeeds: [...needs, ""] };
        }),
      },
    }));
  }

  function removeNeed(id: string, index: number) {
    patchCase(record.id, (prev) => ({
      ...prev,
      analyze: {
        ...prev.analyze,
        focuses: prev.analyze.focuses.map((item) =>
          item.id === id
            ? { ...item, dataNeeds: item.dataNeeds.filter((_, i) => i !== index) }
            : item,
        ),
      },
    }));
  }

  return (
    <section className="field">
      <span>优先问题清单与取证建议</span>
      <p className="hint">
        先勾选本轮要具体研究的关键问题（至少 1 条）。可多轮改选其他问题：每轮分析后收入原因池的条目会累积，不会覆盖。当前已选 {chosenCount} 条
        {poolCount ? `，原因池已有 ${poolCount} 条` : ""}。
      </p>
      {focuses.map((item, index) => (
        <article key={item.id} className={item.chosen ? "focus-card chosen" : "focus-card"}>
          <label className="check">
            <input
              type="checkbox"
              checked={item.chosen}
              onChange={(event) => patchFocus(item.id, { chosen: event.target.checked })}
            />
            <span>作为下一步要具体研究的关键问题</span>
          </label>
          <h3>
            {index + 1}. {item.label}
            {investigated.has(item.id) ? <span className="meta"> · 已追问</span> : null}
          </h3>
          <p className="meta">
            影响 {item.impact} × 可行动 {item.actionability} ＝ {item.score}
          </p>
          <p className="hint">建议收集的验证数据（可改、可增删）：</p>
          {item.dataNeeds.map((need, needIndex) => (
            <div key={`${item.id}-${needIndex}`} className="need-row">
              <span className="need-index">{needIndex + 1}</span>
              <input
                value={need}
                placeholder="写清口径、来源，并对照到差距指标"
                onChange={(event) => patchNeed(item.id, needIndex, event.target.value)}
              />
              <button className="btn-danger" type="button" onClick={() => removeNeed(item.id, needIndex)}>
                删
              </button>
            </div>
          ))}
          <button className="btn" type="button" onClick={() => addNeed(item.id)}>
            增加一条数据需求
          </button>
        </article>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn"
          type="button"
          onClick={() =>
            patchCase(record.id, (prev) => ({
              ...prev,
              analyze: { ...prev.analyze, phase: "matrix", matrixConfirmed: false },
            }))
          }
        >
          返回修改矩阵
        </button>
      </div>
    </section>
  );
}
