# GTA Medieval — Caldera

Protótipo standalone em JavaScript puro e Three.js ES modules, sem build ou framework. Os personagens e armas são modelos 3D proceduralmente montados; inclui sprites CC0 locais para efeitos e retratos. Three.js é carregado pelo import map no CDN.

## Executar

Sirva a raiz do repositório por HTTP (abrir `index.html` diretamente como `file://` não carrega ES modules):

```bash
python3 -m http.server 4173
```

Depois abra `http://localhost:4173`.

## Controles

- `W A S D` ou setas: mover · `Shift`: correr · `Space`: pular · `C`: rolar (esquiva com invulnerabilidade) · `U`: modo furtivo (agachado; os cavalos não fogem)
- **Botão direito**: mirar (câmera sobre o ombro com retícula nítida de alta precisão) · **Clique esquerdo** (ou `J`): atacar/atirar mantendo a mira 100% fixa e estável no alvo, sem oscilar nem cair no chão
- **Mira e Aim Assist (`T` para ligar/desligar)**: retícula sempre visível na tela com feedback tátil colorido (vermelho vivo sobre alvos e dourado radiante quando travada com colchetes de lock-on no inimigo). A mira permanece cravada no inimigo durante disparos consecutivos, transitando suavemente para o próximo alvo se o inimigo for derrotado.
- **Armas `1`–`9`**: escolhe o slot; apertar o mesmo número de novo alterna entre as armas dele. A **roda do mouse** troca de arma e **Shift + roda** dá zoom na câmera
- `Q` (segurar): escudo, só com armas de uma mão · `F`: monta/desmonta perto de um cavalo (também bloqueia, como antes) · `R`: poção · `E`: interagir/pegar · `H`: assobiar · `V`: vela
- `M`: liga/desliga a música · `Esc`: pausa (volumes de música e de efeitos separados)

## Reino de Caldera

Além da capital há seis vilas (Ferrovale, Pedraluz, Salgueiro, Cinzal, Brumas e Atalaia do Norte), ligadas por estradas de pedra e cercadas por bosques. O terreno é aplainado em volta de cada vila. O minimapa gira com a câmera e mostra vilas, estradas e guardas.

## Combate, NPCs e crime

- NPCs derrotados voltam ao seu posto depois de alguns segundos (se o jogador não estiver perto).
- Quem vê um crime foge ou corre até o guarda mais próximo para denunciar. Se a testemunha morrer antes de chegar, o crime não é reportado.
- **Procurado de 1 a 5.** Golpes e mortes presenciados (ou denunciados) somam pontos; o nível sobe com o total. Os guardas da região perseguem e atacam, e a cada nível o reino manda mais reforços, que chegam de longe:
  - 1: infantaria · 2: + arqueiros · 3: + besteiros · 4: + cavaleiros montados · 5: + canhoneiros, em maior número.
  - Arqueiros e besteiros mantêm distância e atiram; canhoneiros plantam o canhão e disparam balas explosivas; cavaleiros fazem investidas com a lança e pisoteiam.
  - Sem novos crimes (e com os inimigos longe) a perseguição acaba e os reforços se retiram.
- **Cavalo e cavaleiro são duas entidades**, cada uma com sua vida. Matar o cavalo derruba o cavaleiro, que segue a pé; matar o cavaleiro deixa o cavalo fugindo. Tiros baixos acertam o cavalo, tiros altos acertam o cavaleiro.
- Os inimigos atacam com preparação visível (0,4–0,6 s), no máximo 2 por vez; os outros cercam a 3–4 m esperando a vez, mantêm distância entre si e recuam depois do golpe. Levar um golpe empurra 1–2 m, dá 0,5 s de invencibilidade e, com vida baixa, a tela dessatura e o coração bate.
- Todo NPC derrotado larga moedas (que são atraídas ao chegar perto) e, conforme o ofício, pão, maçã, joia, poção, virotes ou flechas (pegue com `E`).
- A bomba de mão tem explosão em camadas: clarão e luz, bola de fogo, fumaça, onda de choque, faíscas, destroços, marca de queimado e tremor de câmera.

## Cavalos

- Manadas selvagens por chunk (limite total de 14) pastam, andam, trotam e fogem se atacadas ou assustadas (corrida do jogador por perto, tiros, explosões). Alguns cavalos ficam amarrados junto às casas, com um morador como dono.
- `F` perto de um cavalo monta. Cavalos selvagens podem empinar e derrubar nas primeiras tentativas; roubar o de um NPC conta como crime.
- Montado: galope com inércia e derrapagem, turbo com `Shift` (gasta o fôlego), salto com `Space`, atropelamento (derruba NPCs); bater numa árvore ou em uma casa em velocidade derruba o jogador e machuca (o cavalo passa por cima de todas as pedras, rochas e barro sem travar, colidindo e batendo apenas em árvores e casas), combate montado (espada, arco, besta, mosquete). A câmera se afasta e o campo de visão abre com a velocidade.
- Ao desmontar o cavalo fica parado; `H` assobia para chamá-lo.

