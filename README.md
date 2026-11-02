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
- **Mira, Aim Assist e Troca de Alvo (`T` ligar/desligar · `Y` ciclar alvos)**:
  - Retícula sempre visível na tela com feedback tátil colorido (vermelho vivo sobre alvos e dourado radiante quando travada com colchetes de lock-on no inimigo).
  - **Troca de Alvo com `Y`**: Ao mirar, pressionar a tecla `Y` cicla suavemente entre todos os alvos vivos disponíveis no campo de visão, permitindo escolher exatamente quem alvejar sem depender apenas da proximidade física.
  - **Travamento Automático por Golpe/Tiro (Lock-on)**: Ao acertar qualquer disparo (flecha, virote, bala de mosquete, arremesso) ou golpe corpo a corpo em um inimigo, a mira trava (`locked`) automaticamente nele, acompanhando seus movimentos até sua derrota ou até o jogador alternar manualmente com `Y`.
- **Física de Altura Real e Escalada em Muros e Pedras**:
  - As hitboxes de pedras, rochas, muros e construções agora respeitam estritamente suas alturas reais (`top` e `bottom`), eliminando barreiras invisíveis infinitas no ar.
  - O jogador pode pular e caminhar sobre o topo de pedras, muretas e muros com estabilidade física e subida suave de degraus (*step-climbing*), alcançando posições elevadas vantajosas.
- **Armas `0`–`9` & Numpad**: `1`–`9` seleciona a categoria do slot correspondente; apertar o mesmo número de novo alterna ciclicamente entre as armas possuídas daquele slot. A tecla `0` (ou Numpad `0`) é o atalho instantâneo para equipar a **Tocha Mágica** (ou punhos se já equipada). A **roda do mouse** (scroll) troca sequencialmente de arma na ordem exata dos slots sem repetições nem saltos, e **Shift + roda** dá zoom na câmera
- **Animação de Cooldown e Carga na Mira**: Uma barrinha animada posicionada logo abaixo da retícula central de mira (`#reticle`) indica a recarga e preparação das armas:
  - Enquanto segura o ataque para carregar golpes pesados (Montante e Martelo de Guerra), a barra preenche em azul ciano brilhante (`charging`).
  - Durante o cooldown e recarga pós-disparo (Mosquete com recarga de 3.5s, Balestras, Arcos, arremessos e ataques corporais), a barra inicia cheia em degradê dourado/laranja e **vai reduzindo suavemente até zero**, ocultando-se assim que a arma estiver pronta para disparar ou golpear novamente.
- `Q` (segurar): escudo, só com armas de uma mão · `F`: monta/desmonta perto de um cavalo (também bloqueia, como antes) · `R`: poção · `E`: interagir/pegar · `H`: assobiar · `V`: vela
- `M`: liga/desliga a música · `Esc`: pausa (volumes de música e de efeitos separados + botão do Cheat Menu)
- **Menu de Cheats**: Digite `POTATO` ou `CHIEFS` a qualquer momento durante o jogo, clique no botão **Cheat Menu** dentro da tela de pausa (`Esc`), ou execute comandos pelo console via `window.CheatMenu`

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

## Armas (slots 1–9 e tecla 0)

| Slot | Armas |
| --- | --- |
| 1 (ou `0`) | Punhos, Tocha mágica (sempre compartilhada com a mão) |
| 2 | Machado de lenhador, Adaga, Faca |
| 3 | Picareta (minerar pedra e ferro) |
| 4 | Espada curta, Espada longa, Maça, Mangual, Porrete rústico |
| 5 | Martelo de guerra, Montante (duas mãos; segurar carrega golpe destruidor) |
| 6 | Lança, Lança improvisada, Alabarda (alcance longo; bônus montado) |
| 7 | Arco curto, Arco longo |
| 8 | Balestra leve, Balestra pesada, Mosquete (tiro devastador com 3.5s de recarga) |
| 9 | Facas de arremesso, Bomba incendiária, Pote de óleo |

Cada arma tem dano, alcance, velocidade, peso (afeta a velocidade de movimento), som e animação próprios (`src/weapondata.js`). As armas leves fazem combo de 3 golpes (o último é mais forte). Você começa com punhos, espada curta, arco curto, balestra leve e bomba incendiária. Novas armas se compram no ferreiro (armeiro) ou saem dos drops de guardas, soldados e cavaleiros.

## Música e Trilha Sonora Dinâmica

A trilha sonora do Puris é gerenciada pelo `MusicDirector` com carregamento sob demanda e descarregamento dinâmico de memória (Zero-Leak), transicionando organicamente via crossfade suave entre os contextos do jogo:

| Contexto / Cenário | Faixa de Áudio | Comportamento e Gatilho |
| --- | --- | --- |
| **Exploração Aberta (Dia)** | `audio/music/exploration.mp3` | Exploração ativa a pé ou a cavalo pelos caminhos do reino |
| **Pradarias & Planícies** | `audio/music/ambient_calm_day.mp3` / `ambient_calm_day_2.ogg` | Planícies abertas distantes de vilas e cidades |
| **Cidades, Vilas e Mercados** | `audio/music/town_calm_day.mp3` (alt: `town_day_calm.mp3`) | Proximidade de vilarejos, feiras, muralhas e centros urbanos |
| **Florestas e Bosques** | `audio/music/ambient_day_forest.mp3` | Regiões com aglomerados de árvores e bosques diurnos |
| **Ermos Profundos e Matas Fechadas** | `audio/music/ambient_day_dense.mp3` | Matas densas (> 18 árvores por perto) e montanhas ermas |
| **Noite (Anoitecer até Meia-Noite)** | `audio/music/ambient_dense_night.ogg` | Início da noite e crepúsculo pelos ermos e estradas |
| **Madrugada Sombria (00h às 05h)** | `audio/music/ambient_dense_dawn.ogg` | As horas mais escuras e silenciosas da madrugada |
| **Tavernas e Estalagens** | `audio/music/generic_calm.ogg` | Interiores acolhedores de tavernas, estalagens e pousadas |
| **Igrejas e Catedrais** | `audio/music/generic_calm.ogg` | Serenidade sacra ao sentar nos bancos da igreja ou entrar no templo |
| **Tensão e Ameaça Iminente** | `audio/music/tense_escalating.ogg` | Presença de wendigos, lobisomens, feras ou cultistas a menos de 35m |
| **Combate Leve (Procurado 1-2)** | `audio/music/battle_light.mp3` | Conflito com camponeses ou perseguição inicial da guarda |
| **Combate Médio (Procurado 3)** | `audio/music/battle_fast.mp3` | Confronto armado intenso com reforços de besteiros e arqueiros |
| **Perseguição Severa (Procurado 4-5)** | `audio/music/battle_serious.mp3` | Caça implacável do reino por cavaleiros montados e canhoneiros |
| **Vila Fantasma & Acampamentos** | `audio/music/ghost_town_demiurge_camp.mp3` | Cidades fantasmas em ruínas e acampamentos noturnos do Demiurgo |
| **Eclipse Solar & Cataclismo** | `audio/music/evil_end.mp3` | Durante o Dia do Eclipse e a descida apocalíptica do Demiurgo |
| **Descobertas & Missões** | `audio/music/discovery.mp3` | Abertura de baús com tesouro e conclusão de missões |
| **Tela de Morte ("PERECESTE")** | `audio/music/defeat_2.ogg` (fallback: `defeat.wav`) | Pausa a música ambiente e ecoa a melodia fúnebre de derrota |

- **Abafamento em Interiores**: Dentro de qualquer residência ou cômodo fechado, o volume da música ambiente é reduzido automaticamente (filtro acústico suave).
- **Atalho de Mudo**: Tecla `M` silencia e desilencia a música instantaneamente. Volume independente na tela de pausa (`Esc`).

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

## O Tractatus de Carcere (O Livro do Barro)

