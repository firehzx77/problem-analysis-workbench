import { useState } from "react";
import { testConnection } from "@/ai/client";
import {
  PROVIDER_PRESETS,
  guessProviderId,
  isSettingsReady,
  resolveSettings,
  settingsBlockReason,
} from "@/domain/settings";
import { useStore } from "@/app/store";

export function SettingsPage() {
  const { settings, writeSettings } = useStore();
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const resolved = resolveSettings(draft);
  const ready = isSettingsReady(draft);
  const blocked = settingsBlockReason(draft);
  const guessed = guessProviderId(draft.apiKey);
  const guessedPreset = PROVIDER_PRESETS.find((item) => item.id === guessed);

  function commit(next: typeof draft, persist = false) {
    const resolvedNext = resolveSettings(next);
    setDraft(resolvedNext);
    if (persist || isSettingsReady(resolvedNext)) writeSettings(resolvedNext);
  }

  function patch<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    commit({ ...draft, [key]: value });
  }

  function applyPreset(id: string, persist = true) {
    const preset = PROVIDER_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    commit(
      {
        ...draft,
        provider: preset.id,
        baseUrl: preset.baseUrl || draft.baseUrl,
        model: preset.model || draft.model,
      },
      persist,
    );
  }

  function save() {
    writeSettings(draft);
    setMessage(ready ? "已保存在本机浏览器。换设备不会自动带过来。" : (blocked ?? "已保存，但还不能调用模型。"));
  }

  async function test() {
    writeSettings(draft);
    setBusy(true);
    setMessage("");
    try {
      setMessage(await testConnection(resolveSettings(draft)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>模型设置</h1>
      <p className="lede">
        使用你自己的 API。只填 Key 不够，还要有 Base URL 和模型名。选下面的提供商会自动填这两项。Key 只存在本机，不会写入课题导出。
      </p>

      <div className="settings-list">
        <label className="field">
          提供商
          <select value={draft.provider} onChange={(event) => applyPreset(event.target.value)}>
            {PROVIDER_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {guessedPreset && draft.provider === "custom" ? (
          <p className="notice">
            当前 Key 很像 {guessedPreset.label}。
            <button className="btn" type="button" style={{ marginLeft: 8 }} onClick={() => applyPreset(guessedPreset.id)}>
              按 {guessedPreset.label} 补全地址和模型
            </button>
          </p>
        ) : null}
        <label className="field">
          API Base URL
          <input
            value={draft.baseUrl}
            onChange={(event) => patch("baseUrl", event.target.value)}
            placeholder="https://api.example.com"
          />
          <span className="hint">OpenAI 兼容协议。一般填到主机，不要带 /chat/completions。</span>
        </label>
        <label className="field">
          模型名
          <input
            value={draft.model}
            onChange={(event) => patch("model", event.target.value)}
            placeholder="例如 gpt-4o-mini"
          />
        </label>
        <label className="field">
          API Key
          <span className="key-row">
            <input
              type={showKey ? "text" : "password"}
              value={draft.apiKey}
              autoComplete="off"
              onChange={(event) => patch("apiKey", event.target.value)}
              placeholder="只存在本机"
            />
            <button className="btn" type="button" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "隐藏" : "显示"}
            </button>
          </span>
        </label>
        <label className="field">
          温度（{draft.temperature.toFixed(1)}）
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={draft.temperature}
            onChange={(event) => patch("temperature", Number(event.target.value))}
          />
        </label>
      </div>

      <p className={ready ? "lede" : "notice"} style={{ marginTop: 16 }}>
        {ready
          ? `已就绪：${resolved.baseUrl} · ${resolved.model}`
          : blocked}
      </p>

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn btn-primary" type="button" onClick={save}>
          保存到本机
        </button>
        <button className="btn" type="button" disabled={!ready || busy} onClick={() => void test()}>
          {busy ? "测试中…" : "测试连接"}
        </button>
      </div>
      {message ? <p className={ready ? "lede" : "notice"}>{message}</p> : null}
    </main>
  );
}
