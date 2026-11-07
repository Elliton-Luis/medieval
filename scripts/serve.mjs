// Servidor estático de desenvolvimento com Cache-Control: no-store.
// O `python3 -m http.server` não manda Cache-Control, então o navegador reaproveita index.html (e o import map
// versionado) por heurística e o jogo "prende" numa versão antiga. Aqui nada é cacheado.
//   node scripts/serve.mjs [porta]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2]) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac",
  ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(root, url === "/" ? "index.html" : url);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (e, data) => {
      if (e) { res.writeHead(404, { "Cache-Control": "no-store" }).end("404"); return; }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      });
      res.end(data);
    });
  });
}).listen(port, () => console.log(`rex-mundi em http://localhost:${port} (sem cache)`));
