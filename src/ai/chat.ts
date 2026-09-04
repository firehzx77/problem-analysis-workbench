import { SettingsRequiredError } from "@/ai/client";
import { isSettingsReady, type ModelSettings } from "@/domain/settings";

export async function chatComplete(
  settings: ModelSettings,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: { json?: boolean },
): Promise<string> {
  if (!isSettingsReady(settings)) throw new SettingsRequiredError();

  const payload: Record<string, unknown> = {
    model: settings.model.trim(),
    temperature: settings.temperature,
    messages,
  };
  if (options?.json) payload.response_format = { type: "json_object" };

  let response = await send(settings, payload);
  if (!response.ok && options?.json && response.status === 400) {
    delete payload.response_format;
    response = await send(settings, payload);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(shortError(text, response.status));
  }

  const json = JSON.parse(text) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("模型没有返回可用内容");
  return content;
}

async function send(settings: ModelSettings, payload: Record<string, unknown>): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${settings.apiKey.trim()}`,
    "X-LLM-Base": settings.baseUrl.trim().replace(/\/+$/, ""),
    "X-LLM-Path": "/v1/chat/completions",
  };
  try {
    return await fetch("/llm-proxy", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    return fetch(`${settings.baseUrl.trim().replace(/\/+$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
    });
  }
}

function shortError(text: string, status: number): string {
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string };
    const message = typeof json.error === "string" ? json.error : json.error?.message;
    if (message) return `${status}：${message}`;
  } catch {
    /* ignore */
  }
  return `${status}：${text.slice(0, 180) || "调用失败"}`;
}
