// ============================================================================
// npcLife.js — Vida social dos NPCs: perfis, humor, confiança, DIÁRIO e eventos dos dias.
//  - Cada NPC tem um perfil (idade, confiança no jogador, entradas de diário pessoais, falas recentes).
//  - Um gerador de eventos roda na virada do dia (qualquer salto de dia é processado em ordem):
//    dia 1 = luto e guerra; depois eles se acostumam; surgem doenças (com morte dias depois), boatos,
//    viajantes, escassez/colheita, brigas e pazes. NPCs reais, nomes reais.
//  - Motor de conversa: perguntas prontas, respostas por ofício/humor/confiança/fase/diário, sem repetir.
//  - Custo por frame ≈ 0: um timer de 1 s checa o dia; DOM só quando o menu abre.
// ============================================================================
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
    flags: { shortageUntil: 0, fightPair: null, fightDay: 0, funeralFor: null },
    player: { kills: 0, cures: 0, charity: 0, lastVictim: null, lastKillDay: 0 },
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
const rnd = Math.random;
const choice = (arr) => arr[(rnd() * arr.length) | 0];
const day = () => G().WorldDecay?.daysPassed ?? 1;
const phaseOf = (d) => (d <= 2 ? "war" : d <= 6 ? "adapt" : "routine");

function saveSoon() {
  _saveTimer = 2;
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
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
  if (!["guard", "smith", "merchant", "farmer", "villager", "priest", "beggar"].includes(rk)) return false;
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
const AGE_RANGE = { guard: [24, 48], smith: [34, 58], merchant: [32, 60], farmer: [26, 62], villager: [19, 54], priest: [48, 74], beggar: [44, 76] };
const BASE_TRUST = { guard: 22, smith: 14, merchant: 26, farmer: 24, villager: 24, priest: 34, beggar: 18 };

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
  if (!forced && d >= 2 && rnd() < 0.4) pickOne().f();
}

function maybeStartSickness(d) {
  if (state.sick) return;
  if (d === 2 || (d > 2 && rnd() < 0.3)) startSickness(d);
}

function processDay(d) {
  progressSickness(d);
  maybeStartSickness(d);
  rollEvents(d);
  // luto/esquecimento: entradas antigas saem
  for (const p of Object.values(state.profiles)) p.diary = p.diary.filter((e) => d - e.day <= 12);
  persist();
}

// ---------------------------------------------------------------------------
// motor de conversa
// ---------------------------------------------------------------------------
const GESTURE = {
  guard: ["*ajeita o elmo e confere o portão com o canto do olho*", "*apoia a lança no chão, cansado*", "*olha para os lados antes de falar*"],
  smith: ["*bate a mão suja de fuligem no avental*", "*não tira os olhos do ferro em brasa*", "*seca o suor com o antebraço*"],
  merchant: ["*abre os braços como quem apresenta a mercadoria*", "*conta moedas sem perceber que faz isso*", "*sorri largo, mas os olhos medem você*"],
  farmer: ["*limpa a terra das mãos no avental*", "*olha o céu antes de responder*", "*mastiga uma haste de trigo*"],
  messenger: ["*mexe os pés, com pressa*", "*olha para a estrada*", "*ajeita a bolsa de cartas*"],
  commoner: ["*enxuga a testa com a manga*", "*encolhe os ombros*", "*abaixa a voz*"],
  priest: ["*junta as mãos e inclina a cabeça com ternura*", "*toca o crucifixo no peito*", "*sorri com cansaço bondoso*"],
  beggar: ["*estende a mão, depois a recolhe com um sorriso torto*", "*coça a barba rala, avaliando você*", "*pisca um olho, esperto*"],
};
const SICK_GESTURE = ["*tosse forte e cobre a boca com o pano*", "*se apoia na parede, suando frio*", "*respira fundo, a custo*"];

