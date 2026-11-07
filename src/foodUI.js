// ============================================================================
// foodUI.js — Alforje (inventário de pão e maçã): painel plano, comer (só o ato) e doar.
//   Tab      abre/fecha o painel (ESC também fecha; nenhuma tecla de letra: P,O,T,A,H,I,E,F,S,C são dos códigos de cheat). Com ele aberto: 1 = comer pão, 2 = comer maçã,
//            Shift+1 / Shift+2 = doar pão / maçã. O mundo congela e o personagem fica travado enquanto aberto.
//   Comer    fecha o painel e o personagem leva o item à boca (animação em player.js, ~1,5 s). Sem efeito
//            (EAT_HEAL = 0 em rpg.js; mude para 1 e comer passa a curar).
//   Doar     dá 1 item ao NPC mais próximo (pedinte tem prioridade) ou à caixa de ofertas da igreja: confiança,
//            um pouco de bondade (1x por pessoa/dia, sem exploit) e registro no diário para os vizinhos comentarem.
// O DOM só é criado na primeira abertura.
// ============================================================================
import { PlayerInventory, FOOD_CAP, FOOD_NAMES, EAT_HEAL, addGood } from "./rpg.js";
import { NpcLife } from "./npcLife.js";
import { WorldDecay } from "./decay.js";

const NON_TALKERS = new Set(["blind_biter", "tall_walker", "gulur", "necron", "hexoculus", "polyphonia", "cult_leader", "cultist"]);
const CSS = `
#food-panel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:10002;font:17px/1.55 system-ui,"Segoe UI",sans-serif;color:#e8e2d6}
#food-panel.open{display:flex}
#food-panel .fp-box{background:#15110f;border:1px solid #4a423a;padding:20px 24px 16px;width:min(440px,92vw)}
#food-panel h2{margin:0 0 4px;font-size:22px;font-weight:600;color:#fff}
#food-panel .fp-res{font-size:14px;color:#a89f90;margin:0 0 14px}
#food-panel .fp-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #2e2823}
#food-panel .fp-name{flex:1;font-size:18px}
#food-panel .fp-count{min-width:44px;text-align:right;color:#d9c9a3;font-variant-numeric:tabular-nums}
#food-panel button{background:#2a2420;color:#e8e2d6;border:1px solid #5a5046;padding:6px 14px;font:inherit;font-size:16px;cursor:pointer;border-radius:0}
#food-panel button:hover:not(:disabled){background:#3b322b}
#food-panel button:disabled{opacity:.35;cursor:default}
#food-panel .fp-hint{margin:12px 0 0;font-size:13px;color:#8d8475}
`;

let panel = null;
let open = false;
let lockedInput = false;
let prevModal = false;
const donatedToday = new Map(); // "chave" -> dia (um pouco de bondade por pessoa/dia)

const G = () => window.__game;
const day = () => WorldDecay?.daysPassed ?? 1;

export function isFoodPanelOpen() {
  return open;
}

function ensureDOM() {
  if (panel) return;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  panel = document.createElement("div");
  panel.id = "food-panel";
  panel.innerHTML = `<div class="fp-box">
    <h2>Alforje</h2>
    <p class="fp-res" id="fp-res"></p>
    <div class="fp-row" data-kind="bread"><span class="fp-name">Pão</span><span class="fp-count"></span><button data-act="eat">Comer</button><button data-act="give">Doar</button></div>
    <div class="fp-row" data-kind="apple"><span class="fp-name">Maçã</span><span class="fp-count"></span><button data-act="eat">Comer</button><button data-act="give">Doar</button></div>
    <p class="fp-hint">1 comer pão · 2 comer maçã · Shift+1 / Shift+2 doar · Tab ou ESC fecha</p>
  </div>`;
  document.body.appendChild(panel);
  panel.addEventListener("mousedown", (e) => { if (e.target === panel) closeFoodPanel(); });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const kind = b.closest(".fp-row").dataset.kind;
    if (b.dataset.act === "eat") eat(kind);
    else donate(kind);
  });
}

