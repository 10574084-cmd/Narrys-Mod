// Ajustes compartidos entre el menú (main.js) y el motor (game.js)
export const DEFAULT_KEYS = {
  fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft', jump: 'Space',
  light: 'KeyF', revive: 'KeyE', board: 'Tab', slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4', slot5: 'Digit5', slot6: 'Digit6',
};
export const ACTIONS = [
  ['fwd', 'Avanzar'], ['back', 'Retroceder'], ['left', 'Izquierda'], ['right', 'Derecha'], ['run', 'Correr'], ['jump', 'Saltar'],
  ['light', 'Linterna'], ['revive', 'Revivir (mantener)'], ['board', 'Lista de jugadores'], ['slot1', 'Arma 1'], ['slot2', 'Arma 2'], ['slot3', 'Arma 3'], ['slot4', 'Arma 4'], ['slot5', 'Arma 5'], ['slot6', 'Arma 6'],
];
export const DEFAULT_PERF = { scale: 100, shadows: 'on', lights: 'norm', dist: 0, fps: 0, auto: false, showFps: false };
export const DEFAULT_EXTRA = { volume: 70, bob: true, invert: false, minimap: true, feed: true, names: true, runToggle: false, aimToggle: false, mouse: 'left', crossColor: '#ffffff', crossSize: 100 };

const NAMES = { Space: 'Espacio', ShiftLeft: 'Shift', ShiftRight: 'Shift der.', ControlLeft: 'Ctrl', ControlRight: 'Ctrl der.', AltLeft: 'Alt', AltRight: 'Alt der.',
  Tab: 'Tab', Enter: 'Enter', Backspace: '←Borrar', CapsLock: 'Bloq Mayús', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
export function keyLabel(code) {
  if (NAMES[code]) return NAMES[code];
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^Digit(\d)$/.exec(code); if (m) return m[1];
  m = /^Numpad(.+)$/.exec(code); if (m) return 'Num ' + m[1];
  return code;
}
