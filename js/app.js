import { SPORTS } from './data.js';
import { seedOnce, askPersistent } from './db.js';
import { state, loadState, sessionsOn, currentWeek, nextSession, raceInfo, logForSession } from './plan.js';
import { viewLog } from './log.js';
import { viewCalendar } from './calendar.js';
import { viewProgress } from './progress.js';
import { viewSettings, backupDue } from './settings.js';
import { viewSchemas } from './schemas.js';
import { weekSummaryHtml, missedHtml, bindToday } from './weekly.js';
import { predictionLine } from './records.js';
import * as D from './dates.js';
import { esc, icon, fmtKm, fmtNum, fmtDuration, fmtPace } from './ui.js';

const TABS = [
  { route: 'vandaag', label: 'Vandaag', icon: 'home' },
  { route: 'kalender', label: 'Kalender', icon: 'cal' },
  { route: 'loggen', label: 'Loggen', icon: 'plus' },
  { route: 'progressie', label: 'Progressie', icon: 'chart' },
  { route: 'schemas', label: "Schema's", icon: 'list' },
];

function tabbar(active) {
  return `<nav class="tabbar" aria-label="Hoofdmenu">${TABS.map((t) => `
    <a class="tab${t.route === active ? ' on' : ''}" href="#/${t.route}"${t.route === active ? ' aria-current="page"' : ''}>${icon(t.icon)}<span>${t.label}</span></a>`).join('')}
  </nav>`;
}

const logRoute = (s) => `#/loggen/${s.sport === 'strength' ? 'kracht' : s.sport === 'swim' ? 'zwemmen' : 'hardlopen'}/${s.id}`;

function logSummary(log) {
  if (!log) return '';
  if (log.sport === 'strength') return `${log.setCount || ''} sets · ${fmtNum(log.volume, 0)} kg volume`;
  if (log.sport === 'run') return `${fmtKm(log.km)} km${log.durationSec ? ` in ${fmtDuration(log.durationSec)} · ${fmtPace(log.paceSec)} min/km` : ''}`;
  return '';
}

function sessionCard(s, { big = false } = {}) {
  const sport = SPORTS[s.sport];
  const log = logForSession(s.id);
  const moved = s.date !== s.origDate ? `<div class="moved">Verplaatst van ${D.shortLabel(s.origDate)}</div>` : '';
  const flags = [s.rest ? 'Rustweek' : '', s.deload ? 'Deload' : ''].filter(Boolean).map((f) => `<span class="flag">${f}</span>`).join('');
  if (!big) {
    return `<a class="card row link" href="${logRoute(s)}">
      <div class="stripe" style="background:${sport.color}"></div>
      <div class="grow">
        <div class="eyebrow">${esc(D.shortLabel(s.date)).toUpperCase()}${log ? ' · GELOGD' : ''}</div>
        <div class="row-title">${esc(s.kind === 'Kracht' ? s.title : `${s.kind} · ${s.title}`)}</div>
        <div class="muted small">${esc(log ? logSummary(log) : s.detail)}</div>
      </div>
      ${icon('arrow', 20)}
    </a>`;
  }
  return `<article class="card session${log ? ' is-done' : ''}">
    <div class="topbar" style="background:${sport.color}"></div>
    <div class="session-body">
      <div class="eyebrow" style="color:${sport.color}">${esc(sport.label.toUpperCase())} · ${esc(s.kind.toUpperCase())} ${flags}</div>
      <h2 class="display">${esc(s.title)}</h2>
      <p class="session-detail">${esc(s.detail)}</p>
      ${s.sport === 'run' && !s.race && !log ? '<p class="muted small">+ 10 min inlopen, 5–10 min uitlopen</p>' : ''}
      ${moved}
      ${log ? `<div class="done-line">${icon('check', 20)}<span><strong>Gelogd.</strong> ${esc(logSummary(log))}</span></div>
        <a class="btn-link" href="${logRoute(s)}">Log aanpassen</a>`
      : `<a class="btn" style="background:${sport.color}" href="${logRoute(s)}">Training loggen</a>
        <a class="btn-link" href="#/kalender/${s.date}/verplaats/${s.id}">Komt het niet uit? Verplaatsen</a>`}
    </div>
  </article>`;
}

