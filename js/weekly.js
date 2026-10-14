// Weekoverzicht (op zondag en maandag) en gemiste trainingen op Vandaag.
import { SPORTS } from './data.js';
import { state, allSessions, logForSession, isSkipped, setSkipped, missedSessions, saveSetting } from './plan.js';
import { recordHistory } from './records.js';
import * as D from './dates.js';
import { esc, icon, fmtNum, fmtKm, toast } from './ui.js';

const logRoute = (s) => `#/loggen/${s.sport === 'strength' ? 'kracht' : s.sport === 'swim' ? 'zwemmen' : 'hardlopen'}/${s.id}`;
const nameOf = (s) => (s.sport === 'strength' || s.race ? s.title : `${s.kind} ${s.title}`);

export function weekSummaryHtml(today) {
  const wd = D.weekdayIndex(today);
  if (wd !== 6 && wd !== 0) return '';
  const monday = wd === 6 ? D.mondayOf(today) : D.addDays(D.mondayOf(today), -7);
  if (state.settings.weekHidden === monday) return '';
  const sunday = D.addDays(monday, 6);
  const inWeek = (d) => d >= monday && d <= sunday;
  const sessions = allSessions().filter((s) => inWeek(s.date) && !s.race);
  const logs = state.logs.filter((l) => inWeek(l.date));
  if (!sessions.length && !logs.length) return '';

  const rows = ['run', 'strength', 'swim'].map((sport) => {
    const planned = sessions.filter((s) => s.sport === sport);
    const done = planned.filter((s) => logForSession(s.id)).length;
    const sportLogs = logs.filter((l) => l.sport === sport);
    if (!planned.length && !sportLogs.length) return '';
    let amount = '';
    if (sport === 'run') amount = `${fmtKm(sportLogs.reduce((a, l) => a + (l.km || 0), 0))} van ${fmtKm(planned.reduce((a, s) => a + (s.km || 0), 0))} km`;
    if (sport === 'strength') amount = `${fmtNum(sportLogs.reduce((a, l) => a + (l.volume || 0), 0), 0)} kg volume`;
    if (sport === 'swim') amount = `${fmtNum(sportLogs.reduce((a, l) => a + (l.meters || 0), 0), 0)} m`;
    const count = planned.length ? `${done} van ${planned.length} trainingen` : `${sportLogs.length}× gedaan`;
    return `<li><span class="dot" style="background:${SPORTS[sport].color}"></span><div class="grow"><div class="strong">${SPORTS[sport].label}</div><div class="muted small">${count}</div></div><strong>${amount}</strong></li>`;
  }).join('');

  const skipped = sessions.filter((s) => !logForSession(s.id) && isSkipped(s.id)).length;
  const open = sessions.filter((s) => !logForSession(s.id) && !isSkipped(s.id) && s.date <= today).length;
  const done = sessions.filter((s) => logForSession(s.id)).length;
  const records = recordHistory().events.filter((e) => inWeek(e.date));
  const verdict = done === sessions.length && sessions.length
    ? 'Alles gedaan wat gepland stond. Sterk!'
    : `${done} van ${sessions.length} geplande trainingen gedaan${skipped ? `, ${skipped} overgeslagen` : ''}${open ? `, ${open} nog open` : ''}.`;

  return `<section class="card weekly">
    <div class="section-head"><div><div class="eyebrow">${wd === 6 ? 'DEZE WEEK' : 'VORIGE WEEK'} · ${esc(D.dayMonth(monday))} – ${esc(D.dayMonth(sunday))}</div><h2>Je week in het kort</h2></div>
      <button type="button" class="icon-btn" data-weekhide="${monday}" aria-label="Weekoverzicht verbergen">${icon('x', 20)}</button></div>
    <p class="small">${esc(verdict)}</p>
    <ul class="wk-sports">${rows}</ul>
    ${records.length ? `<div class="wk-records"><div class="eyebrow">NIEUWE RECORDS</div>${records.map((r) => `<div class="small">${esc(r.text)}</div>`).join('')}</div>` : ''}
  </section>`;
}

export function missedHtml(today) {
  const missed = missedSessions(today, 3);
  if (!missed.length) return '';
  const anyRun = missed.some((s) => s.sport === 'run');
  return `<section class="card missed">
    <div><div class="eyebrow">GEMIST?</div><h2 class="h2">${missed.length === 1 ? 'Deze training staat nog open' : `${missed.length} trainingen staan nog open`}</h2>
    <p class="muted small">${anyRun ? 'Je schema zegt: haal gemiste looptrainingen niet in. Overslaan is dus prima. ' : ''}Toch gedaan? Log hem alsnog.</p></div>
    ${missed.map((s) => `<div class="missed-item">
      <div class="row"><div class="stripe" style="background:${SPORTS[s.sport].color}"></div>
        <div class="grow"><div class="row-title">${esc(nameOf(s))}</div><div class="muted small">${esc(D.longLabel(s.date))}</div></div></div>
      <div class="grid3">
        <a class="btn-outline" href="${logRoute(s)}">Toch gedaan</a>
        <a class="btn-outline" href="#/kalender/${s.date}/verplaats/${s.id}">Verplaatsen</a>
        <button type="button" class="btn-outline" data-skip="${esc(s.id)}">Overslaan</button>
      </div>
    </div>`).join('')}
  </section>`;
}

export function bindToday(root, rerender) {
  root.addEventListener('click', async (e) => {
    const sk = e.target.closest('[data-skip]');
    if (sk) { await setSkipped(sk.dataset.skip, true); toast('Overgeslagen. In de kalender kun je hem weer inplannen.'); rerender(); return; }
    const hide = e.target.closest('[data-weekhide]');
    if (hide) { await saveSetting('weekHidden', hide.dataset.weekhide); rerender(); }
  });
}
