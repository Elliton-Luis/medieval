import { DEBUG } from './config.js';

export function createDebugPanel() {
  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.bottom = '12px';
  panel.style.left = '12px';
  panel.style.padding = '6px 10px';
  panel.style.borderRadius = '6px';
  panel.style.background = 'rgba(20, 32, 30, 0.55)';
  panel.style.color = '#f4f7f5';
  panel.style.font = '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace';
  panel.style.letterSpacing = '0.03em';
  panel.style.pointerEvents = 'none';
  panel.style.userSelect = 'none';
  panel.textContent = 'FPS -- · Draw calls --';
  document.body.appendChild(panel);

  let frames = 0;
  let elapsed = 0;

  function update(dt, drawCalls) {
    frames += 1;
    elapsed += dt;
    if (elapsed < DEBUG.updateInterval) return;

    const fps = Math.round(frames / elapsed);
    panel.textContent = `FPS ${fps} · Draw calls ${drawCalls}`;
    frames = 0;
    elapsed = 0;
  }

  return { update };
}