function render() {
  const f = PlayerInventory.food || (PlayerInventory.food = { bread: 0, apple: 0 });
  for (const row of panel.querySelectorAll(".fp-row")) {
    const n = f[row.dataset.kind] || 0;
    row.querySelector(".fp-count").textContent = `×${n}`;
    for (const b of row.querySelectorAll("button")) b.disabled = n <= 0;
  }
  const i = PlayerInventory;
  panel.querySelector("#fp-res").textContent = `Moedas ${G()?.player?.coins ?? 0} · Madeira ${i.wood} · Pedra ${i.stone} · Argila ${i.clay || 0} · Feno ${i.hay} · Tochas ${i.torches} · limite ${FOOD_CAP} de cada comida`;
}

function canOpen() {
  const g = G();
  if (!g || !g.player || g.player.dead || g.player.eating) return false;
  if (g.GameState?.isIntroPlaying || g.pause?.open) return false;
  if (g.ui?.dialoguePanel && !g.ui.dialoguePanel.hidden) return false;
  if (document.body.classList.contains("clean-screen")) return false;
  return true;
}

export function openFoodPanel() {
  if (open || !canOpen()) return;
  ensureDOM();
  render();
  panel.classList.add("open");
  open = true;
  const input = G().input;
  if (input?.setModalOpen && !lockedInput) {
    prevModal = Boolean(input.modalOpen);
    input.setModalOpen(true); // trava o personagem (o main.js congela o tempo enquanto isFoodPanelOpen())
    lockedInput = true;
  }
  if (document.pointerLockElement) document.exitPointerLock();
}

export function closeFoodPanel() {
  if (!open) return;
  open = false;
  panel?.classList.remove("open");
  if (lockedInput) {
    lockedInput = false;
    G()?.input?.setModalOpen?.(prevModal);
  }
}

// ---------------------------------------------------------------------------
// Comer
// ---------------------------------------------------------------------------
function eat(kind) {
  const g = G();
  const f = PlayerInventory.food;
  if (!f || (f[kind] || 0) <= 0) {
    g.ui?.showToast?.(`Sem ${FOOD_NAMES[kind].toLowerCase()} no alforje.`, 2500);
    return;
  }
  closeFoodPanel(); // a animação roda com o tempo andando
  if (!g.player.startEating(kind)) {
    g.ui?.showToast?.("Agora não dá para comer.", 2200);
    return;
  }
  f[kind]--;
  if (EAT_HEAL > 0) g.player.health = Math.min(g.player.maxHealth, g.player.health + EAT_HEAL);
}

// ---------------------------------------------------------------------------
// Doar
// ---------------------------------------------------------------------------
const THANKS = {
  beggar: [
    "Deus lhe pague, forasteiro! Faz dois dias que só bebo orvalho.",
    "Ah... isso é mais do que muita gente rica me deu na vida.",
    "Você tem um coração bom. Raro por aqui, sabia?",
  ],
  smith: ["Hm. Obrigada.", "Não precisava. ...Mas eu aceito.", "Boa. O fole não perdoa estômago vazio."],
  merchant: ["Ora, que gentileza! Vou lembrar disso no próximo preço.", "Generoso! Os bons clientes são assim.", "Hah! Não costumo ganhar, só vender. Obrigado!"],
  farmer: ["Que Deus abençoe sua mão. A terra anda difícil.", "Obrigada, de coração. Posso retribuir com um dia de sol?", "Ah, que bom. Fruta de colheita não sobra por aqui."],
  priest: ["Que o céu o recompense, meu filho.", "A caridade é a única oração que sempre chega.", "Abençoado seja. Rezarei por você esta noite."],
  guard: ["...Obrigado. Não é todo dia que alguém lembra de quem vigia.", "Hm. Aceito. Fica entre nós.", "Boa. Turnos longos esvaziam qualquer um."],
  baker: ["Dando comida a um padeiro? Hah! Obrigado mesmo assim.", "Isso é raro: alguém me dando pão. Valeu!", "Que gentil. Mas fica o convite: o forno está sempre aceso."],
  default: ["Obrigado. De verdade.", "Que gentileza a sua!", "Ah... obrigado. Hoje eu precisava disso.", "Deus o guarde, forasteiro."],
};

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

