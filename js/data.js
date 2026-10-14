// Startgegevens: de twee schema's van Oliver.
// - Hardlopen: "Trainingsschema Dom tot Domloop 2027" (Google Drive, map Fitness)
// - Kracht: "Full Body A/B Tracker (8-12 weken)" (Google Sheets)
import { addDays } from './dates.js';

export const SPORTS = {
  run: { label: 'Hardlopen', color: 'var(--run)' },
  strength: { label: 'Kracht', color: 'var(--str)' },
  swim: { label: 'Zwemmen', color: 'var(--swim)' },
};

// ---------- Hardlopen: Dom tot Domloop 2027 ----------
// Per week: [zondag, long run, long-km, interval, interval-km (werkdeel), easy run, easy-km]
const DOMLOOP_WEEKS = [
  ['2026-10-11', '10 km', 10, '6 × 400 m op 5:35–5:45, 200 m dribbelen', 2.4, '6 km', 6],
  ['2026-10-18', '11 km', 11, '4 × 800 m op 5:50–5:55, 2 min pauze', 3.2, '6 km', 6],
  ['2026-10-25', '12 km', 12, '8 × 400 m op 5:35–5:40, 200 m dribbelen', 3.2, '7 km', 7],
  ['2026-11-01', '13 km', 13, '4 × 1 km op 5:55–6:00, 2 min pauze', 4, '7 km', 7],
  ['2026-11-08', '9 km', 9, '6 × 400 m op 5:30–5:40, 200 m dribbelen', 2.4, '5 km', 5],
  ['2026-11-15', '12 km', 12, '5 × 800 m op 5:45–5:50, 2 min pauze', 4, '7 km', 7],
  ['2026-11-22', '13 km', 13, '8 × 400 m op 5:30–5:40, 200 m dribbelen', 3.2, '6 km', 6],
  ['2026-11-29', '14 km', 14, '5 × 800 m op 5:40–5:45, 2 min pauze', 4, '7 km', 7],
  ['2026-12-06', '14 km', 14, '10 × 400 m op 5:30, 200 m dribbelen', 4, '7 km', 7],
  ['2026-12-13', '15 km', 15, '4 × 1 km op 5:45, 2 min pauze', 4, '8 km', 8],
  ['2026-12-20', '10 km', 10, '6 × 400 m op 5:30, 200 m dribbelen', 2.4, '6 km', 6],
  ['2026-12-27', '5 km-test: 2 km inlopen, 5 km voluit, 1 km uitlopen', 8, '6 × 800 m op 5:35–5:40, 2 min pauze', 4.8, '7 km', 7],
  ['2027-01-03', '13 km', 13, '5 × 1 km op 5:35–5:40, 2 min pauze', 5, '7 km', 7],
  ['2027-01-10', '14 km, laatste 2 km op 5:45', 14, '3 × 2 km op 5:45, 3 min pauze', 6, '8 km', 8],
  ['2027-01-17', '15 km, laatste 3 km op 5:45', 15, '6 × 1 km op 5:30, 2 min pauze', 6, '8 km', 8],
  ['2027-01-24', '11 km', 11, '8 × 400 m op 5:15–5:20, 200 m dribbelen', 3.2, '6 km', 6],
  ['2027-01-31', '16 km, laatste 3 km op 5:40', 16, '4 × 1,5 km op 5:30, 2:30 min pauze', 6, '8 km', 8],
  ['2027-02-07', '10 km-test: 2 km inlopen, 10 km voluit, 1 km uitlopen', 13, '8 × 400 m op 5:15–5:20, 200 m dribbelen', 3.2, '7 km', 7],
  ['2027-02-14', '16 km, laatste 4 km op 5:35', 16, '3 × 2 km op 5:30, 3 min pauze', 6, '8 km', 8],
  ['2027-02-21', '18 km rustig', 18, '5 × 1 km op 5:20–5:25, 2 min pauze', 5, '8 km', 8],
  ['2027-02-28', '16 km met 3 × 3 km op 5:30, 1 km rustig ertussen', 16, '2 × 3 km op 5:30, 3 min pauze', 6, '8 km', 8],
  ['2027-03-07', '12 km, laatste 3 km op 5:30', 12, '4 × 1 km op 5:30, 2 min pauze', 4, '6 km', 6],
  ['2027-03-14', '8 km rustig', 8, '3 × 1 km op 5:30, 2 min pauze', 3, '4 km + 4 × 100 m versnellen', 4],
];
const REST_WEEKS = [5, 11, 16];

