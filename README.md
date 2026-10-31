# Puris

Protótipo de jogo de ação 3D leve que roda no navegador. Um homem armado com uma
metralhadora de munição infinita enfrenta hordas de zumbis em uma arena aberta.
O objetivo é sobreviver o máximo possível enquanto o cronômetro corre.

Não há história, menus, som nem assets externos.

## Stack

- [Three.js](https://threejs.org/) `0.187.0` (versão fixa)
- [Vite](https://vite.dev/) `8.3.5` (versão fixa)
- JavaScript puro com módulos ES (sem TypeScript e sem frameworks)

## Requisitos

- Node.js `20.19+` ou `22.12+`
- npm

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço exibido no terminal (por padrão `http://localhost:5173`).

Para testar a build de produção:

```bash
npm run build
npm run preview
```

## Controles

| Ação          | Controle                     |
| ------------- | ---------------------------- |
| Andar         | `W` `A` `S` `D` / setas      |
| Mirar         | Mouse                        |
| Atirar        | Segurar clique esquerdo / `F` |
| Pular         | `Espaço`                     |
| Mover câmera  | Arrastar com o botão direito |
| Zoom          | Roda do mouse                |
| Reiniciar     | `R` (depois de morrer)       |

O movimento é relativo à câmera, que orbita em volta do jogador. Diagonais são
normalizadas, o personagem gira para a direção do mouse e não atravessa
obstáculos. O pulo usa gravidade e não permite pulo duplo; a sombra no chão
indica a altura.

Segurar o botão esquerdo dispara continuamente, sem limite de munição. As balas
saem do cano da arma, voam em linha reta e colidem com zumbis e obstáculos.

## Regras do jogo

- Hordas de zumbis surgem ao redor do jogador em intervalos regulares.
- Cada horda é maior que a anterior, até um limite; o intervalo entre hordas
  diminui com o tempo.
- Os zumbis perseguem o jogador, desviam dos obstáculos e atacam quando chegam
  perto. Cada ataque tira vida, com um pequeno intervalo global entre danos.
- Cada zumbi suporta três tiros. Acertos soltam partículas de sangue; tiros em
  obstáculos soltam faíscas.
- O HUD mostra o cronômetro de sobrevivência, a vida e o número de abates.
- Quando a vida chega a zero, o jogo congela e mostra o tempo sobrevivido e os
  abates. Pressione `R` para recomeçar.

## Estrutura

```text
index.html
src/
  main.js      renderer, loop, estado do jogo, game over e reinício
  scene.js     cena, câmera orbital, luzes, chão e obstáculos
  input.js     estado do teclado/mouse (sem lógica de jogo)
  player.js    modelo com arma, movimento, mira, pulo e colisão
  bullet.js    metralhadora, balas, rastro e partículas
  zombies.js   hordas, instancing, perseguição, ataque e dano
  hud.js       cronômetro, vida, abates e tela de game over
  config.js    constantes de ajuste
  debug.js     painel de FPS e draw calls (só em desenvolvimento)
```

## Ajustes

Velocidades, aceleração, gravidade, força do pulo, vida, dano, cadência de tiro,
tempo de vida das balas, tamanho dos pools, hordas, câmera, névoa e cores ficam
em `src/config.js`, organizados por área (`PLAYER`, `GAME`, `BULLET`, `ZOMBIE`,
`CAMERA`, `WORLD` e `COLORS`).

Para deixar o jogo mais fácil ou difícil, ajuste principalmente `ZOMBIE.health`,
`ZOMBIE.minSpeed`, `ZOMBIE.maxSpeed`, `ZOMBIE.attackDamage`,
`ZOMBIE.spawnInterval`, `ZOMBIE.hordeGrowth` e `GAME.damageCooldown`.

## Desempenho

- Pools fixos: 64 balas, 160 partículas e 48 zumbis. Nada é criado ou destruído
  durante o jogo.
- Zumbis desenhados com `InstancedMesh` (corpo, cabeça e braços: 3 draw calls) e
  balas com um único `InstancedMesh`.
- Geometrias e materiais compartilhados; vetores, matrizes e buffers são
  reutilizados dentro do loop.
- Objetos estáticos têm a matriz congelada e não são recalculados por frame.
- Uma única luz com sombra, shadow map de 1024 e área de sombra acompanhando o
  jogador.
- Partículas, rastro e clarão do cano usam materiais aditivos, sem luz dinâmica.
- `setPixelRatio(Math.min(devicePixelRatio, 2))`, névoa leve e sem
  pós-processamento.
- Colisão de balas em subpassos para não atravessar zumbis em alta velocidade.
- Delta time limitado a `0.05s` para evitar saltos após travadas.
- Draw calls exibidos no painel de debug: cerca de 32 na cena com jogador,
  obstáculos, zumbis e balas (incluindo o passe de sombra).

O painel de debug aparece no canto inferior esquerdo apenas durante o
desenvolvimento (`npm run dev`).

## Status

Protótipo jogável concluído: sobrevivência com hordas, metralhadora de munição
infinita, cronômetro, vida, abates, game over e reinício. Sem som, menus ou
suporte a toque.
