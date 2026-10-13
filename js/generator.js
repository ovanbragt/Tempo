// Nieuwe schema's maken op basis van een doel.
// Vaste, uitlegbare regels (geen AI): rustige opbouw, elke 4e week lichter, taper voor een wedstrijd.
import { EXERCISES } from './data.js';
import * as D from './dates.js';
import { fmtPace, fmtDuration, fmtNum } from './ui.js';

export const RUN_DISTANCES = [
  { km: 5, label: '5 km', peak: 10, start: 5 },
  { km: 10, label: '10 km', peak: 14, start: 7 },
  { km: 16.1, label: '10 Engelse Mijl', peak: 18, start: 10 },
  { km: 21.1, label: 'Halve marathon', peak: 20, start: 12 },
  { km: 42.2, label: 'Marathon', peak: 32, start: 16 },
];

const newPlanId = () => `plan${Date.now().toString(36)}`;
const round = (n, step = 1) => Math.round(n / step) * step;

function weekMonday(start, w) {
  return D.addDays(D.mondayOf(start), (w - 1) * 7);
}

function dayList(days) {
  return [...days].sort((a, b) => a - b).map((i) => D.WD_SHORT[i].toLowerCase()).join(', ');
}

// ---------------------------------------------------------------- Hardlopen
export function predictTime(distKm, recent) {
  if (!recent || !recent.km || !recent.sec) return null;
  return recent.sec * (distKm / recent.km) ** 1.06; // formule van Riegel
}

