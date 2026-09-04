import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SettingsRequiredError } from "@/ai/client";
import { generateProblemTree, suggestDataNeeds, suggestMatrixScores } from "@/ai/roles/analyst";
import { generateCauseHypotheses } from "@/ai/roles/cause";
import { generateFiveW, generateScamper, suggestRemedyScores } from "@/ai/roles/innovator";
import { generateExperimentPlans } from "@/ai/roles/experimenter";
import {
  applyScores,
  chosenFocuses,
  collectSelectedTips,
  summarizeAnalyze,
  toFocusItems,
  toMatrixItems,
  treeForDimension,
  usableDimension,
} from "@/domain/analyze";
import {
  STEPS,
  canPassGate,
  emptyRemedy,
  handoffFromDefine,
  isStepUnlocked,
  judgmentToLeave,
  nextStepId,
  type GateId,
  type StepId,
} from "@/domain/case";
import { assembleClusters, backfillPoolReasons, causeBlockReason, fallbackCauseClusters, keptTerminals } from "@/domain/cause";
import { goalsBlockReason, goalsFromFocuses, handoffFromGoals } from "@/domain/goal";
import {
  applyRemedyScores,
  chosenRemedies,
  fallbackFiveW,
  fallbackScamper,
  handoffFromCauses,
  optionsFromScamper,
  remedyBlockReason,
  selectedCausesOf,
  selectedFocuses,
} from "@/domain/remedy";
import { fallbackPlan, handoffFromRemedies, planBlockReason, plansFromRemedies } from "@/domain/plan";
import { reviewBlockReason, reviewsFromPlans } from "@/domain/review";
import { isSettingsReady, settingsBlockReason } from "@/domain/settings";
import { downloadBlob, downloadText, exportCaseJson, exportCaseMarkdown, loadSettings } from "@/storage/db";
import { exportCaseDocx, exportCasePptx } from "@/storage/office";
import { useStore } from "@/app/store";
import { GatePanel } from "@/app/workspace/GatePanel";
import { StepCause } from "@/app/workspace/StepCause";
import { StepDefine } from "@/app/workspace/StepDefine";
import { StepDecompose } from "@/app/workspace/StepDecompose";
import { StepGoal } from "@/app/workspace/StepGoal";
import { StepPlan } from "@/app/workspace/StepPlan";
import { StepConsolidate } from "@/app/workspace/StepConsolidate";
import { StepRemedy } from "@/app/workspace/StepRemedy";
import { StepReview } from "@/app/workspace/StepReview";