## Casas, interiores e dormir

- Cada casa tem colisores por parede (vão real na porta e nas janelas), base de pedra, enxaimel, telhado de palha ou telha com beiral, chaminé, venezianas e porta de madeira. Tamanho, cores e telhado variam de casa para casa.
- `E` abre e fecha portas. Dentro da casa o telhado some e as paredes ficam translúcidas; a câmera colide com as paredes. Há cama, mesa, bancos, baú com saque, lareira e estante com potes. Mesa, bancos e potes quebram com golpes, tiros e explosões.
- Entrar em casa alheia à vista do dono (ou abrir o baú, quebrar a mobília) faz o dono gritar e correr para chamar os guardas.
- `E` na cama, de noite: a tela escurece, o tempo avança até o amanhecer, a vida volta e o jogo é salvo (localStorage, restaurado ao abrir o jogo). De dia: "Ainda não é hora de repousar". Procurado: "Não podes dormir enquanto és caçado". A pousada de Caldera cobra 5 moedas; cada casa já tem os campos de dono e preço, prontos para o futuro sistema de casa própria.

## Tochas, vela e fogo

- Tochas nas paredes das casas, nas igrejas e em postes pelas ruas acendem ao anoitecer e apagam ao amanhecer (há um gancho para a chuva). Só as 4 mais próximas usam luz de verdade; as demais usam emissivo, sprite de brilho e fagulhas.
- O jogador começa com uma vela apagada. `V` equipa; `E` perto de tocha ou lareira acende. A vela acesa é a luz que segue o jogador, dura 4 minutos e apaga se você correr muito, galopar ou rolar. Velas se compram com o mercador e no estande das igrejas.
- Chegar com a vela acesa perto de feno ateia fogo; o fogo se espalha pelos fardos e pode queimar telhados de palha vizinhos (e machuca quem ficar perto).

## Armas (slots 1–9)

| Slot | Armas |
| --- | --- |
| 1 | Punhos |
| 2 | Adaga, faca |
| 3 | Espada curta, espada longa |
| 4 | Machado, maça, mangual |
| 5 | Martelo de guerra, montante (duas mãos, lentos; atacar segurando carrega o golpe e arremessa inimigos) |
| 6 | Lança, alabarda (alcance longo; a cavalo e em movimento ganham alcance e dano) |
| 7 | Arco curto, arco longo |
| 8 | Balestra leve, balestra pesada |
| 9 | Facas de arremesso, bomba incendiária, pote de óleo (cria uma poça em chamas) |

Cada arma tem dano, alcance, velocidade, peso (afeta a velocidade de movimento), som e animação próprios (`src/weapondata.js`). As armas leves fazem combo de 3 golpes (o último é mais forte). Você começa com punhos, espada curta, arco curto, balestra leve e bomba incendiária. Novas armas se compram no ferreiro (armeiro) ou saem dos drops de guardas, soldados e cavaleiros.

## Música

A música vem da pasta `audio/` e troca com crossfade de 2 s, só depois do primeiro clique: `town.mp3` nas vilas, `explore.mp3` no mundo aberto, `DST-GrassLands.mp3` nas planícies longe das vilas, `forest_2.ogg` dentro da floresta, `wanted.mp3` com procurado 1–3 e `chase.mp3` com procurado 4–5 (se esse arquivo não existir, toca `tense.mp3`). Dentro de casa o volume cai.

## Compêndio de Armas e Arsenal

- **Interface Simplificada**: Cada arma é exibida em um card limpo apenas com **Nome e Dano**.
- **Ficha Técnica Individual**: Clicar em qualquer card abre a descrição detalhada com multiplicadores de força/forja, cadência, alcance, força de impacto, peso, munição, durabilidade e habilidades especiais.
- **Equipamento Imediato**: Armas pegas do chão, drops ou criadas vão automaticamente para a mão (atribuídas aos slots vagos de 1 a 9). Se os 9 slots estiverem cheios, são guardadas no alforje.
- **Tocha Compartilhada**: A tocha fica permanentemente compartilhada com a mão, sempre acessível independente da quantidade em estoque.

## Otimização de Terreno e LOD Dianteiro

