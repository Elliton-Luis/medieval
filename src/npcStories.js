// ============================================================================
// npcStories.js — Conteúdo e compositor das conversas dos NPCs (carregado sob demanda, 1ª conversa).
//  - Perguntas BASE só as naturais: Como vai? / Como está o dia? / Fale de você / Precisa de ajuda? / Até logo.
//  - GANCHOS: cada fala pode abrir 0–2 perguntas de seguimento ligadas ao que acabou de ser dito
//    ("Quem era ele?", "O que você viu?"...). Elas somem quando a conversa muda de rumo.
//  - BIOGRAFIA em 4 camadas (família/ofício -> passado e medo -> desejo, relações, dívida -> segredo),
//    desbloqueadas por confiança, carisma e nº de conversas. Determinística por NPC (semente = nome).
//  - Cenário: hora, dia/fase da guerra, eventos, maldade, carisma, neblina, eclipse, decadência, local,
//    estado do jogador e do NPC. Cada contexto tem 3–6 variantes, sorteadas por peso e sem repetir.
// ============================================================================

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const R = Math.random;
const pick = (a) => a[(R() * a.length) | 0];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------------------
// gestos (narração curta)
// ---------------------------------------------------------------------------
const GEST = {
  guard: ["*ajeita o elmo e confere o portão com o canto do olho*", "*apoia a lança no chão, cansado*", "*olha para os lados antes de falar*"],
  smith: ["*bate a mão suja de fuligem no avental*", "*não tira os olhos do ferro em brasa*", "*seca o suor com o antebraço*"],
  merchant: ["*abre os braços como quem apresenta a mercadoria*", "*conta moedas sem perceber que faz isso*", "*sorri largo, mas os olhos medem você*"],
  farmer: ["*limpa a terra das mãos no avental*", "*olha o céu antes de responder*", "*mastiga uma haste de trigo*"],
  messenger: ["*mexe os pés, com pressa*", "*olha para a estrada*", "*ajeita a bolsa de cartas*"],
  commoner: ["*enxuga a testa com a manga*", "*encolhe os ombros*", "*abaixa a voz*"],
  priest: ["*junta as mãos e inclina a cabeça com ternura*", "*toca o crucifixo no peito*", "*sorri com cansaço bondoso*"],
  beggar: ["*estende a mão, depois a recolhe com um sorriso torto*", "*coça a barba rala, avaliando você*", "*pisca um olho, esperto*"],
};
const GEST_NIGHT = ["*olha por cima do ombro*", "*segura a lamparina mais perto do corpo*", "*fala quase sussurrando*"];
const GEST_FEAR = ["*as mãos tremem um pouco*", "*recua meio passo sem perceber*"];
const GEST_SAD = ["*desvia o olhar*", "*respira fundo antes de continuar*"];
const GEST_HAPPY = ["*sorri de verdade, o que é raro*", "*dá uma risada curta*"];
const GEST_SICK = ["*tosse forte e cobre a boca com o pano*", "*se apoia na parede, suando frio*", "*respira fundo, a custo*"];

// ---------------------------------------------------------------------------
// base por ofício e fase da guerra (voz distinta por ofício)
// ---------------------------------------------------------------------------
const HOW = {
  guard: {
    war: ["Em pé. É o que se pede de um guarda. Perdemos três homens no mês e ninguém veio render ninguém.", "Cansado. O portão não fecha sozinho e a guerra não espera a gente dormir.", "Vivo, por ora. Dormi três horas esta semana e já perdi a conta do que vi.", "Cumprindo o dever. Dever não pergunta se a gente está bem."],
    adapt: ["Aguentando. A gente se acostuma com o peso da lança; o que pesa mesmo é a ronda da noite.", "Firme. O povo está mais calmo, e povo calmo dá menos trabalho.", "Melhor que na semana passada. Os turnos finalmente estão decentes.", "Sem queixa. A guarda é feita de gente que aprende a não reclamar."],
    routine: ["Normal. Ronda, portão, ronda. Prefiro assim a ver o que vi no começo da guerra.", "Sem novidade, e hoje isso é um bom dia.", "Tranquilo. O capitão até sorriu ontem, juro.", "Bem. A rotina é uma armadura que ninguém forjou, mas protege."],
  },
  smith: {
    war: ["Trabalhando. Todo mundo quer lâmina, ninguém quer pagar o que ela custa.", "Vivo. Já é mais do que o vizinho pode dizer.", "Hm. Faltou carvão e sobrou pedido. O resto, deixa.", "Cansado. Martelo não tem feriado."],
    adapt: ["Forja acesa, braço inteiro. Podia ser pior.", "Mais pedido de enxada que de espada. Bom sinal, acho.", "Ferro, fogo, suor. Dá pra viver.", "Melhor. Voltei a dormir a noite inteira."],
    routine: ["Ferro, fogo, suor. A vida.", "Sem reclamar. Reclamar não amolece aço.", "Bem. Fiz uma lâmina hoje de que gostei, e isso não acontece sempre.", "Regular. A forja está quente e o resto não depende de mim."],
  },
  merchant: {
    war: ["Ah, amigo, nunca os negócios estiveram tão difíceis... nem as oportunidades tão interessantes!", "Com a estrada perigosa, cada carga é uma aposta. Estou ficando velho pra isso.", "Péssimo pra quem compra, razoável pra quem sabe vender. Eu sei vender, felizmente.", "Os preços saltam, a clientela encolhe. Mas sempre há quem precise de uma vela."],
    adapt: ["Melhor! Os preços estão se assentando, e povo com medo ainda precisa de pão, vela e prego.", "Melhor que semana passada, pior que ano passado. Assim se mede o comércio.", "Vai-se levando! Cada dia um pouco menos de susto e um pouco mais de freguês.", "Equilibrado. Vendo menos, mas vendo a quem paga."],
    routine: ["Vai indo! Estoque cheio, bolso razoável e a língua sempre afiada.", "Tranquilo, tranquilo. Quer ver uma coisa que acabou de chegar?", "Ótimo! Hoje vendi até o que não devia, hehe.", "Bem, bem. Os negócios andam, que é o que importa."],
  },
  farmer: {
    war: ["A geada comeu metade da roça e a guerra levou os braços que sobravam. Mas a gente planta mesmo assim.", "Cansada. A terra não espera luto.", "Aguentando. A semente não sabe de guerra, só de chuva.", "Mal, pra falar verdade. Mas as galinhas não sabem, então finjo por elas."],
    adapt: ["Plantando de novo. A terra perdoa mais que a gente.", "Brotou o que eu não esperava. Já é motivo pra sorrir.", "Melhor. Choveu na hora certa pela primeira vez em meses.", "Indo. O milho não pergunta se estou triste."],
    routine: ["Boa! O milho vai bem, as galinhas não reclamam. Sem pressa, sem susto.", "Um dia de cada vez, como a lavoura manda.", "Bem. Cheiro de terra molhada cura muita coisa.", "Tranquila. Hoje o céu está do meu lado."],
  },
  messenger: {
    war: ["Correndo! Levei três cartas hoje e duas voltaram sem resposta. Sabe o que isso quer dizer?", "Sem fôlego. As estradas estão ruins e cada carta pode ser a última de alguém.", "Vivo e atrasado, como sempre. Não pare pra conversar na estrada, é meu lema.", "Mal. Entreguei uma notícia de morte hoje. Não é um trabalho que eu escolhi."],
    adapt: ["Menos correria, mais fôlego. As notícias andam devagar, ou eu mais rápido.", "Vivo, e numa estrada isso já é muita coisa.", "Indo! As cartas agora têm mais bênção do que luto.", "Cansado, mas com as botas ainda inteiras."],
    routine: ["Na pressa de sempre! Mas hoje deu pra sentar um pouco, olha só.", "Bem, bem! Cartas boas hoje: só casamento e compra de gado.", "Ótimo! Ninguém morreu nas cartas de hoje. Merece um brinde.", "Tudo certo. Menos dor, mais papel."],
  },
  commoner: {
    war: ["Vivendo. Não sei se basta, mas é o que tem.", "Mal, pra ser sincero. Perdi gente demais pra fingir que está tudo bem.", "Em pé. Hoje isso conta como vitória.", "Sobrevivendo, que é diferente de viver. Mas a gente aprende."],
    adapt: ["Dá pra tocar. Dá pra respirar um pouco.", "Aos poucos. A gente aprende a rir de novo, escondido.", "Melhor que semana passada. Menos medo, mais cansaço.", "Indo. O pior passou, ou a gente que parou de sentir."],
    routine: ["Bem. Estranho dizer isso, mas bem.", "Normal. Parece que a gente esqueceu de ter medo... quase.", "Tranquilo. Dei risada hoje, imagina.", "Bem. Hoje o pão rendeu e o dia foi curto."],
  },
  priest: {
    war: ["Com o coração pesado, filho. Enterrei mais gente do que batizei, e já perdi a conta das orações fúnebres.", "Sustentado pela fé, mas confesso que a fé também cansa.", "Em oração constante. Há noites em que não sei se Deus escuta, e rezo mesmo assim.", "Abatido. A capela está cheia de gente que perdeu alguém."],
    adapt: ["Em paz. O povo voltou à capela, e isso é um remédio que nenhuma ervanária tem.", "Mais leve. A dor virou saudade, e saudade a gente carrega melhor.", "Esperançoso, com cautela. A esperança também é uma forma de oração.", "Bem, filho. A confissão tem sido mais sobre alegria do que sobre culpa, e isso me comove."],
    routine: ["Em graça. Hoje o sino tocou sem ninguém morrer, e agradeci por isso.", "Bem, filho, bem. E tu, como está tua alma?", "Em paz. A capela cheira a cera e a pão, que é um bom cheiro.", "Sereno. Hoje houve um batizado, e isso renova qualquer velho."],
  },
  beggar: {
    war: ["Pior que ontem, melhor que amanhã, se o senhor tiver uma moedinha.", "Vivo por teimosia. A guerra matou os generosos primeiro.", "Com fome, mas com ouvidos. Quem pede esmola escuta o reino inteiro.", "Aguentando. A praça é minha casa e o frio é meu vizinho."],
    adapt: ["Vou levando. Descobri que gente assustada dá menos esmola, mas fala mais. E eu escuto bem.", "Sobrevivendo com estilo. Tem outro jeito?", "Melhor! O povo voltou a ter trocados nos bolsos.", "Bem. A sopa de ontem estava quase decente."],
    routine: ["Ótimo! Hoje tenho um canto de sol e a promessa de uma sopa. O que mais um homem quer?", "Bem melhor que o rei, que tem que fingir que não tem medo.", "Ótimo, patrão! A vida ensina quem sabe ser pobre.", "Bem, bem. Hoje alguém me chamou pelo nome, e faz tempo que isso não acontecia."],
  },
};

