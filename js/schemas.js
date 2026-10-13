// Schema's: overzicht, nieuw schema maken, stoppen.
import { SPORTS } from './data.js';
import { state, currentWeek, logForSession, savePlan, deletePlan, sessionsOn } from './plan.js';
import { buildRunPlan, buildStrengthPlan, buildSwimPlan, RUN_DISTANCES, STRENGTH_GOALS, SWIM_GOALS } from './generator.js';
import * as D from './dates.js';
import { esc, num, parseTime, toast, icon } from './ui.js';

function nextMonday(today) {
  return D.weekdayIndex(today) === 0 ? today : D.addDays(D.mondayOf(today), 7);
}

const ui = {
  kind: 'run',
  preview: null,
  form: null,
};

function defaults() {
  const today = D.today();
  return {
    run: { raceName: '', distance: '10', raceDate: D.addDays(today, 7 * 12), goal: '', recentDist: '10', recentTime: '', currentLong: '', days: [1, 3, 6], longDay: '6', start: nextMonday(today) },
    strength: { goal: 'sterker', days: [0, 4], weeks: '8', start: nextMonday(today) },
    swim: { goal: 'conditie', startM: '800', targetM: '1500', days: [5], weeks: '8', start: nextMonday(today) },
  };
}

// ---------------------------------------------------------------- Overzicht
function weekOverview(p) {
  const byWeek = {};
  for (const s of p.sessions) (byWeek[s.week] ||= []).push(s);
  return `<details class="weeks"><summary>Alle weken bekijken</summary>
    <ol class="weeklist">${Object.keys(byWeek).sort((a, b) => a - b).map((w) => `<li>
      <div class="wk-head"><strong>Week ${w}</strong><span class="muted small">${esc(p.phase(Number(w)) || '')}</span></div>
      ${byWeek[w].sort((a, b) => (a.date < b.date ? -1 : 1)).map((s) => `<div class="wk-row${logForSession(s.id) ? ' done' : ''}"><span>${esc(D.shortLabel(state.moves[s.id] || s.date))}</span><span>${esc(s.sport === 'strength' || s.race ? s.title : `${s.kind}: ${s.title}`)}</span></div>`).join('')}
    </li>`).join('')}</ol>
  </details>`;
}

function viewList() {
  const today = D.today();
  const active = state.plans.filter((p) => p.end >= today);
  const done = state.plans.filter((p) => p.end < today);
  const card = (p) => {
    const sport = SPORTS[p.sport];
    const week = currentWeek(p, today);
    const pct = Math.max(2, Math.round((Math.min(week, p.weeks) / p.weeks) * 100));
    const upcoming = p.sessions.filter((s) => (state.moves[s.id] || s.date) >= today).length;
    const logged = p.sessions.filter((s) => logForSession(s.id)).length;
    const started = p.sessions.some((s) => s.date <= today);
    return `<article class="card plan">
      <div class="topbar" style="background:${sport.color}"></div>
      <div class="session-body">
        <div class="eyebrow" style="color:${sport.color}">${esc(sport.label.toUpperCase())} · ${p.perWeek}× PER WEEK${p.custom ? ' · EIGEN SCHEMA' : ''}</div>
        <div class="row-title lg">${esc(p.name)}</div>
        <div class="muted small">${esc(p.goal)}</div>
        <div class="muted small">${esc(p.days)}</div>
        <div class="bar light"><div style="width:${started ? pct : 2}%;background:${sport.color}"></div></div>
        <div class="plan-foot"><span>${started ? `Week ${week} van ${p.weeks}` : `Start ${esc(D.shortLabel(p.sessions[0]?.date || p.start))}`}</span><span class="muted">${esc(started ? p.phase(week) : `${p.weeks} weken`)}</span></div>
        <div class="muted small">${logged} gelogd · nog ${upcoming} trainingen tot ${esc(D.dayMonth(p.end))}</div>
        ${weekOverview(p)}
        ${p.custom ? `<button type="button" class="btn-link danger" data-stop="${esc(p.id)}">Schema stoppen</button>` : ''}
      </div>
    </article>`;
  };
  return `<main class="page">
    <header class="page-head"><h1 class="display xl">Schema's</h1></header>
    <a class="btn" style="background:var(--ink)" href="#/schemas/nieuw">${icon('plus', 20)} Nieuw schema maken</a>
    <h2 class="h2">Actief</h2>
    ${active.map(card).join('') || '<p class="muted">Geen actieve schema\'s.</p>'}
    ${done.length ? `<h2 class="h2">Afgerond</h2>${done.map(card).join('')}` : ''}
  </main>`;
}

