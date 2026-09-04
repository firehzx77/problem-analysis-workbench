import { useState } from "react";
import type { CaseRecord, GateId } from "@/domain/case";
import { GATE_CHECKLISTS, canPassGate, passGate, reopenGate } from "@/domain/case";
import { useStore } from "@/app/store";

export function GatePanel({
  record,
  gateId,
}: {
  record: CaseRecord;
  gateId: GateId;
}) {
  const { patchCase } = useStore();
  const [error, setError] = useState("");
  const gate = record.gates[gateId];
  const items = GATE_CHECKLISTS[gateId];
  const titles: Record<GateId, string> = {
    gate1: "人工判断 1 · 问题是否数据化、对象化、边界化",
    gate2: "人工判断 2 · 问题树、关键问题与取证数据是否到位",
    gate3: "人工判断 3 · 风险可接受、关键假设能否先验证",
  };

  function toggle(id: string) {
    patchCase(record.id, (prev) => {
      const current = prev.gates[gateId];
      return {
        ...prev,
        gates: {
          ...prev.gates,
          [gateId]: {
            ...current,
            passed: false,
            passedAt: null,
            checklist: { ...current.checklist, [id]: !current.checklist[id] },
          },
        },
      };
    });
  }

  function setRationale(value: string) {
    patchCase(record.id, (prev) => ({
      ...prev,
      gates: {
        ...prev.gates,
        [gateId]: { ...prev.gates[gateId], passed: false, passedAt: null, rationale: value },
      },
    }));
  }

  function submit() {
    try {
      const latest = patchCase(record.id, (prev) => passGate(prev, gateId));
      if (latest) setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "不能通过");
    }
  }

  const previewError = canPassGate(gate, gateId);

  return (
    <section className="gate-card">
      <h3>{titles[gateId]}</h3>
      <p className="hint">人工判断由你完成。系统不代勾、不代过。依据为空或只写“没问题”不能进入下一步。</p>
      {items.map((item) => (
        <label key={item.id} className="check">
          <input
            type="checkbox"
            checked={Boolean(gate.checklist[item.id])}
            onChange={() => toggle(item.id)}
            disabled={gate.passed}
          />
          <span>{item.label}</span>
        </label>
      ))}
      <label className="field" style={{ marginTop: 10 }}>
        判断依据
        <textarea
          value={gate.rationale}
          disabled={gate.passed}
          onChange={(event) => setRationale(event.target.value)}
          placeholder="用你自己的话写：凭什么认为可以进入下一步。"
        />
      </label>
      <div className="row" style={{ marginTop: 12 }}>
        {gate.passed ? (
          <>
            <span className="stamp done">已于 {gate.passedAt?.slice(0, 16).replace("T", " ")} 确认</span>
            <button className="btn" type="button" onClick={() => patchCase(record.id, (prev) => reopenGate(prev, gateId))}>
              撤回本次及之后的人工判断
            </button>
          </>
        ) : (
          <button className="btn btn-stamp" type="button" onClick={submit}>
            确认人工判断
          </button>
        )}
        {!gate.passed && (error || previewError) ? (
          <span className="hint">{error || previewError}</span>
        ) : null}
      </div>
    </section>
  );
}
