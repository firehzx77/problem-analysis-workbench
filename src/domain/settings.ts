export interface ModelSettings {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
}

export const PROVIDER_PRESETS: {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
}[] = [
  { id: "custom", label: "自定义（OpenAI 兼容）", baseUrl: "", model: "" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com", model: "gpt-4o-mini" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "siliconflow", label: "硅基流动", baseUrl: "https://api.siliconflow.cn", model: "deepseek-ai/DeepSeek-V3" },
  { id: "moonshot", label: "Moonshot / Kimi", baseUrl: "https://api.moonshot.cn", model: "moonshot-v1-auto" },
  { id: "zhipu", label: "智谱", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
];

export const EMPTY_SETTINGS: ModelSettings = {
  provider: "custom",
  baseUrl: "",
  model: "",
  apiKey: "",
  temperature: 0.3,
};

export function resolveSettings(settings: ModelSettings): ModelSettings {
  const preset = PROVIDER_PRESETS.find((item) => item.id === settings.provider && item.id !== "custom");
  return {
    ...settings,
    provider: settings.provider || "custom",
    baseUrl: (settings.baseUrl || preset?.baseUrl || "").trim().replace(/\/+$/, ""),
    model: (settings.model || preset?.model || "").trim(),
    apiKey: (settings.apiKey || "").trim(),
    temperature: Number.isFinite(settings.temperature) ? settings.temperature : 0.3,
  };
}

export function isSettingsReady(settings: ModelSettings): boolean {
  const resolved = resolveSettings(settings);
  return Boolean(resolved.baseUrl && resolved.model && resolved.apiKey);
}

export function settingsBlockReason(settings: ModelSettings): string | null {
  const resolved = resolveSettings(settings);
  const missing: string[] = [];
  if (!resolved.baseUrl) missing.push("API Base URL");
  if (!resolved.model) missing.push("模型名");
  if (!resolved.apiKey) missing.push("API Key");
  if (missing.length === 0) return null;
  if (resolved.apiKey && missing.length) {
    return `设置里已有 Key，还缺${missing.join("、")}。请先选一个提供商（会自动填地址和模型），或自己补全后再生成。`;
  }
  return `尚未配置模型 API，还缺${missing.join("、")}。`;
}

export function guessProviderId(apiKey: string): string | null {
  const key = apiKey.trim();
  if (key.startsWith("sk-proj-") || key.startsWith("sk-svcacct-")) return "openai";
  if (/^sk-[a-zA-Z0-9]{32}$/.test(key)) return "deepseek";
  return null;
}
