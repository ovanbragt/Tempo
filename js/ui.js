// Kleine hulpjes voor de schermen.

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtNum = (n, digits = 1) => {
  if (n == null || Number.isNaN(n)) return '–';
  const f = 10 ** digits;
  return (Math.round(n * f) / f).toLocaleString('nl-NL');
};
export const fmtKm = (n) => fmtNum(n, 1);

// Getal uit invoer, met komma of punt
export function num(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "5:30", "41:10" of "1:28:31" → seconden
export function parseTime(v) {
  if (!v) return null;
  const parts = String(v).trim().replace(/[.,]/g, ':').split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || Number.isNaN(Number(p)))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0] * 60; // alleen minuten
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return null;
}

export function fmtDuration(sec) {
  if (sec == null) return '–';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// seconden per km (of per 100 m) → "5:38"
export function fmtPace(sec) {
  if (!sec || !Number.isFinite(sec)) return '–:–';
  const r = Math.round(sec);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
}

export const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  logo: '<path d="M3 17l5-6 4 3 6-8"/><path d="M14 6h4v4"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/>',
};
export const icon = (name, size = 24) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

let toastTimer;
export function toast(message, kind = 'ok') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = `toast ${kind} show`;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
