// Stap 2: trainingen en metingen loggen.
import { EXERCISES } from './data.js';
import { state, saveLog, deleteLog, saveMeasurement, deleteMeasurement, saveSetting, sessionsAround, defaultSession, sessionById, logForSession } from './plan.js';
import * as D from './dates.js';
import { esc, icon, num, parseTime, fmtPace, fmtDuration, fmtNum, fmtKm, toast } from './ui.js';

const SEGMENTS = [
  { key: 'kracht', label: 'Kracht' },
  { key: 'hardlopen', label: 'Hardlopen' },
  { key: 'zwemmen', label: 'Zwemmen' },
  { key: 'meting', label: 'Meting' },
];

function segments(active) {
  return `<nav class="seg seg4" aria-label="Soort invoer">${SEGMENTS.map((s) => `<a href="#/loggen/${s.key}" class="${s.key === active ? 'on' : ''}"${s.key === active ? ' aria-current="page"' : ''}>${s.label}</a>`).join('')}</nav>`;
}

function sessionOption(s, selectedId) {
  const done = logForSession(s.id) ? ' ✓ gelogd' : '';
  const label = `${D.shortLabel(s.date)} · ${s.kind === 'Kracht' ? s.title : `${s.kind}: ${s.title}`}${done}`;
  return `<option value="${esc(s.id)}"${s.id === selectedId ? ' selected' : ''}>${esc(label)}</option>`;
}

function chooser(sport, segKey, selectedId, freeOptions) {
  const list = sessionsAround(sport, D.today(), 7, 7).filter((s) => !s.race || sport === 'run');
  return `<label class="field">
    <span>TRAINING</span>
    <select data-nav="${segKey}">
      ${list.map((s) => sessionOption(s, selectedId)).join('')}
      ${freeOptions.map(([v, l]) => `<option value="${v}"${v === selectedId ? ' selected' : ''}>${esc(l)}</option>`).join('')}
    </select>
  </label>`;
}

function logDate(session) {
  const today = D.today();
  return session && session.date <= today ? session.date : today;
}

function recentList(items, emptyText) {
  if (!items.length) return `<p class="muted small">${esc(emptyText)}</p>`;
  return `<ul class="recent">${items.map((it) => `<li>
    <div class="grow"><div class="strong">${esc(it.title)}</div><div class="muted small">${esc(it.sub)}</div></div>
    <button class="icon-btn" data-delete="${esc(it.id)}" data-kind="${it.kind}" aria-label="Verwijder ${esc(it.title)} van ${esc(it.sub)}">${icon('trash', 20)}</button>
  </li>`).join('')}</ul>`;
}

function bindDelete(root, rerender) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    if (!confirm('Weet je zeker dat je dit wilt verwijderen?')) return;
    if (btn.dataset.kind === 'measurement') await deleteMeasurement(btn.dataset.delete);
    else await deleteLog(btn.dataset.delete);
    toast('Verwijderd');
    rerender();
  });
}

function bindNav(root) {
  root.querySelectorAll('select[data-nav]').forEach((sel) => {
    sel.addEventListener('change', () => { location.hash = `#/loggen/${sel.dataset.nav}/${sel.value}`; });
  });
}

function rpeChips(name) {
  return `<fieldset class="field"><legend>HOE VOELDE HET? (1–10)</legend>
    <div class="rpe">${Array.from({ length: 10 }, (_, i) => `<button type="button" class="chip" data-rpe="${i + 1}" aria-pressed="false" aria-label="Zwaarte ${i + 1} van 10">${i + 1}</button>`).join('')}</div>
    <input type="hidden" name="${name}">
  </fieldset>`;
}

function bindChips(root, attr, hiddenName) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest(`[data-${attr}]`);
    if (!b) return;
    root.querySelectorAll(`[data-${attr}]`).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    const hidden = root.querySelector(`input[name="${hiddenName}"]`);
    if (hidden) { hidden.value = b.dataset[attr]; hidden.dispatchEvent(new Event('input', { bubbles: true })); }
  });
}