- **Códice Canônico da Seita do Demiurgo**: Encadernado em couro áspero que cheira a cobre e terra velha, com páginas de pergaminho irregular que arranham os dedos.
- **Estrutura Completa de 20 Páginas (`TRACTATUS_DE_CARCERE.md` e in-game via `L`)**:
  - **Páginas 1 a 4**: *A Gênese do Aborto Cósmico*.
    - **Página 2 (Legível)**: Ilustração a carvão do Arquiteto Cego (Rex Mundi) — serpente com escamas de rostos humanos gritando e cabeça de leão cega vomitando lama sobre uma esfera perfeita.
    - *Efeito In-Game*: A tela ganha um filtro cinza dessaturado por 3 segundos após a leitura ao fechar o tomo.
  - **Páginas 5 a 8**: *A Endura e a Negação da Forma*.
    - **Página 7 (Legível)**: Gravura rústica em sangue oxidado de um homem ajoelhado serrando os próprios dedos da mão esquerda, observado por um homem com máscara de corvo e bico pontiagudo perante um sol negro. Explica o jejum das sombras e a veste de bico de pássaro.
  - **Páginas 9 a 14**: *Os Sacramentos da Ruína*.
    - **Página 11 (Legível)**: Ilustração do bosque agonizante com troncos que se torcem em figuras humanas em agonia e cultistas ateando tochas em pilha de cavalos mortos. Detalha a invocação do Observador dos Seis Olhos com feno e sangue, o corte com lâminas enferrujadas e a queima de árvores com enxofre.
  - **Páginas 15 a 17**: *A Urgência da Queda*.
    - **Página 16 (Legível)**: Diagrama anatômico onde a cidade de Caldera é mapeada como o estômago de um gigante e a igreja é o coração a ser perfurado. Revela que cada assassinato degrada a ilusão da matéria e ensina a semear crânios humanos nos portões.
  - **Páginas 18 a 20**: *O Apocalipse do Olho Cego*.
    - **Página 19 (Legível)**: Gravura apocalíptica do céu rachando como vidro trincado, o Sol Negro devorando a luz e braços de fogo pálido puxando as almas das montanhas. Prenúncio do fim dos tempos.
    - *Efeito In-Game*: Ao fechar o tomo após a leitura, a trilha sonora transita imediatamente para a melodia tensa/sombria (`tense.mp3`), com tremor suave de atmosfera.
  - **Páginas 1, 3-6, 8-10, 12-15, 17-18 e 20**: Folhas rasgadas, ensanguentadas, queimadas por enxofre ou borradas por graxa escura, com fragmentos textuais profanos e misteriosos.
- **Documentação de Referência**: O compêndio canônico integral de todas as 20 páginas, transcrições e descrições visuais está registrado em [`TRACTATUS_DE_CARCERE.md`](./TRACTATUS_DE_CARCERE.md).

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
- **Infusão Imediata e via Menu de Criação (`I`)**: Coletar um cristal infunde a tocha imediatamente com aquela cor. No menu de criação (`I`), o jogador visualiza apenas o ícone de chama e o nome limpo da cor (`🔥 Verde`, `🔥 Azul`, `🔥 Rosa`, `🔥 Vermelho`, `🔥 Branco`, `🔥 Roxo`), alterando os cones de fogo 3D em mãos e a cor da luz dinâmica `PointLight`.
- **Tochas Fincadas com Cor Fiel**: Ao fincar a tocha no chão ou em paredes com o clique esquerdo (`_tryPlaceHeldItem`), a tocha posicionada mantém exatamente a mesma cor da chama e da luz dinâmica `PointLight` da tocha que o jogador segurava na mão.

## Criaturas Noturnas dos Ermos

- **Comportamento Estritamente Noturno**: Feras e horrores heréticos só surgem e agem durante a noite, ficando completamente inativos e ocultos durante o dia.
- **Gulur (O Colosso dos Ermos · Antigo Zancudo Sombrio)**:
  - Quadrúpede esguio e gigantesco com pernas longas e finas que superam a copa das árvores e olhos amarelos luminescentes (`0xffea00`).
  - **Mortal (35 HP)**: Pode ser alvejado e derrotado por armas brancas, flechas, virotes e tiros. Apresenta recuo, efeitos visuais de faíscas estelares e sangue negro.
  - Ao morrer, sofre um colapso monumental: as pernas dobram e o corpo despenca de 16 metros estrondando o solo com nuvem de poeira e tremor, liberando 40 moedas de saque e bônus moral (`addGood(6)`).
- **Necron (O Voraz Cego)**:
  - Humanoide sem a parte superior da cabeça, com mandíbula dilatada e dentes pontiagudos sempre à mostra.
  - **Comportamento de Emboscada Noturna**: Fica **esperando** imóvel no escuro, ouvindo a neblina. Só dispara em investida voraz quando o jogador se aproxima muito (`<= 7.5m`), desferindo mordidas com 2.0 de dano real. Pode ser abatido com armas e tiros (6 HP), dropando 14 moedas ao tombar.

## O Tomo do Demiurgo (*Tractatus de Carcere*) e Páginas Perdidas

- **Coleta no Mundo (`E` ou `L`)**: O jogador **não começa com o livro**. O tomo do barro repousa oculto pelo mapa e também pode ser desenterrado ao vasculhar as cidades fantasmas devastadas ou investigar acampamentos heréticos.
- **Páginas Arrancadas e Fragmentos Misteriosos**: As páginas de revelações profundas (páginas 7, 11, 16, 19 e a folha rasgada manchada de tinta vermelha *"O Sacrifício Final"*) iniciam ausentes do códice.
- **Investigação em Cidades Fantasmas e Acampamentos Noturnos**: Vasculhar os escombros das praças arruinadas de cidades fantasmas ou investigar anotações nos acampamentos dos servos do demiurgo à noite restaura as páginas faltantes, preenchendo as ilustrações e textos profanos no leitor do tomo (`L`).

## Menu de Cheats e Central de Recursos (`POTATO`, `Esc` ou Console)

Acesso total e irrestrito a todos os recursos, itens, munições, poderes e eventos do jogo através do modal visual de cheats ou da API `window.CheatMenu`:
- **Formas de Acesso**:
  - Digite a sequência `POTATO` ou `CHIEFS` no teclado a qualquer momento durante a gameplay.
  - Pressione `Esc` para pausar e clique no botão **🥔 CHEAT MENU (RECURSOS & ITENS)**.
  - Execute no console do navegador: `window.CheatMenu.open()`.
