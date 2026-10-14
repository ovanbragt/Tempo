// Stap 3: kalender met trainingen verplaatsen.
import { SPORTS } from './data.js';
import { state, sessionsOn, logForSession, moveSession, sessionById, isSkipped, setSkipped } from './plan.js';
import * as D from './dates.js';
import { esc, icon, fmtKm, fmtNum, fmtDuration, fmtPace, toast } from './ui.js';

const FILTERS = [
  { key: 'alles', label: 'Alles' },
  { key: 'strength', label: 'Kracht' },
  { key: 'run', label: 'Hardlopen' },
  { key: 'swim', label: 'Zwemmen' },
];
const ui = { filter: 'alles', moving: null, msg: null, warn: false };

const logRoute = (s) => `#/loggen/${s.sport === 'strength' ? 'kracht' : s.sport === 'swim' ? 'zwemmen' : 'hardlopen'}/${s.id}`;
const nameOf = (s) => (s.sport === 'strength' || s.race ? s.title : `${s.kind} ${s.title}`);
const show = (sport) => ui.filter === 'alles' || ui.filter === sport;

function logsOn(date) {
  return state.logs.filter((l) => l.date === date);
}

function summary(log) {
  if (log.sport === 'strength') return `${log.setCount || ''} sets · ${fmtNum(log.volume, 0)} kg volume`;
  if (log.sport === 'run') return `${fmtKm(log.km)} km${log.durationSec ? ` in ${fmtDuration(log.durationSec)} · ${fmtPace(log.paceSec)} min/km` : ''}`;
  if (log.sport === 'swim') return `${fmtNum(log.meters, 0)} m${log.durationSec ? ` in ${fmtDuration(log.durationSec)}` : ''}`;
  return '';
}

function runNearby(date, exceptId) {
  return [-1, 0, 1].some((off) => sessionsOn(D.addDays(date, off)).some((s) => s.sport === 'run' && s.id !== exceptId));
}

