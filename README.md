# Puris

Protótipo de um jogo de ação 3D leve que roda no navegador. Esta etapa entrega
apenas as mecânicas básicas: andar, pular e lançar bolas de fogo em um alvo de
teste. Não há história, inimigos, menus, som nem assets externos.

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

| Ação         | Teclas                  |
| ------------ | ----------------------- |
| Andar        | `W` `A` `S` `D` / setas |
| Pular        | `Espaço`                |
| Bola de fogo | Clique esquerdo / `F`   |

O movimento é relativo à câmera. Diagonais são normalizadas, o personagem gira
suavemente para a direção do movimento e não atravessa obstáculos. O pulo usa
gravidade e não permite pulo duplo; a sombra no chão indica a altura.

A bola de fogo sai da frente do personagem, voa em linha reta, tem tempo de vida
limitado e retorna ao pool ao expirar ou colidir. O alvo de teste pisca quando
atingido.

## Estrutura

```text
index.html
src/
  main.js      renderer, loop, junta os módulos
  scene.js     cena, câmera, luzes, chão, obstáculos e alvo
  input.js     estado do teclado/mouse (sem lógica de jogo)
  player.js    movimento, rotação, pulo e colisão
  fireball.js  pool de projéteis, partículas, lançamento e colisão
  config.js    constantes de ajuste
  debug.js     painel de FPS e draw calls (só em desenvolvimento)
```

## Ajustes

Velocidades, aceleração, gravidade, força do pulo, cooldown, tempo de vida,
tamanho dos pools, câmera, névoa e cores ficam em `src/config.js`.

## Desempenho

- Pool fixo de 16 bolas de fogo e 96 partículas: nada é criado ou destruído por
  tiro.
- Geometrias e materiais compartilhados entre obstáculos, projéteis e partículas.
- Sem alocações de objetos dentro do loop do jogo; vetores e buffers são
  reutilizados.
- Matrizes de objetos estáticos não são recalculadas a cada frame.
- Uma única luz com sombra, shadow map de 1024 e área de sombra acompanhando o
  jogador.
- Brilho do projétil feito com material emissivo, sprite aditivo e partículas,
  sem luz dinâmica.
- `setPixelRatio(Math.min(devicePixelRatio, 2))`, névoa leve e sem
  pós-processamento.
- Delta time limitado a `0.05s` para evitar saltos após travadas.
- Draw calls exibidos no painel de debug: cerca de 21 na cena base (incluindo o
  passe de sombra) e 23 com um projétil ativo.

O painel de debug aparece apenas durante o desenvolvimento (`npm run dev`).

## Status

Protótipo das fases 0 a 5 concluído. Escopo fechado nas três mecânicas básicas.
