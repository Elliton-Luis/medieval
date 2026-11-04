import * as THREE from "three";
import { PlayerStats, PlayerInventory, syncPlayerStatsToPlayer } from "./rpg.js";

// ============================================================================
// Tractatus de Carcere · O Livro do Barro
// (Livro da Seita do Demiurgo oculto em posição aleatória persistida por save)
// ============================================================================

export const DEMIURGE_BOOK_SPOTS = [
  {
    id: 0,
    name: "Cemitério da Igreja",
    x: -16.8,
    z: -12.5,
    hint: "Vi vultos de bico de pássaro sussurrando entre as lápides frias do cemitério atrás da igreja de Caldera.",
  },
  {
    id: 1,
    name: "Beco da Taverna",
    x: 10.5,
    z: -17.5,
    hint: "Dizem que o Livro do Barro foi jogado atrás dos barris de vinho no beco escuro da taverna da praça.",
  },
  {
    id: 2,
    name: "Alcova do Velho Poço",
    x: 2.2,
    z: -8.8,
    hint: "Na calada da noite vi um brilho carmesim e cheiro de terra velha pulsando na base do poço central da vila.",
  },
  {
    id: 3,
    name: "Entulho do Ferreiro",
    x: -21.0,
    z: 14.5,
    hint: "O ferreiro jurou que deixaram um códice encadernado em couro áspero sob a escória atrás de sua forja.",
  },
  {
    id: 4,
    name: "Bancas do Mercado Antigo",
    x: -8.0,
    z: -23.5,
    hint: "Um viajante de capa escura esqueceu um tomo que cheira a cobre sob os caixotes do mercado velho.",
  },
  {
    id: 5,
    name: "Portão da Muralha Sul",
    x: 5.5,
    z: -38.0,
    hint: "Guardas encontraram marcas de sangue oxidado e um tomo com páginas de pergaminho irregular perto do grande portão.",
  },
];

let _currentSpotIndex = 0;
let _demiurgeBookGroup = null;
let _bookLight = null;
let _cachedScene = null;
let _cachedWorld = null;
let _isCollected = false;

// Flags de efeitos desencadeados pela leitura de páginas específicas
let _hasReadPage2 = false;
let _hasReadPage19 = false;