const HOW = {
  guard: {
    war: ["Em pé. É o que se pede de um guarda. Perdemos três homens no mês e ninguém veio render ninguém.", "Cansado. O portão não fecha sozinho e a guerra não espera a gente dormir."],
    adapt: ["Aguentando. A gente se acostuma com o peso da lança; o que pesa mesmo é a ronda da noite.", "Firme. O povo está mais calmo, e povo calmo dá menos trabalho."],
    routine: ["Normal. Ronda, portão, ronda. Prefiro assim a ver o que vi no começo da guerra.", "Sem novidade, e hoje isso é um bom dia."],
  },
  smith: {
    war: ["Trabalhando. Todo mundo quer lâmina, ninguém quer pagar o que ela custa.", "Vivo. Já é mais do que o vizinho pode dizer."],
    adapt: ["Forja acesa, braço inteiro. Podia ser pior.", "Mais pedido de enxada que de espada. Bom sinal, acho."],
    routine: ["Ferro, fogo, suor. A vida.", "Sem reclamar. Reclamar não amolece aço."],
  },
  merchant: {
    war: ["Ah, amigo, nunca os negócios estiveram tão difíceis... nem as oportunidades tão interessantes!", "Com a estrada perigosa, cada carga é uma aposta. Estou ficando velho pra isso."],
    adapt: ["Melhor! Os preços estão se assentando, e povo com medo ainda precisa de pão, vela e prego.", "Melhor que semana passada, pior que ano passado. Assim se mede o comércio."],
    routine: ["Vai indo! Estoque cheio, bolso razoável e a língua sempre afiada.", "Tranquilo, tranquilo. Quer ver uma coisa que acabou de chegar?"],
  },
  farmer: {
    war: ["A geada comeu metade da roça e a guerra levou os braços que sobravam. Mas a gente planta mesmo assim.", "Cansada. A terra não espera luto."],
    adapt: ["Plantando de novo. A terra perdoa mais que a gente.", "Brotou o que eu não esperava. Já é motivo pra sorrir."],
    routine: ["Boa! O milho vai bem, as galinhas não reclamam. Sem pressa, sem susto.", "Um dia de cada vez, como a lavoura manda."],
  },
  messenger: {
    war: ["Correndo! Levei três cartas hoje e duas voltaram sem resposta. Sabe o que isso quer dizer?", "Sem fôlego. As estradas estão ruins e cada carta pode ser a última de alguém."],
    adapt: ["Menos correria, mais fôlego. As notícias andam devagar, ou eu mais rápido.", "Vivo, e numa estrada isso já é muita coisa."],
    routine: ["Na pressa de sempre! Mas hoje deu pra sentar um pouco, olha só.", "Bem, bem! Cartas boas hoje: só casamento e compra de gado."],
  },
  commoner: {
    war: ["Vivendo. Não sei se basta, mas é o que tem.", "Mal, pra ser sincero. Perdi gente demais pra fingir que está tudo bem."],
    adapt: ["Dá pra tocar. Dá pra respirar um pouco.", "Aos poucos. A gente aprende a rir de novo, escondido."],
    routine: ["Bem. Estranho dizer isso, mas bem.", "Normal. Parece que a gente esqueceu de ter medo... quase."],
  },
  priest: {
    war: ["Com o coração pesado, filho. Enterrei mais gente do que batizei, e já perdi a conta das orações fúnebres.", "Sustentado pela fé, mas confesso que a fé também cansa."],
    adapt: ["Em paz. O povo voltou à capela, e isso é um remédio que nenhuma ervanária tem.", "Mais leve. A dor virou saudade, e saudade a gente carrega melhor."],
    routine: ["Em graça. Hoje o sino tocou sem ninguém morrer, e agradeci por isso.", "Bem, filho, bem. E tu, como está tua alma?"],
  },
  beggar: {
    war: ["Pior que ontem, melhor que amanhã, se o senhor tiver uma moedinha.", "Vivo por teimosia. A guerra matou os generosos primeiro."],
    adapt: ["Vou levando. Descobri que gente assustada dá menos esmola, mas fala mais. E eu escuto bem.", "Sobrevivendo com estilo. Tem outro jeito?"],
    routine: ["Ótimo! Hoje tenho um canto de sol e a promessa de uma sopa. O que mais um homem quer?", "Bem melhor que o rei, que tem que fingir que não tem medo."],
  },
};

