const down = new Set();
const pressed = new Set();

let rightDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let dragX = 0;
let dragY = 0;
let wheelDelta = 0;

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
  if (event.button === 2) {
    rightDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    return;
  }

  if (event.button !== 0) return;

  down.add('Mouse0');
  pressed.add('Mouse0');
}

function onMouseMove(event) {
  if (!rightDragging) return;

  dragX += event.clientX - lastMouseX;
  dragY += event.clientY - lastMouseY;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
}

function onMouseUp(event) {
  if (event.button === 2) rightDragging = false;
  if (event.button === 0) down.delete('Mouse0');
}

function onWheel(event) {
  wheelDelta += event.deltaY;
  event.preventDefault();
}

function onContextMenu(event) {
  event.preventDefault();
}

function onBlur() {
  down.clear();
  pressed.clear();
  rightDragging = false;
  dragX = 0;
  dragY = 0;
  wheelDelta = 0;
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('contextmenu', onContextMenu);
window.addEventListener('blur', onBlur);

export const input = {
  get dragX() {
    return dragX;
  },
  get dragY() {
    return dragY;
  },
  get wheelDelta() {
    return wheelDelta;
  },
  isDown(code) {
    return down.has(code);
  },
  wasPressed(code) {
    return pressed.has(code);
  },
  endFrame() {
    pressed.clear();
    dragX = 0;
    dragY = 0;
    wheelDelta = 0;
  },
};