const newId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// =====================================================================
// KRACHT
// =====================================================================
const INCREMENT = { onder: 2.5, boven: 2.5, isolatie: 2, core: 1 };
const round05 = (n) => Math.round(n * 2) / 2;

function repRange(ex) {
  const [lo, hi] = ex.reps.split('–').map(Number);
  return { lo, hi: hi || lo };
}

function lastStrengthLog(workout) {
  return state.logs.find((l) => l.sport === 'strength' && l.workout === workout);
}

function suggest(ex, sets, deload) {
  const { hi } = repRange(ex);
  const allTop = sets && sets.length && sets.every(([, r]) => r >= hi);
  if (ex.bodyweight) {
    if (!sets || !sets.length) return { kg: null, text: 'Lichaamsgewicht. Bouw eerst je reps op.' };
    return { kg: null, text: allTop ? 'Bovenste reps gehaald: meer reps of een zwaardere variant.' : 'Probeer 1 rep meer per set.' };
  }
  if (!sets || !sets.length) return { kg: ex.startKg, text: `Startgewicht ${fmtNum(ex.startKg)} kg.` };
  const lastKg = Math.max(...sets.map(([kg]) => kg || 0));
  if (deload) {
    const kg = round05(lastKg * 0.85);
    return { kg, text: `Deload: 2 sets op ${fmtNum(kg)} kg (±15% lichter).` };
  }
  if (allTop) {
    const kg = lastKg + INCREMENT[ex.group];
    return { kg, text: `Vorige keer ${hi}+ reps op alle sets. Verhoog naar ${fmtNum(kg)} kg.`, up: true };
  }
  return { kg: lastKg, text: `Blijf op ${fmtNum(lastKg)} kg en probeer 1 rep meer per set.` };
}

