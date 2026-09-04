import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

function llmProxy(): Plugin {
  return {
    name: "sansheng-llm-proxy",
    configureServer(server) {
      server.middlewares.use("/llm-proxy", async (req, res) => {
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        const base = String(req.headers["x-llm-base"] ?? "").replace(/\/+$/, "");
        const pathName = String(req.headers["x-llm-path"] ?? "/v1/chat/completions");
        const auth = String(req.headers["authorization"] ?? "");
        if (!base) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "missing X-LLM-Base" }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = Buffer.concat(chunks);

        try {
          const upstream = await fetch(`${base}${pathName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(auth ? { Authorization: auth } : {}),
            },
            body,
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader(
            "Content-Type",
            upstream.headers.get("content-type") ?? "application/json",
          );
          res.end(text);
        } catch (error) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "proxy failed",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), llmProxy()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
