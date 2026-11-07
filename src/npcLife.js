// ============================================================================
// npcLife.js — Vida social dos NPCs: perfis, humor, confiança, DIÁRIO e eventos dos dias.
//  - Cada NPC tem um perfil (idade, confiança no jogador, entradas de diário pessoais, falas recentes).
//  - Um gerador de eventos roda na virada do dia (qualquer salto de dia é processado em ordem):
//    dia 1 = luto e guerra; depois eles se acostumam; surgem doenças (com morte dias depois), boatos,
//    viajantes, escassez/colheita, brigas e pazes. NPCs reais, nomes reais.
//  - Motor de conversa: perguntas prontas, respostas por ofício/humor/confiança/fase/diário, sem repetir.
//  - Custo por frame ≈ 0: um timer de 1 s checa o dia; DOM só quando o menu abre.
// ============================================================================
import { getWorldSeed, getWorldChaos, worldRand } from "./worldgen.js";
import { portraitFor, visualKey } from "./npcPortrait.js";

const KEY = "rex-mundi-npclife";
const G = () => window.__game || {};

function fresh() {
  return {
    v: 1,
    day: 0,
    seeded: false,
    events: [], // { day, type, text, names, mood }
    dead: [], // { name, role, day, cause, village }
    sick: null, // { name, role, sinceDay, deathDay, cured }
    profiles: {}, // por nome
    flags: { shortageUntil: 0, fightPair: null, fightDay: 0, funeralFor: null, world: {} },
    player: { kills: 0, cures: 0, charity: 0, lastVictim: null, lastKillDay: 0, diary: [] },
    rumors: [],
  };
}

let state = fresh();
let env = { npcs: null, ui: null };
let _tick = 0;
let _coughTimer = 0;
let _saveTimer = 0;

// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// Eventos do mundo (mortos do dia 1, doença, boatos, brigas) usam um fluxo DETERMINÍSTICO por seed+dia (withWorldRng):
// o mesmo mundo conta a mesma história, e mundos diferentes contam histórias diferentes. Fora disso (falas, efeitos)
// continua Math.random, para a conversa não repetir.
let _evt = null;
const rnd = () => (_evt ? _evt() : Math.random());
function withWorldRng(tag, fn) {
  let a = (getWorldSeed() ^ Math.imul(tag | 0, 2654435761)) >>> 0;
  _evt = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    _evt = null;
  }
}
const choice = (arr) => arr[(rnd() * arr.length) | 0];
const day = () => G().WorldDecay?.daysPassed ?? 1;
const phaseOf = (d) => (d <= 2 ? "war" : d <= 6 ? "adapt" : "routine");

function saveSoon() {
  _saveTimer = 2;
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state, (k, v) => (k.startsWith("_") ? undefined : v)));
  } catch (_) {}
}

