// Stap 4: progressie per week, maand en jaar.
import { EXERCISES } from './data.js';
import { state, allSessions, logForSession } from './plan.js';
import * as D from './dates.js';
import { esc, fmtNum, fmtKm, fmtPace, fmtDuration } from './ui.js';

const ui = { period: 'week', metric: 'weight' };
const PERIODS = [{ key: 'week', label: 'Week' }, { key: 'maand', label: 'Maand' }, { key: 'jaar', label: 'Jaar' }];

// ---------- Indeling in periodes ----------
function bucketKey(date, period) {
  if (period === 'week') return D.mondayOf(date);
  if (period === 'maand') return date.slice(0, 7);
  return date.slice(0, 4);
}

function bucketList(period, today) {
  if (period === 'week') {
    const mon = D.mondayOf(today);
    return Array.from({ length: 8 }, (_, i) => D.addDays(mon, (i - 5) * 7));
  }
  if (period === 'maand') {
    const t = D.parse(today);
    return Array.from({ length: 8 }, (_, i) => D.iso(new Date(t.getFullYear(), t.getMonth() + i - 5, 1)).slice(0, 7));
  }
  const y = Number(today.slice(0, 4));
  const years = new Set([y, y + 1]);
  for (const l of state.logs) years.add(Number(l.date.slice(0, 4)));
  return [...years].sort().map(String);
}

function bucketLabel(key, period) {
  if (period === 'week') return D.dayMonth(key);
  if (period === 'maand') return D.MONTHS_SHORT[Number(key.slice(5, 7)) - 1];
  return key;
}