function viewStrength(sessionId) {
  const today = D.today();
  let session = sessionId && !sessionId.startsWith('vrij-') ? sessionById(sessionId) : null;
  let workout = session ? session.workout : sessionId === 'vrij-B' ? 'B' : sessionId === 'vrij-A' ? 'A' : null;
  if (!session && !workout) {
    session = defaultSession('strength', today);
    workout = session ? session.workout : 'A';
  }
  const key = session ? session.id : `vrij-${workout}`;
  const deload = !!(session && session.deload);
  const last = lastStrengthLog(workout);
  const draft = state.settings[`draft-${key}`] || {};
  const existing = session && logForSession(session.id);

  const rows = [];
  const exHtml = EXERCISES[workout].map((ex) => {
    const sides = ex.unilateral ? ['L', 'R'] : [null];
    const nSets = deload ? 2 : ex.sets;
    const advice = sides.map((side) => {
      const prev = last && last.sets[ex.id] ? (side ? last.sets[ex.id][side] : last.sets[ex.id]) : null;
      return { side, prev, s: suggest(ex, prev, deload) };
    });
    const texts = [...new Set(advice.map((a) => a.s.text))];
    const adviceText = texts.length === 1 ? texts[0] : advice.map((a) => `${a.side === 'L' ? 'Links' : 'Rechts'}: ${a.s.text}`).join(' ');
    const up = advice.some((a) => a.s.up);
    let setRows = '';
    for (let i = 0; i < nSets; i++) {
      for (const a of advice) {
        const rk = `${ex.id}|${a.side || '-'}|${i}`;
        const d = draft[rk] || {};
        const prev = a.prev && a.prev[i];
        const kgVal = d.kg ?? (a.s.kg != null ? String(a.s.kg).replace('.', ',') : '');
        rows.push(rk);
        const label = `${i + 1}${a.side ? ` ${a.side}` : ''}`;
        setRows += `<div class="setrow${d.done ? ' done' : ''}" data-row="${rk}">
          <div class="strong">${label}</div>
          <div class="muted small">${prev ? `${prev[0] != null ? `${fmtNum(prev[0])} kg × ` : ''}${prev[1]}` : '–'}</div>
          ${ex.bodyweight && !ex.startKg ? '<div class="muted small center">lichaam</div>' : `<input class="in" inputmode="decimal" aria-label="${esc(ex.name)} set ${label} kilo" data-f="kg" value="${esc(kgVal)}">`}
          <input class="in" inputmode="numeric" aria-label="${esc(ex.name)} set ${label} reps" data-f="reps" placeholder="${esc(ex.reps)}" value="${esc(d.reps ?? '')}">
          <button type="button" class="check" data-check aria-pressed="${d.done ? 'true' : 'false'}" aria-label="Set ${label} afvinken">${icon('check', 20)}</button>
        </div>`;
      }
    }
    return `<section class="card exercise">
      <h3>${esc(ex.name)}${ex.unilateral ? ' <span class="tag">links en rechts</span>' : ''}</h3>
      <div class="muted small">${nSets} sets${ex.unilateral ? ' per kant' : ''} · doel ${esc(ex.reps)} reps${ex.perSide ? ' per kant' : ''} · rust ${ex.group === 'onder' || ex.group === 'boven' ? '2–3 min' : '60–90 sec'}</div>
      <div class="advice${up ? ' up' : ''}">${up ? icon('up', 18) : ''}<span>${esc(adviceText)}</span></div>
      <div class="sethead"><span>SET</span><span>VORIGE</span><span>KG</span><span>REPS</span><span></span></div>
      ${setRows}
    </section>`;
  }).join('');

  const recent = state.logs.filter((l) => l.sport === 'strength').slice(0, 5).map((l) => ({
    id: l.id, kind: 'log', title: `Training ${l.workout}`, sub: `${D.shortLabel(l.date)} · ${fmtNum(l.volume, 0)} kg volume${l.source === 'spreadsheet' ? ' · uit spreadsheet' : ''}`,
  }));

  const html = `<main class="page">
    ${segments('kracht')}
    ${chooser('strength', 'kracht', key, [['vrij-A', 'Losse training A'], ['vrij-B', 'Losse training B']])}
    <div>
      <div class="eyebrow" style="color:var(--str)">FULL BODY A/B${session ? ` · WEEK ${session.week}` : ''}${deload ? ' · DELOAD' : ''}</div>
      <h1 class="display xl">Training ${workout}</h1>
      <div class="muted">${session ? esc(D.longLabel(session.date)) : 'Losse training'}${last ? ` · vorige keer ${esc(D.shortLabel(last.date))}` : ''}</div>
      ${existing ? `<div class="notice">Deze training is al gelogd op ${esc(D.shortLabel(existing.date))}. Opslaan overschrijft die log.</div>` : ''}
    </div>
    <div class="grid3">
      <div class="card stat"><div class="eyebrow">VOLUME</div><div class="display md" data-out="volume">0 kg</div></div>
      <div class="card stat"><div class="eyebrow">VORIGE KEER</div><div class="display md">${last ? `${fmtNum(last.volume, 0)} kg` : '–'}</div></div>
      <div class="card stat"><div class="eyebrow">SETS</div><div class="display md" data-out="sets">0 / ${rows.length}</div></div>
    </div>
    ${exHtml}
    <button type="button" class="btn" style="background:var(--str)" data-save>Training opslaan</button>
    <p class="muted small center">Rust: grote oefeningen 2–3 min · isolatie en core 60–90 sec. Techniek gaat voor gewicht.</p>
    <section><div class="section-head"><h2>Recent gelogd</h2></div>${recentList(recent, 'Nog niets gelogd.')}</section>
  </main>`;

  function mount(root, rerender) {
    bindNav(root);
    bindDelete(root, rerender);
    const draftData = { ...draft };
    let saveTimer;
    const persistDraft = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveSetting(`draft-${key}`, draftData).catch(() => {}), 400);
    };

    function readRow(rowEl) {
      const kgEl = rowEl.querySelector('[data-f="kg"]');
      return {
        kg: kgEl ? num(kgEl.value) : null,
        reps: num(rowEl.querySelector('[data-f="reps"]').value),
        done: rowEl.querySelector('[data-check]').getAttribute('aria-pressed') === 'true',
      };
    }
    function update() {
      let vol = 0; let done = 0;
      root.querySelectorAll('[data-row]').forEach((r) => {
        const v = readRow(r);
        if (v.reps) vol += (v.kg || 0) * v.reps;
        if (v.done) done++;
      });
      root.querySelector('[data-out="volume"]').textContent = `${fmtNum(vol, 0)} kg`;
      root.querySelector('[data-out="sets"]').textContent = `${done} / ${rows.length}`;
    }
    root.addEventListener('input', (e) => {
      const rowEl = e.target.closest('[data-row]');
      if (!rowEl) return;
      draftData[rowEl.dataset.row] = { ...(draftData[rowEl.dataset.row] || {}), [e.target.dataset.f]: e.target.value };
      persistDraft();
      update();
    });
    root.addEventListener('click', async (e) => {
      const chk = e.target.closest('[data-check]');
      if (chk) {
        const rowEl = chk.closest('[data-row]');
        const on = chk.getAttribute('aria-pressed') !== 'true';
        chk.setAttribute('aria-pressed', on ? 'true' : 'false');
        rowEl.classList.toggle('done', on);
        // Afvinken zonder reps ingevuld: zet de cursor in het reps-veld
        const repsEl = rowEl.querySelector('[data-f="reps"]');
        if (on && !repsEl.value) repsEl.focus();
        draftData[rowEl.dataset.row] = { ...(draftData[rowEl.dataset.row] || {}), done: on };
        persistDraft();
        update();
        return;
      }
      if (e.target.closest('[data-save]')) {
        const sets = {};
        let count = 0; let volume = 0;
        root.querySelectorAll('[data-row]').forEach((r) => {
          const [exId, side, i] = r.dataset.row.split('|');
          const v = readRow(r);
          if (!v.reps) return;
          count++;
          volume += (v.kg || 0) * v.reps;
          const pair = [v.kg, v.reps];
          if (side === '-') { (sets[exId] ||= [])[Number(i)] = pair; } else {
            sets[exId] ||= { L: [], R: [] };
            sets[exId][side][Number(i)] = pair;
          }
        });
        if (!count) { toast('Vul bij minstens één set je reps in.', 'warn'); return; }
        // lege plekken (overgeslagen sets) weghalen
        for (const k of Object.keys(sets)) {
          if (Array.isArray(sets[k])) sets[k] = sets[k].filter(Boolean);
          else { sets[k].L = sets[k].L.filter(Boolean); sets[k].R = sets[k].R.filter(Boolean); }
        }
        const prevLog = session && logForSession(session.id);
        await saveLog({
          id: prevLog ? prevLog.id : newId('kracht'),
          sport: 'strength', workout, sessionId: session ? session.id : null, week: session ? session.week : null,
          date: logDate(session), sets, volume, setCount: count, savedAt: new Date().toISOString(),
        });
        await saveSetting(`draft-${key}`, null);
        toast(`Training ${workout} opgeslagen · ${fmtNum(volume, 0)} kg volume`);
        location.hash = '#/vandaag';
      }
    });
    update();
  }
  return { html, mount };
}

