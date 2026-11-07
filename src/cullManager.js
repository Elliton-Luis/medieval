// ============================================================================
// Culling por distância de grupos ESTÁTICOS grandes (vilas abandonadas, plantações...).
// Além da névoa (~240 m) nada disso é visível, mas o three ainda percorria milhares de meshes por frame
// (projectObject, frustum e passada de sombra). Aqui o grupo inteiro é desligado e religado com histerese.
// Custo: uma checagem de distância por grupo a cada 0.3 s.
// ============================================================================
const entries = [];
let _timer = 0;
let _fogVis = 260;

/** Limite dinâmico vindo da névoa: nada além dessa distância precisa ser desenhado. */
export function setFogCull(vis) {
  _fogVis = vis;
}

/** Registra um grupo estático. (x, z) = centro no mundo, radius = raio que o envolve. */
export function registerCullable(obj, x, z, radius, maxDist = 240) {
  entries.push({ obj, x, z, radius, maxDist, shown: true });
}

export function updateCulling(px, pz, dt, force = false) {
  _timer -= dt;
  if (_timer > 0 && !force) return;
  _timer = 0.3;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const dx = e.x - px;
    const dz = e.z - pz;
    const limit = Math.min(e.maxDist, _fogVis + 30) + e.radius + (e.shown ? 12 : 0); // histerese de 12 m
    const show = dx * dx + dz * dz < limit * limit;
    if (show !== e.shown) {
      e.shown = show;
      e.obj.visible = show;
    }
  }
}