// ============================================================================
// As 20 Páginas do Tractatus de Carcere
// ============================================================================
export const DEMIURGE_DIARY_PAGES = [
  // --- PÁGINAS 1 A 4: A GÊNESE DO ABORTO CÓSMICO ---
  {
    id: 1,
    chapter: "GÊNESE DO ABORTO CÓSMICO · I",
    title: "O Pleroma e a Centelha",
    stateLabel: "Estado: Folha rasgada e puída nas bordas",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-torn-fragment">
        <p class="diary-lead">«No princípio, não havia a Terra, mas o Pleroma, o abismo de pura luz silenciosa e imóvel...»</p>
        <p class="diary-text">«O desastre começou com um pensamento errante. Uma centelha rebelde tentou espelhar a glória do Todo e, nesse delírio de vaidade, pariu a anomalia...»</p>
        <div class="diary-torn-tear-line">[O restante da página foi violentamente arrancado]</div>
      </div>
    `,
  },
  {
    id: 2,
    chapter: "GÊNESE DO ABORTO CÓSMICO · II",
    title: "O Arquiteto Cego",
    origin: "Encontrada em uma capela saqueada",
    stateLabel: "Estado: Bordas queimadas, cheiro forte de enxofre",
    isLegible: true,
    pageType: "page2_blind_architect",
    svg: `
      <svg viewBox="0 0 320 210" class="diary-illustration-svg" style="width:100%;max-height:170px;">
        <defs>
          <radialGradient id="mudSpill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#3d2112"/>
            <stop offset="60%" stop-color="#1f1109"/>
            <stop offset="100%" stop-color="#000"/>
          </radialGradient>
        </defs>
        <!-- Serpente enroscada sobre si mesma com escamas de rostos humanos gritando -->
        <path d="M 60 160 Q 40 100 90 70 Q 150 40 210 75 Q 260 110 230 160 Q 180 200 120 175 Q 80 150 110 115 Q 160 85 200 120 Q 210 150 170 165 Z" fill="none" stroke="#2b231d" stroke-width="18" stroke-linecap="round"/>
        <!-- Rostos agonizantes nas escamas -->
        <g fill="#a3927d" font-size="8" font-family="sans-serif">
          <circle cx="70" cy="130" r="3"/>
          <circle cx="76" cy="130" r="3"/>
          <ellipse cx="73" cy="137" rx="3.5" ry="5" fill="#1c1612"/>
          <circle cx="120" cy="65" r="3"/>
          <circle cx="126" cy="65" r="3"/>
          <ellipse cx="123" cy="72" rx="3.5" ry="5" fill="#1c1612"/>
          <circle cx="230" cy="120" r="3"/>
          <circle cx="236" cy="120" r="3"/>
          <ellipse cx="233" cy="127" rx="3.5" ry="5" fill="#1c1612"/>
          <circle cx="150" cy="170" r="3"/>
          <circle cx="156" cy="170" r="3"/>
          <ellipse cx="153" cy="177" rx="3.5" ry="5" fill="#1c1612"/>
        </g>
        <!-- Cabeça de Leão Cego sem olhos de boca aberta -->
        <ellipse cx="160" cy="60" rx="26" ry="24" fill="#36291f" stroke="#1c1510" stroke-width="2"/>
        <!-- Juba de leão espinhosa -->
        <path d="M 130 50 L 120 35 L 138 42 L 140 25 L 152 38 L 160 20 L 168 38 L 180 25 L 182 42 L 200 35 L 190 50 L 205 60 L 190 70 L 202 85 L 185 85" fill="none" stroke="#241b14" stroke-width="2.5"/>
        <!-- Órbitas cegas seladas sem pupilas -->
        <line x1="148" y1="52" x2="156" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="164" y1="52" x2="172" y2="52" stroke="#000" stroke-width="3"/>
        <!-- Boca escancarada vomitando lama sobre a esfera perfeita -->
        <path d="M 148 68 Q 160 92 172 68 Z" fill="#120505"/>
        <!-- Lama negra/terra escorrendo -->
        <path d="M 152 75 Q 160 115 158 140 Q 160 150 162 140 Q 168 115 168 75 Z" fill="url(#mudSpill)"/>
        <!-- A Esfera Perfeita sendo maculada -->
        <circle cx="160" cy="145" r="22" fill="#d9cbb2" stroke="#544332" stroke-width="1.8"/>
        <!-- Mancha de lama sobre a esfera -->
        <path d="M 148 135 Q 160 148 172 135 Q 168 158 152 155 Z" fill="#2b1a11"/>
      </svg>
    `,
    html: `
      <div class="diary-legible-box">
        <p class="diary-lead">«[...] no delírio de vaidade, pariu a anomalia: Rex Mundi, o Arquiteto Cego. A matéria não é criação, é um tumor. O Demiurgo roubou a luz e a trancou em gaiolas de osso. Comer, beber e copular são engrenagens da máquina. Nascer é o verdadeiro pecado original. Olhe para as suas mãos: elas apodrecem enquanto você [...]»</p>
      </div>
      <div class="diary-effect-badge">✦ Efeito: Revelação do Arquiteto Cego · Visão dessaturada por 3 segundos após a leitura.</div>
    `,
  },
  {
    id: 3,
    chapter: "GÊNESE DO ABORTO CÓSMICO · III",
    title: "O Primeiro Matadouro",
    stateLabel: "Estado: Manchada por cinzas e sangue oxidado",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-stained-fragment">
        <p class="diary-text">«A matéria não é uma criação, é um erro, um tumor no vazio perfeito. O Demiurgo, invejoso da luz que não podia compreender, roubou fragmentos do Pleroma e os aprisionou em gaiolas de carne e osso. O Éden não foi um paraíso, mas o primeiro matadouro...»</p>
        <p class="diary-text">«...A serpente da árvore não era o mal, era o mensageiro da verdadeira divindade sussurrando: "A casca é uma mentira"...»</p>
      </div>
    `,
  },
  {
    id: 4,
    chapter: "GÊNESE DO ABORTO CÓSMICO · IV",
    title: "A Escravidão do Solo",
    stateLabel: "Estado: Tinta borrada por umidade antiga",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-stained-fragment">
        <p class="diary-text">«...Comer, beber, respirar, copular — cada ato biológico é uma engrenagem na máquina de moer almas de Rex Mundi. A fome foi inventada para que fôssemos escravos do solo. O amor carnal foi forjado para gerar novos prisioneiros...»</p>
      </div>
    `,
  },

  // --- PÁGINAS 5 A 8: A ENDURA E A NEGAÇÃO DA FORMA ---
  {
    id: 5,
    chapter: "A ENDURA E A NEGAÇÃO DA FORMA · I",
    title: "O Ódio ao Reflexo",
    stateLabel: "Estado: Bordas queimadas e desfiadas",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-torn-fragment">
        <p class="diary-lead">«Para enxergar além do barro, o devoto deve primeiro odiar o próprio reflexo. A dor não purifica, mas anestesia os instintos colocados em nós pelo Criador Menor...»</p>
      </div>
    `,
  },
  {
    id: 6,
    chapter: "A ENDURA E A NEGAÇÃO DA FORMA · II",
    title: "O Jejum das Sombras",
    stateLabel: "Estado: Pergaminho puído e cinzento",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-stained-fragment">
        <p class="diary-text">«...O iniciado começa com o Jejum das Sombras. Durante doze dias, ele deve ingerir apenas água misturada com cinzas de madeira queimada, para lembrar ao estômago que a terra é estéril...»</p>
      </div>
    `,
  },
  {
    id: 7,
    chapter: "A ENDURA E A NEGAÇÃO DA FORMA · III",
    title: "A Máscara e o Jejum",
    origin: "Encontrada no cadáver de um mercador na estrada",
    stateLabel: "Estado: Rasgada ao meio, com manchas de sangue seco",
    isLegible: true,
    pageType: "page7_mask_and_fasting",
    svg: `
      <svg viewBox="0 0 320 210" class="diary-illustration-svg" style="width:100%;max-height:170px;">
        <!-- Sol Negro no Céu -->
        <circle cx="230" cy="45" r="24" fill="#0d080a" stroke="#8c1c1c" stroke-width="2"/>
        <g stroke="#6e1515" stroke-width="1.4" fill="none">
          <line x1="230" y1="15" x2="230" y2="5"/>
          <line x1="230" y1="75" x2="230" y2="85"/>
          <line x1="200" y1="45" x2="190" y2="45"/>
          <line x1="260" y1="45" x2="270" y2="45"/>
          <line x1="208" y1="23" x2="201" y2="16"/>
          <line x1="252" y1="67" x2="259" y2="74"/>
        </g>
        <!-- Homem ajoelhado serrando os dedos da mão esquerda com faca cega -->
        <path d="M 85 180 L 105 145 L 125 155 L 140 180" stroke="#4a3b30" stroke-width="8" fill="none" stroke-linecap="round"/>
        <!-- Torso curvado em penitência -->
        <path d="M 115 145 L 128 105 L 142 110 L 132 150 Z" fill="#382d25"/>
        <!-- Braço esquerdo estendido apoiado na pedra -->
        <path d="M 125 110 L 150 125 L 175 125" stroke="#4a3b30" stroke-width="5" fill="none"/>
        <circle cx="180" cy="125" r="5" fill="#691212"/> <!-- Sangue na mão -->
        <!-- Braço direito serrando com lâmina -->
        <path d="M 132 110 L 155 105 L 178 122" stroke="#4a3b30" stroke-width="4.5" fill="none"/>
        <line x1="172" y1="116" x2="184" y2="128" stroke="#8a837a" stroke-width="3"/>
        <!-- Cabeça: Corvo usando máscara pontiaguda de couro observando o sol negro -->
        <ellipse cx="120" cy="90" rx="14" ry="12" fill="#141113"/>
        <!-- Bico longo cônico da máscara pontiaguda -->
        <polygon points="122,86 172,96 122,98" fill="#241b18" stroke="#120d0b" stroke-width="1.2"/>
        <!-- Lente escura fumê da máscara -->
        <circle cx="124" cy="91" r="3.5" fill="#080709" stroke="#997a4d" stroke-width="1"/>
      </svg>
    `,
    html: `
      <div class="diary-legible-box">
        <p class="diary-lead">«A veste não é adorno, é escudo. A máscara pontiaguda filtra o fedor da criação. Os olhos de vidro fumê nos impedem de ser seduzidos pela beleza do mundo inferior. [...] o Jejum das Sombras. Água e cinzas, para lembrar ao estômago que a terra é estéril. Aquele que ainda chora por um camponês morto ainda está acorrentado ao barro.»</p>
      </div>
      <div class="diary-effect-badge">✦ Conhecimento: O escudo dos Cátaros e sua frieza absoluta revelados.</div>
    `,
  },
  {
    id: 8,
    chapter: "A ENDURA E A NEGAÇÃO DA FORMA · IV",
    title: "O Vidro Fumê",
    stateLabel: "Estado: Manchada de seiva e carvão",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-stained-fragment">
        <p class="diary-text">«...O ar das cidades é denso de pecado e suor; o Cátaro Verdadeiro respira apenas a morte. Os olhos da máscara são de vidro fumê, pois olhar diretamente para a beleza do mundo — uma árvore frondosa, um cavalo galopando, o sorriso de uma criança — é ser seduzido pelas ilusões do Demiurgo. O fiel deve ver apenas a decadência...»</p>
      </div>
    `,
  },

  // --- PÁGINAS 9 A 14: OS SACRAMENTOS DA RUÍNA ---
  {
    id: 9,
    chapter: "OS SACRAMENTOS DA RUÍNA · I",
    title: "A Salvação pela Entropia",
    stateLabel: "Estado: Folha rasgada diagonalmente",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-torn-fragment">
        <p class="diary-lead">«A salvação só vem através da entropia. Os rituais não buscam agradar a Deus, mas agredir o Demiurgo...»</p>
      </div>
    `,
  },
  {
    id: 10,
    chapter: "OS SACRAMENTOS DA RUÍNA · II",
    title: "O Rito da Madeira Órfã",
    stateLabel: "Estado: Papel chamuscado e carcomido",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-stained-fragment">
        <p class="diary-text">«...A madeira é o pilar da falsa criação, enraizada no abismo. O sacerdote aponta árvores específicas fora das muralhas. Durante a lua nova, o tronco é ferido, e seiva fervente misturada com enxofre é derramada nas raízes...»</p>
      </div>
    `,
  },
  {
    id: 11,
    chapter: "OS SACRAMENTOS DA RUÍNA · III",
    title: "A Madeira Órfã",
    origin: "Encontrada cravada em uma árvore morta na floresta",
    stateLabel: "Estado: Papel úmido e manchado de seiva escura",
    isLegible: true,
    pageType: "page11_orphan_wood",
    svg: `
      <svg viewBox="0 0 320 210" class="diary-illustration-svg" style="width:100%;max-height:170px;">
        <!-- Troncos de árvores contorcidos em figuras humanas agonizantes com braços em forma de galhos -->
        <g stroke="#261b14" stroke-width="4.5" fill="none" stroke-linecap="round">
          <!-- Árvore Esquerda -->
          <path d="M 40 190 Q 55 130 50 100 Q 30 70 20 40 M 50 100 Q 70 70 80 45"/>
          <circle cx="50" cy="95" r="8" fill="#1f1510"/>
          <!-- Árvore Direita -->
          <path d="M 280 190 Q 265 130 270 100 Q 250 70 240 40 M 270 100 Q 290 70 300 45"/>
          <circle cx="270" cy="95" r="8" fill="#1f1510"/>
        </g>
        <!-- Pilha de cavalos mortos no centro -->
        <path d="M 110 180 Q 160 145 210 180 Z" fill="#38251b" stroke="#1f130c" stroke-width="2"/>
        <circle cx="125" cy="165" r="9" fill="#291a13"/> <!-- Cabeça de cavalo -->
        <path d="M 135 150 L 142 165 L 148 152" stroke="#24160f" stroke-width="2.5" fill="none"/>
        <!-- Três figuras encapuzadas atirando tochas -->
        <!-- Figura 1 (Esquerda) -->
        <path d="M 85 185 L 95 135 L 105 185 Z" fill="#120f14"/>
        <line x1="95" y1="145" x2="115" y2="135" stroke="#d68a29" stroke-width="2"/>
        <circle cx="118" cy="133" r="4.5" fill="#ff4411"/>
        <!-- Figura 2 (Centro-Fundo) -->
        <path d="M 155 165 L 160 120 L 168 165 Z" fill="#17131a"/>
        <circle cx="162" cy="116" r="3.5" fill="#ff6611"/>
        <!-- Figura 3 (Direita) -->
        <path d="M 215 185 L 225 135 L 235 185 Z" fill="#120f14"/>
        <line x1="225" y1="145" x2="205" y2="135" stroke="#d68a29" stroke-width="2"/>
        <circle cx="202" cy="133" r="4.5" fill="#ff4411"/>
        <!-- Fogueira e fumaça subindo -->
        <path d="M 140 160 Q 160 120 160 90 Q 180 130 180 160 Z" fill="#ff4411" opacity="0.85"/>
      </svg>
    `,
    html: `
      <div class="diary-legible-box">
        <p class="diary-lead">«[...] a madeira é o pilar da falsa criação. Derramar fogo nas raízes não é destruição, é libertar a luz. Três figuras atiraram tochas na pilha de [...] O sangue de um puro no fardo de feno virgem na encruzilhada leste. Os seis olhos amarelos brilharão na névoa. Se tremer diante do terror, sua carne será reclamada.»</p>
      </div>
      <div class="diary-effect-badge">✦ Ritual Revelado: Feno virgem e sangue inocente na encruzilhada leste atraem o Observador.</div>
    `,
  },
  {
    id: 12,
    chapter: "OS SACRAMENTOS DA RUÍNA · IV",
    title: "A Liturgia dos Seis Olhos",
    stateLabel: "Estado: Manchada de seiva avermelhada",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-stained-fragment">
        <p class="diary-text">«...O Observador não é nosso líder, mas o carcereiro do Demiurgo que enlouqueceu ao ver a verdade. Ele vaga pela neblina. Para invocá-lo e aprender seus segredos, o fiel deve permanecer imóvel. Se aceitar o abismo, ganhará a força do vento e a invisibilidade noturna...»</p>
      </div>
    `,
  },
  {
    id: 13,
    chapter: "OS SACRAMENTOS DA RUÍNA · V",
    title: "A Arma Quebrada",
    stateLabel: "Estado: Marcada por ferrugem e pontas cortadas",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-torn-fragment">
        <p class="diary-text">«O terceiro é a Consagração da Arma Quebrada. Uma lâmina perfeita serve aos reis da terra. O Cátaro quebra a ponta de sua adaga e a enterra no peito de um cão ou lobo...»</p>
      </div>
    `,
  },
  {
    id: 14,
    chapter: "OS SACRAMENTOS DA RUÍNA · VI",
    title: "A Ferrugem da Desintegração",
    stateLabel: "Estado: Pergaminho corroído por óxido marrom",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-stained-fragment">
        <p class="diary-text">«...A arma é deixada para enferrujar ao relento. Depois de sete luas, ela é recolhida. Seu corte causará febre, e a ferida nunca fechará, pois a ferrugem carrega o toque da desintegração...»</p>
      </div>
    `,
  },

  // --- PÁGINAS 15 A 17: A URGÊNCIA DA QUEDA ---
  {
    id: 15,
    chapter: "A URGÊNCIA DA QUEDA · I",
    title: "As Âncoras da Corrupção",
    stateLabel: "Estado: Comido por traças e poeira",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-torn-fragment">
        <p class="diary-lead">«O caos não pode ser aleatório; deve ser cirúrgico. As cidades, com suas muralhas, feiras e igrejas, são altares dedicados a Rex Mundi...»</p>
      </div>
    `,
  },
  {
    id: 16,
    chapter: "A URGÊNCIA DA QUEDA · II",
    title: "O Cerco do Silêncio",
    origin: "Encontrada enterrada perto das muralhas",
    stateLabel: "Estado: Suja de terra e parcialmente ilegível",
    isLegible: true,
    pageType: "page16_siege_of_silence",
    svg: `
      <svg viewBox="0 0 320 210" class="diary-illustration-svg" style="width:100%;max-height:170px;">
        <!-- Contorno do mapa da vila como a anatomia de um estômago humano -->
        <path d="M 80 50 Q 140 25 210 40 Q 260 70 250 130 Q 230 180 150 185 Q 70 175 60 115 Q 55 75 80 50 Z" fill="#2b1a1c" stroke="#872935" stroke-width="2.5" stroke-dasharray="4 3"/>
        <!-- Portas da cidade como dentes podres e pontiagudos -->
        <g fill="#d1be9b" stroke="#3d2719" stroke-width="1">
          <!-- Portão Norte -->
          <polygon points="135,32 140,46 145,32"/>
          <polygon points="146,32 151,46 156,32"/>
          <polygon points="157,32 162,46 167,32"/>
          <!-- Portão Sul -->
          <polygon points="140,185 145,172 150,185"/>
          <polygon points="152,185 157,172 162,185"/>
        </g>
        <!-- Casas da vila como dobras e vilosidades gástricas -->
        <g fill="#453133">
          <rect x="95" y="80" width="16" height="14" rx="2"/>
          <rect x="120" y="70" width="18" height="15" rx="2"/>
          <rect x="180" y="75" width="18" height="15" rx="2"/>
          <rect x="205" y="95" width="16" height="14" rx="2"/>
          <rect x="195" y="130" width="18" height="16" rx="2"/>
          <rect x="105" y="130" width="16" height="15" rx="2"/>
        </g>
        <!-- Igreja central desenhada como um coração anatômico -->
        <path d="M 160 95 C 160 85, 145 75, 135 88 C 120 105, 145 130, 160 145 C 175 130, 200 105, 185 88 C 175 75, 160 85, 160 95 Z" fill="#6e101b" stroke="#aa1c29" stroke-width="1.8"/>
        <!-- Três pregos de ferro perfurando o coração -->
        <g stroke="#1a181c" stroke-width="3" stroke-linecap="round">
          <line x1="120" y1="85" x2="155" y2="108"/>
          <line x1="160" y1="65" x2="160" y2="115"/>
          <line x1="200" y1="85" x2="165" y2="108"/>
        </g>
      </svg>
    `,
    html: `
      <div class="diary-legible-box">
        <p class="diary-lead">«As âncoras da corrupção são os sinos das igrejas [...] Para sufocar a cidade, crânios abençoados pelo Consolamentum Negro devem ser enterrados em um anel ao redor das muralhas. Cada morte injusta perto deles enfraquece o mundo material. Não atacaremos os portões; faremos os aldeões desconfiarem da própria sombra. A engrenagem quebrará de dentro para fora.»</p>
      </div>
      <div class="diary-effect-badge">✦ Conspiração: Assassinatos aceleram a ruína e os crânios são elos de desestabilização.</div>
    `,
  },
  {
    id: 17,
    chapter: "A URGÊNCIA DA QUEDA · III",
    title: "O Tumor da Paranoia",
    stateLabel: "Estado: Tinta escorrida e manchas de terra podre",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-stained-fragment">
        <p class="diary-text">«...Nós provocamos os guardas, sussurramos mentiras aos nobres, fazemos mercadores assassinarem camponeses por ouro. Quanto mais ódio, mais a densidade do mundo material enfraquece. O mundo não será conquistado por exércitos, mas por um tumor de paranoia...»</p>
      </div>
    `,
  },

  // --- PÁGINAS 18 A 20: O APOCALIPSE DO OLHO CEGO ---
  {
    id: 18,
    chapter: "O APOCALIPSE DO OLHO CEGO · I",
    title: "O Rompimento do Véu",
    stateLabel: "Estado: Pergaminho estaladiço e fissurado pelo calor",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-torn-fragment">
        <p class="diary-lead">«Quando o último sino for silenciado e o sangue empapar o perímetro dos crânios, o véu da mentira rasgará. O sol não se porá, mas apodrecerá no céu...»</p>
      </div>
    `,
  },
  {
    id: 19,
    chapter: "O APOCALIPSE DO OLHO CEGO · II",
    title: "O Eclipse",
    origin: "Entregue pelo Mensageiro de Cinzas",
    stateLabel: "Estado: Imaculada, escrita com tinta que parece brilhar na luz",
    isLegible: true,
    pageType: "page19_eclipse",
    svg: `
      <svg viewBox="0 0 320 210" class="diary-illustration-svg" style="width:100%;max-height:170px;">
        <defs>
          <linearGradient id="paleFire" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fff8db"/>
            <stop offset="60%" stop-color="#f5e18c"/>
            <stop offset="100%" stop-color="#998038"/>
          </linearGradient>
        </defs>
        <!-- Céu rachando como vidro -->
        <g stroke="#ffffff" stroke-width="1.8" opacity="0.85">
          <line x1="40" y1="10" x2="90" y2="45"/>
          <line x1="90" y1="45" x2="160" y2="25"/>
          <line x1="160" y1="25" x2="230" y2="55"/>
          <line x1="230" y1="55" x2="290" y2="15"/>
          <line x1="90" y1="45" x2="110" y2="90"/>
          <line x1="230" y1="55" x2="215" y2="95"/>
        </g>
        <!-- Braços esqueléticos gigantescos de anjos descendo do céu -->
        <g stroke="url(#paleFire)" stroke-width="5" fill="none" stroke-linecap="round">
          <!-- Braço 1 esmagando catedral esquerda -->
          <path d="M 80 20 L 75 70 L 60 120 L 50 155"/>
          <!-- Braço 2 esmagando catedral central -->
          <path d="M 160 15 L 165 75 L 155 125 L 160 160"/>
          <!-- Braço 3 esmagando torre direita -->
          <path d="M 240 20 L 245 70 L 260 120 L 270 155"/>
        </g>
        <!-- Catedrais sendo esmagadas -->
        <path d="M 35 185 L 50 150 L 65 185 Z" fill="#291a1f" stroke="#000"/>
        <path d="M 140 185 L 160 145 L 180 185 Z" fill="#291a1f" stroke="#000"/>
        <path d="M 255 185 L 270 150 L 285 185 Z" fill="#291a1f" stroke="#000"/>
        <!-- Pessoas derretendo em lodo negro no chão -->
        <path d="M 20 195 Q 80 180 160 190 Q 240 180 300 195 Z" fill="#140b0f"/>
        <!-- Almas subindo como esferas brilhantes -->
        <g fill="#ffe688">
          <circle cx="85" cy="155" r="5"/>
          <circle cx="115" cy="130" r="4"/>
          <circle cx="195" cy="140" r="5.5"/>
          <circle cx="225" cy="120" r="4"/>
          <circle cx="160" cy="95" r="6"/>
        </g>
      </svg>
    `,
    html: `
      <div class="diary-legible-box diary-illuminated">
        <p class="diary-lead">«Quando o último sino silenciar, o sol apodrecerá no céu. O Eclipse é a pupila do Demiurgo dilatando em puro terror. Braços de fogo pálido descerão para esmagar as catedrais. A carne derreterá. Nós não morreremos; retornaremos ao Todo, puros e informes. O mundo precisa morrer para que possamos viver.»</p>
      </div>
      <div class="diary-effect-badge" style="border-color:#ff4433; color:#ff7766;">✦ Prenúncio do Fim dos Tempos: A trilha sonora mudará ao fechar o tomo.</div>
    `,
  },
  {
    id: 20,
    chapter: "O APOCALIPSE DO OLHO CEGO · III",
    title: "O Abraço Final do Pleroma",
    stateLabel: "Estado: Última folha selada a chumbo",
    isTorn: true,
    svg: ``,
    html: `
      <div class="diary-torn-fragment">
        <p class="diary-text">«A aniquilação é o abraço final. Os bestiais gritarão enquanto a própria gravidade deixar de existir e suas casas virarem pó esmagador. Mas nós, os portadores do silêncio, os corvos da praga cósmica, abriremos os braços. Não sentiremos dor, pois a dor pertence à carne, e nós já nos despedimos dela há muito tempo. A fumaça subirá, e o Pleroma nos absorverá. A falha será corrigida. O universo voltará ao Nada perfeito.»</p>
      </div>
    `,
  },
  {
    id: 21,
    chapter: "SACRAMENTO OCULTO · FRAGMENTO MALDITO",
    title: "O Sacrifício Final",
    origin: "Recuperado nas cinzas das vilas arruinadas",
    stateLabel: "Estado: Folha rasgada, encharcada em tinta vermelha estourada",
    isTorn: true,
    pageType: "page21_final_sacrifice",
    svg: `
      <svg viewBox="0 0 320 220" class="diary-illustration-svg" style="width:100%;max-height:190px;">
        <defs>
          <radialGradient id="inkBurst" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#b30015"/>
            <stop offset="40%" stop-color="#73000f"/>
            <stop offset="75%" stop-color="#3d0006"/>
            <stop offset="100%" stop-color="#140002"/>
          </radialGradient>
        </defs>
        <!-- Fundo vermelho-sangue caótico simulando caneta de tinta estourada e manchas espirradas -->
        <rect x="0" y="0" width="320" height="220" fill="url(#inkBurst)" opacity="0.95" rx="6"/>
        <!-- Respingo violento de tinta vermelha -->
        <path d="M 160 110 Q 130 50 160 30 Q 190 70 230 40 Q 210 90 270 100 Q 220 120 240 170 Q 180 140 160 190 Q 140 140 80 170 Q 100 120 50 100 Q 110 90 90 40 Q 130 70 160 110 Z" fill="#e6001a" opacity="0.85"/>
        <circle cx="85" cy="45" r="7" fill="#80000a"/>
        <circle cx="245" cy="55" r="9" fill="#99000d"/>
        <circle cx="265" cy="155" r="11" fill="#8a000c"/>
        <circle cx="65" cy="165" r="8" fill="#7a000a"/>
        <circle cx="160" cy="20" r="6" fill="#cc0016"/>
        <!-- Gotas e respingos pontilhados -->
        <g fill="#ff1a30" opacity="0.9">
          <circle cx="130" cy="55" r="3"/>
          <circle cx="195" cy="65" r="2.5"/>
          <circle cx="210" cy="135" r="4"/>
          <circle cx="115" cy="145" r="3.5"/>
          <circle cx="175" cy="175" r="2.8"/>
          <circle cx="95" cy="90" r="3.2"/>
          <circle cx="230" cy="95" r="4.2"/>
        </g>
        <!-- Garrancho do título emergindo da mancha de sangue -->
        <text x="160" y="118" text-anchor="middle" font-family="'Cinzel', Georgia, serif" font-size="19" font-weight="bold" fill="#ffffff" letter-spacing="3" filter="drop-shadow(0px 0px 6px #000)">
          O SACRIFÍCIO FINAL
        </text>
        <line x1="60" y1="130" x2="260" y2="130" stroke="#000000" stroke-width="2.5" opacity="0.8"/>
      </svg>
    `,
    html: `
      <div class="diary-torn-fragment" style="background: rgba(140, 10, 20, 0.25); border: 2px dashed #991a24; padding: 18px; border-radius: 6px;">
        <h2 style="color: #ff3344; text-shadow: 0 0 10px rgba(255, 30, 30, 0.8); margin: 0 0 10px 0; text-align: center; letter-spacing: 3px;">
          O SACRIFÍCIO FINAL
        </h2>
        <div style="color: #f7b2b8; font-style: italic; font-size: 14.5px; line-height: 1.7; text-align: center;">
          [A folha está quase completamente destruída, empapada por um espesso estouro de tinta vermelha que parece ter explodido contra o pergaminho. Apenas o título permanece visível entre as marcas de garras e fuligem.]
        </div>
      </div>
    `,
  },
];

