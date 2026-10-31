const down = new Set();
const pressed = new Set();

function onKeyDown(event) {
  if (event.repeat) return;

  down.add(event.code);
  pressed.add(event.code);

  if (event.code === 'Space' || event.code.startsWith('Arrow')) {
    event.preventDefault();
  }
}

function onKeyUp(event) {
  down.delete(event.code);
}

function onMouseDown(event) {
  if (event.button !== 0) return;

  down.add('Mouse0');
  pressed.add('Mouse0');
}

function onMouseUp(event) {
  if (event.button === 0) down.delete('Mouse0');
}

function onBlur() {
  down.clear();
  pressed.clear();
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('blur', onBlur);

export const input = {
  isDown(code) {
    return down.has(code);
  },
  wasPressed(code) {
    return pressed.has(code);
  },
  endFrame() {
    pressed.clear();
  },
};
