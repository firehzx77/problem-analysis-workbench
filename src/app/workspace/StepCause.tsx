import { useRef, useState } from "react";
import { generateCauseHypotheses, generateWhyLayer } from "@/ai/roles/cause";
import {
  CAUSE_VERDICTS,
  MAX_WHY_DEPTH,
  addNodeToPool,
  assembleClusters,
  causeBlockReason,
  fallbackCauseClusters,
  fallbackWhyChildren,
  findChain,
  groupPoolByProblem,
  mapHypothesis,
  newHypothesis,
  newManualTerminal,
  removeHypothesis,
  removeNodeFromPool,
  whyLayerLabel,
} from "@/domain/cause";
import type { CaseRecord, CauseDraft, CauseHypothesis, CauseVerdict, TerminalCause } from "@/domain/case";
import { clampScore } from "@/domain/analyze";
import { handoffFromGoals } from "@/domain/goal";
import { settingsBlockReason } from "@/domain/settings";
import { loadSettings } from "@/storage/db";
import { useStore } from "@/app/store";

export function StepCause({ record }: { record: CaseRecord }) {
  const { patchCase } = useStore();
  const cause = record.cause;
  const [busyId, setBusyId] = useState("");
  const askingRef = useRef(new Set<string>());
  const currentIds = record.goal.items.map((item) => item.id);
  const currentSet = new Set(currentIds);
  const activeClusters = cause.clusters.filter((item) => currentSet.has(item.goalId));
  const archivedClusters = cause.clusters.filter((item) => !currentSet.has(item.goalId));
  const pooledIds = new Set((cause.pool ?? []).map((item) => item.sourceHypothesisId).filter(Boolean));
  const blockNext = causeBlockReason(cause);

  function commitCause(recipe: (draft: CauseDraft) => CauseDraft) {
    patchCase(record.id, (prev) => ({
      ...prev,
      cause: recipe(prev.cause),
    }));
  }

  function addToPool(clusterId: string, nodeId: string) {
    commitCause((draft) => {
      const cluster = draft.clusters.find((item) => item.goalId === clusterId);
      if (!cluster) return draft;
      return addNodeToPool(draft, cluster, nodeId);
    });
  }

  function togglePool(clusterId: string, nodeId: string, selected: boolean) {
    if (selected) addToPool(clusterId, nodeId);
    else commitCause((draft) => removeNodeFromPool(draft, nodeId));
  }

  function updateHyps(clusterId: string, recipe: (hyps: CauseHypothesis[]) => CauseHypothesis[]) {
    commitCause((draft) => ({
      ...draft,
      clusters: draft.clusters.map((row) =>
        row.goalId === clusterId ? { ...row, hypotheses: recipe(row.hypotheses) } : row,
      ),
    }));
  }

  function goPickOtherProblems() {
    patchCase(record.id, (prev) => ({
      ...prev,
      currentStep: 2,
      analyze: {
        ...prev.analyze,
        phase: prev.analyze.focuses.length ? "focus" : prev.analyze.phase,
      },
    }));
  }

  async function regenerate(goalId?: string) {
    const live = loadSettings();
    const blocked = settingsBlockReason(live);
    const goals = (goalId ? [goalId] : currentIds)
      .map((id) => resolveGoal(record, id))
      .filter((item): item is NonNullable<ReturnType<typeof resolveGoal>> => Boolean(item));
    if (goals.length === 0) {
      commitCause((draft) => ({ ...draft, error: "请先在第三步写好关键问题目标，再生成原因假设。" }));
      return;
    }
    const snapshot = record.cause.sourceSnapshot || handoffFromGoals(record);
    setBusyId(goalId || "all");
    try {
      const generated = blocked
        ? fallbackCauseClusters(goals)
        : await generateCauseHypotheses(live, snapshot, goals);
      commitCause((draft) => ({
        ...draft,
        sourceSnapshot: snapshot,
        error: blocked ? `${blocked}已给出可改的原因假设骨架。` : "",
        ranAt: new Date().toISOString(),
        clusters: assembleClusters(draft.clusters, generated, goalId ? [goalId] : goals.map((item) => item.id)),
      }));
    } catch (error) {
      commitCause((draft) => ({
        ...draft,
        clusters: draft.clusters.length ? draft.clusters : fallbackCauseClusters(record.goal.items),
        error: error instanceof Error ? `${error.message}。可手改假设后再判断。` : "生成失败，请手写原因假设。",
      }));
    } finally {
      setBusyId("");
    }
  }

  async function askWhy(clusterId: string, parentId: string, force = false) {
    const cluster = record.cause.clusters.find((item) => item.goalId === clusterId);
    if (!cluster) return;
    const chain = findChain(cluster.hypotheses, parentId);
    const parent = chain?.[chain.length - 1];
    if (!parent) return;
    if ((parent.depth ?? 0) >= MAX_WHY_DEPTH) return;
    if (!force && parent.children.length > 0) return;
    if (askingRef.current.has(parentId) && !force) return;
    askingRef.current.add(parentId);

    const snapshot = record.cause.sourceSnapshot || handoffFromGoals(record);
    const live = loadSettings();
    const blocked = settingsBlockReason(live);
    setBusyId(parentId);
    try {
      let children: CauseHypothesis[];
      let error = "";
      if (blocked) {
        children = fallbackWhyChildren(parent);
        error = `${blocked}已给出可改的 5WHY 下层骨架。`;
      } else {
        try {
          children = await generateWhyLayer(live, snapshot, {
            problemLabel: cluster.problemLabel,
            goalStatement: cluster.goalStatement,
            parent,
            chain,
          });
        } catch (err) {
          children = fallbackWhyChildren(parent);
          error = err instanceof Error ? `${err.message}。已给出可改的 5WHY 下层骨架。` : "生成失败，已给出可改骨架。";
        }
      }
      patchCase(record.id, (prev) => ({
        ...prev,
        cause: {
          ...prev.cause,
          error,
          clusters: prev.cause.clusters.map((row) =>
            row.goalId === clusterId
              ? {
                  ...row,
                  hypotheses: mapHypothesis(row.hypotheses, parentId, (item) =>
                    !force && item.children.length > 0 ? item : { ...item, children },
                  ),
                }
              : row,
          ),
        },
      }));
    } finally {
      askingRef.current.delete(parentId);
      setBusyId("");
    }
  }

  if (cause.clusters.length === 0) {
    return (
      <div className="form-grid">
        <p className="notice">还没有原因假设。从第三步点「下一步」会按关键问题目标生成；也可在本步重新生成。</p>
        <button className="btn" type="button" disabled={Boolean(busyId)} onClick={() => void regenerate()}>
          {busyId ? "正在生成…" : "生成原因假设"}
        </button>
        <TerminalPool record={record} onBack={goPickOtherProblems} />
      </div>
    );
  }

  function renderCluster(cluster: (typeof cause.clusters)[number], clusterIndex: number, archived = false) {
    return (
      <section key={cluster.goalId} className="cause-cluster">
        <h3>
          {archived ? "已追问 · " : `关键问题 ${clusterIndex + 1} · `}
          {cluster.problemLabel}
        </h3>
        <p className="hint">{cluster.goalStatement || "（未带入目标陈述）"}</p>
        {cluster.hypotheses.map((item, index) => (
            <HypothesisCard
              key={item.id}
              index={index}
              item={item}
              busyId={busyId}
              pooled={pooledIds.has(item.id)}
              pooledIds={pooledIds}
              onChange={(id, partial) => updateHyps(cluster.goalId, (hyps) => mapHypothesis(hyps, id, (row) => ({ ...row, ...partial })))}
              onRemove={(id) => updateHyps(cluster.goalId, (hyps) => removeHypothesis(hyps, id))}
              onAskWhy={(id, force) => void askWhy(cluster.goalId, id, force)}
              onTogglePool={(id, selected) => togglePool(cluster.goalId, id, selected)}
              onAddChild={(id) =>
                updateHyps(cluster.goalId, (hyps) =>
                  mapHypothesis(hyps, id, (row) => ({
                    ...row,
                    children: [
                      ...row.children,
                      newHypothesis("可观察的更底层机制（可改）", {
                        depth: Math.min((row.depth ?? 0) + 1, MAX_WHY_DEPTH),
                        whyQuestion: row.whyQuestion || `为什么会出现「${row.text.trim() || "上一层机制"}」？`,
                      }),
                    ],
                  })),
                )
              }
            />
        ))}
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn"
            type="button"
            onClick={() => updateHyps(cluster.goalId, (hyps) => [...hyps, newHypothesis()])}
          >
            增加一条假设
          </button>
          <button
            className="btn"
            type="button"
            disabled={Boolean(busyId)}
            onClick={() => void regenerate(cluster.goalId)}
          >
            {busyId === cluster.goalId ? "正在重新生成…" : "按此问题重新生成假设"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="form-grid">
      <p className="coming">
        勾选「选入末端原因池」的假设会累积到下方原因池。不必每条都做 5WHY。勾选后即可点下一步，把已选末端原因全部带入对策。改选其他问题再分析只会追加，不会覆盖。禁止停在“意识不足 / 沟通不到位”。
      </p>
      {blockNext ? <p className="notice">{blockNext}</p> : null}
      <div className="row">
        <button className="btn" type="button" onClick={goPickOtherProblems}>
          回到第二步，改选其他问题继续追问
        </button>
      </div>
      {cause.error ? <p className="notice">{cause.error}</p> : null}
      {activeClusters.map((cluster, clusterIndex) => renderCluster(cluster, clusterIndex))}
      {archivedClusters.length > 0 ? (
        <details className="archive-block">
          <summary>其他已追问的问题（{archivedClusters.length}）· 数据已保留</summary>
          {archivedClusters.map((cluster, clusterIndex) => renderCluster(cluster, clusterIndex, true))}
        </details>
      ) : null}
      <TerminalPool record={record} onBack={goPickOtherProblems} />
    </div>
  );
}

function HypothesisCard({
  item,
  index,
  busyId,
  pooled,
  pooledIds,
  onChange,
  onRemove,
  onAskWhy,
  onTogglePool,
  onAddChild,
}: {
  item: CauseHypothesis;
  index: number;
  busyId: string;
  pooled: boolean;
  pooledIds: Set<string>;
  onChange: (id: string, partial: Partial<CauseHypothesis>) => void;
  onRemove: (id: string) => void;
  onAskWhy: (id: string, force?: boolean) => void;
  onTogglePool: (id: string, selected: boolean) => void;
  onAddChild: (id: string) => void;
}) {
  const depth = item.depth ?? 0;
  const canWhy = depth < MAX_WHY_DEPTH;
  const asking = busyId === item.id;
  const showWhy = asking || item.children.length > 0;

  return (
    <article className={`focus-card verdict-${item.verdict}${pooled ? " chosen" : ""}`}>
      <div className="workspace-head" style={{ padding: 0 }}>
        <h3>
          {whyLayerLabel(depth, index)}
          {pooled ? <span className="meta"> · 已入池</span> : null}
        </h3>
        <button className="btn-danger" type="button" onClick={() => onRemove(item.id)}>
          删
        </button>
      </div>
      {item.whyQuestion ? <p className="hint">追问：{item.whyQuestion}</p> : null}
      <label className="check">
        <input type="checkbox" checked={pooled} onChange={(event) => onTogglePool(item.id, event.target.checked)} />
        <span>选入末端原因池（勾选后可带入下一步）</span>
      </label>
      <label className="field" style={{ marginTop: 8 }}>
        原因假设（可观察的机制）
        <textarea
          value={item.text}
          onChange={(event) => onChange(item.id, { text: event.target.value })}
          placeholder="不要写意识不足、沟通不到位。写成流程里能看见的机制。"
        />
      </label>
      <div className="form-grid two" style={{ marginTop: 8 }}>
        <label className="field">
          发生在哪个环节
          <input
            value={item.mechanism}
            onChange={(event) => onChange(item.id, { mechanism: event.target.value })}
            placeholder="规则 / 交接 / 系统接口等"
          />
        </label>
        <label className="field">
          建议优先验证程度（1—5）
          <input
            type="number"
            min={1}
            max={5}
            value={item.confidence}
            onChange={(event) => onChange(item.id, { confidence: clampScore(Number(event.target.value)) })}
          />
        </label>
        <label className="field">
          支持点（没有就写未知）
          <input
            value={item.support}
            onChange={(event) => onChange(item.id, { support: event.target.value })}
            placeholder="已知事实，不编造"
          />
        </label>
        <label className="field">
          反证 / 若不成立该看到什么
          <input
            value={item.counter}
            onChange={(event) => onChange(item.id, { counter: event.target.value })}
            placeholder="用来挑战这条假设"
          />
        </label>
        <label className="field">
          还缺什么数据
          <input
            value={item.missing}
            onChange={(event) => onChange(item.id, { missing: event.target.value })}
            placeholder="可核对的记录或现场观察"
          />
        </label>
        <label className="field">
          最低成本验证
          <input
            value={item.verify}
            onChange={(event) => onChange(item.id, { verify: event.target.value })}
            placeholder="两周内能做完的核对动作"
          />
        </label>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        可选判断。入池不要求先做 5WHY。
      </p>
      <div className="verdict-row">
        {CAUSE_VERDICTS.filter((row) => row.id !== "pending").map((row) => (
          <button
            key={row.id}
            type="button"
            className={item.verdict === row.id ? `verdict on ${row.id}` : "verdict"}
            onClick={() => onChange(item.id, { verdict: row.id })}
          >
            <strong>{row.label}</strong>
            <span>{row.hint}</span>
          </button>
        ))}
      </div>
      {item.verdict !== "pending" ? (
        <label className="field" style={{ marginTop: 8 }}>
          判断依据（可选，入池后在原因池里再写正式依据）
          <input
            value={item.verdictReason}
            onChange={(event) => onChange(item.id, { verdictReason: event.target.value })}
            placeholder={reasonPlaceholder(item.verdict)}
          />
        </label>
      ) : null}
      <div className="row" style={{ marginTop: 10 }}>
        {canWhy ? (
          <button className="btn" type="button" disabled={Boolean(busyId)} onClick={() => onAskWhy(item.id, true)}>
            {asking ? "正在生成下一层…" : item.children.length ? "重新生成 5WHY 下一层" : "可选：继续 5WHY 追问"}
          </button>
        ) : (
          <p className="hint">已到 5WHY 第 5 层。可勾选收入原因池。</p>
        )}
      </div>
      {showWhy ? (
        <div className="why-panel">
          {asking ? <p className="notice">正在按 5WHY 生成下一层假设…</p> : null}
          {item.children.map((child, childIndex) => (
            <div key={child.id} className="why-nest">
              <HypothesisCard
                item={child}
                index={childIndex}
                busyId={busyId}
                pooled={pooledIds.has(child.id)}
                pooledIds={pooledIds}
                onChange={onChange}
                onRemove={onRemove}
                onAskWhy={onAskWhy}
                onTogglePool={onTogglePool}
                onAddChild={onAddChild}
              />
            </div>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" type="button" onClick={() => onAddChild(item.id)}>
              增加一条下层假设
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function resolveGoal(record: CaseRecord, id: string) {
  const fromGoal =
    record.goal.items.find((item) => item.id === id) || (record.goal.history ?? []).find((item) => item.id === id);
  if (fromGoal) return fromGoal;
  const cluster = record.cause.clusters.find((item) => item.goalId === id);
  if (!cluster) return null;
  return {
    id: cluster.goalId,
    problemLabel: cluster.problemLabel,
    metric: "",
    baseline: "",
    target: "",
    deadline: "",
    leadIndicator: "",
    resultIndicator: "",
    guardIndicator: "",
    statement: cluster.goalStatement,
  };
}

function reasonPlaceholder(verdict: CauseVerdict): string {
  if (verdict === "hold") return "凭什么认为值得作为候选真因继续追";
  if (verdict === "reject") return "凭什么排除（可选）";
  return "还缺哪类证据，准备怎么取";
}

function TerminalPool({ record, onBack }: { record: CaseRecord; onBack: () => void }) {
  const { patchCase } = useStore();
  const pool = record.cause.pool ?? [];
  const kept = pool.filter((item) => item.kept).length;
  const groups = groupPoolByProblem(pool);
  const problemCount = groups.length;

  function commit(recipe: (draft: CauseDraft) => CauseDraft) {
    patchCase(record.id, (prev) => ({
      ...prev,
      cause: recipe(prev.cause),
    }));
  }

  function patchItem(id: string, partial: Partial<TerminalCause>) {
    commit((draft) => ({
      ...draft,
      pool: draft.pool.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    }));
  }

  function removeItem(id: string) {
    commit((draft) => {
      const hit = draft.pool.find((item) => item.id === id);
      return {
        ...draft,
        pool: draft.pool.filter((item) => item.id !== id),
        ignoredSourceIds: hit?.sourceHypothesisId
          ? [...new Set([...draft.ignoredSourceIds, hit.sourceHypothesisId])]
          : draft.ignoredSourceIds,
      };
    });
  }

  return (
    <section className="pool-block">
      <h3>末端原因池</h3>
      <p className="hint">
        由你勾选收入，按问题累积，不会覆盖。勾选「纳入后续对策」的条目会在点下一步时全部带入。判断依据可写在这里，不是进入下一步的门槛。当前来自 {problemCount}{" "}
        个问题，已勾选 {kept} 条。
      </p>
      {pool.length === 0 ? (
        <p className="notice">池子还是空的。在上方假设里勾选「选入末端原因池」即可，不必每条都做 5WHY。</p>
      ) : (
        groups.map((group) => (
          <section key={group.problemId} className="cause-cluster">
            <h3>来自问题 · {group.problemLabel}</h3>
            {group.items.map((item) => (
              <article key={item.id} className={item.kept ? "focus-card chosen" : "focus-card"}>
                <div className="workspace-head" style={{ padding: 0 }}>
                  <h3>{item.kind === "unknown" ? "待取证" : "候选机制"}</h3>
                  <button className="btn-danger" type="button" onClick={() => removeItem(item.id)}>
                    删
                  </button>
                </div>
                <p className="hint">追问链：{item.chain.filter(Boolean).join(" → ") || "（直接入池，未追 5WHY）"}</p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={item.kept}
                    onChange={(event) => patchItem(item.id, { kept: event.target.checked })}
                  />
                  <span>纳入后续对策（取消则本条不带入下一步）</span>
                </label>
                <label className="field">
                  末端原因（可改）
                  <textarea
                    value={item.text}
                    onChange={(event) => patchItem(item.id, { text: event.target.value })}
                    placeholder="写成可观察、可验证、团队有权改变的机制"
                  />
                </label>
                <label className="field">
                  判断依据（可选，会随本条带入下一步）
                  <textarea
                    value={item.verdictReason}
                    onChange={(event) => patchItem(item.id, { verdictReason: event.target.value })}
                    placeholder="为何把它作为末端原因带入对策"
                  />
                </label>
                <div className="form-grid two" style={{ marginTop: 8 }}>
                  <label className="field">
                    发生环节
                    <input
                      value={item.mechanism}
                      onChange={(event) => patchItem(item.id, { mechanism: event.target.value })}
                      placeholder="规则 / 交接 / 接口"
                    />
                  </label>
                  <label className="field">
                    最低成本验证
                    <input
                      value={item.verify}
                      onChange={(event) => patchItem(item.id, { verify: event.target.value })}
                      placeholder="两周内能做完的核对"
                    />
                  </label>
                </div>
              </article>
            ))}
          </section>
        ))
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className="btn"
          type="button"
          onClick={() =>
            commit((draft) => ({
              ...draft,
              pool: [
                ...draft.pool,
                newManualTerminal(record.goal.items[0]?.problemLabel || "手写补充", record.goal.items[0]?.id || ""),
              ],
            }))
          }
        >
          手写一条末端原因
        </button>
        <button className="btn" type="button" onClick={onBack}>
          回第二步改选其他问题
        </button>
      </div>
    </section>
  );
}
