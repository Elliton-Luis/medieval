# Puris

Protótipo de um jogo de ação 3D leve que roda no navegador. Nesta etapa o
projeto tem apenas a base técnica: Vite, Three.js e uma tela de renderização.

## Stack

- [Three.js](https://threejs.org/) `0.187.0`
- [Vite](https://vite.dev/) `8.3.5`
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

## Estrutura

```text
index.html
src/
  main.js      renderer, loop, junta os módulos
  scene.js     cena, câmera, luzes, chão e obstáculos
  input.js     estado do teclado/mouse (sem lógica de jogo)
  player.js    movimento, rotação, pulo
  fireball.js  pool de projéteis, lançamento, atualização, colisão
  config.js    constantes de ajuste
  debug.js     painel de FPS e draw calls (só em desenvolvimento)
```

## Status

Fase 0 concluída: setup do projeto e tela inicial.