// ---------------------------------------------------------------- Nieuw schema
function dayChips(sel, accent) {
  return `<fieldset class="field"><legend>TRAININGSDAGEN</legend>
    <div class="daychips">${D.WD_SHORT.map((d, i) => `<button type="button" class="chip" data-day="${i}" aria-pressed="${sel.includes(i)}" style="${sel.includes(i) ? `background:${accent};border-color:${accent}` : ''}">${d}</button>`).join('')}</div>
  </fieldset>`;
}

const sel = (name, value, options) => `<select name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

function formRun(f) {
  return `
    <label class="field"><span>NAAM VAN DE WEDSTRIJD (OPTIONEEL)</span><input class="in" name="raceName" value="${esc(f.raceName)}" placeholder="bijv. Zevenheuvelenloop"></label>
    <div class="grid2">
      <label class="field"><span>AFSTAND</span>${sel('distance', f.distance, RUN_DISTANCES.map((d) => [d.km, d.label]))}</label>
      <label class="field"><span>WEDSTRIJDDATUM</span><input class="in" type="date" name="raceDate" value="${esc(f.raceDate)}" min="${D.today()}"></label>
    </div>
    <label class="field"><span>DOELTIJD (OPTIONEEL)</span><input class="in" name="goal" value="${esc(f.goal)}" placeholder="u:mm:ss, bijv. 55:00"></label>
    <fieldset class="field"><legend>RECENTE UITSLAG (OPTIONEEL, VOOR JE TEMPO'S)</legend>
      <div class="grid2">${sel('recentDist', f.recentDist, RUN_DISTANCES.map((d) => [d.km, d.label]))}<input class="in" name="recentTime" value="${esc(f.recentTime)}" placeholder="tijd, bijv. 1:01:08" aria-label="Tijd van je recente uitslag"></div>
    </fieldset>
    <label class="field"><span>LANGSTE LOOP DIE JE NU AANKUNT (KM, OPTIONEEL)</span><input class="in" name="currentLong" inputmode="decimal" value="${esc(f.currentLong)}" placeholder="bijv. 10"></label>
    ${dayChips(f.days, 'var(--run)')}
    <label class="field"><span>LONG RUN OP</span>${sel('longDay', f.longDay, f.days.map((d) => [d, D.WD_LONG[d]]))}</label>
    <label class="field"><span>STARTEN OP</span><input class="in" type="date" name="start" value="${esc(f.start)}" min="${D.today()}"></label>`;
}

function formStrength(f) {
  return `
    <fieldset class="field"><legend>DOEL</legend>
      <div class="chips">${Object.entries(STRENGTH_GOALS).map(([k, g]) => `<button type="button" class="chip" data-goal="${k}" aria-pressed="${f.goal === k}">${esc(g.label)}</button>`).join('')}</div>
    </fieldset>
    <p class="muted small">${esc(STRENGTH_GOALS[f.goal].label)}: ${STRENGTH_GOALS[f.goal].compound} reps op squat, deadlift, bench press en rows. De oefeningen zijn die van je Full Body A/B.</p>
    ${dayChips(f.days, 'var(--str)')}
    <div class="grid2">
      <label class="field"><span>AANTAL WEKEN</span>${sel('weeks', f.weeks, [['8', '8 weken'], ['12', '12 weken']])}</label>
      <label class="field"><span>STARTEN OP</span><input class="in" type="date" name="start" value="${esc(f.start)}" min="${D.today()}"></label>
    </div>`;
}

function formSwim(f) {
  return `
    <label class="field"><span>DOEL</span>${sel('goal', f.goal, Object.entries(SWIM_GOALS))}</label>
    <div class="grid2">
      <label class="field"><span>NU PER TRAINING (M)</span><input class="in" name="startM" inputmode="numeric" value="${esc(f.startM)}"></label>
      <label class="field"><span>DOEL PER TRAINING (M)</span><input class="in" name="targetM" inputmode="numeric" value="${esc(f.targetM)}"></label>
    </div>
    ${dayChips(f.days, 'var(--swim)')}
    <div class="grid2">
      <label class="field"><span>AANTAL WEKEN</span>${sel('weeks', f.weeks, [['6', '6 weken'], ['8', '8 weken'], ['12', '12 weken']])}</label>
      <label class="field"><span>STARTEN OP</span><input class="in" type="date" name="start" value="${esc(f.start)}" min="${D.today()}"></label>
    </div>`;
}

function generate() {
  const f = ui.form[ui.kind];
  if (ui.kind === 'run') {
    const recentSec = parseTime(f.recentTime);
    return buildRunPlan({
      raceName: f.raceName.trim(), distance: Number(f.distance), raceDate: f.raceDate,
      goalSec: parseTime(f.goal), recent: recentSec ? { km: Number(f.recentDist), sec: recentSec } : null,
      currentLong: num(f.currentLong), days: f.days, longDay: Number(f.longDay), start: f.start || D.today(),
    });
  }
  if (ui.kind === 'strength') return buildStrengthPlan({ goal: f.goal, days: f.days, weeks: Number(f.weeks), start: f.start || D.today() });
  return buildSwimPlan({ goal: f.goal, startM: num(f.startM), targetM: num(f.targetM), days: f.days, weeks: Number(f.weeks), start: f.start || D.today() });
}

function previewHtml({ plan, warnings }) {
  const sport = SPORTS[plan.sport];
  const conflicts = plan.sessions.filter((s) => sessionsOn(s.date).length).map((s) => s.date);
  const byWeek = {};
  for (const s of plan.sessions) (byWeek[s.week] ||= []).push(s);
  const weekKeys = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
  const row = (w) => `<li><div class="wk-head"><strong>Week ${w}</strong><span class="muted small">${esc(plan.phaseNames[w - 1] || '')}</span></div>
    ${byWeek[w].sort((a, b) => (a.date < b.date ? -1 : 1)).map((s) => `<div class="wk-row"><span>${esc(D.shortLabel(s.date))}</span><span>${esc(s.sport === 'strength' || s.race ? s.title : `${s.kind}: ${s.title}`)}</span></div><div class="wk-detail muted small">${esc(s.detail)}</div>`).join('')}</li>`;
  return `<section class="card preview">
    <div class="topbar" style="background:${sport.color}"></div>
    <div class="session-body">
      <div class="eyebrow" style="color:${sport.color}">VOORBEELD · ${esc(sport.label.toUpperCase())}</div>
      <div class="row-title lg">${esc(plan.name)}</div>
      <div class="muted small">${esc(plan.goal)}</div>
      <div class="grid3 kpis">
        <div><div class="eyebrow">WEKEN</div><div class="display md">${plan.weeks}</div></div>
        <div><div class="eyebrow">TRAININGEN</div><div class="display md">${plan.sessions.length}</div></div>
        <div><div class="eyebrow">START</div><div class="display md">${esc(D.dayMonth(plan.sessions[0]?.date || plan.start))}</div></div>
      </div>
      ${warnings.map((w) => `<div class="notice">${esc(w)}</div>`).join('')}
      ${conflicts.length ? `<div class="notice">Op ${conflicts.length} ${conflicts.length === 1 ? 'dag' : 'dagen'} staat al een andere training, bijvoorbeeld ${esc(D.shortLabel(conflicts[0]))}. Na het opslaan kun je trainingen verplaatsen in de kalender.</div>` : ''}
      <ol class="weeklist">${weekKeys.slice(0, 3).map(row).join('')}</ol>
      ${weekKeys.length > 3 ? `<details class="weeks"><summary>Alle ${weekKeys.length} weken bekijken</summary><ol class="weeklist">${weekKeys.slice(3).map(row).join('')}</ol></details>` : ''}
    </div>
  </section>
  <button type="button" class="btn" style="background:${sport.color}" data-save>Schema opslaan</button>
  <button type="button" class="btn-link" data-back>Aanpassen</button>`;
}

function viewNew() {
  ui.form ||= defaults();
  const f = ui.form[ui.kind];
  const html = `<main class="page">
    <a class="btn-link left" href="#/schemas">${icon('back', 18)} Schema's</a>
    <header class="page-head"><h1 class="display xl">Nieuw schema</h1></header>
    ${ui.preview ? previewHtml(ui.preview) : `
    <nav class="seg seg3" aria-label="Soort schema">${[['run', 'Hardlopen'], ['strength', 'Kracht'], ['swim', 'Zwemmen']].map(([k, l]) => `<button type="button" data-kind="${k}" class="${k === ui.kind ? 'on' : ''}" aria-pressed="${k === ui.kind}">${l}</button>`).join('')}</nav>
    <section class="card form" data-form>
      ${ui.kind === 'run' ? formRun(f) : ui.kind === 'strength' ? formStrength(f) : formSwim(f)}
    </section>
    <button type="button" class="btn" style="background:var(--ink)" data-preview>Voorbeeld bekijken</button>
    <p class="muted small center">Je ziet eerst het hele schema. Pas na "Schema opslaan" komt het in je kalender.</p>`}
  </main>`;

  function mount(root, rerender) {
    root.addEventListener('input', (e) => {
      const el = e.target.closest('[name]');
      if (el && root.querySelector('[data-form]')) f[el.name] = el.value;
    });
    root.addEventListener('change', (e) => {
      const el = e.target.closest('[name]');
      if (el && root.querySelector('[data-form]')) f[el.name] = el.value;
    });
    root.addEventListener('click', async (e) => {
      const k = e.target.closest('[data-kind]');
      if (k) { ui.kind = k.dataset.kind; rerender(); return; }
      const day = e.target.closest('[data-day]');
      if (day) {
        const i = Number(day.dataset.day);
        f.days = f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort((a, b) => a - b);
        if (ui.kind === 'run' && !f.days.includes(Number(f.longDay)) && f.days.length) f.longDay = String(f.days[f.days.length - 1]);
        rerender();
        return;
      }
      const g = e.target.closest('[data-goal]');
      if (g) { f.goal = g.dataset.goal; rerender(); return; }
      if (e.target.closest('[data-preview]')) {
        try { ui.preview = generate(); rerender(); } catch (err) { toast(err.message, 'warn'); }
        return;
      }
      if (e.target.closest('[data-back]')) { ui.preview = null; rerender(); return; }
      if (e.target.closest('[data-save]')) {
        await savePlan(ui.preview.plan);
        toast(`${ui.preview.plan.name} opgeslagen`);
        ui.preview = null; ui.form = null;
        location.hash = '#/schemas';
      }
    });
  }
  return { html, mount };
}

export function viewSchemas(parts) {
  if (parts[0] === 'nieuw') return viewNew();
  ui.preview = null;
  return {
    html: viewList(),
    mount(root, rerender) {
      root.addEventListener('click', async (e) => {
        const stop = e.target.closest('[data-stop]');
        if (!stop) return;
        const p = state.plans.find((x) => x.id === stop.dataset.stop);
        if (!confirm(`${p.name} stoppen?\n\nDe geplande trainingen verdwijnen uit je kalender. Wat je al gelogd hebt, blijft bewaard.`)) return;
        await deletePlan(p.id);
        toast('Schema gestopt');
        rerender();
      });
    },
  };
}

