import { buildPlans, SPORTS } from './data.js';
import { db, seedOnce, askPersistent } from './db.js';
import * as D from './dates.js';

const state = {
  plans: buildPlans(),
  moves: {}, // sessie-id → nieuwe datum
};

// ---------- Gegevens ----------
function allSessions() {
  return state.plans.flatMap((p) => p.sessions.map((s) => ({ ...s, date: state.moves[s.id] || s.date, origDate: s.date })));
}

function sessionsOn(date) {
  const order = { strength: 0, run: 1, swim: 2 };
  return allSessions().filter((s) => s.date === date).sort((a, b) => order[a.sport] - order[b.sport]);
}

function currentWeek(plan, date) {
  const past = plan.sessions.filter((s) => (state.moves[s.id] || s.date) <= date);
  if (!past.length) return plan.sessions[0].week;
  return past.reduce((a, b) => (b.date > a.date ? b : a)).week;
}

function weekNumberLabel(plan, week) {
  return `Week ${week} van ${plan.weeks}`;
}

function nextSession(after) {
  return allSessions().filter((s) => s.date > after).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

function raceInfo(date) {
  const plan = state.plans.filter((p) => p.raceDate && p.raceDate >= date).sort((a, b) => (a.raceDate < b.raceDate ? -1 : 1))[0];
  if (!plan) return null;
  const week = currentWeek(plan, date);
  return { plan, daysLeft: D.daysBetween(date, plan.raceDate), week, pct: Math.max(2, Math.round((week / plan.weeks) * 100)) };
}

// ---------- Hulpjes voor HTML ----------
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtKm = (n) => (Math.round(n * 10) / 10).toLocaleString('nl-NL');

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  logo: '<path d="M3 17l5-6 4 3 6-8"/><path d="M14 6h4v4"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/>',
};
const icon = (name, size = 24) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

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

function sessionCard(s, { big = false } = {}) {
  const sport = SPORTS[s.sport];
  const moved = s.date !== s.origDate ? `<div class="moved">Verplaatst van ${D.shortLabel(s.origDate)}</div>` : '';
  const flags = [s.rest ? 'Rustweek' : '', s.deload ? 'Deload' : ''].filter(Boolean).map((f) => `<span class="flag">${f}</span>`).join('');
  if (!big) {
    return `<div class="card row">
      <div class="stripe" style="background:${sport.color}"></div>
      <div class="grow">
        <div class="eyebrow">${esc(D.shortLabel(s.date)).toUpperCase()}</div>
        <div class="row-title">${esc(s.kind === 'Kracht' ? s.title : `${s.kind} · ${s.title}`)}</div>
        <div class="muted small">${esc(s.detail)}</div>
      </div>
    </div>`;
  }
  return `<article class="card session">
    <div class="topbar" style="background:${sport.color}"></div>
    <div class="session-body">
      <div class="eyebrow" style="color:${sport.color}">${esc(sport.label.toUpperCase())} · ${esc(s.kind.toUpperCase())} ${flags}</div>
      <h2 class="display">${esc(s.title)}</h2>
      <p class="session-detail">${esc(s.detail)}</p>
      ${s.sport === 'run' && !s.race ? '<p class="muted small">+ 10 min inlopen, 5–10 min uitlopen</p>' : ''}
      ${moved}
      <a class="btn" style="background:${sport.color}" href="#/loggen">Training loggen</a>
      <a class="btn-link" href="#/kalender">Komt het vandaag niet uit? Verplaatsen</a>
    </div>
  </article>`;
}