- **LOD Dianteiro Direcional**: O limiar de alta qualidade geométrica é estendido dinamicamente à frente da câmera (até 130m na direção do movimento), evitando pop-ins bruscos durante cavalgadas em alta velocidade.
- **Assentamento de Cidades Fantasma**: Coordenadas rigorosamente ancoradas no relevo analítico e fundações de pedra com 2.4m de profundidade subterrânea, impedindo que casas e muralhas flutuem ou fiquem soterradas em encostas acidentadas.

## Cidades Fantasma e Ruínas de Guerra

- Cidades arruinadas geradas deterministicamente por seeds ao redor da capital (Norvânia, Cairn, Valdor, Oakhaven) e em regiões procedurais remotas.
- Muralhas destruídas com fendas de invasão e montes de escombros de alvenaria.
- Casas semidemoronadas, vigas calcinadas e telhados colapsados, sem tochas e sem habitantes.
- Cenário de massacre bélico: crânios humanos e ossadas no solo, espadas quebradas caídas ou cravadas na terra, flechas cravadas nas paredes e vigas, e poças de sangue seco no chão e nos muros.
- Atmosfera de entrada notificada via toast imersivo.

## Cataclismo do Demiurgo e Sol Negro de 3 Olhos

- **Firmamento de Olhos Reptilianos**: 42 olhos esféricos 3D cobrem os céus (esclera branca com veias ramificadas, nervo óptico e músculos retro-oculares). Cada olho acompanha ativamente o jogador com `lookAt` em tempo real durante 10 segundos antes do impacto.
- **O Demiurgo como Sol Negro**: Ser cósmico amorfo de matéria escura pulsante, anéis de acreção concêntricos, corona de espículas carmesins e a Tríade Maldita (três olhos demoníacos de esclera ensanguentada e pupilas verticais fenda de crocodilo) que descem dos céus causando tremores catastróficos e destruição total da terra.

## Acampamentos do Demiurgo e Pistas Noturnas

- **Aparição Estritamente Noturna**: Os acampamentos e altares dos servos do Demiurgo surgem nos ermos exclusivamente à noite (`isNight`). Durante o dia, os acampamentos, fogueiras roxas e tochas permanecem invisíveis e desativados, e os servos do Demiurgo desvanecem imediatamente sob a luz solar.
- **Investigação Interativa de Pistas (`E`)**: Ao aproximar-se de qualquer acampamento ou altar ritual à noite, o jogador pode investigar vestígios deixados pelos hereges. Revela documentos divididos em três naturezas:
  - **Planos de Ataque e Cerco**: Ordens seladas como *"Em 10 dias, ataque na Igreja..."*, envenenamento de poços da vila, emboscadas ao ferreiro e sabotagens com fogo.
  - **Ensinamentos e Doutrinas**: Tratados do Demiurgo sobre a matéria como cárcere do espírito e a purificação pelas cinzas.
  - **Garranchos e Delírios Crípticos**: Bilhetes sem nexo escritos em estados de febre ou transe herético (ex: *"Maçã sapato olho, 3 dias..."*).
- Concede +1 de Carisma por investigação e registra a pista no histórico lore.

## Diário dos Demiurgos (Coletável & Leitor de Códice)

- **Item Coletável no Mundo (`E`)**: O códice profano spawna em local secreto aleatório na vila de Caldera. Ao se aproximar, o jogador pode recolhê-lo para o inventário, sumindo com o modelo do chão.
- **Leitura a Qualquer Momento (`L` ou Inventário)**: Uma vez recolhido, o diário pode ser aberto a qualquer momento teclando `L` ou selecionando a opção no inventário de recursos.
- **Interface Modular de Tomo Antigo**: Leitor estilizado em tela cheia com textura de pergaminho envelhecido, encadernação de couro escuro, sons de folhear páginas (`audio.bookPage`) e navegação por setas (`◄`/`►`, `A`/`D`, `ESC`/`L`):
  - **Códice I**: Ritual do Círculo dos Nove Olhos e conjuração da centelha.
  - **Códice II**: Esboço e mapa ilustrado do cerco a Caldera e alvos prioritários.
  - **Códice III (Página Rasgada)**: Folha com bordas violentamente arrancadas e queimadas, restando apenas o título solene: *"O SACRIFÍCIO FINAL"*.
  - **Códice IV (Página Manchada de Tinta/Sangue)**: Pergaminho coberto por poças e respingos escorrendo de tinta vermelha violenta (como uma caneta estourada), cobrindo relatos aterrorizantes.
  - **Códice V**: Revelação e doutrina do Sol Negro de 3 Olhos.
  - **Códice VI**: Folhas pautadas preservadas para anotações modulares futuras.

## Mortalidade e Dano aos Cavalos