const WAR_STORY = {
  war: ["Tá tudo muito ruim desde que essas guerras começaram. A gente acorda e conta quem sobrou.", "Os soldados levaram os rapazes, as tropas levaram o grão, e o que sobrou foi o medo.", "Começou com boatos na fronteira, depois vieram os refugiados, e agora ninguém dorme de porta aberta."],
  adapt: ["O pior passou, ou a gente é que parou de sentir. Já enterramos quem tínhamos que enterrar.", "Os refugiados viraram vizinhos. Dividimos o pouco e fingimos que é o suficiente."],
  routine: ["A guerra virou pano de fundo. Todo mundo fala dela, mas já tem gente pensando em casamento e colheita.", "Rotina é o que nos salva: acordar, trabalhar, rezar. O resto a gente deixa pra depois."],
};

const CULT_LINES = {
  guard: ["Não posso falar disso em detalhe. Há relatos de homens mascarados nas estradas. Se vir um, afaste-se e me avise.", "Ordem é ordem: qualquer reunião noturna fora das muralhas é suspeita. Mantenha distância."],
  smith: ["Não me meto nessas coisas. Só sei que de uns tempos pra cá encomendam punhal curvo demais pra ser pra cortar pão.", "Aço não pergunta pra quê. Eu pergunto, e o freguês foge."],
  merchant: ["Ah, o culto! Mau pra negócios e pior pra quem pergunta. Mas escute: velas pretas e tinta vermelha estão esgotando na região, e isso não é festa.", "Vendo de tudo, menos pra quem cheira a incenso estranho."],
  farmer: ["Já vi luz roxa no pasto velho. Os animais não comem por dois dias depois. Não chego perto.", "Minha avó dizia: o que canta no escuro não é gente. Eu acredito nela."],
  messenger: ["Vi homens de máscara branca na estrada, parados, sem mexer. Corri mais do que nunca na vida.", "Não levo carta sem remetente, e já recusei três com um olho vermelho desenhado."],
  commoner: ["Não falo disso em voz alta. A gente some quando fala demais.", "Dizem que tem quem se junta a eles pra escapar da fome. Eu preferia passar fome."],
  priest: ["O Demiurgo é uma mentira vestida de promessa, filho. Quem se aproxima dele perde a alma aos poucos. Reze, e não dê ouvidos.", "Quando a fé fraqueja, algo ocupa o lugar. Rezo todas as noites para que a capela continue de pé."],
  beggar: ["Ah, os mascarados! Pagam bem por esmola calada. Eu aceitei uma vez e me arrependi. Cuidado com quem sorri demais.", "Sei de muita coisa, mas informação é como pão: custa. *olha para sua bolsa*"],
};

const ABOUT = {
  guard: ["Servi na fronteira antes de vir pro portão.", "Entrei na guarda porque pagavam soldo e ninguém mais queria."],
  smith: ["Herdei a forja do meu pai, que herdou do pai dele.", "Aprendi ferro antes de aprender a ler."],
  merchant: ["Rodei meio reino com uma carroça e uma ideia.", "Já fui rico duas vezes e pobre três."],
  farmer: ["Nasci nesta terra e provavelmente serei enterrada nela.", "Planto o que meu pai plantava, só que com menos braços."],
  messenger: ["Sou mensageiro desde menino: pernas rápidas e língua curta.", "Conheço cada atalho entre as vilas, de dia e de noite."],
  commoner: ["Sou daqui mesmo. Trabalhei em tudo um pouco.", "Cheguei com os refugiados e fiquei, sem ter pra onde voltar."],
  priest: ["Sirvo esta capela há décadas. Já casei os pais de quem hoje sepulto.", "Fui noviço em tempos mais fáceis."],
  beggar: ["Fui soldado, fui mercador, e agora sou o homem que mais sabe de tudo nesta praça.", "Já tive casa. Hoje tenho a praça inteira."],
};
const FAMILY = ["Tenho um irmão no front e rezo por ele todo dia.", "Perdi minha esposa há dois invernos.", "Tenho dois filhos pequenos que só comem se eu trabalhar.", "Moro sozinho e já me acostumei ao silêncio.", "Cuido da minha mãe doente.", "Minha filha mais velha casou semana passada; foi a única alegria do ano."];
const HOPE = ["Queria ver a paz antes de morrer.", "Quero juntar o suficiente pra deixar essas terras.", "Só queria um inverno sem enterro.", "Sonho com uma casa de pedra, sem goteira.", "Espero que o amanhã seja só um dia comum."];