export function WorkspacePage() {
  const { caseId } = useParams();
  const { find, patchCase } = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const record = caseId ? find(caseId) : null;

  if (!record) {
    return (
      <main className="page">
        <h1>找不到这份课题</h1>
        <p className="lede">数据在本机。若你换了浏览器或清过缓存，请用 JSON 备份导入。</p>
        <button className="btn" type="button" onClick={() => navigate("/")}>
          回到列表
        </button>
      </main>
    );
  }

  const current = record;
  const step = current.currentStep;
  const phase = current.analyze.phase;
  const remedyPhase = current.remedy.phase;
  const gateAfter = STEPS.find((item) => item.id === step)?.gateAfter as GateId | undefined;
  const upcoming = nextStepId(step);
  const showGate = Boolean(gateAfter) && (step !== 2 || phase === "focus") && (step !== 5 || remedyPhase === "matrix");
  const intraDecompose = step === 2 && phase !== "focus";
  const intraRemedy = step === 5 && remedyPhase !== "matrix";

  function go(next: StepId) {
    if (!isStepUnlocked(current, next)) return;
    setMessage("");
    if (next === 6) {
      setBusy(true);
      void enterPlan(current.id).finally(() => setBusy(false));
      return;
    }
    if (next === 7) {
      enterReview(current.id);
      return;
    }
    if (next === 8) {
      enterConsolidate(current.id);
      return;
    }
    patchCase(current.id, (prev) => ({ ...prev, currentStep: next }));
  }

  async function goNext() {
    if (step === 2 && phase === "focus") {
      const picked = chosenFocuses(current.analyze.focuses);
      if (picked.length === 0) {
        setMessage("请先勾选至少一条要具体研究的关键问题，再进入设定目标。");
        return;
      }
      if (picked.some((item) => !item.dataNeeds.some((need) => need.trim()))) {
        setMessage("选中的关键问题都要写清至少一条要收集的验证数据。");
        return;
      }
    }
    if (step === 3) {
      const blocked = goalsBlockReason(current.goal.items);
      if (blocked) {
        setMessage(blocked);
        return;
      }
    }
    if (step === 4) {
      const blocked = causeBlockReason(backfillPoolReasons(current.cause));
      if (blocked) {
        setMessage(blocked);
        return;
      }
    }
    if (step === 5) {
      const blocked = remedyBlockReason(current.remedy, remedyPhase);
      if (blocked) {
        setMessage(blocked);
        return;
      }
    }
    if (step === 6) {
      const blocked = planBlockReason(current.plan.items);
      if (blocked) {
        setMessage(blocked);
        return;
      }
    }
    if (step === 7) {
      const blocked = reviewBlockReason(current.review);
      if (blocked) {
        setMessage(blocked);
        return;
      }
    }
    if (!intraDecompose && !intraRemedy) {
      if (!upcoming) {
        navigate("/");
        return;
      }
      const needed = judgmentToLeave(step);
      if (needed) {
        const block = canPassGate(current.gates[needed], needed);
        if (!current.gates[needed].passed) {
          setMessage(block ?? "请先完成本步人工判断，再进入下一步。");
          return;
        }
      }
    }

    setBusy(true);
    setMessage("");
    try {
      if (step === 1) {
        await enterDecompose(current.id);
        return;
      }
      if (step === 2 && phase === "tree") {
        await confirmTree(current.id);
        return;
      }
      if (step === 2 && phase === "matrix") {
        await confirmMatrix(current.id);
        return;
      }
      if (step === 2 && phase === "focus") {
        patchCase(current.id, (prev) => ({
          ...prev,
          currentStep: 3,
          goal: goalsFromFocuses(prev.analyze.focuses, prev.define.gap, prev.goal),
        }));
        return;
      }
      if (step === 3) {
        await enterCause(current.id);
        return;
      }
      if (step === 4) {
        enterRemedy(current.id);
        return;
      }
      if (step === 5 && remedyPhase === "causes") {
        await enterFiveW(current.id);
        return;
      }
      if (step === 5 && remedyPhase === "fiveW") {
        await enterScamper(current.id);
        return;
      }
      if (step === 5 && remedyPhase === "scamper") {
        await enterMatrix(current.id);
        return;
      }
      if (step === 5 && remedyPhase === "matrix") {
        await enterPlan(current.id);
        return;
      }
      if (step === 6) {
        enterReview(current.id);
        return;
      }
      if (step === 7) {
        enterConsolidate(current.id);
        return;
      }
      if (step === 8) {
        navigate("/");
        return;
      }
      patchCase(current.id, (prev) => ({ ...prev, currentStep: upcoming ?? prev.currentStep }));
    } catch (error) {
      if (error instanceof SettingsRequiredError) {
        setMessage("尚未配置模型 API。");
      } else {
        setMessage(error instanceof Error ? error.message : "进入下一步失败");
      }
    } finally {
      setBusy(false);
    }
  }

  async function enterDecompose(id: string) {
        const snapshot = handoffFromDefine(current);
        const seed = current.define.statement || current.title;
        const built = await loadTree(snapshot, seed, current.analyze.dimension);
    patchCase(id, (prev) => ({
      ...prev,
      currentStep: 2,
      analyze: {
        ...prev.analyze,
        phase: "tree",
        dimension: built.dimension,
        tree: built.tree,
        treeConfirmed: false,
        matrix: [],
        matrixConfirmed: false,
        focuses: [],
        sourceSnapshot: snapshot,
        ranAt: new Date().toISOString(),
        error: built.error,
        markdown: summarizeAnalyze({
          ...prev.analyze,
          phase: "tree",
          dimension: built.dimension,
          tree: built.tree,
          sourceSnapshot: snapshot,
        }),
      },
    }));
    setMessage(built.error || "已根据上一步输出生成问题树，请修改、勾选后确认。");
  }

  async function confirmTree(id: string) {
    let tree = current.analyze.tree;
    let dimension = current.analyze.dimension;
    let error = "";
    const snapshot = current.analyze.sourceSnapshot || handoffFromDefine(current);

    if (tree.length === 0) {
      const built = await loadTree(snapshot, current.define.statement || current.title, current.analyze.dimension);
      tree = built.tree;
      dimension = built.dimension;
      error = built.error;
      patchCase(id, (prev) => ({
        ...prev,
        analyze: { ...prev.analyze, tree, dimension, error, sourceSnapshot: snapshot },
      }));
    }

    if (collectSelectedTips(tree).length === 0) {
      setMessage("请至少勾选一个末端问题，再放入矩阵。");
      return;
    }

    const items = toMatrixItems(tree);
    let matrix = items;
    const live = loadSettings();
    if (isSettingsReady(live)) {
      try {
        const scores = await suggestMatrixScores(live, snapshot, items);
        matrix = applyScores(items, scores);
      } catch (err) {
        error = joinError(error, err instanceof Error ? err.message : "评分建议失败，请手打分。");
      }
    }

    patchCase(id, (prev) => {
      const analyze = {
        ...prev.analyze,
        phase: "matrix" as const,
        dimension,
        tree,
        treeConfirmed: true,
        matrix,
        matrixConfirmed: false,
        focuses: [],
        sourceSnapshot: snapshot,
        ranAt: new Date().toISOString(),
        error,
      };
      return { ...prev, analyze: { ...analyze, markdown: summarizeAnalyze(analyze) } };
    });
    setMessage(error || "问题树已确认。请给每条打影响度与可行动性，再确认矩阵。");
  }

  async function confirmMatrix(id: string) {
    const matrix = current.analyze.matrix;
    if (matrix.length === 0) {
      setMessage("矩阵是空的。请先确认问题树。");
      return;
    }
    const snapshot = current.analyze.sourceSnapshot || handoffFromDefine(current);
    let error = "";
    let needs: Record<string, string[]> = {};
    const live = loadSettings();
    if (isSettingsReady(live)) {
      try {
        needs = await suggestDataNeeds(live, snapshot, matrix);
      } catch (err) {
        error = err instanceof Error ? err.message : "取证建议失败，已给出默认可改清单。";
      }
    }
    const focuses = toFocusItems(matrix, needs);
    patchCase(id, (prev) => {
      const analyze = {
        ...prev.analyze,
        phase: "focus" as const,
        matrixConfirmed: true,
        focuses,
        ranAt: new Date().toISOString(),
        error,
      };
      return { ...prev, analyze: { ...analyze, markdown: summarizeAnalyze(analyze) } };
    });
    setMessage(error || "已形成优先问题清单。请核对取证数据，完成本步人工判断后再进入设定目标。");
  }

  async function enterCause(id: string) {
    const goals = current.goal.items;
    const existing = current.cause.clusters;
    const need = goals.filter((goal) => {
      const hit = existing.find((cluster) => cluster.goalId === goal.id);
      return !hit?.hypotheses.length;
    });
    const snapshot = handoffFromGoals(current);
    const live = loadSettings();
    const blocked = settingsBlockReason(live);
    let error = "";
    let incoming = need.length ? fallbackCauseClusters(need) : [];
    if (need.length && blocked) {
      error = `${blocked}已给出可改的原因假设骨架。`;
    } else if (need.length) {
      try {
        incoming = await generateCauseHypotheses(live, snapshot, need);
      } catch (err) {
        error = err instanceof Error ? `${err.message}。已给出可改的原因假设骨架。` : "生成失败，已给出可改骨架。";
      }
    }
    patchCase(id, (prev) => {
      const clusters = assembleClusters(prev.cause.clusters, incoming, goals.map((item) => item.id));
      return {
        ...prev,
        currentStep: 4,
        cause: {
          ...prev.cause,
          sourceSnapshot: snapshot,
          ranAt: new Date().toISOString(),
          error,
          clusters,
        },
      };
    });
    setMessage(
      error ||
        (need.length
          ? "已生成本轮原因假设。请选定要保留的假设收入末端原因池；不必每条都做 5WHY。此前入池的原因不会被覆盖。"
          : "已回到这些问题的原因追问。末端原因池仍保留此前各问题收入的条目。"),
    );
  }

  function enterRemedy(id: string) {
    patchCase(id, (prev) => {
      const cause = backfillPoolReasons(prev.cause);
      const kept = keptTerminals(cause);
      const existing = prev.remedy ?? emptyRemedy();
      const selectedCauseIds = kept.map((item) => item.id);
      return {
        ...prev,
        currentStep: 5 as const,
        cause,
        remedy: {
          ...existing,
          phase: "causes",
          selectedCauseIds,
          sourceSnapshot: handoffFromCauses({ ...prev, cause, remedy: existing }, kept),
          error: kept.length ? "" : "末端原因池是空的。请回到第四步勾选。",
        },
      };
    });
    setMessage("末端原因已带入。请勾选本轮要做对策的原因，再生成 5W 提问。");
  }

  async function enterFiveW(id: string) {
    const causes = selectedCausesOf(current);
    const snapshot = handoffFromCauses(current, causes);
    const live = loadSettings();
    const blocked = settingsBlockReason(live);
    let error = "";
    let fiveW = fallbackFiveW(causes);
    if (blocked) {
      error = `${blocked}已给出可改的 5W 提问骨架。`;
    } else {
      try {
        fiveW = await generateFiveW(live, snapshot, causes);
      } catch (err) {
        error = err instanceof Error ? `${err.message}。已给出可改的 5W 提问骨架。` : "生成失败，已给出可改骨架。";
      }
    }
    patchCase(id, (prev) => ({
      ...prev,
      remedy: {
        ...prev.remedy,
        phase: "fiveW",
        sourceSnapshot: snapshot,
        ranAt: new Date().toISOString(),
        error,
        fiveW,
      },
    }));
    setMessage(error || "已生成 5W 提问。请勾选变化焦点，再用 SCAMPER 发散。");
  }

  async function enterScamper(id: string) {
    const causes = selectedCausesOf(current);
    const focuses = selectedFocuses(current.remedy);
    const snapshot = current.remedy.sourceSnapshot || handoffFromCauses(current, causes);
    const live = loadSettings();
    const blocked = settingsBlockReason(live);
    let error = "";
    let scamper = fallbackScamper(causes, focuses);
    if (blocked) {
      error = `${blocked}已给出可改的 SCAMPER 想法骨架。`;
    } else {
      try {
        scamper = await generateScamper(live, snapshot, causes, focuses);
      } catch (err) {
        error = err instanceof Error ? `${err.message}。已给出可改的 SCAMPER 想法骨架。` : "生成失败，已给出可改骨架。";
      }
    }
    patchCase(id, (prev) => ({
      ...prev,
      remedy: {
        ...prev.remedy,
        phase: "scamper",
        ranAt: new Date().toISOString(),
        error,
        scamper,
      },
    }));
    setMessage(error || "已按 SCAMPER 发散。请勾选要评估的对策，再进入矩阵。");
  }

  async function enterMatrix(id: string) {
    const causes = selectedCausesOf(current);
    const snapshot = current.remedy.sourceSnapshot || handoffFromCauses(current, causes);
    const focusIds = selectedFocuses(current.remedy).map((item) => item.id);
    let options = optionsFromScamper(
      current.remedy.scamper,
      current.remedy.selectedCauseIds,
      focusIds,
      current.remedy.options,
    );
    let error = "";
    const live = loadSettings();
    if (isSettingsReady(live) && options.length) {
      try {
        const scores = await suggestRemedyScores(live, snapshot, options);
        options = applyRemedyScores(options, scores);
      } catch (err) {
        error = err instanceof Error ? `${err.message}。请手打分。` : "评分建议失败，请手打分。";
      }
    }
    patchCase(id, (prev) => ({
      ...prev,
      remedy: {
        ...prev.remedy,
        phase: "matrix",
        ranAt: new Date().toISOString(),
        error,
        options,
      },
    }));
    setMessage(error || "请给每条对策打影响性与可行性，勾选要推进的对策，再完成本步人工判断。");
  }

  async function enterPlan(id: string) {
    const chosen = chosenRemedies(current.remedy.options);
    const snapshot = handoffFromRemedies(current);
    const extras = {
      baseline: current.define.gap.fromA || current.goal.items[0]?.baseline || "",
      metric: current.define.gap.metric || current.goal.items[0]?.metric || "",
    };
    const need = chosen.filter((item) => {
      const prior = [...current.plan.items, ...(current.plan.history ?? [])].find((row) => row.id === item.id);
      return !prior || (!prior.who.trim() && !prior.how.trim() && !prior.owner.trim());
    });
    const live = loadSettings();
    const blocked = settingsBlockReason(live);
    let error = "";
    let incoming = need.map((item) => fallbackPlan(item, extras));
    if (need.length && blocked) {
      error = `${blocked}已给出可改的实施计划骨架。`;
    } else if (need.length) {
      try {
        incoming = await generateExperimentPlans(live, snapshot, need, extras);
      } catch (err) {
        error = err instanceof Error ? `${err.message}。已给出可改的实施计划骨架。` : "生成失败，已给出可改骨架。";
      }
    }
    patchCase(id, (prev) => {
      const latestChosen = chosenRemedies(prev.remedy.options);
      return {
        ...prev,
        currentStep: 6 as const,
        plan: {
          ...plansFromRemedies(latestChosen, incoming, prev.plan),
          sourceSnapshot: snapshot,
          ranAt: new Date().toISOString(),
          error,
        },
      };
    });
    setMessage(
      error ||
        (need.length
          ? "已生成实施计划骨架。请补全 5W2H、假设和成功 / 停止标准。"
          : "已进入贯彻实施。此前填写的计划仍保留，可继续改。"),
    );
  }

  function enterReview(id: string) {
    patchCase(id, (prev) => ({
      ...prev,
      currentStep: 7,
      review: reviewsFromPlans(prev.plan.items, prev.goal.items, prev.review),
    }));
    setMessage("已按实施计划生成对照表。请自己填写实际结果，并区分结果偏差与执行偏差。");
  }

  function enterConsolidate(id: string) {
    patchCase(id, (prev) => ({ ...prev, currentStep: 8 }));
    setMessage("请自己填写固化三件套、横向边界和假设对照。写完可导出 Word 或 PPT。");
  }

  async function loadTree(snapshot: string, seed: string, dimension = "") {
    const live = loadSettings();
    const blocked = settingsBlockReason(live);
    const chosen = usableDimension(dimension);
    if (blocked) {
      return { ...treeForDimension(seed, chosen), error: `${blocked}已给出可改的问题树骨架。` };
    }
    try {
      const result = await generateProblemTree(live, snapshot, chosen);
      return { ...result, error: "" };
    } catch (error) {
      return {
        ...treeForDimension(seed, chosen),
        error: error instanceof Error ? `${error.message}。已给出可改的问题树骨架。` : "生成失败，已给出可改骨架。",
      };
    }
  }

  function fileBase() {
    return current.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "case";
  }

  async function exportOffice(kind: "docx" | "pptx") {
    setBusy(true);
    setMessage("");
    try {
      const blob = kind === "docx" ? await exportCaseDocx(current) : await exportCasePptx(current);
      downloadBlob(`${fileBase()}.${kind}`, blob);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-wide">
      <nav className="step-rail" aria-label="八步">
        {STEPS.map((item) => {
          const locked = !isStepUnlocked(current, item.id);
          return (
            <button
              key={item.id}
              className={item.id === step ? "step-btn active" : "step-btn"}
              type="button"
              disabled={locked}
              onClick={() => go(item.id)}
              title={locked ? "先完成本步之前的人工判断" : item.role}
            >
              <span className="step-num">{item.id}</span>
              <span>
                {item.name}
                <small>{locked ? "未解锁" : item.short}</small>
              </span>
            </button>
          );
        })}
      </nav>
      <main className="workspace">
        <div className="workspace-head">
          <div>
            <h2>
              第 {step} 步 · {STEPS[step - 1].name}
            </h2>
            <p className="hint">{STEPS[step - 1].role} · 可回看已解锁步骤；进入下一步前先做人工判断</p>
          </div>
          <div className="row">
            <button
              className="btn"
              type="button"
              onClick={() => downloadText(`${fileBase()}.json`, exportCaseJson(current), "application/json")}
            >
              导出 JSON
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                downloadText(`${fileBase()}.md`, exportCaseMarkdown(current), "text/markdown;charset=utf-8")
              }
            >
              导出 Markdown
            </button>
            <button className="btn" type="button" disabled={busy} onClick={() => void exportOffice("docx")}>
              导出 Word
            </button>
            <button className="btn" type="button" disabled={busy} onClick={() => void exportOffice("pptx")}>
              导出 PPT
            </button>
          </div>
        </div>

        {step === 1 ? <StepDefine record={current} /> : null}
        {step === 2 ? <StepDecompose record={current} /> : null}
        {step === 3 ? <StepGoal record={current} /> : null}
        {step === 4 ? <StepCause record={current} /> : null}
        {step === 5 ? <StepRemedy record={current} /> : null}
        {step === 6 ? <StepPlan record={current} /> : null}
        {step === 7 ? <StepReview record={current} /> : null}
        {step === 8 ? <StepConsolidate record={current} /> : null}
        {showGate && gateAfter ? <GatePanel record={current} gateId={gateAfter} /> : null}

        <div className="next-bar">
          <div>
            <span className="hint">{nextHint(step, phase, remedyPhase, upcoming)}</span>
            {message && !(intraDecompose && message.includes("人工判断")) && !(intraRemedy && message.includes("人工判断")) ? (
              <p className="notice" style={{ margin: "8px 0 0" }}>
                {message}
                {message.includes("API") ? (
                  <>
                    {" "}
                    <Link to="/settings">去设置</Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void goNext()}>
            {busy ? busyLabel(step, phase, remedyPhase) : nextLabel(step, phase, remedyPhase, upcoming)}
          </button>
        </div>
      </main>
    </div>
  );
}

function nextHint(step: StepId, phase: string, remedyPhase: string, upcoming: StepId | null): string {
  if (step === 1) return "下一步：分解问题 · 将根据本步输出自动生成可修改、可勾选的问题树";
  if (step === 2 && phase === "tree") return "确认问题树后，勾选的末端问题会进入影响度 × 可行动性矩阵";
  if (step === 2 && phase === "matrix") return "确认矩阵后，优先焦点区的问题会形成清单，并给出取证建议";
  if (step === 2 && phase === "focus") return "下一步：设定目标 · 先勾选要研究的关键问题，并完成本步人工判断";
  if (step === 3) return "下一步：把握真因 · 将按关键问题目标生成竞争性原因假设，由你判断";
  if (step === 4) return "下一步：制定对策 · 勾选末端原因后即可全部带入";
  if (step === 5 && remedyPhase === "causes") return "勾选末端原因后，AI 会给出 5W 提问，由你选变化焦点";
  if (step === 5 && remedyPhase === "fiveW") return "勾选焦点后，AI 会用 SCAMPER 帮你发散对策";
  if (step === 5 && remedyPhase === "scamper") return "勾选对策后进入影响性 × 可行性矩阵";
  if (step === 5 && remedyPhase === "matrix") return "下一步：贯彻实施 · 将按已选对策生成可填写的 5W2H 与最小实验计划";
  if (step === 6) return "下一步：评价结果 · 先写清谁、做什么、何时、如何，以及成功 / 停止标准";
  if (step === 7) return "下一步：巩固成果 · 先填每张对照卡的实际结果与偏差类型";
  if (step === 8) return "本步由你填写固化三件套与假设对照。随时可导出 Word / PPT";
  if (upcoming) return `下一步：${STEPS[upcoming - 1].name}`;
  return "已经是最后一步";
}

function nextLabel(step: StepId, phase: string, remedyPhase: string, upcoming: StepId | null): string {
  if (step === 1) return "下一步（生成问题树）";
  if (step === 2 && phase === "tree") return "确认问题树";
  if (step === 2 && phase === "matrix") return "确认矩阵";
  if (step === 2 && phase === "focus") return "下一步（设定目标）";
  if (step === 3) return "下一步（生成原因假设）";
  if (step === 4) return "下一步（带入末端原因）";
  if (step === 5 && remedyPhase === "causes") return "下一步（生成 5W 提问）";
  if (step === 5 && remedyPhase === "fiveW") return "下一步（SCAMPER 发散）";
  if (step === 5 && remedyPhase === "scamper") return "下一步（进入评估矩阵）";
  if (step === 5 && remedyPhase === "matrix") return "下一步（生成实施计划）";
  if (step === 6) return "下一步（评价结果）";
  if (step === 7) return "下一步（巩固成果）";
  if (step === 8) return "完成并回到列表";
  if (upcoming) return "下一步";
  return "回到列表";
}

function busyLabel(step: StepId, phase: string, remedyPhase: string): string {
  if (step === 1) return "正在生成问题树…";
  if (step === 2 && phase === "tree") return "正在放入矩阵…";
  if (step === 2 && phase === "matrix") return "正在形成清单…";
  if (step === 3) return "正在生成原因假设…";
  if (step === 5 && remedyPhase === "causes") return "正在生成 5W 提问…";
  if (step === 5 && remedyPhase === "fiveW") return "正在用 SCAMPER 发散…";
  if (step === 5 && remedyPhase === "scamper") return "正在形成评估矩阵…";
  if (step === 5 && remedyPhase === "matrix") return "正在生成实施计划…";
  return "处理中…";
}

function joinError(prev: string, next: string): string {
  return [prev, next].filter(Boolean).join(" ");
}