// =====================================================================
// HARDLOPEN
// =====================================================================
function parseIntervals(session) {
  if (!session || session.kind !== 'Interval') return null;
  const m = session.title.match(/(\d+)\s*×\s*([\d,]+)\s*(m|km)/);
  if (!m) return null;
  const count = Number(m[1]);
  const dist = Number(m[2].replace(',', '.')) * (m[3] === 'km' ? 1000 : 1);
  const z = (session.detail || '').match(/(\d:\d\d)(?:–(\d:\d\d))?/);
  const zone = z ? [parseTime(z[1]), parseTime(z[2] || z[1])] : null;
  return { count, dist, zone };
}

function viewRun(sessionId) {
  const today = D.today();
  const session = sessionId === 'vrij' ? null : sessionId ? sessionById(sessionId) : defaultSession('run', today);
  const key = session ? session.id : 'vrij';
  const iv = parseIntervals(session);
  const existing = session && logForSession(session.id);
  const zoneTxt = iv && iv.zone ? `${fmtPace(iv.zone[0])}–${fmtPace(iv.zone[1])} min/km` : '';
  const perRep = iv && iv.zone ? `${fmtDuration((iv.zone[0] * iv.dist) / 1000)}–${fmtDuration((iv.zone[1] * iv.dist) / 1000)}` : '';

  const recent = state.logs.filter((l) => l.sport === 'run').slice(0, 5).map((l) => ({
    id: l.id, kind: 'log', title: `${l.kind || 'Loop'} · ${fmtKm(l.km)} km`, sub: `${D.shortLabel(l.date)} · ${fmtDuration(l.durationSec)} · ${fmtPace(l.paceSec)} min/km`,
  }));

  const html = `<main class="page">
    ${segments('hardlopen')}
    ${chooser('run', 'hardlopen', key, [['vrij', 'Losse loop (niet uit schema)']])}
    <div>
      <div class="eyebrow" style="color:var(--run)">${session ? `DOM TOT DOMLOOP · WEEK ${session.week} · ${esc(session.kind.toUpperCase())}` : 'LOSSE LOOP'}</div>
      <h1 class="display xl">${esc(session ? session.title : 'Hardlopen')}</h1>
      <div class="muted">${session ? `${esc(D.longLabel(session.date))} · ${esc(session.detail)}` : esc(D.longLabel(today))}</div>
      ${existing ? `<div class="notice">Deze training is al gelogd. Opslaan overschrijft die log.</div>` : ''}
    </div>

    ${iv ? `<div class="card dark grid3">
      <div><div class="eyebrow light">DOELTEMPO</div><div class="display md">${zoneTxt ? zoneTxt.replace(' min/km', '') : '–'}</div></div>
      <div><div class="eyebrow light">PER ${iv.dist >= 1000 ? fmtNum(iv.dist / 1000) + ' KM' : iv.dist + ' M'}</div><div class="display md">${perRep || '–'}</div></div>
      <div><div class="eyebrow light">AANTAL</div><div class="display md">${iv.count}×</div></div>
    </div>
    <section class="card">
      <h2 class="h2">Herhalingen</h2>
      <div class="reps">
        <div class="rephead"><span>STUK</span><span>TIJD</span><span>TEMPO</span></div>
        ${Array.from({ length: iv.count }, (_, i) => `<div class="reprow">
          <div class="strong">#${i + 1}</div>
          <input class="in" placeholder="m:ss" inputmode="decimal" data-rep="${i}" aria-label="Herhaling ${i + 1} tijd">
          <div class="pace" data-pace="${i}">–</div>
        </div>`).join('')}
      </div>
      <p class="muted small">Groen = binnen je doelzone. Het tempo rekent de app uit.</p>
    </section>` : ''}

    <section class="card form">
      <h2 class="h2">Totaal${iv || (session && session.kind !== 'Wedstrijd') ? ' (incl. in- en uitlopen)' : ''}</h2>
      <div class="grid2">
        <label class="field"><span>AFSTAND (KM)</span><input class="in" name="km" inputmode="decimal" placeholder="0,0"></label>
        <label class="field"><span>TIJD</span><input class="in" name="time" inputmode="decimal" placeholder="u:mm:ss"></label>
      </div>
      <div class="readout"><span>GEM. TEMPO</span><strong data-out="pace">–:– min/km</strong></div>
      <label class="field"><span>GEM. HARTSLAG (OPTIONEEL)</span><input class="in" name="hr" inputmode="numeric" placeholder="slagen per minuut"></label>
      ${rpeChips('rpe')}
      <label class="field"><span>NOTITIE</span><textarea class="in" name="note" rows="2" placeholder="Bijv. wind tegen, zware benen, gel getest…"></textarea></label>
      <p class="muted small">Ophalen uit Garmin komt in stap 5.</p>
    </section>
    <button type="button" class="btn" style="background:var(--run)" data-save>Training opslaan</button>
    <section><div class="section-head"><h2>Recent gelogd</h2></div>${recentList(recent, 'Nog geen looptrainingen gelogd.')}</section>
  </main>`;

  function mount(root, rerender) {
    bindNav(root);
    bindDelete(root, rerender);
    bindChips(root, 'rpe', 'rpe');
    const val = (n) => root.querySelector(`[name="${n}"]`).value;
    function update() {
      const km = num(val('km')); const t = parseTime(val('time'));
      root.querySelector('[data-out="pace"]').textContent = km && t ? `${fmtPace(t / km)} min/km` : '–:– min/km';
      if (iv) {
        root.querySelectorAll('[data-rep]').forEach((inp) => {
          const out = root.querySelector(`[data-pace="${inp.dataset.rep}"]`);
          const sec = parseTime(inp.value);
          if (!sec) { out.textContent = '–'; out.className = 'pace'; return; }
          const pace = sec / (iv.dist / 1000);
          out.textContent = `${fmtPace(pace)} /km`;
          let cls = 'pace';
          if (iv.zone) cls += pace < iv.zone[0] - 3 ? ' fast' : pace > iv.zone[1] + 3 ? ' slow' : ' ok';
          out.className = cls;
          out.setAttribute('aria-label', `${fmtPace(pace)} per kilometer${cls.includes('ok') ? ', binnen de doelzone' : cls.includes('fast') ? ', sneller dan de doelzone' : cls.includes('slow') ? ', langzamer dan de doelzone' : ''}`);
        });
      }
    }
    root.addEventListener('input', update);
    root.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-save]')) return;
      const km = num(val('km')); const t = parseTime(val('time'));
      if (!km) { toast('Vul je afstand in.', 'warn'); return; }
      const reps = iv ? [...root.querySelectorAll('[data-rep]')].map((i) => parseTime(i.value)) : null;
      const prevLog = session && logForSession(session.id);
      await saveLog({
        id: prevLog ? prevLog.id : newId('loop'),
        sport: 'run', sessionId: session ? session.id : null, week: session ? session.week : null,
        kind: session ? session.kind : 'Losse loop', title: session ? session.title : 'Losse loop',
        date: logDate(session), km, durationSec: t, paceSec: t ? t / km : null,
        hr: num(val('hr')), rpe: num(val('rpe')), note: val('note').trim(),
        reps: reps && reps.some(Boolean) ? reps : null, repDist: iv ? iv.dist : null,
        source: 'handmatig', savedAt: new Date().toISOString(),
      });
      toast(`Loop opgeslagen · ${fmtKm(km)} km${t ? ` in ${fmtDuration(t)}` : ''}`);
      location.hash = '#/vandaag';
    });
  }
  return { html, mount };
}