- **Registro na Grade Espacial**: Cavalos selvagens, montarias de guardas e corcéis do mundo são cadastrados dinamicamente na `SpatialHashGrid` e detectados por ataques corpo a corpo, arcos, balestras, mosquete, lanças arremessadas, tochas e explosões de bombas.
- **Dano e Morte Real**: Cavalos possuem vitalidade finita (6 HP). Ao serem alvejados, reagem com recuo e estrelas de sangue/impacto. Ao zerar a vida, sofrem queda lateral, desmontam cavaleiros NPCs ou derrubam o jogador ao chão (se estiver montado), desativam-se da grade e liberam espólios de couro e carne.

## Variedade de Criaturas Sobrenaturais

- **O Zancudo Sombrio (O Observador das Alturas)**:
  - Quadrúpede colossal com quatro pernas finíssimas de 16 metros de altura (maiores que as copas das árvores), com torso canino esguio e olhos luminescentes no alto.
  - Extremamente visível no horizonte e ermos remotos.
  - De longe (> 38m), fica parado e acompanha o jogador encarando-o continuamente. Quando o jogador se aproxima (< 36m), assusta-se e foge com passadas gigantes e velozes (~14 m/s) por cima da vegetação.
- **O Voraz Cego (O Humanoide Dentuço)**:
  - Criatura bípede cadavérica e trêmula sem a parte superior da cabeça: sem olhos, sem testa, ostentando apenas uma bocarra escancarada com mandíbula afiada e dentes triangulares brancos sempre expostos.
  - Cego a longas distâncias, perambulando errante pelo ambiente.
  - Ao detectar a aproximação do jogador (<= 9m), entra em frenesi agressivo: projeta o tronco para frente, estica ambos os braços e dispara em arrancada ultrarrápida (12 m/s), desferindo mordidas ferozes corpo a corpo.
  - Entidade combatível com 5 HP, reagindo a impactos e tombando com drop de moedas e dentes.

## Astro Celeste Fixo no Firmamento

- **Sol / Lua Primordial Imóvel**: Objeto celeste místico com disco luminescente, corona etérea translúcida e marcas de crateras visível permanentemente no céu.
- Ancorado em ângulo e elevação fixos (azimute 215° Sudoeste, 32° acima do horizonte), acompanhando o horizonte de qualquer ponto do mapa e visível de dia e de noite.

## Cristais Místicos e Infusão de Tochas Coloridas

- **Nós de Cristais no Solo (`E`)**: Cristais prismáticos brilhantes e luminescentes distribuídos pelo terreno em seis variedades:
  - **Esmeralda**: Chama Verde-Esmeralda (`#18ff44`) e luz verde vibrante (`0x22ff55`).
  - **Safira**: Chama Azul-Glacial (`#1188ff`) e luz azul radiante (`0x22aaff`).
  - **Quartzo Rosa**: Chama Rosa-Arcana (`#ff33aa`) e luz carmesim-rosada (`0xff44bb`).
  - **Rubi**: Chama Vermelho-Infernal (`#ff1122`) e luz escarlate (`0xff2233`).
  - **Diamante**: Chama Branca de Luz Pura (`#eaf4ff`) e luz branca pura (`0xffffff`).
  - **Ametista**: Chama Roxa do Vazio / Demiurgo (`#aa22ff`) e luz púrpura mística (`0xbb33ff`).
- **Infusão Imediata e via Menu de Criação (`I`)**: Coletar um cristal infunde a tocha imediatamente com aquela cor. No menu de criação (`I`), o jogador pode alternar livremente entre qualquer uma das chamas já descobertas, alterando os cones de fogo 3D em mãos e a cor da luz dinâmica `PointLight`.

## Fase 1

Terreno procedural em chunks com streaming, culling por frustum, LOD e sombras desativadas; cidade ampliada com casas, portão, mercado, forja, horta e poço. Inclui armadura/escudo, modelos de personagens totalmente 3D com padrões procedurais de tecido, couro e metal, cinco residentes com rotinas, diálogo e compras. Espada, balestra, arco, bomba de mão medieval e mosquete têm projéteis/efeitos próprios. NPCs podem ser derrotados e ficam em ragdoll com estrelas e poeira, sem sangue.

Os retratos de HUD usam **[Kenney Roguelike Characters](https://kenney.nl/assets/roguelike-characters)** e os efeitos de slash, estrelas, chama e fumaça usam **[Kenney Particle Pack](https://kenney.nl/assets/particle-pack)**. Ambos são CC0; as licenças estão junto dos arquivos em `assets/sprites/`. Os modelos de personagens e armas permanecem totalmente 3D e usam mapas procedurais de tecido, couro e metal.