// ============================================================================
// CSS Estilizado do Tractatus de Carcere (O Livro do Barro)
// ============================================================================
const TRACTATUS_CSS = `
#demiurge-diary-overlay {
  position: fixed;
  inset: 0;
  background: rgba(3, 1, 4, 0.94);
  backdrop-filter: blur(10px);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  font-family: "Cinzel", "Cinzel Decorative", Georgia, serif;
}
#demiurge-diary-overlay.active {
  opacity: 1;
  pointer-events: auto;
}
.diary-book-wrapper {
  position: relative;
  width: 94%;
  max-width: 1020px;
  min-height: 640px;
  background: #140b09; /* Couro que cheira a terra velha e cobre */
  border: 4px solid #4a1912;
  border-radius: 10px;
  box-shadow: 0 0 70px rgba(0, 0, 0, 0.98), 0 0 35px rgba(160, 20, 20, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.diary-book-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: linear-gradient(90deg, #1f0a0c 0%, #3b1115 50%, #1f0a0c 100%);
  border-bottom: 2px solid #6b171c;
  color: #ebd3ba;
}
.diary-book-title-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14.5px;
  letter-spacing: 2px;
  color: #ff4d3b;
  text-shadow: 0 0 8px rgba(255, 60, 60, 0.6);
}
.diary-close-btn {
  background: #2b080c;
  border: 1px solid #7a181e;
  color: #e6ceb8;
  font-family: inherit;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.diary-close-btn:hover {
  background: #73131a;
  color: #fff;
  box-shadow: 0 0 10px rgba(255, 40, 50, 0.8);
}
.diary-page-viewport {
  flex: 1;
  display: flex;
  background: radial-gradient(circle at center, #1f120f 0%, #0d0605 100%);
  padding: 20px;
  position: relative;
  overflow-y: auto;
  max-height: 470px;
}
.diary-parchment-sheet {
  flex: 1;
  background: #cfbc94; /* Pergaminho irregular que arranha os dedos */
  color: #211310;
  border-radius: 4px;
  padding: 24px 30px;
  box-shadow: inset 0 0 45px rgba(60, 25, 15, 0.45), 0 4px 16px rgba(0, 0, 0, 0.7);
  position: relative;
  min-height: 400px;
  display: flex;
  flex-direction: column;
}
.diary-chapter-label {
  font-size: 11px;
  letter-spacing: 2.5px;
  color: #781c15;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.diary-page-heading {
  font-size: 21px;
  margin: 0 0 4px 0;
  color: #380f0b;
  letter-spacing: 1px;
}
.diary-state-badge {
  font-size: 11px;
  color: #634032;
  font-style: italic;
  margin-bottom: 12px;
  border-bottom: 1px dashed rgba(110, 40, 25, 0.4);
  padding-bottom: 5px;
}
.diary-origin-tag {
  color: #8c261e;
  font-weight: 600;
}
.diary-lead {
  font-size: 15px;
  font-style: italic;
  line-height: 1.65;
  color: #301410;
  margin-bottom: 12px;
}
.diary-text {
  font-size: 14px;
  line-height: 1.65;
  color: #26120e;
  margin-bottom: 10px;
}
.diary-illustration-svg {
  background: rgba(40, 25, 20, 0.12);
  border-radius: 4px;
  border: 1px solid rgba(120, 40, 30, 0.3);
  margin-bottom: 14px;
}

/* Caixa legível com destaque */
.diary-legible-box {
  background: rgba(255, 248, 235, 0.4);
  border-left: 3px solid #7d1c16;
  padding: 12px 16px;
  border-radius: 0 4px 4px 0;
  margin-bottom: 10px;
}
.diary-illuminated {
  background: rgba(255, 250, 220, 0.65);
  border-left-color: #bd3124;
  box-shadow: 0 0 15px rgba(255, 220, 120, 0.25);
}
.diary-effect-badge {
  font-size: 12px;
  color: #a8421e;
  background: rgba(30, 10, 8, 0.1);
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px dashed #9e361b;
  margin-top: auto;
}

/* Efeito de páginas rasgadas */
.diary-torn-fragment {
  position: relative;
  background: repeating-linear-gradient(45deg, #c4b087, #c4b087 10px, #bfa97e 10px, #bfa97e 20px);
  padding: 24px;
  border: 2px dashed #6b241c;
  border-radius: 4px;
  clip-path: polygon(
    0% 4%, 12% 1%, 25% 5%, 38% 0%, 50% 4%, 62% 1%, 75% 5%, 88% 0%, 100% 4%,
    98% 35%, 100% 65%, 97% 95%, 85% 98%, 70% 95%, 55% 100%, 40% 96%, 25% 100%, 10% 95%, 0% 100%,
    3% 65%, 0% 35%
  );
}
.diary-torn-tear-line {
  font-size: 12px;
  font-style: italic;
  color: #70261e;
  text-align: center;
  margin-top: 16px;
  border-top: 1px dashed #70261e;
  padding-top: 8px;
}

/* Efeito de páginas manchadas de cinzas/sangue/terra */
.diary-stained-fragment {
  position: relative;
  background: #bfa97d;
  padding: 22px;
  border-radius: 4px;
  box-shadow: inset 0 0 30px rgba(50, 20, 10, 0.6);
  opacity: 0.85;
}

/* Rodapé de navegação */
.diary-book-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #170a0b;
  border-top: 2px solid #541318;
}
.diary-nav-btn {
  background: #24090c;
  border: 1px solid #6e161c;
  color: #eed6bd;
  font-family: inherit;
  font-size: 13px;
  padding: 7px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}
.diary-nav-btn:hover:not(:disabled) {
  background: #611219;
  color: #fff;
  box-shadow: 0 0 10px rgba(255, 50, 60, 0.5);
}
.diary-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: #361416;
}
.diary-page-indicator {
  font-size: 13px;
  letter-spacing: 2px;
  color: #cfb38c;
}

/* Filtro Cinza na Tela (Efeito Página 2) */
#grey-vision-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: grayscale(0.88) contrast(1.15) brightness(0.9);
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.5s ease;
}
#grey-vision-overlay.active {
  opacity: 1;
}
`;