- **Exibição em Tempo Real**: O topo do menu mostra os totais em estoque do jogador (Madeira, Pedra, Barro, Feno, Ouro, Tochas, Poções, Velas, Cor da Tocha, Cristais e Horário com estado Dia/Noite), atualizando instantaneamente a cada clique.
- **Categorias e Recursos Disponíveis**:
  - **Horário & Ciclo Dia/Noite (`tab-time`)**:
    - **Seletor de Hora Precisa**: Slider contínuo de 0h a 23h com pré-visualização e aplicação imediata.
    - **Presets Instantâneos**: Amanhecer (06:00), Manhã (09:00), Meio-Dia (12:00), Tarde (15:00), Pôr do Sol (18:00), Crepúsculo (19:30), Noite Profunda (21:30), Meia-Noite dos Rituais (00:00) e Madrugada dos Ermos (03:00).
    - **Alternadores & Saltos de Tempo**: Botões para alternar instantaneamente para Dia ou Noite, e avançar ou retroceder horas (+1h, -1h, +3h, +6h, +12h).
    - Comandos via console: `window.CheatMenu.setTime(horas, minutos)`, `window.CheatMenu.setDay()`, `window.CheatMenu.setNight()`, `window.CheatMenu.addHours(delta)` e `window.CheatMenu.getTime()`.
  - **Recursos de Construção & Matérias-Primas**:
    - Madeira (`wood`): +100 ou Max 999
    - Pedra (`stone`): +100 ou Max 999
    - Barro / Argila (`clay`): +100 ou Max 999
    - Feno (`hay`): +50 ou Max 999
    - Tochas (`torches`): +25 ou Max 99
    - Ouro (`gold`): +5.000 ou +50.000 moedas
    - *Pacote Completo*: +500 em todos os recursos de construção com um único clique.
  - **Cristais Místicos & Tochas Coloridas**:
    - Pacote com +20 de todos os cristais (6 cores).
    - +10 unidades individuais de Esmeralda (Verde), Safira (Azul), Quartzo Rosa (Rosa), Rubi (Vermelho), Diamante (Branco) e Ametista (Roxo).
    - Infusão imediata da tocha em mãos para qualquer uma das chamas mágicas (ou restauração para a chama comum laranja).
  - **Consumíveis & Munição**:
    - Poções de Cura (+10 ou Max 99).
    - Velas de Cera (+20 ou Max 99).
    - Flechas, Virotes, Bombas de Mão, Facas de Arremesso e Potes de Óleo (+25 a +50 ou Max 99 de tudo).
  - **Arsenal & Equipamentos**:
    - Desbloqueio e durabilidade máxima de todas as 24+ armas existentes.
    - Equipar armaduras do nível 0 (Camponês) ao nível 3 (Placas Templárias).
    - Conceder ferramentas de trabalho (Machado e Picareta).
    - Conceder o livro profano do Demiurgo (*O Tractatus de Carcere*) para leitura com a tecla `L`.
    - Vestir o traje completo do Culto do Demiurgo (Manto e Máscara com chifres).
  - **Spawns de Criaturas, NPCs & Cavalos (`tab-spawns`)**:
    - **Monstros & Feras**: Lobisomem, Gulur (Colosso de 16m), Necron (Devorador Cego), Hexoculus (6 Olhos), Polyphonia (Fauce Múltipla), Cultista Cátaro, Morvath (Líder da Seita) e Mensageiro do Demiurgo.
    - **Cavalos**: Cavalo Selvagem, Cavalo com Sela (Domesticado) e Puro-Sangue Real.
    - **NPCs Cidadãos**: Guarda Real, Ferreiro, Mercador, Padre, Camponês, Aldeão, Mendigo e Bandido dos Ermos.
    - Comandos via console: `window.CheatMenu.spawnGulur()`, `window.CheatMenu.spawnNecron()`, `window.CheatMenu.spawnHexoculus()`, `window.CheatMenu.spawnPolyphonia()`, `window.CheatMenu.spawnCultist()`, `window.CheatMenu.spawnHorse(wild, isMission, name)` e `window.CheatMenu.spawnNPC(roleKey, isBandit)`.
  - **Poderes, Moralidade & Eventos (`tab-events`)**:
    - Modo Deus (vida infinita e invulnerabilidade).
    - Super Velocidade (2.5x).
    - Perdoar todos os pecados, zerar procurado e restaurar o Voto Templário.
    - Exterminar inimigos e feras próximos.
    - Disparar o Final Bom (*Ira Dei* / Triunfo Sagrado).
    - Disparar o Mal Final (*Apocalipse* / Descida do Demiurgo).

## Seita Cátara, Acampamentos & Grão-Mestre Morvath

- **Distribuição e Tiers de Acampamentos**:
  - **Pequeno (4 acampamentos nos arredores)**: Fogueira roxa, 2 tochas rubras, 2 servos sentados. Saque: 15–25 moedas, notas e chance de fragmentos.
  - **Médio (3 acampamentos fortificados)**: Paliçadas de troncos queimados, 4 tochas cerimoniais, fogueira roxa viva e altar ritual de pedras com 4 sentinelas. Saque: 50–80 moedas, 2 cristais raros e página garantida.
  - **Enorme (Grande Bastião Cátaro de Rex Mundi)**: Fortaleza imponente cercada por paliçadas com estacas e crânios, 2 braseiros monumentais de chama roxa, fogueira cerimonial, altar monumental com efígie esculpida do Demiurgo, 6 cultistas guardiões e a morada de **Morvath, o Perfeito**. Saque: 190–250 moedas, 4 cristais raros, túnica cerimonial e recuperação de todas as páginas faltantes do *Tractatus de Carcere*.
- **Morvath, o Grão-Mestre Cátaro**:
  - **Entidade Física e Persistente**: Não desvanece na aproximação, permanecendo de pé perante o grande altar no Bastião.
  - **Modelo 3D Imponente**: Manto sacerdotal preto com bordados em ouro puro, estola carmesim, capuz com chifres retorcidos de ébano e máscara de porcelana com órbitas ardentes. Empunha o Cajado do Demiurgo com serpente dourada e gema de ametista pulsante.
  - **Sprite / Retrato Sombrio de HUD**: Retrato vetorial SVG detalhado com iluminação dramática, estola, chifres e órbitas flamejantes do Pleroma.
  - **Diálogo Filosófico e Interativo**: Dialoga sobre a criação material de Rex Mundi, a Endura (recusa da carne), o Sacramento da Madeira Órfã e concede a Bênção do Vazio com fragmentos do códice, ou aceita ser desafiado em batalha mística.
  - **Invocação por Cheat**: Disponível no Cheat Menu (`tab-events`) e via console: `window.CheatMenu.summonCultLeader()`.

## Criaturas e Feras Noturnas dos Ermos

Todas as feras e abominações sobrenaturais só aparecem e atuam estritamente durante a noite (das 19:30 às 05:30), desvanecendo ou colapsando ao amanhecer:
- **Gulur (O Colosso dos Ermos)**: Quadrúpede colossal de 16 metros de altura com pernas finíssimas e olhos amarelos incandescentes no alto. Fica estático ou caminha vagarosamente encarando o jogador à distância; se o jogador se aproximar demais, foge em passadas monumentais. É mortal (35 HP) e pode ser abatido com armas de longo alcance ou ataques coordenados.
- **Necron (O Devorador Cego)**: Humanoide emaciado de pele pálida, sem o topo da cabeça e sem olhos, com mandíbula escancarada repleta de dentes pontiagudos expostos. Fica estático no escuro ouvindo a noite; só ataca em investida violenta quando o jogador se aproxima a menos de 7.5m.
- **Hexoculus (O Observador dos Seis Olhos)**: Bípede magro e esquelético de 3.4 metros de altura, com costelas e espinhos ósseos salientes na coluna, cabeça angular sem boca e **seis olhos amarelos incandescentes** piscando em colunas verticais. Emerge da névoa noturna em passadas rápidas, emite uma aura cósmica violeta e desfere cortes de garras afiadas.
- **Polyphonia (A Fauce Múltipla / Anomalia de Yaldabaoth)**: Criatura serpentiforme magra e segmentada, sem olhos, de cujo tronco superior brotam **três mandíbulas dentadas canibais** articuladas que mastigam a escuridão. Rasteja com ondulações sinuosas no terreno e desfere botes rápidos e ferozes.
- **Mira Assistida e Lock-On Total**: Todas as criaturas integram-se à Spatial Grid e à mira assistida, podendo ser alternadas com a tecla `Y` e travadas automaticamente após o primeiro impacto.

## Exploração Expandida: Cristais e Cidades Fantasmas

- **48 Nós de Cristais Místicos**: Espalhados em anéis concêntricos (próximos a 35m–85m, intermediários a 90m–160m e distantes a 170m–270m) em todas as 6 cores (Esmeralda, Safira, Quartzo Rosa, Rubi, Diamante e Ametista), permitindo infundir a tocha com chamas coloridas dinâmicas.
- **7 Cidades Fantasmas Devastadas**: Ruínas procedurais de guerra (Norvânia, Cairn, Valdor, Oakhaven, Kren, Corvos e Morvath) com muros caídos, sangue seco, flechas e ossadas, onde é possível vasculhar a praça central para resgatar o *Tractatus de Carcere* e suas páginas faltantes.

## Sistema de Construção e Modo Demolição (Tecla C)

