import { GAME } from './config.js';

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0',
  )}.${tenths}`;
}

export function createHud() {
  const timeElement = document.getElementById('hud-time');
  const killsElement = document.getElementById('hud-kills');
  const healthFill = document.getElementById('hud-health-fill');
  const healthText = document.getElementById('hud-health-text');
  const overlay = document.getElementById('game-over');
  const finalTime = document.getElementById('final-time');
  const finalKills = document.getElementById('final-kills');

  let lastTime = '';
  let lastKills = -1;
  let lastHealth = -1;

  function update(game) {
    const timeText = formatTime(game.time);
    if (timeText !== lastTime) {
      timeElement.textContent = timeText;
      lastTime = timeText;
    }

    if (game.kills !== lastKills) {
      killsElement.textContent = String(game.kills);
      lastKills = game.kills;
    }

    const health = Math.ceil(game.health);
    if (health !== lastHealth) {
      healthText.textContent = String(health);
      const ratio = Math.max(0, Math.min(1, game.health / GAME.maxHealth));
      healthFill.style.width = `${ratio * 100}%`;
      healthFill.classList.toggle('low', ratio <= 0.3);
      lastHealth = health;
    }
  }

  function showGameOver(game) {
    finalTime.textContent = formatTime(game.time);
    finalKills.textContent = String(game.kills);
    overlay.hidden = false;
  }

  function hideGameOver() {
    overlay.hidden = true;
  }

  return { update, showGameOver, hideGameOver };
}