export function buildRunPlan(spec) {
  const dist = RUN_DISTANCES.find((d) => d.km === spec.distance);
  const warnings = [];
  if (!dist) throw new Error('Kies een afstand.');
  if (!spec.raceDate) throw new Error('Kies de datum van je wedstrijd.');
  let start = D.mondayOf(spec.start);
  const totalDays = D.daysBetween(start, spec.raceDate);
  if (totalDays < 21) throw new Error('Je wedstrijd is te dichtbij voor een schema. Kies minstens 4 weken vooruit.');
  let weeks = Math.floor(totalDays / 7) + 1;
  if (weeks > 30) { weeks = 30; start = D.addDays(D.mondayOf(spec.raceDate), -29 * 7); warnings.push(`Het schema begint op ${D.shortLabel(start)}, 30 weken voor de wedstrijd.`); }
  if (weeks < 8 && dist.km >= 16) warnings.push(`${weeks} weken is kort voor ${dist.label}. Het schema gaat sneller omhoog dan ideaal.`);
  const days = spec.days.length ? spec.days : [1, 3, 6];
  if (days.length < 2) throw new Error('Kies minstens 2 trainingsdagen.');
  const longDay = days.includes(spec.longDay) ? spec.longDay : Math.max(...days);
  const others = days.filter((d) => d !== longDay).sort((a, b) => a - b);
  // kwaliteitstraining op de dag het verst van de long run
  const qualityDay = others.length ? others.reduce((best, d) => (Math.min(Math.abs(d - longDay), 7 - Math.abs(d - longDay)) > Math.min(Math.abs(best - longDay), 7 - Math.abs(best - longDay)) ? d : best), others[0]) : null;

  // Tempo's
  const predicted = predictTime(dist.km, spec.recent);
  const goalSec = spec.goalSec || null;
  const raceSec = goalSec || predicted;
  const rp = raceSec ? raceSec / dist.km : null; // seconden per km
  if (goalSec && predicted) {
    const pct = Math.round(((predicted - goalSec) / predicted) * 100);
    if (pct > 15) warnings.push(`Je doel vraagt ${pct}% sneller dan je recente uitslag voorspelt (${fmtDuration(predicted)}). Dat is erg ambitieus.`);
    else if (pct > 0) warnings.push(`Je recente uitslag voorspelt ${fmtDuration(predicted)}. Je doel vraagt ${pct}% sneller: haalbaar met dit schema als de opbouw goed gaat.`);
    else warnings.push(`Je recente uitslag voorspelt ${fmtDuration(predicted)}, sneller dan je doel. Je kunt het doel scherper zetten.`);
  }
  const zone = (lo, hi) => (rp ? `${fmtPace(rp + lo)}–${fmtPace(rp + hi)} min/km` : null);
  const easy = zone(80, 110) || 'rustig, je kunt hele zinnen praten';
  const intervalPace = zone(-15, 0) || 'stevig, de laatste even snel als de eerste';
  const racePace = rp ? `${fmtPace(rp)} min/km` : 'wedstrijdtempo';

  const taper = dist.km >= 42 ? 3 : weeks >= 8 ? 2 : 1;
  const buildWeeks = Math.max(1, weeks - taper);
  const startLong = Math.min(spec.currentLong || dist.start, dist.peak);
  const sessions = [];
  const phaseNames = [];
  const QUALITY = {
    1: [['6 × 400 m', 2.4, 'p', '200 m dribbelen'], ['4 × 800 m', 3.2, 'p', '2 min pauze']],
    2: [['5 × 800 m', 4, 'p', '2 min pauze'], ['4 × 1 km', 4, 'p', '2 min pauze']],
    3: [['5 × 1 km', 5, 'r', '2 min pauze'], ['3 × 2 km', 6, 'r', '3 min pauze']],
  };
  const planId = newPlanId();
  for (let w = 1; w <= weeks; w++) {
    const monday = weekMonday(start, w);
    const f = w / buildWeeks;
    const isTaper = w > buildWeeks;
    const rest = !isTaper && w % 4 === 0 && w < buildWeeks;
    const phase = isTaper ? 3 : f <= 0.35 ? 1 : f <= 0.7 ? 2 : 3;
    phaseNames.push(isTaper ? 'Taper: uitrusten voor de wedstrijd' : rest ? 'Rustweek' : ['', 'Basis', 'Opbouw', 'Racetempo'][phase]);
    let longKm = startLong + (dist.peak - startLong) * ((w - 1) / Math.max(1, buildWeeks - 1));
    if (rest) longKm *= 0.75;
    if (isTaper) longKm = dist.peak * (w === weeks ? 0.4 : w === weeks - 1 ? 0.6 : 0.75);
    longKm = Math.max(3, round(longKm));
    const easyKm = Math.max(4, round(longKm * 0.5));
    const raceWeek = w === weeks;
    const add = (dayIdx, s) => {
      const date = D.addDays(monday, dayIdx);
      if (date < spec.start || date >= spec.raceDate) return;
      sessions.push({ planId, sport: 'run', week: w, rest, date, id: `${planId}-w${w}-d${dayIdx}`, ...s });
    };
    add(longDay, { kind: 'Long Run', title: `${longKm} km${phase === 3 && !isTaper && !rest && dist.km >= 10 ? `, laatste ${Math.min(4, round(longKm * 0.2))} km op ${racePace}` : ''}`, km: longKm, detail: easy });
    if (qualityDay != null) {
      let q;
      if (isTaper) q = ['3 × 1 km', 3, 'r', '2 min pauze'];
      else if (rest) q = QUALITY[1][0];
      else q = QUALITY[phase][w % 2];
      add(qualityDay, { kind: 'Interval', title: q[0], km: q[1], detail: `op ${q[2] === 'r' ? racePace : intervalPace}, ${q[3]}` });
    }
    others.filter((d) => d !== qualityDay).forEach((d) => {
      add(d, raceWeek
        ? { kind: 'Easy Run', title: '4 km + 4 × 100 m versnellen', km: 4, detail: easy }
        : { kind: 'Easy Run', title: `${easyKm} km`, km: easyKm, detail: easy });
    });
  }
  // Wedstrijdweek: geen zware training in de laatste 2 dagen voor de wedstrijd
  const raceWeekSessions = sessions.filter((s) => s.week === weeks);
  const close = raceWeekSessions.filter((s) => D.daysBetween(s.date, spec.raceDate) <= 2);
  const far = raceWeekSessions.filter((s) => D.daysBetween(s.date, spec.raceDate) >= 3);
  if (close.some((s) => s.kind === 'Interval')) {
    for (const s of close) Object.assign(s, { kind: 'Easy Run', title: '4 km + 4 × 100 m versnellen', km: 4, detail: easy });
    const target = far.filter((s) => s.kind !== 'Long Run').pop();
    if (target) Object.assign(target, { kind: 'Interval', title: '3 × 1 km', km: 3, detail: `op ${racePace}, 2 min pauze` });
  }
  sessions.push({ planId, sport: 'run', week: weeks, id: `${planId}-race`, date: spec.raceDate, kind: 'Wedstrijd', title: `${spec.raceName || dist.label}`, km: dist.km, detail: rp ? `Doeltempo ${racePace}` : 'Start rustig, versnel in het laatste kwart', race: true });

  const goalTitle = `${dist.label}${raceSec ? ` in ${fmtDuration(raceSec)}` : ''}`;
  return {
    plan: {
      id: planId, sport: 'run', name: spec.raceName || `${dist.label} ${D.parse(spec.raceDate).getFullYear()}`,
      goal: goalTitle + (rp ? ` · ${fmtPace(rp)} min/km` : ''),
      start, end: spec.raceDate, raceDate: spec.raceDate, raceName: spec.raceName || dist.label,
      goalTitle, goalSub: `${rp ? `${fmtPace(rp)} min/km · ` : ''}${D.shortLabel(spec.raceDate)}`,
      weeks, perWeek: days.length, days: `${dayList(others)} en long run op ${D.WD_LONG[longDay]}`,
      phaseNames, sessions, spec, createdAt: new Date().toISOString(),
    },
    warnings,
  };
}

// ---------------------------------------------------------------- Kracht
export const STRENGTH_GOALS = {
  sterker: { label: 'Sterker worden', compound: '5–8', iso: '8–10', sets: 4 },
  massa: { label: 'Spiermassa', compound: '8–10', iso: '10–12', sets: 3 },
  fit: { label: 'Fit en afvallen', compound: '10–12', iso: '12–15', sets: 3 },
  lopen: { label: 'Ondersteunend aan hardlopen', compound: '8–10', iso: '10–12', sets: 3 },
};

