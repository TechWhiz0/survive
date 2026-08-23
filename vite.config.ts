import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

function readKey(fallback: string): string {
  if (fallback) return fallback;
  try {
    const line = readFileSync(".env", "utf8")
      .split("\n")
      .find((row) => row.startsWith("GEMINI_API_KEY="));
    return line ? line.slice("GEMINI_API_KEY=".length).trim() : "";
  } catch {
    return "";
  }
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function geminiText(json: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

function geminiHumanize(apiKey: string): Plugin {
  return {
    name: "gemini-humanize",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/live/humanize") return next();
        if (req.method !== "POST") return next();
        res.setHeader("Content-Type", "application/json");
        const key = readKey(apiKey);
        if (!key) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "missing GEMINI_API_KEY" }));
          return;
        }
        try {
          const body = JSON.parse(await readBody(req)) as {
            salary: number;
            family: number;
            cities: { id: string; name: string; outside: number }[];
          };
          const compact = (body.cities ?? [])
            .map((c) => `${c.id}:${c.outside}`)
            .join(",");
          const prompt = `Indian monthly spend a real household pays in 2026. Not city-centre listings.
Salary ₹${body.salary}. Family ${body.family} (3=1 child, 4=2 children).
Outside 1BHK refs: ${compact}
Rules: rent ≤30% salary (32% if family≥3). ₹50k Bangalore rent 8k-12k share/PG, transport 1.8k-3.5k metro/bike, no car unless salary≥150000. food=home cooking. school=0 if family<3 else mid CBSE/child. dating and weekend MUST rise with salary (~3–6% of salary each; a ₹1.5L earner spends more nights out than a ₹50k earner).
JSON only: {"bangalore":{"rent":n,"food":n,"transport":n,"utilities":n,"school":n,"dating":n,"weekend":n},...} every city id.`;

          const models = ["gemini-2.5-flash", "gemini-flash-latest"];
          let text = "";
          let last = "";
          for (const model of models) {
            const gRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": key,
                },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json",
                  },
                }),
              },
            );
            last = `${gRes.status} ${model}`;
            if (!gRes.ok) {
              const err = await gRes.text();
              last += ` ${err.slice(0, 160)}`;
              continue;
            }
            text = geminiText(await gRes.json());
            if (text) break;
          }
          if (!text) {
            console.warn("[humanize]", last);
            res.end("{}");
            return;
          }
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          res.end(start >= 0 ? text.slice(start, end + 1) : text);
        } catch (err) {
          console.warn("[humanize]", err);
          res.end("{}");
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), geminiHumanize(env.GEMINI_API_KEY ?? "")],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