// =====================================================================
// ZWEMMEN
// =====================================================================
function viewSwim() {
  const recent = state.logs.filter((l) => l.sport === 'swim').slice(0, 5).map((l) => ({
    id: l.id, kind: 'log', title: `Zwemmen · ${fmtNum(l.meters, 0)} m`, sub: `${D.shortLabel(l.date)} · ${l.stroke}${l.durationSec ? ` · ${fmtDuration(l.durationSec)}` : ''}`,
  }));
  const lastPool = state.logs.find((l) => l.sport === 'swim')?.pool || 25;
  const html = `<main class="page">
    ${segments('zwemmen')}
    <div>
      <div class="eyebrow" style="color:var(--swim)">ZWEMMEN · VRIJE TRAINING</div>
      <h1 class="display xl">Banen zwemmen</h1>
      <div class="muted">${esc(D.longLabel(D.today()))}</div>
    </div>
    <section class="card form">
      <fieldset class="field"><legend>BADLENGTE</legend>
        <div class="grid2">${[25, 50].map((m) => `<button type="button" class="chip big" data-pool="${m}" aria-pressed="${m === lastPool}">${m} meter</button>`).join('')}</div>
        <input type="hidden" name="pool" value="${lastPool}">
      </fieldset>
      <div class="field"><span>AANTAL BANEN</span>
        <div class="stepper">
          <button type="button" class="round" data-step="-1" aria-label="Baan minder">−</button>
          <input class="in big" name="laps" inputmode="numeric" value="40" aria-label="Aantal banen">
          <button type="button" class="round" data-step="1" aria-label="Baan meer">+</button>
        </div>
      </div>
      <div class="grid2">
        <div class="readout tinted"><span>AFSTAND</span><strong data-out="dist">–</strong></div>
        <label class="field"><span>TIJD</span><input class="in" name="time" inputmode="decimal" placeholder="u:mm:ss"></label>
      </div>
      <div class="readout"><span>TEMPO</span><strong data-out="pace">–:– per 100 m</strong></div>
      <fieldset class="field"><legend>SLAG</legend>
        <div class="chips">${['Borstcrawl', 'Schoolslag', 'Rugslag', 'Gemengd'].map((s, i) => `<button type="button" class="chip" data-stroke="${s}" aria-pressed="${i === 0}">${s}</button>`).join('')}</div>
        <input type="hidden" name="stroke" value="Borstcrawl">
      </fieldset>
      ${rpeChips('rpe')}
      <label class="field"><span>NOTITIE</span><textarea class="in" name="note" rows="2" placeholder="Bijv. techniek, drukte in het bad…"></textarea></label>
    </section>
    <button type="button" class="btn" style="background:var(--swim)" data-save>Training opslaan</button>
    <section><div class="section-head"><h2>Recent gelogd</h2></div>${recentList(recent, 'Nog geen zwemtrainingen gelogd.')}</section>
  </main>`;

  function mount(root, rerender) {
    bindDelete(root, rerender);
    bindChips(root, 'pool', 'pool');
    bindChips(root, 'stroke', 'stroke');
    bindChips(root, 'rpe', 'rpe');
    const val = (n) => root.querySelector(`[name="${n}"]`).value;
    function update() {
      const meters = (num(val('laps')) || 0) * (num(val('pool')) || 25);
      const t = parseTime(val('time'));
      root.querySelector('[data-out="dist"]').textContent = `${fmtNum(meters, 0)} m`;
      root.querySelector('[data-out="pace"]').textContent = meters && t ? `${fmtPace(t / (meters / 100))} per 100 m` : '–:– per 100 m';
    }
    root.addEventListener('input', update);
    root.addEventListener('click', async (e) => {
      const step = e.target.closest('[data-step]');
      if (step) {
        const inp = root.querySelector('[name="laps"]');
        inp.value = Math.max(0, (num(inp.value) || 0) + Number(step.dataset.step));
        update();
        return;
      }
      if (!e.target.closest('[data-save]')) return;
      const pool = num(val('pool')) || 25; const laps = num(val('laps')) || 0;
      const meters = laps * pool; const t = parseTime(val('time'));
      if (!meters) { toast('Vul het aantal banen in.', 'warn'); return; }
      await saveLog({
        id: newId('zwem'), sport: 'swim', date: D.today(), pool, laps, meters, durationSec: t,
        pace100Sec: t ? t / (meters / 100) : null, stroke: val('stroke'), rpe: num(val('rpe')), note: val('note').trim(),
        source: 'handmatig', savedAt: new Date().toISOString(),
      });
      toast(`Zwemtraining opgeslagen · ${fmtNum(meters, 0)} m`);
      location.hash = '#/vandaag';
    });
    update();
  }
  return { html, mount };
}