// ---------- Schermen ----------
function viewStart() {
  const race = raceInfo(D.today());
  return `<section class="start">
    <div class="start-bg" aria-hidden="true"></div>
    <div class="start-top">${icon('logo', 28)}<span>TEMPO</span></div>
    <div class="start-bottom">
      <div class="start-kicker">KRACHT · HARDLOPEN · PROGRESSIE</div>
      <h1 class="start-title">TEMPO</h1>
      <p class="start-lead">Elke training gelogd.<br>Elke week een stap sneller en sterker.</p>
      ${race ? `<div class="start-goal"><span class="dot"></span>Volgende doel: ${esc(race.plan.raceName)} · nog ${race.daysLeft} dagen</div>` : ''}
      <a class="btn btn-white" href="#/vandaag">Start ${icon('arrow', 20)}</a>
    </div>
  </section>`;
}

function viewVandaag() {
  const today = D.today();
  const race = raceInfo(today);
  const todays = sessionsOn(today);
  const monday = D.mondayOf(today);
  const week = Array.from({ length: 7 }, (_, i) => D.addDays(monday, i));
  const sunday = week[6];
  const weekSessions = week.flatMap((d) => sessionsOn(d));
  const weekLogs = state.logs.filter((l) => l.date >= monday && l.date <= sunday);
  const runPlanned = weekSessions.filter((s) => s.sport === 'run').reduce((a, s) => a + (s.km || 0), 0);
  const runDone = weekLogs.filter((l) => l.sport === 'run').reduce((a, l) => a + (l.km || 0), 0);
  const strPlanned = weekSessions.filter((s) => s.sport === 'strength').length;
  const strDone = weekLogs.filter((l) => l.sport === 'strength').length;
  const swimDone = weekLogs.filter((l) => l.sport === 'swim').reduce((a, l) => a + (l.meters || 0), 0);
  const next = nextSession(today);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const extraLogs = state.logs.filter((l) => l.date === today && (!l.sessionId || !todays.some((s) => s.id === l.sessionId)));
  const pred = race ? predictionLine(race.plan, today) : null;

  const html = `<main class="page">
    <header class="page-head">
      <div>
        <div class="muted strong">${esc(D.longLabel(today))}</div>
        <h1 class="display xl">Vandaag</h1>
      </div>
      <a class="avatar" href="#/instellingen" aria-label="Instellingen en back-up">OB</a>
    </header>

    ${backupDue() ? `<a class="card hint link" href="#/instellingen">${icon('share', 22)}<div><strong>Tijd voor een back-up.</strong> Je gegevens staan alleen op deze telefoon. Tik hier om een back-up te bewaren.</div></a>` : ''}

    ${standalone ? '' : `<div class="card hint">${icon('share', 22)}<div><strong>Zet Tempo op je beginscherm.</strong> Tik in Safari op Deel en kies "Zet op beginscherm". Dan opent Tempo als app, ook zonder internet.</div></div>`}

    ${race ? `<a class="card goal" href="#/schemas">
      <div class="goal-top"><span>DOEL · ${esc(race.plan.raceName.toUpperCase())}</span><span>nog ${race.daysLeft} dagen</span></div>
      <div class="display lg">${esc(race.plan.goalTitle)}</div>
      <div class="goal-sub">${esc(race.plan.goalSub)}</div>
      <div class="bar"><div style="width:${race.pct}%"></div></div>
      <div class="goal-sub small">Week ${race.week} van ${race.plan.weeks} · ${esc(race.plan.phase(race.week))}</div>
      ${pred ? `<div class="goal-pred"><span>Voorspelling nu</span><strong>${esc(pred.text)}</strong></div>${pred.gapText ? `<div class="goal-sub small">${esc(pred.gapText)}</div>` : ''}` : ''}
    </a>` : ''}

    ${weekSummaryHtml(today)}

    ${missedHtml(today)}

    ${todays.length ? todays.map((s) => sessionCard(s, { big: true })).join('') : `<div class="card rest"><div class="eyebrow">RUSTDAG</div><div class="row-title">Vandaag staat er niets gepland.</div><div class="muted small">Herstel hoort bij het schema. Toch iets gedaan? <a href="#/loggen">Log het hier.</a></div></div>`}

    ${extraLogs.map((l) => `<div class="card row"><div class="stripe" style="background:${SPORTS[l.sport].color}"></div><div class="grow"><div class="eyebrow">OOK GELOGD VANDAAG</div><div class="row-title">${esc(l.sport === 'swim' ? `Zwemmen · ${fmtNum(l.meters, 0)} m` : l.sport === 'run' ? `${l.kind} · ${fmtKm(l.km)} km` : `Training ${l.workout}`)}</div></div>${icon('check', 20)}</div>`).join('')}

    <section>
      <div class="section-head"><h2>Deze week</h2><a href="#/kalender">Kalender</a></div>
      <div class="week">
        ${week.map((d, i) => {
          const ss = sessionsOn(d);
          const isToday = d === today;
          const allDone = ss.length && ss.every((s) => logForSession(s.id));
          const label = ss.length ? ss.map((s) => (s.sport === 'strength' ? `Kracht ${s.workout}` : s.sport === 'swim' ? `Zwem ${fmtNum(s.meters, 0)} m` : s.kind === 'Interval' ? 'Interval' : s.race ? 'Race' : `${fmtKm(s.km)} km`)).join(' + ') : 'Rust';
          return `<div class="day${isToday ? ' today' : ''}${allDone ? ' done' : ''}" aria-label="${D.WD_LONG[i]} ${D.parse(d).getDate()}: ${esc(label)}${allDone ? ', gelogd' : ''}">
            <span class="wd">${D.WD_SHORT[i]}</span>
            <span class="dn">${D.parse(d).getDate()}</span>
            <span class="dots">${ss.length ? ss.map((s) => (logForSession(s.id) ? `<b style="color:${SPORTS[s.sport].color}">${icon('check', 12)}</b>` : `<i style="background:${SPORTS[s.sport].color}"></i>`)).join('') : '<i class="empty"></i>'}</span>
            <span class="dl">${esc(label)}</span>
          </div>`;
        }).join('')}
      </div>
    </section>

    <div class="grid2">
      <div class="card stat"><div class="eyebrow" style="color:var(--run)">HARDLOPEN</div><div class="display lg">${fmtKm(runDone)} <span class="unit">/ ${fmtKm(runPlanned)} km</span></div><div class="muted small">gelopen deze week</div></div>
      <div class="card stat"><div class="eyebrow" style="color:var(--str)">KRACHT</div><div class="display lg">${strDone} <span class="unit">/ ${strPlanned} sessies</span></div><div class="muted small">gedaan deze week</div></div>
    </div>
    ${swimDone ? `<div class="card stat"><div class="eyebrow" style="color:var(--swim)">ZWEMMEN</div><div class="display lg">${fmtNum(swimDone, 0)} <span class="unit">m deze week</span></div></div>` : ''}

    ${next ? `<section><div class="section-head"><h2>Volgende training</h2></div>${sessionCard(next)}</section>` : ''}
  </main>`;
  return { html, mount: (root, rerender) => bindToday(root, rerender) };
}

