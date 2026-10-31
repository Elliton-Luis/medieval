// Salvamento simples em localStorage (usado ao dormir).
const KEY = "gta-medieval-save-v1";

export function saveGame(game) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, ...game }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}