- **Hub de Arquitetura Medieval**: Pressionar `C` abre o catálogo com 10 projetos medievais estruturados em categorias (*Habitação & Vila* e *Defesa & Trabalho*), incluindo Cabanas, Casas de Enxaimel com dois pisos, Celeiros, Currais, Torres de Vigia, Forjas, Poços, Fogueiras e Muralhas de Pedra e Barro.
- **Projeção e Rotação em 15°**: Rotação com a roda do mouse, teclas `Q`/`E` ou movimento suave do mouse enquanto a câmera permanece fixa. Clique com botão esquerdo ou `E` ergue a obra no relevo com fundações sólidas e colisores físicos OBB.
- **Modo Demolição / Destruir Obra**:
  - Acessível pelo botão **🔨 Destruir / Demolir Construção** ou pela aba **🔨 DEMOLIÇÃO** no catálogo (`C`).
  - **Seleção Prévia Obrigatória**: A mira do jogador detecta qualquer construção erguida pelo jogador a até 30m. Ao mirar, um contorno âmbar indica o alvo. Ao clicar com o botão esquerdo ou apertar `E`, a construção é **selecionada**, passando a piscar em vermelho vivo pulsante.
  - **Exclusão Segura**: O botão na tela `[ 💥 DELETAR CONSTRUÇÃO ]` fica ativo. Clicar nele ou apertar `E` / `Delete` / `Espaço` faz a construção desaparecer imediatamente do mundo, desativando todos os colisores físicos e pisos e tocando som de quebra com explosão de poeira e detritos.
  - Também permite selecionar e deletar itens fixados no cenário (tochas em paredes, velas e armas).

## Tela de Debug F3 (Estatísticas Completas da Engine e Mundo)

- **Ativação por Atalho `F3`**: Pressione `F3` (ou `Shift + F3`) a qualquer momento, ou acione pelo menu de pausa (`Esc`) e pelo Cheat Menu (`POTATO`).
- **Arquitetura Zero-GC**: Painel translúcido em duas colunas atualizado a ~12 Hz (80ms) reutilizando nós DOM pré-alocados, sem gerar alocações ou sobrecarga no loop de renderização.
- **Coluna Esquerda (Engine, Performance e Navegação)**:
  - FPS em tempo real com média, mínimo, máximo e tempo de quadro em ms (`fps (ms) · min/max`).
  - Consumo de memória Heap JS via `performance.memory` com percentual do limite da aba.
  - Coordenadas espaciais precisas do jogador `XYZ` (3 casas decimais).
  - Identificação de Chunk atual `[cx, cz]` e total de chunks ativos no raio de streaming.
  - Direção de bússola (*Norte / Sul / Leste / Oeste*) com graus exatos de `Yaw` e `Pitch`.
  - Altura do solo em Y com distinção entre terreno procedural e pisos de construções.
  - Relógio do mundo (`HH:MM`), ciclo dia/noite e percentual de iluminação solar.
  - Status do jogador: HP, Stamina, Moedas de Ouro, Nível de Procurado e Postura (a pé, montado ou furtivo).
- **Coluna Direita (GPU, Renderização, Entidades e Estruturas)**:
  - Resolução do canvas e limite de corte da câmera (`camera.far`).
  - Total de chamadas de desenho (*Draw Calls*) e contagem de polígonos/triângulos no quadro.
  - Total de geometrias e texturas alocadas na memória da GPU pelo Three.js.
  - Total de entidades simuladas no mundo aberto.
  - Censo detalhado de NPCs (aldeões, guardas de patrulha e mendigos vivos).
  - Contagem de inimigos e feras nos ermos (seita cátara, wendigos e bestas noturnas).
  - População de cavalos no mundo e montarias ativas.
  - Quantidade de casas e vilas geradas pelo mapa procedural, com distância e nome da cidade mais próxima.
  - Contagem de construções do jogador ativas no cenário e itens fixados.
  - Quantidade de caixas orientadas (OBBs) e pisos registrados no Spatial Hash Grid de física.
  - Tochas dinâmicas ativas e arma em mãos.

## Sistema de Neblina Densa e Culling Espacial (O Truque "Silent Hill")

Usar a neblina visual para justificar o não carregamento de partes distantes do cenário é uma das técnicas clássicas mais eficientes de otimização para jogos de mundo aberto. Para que a GPU fique extremamente leve, a neblina visual está matematicamente sincronizada com o limite de corte da câmera (`camera.far`), o frustum de sombras e o raio de culling dos chunks:

1. **Sincronização entre Neblina e Corte de Câmera (`camera.far = 105m`)**:
   - O plano de corte distante da câmera principal (`camera.far`) foi fixado em 105 metros. A GPU descarta (cull/clip) 100% de todos os vértices e triângulos além dessa distância antes da rasterização.
   - A neblina exponencial (`THREE.FogExp2`) foi calibrada com densidade de `0.0315` de dia até `0.037` à noite. A 95–100m de distância, a opacidade da névoa atinge 99.98%, tornando qualquer objeto 100% invisível antes de alcançar o limite de corte da câmera.
   - A cor do horizonte (`scene.fog.color`), o fundo (`scene.background`) e a cor de limpeza do renderizador (`renderer.setClearColor`) permanecem estritamente idênticas em todas as horas do dia e da noite, criando a ilusão de um horizonte infinito sem bordas ou cortes bruscos.
   - **Proibido Skybox**: O uso de textura plana uniforme na cor exata da neblina evita que silhuetas de árvores e morros sumam recortadas contra o céu no limite do `camera.far`.

2. **Culling Espacial de Chunks e InstancedMesh**:
   - O gerenciador de mundo (`World.updateVisibility`) descarta chunks inteiros que estejam além do raio de corte da neblina (`distanceSq > maxFogCullSq = 110²`), desativando a visibilidade de grupos inteiros de terreno e milhares de árvores e rochas instanciadas (`chunk.group.visible = false`).
   - Todos os cálculos de distância utilizam distância euclidiana ao quadrado (`distanceSq`), eliminando chamadas desnecessárias a `Math.sqrt` no loop principal (Zero-GC).

3. **Otimização do Frustum de Sombras (Shadow Frustum)**:
   - A câmera ortográfica da luz solar direcional (`sun.shadow.camera`) foi concentrada no raio imediato de 28 metros ao redor do jogador (`SHADOW_BOUNDS = 28`, `near = 1`, `far = 80`).
   - Evita calcular sombras de montanhas e árvores ocultas pela neblina a centenas de metros, concentrando a resolução do shadow map (512x512 PCFSoft) exatamente onde os olhos do jogador conseguem enxergar com máxima nitidez.

4. **Spawns de Monstros no Limiar da Neblina (78m–88m)**:
   - Criaturas noturnas (Lobisomens, Gulur, Necron, Hexoculus e Polyphonia) surgem estrategicamente no anel de 78 a 88 metros de distância do jogador.
   - O jogador ouve os passos e uivos na escuridão e assiste à silhueta do monstro emergir lentamente da névoa densa à medida que ele se aproxima, gerando suspense cinematográfico e horror clássico sem modelos complexos ou pop-ins repentinos.

## Auditoria de Renderização e Culling (Backface, Frustum e Oclusão)

Otimização de visibilidade em 3 camadas na GPU e CPU para dispositivos modestos e GPUs integradas:

1. **Backface Culling Rigoroso (Faces Ocultas)**:
   - Eliminado o uso desnecessário de `THREE.DoubleSide` em telhados de casas (`src/house.js`) e telhados de vilas/cidades (`src/settlement.js`). Como as coberturas são construídas com geometrias 3D fechadas (`BoxGeometry` e prismas volumétricos com normais voltadas para fora), o uso de `FrontSide` padrão ativa o hardware culling na GPU, descartando ~50% dos triângulos e fragmentos rasterizados dos telhados em todo o reino.
   - `THREE.DoubleSide` permanece reservado estritamente onde a geometria é plana/2D sem espessura (folhagens de árvores, grama cruzada, halos etéreos e asas espectrais).