const HELP = {
  guard: ["Se achar bandido nas estradas, fale com o capitão: tem recompensa. E fique longe da escuridão sem tocha.", "Procure o ferreiro por armas melhores. Eu só tenho conselho, e ele é de graça: não ande à noite."],
  smith: ["Armas e armadura estão na aba Ações. Traga minério, lenha, e eu faço o resto.", "Se quiser algo afiado, é comigo. Se quiser conversa, é com o padre."],
  merchant: ["Vendo velas, pão, flechas, poções... tudo na aba Ações. Pra você, com desconto, se o carisma ajudar!", "Precisa de moedas? Venda a mim o excedente de madeira e pedra."],
  farmer: ["Feno bruto vale uns trocados. Corte com a foice, junte e venda. E replante, se tiver semente de coragem.", "A terra dá pra quem trabalha. Se precisar de trigo ou feno, vá aos campos."],
  messenger: ["Cartas e recados rendem moedas, é só procurar o mural. Eu mesmo vivo disso.", "Se tiver pressa, não corra: pegue um cavalo."],
  commoner: ["Ajuda? Ha. Aqui todo mundo pede, ninguém oferece. Mas o padre e o ferreiro podem fazer algo por você.", "Faça amizade com a guarda e fuja do que se mexe de noite."],
  priest: ["Se carrega pecados, a confissão alivia. Se carrega feridas, rezo pela cura. Veja a aba Ações, filho.", "A capela está aberta ao amanhecer. Doe o que puder; os doentes agradecem."],
  beggar: ["Ajuda, eu? Ora, eu é que peço! Mas uma moeda comprando um boato rende mais que um pão.", "Quer sobreviver? Fique perto de tochas e de gente armada."],
};

const BYE = {
  guard: ["Cuide-se. A noite é longa.", "Circule com cuidado, viajante."],
  smith: ["Hm. Até.", "Volte quando precisar de ferro."],
  merchant: ["Volte sempre! Meu balcão é seu!", "Que os preços lhe sejam gentis!"],
  farmer: ["Vá com Deus. E olhe o céu.", "Até, e não pise na roça!"],
  messenger: ["Tenho que ir! Até!", "Boa estrada!"],
  commoner: ["Até mais. Cuide-se.", "Vá em paz."],
  priest: ["Que a graça te acompanhe, filho.", "Vai com Deus, e volta quando precisares."],
  beggar: ["Se lembrar de mim, deixa uma moeda. *sorri*", "Até mais, patrão!"],
};

const EVENT_INTRO = {
  guard: "Pelo que consta nos relatórios:",
  smith: "Ouvi no balcão:",
  merchant: "Olha, correu pela praça:",
  farmer: "Contaram na roça:",
  messenger: "Passei por lá agorinha:",
  commoner: "Dizem por aí:",
  priest: "Chegou-me aos ouvidos:",
  beggar: "Eu escuto tudo, sabia?",
};

function recentNoRepeat(p, arr) {
  const free = arr.filter((s) => !p.recent.includes(s));
  const s = choice(free.length ? free : arr);
  p.recent.push(s);
  if (p.recent.length > 14) p.recent.shift();
  return s;
}

