// Rust-timer tussen sets. Rekent met een eindtijd, zodat hij ook klopt als het scherm even uit was.
import { icon } from './ui.js';

let bar = null;
let endAt = 0;
let total = 0;
let tick = null;
let audio = null;
let finished = false;

function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function unlockAudio() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}

function beep() {
  try { navigator.vibrate?.([250, 120, 250]); } catch { /* niet ondersteund */ }
  if (!audio) return;
  const t0 = audio.currentTime;
  [0, 0.28, 0.56].forEach((d, i) => {
    const o = audio.createOscillator(); const g = audio.createGain();
    o.frequency.value = i === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
    o.connect(g).connect(audio.destination);
    o.start(t0 + d); o.stop(t0 + d + 0.25);
  });
}

function ensureBar() {
  if (bar && document.body.contains(bar)) return bar;
  bar = document.createElement('div');
  bar.className = 'restbar';
  bar.setAttribute('role', 'timer');
  bar.innerHTML = `
    <div class="rb-main"><span class="rb-label">Rust</span><strong class="rb-time" aria-live="off">0:00</strong></div>
    <div class="rb-progress"><div></div></div>
    <div class="rb-btns">
      <button type="button" data-rb="-15" aria-label="15 seconden korter">−15</button>
      <button type="button" data-rb="15" aria-label="15 seconden langer">+15</button>
      <button type="button" data-rb="stop" aria-label="Timer stoppen">${icon('x', 18)}</button>
    </div>`;
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rb]');
    if (!b) return;
    if (b.dataset.rb === 'stop') { stop(); return; }
    const d = Number(b.dataset.rb);
    endAt = Math.max(Date.now() + 1000, endAt + d * 1000);
    total = Math.max(15, total + d);
    finished = false;
    bar.classList.remove('done');
    render();
  });
  document.body.appendChild(bar);
  return bar;
}

function render() {
  if (!bar) return;
  const left = (endAt - Date.now()) / 1000;
  const timeEl = bar.querySelector('.rb-time');
  const labelEl = bar.querySelector('.rb-label');
  if (left <= 0) {
    if (!finished) {
      finished = true;
      bar.classList.add('done');
      labelEl.textContent = 'Volgende set!';
      timeEl.textContent = '0:00';
      bar.setAttribute('aria-label', 'Rust voorbij, volgende set');
      if (document.visibilityState === 'visible') beep();
      setTimeout(() => { if (finished) stop(); }, 6000);
    }
    bar.querySelector('.rb-progress > div').style.width = '100%';
    return;
  }
  labelEl.textContent = 'Rust';
  timeEl.textContent = fmt(left);
  bar.setAttribute('aria-label', `Rust, nog ${fmt(left)}`);
  bar.querySelector('.rb-progress > div').style.width = `${Math.min(100, (1 - left / total) * 100)}%`;
}

export function startRest(seconds) {
  unlockAudio(); // moet tijdens een tik gebeuren, anders mag de browser geen geluid maken
  ensureBar();
  total = seconds;
  endAt = Date.now() + seconds * 1000;
  finished = false;
  bar.classList.remove('done');
  bar.classList.add('show');
  clearInterval(tick);
  tick = setInterval(render, 250);
  render();
}

export function stop() {
  clearInterval(tick);
  finished = false;
  if (bar) bar.classList.remove('show', 'done');
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && bar?.classList.contains('show')) render(); });