// ---------------------------------------------------------------------------
// hora do dia
// ---------------------------------------------------------------------------
function timeBucket(h) {
  if (h >= 23.5 || h < 4.5) return "lateNight";
  if (h < 7) return "dawn";
  if (h < 11.5) return "morning";
  if (h < 14) return "noon";
  if (h < 17.5) return "afternoon";
  if (h < 20) return "dusk";
  return "night";
}
const TIME_LINES = {
  dawn: ["O dia mal nasceu e já estou de pé; a roça não perdoa quem dorme.", "Esse amanhecer pálido me assusta menos do que as noites.", "Ouviu os galos? Foi a única coisa boa da manhã até agora.", "Madrugada fria. Nem os cães latem."],
  morning: ["A manhã é a melhor hora, antes que o dia mostre o que trouxe.", "Com o sol alto o medo diminui, é um fato.", "Manhã boa pra trabalhar. Se a fome deixar.", "O mercado acorda cedo, e eu também."],
  noon: ["Meio-dia. A sombra é um luxo.", "Calor do meio-dia, nem pensar em discutir.", "Hora do pão, se houver pão.", "O sol a pino pesa mais que a lança."],
  afternoon: ["Tarde pesada, parece que o dia não termina.", "A tarde é a hora das saudades.", "O sol já pende; logo é hora de trancar tudo.", "Tarde calma. Desconfio de calma demais."],
  dusk: ["Entardecer. Hora de recolher e de rezar.", "O céu fica cor de ferrugem, não gosto.", "Quando o dia acaba, a gente começa a ouvir coisas.", "Já acendem as tochas. Não demora e é noite."],
  night: ["É tarde pra conversa, mas o sono não vem.", "A noite é longa nesses tempos.", "Fale baixo, as noites têm ouvidos.", "Quem anda à noite ou tem pressa ou tem culpa."],
  lateNight: ["Madrugada alta, e o senhor andando por aí? Corajoso ou tolo.", "A esta hora só as sombras e os insones estão acordados.", "Nem a lua quer olhar para isto. Fale baixo.", "Escuro como breu. Não gosto de ficar parado fora de casa."],
};
const TIME_VOICE = {
  guard: { night: ["Toque de recolher. Se não mora aqui, siga para uma estalagem.", "Ronda noturna. Fique perto das tochas."], lateNight: ["Nem os ladrões saem a esta hora. É isso que me preocupa.", "Fiquei de vigia. Qualquer movimento, dou o alarme."] },
  priest: { night: ["Estou terminando as completas. Reza comigo, filho?", "A noite pede oração. Cada vela acesa é um escudo."], lateNight: ["Rezo pelos que dormem e pelos que não dormem.", "A esta hora a capela é toda silêncio e cera derretida."] },
  beggar: { dusk: ["*solta um soluço*... Perdão, patrão, uma gota de aguardente a mais.", "O vinho é o único agasalho gratuito."], night: ["*cheira a vinho barato* Ah, patrão, a noite é a minha hora preferida!", "Hic... a noite dá coragem e tira o juízo, vantagens do ofício."], lateNight: ["Ssshh... os mascarados saem agora. Eu me escondo no chão.", "Dormir ao relento nesses dias é pedir pra não acordar."] },
  merchant: { night: ["Fechei o balcão, mas pra você abro uma exceção.", "À noite eu conto o dia e rezo pelos números."], dusk: ["Última rodada de vendas, hehe, aproveite!"] },
  commoner: { dusk: ["Tomei uma caneca depois do trabalho, sem culpa nenhuma.", "Hora de voltar pra casa e trancar a porta duas vezes."], night: ["Tô cansado, mas a cabeça não desliga."] },
  farmer: { dawn: ["Já ordenhei, já plantei, e ainda nem comi!"], night: ["Estou exausta. O corpo pede cama e a cabeça pede colheita."] },
  smith: { night: ["Apago a forja, mas a cabeça continua martelando."], lateNight: ["Insônia. O ferro esfria mais rápido que meus pensamentos."] },
  messenger: { night: ["Não corro à noite. Quem corre no escuro tropeça em coisa pior que pedra."], lateNight: ["Estou escondido atrás do muro. Nada me tira da cama de dia, mas à noite eu não saio."] },
};

