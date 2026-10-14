// Persoonlijke records en wedstrijdvoorspelling.
import { EXERCISES } from './data.js';
import { state } from './plan.js';
import * as D from './dates.js';
import { fmtNum, fmtKm, fmtPace, fmtDuration } from './ui.js';

const EX_NAMES = Object.fromEntries([...EXERCISES.A, ...EXERCISES.B].map((e) => [e.id, e.name]));

function bestSetOf(val) {
  const lists = Array.isArray(val) ? [val] : [val.L || [], val.R || []];
  let best = null;
  for (const list of lists) {
    for (const [kg, reps] of list) {
      if (!reps) continue;
      const k = kg || 0;
      if (!best || k > best.kg || (k === best.kg && reps > best.reps)) best = { kg: k, reps };
    }
  }
  return best;
}

// Loopt alle trainingen op volgorde door en noteert elk moment dat een record verbeterd wordt.
// De eerste keer dat iets gemeten wordt telt als startpunt, nog niet als record.
export function recordHistory(logs = state.logs) {
  const sorted = [...logs].sort((a, b) => (a.date === b.date ? String(a.savedAt || '').localeCompare(String(b.savedAt || '')) : a.date < b.date ? -1 : 1));
  const best = { lift: {}, pace5: null, pace10: null, longRun: null, longSwim: null };
  const events = [];
  const add = (log, key, text) => events.push({ logId: log.id, date: log.date, key, text });
  for (const l of sorted) {
    if (l.sport === 'strength') {
      for (const [exId, val] of Object.entries(l.sets || {})) {
        const b = bestSetOf(val);
        if (!b) continue;
        const prev = best.lift[exId];
        const name = EX_NAMES[exId] || exId;
        if (prev && (b.kg > prev.kg || (b.kg === prev.kg && b.reps > prev.reps))) {
          add(l, `lift-${exId}`, b.kg > prev.kg
            ? `${name}: ${fmtNum(b.kg)} kg × ${b.reps} (was ${fmtNum(prev.kg)} kg)`
            : `${name}: ${b.kg ? `${fmtNum(b.kg)} kg × ` : ''}${b.reps} reps (was ${prev.reps})`);
        }
        if (!prev || b.kg > prev.kg || (b.kg === prev.kg && b.reps > prev.reps)) best.lift[exId] = { ...b, date: l.date };
      }
    }
    if (l.sport === 'run' && l.km) {
      const steady = l.kind !== 'Interval' && l.paceSec;
      for (const [k, min, label] of [['pace5', 5, '5 km'], ['pace10', 10, '10 km']]) {
        if (!steady || l.km < min) continue;
        if (best[k] && l.paceSec < best[k].pace) add(l, k, `Snelste loop van ${label} of meer: ${fmtPace(l.paceSec)} min/km (was ${fmtPace(best[k].pace)})`);
        if (!best[k] || l.paceSec < best[k].pace) best[k] = { pace: l.paceSec, km: l.km, sec: l.durationSec, date: l.date };
      }
      if (best.longRun && l.km > best.longRun.km) add(l, 'longRun', `Langste loop: ${fmtKm(l.km)} km (was ${fmtKm(best.longRun.km)} km)`);
      if (!best.longRun || l.km > best.longRun.km) best.longRun = { km: l.km, date: l.date };
    }
    if (l.sport === 'swim' && l.meters) {
      if (best.longSwim && l.meters > best.longSwim.m) add(l, 'longSwim', `Langste zwemtraining: ${fmtNum(l.meters, 0)} m (was ${fmtNum(best.longSwim.m, 0)} m)`);
      if (!best.longSwim || l.meters > best.longSwim.m) best.longSwim = { m: l.meters, date: l.date };
    }
  }
  return { best, events };
}

export function recordsForLog(logId) {
  return recordHistory().events.filter((e) => e.logId === logId);
}

// ---------- Wedstrijdvoorspelling (formule van Riegel) ----------
// Gebruikt lopen van de afgelopen 6 weken van minstens 3 km, zonder intervallen (die bevatten pauzes).
export function racePrediction(distKm, today = D.today()) {
  const from = D.addDays(today, -42);
  const runs = state.logs.filter((l) => l.sport === 'run' && l.km >= 3 && l.durationSec && l.date >= from && l.date <= today && l.kind !== 'Interval');
  if (!runs.length) return null;
  let best = null;
  for (const l of runs) {
    const sec = l.durationSec * (distKm / l.km) ** 1.06;
    if (!best || sec < best.sec) best = { sec, from: l };
  }
  return { ...best, pace: best.sec / distKm, count: runs.length };
}

export function predictionLine(plan, today) {
  const race = plan.sessions.find((s) => s.race);
  if (!race) return null;
  const p = racePrediction(race.km, today);
  if (!p) return null;
  const goal = plan.goalSec ?? plan.spec?.goalSec ?? null;
  const gap = goal ? Math.round((p.sec - goal) / race.km) : null;
  return {
    ...p, km: race.km, goal,
    text: `${fmtDuration(p.sec)} (${fmtPace(p.pace)} min/km)`,
    gapText: gap == null ? '' : gap > 0 ? `nog ${gap} sec/km sneller nodig` : 'je doel ligt binnen bereik',
    basis: `${p.from.title || p.from.kind || 'Loop'} van ${D.shortLabel(p.from.date)}: ${fmtKm(p.from.km)} km in ${fmtDuration(p.from.durationSec)}`,
  };
}