2. **Correção de Frustum Culling em Geometria Procedural & InstancedMesh**:
   - **Bounding Volumes Antecipados em InstancedMesh**: No Three.js, por padrão, o culling de um `InstancedMesh` depende da `boundingSphere` da geometria de um único protótipo na origem `(0, 0, 0)`. Nas instâncias de chunks (`world.js`), muralhas (`procedural.js`), estradas/hortas (`settlement.js`) e pistas rituais (`cult.js`), agora são chamados explicitamente `.computeBoundingBox()` e `.computeBoundingSphere()` assim que a matriz de instâncias é preenchida. Isso impede o pop-in prematuro (descarte errôneo de malhas inteiras quando a origem sai da tela) e elimina cálculos pesados de união de esferas no meio do loop de renderização (Zero-GC).
   - **Geometrias Mescladas (`mergeGeometries`)**: Todas as malhas combinadas proceduralmente de casas, igrejas e vegetação agora recalculam `.computeBoundingBox()` e `.computeBoundingSphere()`, garantindo precisão instantânea no frustum culling da câmera.

3. **Estratégia de Oclusão Angular e Interiores de Construções**:
   - **Culling de Interiores**: O interior de cada residência e igreja (`interior.visible`) permanece desligado por padrão, sendo ativado somente se o jogador estiver dentro do cômodo ou a menos de 5 metros de uma porta aberta (`houses.js`).
   - **Oclusão Angular por Estruturas**: Casas e construções bloqueadas no cone de visão por edifícios maiores mais próximos são ocultadas dinamicamente (`group.visible = false`), economizando chamadas de desenho e vértices.