// ---------------------------------------------------------------------------
// modificadores de cenário (3–6 variantes cada)
// ---------------------------------------------------------------------------
const MOD = {
  grief: ["Perdi alguém faz pouco; ainda não consegui chorar direito.", "Estou de luto. Se eu parecer distante, perdoe.", "A casa está mais vazia desde que ele se foi.", "Enterramos alguém ontem. Tudo me lembra isso."],
  hungry: ["E a fome, ah... o pão sumiu das mesas.", "Faltam grãos e todo mundo finge que não está com fome.", "Comi metade do que devia hoje, e olha que foi festa.", "Meu estômago fala mais alto que minha educação."],
  happy: ["Mas hoje estou de bom humor, confesso.", "Hoje o dia me sorriu, por mais estranho que pareça.", "Tenho um bom pressentimento, e isso é raro.", "Sinto uma leveza no peito e não sei de onde veio."],
  scared: ["Não consigo parar de olhar por cima do ombro.", "Tenho medo, não vou mentir. Todo mundo tem, só que ninguém admite.", "Cada barulho me faz pular.", "Se algo se mexer ali, eu corro e nem aviso."],
  evilWelcome: ["Gente como você faz o reino parecer menos escuro.", "Você tem um rosto bom, daqueles que a gente confia.", "Se mais viajantes fossem como você, o mundo estaria melhor."],
  evilWary: ["Dizem coisas sobre você... mas não costumo dar ouvido a boato.", "Seu nome anda circulando em conversas baixas. Fico de olho.", "Tenho um pé atrás com você, sem ofensa.", "Não sei o que pensar de você. E isso me incomoda."],
  evilAfraid: ["Seu olhar me gela. Faça o que veio fazer e siga.", "*recua um passo* Ouvi o que você andou fazendo. Não me machuque.", "Fale baixo. Prefiro que não nos vejam juntos.", "Eu... eu não tenho nada de valor, juro."],
  evilContempt: ["Você tem o cheiro da corrupção. Falo porque não tenho nada a perder.", "Gente como você apodrece o que toca. Desculpe a franqueza.", "Se eu fosse mais corajoso, cuspiria no chão à sua frente.", "A única razão pra eu falar com você é que não quero confusão."],
  chaHigh: ["Você tem jeito de quem sabe ouvir, isso é raro.", "Com você é fácil falar. Não sei bem por quê.", "Pra você eu abro um pouco mais a porta, viu?", "Gosto da sua conversa. Quase esqueço do resto."],
  chaLow: ["Você não é de muita conversa, não é?", "Perdão, mas você me deixa meio desconfortável.", "Não leve a mal, mas prefiro falar pouco com você.", "Tem algo na sua maneira de olhar que me deixa seco."],
  templar: ["A cruz no seu peito me dá alguma esperança.", "Um templário! Há quanto tempo a gente não vê um.", "Fico mais tranquilo com a sua espada por perto, cavaleiro.", "Que Deus guie seu voto, senhor."],
  wanted: ["Vi cartazes com seu rosto. Se os guardas virem a gente conversando...", "Você está sendo procurado, não é? Fale rápido.", "Não quero ser cúmplice de nada. Seja breve.", "A guarda anda atrás de você, e eu ainda aqui, dando papo."],
  cultRobe: ["Esse manto... prefiro não falar de nada com você.", "Isso que você veste... faz meu sangue gelar.", "Tire esse negro de cima de mim, ou melhor, vá embora.", "Não sei se você é um deles, e nem quero saber."],
  hurt: ["Você está ferido, sabia? Parece que levou uma surra.", "Esse corte precisa de cuidado. Fique atento, está pálido.", "Tem sangue em você. Sente-se, respire.", "Você não parece nada bem. O padre tem bálsamo."],
  candle: ["Boa ideia, essa vela. Só ela segura o escuro.", "A chama que você carrega me acalma.", "Com esse lume, ao menos dá pra ver quem fala."],
  mounted: ["Belo animal. Aqui ninguém tem cavalo dessa raça.", "De cima do cavalo, sempre é mais fácil olhar de cima pra gente.", "Boa montaria. Cuide dela, os ladrões gostam."],
  armed: ["Essa arma na sua mão me deixa nervoso... pode guardar?", "Armado até os dentes. Tempos difíceis, eu sei.", "Cuidado com isso aí, a guarda pode estranhar."],
  fogMild: ["Essa névoa baixa me incomoda.", "A bruma está subindo cedo hoje.", "Não enxergo nem o fim da rua, e olha que conheço de cor."],
  fogHeavy: ["Com esta neblina, nem cachorro acha o dono.", "A cerração cobre tudo. Não gosto de nada que esconde o mundo.", "Sinto coisas se mexendo na névoa, só barulho, claro.", "Quando o breu branco desce, ninguém sai de casa, e quem sai não volta fácil."],
  eclipse: ["O sol sangrou. Nunca vi nada assim em toda a minha vida.", "Esse eclipse é um mau presságio, todo mundo sabe.", "Os animais ficam quietos quando o céu escurece assim."],
  decayMid: ["As plantações murcham mais rápido que o normal; algo está errado.", "O ar está pesado nos últimos dias. Dizem que é a corrupção.", "As águas do poço mudaram de gosto, e ninguém quer falar disso."],
  decayHigh: ["A podridão está em tudo: nas árvores, no pão, no olhar das pessoas.", "O mundo está apodrecendo e todo mundo finge não ver.", "Não sobra muito tempo, sabe? As coisas estão se desfazendo."],
  capital: ["Caldera sempre foi barulhenta, mas agora o barulho é de medo.", "Aqui na capital as paredes ainda protegem, mas por quanto tempo?"],
  village: ["Na vila, a gente se conhece pelo nome e pelas dívidas.", "Aqui é um lugar pequeno; qualquer segredo vira praça em um dia."],
  church: ["O sino da capela marca o ritmo do meu dia.", "Com a igreja aqui perto, a gente dorme um pouco mais seguro."],
  gate: ["Perto do portão, a gente vê todo mundo que entra e sai, e todo mundo que não volta.", "Os guardas do portão são os únicos que dormem de olhos abertos."],
  guards: ["Com a guarda por perto, dá até pra falar mais alto.", "Os guardas estão aqui, então relaxo um pouco."],
  noGuards: ["Aqui não tem guarda nenhum, e eu sinto isso na pele.", "Sem guarda por perto, a gente aprende a olhar duas vezes."],
};