let _diaryReaderModalEl = null;
let _currentReadingPage = 0;
let _cachedAudio = null;
let _greyVisionOverlayEl = null;

function _ensureGreyVisionOverlay() {
  if (_greyVisionOverlayEl) return _greyVisionOverlayEl;
  const el = document.createElement("div");
  el.id = "grey-vision-overlay";
  document.body.appendChild(el);
  _greyVisionOverlayEl = el;
  return el;
}

function _triggerGreyFilterEffect(durationSeconds = 3) {
  const overlay = _ensureGreyVisionOverlay();
  overlay.classList.add("active");
  setTimeout(() => {
    overlay.classList.remove("active");
  }, durationSeconds * 1000);
}

function _ensureDiaryModal(audio) {
  _cachedAudio = audio || _cachedAudio;
  if (_diaryReaderModalEl) return _diaryReaderModalEl;

  const style = document.createElement("style");
  style.id = "demiurge-diary-css";
  style.textContent = TRACTATUS_CSS;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "demiurge-diary-overlay";
  overlay.innerHTML = `
    <div class="diary-book-wrapper">
      <div class="diary-book-header">
        <div class="diary-book-title-badge">
          <span>👁️</span>
          <span>TRACTATUS DE CARCERE · O LIVRO DO BARRO</span>
        </div>
        <button class="diary-close-btn" id="diary-close-btn">✕ Fechar Tomo (ESC / L)</button>
      </div>
      <div class="diary-page-viewport" id="diary-viewport">
        <!-- Renderizado dinamicamente -->
      </div>
      <div class="diary-book-footer">
        <button class="diary-nav-btn" id="diary-prev-btn">◄ Anterior (A)</button>
        <div class="diary-page-indicator" id="diary-page-indicator">Página 1 de ${DEMIURGE_DIARY_PAGES.length}</div>
        <button class="diary-nav-btn" id="diary-next-btn">Próxima (D) ►</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  _diaryReaderModalEl = overlay;

  overlay.querySelector("#diary-close-btn").addEventListener("click", () => {
    closeDemiurgeDiaryReader();
  });
  overlay.querySelector("#diary-prev-btn").addEventListener("click", () => {
    changeDiaryPage(-1);
  });
  overlay.querySelector("#diary-next-btn").addEventListener("click", () => {
    changeDiaryPage(1);
  });

  window.addEventListener("keydown", (e) => {
    if (!isDemiurgeDiaryReaderOpen()) return;
    if (e.key === "Escape" || e.code === "KeyL" || e.code === "KeyE") {
      e.preventDefault();
      closeDemiurgeDiaryReader();
    } else if (e.key === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      changeDiaryPage(-1);
    } else if (e.key === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      changeDiaryPage(1);
    }
  });

  return overlay;
}

function _getReadablePages() {
  const hasBook = Boolean(PlayerInventory.hasDemiurgeDiary);
  if (hasBook) {
    return DEMIURGE_DIARY_PAGES;
  }
  const discovered = Array.isArray(PlayerInventory.discoveredBookPages) ? PlayerInventory.discoveredBookPages : [];
  return DEMIURGE_DIARY_PAGES.filter((p) => discovered.includes(p.id));
}

function _renderCurrentPage() {
  if (!_diaryReaderModalEl) return;
  const hasBook = Boolean(PlayerInventory.hasDemiurgeDiary);
  const pagesList = _getReadablePages();

  const titleBadge = _diaryReaderModalEl.querySelector(".diary-book-title-badge");
  const closeBtn = _diaryReaderModalEl.querySelector("#diary-close-btn");
  const viewport = _diaryReaderModalEl.querySelector("#diary-viewport");
  const indicator = _diaryReaderModalEl.querySelector("#diary-page-indicator");
  const prevBtn = _diaryReaderModalEl.querySelector("#diary-prev-btn");
  const nextBtn = _diaryReaderModalEl.querySelector("#diary-next-btn");

  if (!hasBook) {
    if (titleBadge) {
      titleBadge.innerHTML = `<span>📜</span><span>FRAGMENTO AVULSO DO TRACTATUS DE CARCERE</span>`;
    }
    if (closeBtn) {
      closeBtn.textContent = "✕ Guardar Fragmento (ESC / L)";
    }
  } else {
    if (titleBadge) {
      titleBadge.innerHTML = `<span>👁️</span><span>TRACTATUS DE CARCERE · O LIVRO DO BARRO</span>`;
    }
    if (closeBtn) {
      closeBtn.textContent = "✕ Fechar Tomo (ESC / L)";
    }
  }

  if (pagesList.length === 0) {
    indicator.textContent = "Nenhum fragmento encontrado";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    viewport.innerHTML = `
      <div class="diary-parchment-sheet" style="text-align: center; padding: 40px 20px;">
        <h2 class="diary-page-heading" style="color: #ea4d3d;">[NENHUM FRAGMENTO RECOLHIDO]</h2>
        <p style="color: #ba796c; margin-top: 20px;">Não possuis o tomo encadernado nem qualquer folha solta.</p>
      </div>
    `;
    return;
  }

  _currentReadingPage = Math.max(0, Math.min(pagesList.length - 1, _currentReadingPage));
  const page = pagesList[_currentReadingPage];

  if (!hasBook) {
    indicator.textContent = `Fragmento ${_currentReadingPage + 1} de ${pagesList.length} (Página ${page.id})`;
  } else {
    indicator.textContent = `Página ${_currentReadingPage + 1} de ${pagesList.length}`;
  }

  prevBtn.disabled = _currentReadingPage === 0;
  nextBtn.disabled = _currentReadingPage === pagesList.length - 1;

  const isDiscovered = hasBook
    ? (!PlayerInventory.discoveredBookPages || PlayerInventory.discoveredBookPages.includes(page.id))
    : true;

  if (!isDiscovered) {
    viewport.innerHTML = `
      <div class="diary-parchment-sheet diary-torn-page" style="background: #190c0a; border: 2px dashed #7a221a; padding: 28px 22px;">
        <div class="diary-chapter-label" style="color: #b05040;">${page.chapter}</div>
        <h2 class="diary-page-heading" style="color: #ea4d3d; text-shadow: 0 0 10px rgba(220, 50, 40, 0.4);">[PÁGINA RITUAL ARRANCADA]</h2>
        <div class="diary-state-badge" style="color: #9c6c5a;">
          Folha ausente do códice · Restam marcas de unhas e cera negra
        </div>
        <div style="border: 1px dashed rgba(200, 60, 50, 0.5); padding: 26px 20px; border-radius: 8px; margin: 26px 0; background: rgba(30, 8, 8, 0.7); text-align: center;">
          <div style="font-size: 32px; margin-bottom: 12px;">🩸</div>
          <p style="font-size: 15.5px; color: #e8a89c; margin-bottom: 14px; font-style: italic; line-height: 1.6;">
            Esta folha do Tractatus foi arrancada violentamente do tomo pelos servos de Rex Mundi.
          </p>
          <p style="font-size: 13.5px; color: #ba796c; line-height: 1.6;">
            Investigue os <strong>acampamentos dos servos do demiurgo</strong> durante a noite ou vasculhe os escombros das <strong>cidades fantasmas devastadas</strong> para recuperar esta folha ritual perdida.
          </p>
        </div>
      </div>
    `;
    return;
  }

  if (page.id === 2) _hasReadPage2 = true;
  if (page.id === 19) _hasReadPage19 = true;

  viewport.innerHTML = `
    <div class="diary-parchment-sheet">
      <div class="diary-chapter-label">${page.chapter}</div>
      <h2 class="diary-page-heading">${page.title}</h2>
      <div class="diary-state-badge">
        ${page.origin ? `<span class="diary-origin-tag">[${page.origin}]</span> · ` : ""}
        ${page.stateLabel || ""}
        ${!hasBook ? ` · <span style="color:#d49b4b;">[Folha Avulsa Desprendida]</span>` : ""}
      </div>
      ${page.svg || ""}
      ${page.html || ""}
    </div>
  `;
}

export function openDemiurgeDiaryReader(pageIndex = 0, audio = null) {
  const pagesList = _getReadablePages();
  if (pagesList.length === 0) {
    window.__game?.ui?.showToast?.(`✦ Não possuis o Diário dos Demiurgos nem qualquer fragmento... Dica: ${getDemiurgeDiaryHint()}`);
    return;
  }
  _currentReadingPage = Math.max(0, Math.min(pagesList.length - 1, pageIndex));
  const modal = _ensureDiaryModal(audio);
  _renderCurrentPage();
  modal.classList.add("active");
  if (_cachedAudio?.bookPage) {
    _cachedAudio.bookPage();
  }
}

export function closeDemiurgeDiaryReader() {
  if (_diaryReaderModalEl) {
    _diaryReaderModalEl.classList.remove("active");
  }

  // Efeito da Página 2: visão ganha filtro cinza por 3 segundos
  if (_hasReadPage2) {
    _hasReadPage2 = false;
    _triggerGreyFilterEffect(3);
    window.__game?.ui?.showToast?.("✦ A revelação do tumor cósmico turva tua visão em cinzas...");
  }

  // Efeito da Página 19: prenúncio do fim, a trilha sonora muda imediatamente
  if (_hasReadPage19) {
    _hasReadPage19 = false;
    window.__game?.music?.playTrack?.("tense");
    window.__game?.ui?.showToast?.("🌑 O Apocalipse do Olho Cego foi revelado... A música do mundo silencia em pavor.");
  }
}

export function isDemiurgeDiaryReaderOpen() {
  return _diaryReaderModalEl ? _diaryReaderModalEl.classList.contains("active") : false;
}

export function changeDiaryPage(delta) {
  const pagesList = _getReadablePages();
  const next = _currentReadingPage + delta;
  if (next >= 0 && next < pagesList.length) {
    _currentReadingPage = next;
    _renderCurrentPage();
    if (_cachedAudio?.bookPage) {
      _cachedAudio.bookPage();
    }
  }
}

// ============================================================================
// Controle de Spawn e Interação no Mundo 3D
// ============================================================================

export function getDemiurgeDiarySpotIndex() {
  return _currentSpotIndex;
}

export function getDemiurgeDiaryHint() {
  const spot = DEMIURGE_BOOK_SPOTS[_currentSpotIndex] || DEMIURGE_BOOK_SPOTS[0];
  return spot.hint;
}

export function isDemiurgeDiaryCollected() {
  return _isCollected || Boolean(PlayerInventory.hasDemiurgeDiary);
}

export function initDemiurgeDiary({ scene, world, savedSpotIndex = null, isCollected = false }) {
  _cachedScene = scene;
  _cachedWorld = world;
  _isCollected = Boolean(isCollected || PlayerInventory.hasDemiurgeDiary);

  if (
    savedSpotIndex !== null &&
    savedSpotIndex !== undefined &&
    typeof savedSpotIndex === "number" &&
    savedSpotIndex >= 0 &&
    savedSpotIndex < DEMIURGE_BOOK_SPOTS.length
  ) {
    _currentSpotIndex = savedSpotIndex;
  } else {
    _currentSpotIndex = Math.floor(Math.random() * DEMIURGE_BOOK_SPOTS.length);
  }

  const spot = DEMIURGE_BOOK_SPOTS[_currentSpotIndex];

  if (_demiurgeBookGroup && _demiurgeBookGroup.parent) {
    _demiurgeBookGroup.parent.remove(_demiurgeBookGroup);
  }

  // Se já foi coletado, não coloca o livro no chão
  if (_isCollected) {
    return null;
  }

  _demiurgeBookGroup = new THREE.Group();
  _demiurgeBookGroup.name = "TractatusDeCarcere";

  // Materiais do tomo: couro áspero que cheira a terra velha e cobre
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x180f0c, roughness: 0.95, flatShading: true });
  const copperTrimMat = new THREE.MeshStandardMaterial({ color: 0x9c4e2b, metalness: 0.8, roughness: 0.4, flatShading: true });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xc8b58a, roughness: 0.98, flatShading: true });
  const eyeSealMat = new THREE.MeshBasicMaterial({ color: 0xff1500 });

  // Capa inferior e capa superior
  const coverBottom = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.025, 0.50), leatherMat);
  coverBottom.position.set(0, 0.015, 0);
  coverBottom.castShadow = true;
  _demiurgeBookGroup.add(coverBottom);

  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.47), paperMat);
  pages.position.set(0.01, 0.065, 0);
  _demiurgeBookGroup.add(pages);

  const coverTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.025, 0.50), leatherMat);
  coverTop.position.set(0, 0.115, 0);
  coverTop.castShadow = true;
  _demiurgeBookGroup.add(coverTop);

  // Lombada reforçada de couro envelhecido
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.125, 0.50), leatherMat);
  spine.position.set(-0.185, 0.065, 0);
  _demiurgeBookGroup.add(spine);

  // Cantoneiras de cobre oxidado
  for (const cx of [-0.165, 0.165]) {
    for (const cz of [-0.225, 0.225]) {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.030, 0.055), copperTrimMat);
      corner.position.set(cx, 0.116, cz);
      _demiurgeBookGroup.add(corner);
    }
  }

  // Olho Oculto do Demiurgo na capa frontal
  const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 6), eyeSealMat);
  eyeGlow.position.set(0.02, 0.132, 0);
  eyeGlow.scale.set(1.2, 0.35, 0.85);
  _demiurgeBookGroup.add(eyeGlow);

  const eyePupil = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.028, 0.055), copperTrimMat);
  eyePupil.position.set(0.02, 0.136, 0);
  _demiurgeBookGroup.add(eyePupil);

  // Luz carmesim oculta que pulsa sobre o livro
  _bookLight = new THREE.PointLight(0xee2200, 1.4, 3.8, 2.0);
  _bookLight.position.set(0, 0.35, 0);
  _demiurgeBookGroup.add(_bookLight);

  // Posição no mundo
  const gy = world ? world.heightAt(spot.x, spot.z) : 0;
  _demiurgeBookGroup.position.set(spot.x, gy + 0.12, spot.z);
  _demiurgeBookGroup.rotation.y = 0.42;

  scene.add(_demiurgeBookGroup);
  return _demiurgeBookGroup;
}

export function updateDemiurgeDiary(dt, now = performance.now()) {
  if (!_bookLight || !_demiurgeBookGroup || !_demiurgeBookGroup.visible) return;
  _bookLight.intensity = 1.2 + Math.sin(now * 0.0035) * 0.45;
}

export function checkDemiurgeDiaryNearby(playerPos) {
  if (!_demiurgeBookGroup || !_demiurgeBookGroup.visible || _isCollected || PlayerInventory.hasDemiurgeDiary) {
    return false;
  }
  const dx = (playerPos.x ?? 0) - _demiurgeBookGroup.position.x;
  const dz = (playerPos.z ?? 0) - _demiurgeBookGroup.position.z;
  return dx * dx + dz * dz < 2.5 * 2.5;
}

export function interactWithDemiurgeDiary(playerPos, ui, audio, input) {
  if (!checkDemiurgeDiaryNearby(playerPos)) return false;

  // Coleta o Tomo para o Inventário do Jogador
  _isCollected = true;
  PlayerInventory.hasDemiurgeDiary = true;

  // Ao coletar o tomo físico encadernado, desbloqueia as páginas base
  const basePages = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 17, 18, 20];
  if (!Array.isArray(PlayerInventory.discoveredBookPages)) {
    PlayerInventory.discoveredBookPages = [];
  }
  for (const bp of basePages) {
    if (!PlayerInventory.discoveredBookPages.includes(bp)) {
      PlayerInventory.discoveredBookPages.push(bp);
    }
  }

  if (_demiurgeBookGroup) {
    _demiurgeBookGroup.visible = false;
    if (_demiurgeBookGroup.parent) {
      _demiurgeBookGroup.parent.remove(_demiurgeBookGroup);
    }
  }

  PlayerStats.cha += 1;
  syncPlayerStatsToPlayer();

  import("./decay.js").then(({ addEvil }) => {
    addEvil(2, "Recolheu o Tractatus de Carcere (O Livro do Barro)");
  });

  ui?.showToast?.("✦ Tractatus de Carcere recolhido! Pressione [L] para ler o Tomo do Barro a qualquer momento. (+1 Carisma)");
  audio?.bookPage?.();

  // Abre imediatamente o leitor na página 1
  openDemiurgeDiaryReader(0, audio);
  return true;
}