function domloopPhase(week) {
  if (week <= 6) return 'Fase 1: herstel en basis';
  if (week <= 12) return 'Fase 2: basis en snelheid';
  if (week <= 20) return 'Fase 3: racetempo opbouwen';
  return 'Fase 4: piek en taper';
}

function buildDomloop() {
  const sessions = [];
  DOMLOOP_WEEKS.forEach(([sunday, long, longKm, interval, intKm, easy, easyKm], i) => {
    const week = i + 1;
    const easyPace = week <= 12 ? '6:50–7:20 min/km' : '6:40–7:10 min/km';
    const rest = REST_WEEKS.includes(week);
    const base = { planId: 'domloop', sport: 'run', week, rest };
    // Olivers indeling: di easy run, do interval, zo long run.
    // Uitzondering: in de wedstrijdweek (week 23) blijft het interval op dinsdag,
    // zodat er niet twee dagen voor de wedstrijd nog een zware training staat.
    const raceWeek = week === 23;
    const easyDate = addDays(sunday, raceWeek ? 4 : 2);
    const intDate = addDays(sunday, raceWeek ? 2 : 4);
    sessions.push({ ...base, id: `dom-${week}-long`, date: sunday, kind: 'Long Run', title: long, km: longKm, detail: long.includes('test') ? 'Vlak parcours, uitgerust starten' : easyPace });
    sessions.push({ ...base, id: `dom-${week}-easy`, date: easyDate, kind: 'Easy Run', title: easy, km: easyKm, detail: easyPace });
    sessions.push({ ...base, id: `dom-${week}-int`, date: intDate, kind: 'Interval', title: interval.split(' op ')[0], km: intKm, detail: interval.includes(' op ') ? 'op ' + interval.split(' op ')[1] : interval });
  });
  sessions.push({ id: 'dom-race', planId: 'domloop', sport: 'run', week: 23, date: '2027-03-20', kind: 'Wedstrijd', title: 'Dom tot Domloop · 10 Engelse Mijl', km: 16.1, detail: 'Start 2 km op 5:35, daarna 5:30 min/km', race: true });
  return {
    id: 'domloop',
    sport: 'run',
    name: 'Dom tot Domloop 2027',
    goal: '10 EM (16,1 km) in 1:28:31 · 5:30 min/km',
    start: '2026-10-11',
    end: '2027-03-20',
    raceDate: '2027-03-20',
    raceName: 'Dom tot Domloop',
    goalTitle: '10 EM in 1:28:31',
    goalSec: 5311,
    goalSub: '5:30 min/km · za 20 mrt 2027',
    weeks: 23,
    perWeek: 3,
    days: 'di easy run · do interval · zo long run',
    phase: domloopPhase,
    sessions,
  };
}

// ---------- Kracht: Full Body A/B ----------
// unilateral: links en rechts apart loggen
export const EXERCISES = {
  A: [
    { id: 'squat', name: 'Squat (goblet / kettlebell)', sets: 3, reps: '6–8', startKg: 14, group: 'onder' },
    { id: 'hipthrust', name: 'Hip Thrust', sets: 3, reps: '8–10', startKg: 15, group: 'onder' },
    { id: 'bench', name: 'Bench Press', sets: 3, reps: '6–8', startKg: 30, group: 'boven' },
    { id: 'rows', name: 'Rows (KB)', sets: 3, reps: '8–10', startKg: 12, group: 'boven', unilateral: true },
    { id: 'ohp-a', name: 'Overhead Press', sets: 3, reps: '8–10', startKg: 10, group: 'boven', unilateral: true },
    { id: 'curls', name: 'Biceps Curls', sets: 3, reps: '10–12', startKg: 10, group: 'isolatie', unilateral: true },
    { id: 'triceps', name: 'Triceps Extension', sets: 3, reps: '10–12', startKg: 10, group: 'isolatie' },
    { id: 'abwheel', name: 'Ab Wheel Roll-out', sets: 3, reps: '8–12', startKg: null, group: 'core', bodyweight: true },
  ],
  B: [
    { id: 'deadlift', name: 'Deadlift', sets: 4, reps: '5–6', startKg: 20, group: 'onder' },
    { id: 'bulgarian', name: 'Bulgarian Lunges', sets: 3, reps: '8–10', startKg: null, group: 'onder', unilateral: true, bodyweight: true },
    { id: 'pushups', name: 'Push-ups', sets: 3, reps: '10–15', startKg: null, group: 'boven', bodyweight: true },
    { id: 'pullup', name: 'Pull-up (band-assist)', sets: 4, reps: '6–8', startKg: null, group: 'boven', bodyweight: true },
    { id: 'ohp-b', name: 'Overhead Press', sets: 3, reps: '8–10', startKg: 15, group: 'boven' },
    { id: 'legext', name: 'Leg Extensions', sets: 3, reps: '12–15', startKg: 20, group: 'isolatie' },
    { id: 'donkey', name: 'Donkey Kicks', sets: 3, reps: '12–15', startKg: null, group: 'isolatie', unilateral: true, bodyweight: true },
    { id: 'twists', name: 'Russian Twists', sets: 3, reps: '15–20', startKg: 5, group: 'core', perSide: true },
  ],
};

