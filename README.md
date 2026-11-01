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
- **Botão direito**: mirar (câmera sobre o ombro, mira no centro da tela) · **Clique esquerdo** (ou `J`): atacar/atirar, mesmo com o botão direito pressionado
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

## Fase 1

Terreno procedural em chunks com streaming, culling por frustum, LOD e sombras desativadas; cidade ampliada com casas, portão, mercado, forja, horta e poço. Inclui armadura/escudo, modelos de personagens totalmente 3D com padrões procedurais de tecido, couro e metal, cinco residentes com rotinas, diálogo e compras. Espada, balestra, arco, bomba de mão medieval e mosquete têm projéteis/efeitos próprios. NPCs podem ser derrotados e ficam em ragdoll com estrelas e poeira, sem sangue.

Os retratos de HUD usam **[Kenney Roguelike Characters](https://kenney.nl/assets/roguelike-characters)** e os efeitos de slash, estrelas, chama e fumaça usam **[Kenney Particle Pack](https://kenney.nl/assets/particle-pack)**. Ambos são CC0; as licenças estão junto dos arquivos em `assets/sprites/`. Os modelos de personagens e armas permanecem totalmente 3D e usam mapas procedurais de tecido, couro e metal.
