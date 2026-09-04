import { isSettingsReady, type ModelSettings } from "@/domain/settings";

export class SettingsRequiredError extends Error {
  constructor() {
    super("尚未配置模型 API");
    this.name = "SettingsRequiredError";
  }
}

export async function testConnection(settings: ModelSettings): Promise<string> {
  if (!isSettingsReady(settings)) {
    throw new SettingsRequiredError();
  }

  const payload = {
    model: settings.model.trim(),
    temperature: 0,
    max_tokens: 16,
    messages: [{ role: "user", content: "只回复：ok" }],
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${settings.apiKey.trim()}`,
    "X-LLM-Base": settings.baseUrl.trim().replace(/\/+$/, ""),
    "X-LLM-Path": "/v1/chat/completions",
  };

  let response: Response;
  try {
    response = await fetch("/llm-proxy", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    response = await fetch(
      `${settings.baseUrl.trim().replace(/\/+$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      },
    );
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(shortError(text, response.status));
  }
  return "连接成功。Key 只存在本机，不会写入课题导出。";
}

function shortError(text: string, status: number): string {
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string };
    const message =
      typeof json.error === "string" ? json.error : json.error?.message;
    if (message) return `${status}：${message}`;
  } catch {
    /* ignore */
  }
  return `${status}：${text.slice(0, 180) || "调用失败"}`;
}