function buildFullBody() {
  const sessions = [];
  // Week 3 begint op maandag 12 oktober 2026; week 1 en 2 staan al in de spreadsheet.
  for (let week = 3; week <= 12; week++) {
    const monday = addDays('2026-10-12', (week - 3) * 7);
    const deload = week === 6 || week === 12;
    const detail = deload ? 'Deload: 2 sets, ±15% lichter' : '8 oefeningen · ± 50 min';
    sessions.push({ id: `fb-${week}-A`, planId: 'fullbody', sport: 'strength', week, date: monday, kind: 'Kracht', title: 'Training A', workout: 'A', detail, deload });
    sessions.push({ id: `fb-${week}-B`, planId: 'fullbody', sport: 'strength', week, date: addDays(monday, 4), kind: 'Kracht', title: 'Training B', workout: 'B', detail, deload });
  }
  return {
    id: 'fullbody',
    sport: 'strength',
    name: 'Full Body A/B',
    goal: 'Sterker worden met dubbele progressie',
    start: '2026-08-19',
    end: addDays('2026-10-12', 9 * 7 + 4),
    weeks: 12,
    weekOffset: 2,
    perWeek: 2,
    days: 'ma Training A · vr Training B',
    phase: (w) => (w <= 2 ? 'Instellen en techniek' : w <= 5 ? 'Opbouwen' : w === 6 ? 'Deload' : w <= 11 ? 'Verder bouwen' : 'Deload of max testen'),
    sessions,
  };
}

export function buildPlans() {
  return [buildDomloop(), buildFullBody()];
}

// Singelloop Utrecht (4 okt 2026), uit het Dom tot Domloop-schema: startpunt voor de voorspelling
export const RUN_HISTORY = [
  { id: 'hist-singelloop', sport: 'run', date: '2026-10-04', kind: 'Wedstrijd', title: 'Singelloop Utrecht', km: 10, durationSec: 3668, paceSec: 366.8, source: 'schema-document', savedAt: '2026-10-04T12:00:00.000Z' },
];

// Eerdere krachttrainingen uit de spreadsheet (Training A, week 1 en 2).
// [kg, reps] per set; bij links/rechts: { L: [...], R: [...] }
export const STRENGTH_HISTORY = [
  {
    id: 'hist-A-1', date: '2026-08-19', workout: 'A', week: 1,
    sets: {
      squat: [[14, 15], [14, 15], [14, 15]],
      hipthrust: [[15, 12], [15, 12], [15, 12]],
      bench: [[30, 17], [30, 15], [30, 12]],
      rows: { L: [[10, 15], [10, 15], [10, 15]], R: [[10, 15], [10, 15], [10, 15]] },
      'ohp-a': { L: [[10, 15], [10, 12], [10, 10]], R: [[10, 15], [10, 12], [10, 10]] },
      curls: { L: [[8, 12], [8, 10], [10, 8]], R: [[8, 15], [8, 10], [10, 8]] },
      triceps: [[8, 15], [8, 18], [8, 15]],
    },
  },
  {
    id: 'hist-A-2', date: '2026-09-04', workout: 'A', week: 2,
    sets: {
      squat: [[14, 15], [14, 15], [14, 15]],
      hipthrust: [[15, 15], [15, 15], [15, 15]],
      bench: [[30, 15], [30, 15], [30, 15]],
      rows: { L: [[12, 12], [12, 12], [12, 15]], R: [[12, 12], [12, 12], [12, 15]] },
      'ohp-a': { L: [[10, 15], [10, 12], [10, 12]], R: [[10, 15], [10, 12], [10, 12]] },
      curls: { L: [[10, 8], [10, 8], [10, 7]], R: [[10, 10], [10, 8], [10, 8]] },
      triceps: [[10, 20], [10, 15], [10, 15]],
    },
  },
];