function viewSoon(title, step, text) {
  return `<main class="page">
    <header class="page-head"><h1 class="display xl">${esc(title)}</h1></header>
    <div class="card soon"><div class="eyebrow">KOMT IN STAP ${step}</div><div class="row-title">${esc(text)}</div><div class="muted small">Dit scherm bouwen we in de volgende stappen. De mockup laat zien hoe het wordt.</div></div>
  </main>`;
}

// ---------- Router ----------
const ROUTES = {
  vandaag: viewVandaag,
  schemas: (parts) => viewSchemas(parts),
  loggen: (parts) => viewLog(parts),
  kalender: (parts) => viewCalendar(parts),
  progressie: () => viewProgress(),
  instellingen: () => viewSettings(),
};

function render() {
  const [route, ...parts] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const app = document.getElementById('app');
  if (!route || !ROUTES[route]) {
    app.innerHTML = viewStart();
    document.title = 'Tempo';
    return;
  }
  const out = ROUTES[route](parts);
  const view = typeof out === 'string' ? { html: out } : out;
  app.innerHTML = view.html + tabbar(route);
  document.title = `${TABS.find((t) => t.route === route)?.label || 'Tempo'} · Tempo`;
  window.scrollTo(0, 0);
  if (view.mount) view.mount(app.querySelector('main'), render);
}

async function init() {
  try {
    await seedOnce();
    await loadState();
    askPersistent();
  } catch (e) {
    console.warn('Opslag niet beschikbaar', e);
  }
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator) {
    // Nieuwe versie actief? Dan één keer herladen zodat je meteen de nieuwste app ziet.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      })
      .catch(() => {});
  }
}

init();