export function buildStrengthPlan(spec) {
  const goal = STRENGTH_GOALS[spec.goal] || STRENGTH_GOALS.sterker;
  const days = [...spec.days].sort((a, b) => a - b);
  if (days.length < 2 || days.length > 3) throw new Error('Kies 2 of 3 krachtdagen.');
  const weeks = spec.weeks || 8;
  const start = D.mondayOf(spec.start);
  const planId = newPlanId();
  const workouts = {};
  for (const k of ['A', 'B']) {
    workouts[k] = EXERCISES[k].map((ex) => {
      if (ex.bodyweight) return { ...ex };
      const compound = ex.group === 'onder' || ex.group === 'boven';
      return { ...ex, reps: compound ? goal.compound : goal.iso, sets: compound ? goal.sets : 3 };
    });
  }
  const deloads = [Math.round(weeks / 2), weeks];
  const sessions = [];
  const phaseNames = [];
  let n = 0;
  for (let w = 1; w <= weeks; w++) {
    const deload = deloads.includes(w);
    phaseNames.push(deload ? 'Deload: lichter, herstel' : w <= 2 ? 'Instellen en techniek' : 'Opbouwen');
    for (const d of days) {
      const date = D.addDays(weekMonday(start, w), d);
      if (date < spec.start) continue;
      const workout = n % 2 === 0 ? 'A' : 'B';
      n++;
      sessions.push({ id: `${planId}-w${w}-d${d}`, planId, sport: 'strength', week: w, date, kind: 'Kracht', title: `Training ${workout}`, workout, detail: deload ? 'Deload: 2 sets, ±15% lichter' : `8 oefeningen · ${goal.compound} reps`, deload });
    }
  }
  return {
    plan: {
      id: planId, sport: 'strength', name: `Kracht: ${goal.label}`, goal: `${goal.label} · ${goal.compound} reps op de basisoefeningen`,
      start, end: sessions.length ? sessions[sessions.length - 1].date : start, weeks, perWeek: days.length,
      days: `${dayList(days)}, Training A en B om en om`, phaseNames, sessions, workouts, spec, createdAt: new Date().toISOString(),
    },
    warnings: days.some((d, i) => i && d - days[i - 1] < 2) ? ['Twee krachtdagen achter elkaar: plan bij voorkeur een rustdag ertussen.'] : [],
  };
}

// ---------------------------------------------------------------- Zwemmen
export const SWIM_GOALS = {
  conditie: 'Conditie opbouwen',
  afstand: 'Afstand halen aan één stuk',
  techniek: 'Techniek borstcrawl verbeteren',
};

export function buildSwimPlan(spec) {
  const days = [...spec.days].sort((a, b) => a - b);
  if (!days.length) throw new Error('Kies minstens 1 zwemdag.');
  const weeks = spec.weeks || 8;
  const start = D.mondayOf(spec.start);
  const from = Math.max(300, spec.startM || 800);
  const to = Math.max(from, spec.targetM || 1500);
  const planId = newPlanId();
  const sessions = [];
  const phaseNames = [];
  for (let w = 1; w <= weeks; w++) {
    const rest = w % 4 === 0 && w < weeks;
    phaseNames.push(rest ? 'Rustweek' : w === weeks ? 'Doelweek' : 'Opbouwen');
    let m = from + (to - from) * ((w - 1) / Math.max(1, weeks - 1));
    if (rest) m *= 0.8;
    m = Math.max(300, round(m, 50));
    days.forEach((d, i) => {
      const date = D.addDays(weekMonday(start, w), d);
      if (date < spec.start) return;
      const last = i === days.length - 1;
      const main = m - 300;
      let detail;
      if (spec.goal === 'afstand' && last) detail = w === weeks ? `${fmtNum(to, 0)} m aan één stuk: je doel!` : `200 m inzwemmen, ${fmtNum(main, 0)} m aan één stuk, 100 m uitzwemmen`;
      else if (spec.goal === 'techniek') detail = `200 m inzwemmen, 4 × 50 m techniekoefeningen, ${Math.max(1, Math.floor((main - 200) / 100))} × 100 m rustig, 100 m uitzwemmen`;
      else detail = `200 m inzwemmen, ${Math.max(1, Math.floor(main / 100))} × 100 m met 20 s rust, 100 m uitzwemmen`;
      sessions.push({ id: `${planId}-w${w}-d${d}`, planId, sport: 'swim', week: w, rest, date, kind: 'Zwemmen', title: `${fmtNum(m, 0)} m`, meters: m, detail });
    });
  }
  return {
    plan: {
      id: planId, sport: 'swim', name: `Zwemmen: ${SWIM_GOALS[spec.goal] || SWIM_GOALS.conditie}`, goal: `Van ${fmtNum(from, 0)} naar ${fmtNum(to, 0)} m per training`,
      start, end: sessions.length ? sessions[sessions.length - 1].date : start, weeks, perWeek: days.length,
      days: dayList(days), phaseNames, sessions, spec, createdAt: new Date().toISOString(),
    },
    warnings: [],
  };
}