4. **União Estática de Geometrias e Compatibilidade de Shaders**:
   - O utilitário [`src/mergeUtils.js`](file:///home/chocotonilitz/Programacao/projetos/puris/src/mergeUtils.js) fornece união segura e otimizada (`mergeGeometries` e `mergeBufferGeometries`), combinando automaticamente peças procedurais de adereços decorativos (`clutter.js`), casas e vegetação em geometrias únicas de altíssimo desempenho com suporte à extensão oficial do Three.js e fallback de buffers Float32Array.
   - O mapa de sombras foi atualizado para `THREE.PCFShadowMap` nativo em [`src/main.js`](file:///home/chocotonilitz/Programacao/projetos/puris/src/main.js#L154-L156), eliminando alertas de depreciação e garantindo console 100% limpo no navegador.

## Iluminação Forte e Independente para Tochas Colocadas

- **Luz Dedicada e Forte (PointLight)**: Ao fixar uma tocha no chão ou na parede (`src/weapons.js`), a tocha agora recebe sua própria fonte de luz pontual forte (`THREE.PointLight`, intensidade 18.0, alcance de 32 metros, decaimento suave de 1.8 e `alwaysOn: true`). Ela ilumina efetivamente o solo, as paredes e os arredores mesmo durante o dia ou à noite, sem disputar ou perder iluminação para o pool genérico de 8 luzes das vilas.
- **Sprite de Fogo Nítido e Flamejante**: O halo do fogo foi redimensionado (escala 1.4x) com material emissivo intenso (2.5x) que assume a tonalidade do cristal equipado (laranja, azul, verde, púrpura, rubi, etc.).
- **Ciclo de Vida Limpo (Recolher / Demolir)**: Tanto ao recolher a tocha com `E` quanto ao destruí-la no Modo de Construção/Demolição, a luz pontual, o grupo 3D e o sprite de fogo são removidos e descartados sem vazamento de memória.

## Reformulação da HUD e Separação de Elementos (Canto Superior Esquerdo)

- **Fluxo Vertical Sem Sobreposições (`.hud-top-left`)**: Os módulos do canto superior esquerdo (Vitalidade, Localização/Horário e Controles) agora utilizam um container flexbox com empilhamento vertical automático e espaçamento garantido de 14px. O menu com o nome da região, horário e clima (`.place`) nunca mais colide ou fica por baixo da caixa de vida e atributos.
- **Menu de Vitalidade Enxuto e Focado**:
  - Exibe estritamente o essencial de combate e sobrevivência: **Vitalidade** (corações e numérico), **Moedas de Ouro**, **Poções**, **Vela**, **Atributos RPG** (FOR, CON, CAR, VEL) e a barra de **Maldade**.
- **Gaveta Expansível de Recursos (Madeira, Pedra, Barro e Feno)**:
  - Os materiais de construção e coleta foram transferidos para uma gaveta expansível discreta acionada pelo botão interativo `[📦 Recursos ▾]`.
  - Permanece recolhida por padrão para manter a tela limpa e imersiva. Ao clicar, expande suavemente com os contadores de Madeira, Pedra, Barro e Feno. A preferência do jogador é persistida automaticamente no `localStorage`.
  - Todos os recursos continuam disponíveis para consulta detalhada no menu de artesanato e inventário (`I`).

## Ciclo do Eclipse e Regras do Apocalipse do Demiurgo

- **Regras Estritas para o Fim dos Tempos (Descida do Demiurgo)**:
  - **Maldade Extrema (> 90%)**: Se a maldade do jogador estiver acima de 90%, o cataclismo pode ser desencadeado a partir do **Dia 7** (`daysPassed >= 7`).
  - **Maldade Padrão/Baixa (≤ 90%)**: O final do Demiurgo só pode ocorrer estritamente **depois do Dia 15** (`daysPassed > 15`).
  - **Trava de Eclipse Obrigatória**: O Apocalipse nunca dispara sem que o jogador tenha vivenciado **ao menos 1 Dia de Eclipse** previamente (`eclipsesExperienced >= 1`).
- **Sorteio e Mecânicas do Dia de Eclipse**:
  - **Agendamento (> Dia 4)**: O eclipse só pode ocorrer estritamente depois do dia 4 (ou seja, dia 5 em diante). O sistema agenda 1 ou mais dias de eclipse (o primeiro entre o dia 5 e 6 para garantir o presságio antes de um possível apocalipse precoce no dia 7, e dias adicionais posteriores).
  - **Spawn de Monstros Dobrado**: Durante todo o dia de eclipse, a taxa, limite e velocidade de spawn de lobisomens e feras nos ermos são **estritamente dobrados**.
  - **Diálogo Profético de Todos os NPCs**: Todo e qualquer habitante abordado para conversa durante o eclipse proclama o aviso de pavor:
    *« O maligno que habita nesse mundo decidiu nos mostrar a sua face, cuidado jovem, coisas ruins acontecerão. »*
  - **Persistência Completa**: O número de dias passados, eclipses vivenciados e o calendário agendado são salvos automaticamente no `localStorage` ao dormir na cama e podem ser inspecionados em tempo real na tela de debug `F3`.

## Geração Procedural: Cidades Vivas, Profissões e Sobrevivência Dinâmica

A geração procedural de vilas e o gerenciamento de mundo foram reformulados para criar um ecossistema medieval orgânico, visualmente inconfundível e com suporte a *Endless Survival*:

### 1. Variedade Arquitetônica e Identidade Visual de Profissões
- **Casas Modulares e Tiers de Loot**:
  - **Pobre / Cabana**: Dimensões compactas com palha rústica; baús contendo moedas escassas e provisões básicas.
  - **Médio / Casa Padrão**: Enxaimel com reboco claro e telhas; baús com moedas equilibradas e poções.
  - **Rico / Mansão**: Estrutura imponente com alvenaria de pedra aparelhada; baús fartos em ouro e gemas.
- **Identidade Visual por Âncora de Profissão**:
  - **Ferreiro (`blacksmith`)**: Casa acoplada a uma forja externa com brasa emissiva ardente (`#ff7b1c`), bigorna de ferro forjado e ferramentas.
  - **Fazendeiro (`farmer`)**: Casa com curral cercado de mourões e tábuas onde habitam animais domésticos, espantalho e montes de feno.
  - **Mercador (`merchant`)**: Fachada com toldo de tecido comercial, caixas de mantimentos e carroças estacionadas.
- **A Igreja e o Sino de Bronze (Âncora de Sanidade)**:
  - Construção mais alta e solene da vila, coroada por uma torre campanário destacada.
  - **Sino de Bronze (`BronzeBell`) Manipulável**: O sino é uma entidade física articulada. Ao badalar (`E`), abençoa a vila e recua a corrupção do mundo em `-2%`. Em noites de alta corrupção, pode desabar no solo, aumentando o medo; o jogador pode reerguê-lo com 2 Madeiras e 2 Pedras, aliviando a corrupção em `-15%`.

### 2. Fauna Dinâmica e Otimizada (`Chicken` e `Pig`)
- **Galinhas (`Chicken`) e Porcos (`Pig`)**:
  - Gerenciados via `ObjectPool` (Zero-GC) e cadastrados na grade de colisão `SpatialGrid`.
  - Habitam os currais dos fazendeiros com IA de perambulação, ciscadas e farejos orgânicos.
  - Podem ser abatidos para obtenção de penas, carne suína e alimento.

### 3. Preenchimento de Mundo (Clutter Otimizado em InstancedMesh)
- Renderização de 100% dos adereços decorativos com **exatamente 1 Draw Call por tipo** no mundo todo (`src/clutter.js`):
  - **Espantalhos (`Scarecrows`)**: Postes com cruzeta e chapéu nos limites das plantações.
  - **Montes de Feno (`HayMounds`)**: Medas cônicas douradas nas fazendas e hortas.
  - **Pilhas de Toras (`WoodPiles`)**: Feixes de madeira empilhados próximos às casas de lenhadores.
  - **Montes de Pedra (`StonePiles`)**: Pilhas de cantaria lavrada junto a forjas e pedreiras.
  - **Carroças Abandonadas (`AbandonedCarts`)**: Carroças estáticas de madeira nas margens das estradas e praças de mercado.

### 4. A Foice de Colheita (`Scythe`) e Extrativismo Agrícola
- Adicionada a **Foice de Colheita** no slot 3 de ferramentas (alternando ciclicamente com a Picareta).
- Modelo 3D com haste longa de madeira e lâmina em meia-lua de aço polido, com ícone desenhado na hotbar.
- Permite ceifar rapidamente feno, plantações e montes de feno instanciados, rebaixando a matriz da instância na hora (Zero-GC), dropando feno e pão no solo, e recuando a corrupção do mundo (`-1.5%`).

### 5. Eventos Orgânicos de Suspense por Âncoras (Sem Calendário Fixo)
- Desacoplados de dias pré-determinados via testes probabilísticos independentes (PRNG) gerenciados pelo `EventBus` na virada de cada dia:
  - **O Sacrifício**: Chance de um animal de curral amanhecer massacrado com poça de sangue carmesim no chão.
  - **A Peste Negra**: Chance de um aldeão amanhecer enfermo (`sick = true`), tossindo e pedindo socorro. O jogador pode curá-lo entregando uma poção (`E`), recebendo +3 de Carisma e recuando a corrupção em `-8%`.

### 6. A Mecânica do Apocalipse Adiável (Endless Survival)
- O Apocalipse do Demiurgo **SÓ pode ocorrer se a Barra Global de Corrupção (`WorldDecay.decayLevel`) atingir 100% (1.0)**!
- Se o jogador purificar altares heréticos (`-12%`), curar doentes da peste (`-8%`), consertar e badalar o sino da igreja (`-15%` / `-2%`), apagar incêndios (`-5%`) e colher com sua foice (`-1.5%`), a corrupção recua continuamente.
- O jogador pode conter o fim dos tempos indefinidamente, vivendo como um fazendeiro e sobrevivente em um mundo dinâmico e sem fim.

## Iluminação Radiante e Ampliação de Tochas nas Cidades

Anteriormente, as cidades e vilas à noite ficavam excessivamente escuras porque o sistema de iluminação estava restrito a apenas 8 fontes de luz pontuais (`MAX_LIGHTS = 8`) fracas (intensidade ~90 com decaimento 1.8), o que fazia com que uma vila inteira tivesse a maioria de suas tochas apagadas e sem projeção de luz no solo e nas paredes. A iluminação noturna foi completamente reformulada:

- **Pool Expandido para 24 PointLights Ativas (`MAX_LIGHTS = 24`)**:
  - Capacidade triplicada para permitir que avenidas inteiras, pátios de igrejas e praças de mercado fiquem simultaneamente iluminados.
  - Mantém a arquitetura Zero-GC reaproveitando instâncias pré-alocadas de `THREE.PointLight` sem sombras secundárias (`castShadow = false`), rodando a 60 FPS lisos.
- **Intensidade e Alcance Fortalecidos**:
  - Alcance ampliado para **75 metros** (`distance = 75.0`) com decaimento suave de **1.38** (`decay = 1.38`).
  - Intensidade das tochas aumentada para **340** (e **220** para lareiras), cortando a neblina densa e banhando o chão de paralelepípedos e as fachadas de madeira e pedra com um caloroso tom dourado âmbar (`#ffaa50`).
- **Halo e Sprite de Fogo Volumétrico**:
  - Textura de brilho gerada proceduralmente em alta resolução (`128x128`) com 5 gradientes quentes de emissão.
  - Escala dos sprites de fogo dobrada (1.7x a 2.4x) com cintilação suave motivada pela física do ar.
  - Material emissivo da ponta da tocha quadruplicado (`emissiveIntensity: 4.8 a 5.8`), mantendo os archotes visíveis a mais de 150m através da névoa.
- **Novos Postes Estratégicos em Caldera**:
  - Adicionados postes iluminados no Grande Portão Norte, na Praça do Mercado, no Pátio da Igreja e na Forja do Ferreiro, transformando Caldera em um verdadeiro refúgio vivo e radiante contra a escuridão dos ermos.

## Novo Sistema de Áudio Imersivo e Efeitos Sonoros Reais

Incorporados novos arquivos de áudio de alta fidelidade gravados para combate, movimentação e criaturas (`audio/sfx/`), pré-carregados e decodificados em `AudioBuffer`s de baixa latência pelo `GameAudio` (`src/audio.js`):

- **Passos Equilibrados e Suaves na Relva (`audio/sfx/footsteps_grass.flac`)**:
  - Volume de passos ao andar, caminhar e correr reduzido e rebalanceado (~45% mais suave), com subgrave sutil e pitch aleatório (`0.94 - 1.06`), proporcionando uma caminhada imersiva e natural que não encobre os sons ambientes.
- **Tocha Flamejante Realista (Som de Fogo e Labareda no Ar)**:
  - Ataque e golpes com a Tocha Mágica agora reproduzem o som inconfundível de uma tocha de fogo sendo brandida no ar (whoosh ardente de ar quente com estalo de faíscas e brasas), eliminando completamente o antigo som de faca/corte metálico.
- **Golpes de Espadas e Lâminas (`audio/sfx/sword.wav`)**:
  - Ataques com Espada Curta, Espada Longa, Montante e Alabarda tocam som encorpado de corte afiado no ar, distinguindo golpes normais e golpes pesados carregados.
- **Cortes Ágeis e Saque de Facas (`audio/sfx/combat/knife_slice_*.wav`, `knife_draw_*.wav`)**:
  - Ataques rápidos com Faca, Adaga e Facas de Arremesso disparam áudio cortante e metálico de alta agilidade.
- **Socos Corporais Desarmados (`audio/sfx/combat/punch_heavy_*.wav`, `punch_medium_*.wav`)**:
  - Combate desarmado (Mãos/Punhos) reproduz impactos contundentes de socos médios e pesados na luta corporal.
- **Disparos Pesados de Mosquete e Artilharia (`audio/sfx/ranged/shot_*.wav`, `shot_heavy_*.wav`)**:
  - Tiro devastador de mosquete com estampido real de pólvora e eco acústico.
- **Destruição de Móveis e Frascos (`audio/sfx/destruction/break_wood_*.wav`, `break_glass_*.wav`)**:
  - Mesas, bancos de madeira e potes de vidro/cerâmica estilhaçam com áudios autênticos de quebra.
- **Explosões Multicamadas (`audio/sfx/destruction/explosion_blast_*.wav`, `explosion_crunch_*.wav`, `explosion_deep_*.wav`)**:
  - Bombas de mão e barris explodem com impacto triplo: blast inicial, crunch de estilhaços e onda de choque grave profunda.
- **Uivos e Rosnados de Feras (`audio/sfx/wolf_howl.mp3`)**:
  - Criaturas predadoras dos ermos soltam rosnados e uivos ao avistarem o jogador e engajarem em investida feroz.
- **Passadas Pesadas de Predadores (`audio/sfx/beast_steps/{0..7}.ogg`)**:
  - Banco de 8 variações dinâmicas de passos de garras e patas pesadas reproduzidos cadenciadamente durante as perseguições em alta velocidade das criaturas nos ermos.
- **Filtragem Temática Medieval**:
  - Excluídos todos os efeitos sonoros futuristas e sci-fi (lasers, pistolas e fuzis de raio, zap launchers e bombas de gravidade), mantendo a integridade e coesão de alta fantasia medieval sombria do projeto.

## Telas de Carregamento Assíncronas (Zero-Stutter Offscreen Shader Compilation)

Ao iniciar uma nova aventura, restaurar um savegame ou pular a cutscene cinemática, o carregamento de dezenas de chunks procedurais e a compilação síncrona de dezenas de shaders GLSL pelo WebGL geravam engasgos perceptíveis na taxa de quadros (micro-stutters / spikes de frame time). O novo módulo `LoadingScreen` (`src/loadingScreen.js`) resolve essa latência através de uma arquitetura em estágios fora da tela:

- **Overlay Visual Imersivo**:
  - Brasão rúnico de Caldera pulsante, moldura dourada e barra de progresso suave em gradiente dourado (`0% a 100%`).
  - Dicas dinâmicas de lore e sobrevivência sorteadas em tempo real.
- **Pipelines de Transição Divididos em Frames**:
  1. *Exibição Imediata*: Bloqueia a renderização defasada e foca o usuário na atmosfera do jogo.
  2. *Streaming de Terreno e Posicionamento*: Desloca o jogador, atualiza chunks de terreno e reposiciona âncoras fora da visão da câmera.
  3. *Pré-aquecimento de GPU (`renderer.compile`)*: Compila todos os programas de iluminação e materiais na GPU antes que a tela seja revelada, eliminando totalmente o congelamento do primeiro frame.
  4. *Fade-Out Suave*: Desvanece suavemente a tela revelando o cenário a 60 FPS estáveis.

## Cutscene Cinemática Aprimorada (Trilha Tensa e Áudio de Predadores)

A sequência de abertura na floresta escura (`src/intro.js`) recebeu tratamento sonoro completo:
- **Trilha Tensa em Escalação (`audio/music/tense_escalating.ogg`)**:
  - Inicia imediatamente com o suspense da fuga, silenciando suavemente faixas calmas e criando a ambientação opressiva da perseguição na mata.
- **Efeitos Sonoros de Feras e Uivos Sincronizados**:
  - Uivos aterradores ecoam na mata logo nos primeiros segundos (`audio.playWolfHowl`).
  - Passadas pesadas e cadenciadas de patas e garras no solo perseguem o jogador de perto (`audio.playBeastStep`).
- **Pulo Fluido para a Tela de Carregamento**:
  - Pressionar `Espaço`, `Esc` ou `Enter` ativa imediatamente a `LoadingScreen`, teletransportando o jogador para os portões seguros de Caldera e realizando a compilação offscreen sem congelar a interface.

## Padronização Global dos Áudios em Inglês Limpo

Todos os diretórios e arquivos de áudio do projeto foram padronizados para convenções POSIX em inglês limpo, sem caracteres especiais (como barras diagonais `⁄`, acentos gráficos ou espaços), garantindo compatibilidade cruzada universal em servidores Linux, Windows e CDNs:
- `audio/music/` (anteriormente `audio/musicas/`):
  - `ambient_calm_day.mp3`, `ambient_calm_day_2.ogg`, `ambient_day_dense.mp3`, `ambient_day_forest.mp3`, `ambient_dense_dawn.ogg`, `ambient_dense_night.ogg`, `town_calm_day.mp3`, `town_day_calm.mp3`, `exploration.mp3`, `battle_light.mp3`, `battle_fast.mp3`, `battle_serious.mp3`, `ghost_town_demiurge_camp.mp3`, `tense_escalating.ogg`, `evil_end.mp3`, `discovery.mp3`, `defeat.wav`, `defeat_2.ogg`, `generic_calm.ogg`.
- `audio/sfx/` (anteriormente `audio/efeitos sonoros/`):
  - `sword.wav`, `knife.wav`, `footsteps_grass.flac`, `wolf_howl.mp3`, `beast_steps/{0..7}.ogg`.
- Symlinks de retrocompatibilidade mantidos na raiz de `audio/` para preservar dependências legadas.

## Telemetria da Trilha Atual no Painel Debug [F3]

O painel de depuração em tempo real (`src/debugScreen.js`), ativado via tecla **`[F3]`**, agora conta com monitoramento sonoro em tempo real:
- **Linha de Áudio / Trilha Sonora**:
  - Exibe o título catalogado em português da trilha em reprodução (ex.: `Exploração Aberta (Dia)` ou `Tensão e Ameaça Iminente`).
  - Nome exato do arquivo físico carregado (`exploration.mp3`, `tense_escalating.ogg`, etc.).
  - Percentual dinâmico de volume com cálculo de abafamento e ducking (ex.: `Vol: 85%`).
  - Status em tempo real (`TOCANDO` ou `MUTADO`).

## Otimização Noturna com Light Impostors (Luzes Distantes no Breu)

Durante a noite, o reino mergulha em uma atmosfera aterrorizante e imersiva sem comprometer a taxa de quadros (60 FPS estáveis), através da técnica de **Light Impostors**:

1. **Separação de Culling (Câmera vs Lógica)**:
   - **Alcance Amplo da Câmera**: `camera.far` expandido para **200 metros** (`CONFIG.renderDistance = 200`), permitindo que a câmera enxergue pontos luminosos no horizonte sem corte prematuro do frustum.
   - **Breu Noturno aos 40m**: O `FogExp2` transiciona suavemente para **preto puro** (`#000000` / `#050706`) com densidade calibrada em **`0.052`**, bloqueando mais de 98.5% da visão de malhas normais aos 40 metros.
   - **Culling Estrito de Terreno e Estruturas a 45m**: O gerenciador de mundo (`src/world.js`) seta `chunk.group.visible = false` em todas as geometrias complexas (árvores, casas, relevo, muralhas) a mais de 45m do jogador durante a noite. A GPU descarta dezenas de chunks e centenas de milhares de vértices na raiz, eliminando draw calls desnecessárias.

2. **InstancedMesh de Impostores de Luz (1 Draw Call)**:
   - Todas as tochas de postes, tochas de parede, lareiras e tochas do jogador são desenhadas simultaneamente por um único `THREE.InstancedMesh` com geometria plana de baixa densidade (`PlaneGeometry(1, 1)`).
   - **Billboard na GPU (Vertex Shader)**: Utiliza injeção via `onBeforeCompile` no vertex shader para cancelar a rotação da `modelViewMatrix`, fazendo com que todos os halos olhem para a câmera instantaneamente na GPU com **Zero-GC e zero overhead de CPU**.
   - **Material que Ignora a Neblina**: Configurado com `blending: THREE.AdditiveBlending`, `depthWrite: false`, `transparent: true` e `fog: false`. O halo alaranjado e pulsante das tochas fura a neblina preta noturna e guia o jogador no escuro, visível a até 200m de distância como fogueiras e archotes brilhando no horizonte.

3. **Gerenciamento de Luzes Reais (PointLights até 25m)**:
   - As `PointLights` físicas (que projetam fótons reais no chão e paredes) são estritamente limitadas a um raio máximo de **25 metros** do jogador.
   - Quando o jogador se afasta além de 25m, a `PointLight` apaga suavemente (`intensity = 0`, `visible = false`), poupando 100% dos cálculos caros de fragment shader de iluminação dinâmica. No lugar, resta apenas o plano emissivo aditivo do Light Impostor perfurando o breu da noite.

## Smart Clutter Generation & Zonas de Pertencimento

O preenchimento do mundo agora adota um sistema estrito de **Zonas de Pertencimento** espaciais em vez de distribuição por ruído caótico (`src/clutter.js` e `src/villageGenerator.js`):
- **Plantações e Espantalhos (`FarmZone`)**:
  - Casas de Fazendeiros (`PROFESSIONS.FARMER`) alocam automaticamente uma `FarmZone` adjacente em grid ordenado (ex.: $4\times 4$).
  - O **Espantalho** spawna *exclusivamente* no centro geométrico exato desse grid.
  - As áreas em volta do espantalho são preenchidas com instâncias de plantação (trigo dourado e legumes) geradas via 1 único Draw Call (`InstancedMesh`).
- **Fardos de Feno Contextuais**:
  - Nascem estritamente atrelados a estábulos, currais de animais ou nas margens imediatas das plantações da `FarmZone`.
- **Carroças e Pedras**:
  - Carroças de madeira aparecem unicamente acopladas às laterais das tendas de Mercadores (`PROFESSIONS.MERCHANT`) ou em vértices de estradas procedurais.
  - Montes de pedras talhadas surgem junto à oficina do Ferreiro (`PROFESSIONS.BLACKSMITH`) ou em biomas rochosos ermos, mantendo distância desobstruída das portas e entradas.

## Fauna Dinâmica, Currais e Consequência Social (Agro System)

A fauna das vilas (galinhas e porcos em `src/farmAnimals.js`) foi integrada ao ecossistema social e de sobrevivência:
- **Habitats Híbridos**:
  1. *Curral Acoplado (`coupled_pen`)*: Cercados de mourões e tábuas anexos às paredes das casas. A locomoção dos animais sofre *clamp* rigoroso às coordenadas da caixa do curral (`minX, maxX, minZ, maxZ`), impedindo que atravessem cercas.
  2. *Curral Solto (`village_pen`)*: Áreas amplas cercadas nas bordas das comunidades.
  3. *Free-Roam Limitado (`free_roam`)*: Animais soltos na vila que perambulam com raio máximo de 15 metros em torno de sua âncora/bebedouro.
- **Fauna Matável & Hitboxes de Combate**:
  - Galinhas (`hitRadius: 0.35`, 2 vigor) e porcos (`hitRadius: 0.55`, 5 vigor) possuem caixas de acerto integradas ao sistema de combate (`src/combat.js` e `src/weapons.js`). Podem ser atacados com armas corpo a corpo (espadas, machados, lanças, montantes) e projéteis (arcos, balestras e arremessos).
- **Gatilho de Crime & Consequência Social (Agro System)**:
  - Todo animal gerado atrela-se ao `ownerId` da casa/fazendeiro dono.
  - Ao agredir ou abater um animal doméstico, o sistema realiza uma varredura espacial de testemunhas num raio de **30 metros**.
  - Se o dono, um civil ou um guarda estiver no raio de 30m e em linha de visão:
    - O nível de alerta (`Wanted Level`) do jogador sobe imediatamente.
    - Moradores entram em pânico correndo e alertando a guarda.
    - Guardas mudam para estado de combate e caçam o infrator.
    - A pontuação de maldade/corrupção aumenta (`addEvil`).

## Otimização de Stutters, Estabilidade de Renderização e Tochas no Breu

Para eliminar travamentos (*stutters* de 1400 FPS para 70 FPS), evitar buracos/limbo no terreno e garantir iluminação noturna envolvente (`src/world.js`, `src/deathScreen.js`, `src/torches.js` e `src/clutter.js`):
- **Terreno Circular 360° sem Limbo**:
  - Removido o culling direcional agressivo e o teto noturno estrito de 45m que sumiam com o chão atrás da câmera de 3ª pessoa.
  - Implementado um anel seguro circular contínuo de **135 metros** em torno do jogador onde o terreno e a vegetação permanecem 100% visíveis em qualquer ângulo de câmera, garantindo transições suaves e sem buracos no mundo.
- **Eliminação de Invalidação de Render Lists da GPU**:
  - Removida a alteração dinâmica de `castShadow` frame a frame em tempo de execução, impedindo que o `WebGLRenderer` reconstrua continuamente listas de renderização e shaders de sombras.
- **Tela de Morte e Eventos sem Congelamento**:
  - Substituição da manipulação de `canvas.style.filter` CSS por uma camada overlay dedicada (`.wasted-sepia`), preservando a aceleração de hardware do contexto WebGL sem re-rasterizações pesadas.
  - Otimização do ruído de granulação (`_animateGrain`) através de quadros estáticos pré-computados, reduzindo a zero o custo de CPU na transição.
- **Tochas e Fogueiras que Furam a Escuridão Noturna**:
  - Billboards aditivos de alta intensidade com `fog: false` nas chamas e halos das tochas, permitindo que a luz corte a neblina preta e sirva como farol no horizonte a longas distâncias.
  - Alcance e intensidade das `PointLights` expandidos (55m de raio de ativação nas vilas e ruas) para banhar praças, fachadas e vias medievais com luz quente e acolhedora.
- **Zoneamento Rigoroso de Fazendas e Clutter (Proteção de Igrejas e Centros Urbanos)**:
  - Adicionado raio de isolamento mínimo de **38 metros** em torno de todas as Igrejas e templos e **32 metros** do centro urbano de Caldera, impedindo que plantações, espantalhos, cercados ou currais de animais nasçam dentro ou adjacentes a edifícios sagrados ou urbanos. Casas no miolo urbano atuam estritamente como comerciantes e civis.

## Cidades Fantasma (Ghost Towns) Imersivas e Exploráveis

As cidades abandonadas devastadas pela guerra (`src/ghostTowns.js` e `src/interactions.js`) foram aprofundadas com suspense e exploração:
- **Poças Orgânicas de Sangue Seco Irregular**:
  - Substituição de círculos e planos geométricos perfeitos por geometria orgânica procedural irregular (`createIrregularBloodGeometry`), gerando manchas espirradas e fluidas no chão das ruínas e nas cenas de sacrifício.
- **Marca Herética do Demiurgo (Olho Minimalista em Sangue)**:
  - A casa de destaque de cada vila abandonada porta na parede da fachada um desenho ritualístico em sangue seco: uma amêndoa estilizada com fenda/pupila vertical e filetes de sangue escorrendo da pálpebra inferior.
- **Casas Arruinadas Acessíveis com Saque de Espólios [E]**:
  - As colisões físicas foram modularizadas por paredes, deixando o vão da porta arrombada completamente livre para o jogador entrar no interior das construções.
  - No interior de cada casa encontram-se assoalhos navegáveis e baús arrombados (`AbandonedHouseChest`).
  - Ao aproximar-se, o prompt contextual **`[E] Saquear Casa Arruinada`** (ou *CASA SOB O OLHO DE SANGUE*) permite recolher fragmentos e códices do Demiurgo (`Tractatus de Carcere`), feixes de flechas, espadas enferrujadas e moedas antigas.

## Fase 1

Terreno procedural em chunks com streaming, culling por frustum, LOD e sombras desativadas; cidade ampliada com casas, portão, mercado, forja, horta e poço. Inclui armadura/escudo, modelos de personagens totalmente 3D com padrões procedurais de tecido, couro e metal, cinco residentes com rotinas, diálogo e compras. Espada, balestra, arco, bomba de mão medieval e mosquete têm projéteis/efeitos próprios. NPCs podem ser derrotados e ficam em ragdoll com estrelas e poeira, sem sangue.

Os retratos de HUD usam **[Kenney Roguelike Characters](https://kenney.nl/assets/roguelike-characters)** e os efeitos de slash, estrelas, chama e fumaça usam **[Kenney Particle Pack](https://kenney.nl/assets/particle-pack)**. Ambos são CC0; as licenças estão junto dos arquivos em `assets/sprites/`. Os modelos de personagens e armas permanecem totalmente 3D e usam mapas procedurais de tecido, couro e metal.