// =====================================================================
// METING
// =====================================================================
function viewMeasure() {
  const height = state.settings.height;
  const recent = state.measurements.slice(0, 5).map((m) => ({
    id: m.id, kind: 'measurement', title: D.shortLabel(m.date),
    sub: [m.weight && `${fmtNum(m.weight)} kg`, m.waist && `${fmtNum(m.waist)} cm`, m.fat && `${fmtNum(m.fat)}% vet`, m.sys && m.dia && `${m.sys}/${m.dia} mmHg`, m.hr && `${m.hr} bpm`].filter(Boolean).join(' · ') || 'Lege meting',
  }));
  const html = `<main class="page">
    ${segments('meting')}
    <div>
      <div class="eyebrow" style="color:var(--body)">LICHAAM</div>
      <h1 class="display xl">Nieuwe meting</h1>
    </div>
    <label class="field"><span>DATUM</span><input class="in" type="date" name="date" value="${D.today()}" max="${D.today()}"></label>
    <section class="card form">
      <div class="grid2">
        <label class="field"><span>GEWICHT (KG)</span><input class="in" name="weight" inputmode="decimal" placeholder="0,0"></label>
        <label class="field"><span>BUIKOMVANG (CM)</span><input class="in" name="waist" inputmode="decimal" placeholder="0"></label>
      </div>
      <p class="muted small">Buikomvang: meet ter hoogte van je navel, na rustig uitademen.</p>
      <div class="grid2">
        <label class="field"><span>VETPERCENTAGE (%)</span><input class="in" name="fat" inputmode="decimal" placeholder="0,0"></label>
        <div class="readout tinted col"><span>BMI (BEREKEND)</span><strong data-out="bmi">–</strong></div>
      </div>
      <label class="field"><span>LENGTE (CM)${height ? '' : ' · EENMALIG, VOOR JE BMI'}</span><input class="in" name="height" inputmode="numeric" placeholder="bijv. 182" value="${height ? esc(height) : ''}"></label>
    </section>
    <section class="card form">
      <h2 class="h2">Bloeddruk</h2>
      <div class="grid2">
        <label class="field"><span>BOVENDRUK (MMHG)</span><input class="in" name="sys" inputmode="numeric" placeholder="0"></label>
        <label class="field"><span>ONDERDRUK (MMHG)</span><input class="in" name="dia" inputmode="numeric" placeholder="0"></label>
      </div>
      <label class="field"><span>HARTSLAG IN RUST (OPTIONEEL)</span><input class="in" name="hr" inputmode="numeric" placeholder="slagen per minuut"></label>
      <p class="muted small">Meet na 5 minuten rustig zitten, steeds op hetzelfde moment van de dag.</p>
    </section>
    <button type="button" class="btn" style="background:var(--body)" data-save>Meting opslaan</button>
    <section><div class="section-head"><h2>Recente metingen</h2></div>${recentList(recent, 'Nog geen metingen.')}</section>
  </main>`;

  function mount(root, rerender) {
    bindDelete(root, rerender);
    const val = (n) => root.querySelector(`[name="${n}"]`).value;
    function update() {
      const w = num(val('weight')); const h = num(val('height'));
      root.querySelector('[data-out="bmi"]').textContent = w && h ? fmtNum(w / (h / 100) ** 2) : '–';
    }
    root.addEventListener('input', update);
    root.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-save]')) return;
      const m = {
        id: newId('meting'), date: val('date') || D.today(),
        weight: num(val('weight')), waist: num(val('waist')), fat: num(val('fat')),
        sys: num(val('sys')), dia: num(val('dia')), hr: num(val('hr')), savedAt: new Date().toISOString(),
      };
      const h = num(val('height'));
      if (h && h !== state.settings.height) await saveSetting('height', h);
      if (![m.weight, m.waist, m.fat, m.sys, m.dia, m.hr].some((v) => v != null)) {
        if (h) { toast('Lengte opgeslagen'); rerender(); } else toast('Vul minstens één meetwaarde in.', 'warn');
        return;
      }
      if ((m.sys == null) !== (m.dia == null)) { toast('Vul bij bloeddruk zowel boven- als onderdruk in.', 'warn'); return; }
      await saveMeasurement(m);
      toast('Meting opgeslagen');
      rerender();
    });
    update();
  }
  return { html, mount };
}

// =====================================================================
export function viewLog(parts) {
  const [seg, id] = parts;
  if (seg === 'hardlopen') return viewRun(id);
  if (seg === 'zwemmen') return viewSwim();
  if (seg === 'meting') return viewMeasure();
  if (seg === 'kracht') return viewStrength(id);
  // Geen keuze: kies de sport van de training van vandaag
  const todays = ['strength', 'run'].map((s) => defaultSession(s, D.today())).filter((s) => s && s.date === D.today());
  if (todays[0] && todays[0].sport === 'run') return viewRun(todays[0].id);
  return viewStrength(todays[0] ? todays[0].id : null);
}