// ---------------------------------------------------------------------------
// biografia: bases determinísticas + camadas
// ---------------------------------------------------------------------------
const FAMILY = [
  "Tenho um irmão no front e rezo por ele todo dia.",
  "Perdi minha esposa há dois invernos e ainda dobro a roupa dela.",
  "Tenho dois filhos pequenos que só comem se eu trabalhar.",
  "Moro sozinho e já me acostumei ao silêncio.",
  "Cuido da minha mãe doente, que não reconhece mais ninguém.",
  "Minha filha mais velha casou semana passada; foi a única alegria do ano.",
  "Sou casado há vinte anos, com a mesma mulher que me aguenta e que eu não mereço.",
  "Criei meu sobrinho depois que o pai dele não voltou da guerra.",
  "Tenho três irmãs, todas mais teimosas que eu, e olha que é difícil.",
  "Minha avó ainda vive e conta histórias que ninguém quer ouvir.",
];
const PAST = {
  guard: ["Servi na fronteira e vi uma ponte virar cemitério.", "Fui soldado raso; subi de posto porque os outros morreram.", "Entrei na guarda pra fugir da fome da minha vila natal."],
  smith: ["Aprendi o ofício com um mestre cego que sentia o ferro pela cor do calor.", "Fiz espadas para um senhor da guerra e nunca soube se alguém morreu por elas.", "Herdei a forja do meu pai e a culpa dele, sem pedir nenhuma."],
  merchant: ["Rodei meio reino de carroça, e perdi duas fortunas nas estradas.", "Fui sócio de um homem que me roubou tudo e, mesmo assim, ainda reza por ele.", "Já vendi relíquias falsas, e uma delas era mais valiosa que o verdadeiro."],
  farmer: ["Nasci nesta terra e provavelmente serei enterrada nela.", "Fugi de uma vila queimada pela guerra e plantei de novo, do zero.", "Aprendi a ler o tempo com minha mãe, que lia o céu como livro."],
  messenger: ["Comecei criança, carregando recados de pai pra filho e filho pra pai.", "Já levei carta de amor e carta de condenação, às vezes na mesma viagem.", "Conheço cada atalho entre as vilas, e dois que não existem no mapa."],
  commoner: ["Fui pedreiro, ferreiro, ajudante de padeiro, tudo um pouco e nada direito.", "Cheguei com os refugiados e fiquei, sem ter pra onde voltar.", "Trabalhei nas minas no norte até desabarem, e saí só eu e a sorte."],
  priest: ["Fui noviço em tempos mais fáceis; casei os pais de quem hoje sepulto.", "Fui soldado antes de ser padre, e rezo todo dia pelos que matei.", "Entrei pro sacerdócio por uma promessa que fiz num campo de batalha."],
  beggar: ["Fui soldado, fui mercador, e agora sou o homem que mais sabe de tudo nesta praça.", "Já tive casa, esposa e nome de respeito. Só o nome me sobrou.", "Fui cantor de taverna, até a voz acabar junto com a sorte."],
};
const FEAR = ["De morrer sozinho numa vala, sem ninguém saber meu nome.", "Da escuridão, desde menino. Piorou agora.", "De que o culto venha me buscar por saber demais.", "De perder o que ainda me resta de gente querida.", "Da fome, a de verdade, a que muda o jeito de pensar.", "Do silêncio depois do alarme, quando ninguém grita mais.", "De adoecer e virar fardo.", "Da minha própria raiva, quando perco a paciência."];
const DESIRE = ["Quero ver a paz antes de morrer.", "Queria juntar o suficiente pra deixar estas terras.", "Só queria um inverno sem enterro.", "Sonho com uma casa de pedra, sem goteira.", "Quero ver meus filhos crescerem longe da guerra.", "Queria voltar a ouvir minha mãe me chamar pro jantar.", "Quero abrir meu próprio negócio, mesmo que seja uma banquinha.", "Queria ter coragem de pedir perdão a quem eu magoei."];
const SECRET = [
  "Escondi um saco de moedas sob a terceira tábua do chão, e nunca contei a ninguém.",
  "Fui eu quem deixou o portão aberto na noite da invasão, sem querer. Ainda carrego isso.",
  "Não sou quem digo ser. Mudei de nome quando cheguei aqui.",
  "Já vendi informação para gente de máscara. Uma única vez, e me arrependo todo dia.",
  "Sei onde fica um poço seco que serve de esconderijo, e ele não está vazio.",
  "Jurei proteger alguém e não consegui. Digo que foi a doença, mas não foi.",
  "Escrevo cartas que nunca envio, para alguém que já morreu.",
  "Já vi o Grão-Mestre. Ele sorria. Isso me tira o sono.",
];
const REGRET = ["Briguei com meu irmão pouco antes de ele partir, e nunca me desculpei.", "Deixei de ajudar um vizinho que depois morreu de fome.", "Disse palavras duras ao meu pai no leito de morte.", "Larguei o ofício que eu amava por dinheiro fácil.", "Calei quando devia ter gritado, e alguém pagou o preço."];
const TEMPER = ["gentil", "ríspido", "nervoso", "brincalhão", "devoto", "amargo"];

function bioOf(ctx) {
  if (ctx.p._bio) return ctx.p._bio;
  const r = rng(hash(ctx.npc.name + "|bio"));
  const k = ctx.k;
  const others = ctx.civilians.filter((o) => o.name !== ctx.npc.name);
  const sameVillage = others.filter((o) => o.village === ctx.village);
  const poolOthers = sameVillage.length ? sameVillage : others;
  const pickO = () => (poolOthers.length ? poolOthers[(r() * poolOthers.length) | 0] : null);
  const rel = pickO();
  const debtTo = pickO();
  const relKinds = [
    ["amigo de infância", "crescemos juntos e dividimos o primeiro pão roubado"],
    ["rival", "brigamos por causa de uma terra e nunca fizemos as pazes"],
    ["antigo amor", "tivemos algo, antes de a guerra bagunçar tudo"],
    ["compadre", "fui padrinho do filho dele, e ele do meu"],
    ["desafeto", "ele me deve um favor e finge que esqueceu"],
  ];
  const rk = relKinds[(r() * relKinds.length) | 0];
  const b = {
    temper: TEMPER[(r() * TEMPER.length) | 0],
    family: FAMILY[(r() * FAMILY.length) | 0],
    past: (PAST[k] || PAST.commoner)[(r() * 3) | 0],
    fear: FEAR[(r() * FEAR.length) | 0],
    desire: DESIRE[(r() * DESIRE.length) | 0],
    secret: SECRET[(r() * SECRET.length) | 0],
    regret: REGRET[(r() * REGRET.length) | 0],
    debt: debtTo ? { amount: 15 + ((r() * 8) | 0) * 5, to: debtTo.name } : null,
    rel: rel ? { name: rel.name, kind: rk[0], story: rk[1] } : null,
    hasDebt: r() < 0.5,
  };
  ctx.p._bio = b;
  return b;
}

// estilo por temperamento: o mesmo conteúdo, voz de cada indivíduo
function style(ctx, text) {
  const t = bioOf(ctx).temper;
  if (!text) return text;
  if (t === "nervoso" && R() < 0.6) return "E-eu... " + text.charAt(0).toLowerCase() + text.slice(1);
  if (t === "ríspido" && R() < 0.5) return text.split(/(?<=[.!?])\s/)[0];
  if (t === "brincalhão" && R() < 0.45) return text + pick([" Hehe.", " Ri, é melhor que chorar.", " Mas eu não me levo muito a sério."]);
  if (t === "amargo" && R() < 0.45) return text + pick([" Mas quem se importa.", " Não que mude alguma coisa.", " Enfim."]);
  if (t === "devoto" && R() < 0.45) return text + pick([" Deus proverá.", " Que Deus nos guarde.", " Entrego nas mãos do Senhor."]);
  return text;
}