function monthGrid(year, month, selected, today) {
  const first = D.iso(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = D.weekdayIndex(first);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-empty"></span>');
  for (let n = 1; n <= daysInMonth; n++) {
    const d = D.iso(new Date(year, month, n));
    const ss = sessionsOn(d).filter((s) => show(s.sport));
    const extra = logsOn(d).filter((l) => !l.sessionId && show(l.sport));
    const dots = [
      ...ss.map((s) => (logForSession(s.id) ? `<b style="color:${SPORTS[s.sport].color}">${icon('check', 10)}</b>` : `<i style="background:${SPORTS[s.sport].color}"></i>`)),
      ...extra.map((l) => `<b style="color:${SPORTS[l.sport].color}">${icon('check', 10)}</b>`),
    ].join('');
    const cls = ['cal-day', d === selected ? 'sel' : '', d === today ? 'today' : '', d < today ? 'past' : ''].filter(Boolean).join(' ');
    const label = `${n} ${D.MONTHS[month]}${ss.length ? ', ' + ss.map((s) => s.title).join(', ') : ''}${extra.length ? ', extra gelogd' : ''}`;
    cells.push(`<a class="${cls}" href="#/kalender/${d}" aria-label="${esc(label)}"${d === selected ? ' aria-current="date"' : ''}><span>${n}</span><span class="cal-dots">${dots}</span></a>`);
  }
  return cells.join('');
}

function itemCard(s, today) {
  const sport = SPORTS[s.sport];
  const log = logForSession(s.id);
  const moved = s.date !== s.origDate;
  return `<div class="card cal-item">
    <div class="row">
      <div class="stripe" style="background:${sport.color}"></div>
      <div class="grow">
        <div class="eyebrow" style="color:${sport.color}">${esc(s.kind.toUpperCase())}${s.week ? ` · WEEK ${s.week}` : ''}${s.deload ? ' · DELOAD' : ''}${s.rest ? ' · RUSTWEEK' : ''}</div>
        <div class="row-title">${esc(s.title)}</div>
        <div class="muted small">${esc(s.detail)}</div>
        ${moved ? `<div class="moved">Verplaatst van ${esc(D.shortLabel(s.origDate))}</div>` : ''}
        ${log ? `<div class="done-line small-line">${icon('check', 16)}<span>Gelogd: ${esc(summary(log))}</span></div>` : ''}
        ${!log && isSkipped(s.id) ? '<div class="moved">Overgeslagen</div>' : ''}
      </div>
    </div>
    <div class="grid2">
      ${log || s.race ? '<span></span>' : isSkipped(s.id) ? `<button type="button" class="btn-outline" data-unskip="${esc(s.id)}">Toch inplannen</button>` : `<button type="button" class="btn-outline" data-move="${esc(s.id)}">${icon('swap', 18)} Verplaatsen</button>`}
      <a class="btn small" style="background:${log ? 'var(--ink)' : sport.color}" href="${logRoute(s)}">${log ? 'Log bekijken' : s.date > today ? 'Vooruit loggen' : 'Loggen'}</a>
    </div>
  </div>`;
}

function movePanel(s) {
  // Een gemiste training (in het verleden) verplaats je naar de komende dagen, anders binnen dezelfde week
  const today = D.today();
  const first = s.date < today ? today : D.mondayOf(s.date);
  const options = [];
  for (let i = 0; i < 7; i++) {
    const d = D.addDays(first, i);
    if (d === s.date) continue;
    const busy = sessionsOn(d).filter((x) => x.id !== s.id);
    const warn = s.sport === 'run' && runNearby(d, s.id);
    options.push(`<button type="button" class="move-opt" data-to="${d}">
      <span class="grow"><span class="strong">${esc(D.longLabel(d))}</span><span class="muted small">${busy.length ? `Al gepland: ${esc(busy.map(nameOf).join(', '))}` : 'Nog niets gepland'}</span></span>
      ${warn ? '<span class="warn-tag">Geen rustdag ertussen</span>' : ''}
    </button>`);
  }
  const moved = s.date !== s.origDate;
  return `<section class="card move-panel" aria-label="Training verplaatsen">
    <div class="section-head"><h3>${esc(nameOf(s))} verplaatsen naar…</h3>
      <button type="button" class="icon-btn" data-cancel aria-label="Annuleren">${icon('x', 20)}</button></div>
    ${moved ? `<button type="button" class="move-opt back" data-to="${s.origDate}"><span class="grow"><span class="strong">Terug naar ${esc(D.longLabel(s.origDate))}</span><span class="muted small">De originele dag uit je schema</span></span></button>` : ''}
    ${options.join('')}
    <label class="field"><span>OF KIES EEN ANDERE DATUM</span>
      <div class="inline"><input class="in" type="date" data-otherdate value="${s.date}"><button type="button" class="btn-outline" data-todate>Kies</button></div>
    </label>
    <p class="muted small">Je schema rekent met minstens één rustdag tussen twee looptrainingen.</p>
  </section>`;
}

export function viewCalendar(parts) {
  const today = D.today();
  const selected = parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) ? parts[0] : today;
  if (parts[1] === 'verplaats' && parts[2]) ui.moving = parts[2];
  else if (ui.moving && sessionById(ui.moving)?.date !== selected) ui.moving = null;
  const sel = D.parse(selected);
  const year = sel.getFullYear(); const month = sel.getMonth();
  const prevMonth = D.iso(new Date(year, month - 1, 1));
  const nextMonth = D.iso(new Date(year, month + 1, 1));
  const items = sessionsOn(selected).filter((s) => show(s.sport));
  const extra = logsOn(selected).filter((l) => !l.sessionId && show(l.sport));
  const moving = ui.moving ? sessionById(ui.moving) : null;
  const weekNo = (() => {
    const run = state.plans.find((p) => p.id === 'domloop');
    const s = run.sessions.filter((x) => x.date <= selected).pop();
    return s && selected <= run.end ? `Schemaweek ${s.week}` : '';
  })();

  const html = `<main class="page">
    <header class="cal-head">
      <a class="round-link" href="#/kalender/${prevMonth}" aria-label="Vorige maand">${icon('back', 20)}</a>
      <h1 class="display">${D.MONTHS[month][0].toUpperCase() + D.MONTHS[month].slice(1)} ${year}</h1>
      <a class="round-link" href="#/kalender/${nextMonth}" aria-label="Volgende maand">${icon('chev', 20)}</a>
    </header>
    <div class="chips" role="group" aria-label="Filter op sport">
      ${FILTERS.map((f) => `<button type="button" class="chip pill" data-filter="${f.key}" aria-pressed="${ui.filter === f.key}">${f.key !== 'alles' ? `<i style="background:${SPORTS[f.key].color}"></i>` : ''}${f.label}</button>`).join('')}
    </div>
    <div class="card cal">
      <div class="cal-wd">${D.WD_SHORT.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${monthGrid(year, month, selected, today)}</div>
    </div>
    ${selected !== today ? `<a class="btn-link" href="#/kalender/${today}">Naar vandaag</a>` : ''}
    ${ui.msg ? `<div class="notice ${ui.warn ? '' : 'ok'}" role="status">${esc(ui.msg)}</div>` : ''}
    <div class="section-head"><h2>${esc(D.longLabel(selected))}</h2><span class="muted small">${esc(weekNo)}</span></div>
    ${items.map((s) => itemCard(s, today)).join('')}
    ${extra.map((l) => `<div class="card row"><div class="stripe" style="background:${SPORTS[l.sport].color}"></div><div class="grow"><div class="eyebrow">EXTRA GELOGD</div><div class="row-title">${esc(l.sport === 'swim' ? 'Zwemmen' : l.sport === 'run' ? l.title || 'Losse loop' : `Training ${l.workout}`)}</div><div class="muted small">${esc(summary(l))}</div></div></div>`).join('')}
    ${!items.length && !extra.length ? '<div class="card rest"><div class="row-title">Rustdag</div><div class="muted small">Geen training gepland.</div></div>' : ''}
    ${moving ? movePanel(moving) : ''}
  </main>`;

  function mount(root, rerender) {
    ui.msg = null;
    if (moving) root.querySelector('.move-panel')?.scrollIntoView({ block: 'start' });
    root.addEventListener('click', async (e) => {
      const f = e.target.closest('[data-filter]');
      if (f) { ui.filter = f.dataset.filter; rerender(); return; }
      const un = e.target.closest('[data-unskip]');
      if (un) { await setSkipped(un.dataset.unskip, false); toast('Weer ingepland'); rerender(); return; }
      const m = e.target.closest('[data-move]');
      if (m) { ui.moving = m.dataset.move; rerender(); return; }
      if (e.target.closest('[data-cancel]')) { ui.moving = null; rerender(); return; }
      let to = e.target.closest('[data-to]')?.dataset.to;
      if (e.target.closest('[data-todate]')) to = root.querySelector('[data-otherdate]').value;
      if (to && moving) {
        if (to === moving.date) { ui.moving = null; rerender(); return; }
        const warn = moving.sport === 'run' && runNearby(to, moving.id);
        await moveSession(moving.id, to);
        ui.moving = null;
        ui.warn = warn;
        const back = to === moving.origDate;
        const text = back
          ? `${nameOf(moving)} staat weer op ${D.shortLabel(to)}.`
          : `${nameOf(moving)} verplaatst van ${D.shortLabel(moving.date)} naar ${D.shortLabel(to)}.${warn ? ' Let op: er zit nu geen rustdag tussen twee looptrainingen.' : ''}`;
        toast(back ? 'Teruggezet' : 'Verplaatst', warn ? 'warn' : 'ok');
        ui.msg = text;
        if (location.hash === `#/kalender/${to}`) rerender();
        else location.hash = `#/kalender/${to}`;
      }
    });
  }
  return { html, mount };
}