function findDonee() {
  const g = G();
  const p = g.player;
  let best = null;
  let bestScore = 3.8 * 3.8;
  const list = g.npcs?.npcs || [];
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (!n.alive || n.temporary || n.hostile || NON_TALKERS.has(n.roleKey) || n.root?.userData?.isSleeping) continue;
    const dx = n.x - p.x;
    const dz = n.z - p.z;
    const score = (dx * dx + dz * dz) * (n.roleKey === "beggar" ? 0.4 : 1); // pedinte tem prioridade
    if (score < bestScore) { bestScore = score; best = n; }
  }
  if (best) return { npc: best };
  for (const ch of g.settlement?.churches || []) {
    const ob = ch.offeringBox;
    if (!ob) continue;
    const dx = ob.x - p.x;
    const dz = ob.z - p.z;
    if (dx * dx + dz * dz < 3.6 * 3.6) return { church: ch };
  }
  return null;
}

function donate(kind) {
  const g = G();
  const f = PlayerInventory.food;
  const name = FOOD_NAMES[kind].toLowerCase();
  if (!f || (f[kind] || 0) <= 0) {
    g.ui?.showToast?.(`Sem ${name} no alforje.`, 2500);
    return;
  }
  const target = findDonee();
  if (!target) {
    g.ui?.showToast?.("Ninguém por perto para receber. Chegue perto de alguém ou da caixa de ofertas da igreja.", 3500);
    return;
  }
  f[kind]--;
  g.audio?.coin?.();
  if (target.npc) {
    const npc = target.npc;
    const first = NpcLife.onDonated?.(npc, kind) ?? false;
    const key = `npc:${npc.name}`;
    if (donatedToday.get(key) !== day()) {
      donatedToday.set(key, day());
      addGood(1, "Caridade com comida");
    }
    if (npc.roleKey === "beggar" && first) {
      npc.root.userData.state = "CHEERING"; // o pedinte comemora (animação que já existe)
      npc.cheeringTimer = 6;
      npc.root.userData.hasReceivedAlms = true;
    }
    const line = pick(THANKS[npc.roleKey] || THANKS.default);
    g.ui?.showToast?.(`${npc.name}: «${line}»`, 5000);
  } else {
    const key = `church:${target.church.id || target.church.name}`;
    if (donatedToday.get(key) !== day()) {
      donatedToday.set(key, day());
      addGood(1, "Oferta à igreja");
    }
    NpcLife.onPlayerHelped?.();
    g.ui?.showToast?.(`Você deixou ${kind === "bread" ? "um pão" : "uma maçã"} na caixa de ofertas da ${target.church.name || "igreja"}.`, 4000);
  }
  render();
}

// ---------------------------------------------------------------------------
// Teclas (fase de captura: valem com o painel aberto e não vazam para o resto do jogo)
// ---------------------------------------------------------------------------
let bound = false;
export function initFoodUI() {
  if (bound) return;
  bound = true;
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (open) {
      if (e.code === "Escape" || e.code === "Tab") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) closeFoodPanel();
        return;
      }
      const kind = e.code === "Digit1" || e.code === "Numpad1" ? "bread" : e.code === "Digit2" || e.code === "Numpad2" ? "apple" : null;
      if (kind) {
        e.preventDefault();
        e.stopImmediatePropagation(); // não troca de arma por baixo do painel
        if (e.repeat) return;
        if (e.shiftKey) donate(kind);
        else eat(kind);
      }
      return;
    }
    if (e.code === "Tab") {
      e.preventDefault(); // não deixa o Tab mudar o foco do navegador
      if (!e.repeat) openFoodPanel();
    }
  }, true);
}