function context(npc) {
  const d = day();
  const dn = G().dayNight;
  const t = trustEff(npc);
  const d0 = state.dead.filter((x) => d - x.day <= 7);
  const sick = state.sick && !state.sick.cured && state.sick.name !== npc.name ? state.sick : null;
  const pl = G().PlayerStats || {};
  return {
    npc,
    p: profile(npc),
    k: voiceOf(npc),
    day: d,
    ph: phaseOf(d),
    night: Boolean(dn?.isNight),
    trust: t,
    evil: G().getEvilPercent?.() ?? 0,
    village: villageOf(npc),
    dead: d0,
    sick,
    selfSick: Boolean(npc.sick),
    events: state.events.slice(-4).reverse(),
    templar: Boolean(pl.isTemplar && !pl.hasBrokenVow),
    cultRobe: Boolean(pl.wearingDemiurgeRobe || G().player?.wearingDemiurgeAttire),
    wanted: Boolean(G().wantedLevel || window.__game?.npcs?.wantedTimer > 0),
  };
}

function gesture(c, force = false) {
  if (!force && rnd() > 0.55) return "";
  return c.selfSick ? choice(SICK_GESTURE) : choice(GESTURE[c.k] || GESTURE.commoner);
}

function selfSickReply(c, q) {
  const s = state.sick;
  const stage = s ? c.day - s.sinceDay : 0;
  const lines = [
    ["Coff... é só uma tosse, passa. Eu... coff... acho que passa.", "Estou meio fraco, mas é o frio. Só o frio."],
    ["A febre não larga. Não consigo comer. Rezo pra amanhecer melhor.", "Tudo dói. Se tiver uma poção de cura, viajante... eu pagaria com o que tenho."],
    ["Eu... não sinto mais as mãos. Diga à minha família que eu... coff... tentei.", "Está escuro, mesmo de dia. Por favor... uma poção."],
  ][Math.min(2, stage)];
  return { n: gesture(c, true), t: recentNoRepeat(c.p, lines) };
}

