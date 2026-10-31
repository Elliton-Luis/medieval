// Combate corpo a corpo justo: "fichas de ataque" (no máximo 2 inimigos atacam ao mesmo tempo),
// preparação visível (wind-up de 0,4 a 0,6 s), recarga aleatória, cerco a ~3,6 m andando de lado,
// separação entre inimigos e recuo depois do golpe. Usado por guardas, soldados e cavaleiros a pé.
export const MAX_ATTACKERS = 2;
const RING = 3.6;

const tokens = new Set();
const env = { npcs: null, combat: null, effects: null };
const out = { mx: 0, mz: 0, speed: 0 };
const sep = { x: 0, z: 0 };

export function setMeleeEnv(value) {
  Object.assign(env, value);
}

export function requestToken(entity) {
  if (tokens.has(entity)) return true;
  if (tokens.size >= MAX_ATTACKERS) return false;
  tokens.add(entity);
  return true;
}

export function releaseToken(entity) {
  tokens.delete(entity);
}

export function clearTokens() {
  tokens.clear();
}

export function attackerCount() {
  return tokens.size;
}

// Quem morreu, sumiu ou parou de caçar perde a ficha.
export function pruneTokens() {
  for (const e of tokens) {
    if (!e.alive || e.removed || e.mode !== "hunt") tokens.delete(e);
  }
}

// Empurra para longe de aliados e do jogador (steering de separação).
export function separation(e, px, pz) {
  sep.x = 0;
  sep.z = 0;
  const list = env.npcs ? env.npcs.npcs : [];
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o === e || !o.alive || o.removed || o.roleKey === "horse" || !(o.hostile || o.roleKey === "guard")) continue;
    const dx = e.x - o.x;
    const dz = e.z - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 1.6 * 1.6 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const w = (1.6 - d) / 1.6;
    sep.x += (dx / d) * w * 1.4;
    sep.z += (dz / d) * w * 1.4;
    // sobreposição: afasta na hora, metade cada um (ninguém atravessa o outro)
    if (d < 0.85) {
      const fix = (0.85 - d) * 0.5;
      e.x += (dx / d) * fix;
      e.z += (dz / d) * fix;
    }
  }
  const dx = e.x - px;
  const dz = e.z - pz;
  const d2 = dx * dx + dz * dz;
  if (d2 < 1.15 * 1.15 && d2 > 1e-6) {
    const d = Math.sqrt(d2);
    sep.x += (dx / d) * 1.2;
    sep.z += (dz / d) * 1.2;
  }
  return sep;
}

function brain(e) {
  if (!e.m) e.m = { state: "ring", t: 0, cd: 0.6 + Math.random() * 1.2, side: Math.random() < 0.5 ? -1 : 1, sideT: 1 + Math.random() * 2, len: 0.5, glow: false };
  return e.m;
}

// Decide o movimento do inimigo (mx, mz unitários e speed em 0..1 da velocidade dele).
export function meleeThink(e, dt, px, pz) {
  const m = brain(e);
  const dx = px - e.x;
  const dz = pz - e.z;
  const d = Math.max(0.001, Math.hypot(dx, dz));
  const nx = dx / d;
  const nz = dz / d;
  const reach = e.meleeRange || 1.9;
  let mx = 0;
  let mz = 0;
  let speed = 0;
  e.meleeWind = 0;

  switch (m.state) {
    case "ring": {
      m.cd -= dt;
      if (m.cd <= 0 && requestToken(e)) {
        m.state = "approach";
        m.t = 0;
        break;
      }
      // espera a vez a 3-4 m, andando de lado
      if (d > RING + 1.1) {
        mx = nx; mz = nz; speed = 1;
      } else if (d < RING - 0.9) {
        mx = -nx; mz = -nz; speed = 0.7;
      } else {
        m.sideT -= dt;
        if (m.sideT <= 0) {
          m.sideT = 1.8 + Math.random() * 2.2;
          m.side = -m.side;
        }
        mx = -nz * m.side; mz = nx * m.side; speed = 0.45;
      }
      break;
    }
    case "approach":
      m.t += dt;
      mx = nx; mz = nz; speed = 1;
      if (d <= reach * 0.9) {
        m.state = "windup";
        m.t = 0;
        m.len = 0.4 + Math.random() * 0.2;
        m.glow = false;
        if (env.effects) env.effects.play("glint", e.x + nx * 0.9, e.root.position.y + 1.95, e.z + nz * 0.9, "#fff0b0", 0.75);
      } else if (m.t > 4.5) {
        releaseToken(e);
        m.state = "ring";
        m.cd = 1;
      }
      break;
    case "windup": {
      m.t += dt;
      e.meleeWind = Math.min(1, m.t / m.len);
      if (!m.glow && e.meleeWind > 0.7 && env.effects) {
        m.glow = true;
        env.effects.play("glint", e.x + nx * 1.0, e.root.position.y + 1.9, e.z + nz * 1.0, "#ffe08a", 1.0);
      }
      if (m.t >= m.len) m.state = "strike";
      break;
    }
    case "strike": {
      // o golpe sai agora; o jogador ainda pode estar fora de alcance, de costas ou rolando
      if (d <= reach + 0.6 && env.combat) {
        env.combat.hurtPlayer(e.meleeDamage || 1, e.x, e.z, { knock: 3.4, weapon: "blade" });
      }
      e.swingTimer = 0.3;
      e.meleeWind = 0;
      m.state = "recover";
      m.t = 0;
      break;
    }
    default: // recover: recua um passo e solta a ficha
      m.t += dt;
      if (m.t < 0.5) {
        mx = -nx; mz = -nz; speed = 1.1;
      }
      if (m.t >= 0.65) {
        releaseToken(e);
        m.state = "ring";
        m.cd = 1.2 + Math.random() * 0.8;
      }
  }

  // separação: não gruda em aliados nem no jogador
  const s = separation(e, px, pz);
  mx = mx * speed + s.x * 0.9;
  mz = mz * speed + s.z * 0.9;
  const len = Math.hypot(mx, mz);
  if (len > 1e-4) {
    out.speed = Math.min(1.2, len);
    out.mx = mx / len;
    out.mz = mz / len;
  } else {
    out.speed = 0;
    out.mx = 0;
    out.mz = 0;
  }
  return out;
}
