// Atualiza a versão de cache da aplicação (rode a cada mudança em src/ ou style.css):
//   node scripts/bump-cache.mjs          -> incrementa a versão
//   node scripts/bump-cache.mjs 40       -> força a versão 40
//
// Por que: só o <script src="main.js?v=N"> tinha versão; os demais módulos (world.js, player.js, ...)
// ficavam no cache do navegador e o jogo "prendia" na versão antiga. Aqui cada módulo de src/ entra no
// import map com ?v=N (o navegador trata como URL nova), e o CSS e o Web Worker também recebem ?v=N.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

const current = Number(/main\.js\?v=(\d+)/.exec(html)?.[1] ?? 0);
const version = Number(process.argv[2]) || current + 1;

// 1) import map: three + um mapeamento versionado por módulo de src/
const modules = fs.readdirSync(path.join(root, "src")).filter((f) => f.endsWith(".js")).sort();
const imports = {
  three: "./vendor/three.module.js",
  "three/addons/": "./vendor/addons/",
};
for (const f of modules) {
  if (f === "main.js" || f === "terrainWorker.js") continue; // main: <script src>; worker: URL própria
  imports[`./src/${f}`] = `./src/${f}?v=${version}`;
}
const importMap = `<script type="importmap">\n      ${JSON.stringify({ imports }, null, 2).replace(/\n/g, "\n      ")}\n    </script>`;
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, importMap);

// 2) script principal e CSS
html = html.replace(/main\.js(\?v=\d+)?"/, `main.js?v=${version}"`);
html = html.replace(/href="\.\/style\.css(\?v=\d+)?"/, `href="./style.css?v=${version}"`);
fs.writeFileSync(indexPath, html);

// 3) Web Worker do terreno
const worldPath = path.join(root, "src", "world.js");
const world = fs.readFileSync(worldPath, "utf8");
fs.writeFileSync(worldPath, world.replace(/terrainWorker\.js(\?v=\d+)?"/, `terrainWorker.js?v=${version}"`));

console.log(`Cache atualizado: v${current} -> v${version} (${modules.length} módulos)`);
