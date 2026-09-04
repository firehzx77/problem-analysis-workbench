import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STEPS, createCase, maxUnlockedStep } from "@/domain/case";
import { parseImportedCase, saveCase } from "@/storage/db";
import { useStore } from "@/app/store";

export function HomePage() {
  const { cases, upsert, remove } = useStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [scene, setScene] = useState("");
  const [error, setError] = useState("");

  function create() {
    if (!title.trim() || !scene.trim()) {
      setError("标题和场景 / 任务都要自己写，不从岗位列表里选。");
      return;
    }
    const record = upsert(createCase({ title, scene }));
    setOpen(false);
    navigate(`/case/${record.id}`);
  }

  async function onImport(file: File) {
    try {
      const text = await file.text();
      const record = saveCase(parseImportedCase(text));
      upsert(record);
      navigate(`/case/${record.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    }
  }

  return (
    <main className="page">
      <div className="hero">
        <div>
          <h1>用自己的问题开始</h1>
          <p className="lede">
            打开即用，不用注册。选题由你定义，AI 只在步骤里协助发散和挑战，每步人工判断要靠你自己写依据。
          </p>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            导入课题
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
            新建课题
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImport(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {error ? <p className="notice">{error}</p> : null}

      {cases.length === 0 ? (
        <div className="empty">
          还没有课题。选一件你正在面对的事——反复发生的、正在恶化的、或你想主动改善的。
        </div>
      ) : (
        <div className="case-grid">
          {cases.map((item) => {
            const unlocked = maxUnlockedStep(item);
            const step = STEPS.find((s) => s.id === item.currentStep);
            return (
              <article key={item.id} className="case-card">
                <button
                  type="button"
                  className="open"
                  onClick={() => navigate(`/case/${item.id}`)}
                >
                  <h3>{item.title}</h3>
                  <div className="meta">{item.define.scene}</div>
                  <div className="stamp-row">
                    <span className="stamp">
                      步骤 {item.currentStep} · {step?.name}
                    </span>
                    <span className={item.gates.gate1.passed ? "stamp done" : "stamp warn"}>
                      判断 1 {item.gates.gate1.passed ? "过" : "未过"}
                    </span>
                    <span className={item.gates.gate2.passed ? "stamp done" : "stamp warn"}>
                      可至 {unlocked}
                    </span>
                  </div>
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  style={{ alignSelf: "flex-start", marginTop: 8 }}
                  onClick={() => {
                    if (confirm(`删除课题「${item.title}」？数据在本机，删除后不可恢复，除非你已导出。`)) {
                      remove(item.id);
                    }
                  }}
                >
                  删除
                </button>
              </article>
            );
          })}
        </div>
      )}

      {open ? (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h2>新建课题</h2>
            <p className="lede">不选岗位。用一句话写出你要处理的场景或任务。</p>
            <div className="form-grid">
              <label className="field">
                课题标题
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例如：周任务按期完成率下降"
                />
              </label>
              <label className="field">
                场景 / 任务
                <textarea
                  value={scene}
                  onChange={(event) => setScene(event.target.value)}
                  placeholder="发生在哪里、涉及谁、你为什么现在要处理它"
                />
              </label>
            </div>
            {error ? <p className="hint">{error}</p> : null}
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
                取消
              </button>
              <button className="btn btn-primary" type="button" onClick={create}>
                进入第一步
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