function bucketLong(key, period) {
  if (period === 'week') return `Week van ${D.shortLabel(key)}`;
  if (period === 'maand') return `${D.MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  return key;
}

// ---------- Grafieken (SVG) ----------
// Staafgrafiek: gepland (omlijnd) en gedaan (gevuld), één kleur
function barChart({ id, buckets, color, unit, digits = 1, showPlanned = true }) {
  const W = 340; const H = 170; const top = 22; const bottom = 26; const left = 4; const right = 4;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.done || 0, showPlanned ? b.planned || 0 : 0)));
  const nice = niceMax(max);
  const slot = (W - left - right) / buckets.length;
  const bw = Math.min(26, slot * 0.56);
  const y = (v) => top + (H - top - bottom) * (1 - v / nice);
  const base = y(0);
  const grid = [0.5, 1].map((f) => `<line x1="${left}" x2="${W - right}" y1="${y(nice * f)}" y2="${y(nice * f)}" class="gridline"/><text x="${W - right}" y="${y(nice * f) - 4}" class="axis" text-anchor="end">${fmtNum(nice * f, (nice * f) % 1 ? 1 : 0)}</text>`).join('');
  const bars = buckets.map((b, i) => {
    const cx = left + slot * i + slot / 2;
    const x = cx - bw / 2;
    const tip = `${b.long}: ${fmtNum(b.done || 0, digits)}${showPlanned && b.planned ? ` van ${fmtNum(b.planned, digits)}` : ''} ${unit}${b.extra ? ` · ${b.extra}` : ''}`;
    const planned = showPlanned && b.planned ? `<path d="${roundTop(x + 0.75, y(b.planned), bw - 1.5, base - y(b.planned), 4)}" style="fill:none;stroke:${color}" stroke-width="1.5" stroke-dasharray="3 2.5" opacity=".85"/>` : '';
    const done = b.done ? `<path d="${roundTop(x, y(b.done), bw, base - y(b.done), 4)}" style="fill:${color}"/>` : '';
    return `<g class="hit${b.current ? ' cur' : ''}" tabindex="0" role="button" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
      <rect x="${left + slot * i}" y="${top}" width="${slot}" height="${H - top}" fill="transparent"/>
      ${planned}${done}
      <text x="${cx}" y="${H - 8}" text-anchor="middle" class="axis${b.current ? ' strong' : ''}">${esc(b.label)}</text>
    </g>`;
  }).join('');
  const cur = buckets.find((b) => b.current) || buckets[buckets.length - 1];
  const curTip = `${cur.long}: ${fmtNum(cur.done || 0, digits)}${showPlanned && cur.planned ? ` van ${fmtNum(cur.planned, digits)}` : ''} ${unit}${cur.extra ? ` · ${cur.extra}` : ''}`;
  return `<div class="chart" data-chart="${id}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Staafgrafiek ${esc(unit)} per periode">
      ${grid}<line x1="${left}" x2="${W - right}" y1="${base}" y2="${base}" class="baseline"/>${bars}
    </svg>
    <div class="tip" aria-live="polite">${esc(curTip)}</div>
    <details class="table-view"><summary>Toon als tabel</summary>
      <table><thead><tr><th>Periode</th>${showPlanned ? '<th>Gepland</th>' : ''}<th>Gedaan</th></tr></thead><tbody>
      ${buckets.map((b) => `<tr><td>${esc(b.long)}</td>${showPlanned ? `<td>${b.planned ? fmtNum(b.planned, digits) : '–'}</td>` : ''}<td>${b.done ? fmtNum(b.done, digits) : '–'}</td></tr>`).join('')}
      </tbody></table></details>
  </div>`;
}

function roundTop(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// Lijngrafiek over tijd (metingen); series: [{name, color, dash, points:[{date, v}]}]
function lineChart({ id, series, unit, digits = 1 }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) {
    return `<div class="chart-empty">De lijngrafiek verschijnt na je tweede meting.</div>`;
  }
  const W = 340; const H = 180; const top = 16; const bottom = 26; const left = 34; const right = 10;
  const dates = all.map((p) => D.parse(p.date).getTime());
  const t0 = Math.min(...dates); const t1 = Math.max(...dates) || t0 + 1;
  let lo = Math.min(...all.map((p) => p.v)); let hi = Math.max(...all.map((p) => p.v));
  const pad = Math.max((hi - lo) * 0.15, hi * 0.01, 0.5);
  lo -= pad; hi += pad;
  const x = (d) => left + (W - left - right) * ((D.parse(d).getTime() - t0) / Math.max(1, t1 - t0));
  const y = (v) => top + (H - top - bottom) * (1 - (v - lo) / (hi - lo));
  const ticks = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8].map((v) => `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" class="gridline"/><text x="${left - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${fmtNum(v, digits && hi - lo < 10 ? 1 : 0)}</text>`).join('');
  const first = all.reduce((a, b) => (a.date < b.date ? a : b)).date;
  const last = all.reduce((a, b) => (a.date > b.date ? a : b)).date;
  const lines = series.map((s) => {
    const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1));
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const dots = pts.map((p) => {
      const tip = `${D.shortLabel(p.date)}: ${s.name ? `${s.name} ` : ''}${fmtNum(p.v, digits)} ${unit}`;
      return `<g class="hit" tabindex="0" role="button" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><circle cx="${x(p.date)}" cy="${y(p.v)}" r="14" fill="transparent"/><circle cx="${x(p.date)}" cy="${y(p.v)}" r="4.5" style="fill:${s.color}" stroke="#fff" stroke-width="2"/></g>`;
    }).join('');
    return `<path d="${d}" style="fill:none;stroke:${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="5 4"' : ''}/>${dots}`;
  }).join('');
  const latest = series.map((s) => { const p = [...s.points].sort((a, b) => (a.date < b.date ? 1 : -1))[0]; return p ? `${s.name ? `${s.name} ` : ''}${fmtNum(p.v, digits)}` : ''; }).filter(Boolean).join(' · ');
  return `<div class="chart" data-chart="${id}">
    ${series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}${s.dash ? ';opacity:.6' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lijngrafiek ${esc(unit)} over tijd">
      ${ticks}<line x1="${left}" x2="${W - right}" y1="${H - bottom}" y2="${H - bottom}" class="baseline"/>
      <text x="${left}" y="${H - 8}" class="axis">${esc(D.dayMonth(first))}</text><text x="${W - right}" y="${H - 8}" text-anchor="end" class="axis">${esc(D.dayMonth(last))}</text>
      ${lines}
    </svg>
    <div class="tip" aria-live="polite">Laatste meting: ${esc(latest)} ${esc(unit)}</div>
    <details class="table-view"><summary>Toon als tabel</summary>
      <table><thead><tr><th>Datum</th>${series.map((s) => `<th>${esc(s.name || unit)}</th>`).join('')}</tr></thead><tbody>
      ${[...new Set(all.map((p) => p.date))].sort().reverse().map((d) => `<tr><td>${esc(D.shortLabel(d))}</td>${series.map((s) => { const p = s.points.find((q) => q.date === d); return `<td>${p ? fmtNum(p.v, digits) : '–'}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></details>
  </div>`;
}

// ---------- Onderdelen ----------
function vo2Block(runs, period, today) {
  const all = runs.filter((l) => l.vo2).sort((a, b) => (a.date < b.date ? 1 : -1));
  const head = '<h3 class="h3">VO2 Max</h3>';
  if (!all.length) return `${head}<p class="muted small">Nog geen VO2 Max ingevuld. Vul na een loop het getal van je Garmin in bij Loggen → Hardlopen.</p>`;
  const [last, prev] = all;
  const diff = prev ? last.vo2 - prev.vo2 : null;
  const first = all[all.length - 1];
  const from = period === 'week' ? D.addDays(today, -7 * 12) : period === 'maand' ? D.addDays(today, -365) : '0000';
  const byDate = {};
  for (const l of all.filter((x) => x.date >= from)) if (!byDate[l.date]) byDate[l.date] = l.vo2;
  const points = Object.entries(byDate).map(([date, v]) => ({ date, v }));
  return `${head}
    <div class="tiles">
      <div class="tile"><div class="eyebrow">NU</div><div class="display md">${fmtNum(last.vo2, 0)}</div><div class="small ${diff > 0 ? 'delta-good' : diff < 0 ? 'delta-bad' : 'muted'}">${diff != null && diff !== 0 ? `${diff > 0 ? '+' : ''}${fmtNum(diff, 0)} t.o.v. vorige` : esc(D.shortLabel(last.date))}</div></div>
      <div class="tile"><div class="eyebrow">SINDS START</div><div class="display md">${first === last ? '–' : `${last.vo2 - first.vo2 > 0 ? '+' : ''}${fmtNum(last.vo2 - first.vo2, 0)}`}</div><div class="small muted">${first === last ? 'na je tweede meting' : `vanaf ${esc(D.shortLabel(first.date))}`}</div></div>
    </div>
    ${lineChart({ id: 'vo2', series: [{ name: '', color: 'var(--run)', points }], unit: 'ml/kg/min', digits: 0 })}`;
}

function runSection(period, today) {
  const keys = bucketList(period, today);
  const curKey = bucketKey(today, period);
  const sessions = allSessions().filter((s) => s.sport === 'run');
  const runs = state.logs.filter((l) => l.sport === 'run');
  const buckets = keys.map((k) => {
    const rs = runs.filter((l) => bucketKey(l.date, period) === k);
    const km = rs.reduce((a, l) => a + (l.km || 0), 0);
    const timed = rs.filter((l) => l.durationSec && l.km);
    const pace = timed.length ? timed.reduce((a, l) => a + l.durationSec, 0) / timed.reduce((a, l) => a + l.km, 0) : null;
    return {
      key: k, label: bucketLabel(k, period), long: bucketLong(k, period), current: k === curKey,
      planned: sessions.filter((s) => bucketKey(s.date, period) === k).reduce((a, s) => a + (s.km || 0), 0),
      done: km, extra: rs.length ? `${rs.length}× gelopen${pace ? `, gem. ${fmtPace(pace)} min/km` : ''}` : '',
    };
  });
  const cur = buckets.find((b) => b.current);
  const totalKm = runs.reduce((a, l) => a + (l.km || 0), 0);
  const best = runs.filter((l) => l.paceSec && l.km >= 5).sort((a, b) => a.paceSec - b.paceSec)[0];

  const ms = [
    { title: '10 km Singelloop', target: '1:01:08', sub: '4 okt · 6:07 min/km', done: true },
    { id: 'dom-12-long', title: '5 km-test', target: '≤ 27:30', sub: 'Langzamer dan 28:30: intervallen fase 3 rustiger' },
    { id: 'dom-18-long', title: '10 km-test', target: '≤ 54:30', sub: 'Bepaalt je wedstrijdtempo (5:30, 5:40 of 5:50)' },
    { id: 'dom-race', title: 'Dom tot Domloop', target: '1:28:31', sub: '16,1 km op 5:30 min/km' },
  ].map((m) => {
    const s = m.id ? sessions.find((x) => x.id === m.id) : null;
    const log = m.id ? logForSession(m.id) : null;
    const result = log && log.durationSec ? `${fmtDuration(log.durationSec)} · ${fmtPace(log.paceSec)}/km` : null;
    return `<li class="ms${m.done || log ? ' done' : ''}"><span class="ms-dot"></span><div class="grow">
      <div class="ms-top"><strong>${esc(m.title)}</strong><strong>${esc(result || m.target)}</strong></div>
      <div class="muted small">${esc(s ? `${D.shortLabel(s.date)} · ` : '')}${esc(log ? (result ? 'Gelopen' : 'Gelogd') : m.done ? 'Gelopen' : `Doel. ${m.sub}`)}</div>
    </div></li>`;
  }).join('');

  return `<section class="card prog">
    <div class="eyebrow" style="color:var(--run)">HARDLOPEN</div>
    <h2 class="h2">Kilometers per ${period === 'week' ? 'week' : period === 'maand' ? 'maand' : 'jaar'}</h2>
    <div class="legend"><span><i class="solid" style="background:var(--run)"></i>Gelopen</span><span><i class="outline" style="border-color:var(--run)"></i>Gepland volgens schema</span></div>
    ${barChart({ id: 'run', buckets, color: 'var(--run)', unit: 'km' })}
    <div class="grid3 kpis">
      <div><div class="eyebrow">${period === 'week' ? 'DEZE WEEK' : period === 'maand' ? 'DEZE MAAND' : 'DIT JAAR'}</div><div class="display md">${fmtKm(cur ? cur.done : 0)} km</div></div>
      <div><div class="eyebrow">TOTAAL GELOGD</div><div class="display md">${fmtKm(totalKm)} km</div></div>
      <div><div class="eyebrow">SNELSTE ≥ 5 KM</div><div class="display md">${best ? `${fmtPace(best.paceSec)}` : '–'}</div></div>
    </div>
    ${vo2Block(runs, period, today)}
    <h3 class="h3">Op koers voor 5:30 min/km?</h3>
    <ul class="milestones">${ms}</ul>
  </section>`;
}

function bestSets() {
  const best = {};
  for (const l of state.logs.filter((x) => x.sport === 'strength')) {
    for (const [exId, val] of Object.entries(l.sets || {})) {
      const lists = Array.isArray(val) ? [val] : [val.L || [], val.R || []];
      for (const list of lists) {
        for (const [kg, reps] of list) {
          const b = best[exId];
          if (!b || (kg || 0) > (b.kg || 0) || ((kg || 0) === (b.kg || 0) && reps > b.reps)) best[exId] = { kg, reps, date: l.date };
        }
      }
    }
  }
  return best;
}

function strengthSection(period, today) {
  const keys = bucketList(period, today);
  const curKey = bucketKey(today, period);
  const logs = state.logs.filter((l) => l.sport === 'strength');
  const planned = allSessions().filter((s) => s.sport === 'strength');
  const buckets = keys.map((k) => {
    const ls = logs.filter((l) => bucketKey(l.date, period) === k);
    const n = planned.filter((s) => bucketKey(s.date, period) === k).length;
    return { key: k, label: bucketLabel(k, period), long: bucketLong(k, period), current: k === curKey, done: ls.reduce((a, l) => a + (l.volume || 0), 0), extra: `${ls.length} van ${n} trainingen` };
  });
  const recent = ['A', 'B'].map((w) => {
    const ls = logs.filter((l) => l.workout === w);
    if (!ls.length) return `<li><span>Training ${w}</span><span class="muted">nog niet gelogd</span></li>`;
    const [last, prev] = ls;
    const diff = prev && prev.volume ? Math.round(((last.volume - prev.volume) / prev.volume) * 100) : null;
    return `<li><span>Training ${w} <span class="muted small">${esc(D.shortLabel(last.date))}</span></span><span><strong>${fmtNum(last.volume, 0)} kg</strong>${diff != null ? ` <span class="delta ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${diff}%</span>` : ''}</span></li>`;
  }).join('');
  const best = bestSets();
  const rows = [...EXERCISES.A, ...EXERCISES.B].filter((e) => best[e.id]).map((e) => {
    const b = best[e.id];
    return `<li><span>${esc(e.name)}</span><span><strong>${b.kg ? `${fmtNum(b.kg)} kg × ` : ''}${b.reps}</strong> <span class="muted small">${esc(D.dayMonth(b.date))}</span></span></li>`;
  }).join('');
  return `<section class="card prog">
    <div class="eyebrow" style="color:var(--str)">KRACHT</div>
    <h2 class="h2">Volume per ${period === 'week' ? 'week' : period === 'maand' ? 'maand' : 'jaar'} (kg × reps)</h2>
    ${barChart({ id: 'str', buckets, color: 'var(--str)', unit: 'kg', digits: 0, showPlanned: false })}
    <h3 class="h3">Laatste training t.o.v. de vorige</h3>
    <ul class="kv">${recent}</ul>
    <h3 class="h3">Beste sets</h3>
    ${rows ? `<ul class="kv">${rows}</ul>` : '<p class="muted small">Nog geen sets gelogd.</p>'}
  </section>`;
}

function swimSection(period, today) {
  const logs = state.logs.filter((l) => l.sport === 'swim');
  if (!logs.length) return `<section class="card prog"><div class="eyebrow" style="color:var(--swim)">ZWEMMEN</div><p class="muted small">Nog geen zwemtrainingen gelogd. Na je eerste training zie je hier je meters per ${period}.</p></section>`;
  const keys = bucketList(period, today);
  const curKey = bucketKey(today, period);
  const buckets = keys.map((k) => {
    const ls = logs.filter((l) => bucketKey(l.date, period) === k);
    return { key: k, label: bucketLabel(k, period), long: bucketLong(k, period), current: k === curKey, done: ls.reduce((a, l) => a + (l.meters || 0), 0), extra: ls.length ? `${ls.length}× gezwommen` : '' };
  });
  return `<section class="card prog">
    <div class="eyebrow" style="color:var(--swim)">ZWEMMEN</div>
    <h2 class="h2">Meters per ${period === 'week' ? 'week' : period === 'maand' ? 'maand' : 'jaar'}</h2>
    ${barChart({ id: 'swim', buckets, color: 'var(--swim-mark)', unit: 'm', digits: 0, showPlanned: false })}
  </section>`;
}

const METRICS = [
  { key: 'weight', label: 'Gewicht', unit: 'kg' },
  { key: 'waist', label: 'Buikomvang', unit: 'cm' },
  { key: 'bp', label: 'Bloeddruk', unit: 'mmHg', digits: 0 },
  { key: 'fat', label: 'Vet%', unit: '%' },
  { key: 'bmi', label: 'BMI', unit: '' },
  { key: 'hr', label: 'Rusthartslag', unit: 'bpm', digits: 0 },
];

function bodySection(period, today) {
  const height = state.settings.height;
  const ms = state.measurements.map((m) => ({ ...m, bmi: m.weight && height ? m.weight / (height / 100) ** 2 : null }));
  const from = period === 'week' ? D.addDays(today, -7 * 12) : period === 'maand' ? D.addDays(today, -365) : '0000';
  const inRange = ms.filter((m) => m.date >= from);
  const latestOf = (k) => ms.filter((m) => m[k] != null);
  const tile = (label, k, unit, digits = 1, lowerIsBetter = true) => {
    const list = latestOf(k);
    const [a, b] = list;
    const diff = a && b ? a[k] - b[k] : null;
    const cls = diff == null || diff === 0 ? '' : (diff < 0) === lowerIsBetter ? 'good' : 'bad';
    return `<div class="tile"><div class="eyebrow">${label}</div><div class="display md">${a ? `${fmtNum(a[k], digits)}${unit ? ` <span class="unit">${unit}</span>` : ''}` : '–'}</div>
      <div class="small ${cls ? `delta-${cls}` : 'muted'}">${diff != null ? `${diff > 0 ? '+' : ''}${fmtNum(diff, digits)} t.o.v. vorige` : a ? esc(D.shortLabel(a.date)) : 'nog geen meting'}</div></div>`;
  };
  const bpList = ms.filter((m) => m.sys && m.dia).slice(0, 4);
  const bpAvg = bpList.length ? `${Math.round(bpList.reduce((s, m) => s + m.sys, 0) / bpList.length)}/${Math.round(bpList.reduce((s, m) => s + m.dia, 0) / bpList.length)}` : '–';
  const metric = METRICS.find((m) => m.key === ui.metric) || METRICS[0];
  const series = metric.key === 'bp'
    ? [
      { name: 'Boven', color: 'var(--body)', points: inRange.filter((m) => m.sys).map((m) => ({ date: m.date, v: m.sys })) },
      { name: 'Onder', color: 'var(--body)', dash: true, points: inRange.filter((m) => m.dia).map((m) => ({ date: m.date, v: m.dia })) },
    ]
    : [{ name: '', color: 'var(--body)', points: inRange.filter((m) => m[metric.key] != null).map((m) => ({ date: m.date, v: m[metric.key] })) }];
  return `<section class="card prog">
    <div class="eyebrow" style="color:var(--body)">LICHAAM</div>
    <h2 class="h2">Metingen</h2>
    <div class="tiles">
      ${tile('GEWICHT', 'weight', 'kg')}
      ${tile('BUIKOMVANG', 'waist', 'cm')}
      <div class="tile"><div class="eyebrow">BLOEDDRUK</div><div class="display md">${bpAvg} <span class="unit">mmHg</span></div><div class="small muted">${bpList.length ? `gem. laatste ${bpList.length} meting${bpList.length > 1 ? 'en' : ''}` : 'nog geen meting'}</div></div>
      ${tile('RUSTHARTSLAG', 'hr', 'bpm', 0)}
      ${tile('VETPERCENTAGE', 'fat', '%')}
      ${tile('BMI', 'bmi', '')}
    </div>
    ${!height ? '<p class="muted small">Vul bij Loggen → Meting één keer je lengte in, dan berekent de app je BMI.</p>' : ''}
    <div class="chips" role="group" aria-label="Kies meetwaarde">${METRICS.map((m) => `<button type="button" class="chip pill" data-metric="${m.key}" aria-pressed="${m.key === metric.key}">${m.label}</button>`).join('')}</div>
    ${lineChart({ id: 'body', series, unit: metric.unit, digits: metric.digits ?? 1 })}
    <a class="btn-outline wide" href="#/loggen/meting">+ Meting toevoegen</a>
  </section>`;
}

export function viewProgress() {
  const today = D.today();
  const p = ui.period;
  const html = `<main class="page">
    <header class="page-head"><h1 class="display xl">Progressie</h1></header>
    <nav class="seg seg3" aria-label="Periode">${PERIODS.map((x) => `<button type="button" data-period="${x.key}" class="${x.key === p ? 'on' : ''}" aria-pressed="${x.key === p}">${x.label}</button>`).join('')}</nav>
    ${runSection(p, today)}
    ${strengthSection(p, today)}
    ${swimSection(p, today)}
    ${bodySection(p, today)}
  </main>`;

  function mount(root, rerender) {
    root.addEventListener('click', (e) => {
      const per = e.target.closest('[data-period]');
      if (per) { ui.period = per.dataset.period; rerender(); return; }
      const met = e.target.closest('[data-metric]');
      if (met) { ui.metric = met.dataset.metric; rerender(); return; }
      const hit = e.target.closest('.hit');
      if (hit) showTip(hit);
    });
    root.addEventListener('focusin', (e) => { const hit = e.target.closest('.hit'); if (hit) showTip(hit); });
    root.addEventListener('mouseover', (e) => { const hit = e.target.closest('.hit'); if (hit) showTip(hit); });
    function showTip(hit) {
      const chart = hit.closest('.chart');
      chart.querySelectorAll('.hit.active').forEach((h) => h.classList.remove('active'));
      hit.classList.add('active');
      chart.querySelector('.tip').textContent = hit.dataset.tip;
    }
  }
  return { html, mount };
}
