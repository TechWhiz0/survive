import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

function readBody(req: {
  on: (e: string, fn: (x?: Buffer) => void) => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => {
      if (c) chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function geminiHumanize(apiKey: string): Plugin {
  return {
    name: "gemini-humanize",
    configureServer(server) {
      server.middlewares.use("/live/humanize", async (req, res, next) => {
        if (req.method !== "POST") return next();
        res.setHeader("Content-Type", "application/json");
        if (!apiKey) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "missing GEMINI_API_KEY" }));
          return;
        }
        try {
          const body = JSON.parse(await readBody(req)) as {
            salary: number;
            family: number;
            cities: {
              id: string;
              name: string;
              marketRent: number;
              outside: number;
              foodPerPerson: number;
              commute: number;
              utilities: number;
            }[];
          };
          const prompt = `You correct Indian cost-of-living to what a REAL household would pay in 2026, not city-centre listings.

Salary: ₹${body.salary}/month. Family size: ${body.family} (1=solo, 2=couple, 3=1 child, 4=2 children).
Market stickers (DO NOT copy — these are unaffordable listings):
${JSON.stringify(body.cities)}

Rules:
- rent = PG / shared room / outskirts 1BHK / 2BHK they would actually take. Never exceed 30% of salary (32% if family>=3). A ₹50,000 earner in Bangalore pays ~₹8,000–₹12,000 (share/PG), NOT ₹25,000–₹31,000.
- transport = metro + bus + bike fuel they would use. ₹1,800–₹3,500 on low salaries. NO car (₹12k–₹17k fuel+EMI) unless salary >= ₹1,50,000.
- food = home cooking + some eating out.
- school = 0 if family < 3, else mid CBSE private per child (not international).
- Return ONLY JSON: { "<cityId>": { "rent": n, "food": n, "transport": n, "utilities": n, "school": n, "dating": n, "weekend": n } }
- All values monthly INR integers. Include every city id.`;

          const models = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
          ];
          let text = "";
          let last = "";
          for (const model of models) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const gRes = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.3,
                  responseMimeType: "application/json",
                },
              }),
            });
            last = `${gRes.status} ${model}`;
            if (!gRes.ok) continue;
            const json = (await gRes.json()) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
            };
            text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (text) break;
          }
          if (!text) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: last || "gemini failed" }));
            return;
          }
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          const parsed = JSON.parse(
            start >= 0 ? text.slice(start, end + 1) : text,
          );
          res.end(JSON.stringify(parsed));
        } catch (err) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : "humanize failed",
            }),
          );
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
    server: {
      proxy: {
        "/live/numbeo": {
          target: "https://www.numbeo.com",
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/live\/numbeo/, "/cost-of-living/in"),
        },
      },
    },
  };
});