// ---------------------------------------------------------------------------
// utilidades do compositor
// ---------------------------------------------------------------------------
function wpick(items) {
  let tot = 0;
  for (const i of items) tot += i.w;
  let r = R() * tot;
  for (const i of items) { r -= i.w; if (r <= 0) return i; }
  return items[0];
}

function evilBand(e) {
  return e < 15 ? "welcome" : e < 40 ? "normal" : e < 65 ? "wary" : e < 85 ? "afraid" : "contempt";
}
function chaBand(c) {
  return c <= 7 ? "low" : c >= 13 ? "high" : "mid";
}

// lista de modificadores aplicáveis ao contexto (cada um já sorteia 1 variante sem repetir)
function modifiers(ctx) {
  const m = [];
  const add = (w, key, extra) => m.push({ w, key, extra });
  const eb = evilBand(ctx.evil);
  const cb = chaBand(ctx.cha);
  if (ctx.grief) add(5, "grief");
  if (ctx.hungry) add(3, "hungry");
  if (ctx.happy) add(3, "happy");
  if (ctx.scared) add(4, "scared");
  if (eb === "welcome") add(2, "evilWelcome");
  if (eb === "wary") add(4, "evilWary");
  if (eb === "afraid") add(6, "evilAfraid");
  if (eb === "contempt") add(6, "evilContempt");
  if (cb === "high") add(3, "chaHigh");
  if (cb === "low") add(3, "chaLow");
  if (ctx.templar) add(4, "templar");
  if (ctx.wanted) add(5, "wanted");
  if (ctx.cultRobe) add(7, "cultRobe");
  if (ctx.hurt) add(3, "hurt");
  if (ctx.candle) add(1, "candle");
  if (ctx.mounted) add(1, "mounted");
  if (ctx.armed) add(2, "armed");
  if (ctx.fogLevel >= 3) add(4, "fogHeavy");
  else if (ctx.fogLevel >= 2) add(2, "fogMild");
  if (ctx.eclipse) add(7, "eclipse");
  if (ctx.decay > 0.6) add(3, "decayHigh");
  else if (ctx.decay > 0.3) add(2, "decayMid");
  if (ctx.nearChurch) add(1, "church");
  if (ctx.nearGate) add(1, "gate");
  if (ctx.guardsNear) add(1, "guards");
  else if (ctx.location !== "capital" && ctx.k !== "guard") add(1, "noGuards");
  add(1, ctx.location === "capital" ? "capital" : "village");
  return m;
}

function applyMods(ctx, count = 1) {
  const items = modifiers(ctx);
  const out = [];
  const used = new Set();
  for (let i = 0; i < count && items.length; i++) {
    const cand = items.filter((x) => !used.has(x.key));
    if (!cand.length) break;
    const chosen = wpick(cand);
    used.add(chosen.key);
    out.push(ctx.say(MOD[chosen.key]));
  }
  return out;
}

function timeLine(ctx) {
  const voice = TIME_VOICE[ctx.k]?.[ctx.timeBucket];
  if (voice && R() < 0.65) return ctx.say(voice);
  return ctx.say(TIME_LINES[ctx.timeBucket]);
}

function gestureFor(ctx, force = false) {
  if (ctx.selfSick) return pick(GEST_SICK);
  if (!force && R() > 0.55) return "";
  if (ctx.scared && R() < 0.5) return pick(GEST_FEAR);
  if ((ctx.grief || ctx.mood === "Abatido") && R() < 0.4) return pick(GEST_SAD);
  if (ctx.happy && R() < 0.4) return pick(GEST_HAPPY);
  if ((ctx.timeBucket === "night" || ctx.timeBucket === "lateNight") && R() < 0.45) return pick(GEST_NIGHT);
  return pick(GEST[ctx.k] || GEST.commoner);
}

// ---------------------------------------------------------------------------
// eventos recontados + ganchos
// ---------------------------------------------------------------------------
const EVENT_INTRO = {
  guard: ["Pelo que consta nos relatórios:", "Segundo o capitão:"],
  smith: ["Ouvi no balcão:", "O freguês de ontem contou:"],
  merchant: ["Olha, correu pela praça:", "Cliente meu me disse:"],
  farmer: ["Contaram na roça:", "A vizinha jurou que:"],
  messenger: ["Passei por lá agorinha:", "Cartas dizem que:"],
  commoner: ["Dizem por aí:", "A vizinhança comenta:"],
  priest: ["Chegou-me aos ouvidos:", "Na confissão, sem quebrar o sigilo, sei que:"],
  beggar: ["Eu escuto tudo, sabia?", "Quem pede esmola escuta primeiro:"],
};
function eventTopic(ev) {
  switch (ev.type) {
    case "death": return { kind: "dead", data: ev };
    case "cult": return { kind: "cult", data: ev };
    case "sick": return { kind: "sick", data: ev };
    case "shortage": return { kind: "shortage", data: ev };
    case "fight": return { kind: "fight", data: ev };
    case "traveler": return { kind: "traveler", data: ev };
    case "wolves": return { kind: "wolves", data: ev };
    case "war": return { kind: "war", data: ev };
    default: return null;
  }
}

const HOOK_LABEL = {
  dead: ["Quem era ele?", "Como foi?"],
  cult: ["O que você viu?"],
  cultwho: ["E quem são eles?"],
  deadhow: ["Como foi?"],
  sick: ["Ele vai ficar bom?", "Posso ajudar?"],
  shortage: ["Falta tanto assim?"],
  fight: ["O que houve entre eles?"],
  traveler: ["O que ele contou?"],
  wolves: ["Chegou a ver os lobos?"],
  war: ["Como a guerra chegou aqui?"],
  family: ["E sua família?"],
  past: ["Como foi isso?"],
  fear: ["Por que tem medo disso?"],
  desire: ["O que te impede?"],
  rel: ["O que houve entre vocês?"],
  debt: ["Quanto você deve?"],
  regret: ["Quer falar sobre isso?"],
  secret: ["Por que me contou isso?"],
  funeral: ["Como foi o funeral?"],
};