function allNPCs() {
  return env.npcs?.npcs || G().npcs?.npcs || [];
}
function findNPC(name) {
  const list = allNPCs();
  for (let i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
  return null;
}
function isCivilian(n) {
  if (!n || n.hostile || n.isBandit || n.temporary) return false;
  const rk = n.roleKey;
  if (!["guard", "smith", "merchant", "baker", "farmer", "villager", "priest", "beggar"].includes(rk)) return false;
  const ud = n.root?.userData || {};
  return !ud.isMissionDebtor && !ud.isBountyBoss;
}
function villageOf(n) {
  const places = placeList();
  let best = "Caldera";
  let bd = 1e9;
  for (const p of places.villages) {
    const d = (p.x - n.x) ** 2 + (p.z - n.z) ** 2;
    if (d < bd) { bd = d; best = p.name; }
  }
  return best;
}
function placeList() {
  const st = G().settlement;
  const villages = [{ name: "Caldera", x: -2, z: -20 }];
  if (st?.villages) for (const v of st.villages) if (v.village) villages.push({ name: v.village.name, x: v.village.x, z: v.village.z });
  const ghosts = (G().ActiveGhostTowns || []).map((t) => ({ name: t.name, x: t.center.x, z: t.center.z }));
  return { villages, ghosts };
}

// ---------------------------------------------------------------------------
// perfis
// ---------------------------------------------------------------------------
const AGE_RANGE = { baker: [30, 58], guard: [24, 48], smith: [34, 58], merchant: [32, 60], farmer: [26, 62], villager: [19, 54], priest: [48, 74], beggar: [44, 76] };
const BASE_TRUST = { baker: 30, guard: 22, smith: 14, merchant: 26, farmer: 24, villager: 24, priest: 34, beggar: 18 };

function profile(npc) {
  let p = state.profiles[npc.name];
  if (!p) {
    const h = hash(npc.name);
    const [a, b] = AGE_RANGE[npc.roleKey] || [22, 60];
    p = state.profiles[npc.name] = {
      age: a + (h % (b - a + 1)),
      trust: (BASE_TRUST[npc.roleKey] || 20) + (h % 9),
      base: ((h >> 5) % 41) / 100 - 0.2,
      diary: [], // entradas pessoais { day, kind, text }
      asked: {},
      recent: [],
      met: 0,
      lastTalkDay: 0,
      bio: null,
      flags: {},
      layerBoost: 0,
    };
  }
  return p;
}

function addDiary(npc, kind, text, mood = 0) {
  const p = profile(npc);
  p.diary.push({ day: day(), kind, text, mood });
  if (p.diary.length > 24) p.diary.shift();
}

const voiceOf = (npc) => visualKey(npc);

// ---------------------------------------------------------------------------
// humor, confiança
// ---------------------------------------------------------------------------
function trustEff(npc) {
  const p = profile(npc);
  const kills = state.player.kills;
  const evil = G().getEvilPercent?.() ?? 0;
  let t = p.trust + state.player.cures * 3 + state.player.charity * 1.5 - Math.min(35, kills * 6) - (evil > 60 ? (evil - 60) * 0.5 : 0);
  if (G().PlayerStats?.isTemplar && !G().PlayerStats?.hasBrokenVow) t += 8;
  return Math.max(0, Math.min(100, t));
}
export function trustLabel(t) {
  return t < 15 ? "Desconfiado" : t < 35 ? "Cauteloso" : t < 60 ? "Amistoso" : t < 85 ? "Confidente" : "Fiel a você";
}

function moodScore(npc) {
  const p = profile(npc);
  const d = day();
  let m = p.base + (phaseOf(d) === "war" ? -0.28 : phaseOf(d) === "adapt" ? -0.06 : 0.12);
  for (const ev of state.events) {
    const age = d - ev.day;
    if (age >= 0 && age <= 3) m += (ev.mood || 0) * (1 - age / 4) * 0.5;
  }
  for (const e of p.diary) {
    const age = d - e.day;
    if (age >= 0 && age <= 4) m += (e.mood || 0) * (1 - age / 5);
  }
  if (npc.sick) m -= 0.7;
  m += trustEff(npc) / 400;
  return Math.max(-1, Math.min(1, m));
}
function moodLabel(npc) {
  if (npc.sick) return "Doente";
  const m = moodScore(npc);
  const grief = profile(npc).diary.some((e) => e.kind === "grief" && day() - e.day <= 4);
  if (grief) return "De luto";
  if (m < -0.45) return "Abatido";
  if (m < -0.2) return "Preocupado";
  if (m < 0.05) return "Cansado";
  if (m < 0.3) return "Calmo";
  if (m < 0.55) return "Tranquilo";
  return "Animado";
}
function expression(npc) {
  if (npc.sick) return "sick";
  const l = moodLabel(npc);
  if (l === "Abatido" || l === "De luto" || l === "Preocupado") return "sad";
  if (l === "Animado" || l === "Tranquilo") return "happy";
  if (profile(npc).trust < 10 && (G().getEvilPercent?.() ?? 0) > 60) return "angry";
  return "neutral";
}

// ---------------------------------------------------------------------------
// eventos e diário do mundo
// ---------------------------------------------------------------------------
function pushEvent(type, text, names = [], mood = 0) {
  state.events.push({ day: day(), type, text, names, mood });
  if (state.events.length > 40) state.events.shift();
  for (const nm of names) {
    const n = findNPC(nm);
    if (n) addDiary(n, type, text, mood);
  }
  saveSoon();
}

const STORY_CAUSES = [
  "na escaramuça da ponte velha",
  "de fome, depois que a geada levou a colheita",
  "levado pelas tropas quando a guerra chegou à fronteira",
  "de uma febre que veio do sul junto com os refugiados",
  "tentando proteger o curral de uma matilha",
];

function killStory(npc, cause) {
  npc.noRespawn = true;
  npc.alive = false;
  npc.health = 0;
  npc.deadTime = 999;
  npc.root.userData.isDead = true;
  npc.root.visible = false;
  npc.hostile = false;
  try { npc.npcSystem?.spatialGrid?.remove(npc); } catch (_) {}
  state.dead.push({ name: npc.name, role: npc.roleKey, day: day(), cause, village: villageOf(npc) });
}

function seedDayOne() {
  withWorldRng(101, seedDayOneInner);
}
function seedDayOneInner() {
  state.seeded = true;
  const pool = allNPCs().filter((n) => n.alive && isCivilian(n) && ["farmer", "villager", "beggar"].includes(n.roleKey));
  // 2 mortos "de ontem" (reais): somem permanentemente
  for (let i = 0; i < 2 && pool.length > 4; i++) {
    const idx = (rnd() * pool.length) | 0;
    const npc = pool.splice(idx, 1)[0];
    const cause = STORY_CAUSES[(hash(npc.name) + i) % STORY_CAUSES.length];
    killStory(npc, cause);
    state.events.push({ day: 1, type: "death", text: `${npc.name} morreu ${cause}.`, names: [], mood: -0.6 });
  }
  state.events.push({ day: 1, type: "war", text: "A guerra no leste não dá trégua e os refugiados continuam chegando.", names: [], mood: -0.4 });
  state.events.push({ day: 1, type: "cult", text: "Dizem que homens de máscara branca rondam as estradas à noite.", names: [], mood: -0.3 });
  saveSoon();
}

function sickCandidates() {
  return allNPCs().filter((n) => n.alive && !n.sick && isCivilian(n) && ["farmer", "villager", "beggar", "merchant"].includes(n.roleKey));
}

const SICK_TASK = ["Tossindo, pálido de febre", "Febril, mal se aguentando em pé", "Acamado, respira com dificuldade"];

function applySick(npc, stage) {
  npc.sick = true;
  npc.task = SICK_TASK[Math.min(2, stage)];
  npc._sickTask = npc.task; // o wrapper de update do NPC mantém este texto no cartão
  if (npc._speedBase === undefined) npc._speedBase = npc.role.speed;
  npc.role.speed = npc._speedBase * (stage === 0 ? 0.7 : stage === 1 ? 0.5 : 0.28);
  try {
    npc.flashMaterials?.[0]?.color?.set(stage >= 1 ? "#8a9a72" : "#a8a07a");
  } catch (_) {}
}
function clearSick(npc) {
  npc.sick = false;
  npc._sickTask = null;
  if (npc._speedBase !== undefined) npc.role.speed = npc._speedBase;
  try {
    npc.flashMaterials?.[0]?.color?.set(npc.role.skin);
  } catch (_) {}
}

function startSickness(d) {
  const c = sickCandidates();
  if (!c.length) return;
  const npc = choice(c);
  state.sick = { name: npc.name, role: npc.roleKey, sinceDay: d, deathDay: d + 3, cured: false };
  applySick(npc, 0);
  pushEvent("sick", `${npc.name} começou a tossir sem parar e a cor sumiu do rosto.`, [npc.name], -0.3);
}

function progressSickness(d) {
  const s = state.sick;
  if (!s || s.cured) return;
  const npc = findNPC(s.name);
  const stage = d - s.sinceDay;
  if (!npc || !npc.alive) { state.sick = null; return; }
  if (d >= s.deathDay) {
    clearSick(npc);
    npc.noRespawn = true;
    npc._causeOverride = "da peste";
    const near = (G().player?.x - npc.x) ** 2 + (G().player?.z - npc.z) ** 2 < 28 * 28;
    if (near && npc.takeHit) npc.takeHit(99, 0, 0, 0.1, 0);
    else killStory(npc, "da peste");
    if (!state.dead.some((x) => x.name === npc.name)) state.dead.push({ name: npc.name, role: npc.roleKey, day: d, cause: "da peste", village: villageOf(npc) });
    pushEvent("death", `${npc.name} não resistiu e morreu da peste.`, [], -0.7);
    // vizinhos próximos entram em luto
    let n = 0;
    for (const o of allNPCs()) {
      if (n >= 3) break;
      if (o !== npc && o.alive && isCivilian(o) && (o.x - npc.x) ** 2 + (o.z - npc.z) ** 2 < 45 * 45) {
        addDiary(o, "grief", `${npc.name} morreu`, -0.6);
        n++;
      }
    }
    state.flags.funeralFor = { name: npc.name, day: d + 1 };
    state.sick = null;
  } else if (stage === 1) {
    applySick(npc, 1);
    pushEvent("sick", `${npc.name} piorou: a febre não cede e mal sai de casa.`, [npc.name], -0.35);
  } else if (stage === 2) {
    applySick(npc, 2);
    pushEvent("sick", `${npc.name} está de cama, os vizinhos dizem que não passa desta semana.`, [npc.name], -0.45);
  }
}

const FIGHT_REASONS = ["uma cerca derrubada", "uma dívida antiga", "um galo que fugiu e ninguém quer devolver", "quem enterrou o irmão primeiro", "a divisão do pouco que sobrou de lenha"];

function rollEvents(d) {
  const places = placeList();
  const pName = () => choice(places.villages).name;
  const gName = () => (places.ghosts.length ? choice(places.ghosts).name : pName());
  const recentTypes = new Set(state.events.filter((e) => d - e.day <= 1).map((e) => e.type));
  const options = [];

  options.push({ w: 3, f: () => pushEvent("cult", choice([`Fogueiras roxas foram vistas perto de ${gName()}.`, `Gente de máscara branca foi vista rondando ${pName()} depois do anoitecer.`, `Um pastor jura ter ouvido cantos estranhos vindos de ${gName()}.`]), [], -0.25) });
  options.push({ w: 2, f: () => pushEvent("traveler", `Chegou um viajante de ${pName()} contando de estradas tomadas por bandos armados.`, [], -0.1) });
  options.push({ w: 2, f: () => pushEvent("wolves", `Lobos rondaram o curral em ${pName()} esta noite.`, [], -0.25) });
  options.push({ w: 1, f: () => pushEvent("war", choice(["Veio notícia de que a guerra no leste ainda não acabou.", "Soldados feridos passaram pela estrada, não quiseram dizer de que lado vinham.", "Os impostos de guerra subiram de novo."]), [], -0.3) });
  if (d >= 3 && d >= state.flags.shortageUntil + 1) {
    options.push({ w: 3, f: () => { state.flags.shortageUntil = d + 2; pushEvent("shortage", "Faltam grãos e o preço do pão disparou.", [], -0.4); } });
  }
  if (state.flags.shortageUntil && d === state.flags.shortageUntil + 1) {
    options.unshift({ w: 99, f: () => pushEvent("harvest", "A colheita foi boa: o pão voltou à mesa, e tem gente rindo na praça.", [], 0.5) });
  }
  if (d >= 4) {
    options.push({ w: 2, f: () => pushEvent("birth", `Nasceu uma criança em ${pName()}, a primeira em meses, e o povo comentou até no mercado.`, [], 0.4) });
    options.push({ w: 1, f: () => pushEvent("hope", "Disseram que o rei talvez negocie a paz. Ninguém sabe se acredita.", [], 0.25) });
  }
  // briga entre dois NPCs reais próximos / paz depois
  if (state.flags.fightPair && d - state.flags.fightDay >= 2) {
    const [a, b] = state.flags.fightPair;
    state.flags.fightPair = null;
    options.unshift({ w: 99, f: () => pushEvent("peace", `${a} e ${b} fizeram as pazes diante de uma caneca de cerveja.`, [a, b], 0.3) });
  } else if (d >= 3 && !state.flags.fightPair) {
    const civ = allNPCs().filter((n) => n.alive && isCivilian(n) && ["farmer", "villager", "merchant", "smith"].includes(n.roleKey));
    if (civ.length > 3) {
      const a = choice(civ);
      const near = civ.filter((o) => o !== a && (o.x - a.x) ** 2 + (o.z - a.z) ** 2 < 40 * 40);
      if (near.length) {
        const b = choice(near);
        options.push({ w: 3, f: () => { state.flags.fightPair = [a.name, b.name]; state.flags.fightDay = d; pushEvent("fight", `${a.name} e ${b.name} brigaram por causa de ${choice(FIGHT_REASONS)}.`, [a.name, b.name], -0.25); } });
      }
    }
  }
  // sorteio ponderado, evita tipo repetido no mesmo dia
  const eligible = options.filter((o) => o.w >= 99 || !recentTypes.has("x"));
  const total = eligible.reduce((s, o) => s + o.w, 0);
  const pickOne = () => {
    let r = rnd() * total;
    for (const o of eligible) { r -= o.w; if (r <= 0) return o; }
    return eligible[0];
  };
  const forced = eligible.find((o) => o.w >= 99);
  (forced || pickOne()).f();
  if (!forced && d >= 2 && rnd() < 0.25 + 0.5 * getWorldChaos()) pickOne().f(); // caos: mais ou menos dias com 2 eventos
}

function maybeStartSickness(d) {
  if (state.sick) return;
  // CAOS: a primeira doença pode demorar até 3 dias a mais e as seguintes ficam mais (ou menos) frequentes
  const chaos = getWorldChaos();
  const firstDay = 2 + Math.floor(worldRand(6001) * chaos * 3);
  if (d === firstDay || (d > firstDay && rnd() < 0.15 + 0.3 * chaos)) startSickness(d);
}

function processDay(d) {
  withWorldRng(d * 7919 + 13, () => {
    progressSickness(d);
    maybeStartSickness(d);
    rollEvents(d);
  });
  // luto/esquecimento: entradas antigas saem
  for (const p of Object.values(state.profiles)) p.diary = p.diary.filter((e) => d - e.day <= 12);
  persist();
}

// ---------------------------------------------------------------------------
// motor de conversa
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// motor de conversa (o CONTEÚDO fica em npcStories.js, carregado sob demanda na 1ª conversa)
// ---------------------------------------------------------------------------
let Stories = null;
let _storiesPromise = null;
function loadStories() {
  if (Stories) return Promise.resolve(Stories);
  if (!_storiesPromise) _storiesPromise = import("./npcStories.js").then((m) => (Stories = m));
  return _storiesPromise;
}

// ganchos de seguimento da última fala (somem quando a conversa muda de rumo)
let _hooks = [];
const _hookData = new Map();

function recentNoRepeat(p, arr) {
  const free = arr.filter((s) => !p.recent.includes(s));
  const s = choice(free.length ? free : arr);
  p.recent.push(s);
  if (p.recent.length > 18) p.recent.shift();
  return s;
}

let _civCache = { t: 0, list: [] };
function civilians() {
  const now = performance.now();
  if (now - _civCache.t < 20000 && _civCache.list.length) return _civCache.list;
  _civCache = { t: now, list: allNPCs().filter((n) => n.alive && isCivilian(n)).map((n) => ({ name: n.name, role: n.roleKey, village: villageOf(n) })) };
  return _civCache.list;
}

function context(npc) {
  const d = day();
  const dn = G().dayNight;
  const t = trustEff(npc);
  const p = profile(npc);
  p.talks = p.met;
  const pl = G().PlayerStats || {};
  const player = G().player;
  const st = G().settlement;
  const hour = ((dn?.progress ?? 0.5) * 24) % 24;
  const bucket = Stories.timeBucket(hour);
  const fogLevel = Math.round(dn?._fogLevelF ?? dn?.fogLevel ?? 0);
  const sickOther = state.sick && !state.sick.cured && state.sick.name !== npc.name ? state.sick : null;
  const grief = p.diary.find((e) => e.kind === "grief" && d - e.day <= 4);
  const recentCult = state.events.some((e) => e.type === "cult" && d - e.day <= 2);
  const recentWolves = state.events.some((e) => e.type === "wolves" && d - e.day <= 1);
  const m = moodScore(npc);
  const night = bucket === "night" || bucket === "lateNight";
  const capital = (npc.x + 2) ** 2 + (npc.z + 20) ** 2 < 55 * 55;
  let nearChurch = false;
  if (st?.churches) for (const c of st.churches) if ((c.x - npc.x) ** 2 + (c.z - npc.z) ** 2 < 26 * 26) { nearChurch = true; break; }
  const gate = st?.gate;
  const nearGate = Boolean(gate && gate.x !== undefined && (gate.x - npc.x) ** 2 + (gate.z - npc.z) ** 2 < 24 * 24);
  let guardsNear = false;
  for (const o of allNPCs()) {
    if (o.roleKey === "guard" && o.alive && o !== npc && (o.x - npc.x) ** 2 + (o.z - npc.z) ** 2 < 25 * 25) { guardsNear = true; break; }
  }
  const wid = G().weapons?.currentId;
  const funeral = state.flags.funeralFor && d - state.flags.funeralFor.day <= 3 ? state.flags.funeralFor : null;
  const hungry = Boolean(state.flags.shortageUntil && d <= state.flags.shortageUntil && state.flags.shortageUntil >= 3);
  return {
    npc,
    p,
    k: voiceOf(npc),
    day: d,
    ph: phaseOf(d),
    hour,
    timeBucket: bucket,
    night,
    trust: t,
    evil: G().getEvilPercent?.() ?? 0,
    cha: pl.cha ?? 10,
    village: villageOf(npc),
    location: capital ? "capital" : "village",
    nearChurch,
    nearGate,
    guardsNear,
    dead: state.dead.filter((x) => d - x.day <= 7),
    sick: sickOther,
    sickOther,
    sickStage: state.sick ? d - state.sick.sinceDay : 0,
    selfSick: Boolean(npc.sick),
    events: state.events.slice(-4).reverse(),
    templar: Boolean(pl.isTemplar && !pl.hasBrokenVow),
    cultRobe: Boolean(pl.wearingDemiurgeRobe || player?.wearingDemiurgeAttire),
    wanted: Boolean(G().wantedLevel || G().npcs?.wantedTimer > 0),
    hurt: Boolean(player && player.health !== undefined && player.maxHealth && player.health / player.maxHealth <= 0.4),
    candle: Boolean(G().candle?.lit),
    mounted: Boolean(player?.mounted),
    armed: Boolean(wid && wid !== "fists" && wid !== "torch"),
    fogLevel,
    eclipse: Boolean(G().WorldDecay?.isEclipse),
    decay: G().WorldDecay?.decayLevel ?? 0,
    grief: Boolean(grief),
    griefData: grief ? { names: [grief.text.replace(/ morreu$/, "")] } : null,
    hungry,
    happy: m > 0.35 && !grief && !npc.sick,
    scared: Boolean((night && (fogLevel >= 3 || recentWolves || (recentCult && m < 0))) || (fogLevel >= 4 && m < 0.1)),
    cultNear: recentCult,
    mood: moodLabel(npc),
    funeral,
    ghostNames: placeList().ghosts.map((g) => g.name),
    civilians: civilians(),
    findNPC,
    say: (arr) => recentNoRepeat(p, arr),
    coins: G().player?.coins ?? 0,
    potions: G().player?.potions ?? 0,
    hay: G().PlayerInventory?.hay ?? 0,
    flagDays: (k) => (p.flags && p.flags[k] !== undefined ? d - p.flags[k] : null),
    wflagDays: (k) => (state.flags.world && state.flags.world[k] !== undefined ? d - state.flags.world[k] : null),
  };
}

function buildQuestions() {
  // hooks (seguimentos) primeiro; depois as perguntas naturais fixas; "Até logo" por último
  const q = _hooks.map((h) => ({ id: h.id, label: h.label }));
  for (const b of Stories.BASE_QUESTIONS) q.push(b);
  q.push({ id: "bye", label: "Até logo" });
  return q;
}

function setHooks(list) {
  _hooks = list || [];
  _hookData.clear();
  for (const h of _hooks) _hookData.set(h.id, h.data);
}

// ---------------------------------------------------------------------------
// OPÇÕES DE RESPOSTA: lista ativa da fala atual, testes de carisma e consequências persistentes
// ---------------------------------------------------------------------------
let _opts = [];
function setOptions(list) {
  _opts = list || [];
}
function optionQuestions() {
  const q = _opts.map((o, i) => ({ id: "o:" + i, label: o.label + (o.test ? ` [CAR ${o.test.cha}]` : ""), kind: "opt" }));
  q.push({ id: "o:ok", label: _opts.some((o) => o.test) ? "Mudar de assunto" : "Entendo.", kind: "neutral" });
  return q;
}
function currentQuestions() {
  return _opts.length ? optionQuestions() : buildQuestions();
}
const clamp100 = (v) => Math.max(0, Math.min(100, v));

function applyEffects(npc, fx, ctx) {
  const out = [];
  if (!fx) return out;
  const p = profile(npc);
  const pl = G().player;
  if (fx.trust) { p.trust = clamp100(p.trust + fx.trust); out.push(`Confiança ${fx.trust > 0 ? "+" : ""}${fx.trust}`); }
  if (fx.evil) { G().addEvil?.(fx.evil, "Diálogo"); out.push(`+${fx.evil}% Maldade`); }
  if (fx.good) { G().addGood?.(fx.good, "Diálogo"); out.push(`-${fx.good}% Maldade`); }
  if (fx.coins && pl) { pl.coins = Math.max(0, (pl.coins || 0) + fx.coins); out.push(`${fx.coins > 0 ? "+" : ""}${fx.coins} moedas`); }
  if (fx.items) {
    const inv = G().PlayerInventory;
    if (fx.items.hay && inv) { inv.hay = Math.max(0, (inv.hay || 0) + fx.items.hay); out.push(`${fx.items.hay > 0 ? "+" : ""}${fx.items.hay} feno`); }
    if (fx.items.potions && pl) { pl.potions = Math.max(0, (pl.potions || 0) + fx.items.potions); out.push(`${fx.items.potions > 0 ? "+" : ""}${fx.items.potions} poção`); }
    if (fx.items.candles && G().candle) { G().candle.count = Math.max(0, (G().candle.count || 0) + fx.items.candles); out.push(`${fx.items.candles > 0 ? "+" : ""}${fx.items.candles} vela`); }
  }
  if (fx.mood || fx.diary) addDiary(npc, "choice", fx.diary || "conversa marcante", fx.mood || 0);
  if (fx.diary) {
    state.player.diary.push({ day: day(), text: `${npc.name}: ${fx.diary}` });
    if (state.player.diary.length > 40) state.player.diary.shift();
  }
  if (fx.flag) p.flags[fx.flag] = day();
  if (fx.wflag) state.flags.world[fx.wflag] = day();
  if (fx.event === "cure_sick") {
    const target = npc.sick ? npc : state.sick ? findNPC(state.sick.name) : null;
    if (target) { NpcLife.onCured(target); out.push(`${target.name} curado(a)`); }
  } else if (fx.event && typeof fx.event === "object") {
    pushEvent(fx.event.type, fx.event.text, fx.event.names || [], fx.event.mood || 0);
  }
  if (fx.unlock) {
    if (fx.unlock.layer) { p.layerBoost = (p.layerBoost || 0) + 1; out.push("Ele(a) se abriu um pouco mais"); }
    if (fx.unlock.rumor) { state.rumors.push(fx.unlock.rumor); if (state.rumors.length > 20) state.rumors.shift(); pushEvent("rumor", fx.unlock.rumor, [], -0.1); out.push("Novo boato"); }
    if (fx.unlock.discount) { p.flags.discount = day(); out.push("Desconto conquistado"); }
  }
  return out;
}

function packResult(npc, r, forceEnd = false) {
  const p = profile(npc);
  const t = trustEff(npc);
  const expr = expression(npc);
  return {
    n: r.n || "",
    t: r.t || "",
    extra: r.extra || null,
    end: Boolean(forceEnd || r.end),
    silent: Boolean(r.silent),
    trust: t,
    trustLabel: trustLabel(t),
    mood: moodLabel(npc),
    portrait: portraitFor(npc, expr, p.age),
    questions: currentQuestions(),
  };
}

function chooseOption(npc, qid) {
  if (qid === "o:ok") {
    setOptions([]);
    setHooks([]);
    return packResult(npc, { silent: true });
  }
  const opt = _opts[Number(qid.slice(2))];
  if (!opt) { setOptions([]); return packResult(npc, { silent: true }); }
  const ctx = context(npc);
  let branch = opt;
  let note = "";
  if (opt.test) {
    const chance = Math.max(0.05, Math.min(0.95, 0.5 + (ctx.cha - opt.test.cha) * 0.07));
    const ok = rnd() < chance;
    branch = ok ? opt.test.onSuccess : opt.test.onFail;
    note = ok ? "[Teste de Carisma: sucesso]" : "[Teste de Carisma: falhou]";
  }
  const reply = Array.isArray(branch.reply) ? choice(branch.reply) : branch.reply;
  const bits = applyEffects(npc, branch.effects || opt.effects, ctx);
  if (bits.length) G().ui?.showToast?.(bits.join(" · "), 3500);
  state.player.diary.push({ day: day(), text: `${npc.name}: "${opt.label}"` });
  if (state.player.diary.length > 40) state.player.diary.shift();
  setOptions([]);
  setHooks([]);
  let extra = null;
  const nextId = branch.next || opt.next;
  const endNow = Boolean(branch.effects?.end || opt.effects?.end || branch.end || opt.end);
  if (nextId && !endNow) {
    const c2 = context(npc);
    const line = Stories.lineById(nextId, c2);
    if (line) {
      extra = { n: line.n || "", t: line.t };
      setOptions(Stories.filterOptions(c2, line.options || []));
    }
  }
  saveSoon();
  return packResult(npc, { n: note || (reply ? "" : ""), t: reply || "", extra, end: endNow });
}

export const NpcLife = {
  start({ npcs, ui, hasSave }) {
    env = { npcs, ui };
    if (hasSave) {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s && s.v === 1) state = Object.assign(fresh(), s);
        }
      } catch (_) {}
      // reaplica mortos permanentes e doente ativo
      for (const dd of state.dead) {
        const n = findNPC(dd.name);
        if (n && n.alive) killStory(n, dd.cause), state.dead.pop();
      }
      const s = state.sick;
      if (s && !s.cured) {
        const n = findNPC(s.name);
        if (n) applySick(n, Math.min(2, day() - s.sinceDay));
      }
    } else {
      state = fresh();
      try { localStorage.removeItem(KEY); } catch (_) {}
    }
    state.day = state.day || day();
    if (!state.seeded) seedDayOne();
    persist();
  },

  update(dt) {
    _tick -= dt;
    if (_saveTimer > 0) { _saveTimer -= dt; if (_saveTimer <= 0) persist(); }
    // tosse de quem está doente (baratíssimo: só perto do jogador e a cada ~5 s)
    _coughTimer -= dt;
    if (_coughTimer <= 0) {
      _coughTimer = 4.5 + rnd() * 2;
      const s = state.sick;
      const n = s && !s.cured ? findNPC(s.name) : null;
      const pl = G().player;
      if (n && n.alive && pl && (n.x - pl.x) ** 2 + (n.z - pl.z) ** 2 < 16 * 16) {
        G().effects?.play?.("smoke", n.x, (n.root?.position?.y ?? 0) + 1.5, n.z, "#cfd8b0", 0.4);
        G().audio?.pain && rnd() < 0.2 && G().audio.pain();
      }
    }
    if (_tick > 0) return;
    _tick = 1;
    const d = day();
    if (d > state.day) {
      const from = Math.max(state.day + 1, d - 10);
      for (let x = from; x <= d; x++) {
        state.day = x;
        processDay(x);
      }
      state.day = d;
    }
  },

  loadStories,
  get storiesReady() { return Boolean(Stories); },

  // abre a conversa: retorna os dados de cabeçalho, saudação e perguntas (exige loadStories() concluído)
  chatMeta(npc) {
    const p = profile(npc);
    p.met = (p.met || 0) + 1;
    setHooks([]);
    const ctx = context(npc);
    const first = Stories.greeting(ctx);
    setOptions(Stories.filterOptions(ctx, first.options || []));
    const expr = expression(npc);
    const t = trustEff(npc);
    return {
      age: p.age,
      mood: moodLabel(npc),
      expr,
      trust: t,
      trustLabel: trustLabel(t),
      portrait: portraitFor(npc, expr, p.age),
      greeting: first,
      questions: currentQuestions(),
    };
  },
  ask(npc, qid) {
    if (qid.startsWith("o:")) return chooseOption(npc, qid);
    const p = profile(npc);
    const ctx = context(npc);
    const data = _hookData.get(qid);
    const r = Stories.replyTo(ctx, qid, data);
    // confiança: 1ª vez em cada pergunta/gancho rende mais; biografia desbloqueada rende bônus
    const key = qid.startsWith("h:") ? qid : qid;
    if (qid !== "bye") {
      if (!p.asked[key]) { p.asked[key] = 1; p.trust = Math.min(100, p.trust + (qid.startsWith("h:") ? 2 : 3)); }
      else if (rnd() < 0.25) p.trust = Math.min(100, p.trust + 0.4);
      if (r.trustBonus) p.trust = Math.min(100, p.trust + r.trustBonus);
    } else p.trust = Math.min(100, p.trust + 1);
    p.lastTalkDay = ctx.day;
    const opts = qid === "bye" ? [] : Stories.filterOptions(ctx, r.options || []);
    setOptions(opts);
    setHooks(qid === "bye" || opts.length ? [] : Stories.makeHooks(ctx, r.topics || []));
    saveSoon();
    const res = packResult(npc, r);
    if (qid === "bye") res.questions = buildQuestions().slice(-1);
    return res;
  },
  // estado atual do cabeçalho (sem saudação): humor, confiança, retrato e perguntas
  status(npc) {
    const p = profile(npc);
    const t = trustEff(npc);
    const expr = expression(npc);
    return { age: p.age, mood: moodLabel(npc), expr, trust: t, trustLabel: trustLabel(t), portrait: portraitFor(npc, expr, p.age), questions: Stories ? currentQuestions() : [] };
  },
  // falas ANTIGAS (interactions.js): se o texto for reconhecido, ganham opções próprias
  optionsForText(npc, text) {
    if (!Stories || !text) { setOptions([]); return null; }
    const ctx = context(npc);
    const opts = Stories.filterOptions(ctx, Stories.optionsForText(ctx, text) || []);
    setOptions(opts);
    if (opts.length) setHooks([]);
    return opts.length ? optionQuestions() : null;
  },
  discountMult(npc) {
    const p = npc ? state.profiles[npc.name] : null;
    return p?.flags?.discount !== undefined && day() - p.flags.discount <= 12 ? 0.88 : 1;
  },
  hasFlag(npc, key) { return Boolean(state.profiles[npc?.name]?.flags?.[key] !== undefined); },
  portrait(npc) {
    return portraitFor(npc, expression(npc), profile(npc).age);
  },

  // ganchos
  onNPCKilled(npc) {
    if (!npc || state.dead.some((x) => x.name === npc.name && x.day === day())) return;
    const cause = npc._causeOverride || "pela violência";
    state.dead.push({ name: npc.name, role: npc.roleKey, day: day(), cause, village: villageOf(npc) });
    if (state.sick && state.sick.name === npc.name) state.sick = null;
    if (isCivilian(npc) && !npc._causeOverride) {
      pushEvent("death", `${npc.name} foi encontrado morto.`, [], -0.5);
      let n = 0;
      for (const o of allNPCs()) {
        if (n >= 2) break;
        if (o !== npc && o.alive && isCivilian(o) && (o.x - npc.x) ** 2 + (o.z - npc.z) ** 2 < 40 * 40) { addDiary(o, "grief", `${npc.name} morreu`, -0.4); n++; }
      }
    }
    saveSoon();
  },
  onPlayerKilled(npc) {
    state.player.kills++;
    state.player.lastVictim = npc?.name || null;
    state.player.lastKillDay = day();
    if (npc) {
      const d = state.dead.find((x) => x.name === npc.name);
      if (d) d.cause = "pelas mãos de um forasteiro";
      else state.dead.push({ name: npc.name, role: npc.roleKey, day: day(), cause: "pelas mãos de um forasteiro", village: villageOf(npc) });
    }
    saveSoon();
  },
  onCured(npc) {
    clearSick(npc);
    if (state.sick && state.sick.name === npc.name) state.sick.cured = true, state.sick = null;
    state.player.cures++;
    profile(npc).flags.curedMe = day();
    state.flags.world.curedSomeone = day();
    addDiary(npc, "cured", "o viajante me curou", 0.8);
    pushEvent("cured", `${npc.name} se recuperou da peste graças a um forasteiro generoso.`, [], 0.4);
    const p = profile(npc);
    p.trust = Math.min(100, p.trust + 25);
  },
  onPlayerHelped() {
    state.player.charity++;
    saveSoon();
  },
  // Doação de comida (pão/maçã): confiança, diário do NPC e fofoca dos vizinhos. Devolve true na 1ª doação do dia
  // para aquela pessoa (só aí conta como caridade e bondade: sem exploit).
  onDonated(npc, kind) {
    if (!npc) return false;
    const p = profile(npc);
    const first = p.flags.donatedDay !== day();
    p.flags.donatedDay = day();
    p.trust = Math.min(100, p.trust + (first ? 4 : 1));
    addDiary(npc, "donated", kind === "bread" ? "me deu um pão" : "me deu uma maçã", 0.5);
    if (first) {
      state.player.charity++;
      let n = 0;
      for (const o of allNPCs()) {
        if (n >= 2) break;
        if (o !== npc && o.alive && isCivilian(o) && (o.x - npc.x) ** 2 + (o.z - npc.z) ** 2 < 30 * 30) {
          addDiary(o, "gossip", `viu o forasteiro dividir comida com ${npc.name}`, 0.2);
          n++;
        }
      }
    }
    saveSoon();
    return first;
  },
  getState: () => state,
  trustLabel,
};

export default NpcLife;