function reply(npc, qid) {
  const c = context(npc);
  const p = c.p;
  if (c.selfSick && qid !== "bye" && qid !== "you") return selfSickReply(c, qid);
  let t = "";
  let n = gesture(c);
  const deadTxt = () => c.dead.slice(0, 3).map((x) => `${x.name} (${x.cause})`).join(", ");
  switch (qid) {
    case "how": {
      if (c.trust < 12 && c.evil > 60) {
        t = recentNoRepeat(p, ["Bem. Por que quer saber?", "Vou indo. Não costumo contar minha vida pra desconhecido."]);
        break;
      }
      const grief = p.diary.find((e) => e.kind === "grief" && c.day - e.day <= 4);
      t = recentNoRepeat(p, (HOW[c.k] || HOW.commoner)[c.ph]);
      if (grief) t += ` ...Perdi ${grief.text.replace(/ morreu$/, "")} faz pouco, ainda estou assimilando.`;
      else if (c.trust >= 55 && rnd() < 0.5) t += ` Mas já que somos amigos: ${choice(HOPE).toLowerCase()}`;
      if (c.night && c.k !== "guard") t = "Tarde da noite pra conversa, mas... " + t.charAt(0).toLowerCase() + t.slice(1);
      break;
    }
    case "happened": {
      t = recentNoRepeat(p, WAR_STORY[c.ph]);
      const ev = c.events[0];
      if (ev) t += ` ${EVENT_INTRO[c.k]} ${ev.text}`;
      break;
    }
    case "died": {
      if (c.dead.length) {
        t = `${deadTxt()}. ` + (c.ph === "war" ? "A guerra e a doença estão levando todo mundo." : c.ph === "adapt" ? "A gente não se acostuma, só aprende a carregar." : "Já foram os piores dias, mas ninguém esquece.");
        if (c.k === "priest") t += " Rezei por cada um.";
        if (c.k === "beggar") t += " Aqui na praça se sente a falta até de quem não dava esmola.";
        if (c.k === "guard") t += " Os nomes estão no livro de registros.";
      } else {
        t = recentNoRepeat(p, ["Ninguém, graças a Deus, nos últimos dias. Toc na madeira.", "Por ora, ninguém. Mas a gente aprende a não comemorar cedo."]);
      }
      break;
    }
    case "cult": {
      t = recentNoRepeat(p, CULT_LINES[c.k] || CULT_LINES.commoner);
      if (c.cultRobe) t = "Esse manto... prefiro não falar de nada com você. " + (c.k === "guard" ? "Fique onde posso ver suas mãos." : "");
      else if (c.trust >= 50) {
        const g = placeList().ghosts;
        if (g.length) t += ` Entre nós: dizem que mexem em ${choice(g).name}, à noite.`;
      }
      break;
    }
    case "you": {
      if (!p.bio) p.bio = `${choice(ABOUT[c.k] || ABOUT.commoner)} ${FAMILY[hash(npc.name) % FAMILY.length]} ${HOPE[(hash(npc.name) >> 3) % HOPE.length]}`;
      t = c.trust < 20 ? `${choice(ABOUT[c.k] || ABOUT.commoner)} Só isso por enquanto.` : p.bio;
      break;
    }
    case "news": {
      const ev = c.events.slice(0, 3);
      t = ev.length ? `${EVENT_INTRO[c.k]} ${ev.map((e) => e.text).join(" ")}` : "Nada que valha contar, graças a Deus.";
      break;
    }
    case "help": {
      t = recentNoRepeat(p, HELP[c.k] || HELP.commoner);
      if (c.sick) t += ` E se puder, veja ${c.sick.name}: está mal, e poção de cura é raridade.`;
      break;
    }
    case "sick": {
      if (c.sick) {
        const stage = c.day - c.sick.sinceDay;
        t = stage === 0 ? `${c.sick.name} anda tossindo sem parar. Pode ser o frio, pode ser a peste.` : stage === 1 ? `${c.sick.name} piorou, a febre não cede. Todos temem o pior.` : `${c.sick.name} está de cama. Dizem que é questão de dias.`;
      } else t = "Que eu saiba, ninguém. Toc na madeira.";
      break;
    }
    case "funeral": {
      const f = state.flags.funeralFor;
      t = f ? `Rezei o funeral de ${f.name} ao amanhecer. A família ficou até o fim, e foi bonito, dentro do que a dor permite.` : "Não há funeral marcado. Que continue assim.";
      break;
    }
    case "bye": {
      t = recentNoRepeat(p, BYE[c.k] || BYE.commoner);
      n = "";
      break;
    }
    default:
      t = "...";
  }
  // aprendizado: primeira vez que pergunta aumenta a confiança
  if (qid !== "bye") {
    if (!p.asked[qid]) { p.asked[qid] = 1; p.trust = Math.min(100, p.trust + 4); }
    else if (rnd() < 0.3) p.trust = Math.min(100, p.trust + 0.5);
  } else p.trust = Math.min(100, p.trust + 1);
  p.lastTalkDay = c.day;
  saveSoon();
  return { n, t };
}

function greeting(npc) {
  const c = context(npc);
  const p = c.p;
  const first = p.met === 0;
  p.met++;
  if (c.selfSick) return { n: choice(SICK_GESTURE), t: "Coff... viajante... me perdoe, não estou bem." };
  let t;
  if (c.cultRobe || c.wanted) t = recentNoRepeat(p, ["Eu... não quero problemas. Diga logo o que quer.", "*recua um passo* Fale baixo. O que quer de mim?"]);
  else if (c.evil > 70 && c.trust < 40) t = recentNoRepeat(p, ["Você... ouvi coisas ruins sobre você. Seja breve.", "Não sei o que você fez, mas dizem que fez. Fale logo."]);
  else if (c.templar) t = recentNoRepeat(p, ["Cavaleiro! Que bom ver alguém jurado a algo bom neste reino.", "Saudações, templário. A cruz no seu peito me dá algum alívio."]);
  else if (first) t = c.night ? "Boa noite, estranho. Tarde para andar sozinho, não?" : FIRST_MEET[c.k] ? choice(FIRST_MEET[c.k]) : choice(["Bom dia, viajante. Não costumo ver cara nova por aqui.", "Ora, quem é você? Chegou há pouco, não é?", "Olá. Você tem cara de quem viu muita estrada."]);
  else if (c.trust >= 60) t = recentNoRepeat(p, ["Ah, você de novo! Que bom. Senta, conta como andam as coisas.", "Meu amigo! Sorte te encontrar. O que há de novo?"]);
  else t = recentNoRepeat(p, ["De novo por aqui? Hm. Fale.", "Voltou. Diga, no que posso ajudar?", "Sim? O que deseja agora?"]);
  return { n: gesture(c), t };
}