// ---------- Schermen ----------
function viewStart() {
  const today = D.today();
  const race = raceInfo(today);
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
  const weekSessions = week.flatMap((d) => sessionsOn(d));
  const runKm = weekSessions.filter((s) => s.sport === 'run').reduce((a, s) => a + (s.km || 0), 0);
  const strCount = weekSessions.filter((s) => s.sport === 'strength').length;
  const next = nextSession(today);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  return `<main class="page">
    <header class="page-head">
      <div>
        <div class="muted strong">${esc(D.longLabel(today))}</div>
        <h1 class="display xl">Vandaag</h1>
      </div>
      <div class="avatar" aria-hidden="true">OB</div>
    </header>

    ${standalone ? '' : `<div class="card hint">${icon('share', 22)}<div><strong>Zet Tempo op je beginscherm.</strong> Tik in Safari op Deel en kies "Zet op beginscherm". Dan opent Tempo als app, ook zonder internet.</div></div>`}

    ${race ? `<a class="card goal" href="#/schemas">
      <div class="goal-top"><span>DOEL · ${esc(race.plan.raceName.toUpperCase())}</span><span>nog ${race.daysLeft} dagen</span></div>
      <div class="display lg">${esc(race.plan.goalTitle)}</div>
      <div class="goal-sub">${esc(race.plan.goalSub)}</div>
      <div class="bar"><div style="width:${race.pct}%"></div></div>
      <div class="goal-sub small">${esc(weekNumberLabel(race.plan, race.week))} · ${esc(race.plan.phase(race.week))}</div>
    </a>` : ''}

    ${todays.length ? todays.map((s) => sessionCard(s, { big: true })).join('') : `<div class="card rest"><div class="eyebrow">RUSTDAG</div><div class="row-title">Vandaag staat er niets gepland.</div><div class="muted small">Herstel hoort bij het schema.</div></div>`}

    <section>
      <div class="section-head"><h2>Deze week</h2><a href="#/kalender">Kalender</a></div>
      <div class="week">
        ${week.map((d, i) => {
          const ss = sessionsOn(d);
          const isToday = d === today;
          const label = ss.length ? ss.map((s) => (s.sport === 'strength' ? `Kracht ${s.workout}` : s.kind === 'Interval' ? 'Interval' : `${fmtKm(s.km)} km`)).join(' + ') : 'Rust';
          return `<div class="day${isToday ? ' today' : ''}" aria-label="${D.WD_LONG[i]} ${D.parse(d).getDate()}: ${esc(label)}">
            <span class="wd">${D.WD_SHORT[i]}</span>
            <span class="dn">${D.parse(d).getDate()}</span>
            <span class="dots">${ss.length ? ss.map((s) => `<i style="background:${SPORTS[s.sport].color}"></i>`).join('') : '<i class="empty"></i>'}</span>
            <span class="dl">${esc(label)}</span>
          </div>`;
        }).join('')}
      </div>
    </section>

    <div class="grid2">
      <div class="card stat"><div class="eyebrow" style="color:var(--run)">HARDLOPEN</div><div class="display lg">${fmtKm(runKm)} <span class="unit">km</span></div><div class="muted small">gepland deze week</div></div>
      <div class="card stat"><div class="eyebrow" style="color:var(--str)">KRACHT</div><div class="display lg">${strCount} <span class="unit">sessies</span></div><div class="muted small">gepland deze week</div></div>
    </div>

    ${next ? `<section><div class="section-head"><h2>Volgende training</h2></div>${sessionCard(next)}</section>` : ''}
  </main>`;
}

function viewSchemas() {
  const today = D.today();
  return `<main class="page">
    <header class="page-head"><h1 class="display xl">Schema's</h1></header>
    <h2 class="h2">Actief</h2>
    ${state.plans.map((p) => {
      const sport = SPORTS[p.sport];
      const week = currentWeek(p, today);
      const pct = Math.max(2, Math.round((week / p.weeks) * 100));
      const upcoming = p.sessions.filter((s) => (state.moves[s.id] || s.date) >= today).length;
      return `<article class="card plan">
        <div class="topbar" style="background:${sport.color}"></div>
        <div class="session-body">
          <div class="eyebrow" style="color:${sport.color}">${esc(sport.label.toUpperCase())} · ${p.perWeek}× PER WEEK</div>
          <div class="row-title lg">${esc(p.name)}</div>
          <div class="muted small">${esc(p.goal)}</div>
          <div class="muted small">${esc(p.days)}</div>
          <div class="bar light"><div style="width:${pct}%;background:${sport.color}"></div></div>
          <div class="plan-foot"><span>${esc(weekNumberLabel(p, week))}</span><span class="muted">${esc(p.phase(week))}</span></div>
          <div class="muted small">Nog ${upcoming} trainingen tot ${esc(D.dayMonth(p.end))}</div>
        </div>
      </article>`;
    }).join('')}
    <div class="card soon"><div class="eyebrow">STAP 2 EN VERDER</div><div class="row-title">Nieuw schema maken</div><div class="muted small">Hardlopen, kracht en zwemmen op basis van je doel. Dit komt in een volgende stap.</div></div>
  </main>`;
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
  schemas: viewSchemas,
  kalender: () => viewSoon('Kalender', 3, 'Maandoverzicht en trainingen verplaatsen'),
  loggen: () => viewSoon('Loggen', 2, 'Kracht, hardlopen, zwemmen en metingen invoeren'),
  progressie: () => viewSoon('Progressie', 4, 'Grafieken per week, maand en jaar'),
};

function render() {
  const route = location.hash.replace(/^#\/?/, '');
  const app = document.getElementById('app');
  if (!route || !ROUTES[route]) {
    app.innerHTML = viewStart();
    document.title = 'Tempo';
    return;
  }
  app.innerHTML = ROUTES[route]() + tabbar(route);
  document.title = `${TABS.find((t) => t.route === route)?.label || 'Tempo'} · Tempo`;
  window.scrollTo(0, 0);
}

async function init() {
  try {
    await seedOnce();
    const moves = await db.all('moves');
    state.moves = Object.fromEntries(moves.map((m) => [m.id, m.date]));
    askPersistent();
  } catch (e) {
    console.warn('Opslag niet beschikbaar', e);
  }
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