function makeHooks(ctx, topics, max = 2) {
  const out = [];
  const seen = new Set();
  for (const tp of topics) {
    if (!tp || seen.has(tp.kind) || out.length >= max) continue;
    seen.add(tp.kind);
    const label = HOOK_LABEL[tp.kind]?.[0];
    if (label) out.push({ id: "h:" + tp.kind, label, data: tp.data || null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// respostas base
// ---------------------------------------------------------------------------
function replyHow(ctx) {
  const topics = [];
  let t;
  if (ctx.trust < 12 && ctx.evil > 60) {
    t = ctx.say(["Bem. Por que quer saber?", "Vou indo. Não costumo contar minha vida pra desconhecido.", "Estou aqui, não estou? Isso basta."]);
  } else {
    t = ctx.say(HOW[ctx.k]?.[ctx.ph] || HOW.commoner[ctx.ph]);
    if (ctx.ph === "war") topics.push({ kind: "war" });
    if (R() < 0.7) {
      // 1-2 modificadores de cenário (hora, humor, evil, carisma, clima, local, estado do jogador...)
      const mods = applyMods(ctx, R() < 0.35 ? 2 : 1);
      if (mods.length) t += " " + mods.join(" ");
      if (ctx.grief) topics.push({ kind: "dead", data: ctx.griefData });
      if (ctx.hungry) topics.push({ kind: "shortage" });
      if (ctx.scared && ctx.cultNear) topics.push({ kind: "cult" });
    }
    // prefixo de hora se for noite/madrugada
    if (ctx.timeBucket === "night" || ctx.timeBucket === "lateNight") t = timeLine(ctx) + " " + t;
    // um evento recente, às vezes (com gancho ligado a ele)
    if (!topics.length || R() < 0.4) {
      const ev = ctx.events[0];
      if (ev && R() < 0.65) {
        t += ` ${pick(EVENT_INTRO[ctx.k] || EVENT_INTRO.commoner)} ${ev.text}`;
        const et = eventTopic(ev);
        if (et) topics.unshift(et);
      }
    }
    if (ctx.k === "priest" && ctx.funeral) topics.unshift({ kind: "funeral" });
    if (ctx.trust >= 55 && R() < 0.4) t += " " + pick(["Que bom que você perguntou.", "Poucos perguntam de verdade.", "Obrigado por se importar."]);
  }
  return { n: gestureFor(ctx), t: style(ctx, t), topics };
}

function replyDay(ctx) {
  const topics = [];
  const parts = [timeLine(ctx)];
  if (ctx.fogLevel >= 2) parts.push(ctx.say(MOD[ctx.fogLevel >= 3 ? "fogHeavy" : "fogMild"]));
  if (ctx.eclipse) parts.push(ctx.say(MOD.eclipse));
  else if (ctx.decay > 0.3) parts.push(ctx.say(MOD[ctx.decay > 0.6 ? "decayHigh" : "decayMid"]));
  if (ctx.ph === "war") parts.push(pick(["Dia 1 da vida nova, e já tem luto nas portas.", "Mais um dia na guerra, mais um nome na lista."]));
  const ev = ctx.events[0];
  if (ev && R() < 0.55) {
    parts.push(`${pick(EVENT_INTRO[ctx.k] || EVENT_INTRO.commoner)} ${ev.text}`);
    const et = eventTopic(ev);
    if (et) topics.push(et);
  }
  const extra = applyMods(ctx, 1);
  if (extra.length && R() < 0.6) parts.push(extra[0]);
  return { n: gestureFor(ctx), t: style(ctx, parts.join(" ")), topics };
}

const HELP = {
  guard: ["Precisar, precisar... o que me ajudaria é uma noite sem alarme. Se achar bandidos, avise o capitão.", "Não preciso de nada. Quer ajudar? Fique longe do escuro sem tocha."],
  smith: ["Preciso de carvão e de silêncio. Se achar minério, traga, que eu pago.", "Ferro e lenha. Resolvo o resto."],
  merchant: ["Preciso de estrada limpa e de freguês. Traga madeira e pedra, que eu compro!", "Ajuda? Sempre! Na forma de moedas, de preferência, hehe."],
  farmer: ["Preciso de braços na colheita e de feno cortado, se puder. A foice ajuda bastante.", "Preciso de chuva, mas isso não está no seu poder."],
  messenger: ["Preciso de pernas novas, mas trocas ainda não inventaram! Se tiver recado pra levar, fale.", "Ajuda? Só se for pra me avisar quando a estrada estiver livre."],
  commoner: ["Preciso de trabalho e de paz. Se achar um, me avise.", "Ajuda? Ha. Aqui todo mundo pede, ninguém oferece."],
  priest: ["Preciso de velas, de paz e de braços para os enterros. Uma esmola ajuda a capela.", "O que me alivia é ver os doentes curados. Uma poção salva uma alma."],
  beggar: ["Preciso de tudo, patrão! Mas especialmente de uma moeda e de um ouvido que me escute.", "Ajuda? Uma moedinha compra um boato que vale ouro, hehe."],
};

function replyHelp(ctx) {
  const topics = [];
  let t;
  const hasWork = ["merchant", "smith", "priest", "farmer"].includes(ctx.k);
  if (ctx.sickOther) {
    t = pick([`Se puder, veja ${ctx.sickOther.name}: está mal, e poção de cura é raridade.`, `Preciso que alguém olhe ${ctx.sickOther.name}. Se tiver uma poção, é o momento.`, `${ctx.sickOther.name} está pior a cada dia. Uma poção faria diferença.`]);
    topics.push({ kind: "sick", data: { text: "", names: [ctx.sickOther.name] } });
  } else if (ctx.hungry) {
    t = pick(["Preciso de comida. Qualquer pão, qualquer grão. Se tiver feno ou trigo, ajuda os animais.", "A fome está apertando. Se puder dividir, agradeço.", "Se achar grão ou pão, pense em nós, por favor."]);
    topics.push({ kind: "shortage" });
  } else if (ctx.scared) {
    t = pick(["Preciso de alguém por perto até amanhecer. Você pode ficar um pouco?", "Preciso de coragem. Mas isso, eu mesmo preciso achar.", "Se ouvir algo estranho, grite. Eu faço o mesmo."]);
  } else {
    t = ctx.say(HELP[ctx.k] || HELP.commoner);
  }
  if (hasWork) t += pick([" (Veja a aba Ações.)", " O que posso oferecer está na aba Ações.", ""]);
  if (ctx.trust >= 55 && R() < 0.5) t += " " + pick(["Pra você, eu abro uma exceção.", "Você já fez mais por nós do que muita gente.", "Confio em você pra isso."]);
  if (ctx.cultRobe) t = "Ajuda? Não de você. " + t;
  return { n: gestureFor(ctx), t: style(ctx, t), topics };
}

// ---------------------------------------------------------------------------
// biografia por camadas ("Fale de você")
// ---------------------------------------------------------------------------
const LAYER_LOCKED = [
  "Já falei o que dava. Dê um tempo e a gente conversa mais.",
  "Por ora é isso. Não costumo abrir a vida pra qualquer um.",
  "Tem mais coisa, claro, mas isso a gente só conta a quem conhece direito.",
];

function unlockedLayer(ctx) {
  const talks = ctx.p.talks || 0;
  const t = ctx.trust;
  let L = 1;
  if (t >= 28 || talks >= 3) L = 2;
  if (t >= 52 || (ctx.cha >= 13 && talks >= 3 && t >= 35)) L = 3;
  if (t >= 76 && talks >= 6) L = 4;
  if (ctx.evil > 65 && L > 1) L -= 1;
  return L;
}

function bioLayer(ctx, layer) {
  const b = bioOf(ctx);
  const topics = [];
  let t = "";
  switch (layer) {
    case 1: {
      const job = {
        guard: "Sou guarda aqui.", smith: "Trabalho o ferro.", merchant: "Vendo de tudo um pouco.", farmer: "Cuido da terra.",
        messenger: "Levo recados pelas estradas.", commoner: "Faço o que aparecer.", priest: "Cuido da capela e dos que sofrem.", beggar: "Moro na praça, o resto é detalhe.",
      }[ctx.k] || "";
      t = `${job} ${ctx.p.age} anos nas costas. ${b.family}`;
      topics.push({ kind: "family" });
      break;
    }
    case 2:
      t = `${b.past} ${R() < 0.5 ? "Tenho medo " + b.fear.replace(/^De /, "de ").replace(/^Da /, "da ") : ""}`.trim();
      topics.push({ kind: "past" }, { kind: "fear" });
      break;
    case 3: {
      t = b.desire;
      if (b.rel) t += ` Sobre ${b.rel.name}: é meu ${b.rel.kind}. ${cap(b.rel.story)}.`;
      if (b.hasDebt && b.debt) t += ` Devo ${b.debt.amount} moedas a ${b.debt.to}, e isso me tira o sono.`;
      else t += ` ${b.regret}`;
      if (b.rel) topics.push({ kind: "rel" });
      if (b.hasDebt && b.debt) topics.push({ kind: "debt" });
      else topics.push({ kind: "regret" });
      break;
    }
    default:
      t = `Já que confio em você... ${b.secret}`;
      topics.push({ kind: "secret" });
  }
  return { t, topics };
}

function replyYou(ctx) {
  const L = unlockedLayer(ctx);
  const have = ctx.p.layer || 0;
  const next = have + 1;
  if (next > 4) {
    return { n: gestureFor(ctx), t: style(ctx, ctx.say(["Já te contei tudo que tinha pra contar. Quase tudo.", "Você já sabe mais de mim do que a maioria. Ninguém mais me conhece assim."])), topics: [] };
  }
  if (next > L) {
    // nada novo desbloqueado: reforça o último e sugere que há mais
    const prev = Math.max(1, have);
    const b = bioLayer(ctx, prev);
    return { n: pick(["*hesita, como quem guarda algo*", "*olha para você e depois para o chão*"]), t: style(ctx, ctx.say(LAYER_LOCKED)), topics: [{ kind: prev === 1 ? "family" : "past" }].slice(0, 1), bioLocked: true };
  }
  const { t, topics } = bioLayer(ctx, next);
  ctx.p.layer = next;
  return { n: next >= 3 ? pick(GEST_SAD) : gestureFor(ctx, true), t: style(ctx, t), topics, trustBonus: next };
}

// ---------------------------------------------------------------------------
// seguimentos (ganchos)
// ---------------------------------------------------------------------------
function followup(ctx, kind, data) {
  const b = bioOf(ctx);
  const topics = [];
  let t = "";
  switch (kind) {
    case "dead": {
      const d = ctx.dead[0];
      if (data?.names && data.names[0]) t = `${data.names[0]}, a gente se conhecia bem.`;
      else if (d) {
        t = `${d.name}. ${cap(d.cause)}. ${ctx.ph === "war" ? "Era mais um da lista, mas pra quem fica nunca é só número." : "A gente se acostuma com a notícia, nunca com a ausência."}`;
        topics.push({ kind: "deadhow", data: d });
      } else t = ctx.say(["Alguém que eu conhecia de vista. Não tenho muito a dizer.", "Um vizinho. Era boa gente, como quase todos."]);
      if (ctx.k === "priest") t += " Rezei por ele ao amanhecer.";
      break;
    }
    case "deadhow": {
      const d = data || ctx.dead[0];
      t = d ? `Foi ${d.cause}. Ninguém estava pronto. ${ctx.k === "guard" ? "Está registrado no livro da guarda." : "A vila ficou em silêncio por um dia inteiro."}` : "Foi rápido, dizem. Prefiro acreditar.";
      break;
    }
    case "cult": {
      const places = ctx.ghostNames;
      const base = {
        guard: "Mascarados parados na estrada, sem fazer nada, só olhando. Fiz relatório e mandaram eu não falar mais disso.",
        smith: "Encomendaram punhais curvos, pagaram à vista e sumiram. Ninguém faz isso por boa causa.",
        merchant: "Velas pretas e tinta vermelha esgotando por toda a região. Isso não é festa, é preparativo.",
        farmer: "Luz roxa no pasto velho, de madrugada. Os animais ficaram sem comer por dois dias.",
        messenger: "Homens de máscara branca, parados na estrada, sem mexer. Corri mais do que nunca na vida.",
        commoner: "Vi gente de máscara branca entrando numa casa abandonada. Não contei a ninguém até agora.",
        priest: "Soube de um jovem que foi até eles, procurando consolo, e voltou com olhar de morto. Rezo por ele.",
        beggar: "Pagam bem por esmola calada. Aceitei uma vez e vi uma fogueira roxa que ninguém acredita.",
      }[ctx.k] || "Vi coisas que prefiro não repetir.";
      t = base;
      if (ctx.trust >= 50 && places.length) t += ` Entre nós: mexem em ${pick(places)}, à noite.`;
      topics.push({ kind: "cultwho" });
      break;
    }
    case "cultwho":
      t = "Dizem que obedecem a um Grão-Mestre que ninguém viu de rosto. Os de máscara branca são os iniciados; os de olhos roxos, os que já se entregaram.";
      break;
    case "sick": {
      const s = ctx.sickOther || ctx.sick;
      t = s ? `${s.name}? Pelo andar da doença... se não chegar remédio, é questão de dias. Dizem que só poção de cura resolve.` : "Ninguém, graças a Deus. Toc na madeira.";
      break;
    }
    case "shortage":
      t = ctx.say(["Os grãos acabaram antes da colheita. O pão que tem custa o triplo. Quem pode compra, quem não pode reza.", "Faltou grão na vila inteira. Dividimos o que sobrou, mas quase ninguém come duas vezes por dia."]);
      break;
    case "fight":
      t = "Brigaram por teimosia, no fundo. Essas coisas viram guerra pequena entre vizinhos, e a gente nem consegue tomar partido.";
      break;
    case "traveler":
      t = "Contou que as estradas estão tomadas, que há vilas inteiras vazias a leste, e que uma ordem de máscaras está recrutando famintos.";
      topics.push({ kind: "cult" });
      break;
    case "wolves":
      t = "Ouvi uivos, vi olhos vermelhos no escuro e só. Dois currais ficaram revirados. Trancamos tudo cedo desde então.";
      break;
    case "war":
      t = ctx.say(["Começou com boatos na fronteira. Depois vieram os refugiados, depois a fome, e agora ninguém dorme de porta aberta.", "Os soldados levaram os rapazes, as tropas levaram o grão e sobrou o medo."]);
      topics.push({ kind: "dead" });
      break;
    case "family": {
      t = ctx.say([`${b.family} Mas não gosto de falar disso sem uma caneca na mão.`, "Minha família é o motivo de eu levantar cedo, mesmo quando não tenho vontade."]);
      if ((ctx.p.layer || 0) >= 2) topics.push({ kind: "past" });
      break;
    }
    case "past":
      t = `${b.past} ${ctx.p.layer >= 2 ? "Quem passa por isso muda o jeito de olhar pro mundo." : ""}`.trim();
      break;
    case "fear":
      t = `${b.fear} Não é frescura, sabe? É algo que carrego desde sempre.`;
      break;
    case "desire":
      t = `${b.desire} Mas sonhar sai de graça, e o resto custa caro.`;
      break;
    case "rel": {
      const r = b.rel;
      t = r ? `${r.name}... ${cap(r.story)}. Nem sempre é fácil estar na mesma vila.` : "Ninguém em especial. A guerra afastou quase todos.";
      if (r) {
        const other = ctx.findNPC?.(r.name);
        if (other && other.alive === false) t += " E agora ele se foi. Não sei o que sinto.";
      }
      break;
    }
    case "debt": {
      const d = b.debt;
      t = d ? `${d.amount} moedas a ${d.to}. Pedi na época da geada e ainda não consegui pagar. Ele nunca cobrou, e é isso que dói mais.` : "Já devi, e paguei. Hoje durmo melhor.";
      break;
    }
    case "regret":
      t = `${b.regret} Se eu pudesse voltar um dia só, seria esse.`;
      break;
    case "secret":
      t = ctx.say(["Porque você me parece alguém que não vai usar isso contra mim. E porque a gente não aguenta carregar tudo sozinho.", "Porque você ajudou quando ninguém ajudou. É a minha forma de agradecer."]);
      break;
    case "funeral": {
      const f = ctx.funeral;
      t = f ? `Rezei o funeral de ${f.name} ao amanhecer. A família ficou até o fim, e foi bonito, dentro do que a dor permite.` : "Não há funeral marcado. Que continue assim.";
      break;
    }
    default:
      t = "...";
  }
  return { n: gestureFor(ctx), t: style(ctx, t), topics: topics.filter(Boolean) };
}

// ---------------------------------------------------------------------------
// saudação
// ---------------------------------------------------------------------------
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
const GREET_TIME = {
  dawn: ["Madrugador, hein? Bom dia.", "O dia mal começou e já tem gente de pé."],
  morning: ["Bom dia.", "Bom dia, viajante."],
  noon: ["Boa tarde. Calor, né?", "Meio-dia e o sol queimando."],
  afternoon: ["Boa tarde.", "Boa tarde, viajante."],
  dusk: ["Boa noite chegando. O que o traz a esta hora?", "Já é quase noite, hein."],
  night: ["Boa noite. Tarde para andar sozinho, não?", "É noite, viajante. Seja breve."],
  lateNight: ["A esta hora? Você tem coragem ou desespero.", "Madrugada. Se está aqui, tem motivo."],
};

function greeting(ctx) {
  const p = ctx.p;
  const first = (p.met || 0) <= 1;
  if (ctx.selfSick) return { n: pick(GEST_SICK), t: "Coff... viajante... me perdoe, não estou bem." };
  let t;
  if (ctx.cultRobe || ctx.wanted) t = ctx.say(["Eu... não quero problemas. Diga logo o que quer.", "*recua um passo* Fale baixo. O que quer de mim?", "Não sei quem você é e prefiro não saber. Seja breve."]);
  else if (ctx.evil > 70 && ctx.trust < 40) t = ctx.say(["Você... ouvi coisas ruins sobre você. Seja breve.", "Não sei o que você fez, mas dizem que fez. Fale logo.", "Pelo menos ainda fala comigo. Diga, antes que mude de ideia."]);
  else if (ctx.templar) t = ctx.say(["Cavaleiro! Que bom ver alguém jurado a algo bom neste reino.", "Saudações, templário. A cruz no seu peito me dá algum alívio.", "Bem-vindo, senhor. Que Deus guie sua espada."]);
  else if (first) t = (R() < 0.45 ? ctx.say(GREET_TIME[ctx.timeBucket]) + " " : "") + ctx.say(FIRST_MEET[ctx.k] || FIRST_MEET.commoner);
  else if (ctx.trust >= 60) t = ctx.say(["Ah, você de novo! Que bom. Senta, conta como andam as coisas.", "Meu amigo! Sorte te encontrar. O que há de novo?", "Eu estava justamente pensando em você. Chegue mais."]);
  else t = ctx.say(["De novo por aqui? Hm. Fale.", "Voltou. Diga, no que posso ajudar?", "Sim? O que deseja agora?", ctx.say(GREET_TIME[ctx.timeBucket])]);
  if (!first && ctx.scared && R() < 0.4) t += " " + pick(MOD.scared);
  return { n: gestureFor(ctx), t: style(ctx, t) };
}

const BYE = {
  guard: ["Cuide-se. A noite é longa.", "Circule com cuidado, viajante.", "Se vir algo estranho, avise a guarda."],
  smith: ["Hm. Até.", "Volte quando precisar de ferro.", "Vá. Tenho brasa esfriando."],
  merchant: ["Volte sempre! Meu balcão é seu!", "Que os preços lhe sejam gentis!", "Leve uma vela, de brinde! ...mentira, hehe."],
  farmer: ["Vá com Deus. E olhe o céu.", "Até, e não pise na roça!", "Volte quando o milho estiver alto."],
  messenger: ["Tenho que ir! Até!", "Boa estrada!", "Corra se for preciso!"],
  commoner: ["Até mais. Cuide-se.", "Vá em paz.", "Se precisar, sabe onde me achar."],
  priest: ["Que a graça te acompanhe, filho.", "Vai com Deus, e volta quando precisares.", "Rezarei por ti esta noite."],
  beggar: ["Se lembrar de mim, deixa uma moeda. *sorri*", "Até mais, patrão!", "A praça é minha, mas a estrada é sua."],
};

function byeLine(ctx) {
  let t = ctx.say(BYE[ctx.k] || BYE.commoner);
  if ((ctx.timeBucket === "night" || ctx.timeBucket === "lateNight") && R() < 0.4) t += " " + pick(["E fique perto das tochas.", "Cuidado no escuro.", "Que a noite seja gentil."]);
  if (ctx.trust >= 60 && R() < 0.4) t += " " + pick(["Volte logo.", "Senti falta da sua conversa.", "Você é sempre bem-vindo."]);
  return t;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const BASE_QUESTIONS = [
  { id: "how", label: "Como vai?" },
  { id: "day", label: "Como está o dia?" },
  { id: "you", label: "Fale de você" },
  { id: "help", label: "Precisa de ajuda?" },
];

export function replyTo(ctx, qid, data) {
  if (ctx.selfSick && qid !== "bye") {
    const stage = Math.min(2, ctx.sickStage || 0);
    const lines = [
      ["Coff... é só uma tosse, passa. Eu... coff... acho que passa.", "Estou meio fraco, mas é o frio. Só o frio."],
      ["A febre não larga. Não consigo comer. Rezo pra amanhecer melhor.", "Tudo dói. Se tiver uma poção de cura, viajante... eu pagaria com o que tenho."],
      ["Eu... não sinto mais as mãos. Diga à minha família que eu... coff... tentei.", "Está escuro, mesmo de dia. Por favor... uma poção."],
    ][stage];
    return { n: pick(GEST_SICK), t: ctx.say(lines), topics: [] };
  }
  if (qid === "bye") return { n: "", t: byeLine(ctx), topics: [], bye: true };
  if (qid.startsWith("h:")) return followup(ctx, qid.slice(2), data);
  if (qid === "how") return replyHow(ctx);
  if (qid === "day") return replyDay(ctx);
  if (qid === "you") return replyYou(ctx);
  if (qid === "help") return replyHelp(ctx);
  return { n: "", t: "...", topics: [] };
}

export { greeting, makeHooks, timeBucket, evilBand, chaBand, GEST_SICK };
