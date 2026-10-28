import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { CompanionProvider } from "./provider.mjs";

const __dirname = fileURLToPath(new URL("..", import.meta.url));
const provider = new CompanionProvider();
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".json": "application/json; charset=utf-8",
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const relative = clean === "/" ? "/index.html" : clean;
  const full = normalize(join(__dirname, relative));
  return full.startsWith(__dirname) ? full : null;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({
      ok: true,
      geminiConfigured: provider.enabled,
      model: provider.model,
    }));
  }

  if (req.method === "POST" && req.url === "/api/companion") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 20000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        if (!Array.isArray(payload.messages)) throw new Error("Invalid messages");
        const result = await provider.generate({ messages: payload.messages });
        if (!result) {
          res.writeHead(204);
          return res.end();
        }

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        if (result.safety) return res.end(JSON.stringify({ safety: true }));
        if (result.text) return res.end(JSON.stringify({ text: result.text }));
        res.end(JSON.stringify({ error: "Companion unavailable." }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Companion unavailable." }));
      }
    });
    return;
  }

  const file = safePath(req.url || "/");
  if (!file) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": extname(file) === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Tethr running at http://localhost:${port}`);
});