const FIRST_MEET = {
  guard: ["Identifique-se, viajante. Rotina. Pode falar.", "Boas. Fique à vontade, só não perturbe a ordem."],
  smith: ["Hm. Novo por aqui. Se veio por ferro, fale. Se veio por conversa, seja rápido.", "Cuidado com a brasa. O que deseja?"],
  merchant: ["Ora, um novo freguês! Chegue, chegue, olhe à vontade!", "Bem-vindo, bem-vindo! Tenho tudo, e o que não tenho eu arranjo."],
  farmer: ["Olá! Cuidado onde pisa, a roça é frágil. Em que posso ajudar?", "Bom dia. Veio de longe, né? Tem poeira de estrada nas botas."],
  messenger: ["Ei! Rápido, tenho pressa, mas diga: o que precisa?", "Ah, gente nova! Tem recado pra levar?"],
  commoner: ["Olá. Não costumo ver cara nova... a não ser refugiado. É o seu caso?", "Bom dia. Se procura alguém, talvez eu saiba onde está."],
  priest: ["Que a paz esteja contigo, filho. Sê bem-vindo.", "A capela é de todos. Chega, filho, e fala sem medo."],
  beggar: ["Ora, ora, um forasteiro! E de bolsa que parece pesada... *sorri*", "Ei, patrão! Tem um minuto pra um velho conhecedor das ruas?"],
};

function questionsFor(npc) {
  const c = context(npc);
  const q = [
    { id: "how", label: "Como vai a vida?" },
    { id: "happened", label: "O que aconteceu por aqui?" },
    { id: "died", label: "Quem morreu?" },
    { id: "news", label: "Conte as novidades da vila" },
    { id: "cult", label: "Sabe de algo sobre o culto?" },
    { id: "you", label: "Fale de você" },
    { id: "help", label: "Preciso de ajuda" },
  ];
  if (c.sick) q.splice(3, 0, { id: "sick", label: "Alguém está doente?" });
  if (c.k === "priest" && state.flags.funeralFor && c.day - state.flags.funeralFor.day <= 3) q.splice(3, 0, { id: "funeral", label: "Como foi o funeral?" });
  q.push({ id: "bye", label: "Até logo" });
  return q;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------
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

  // abre a conversa: retorna os dados de cabeçalho, saudação e perguntas
  chatMeta(npc) {
    const p = profile(npc);
    const first = greeting(npc);
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
      questions: questionsFor(npc),
    };
  },
  ask(npc, qid) {
    const r = reply(npc, qid);
    const p = profile(npc);
    const t = trustEff(npc);
    const expr = expression(npc);
    return { ...r, trust: t, trustLabel: trustLabel(t), mood: moodLabel(npc), portrait: portraitFor(npc, expr, p.age), questions: questionsFor(npc) };
  },
  // estado atual do cabeçalho (sem saudação): humor, confiança, retrato e perguntas
  status(npc) {
    const p = profile(npc);
    const t = trustEff(npc);
    const expr = expression(npc);
    return { age: p.age, mood: moodLabel(npc), expr, trust: t, trustLabel: trustLabel(t), portrait: portraitFor(npc, expr, p.age), questions: questionsFor(npc) };
  },
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
    addDiary(npc, "cured", "o viajante me curou", 0.8);
    pushEvent("cured", `${npc.name} se recuperou da peste graças a um forasteiro generoso.`, [], 0.4);
    const p = profile(npc);
    p.trust = Math.min(100, p.trust + 25);
  },
  onPlayerHelped() {
    state.player.charity++;
    saveSoon();
  },
  getState: () => state,
  trustLabel,
};

export default NpcLife;
