// Centrale toestand: schema's, verplaatste trainingen en gelogde trainingen.
import { buildPlans } from './data.js';
import { db } from './db.js';
import * as D from './dates.js';

export const state = {
  plans: buildPlans(),
  moves: {}, // sessie-id → nieuwe datum
  logs: [],
  measurements: [],
  settings: {},
};

export async function loadState() {
  const [moves, logs, measurements, settings] = await Promise.all([
    db.all('moves'), db.all('logs'), db.all('measurements'), db.all('settings'),
  ]);
  state.moves = Object.fromEntries(moves.map((m) => [m.id, m.date]));
  for (const l of logs) {
    if (l.sport === 'strength' && l.volume == null) l.volume = strengthVolume(l.sets);
  }
  state.logs = logs.sort((a, b) => (a.date < b.date ? 1 : -1));
  state.measurements = measurements.sort((a, b) => (a.date < b.date ? 1 : -1));
  state.settings = Object.fromEntries(settings.map((s) => [s.id, s.value]));
}

// Volume = som van kg × reps over alle sets (links en rechts tellen allebei mee)
export function strengthVolume(sets) {
  let v = 0;
  for (const val of Object.values(sets || {})) {
    const lists = Array.isArray(val) ? [val] : [val.L || [], val.R || []];
    for (const list of lists) for (const [kg, reps] of list) v += (kg || 0) * (reps || 0);
  }
  return v;
}

export async function saveLog(log) {
  await db.put('logs', log);
  state.logs = [log, ...state.logs.filter((l) => l.id !== log.id)].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteLog(id) {
  await db.remove('logs', id);
  state.logs = state.logs.filter((l) => l.id !== id);
}

export async function saveMeasurement(m) {
  await db.put('measurements', m);
  state.measurements = [m, ...state.measurements.filter((x) => x.id !== m.id)].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function deleteMeasurement(id) {
  await db.remove('measurements', id);
  state.measurements = state.measurements.filter((x) => x.id !== id);
}

export async function saveSetting(id, value) {
  await db.put('settings', { id, value });
  state.settings[id] = value;
}

// Training naar een andere dag verplaatsen (terug naar de originele dag = verplaatsing wissen)
export async function moveSession(id, date) {
  const orig = state.plans.flatMap((p) => p.sessions).find((s) => s.id === id);
  if (!orig) return;
  if (date === orig.date) {
    await db.remove('moves', id);
    delete state.moves[id];
  } else {
    await db.put('moves', { id, date, movedAt: new Date().toISOString() });
    state.moves[id] = date;
  }
}

export function allSessions() {
  return state.plans.flatMap((p) => p.sessions.map((s) => ({ ...s, date: state.moves[s.id] || s.date, origDate: s.date })));
}

export function sessionById(id) {
  return allSessions().find((s) => s.id === id);
}

export function sessionsOn(date) {
  const order = { strength: 0, run: 1, swim: 2 };
  return allSessions().filter((s) => s.date === date).sort((a, b) => order[a.sport] - order[b.sport]);
}

export function logForSession(id) {
  return state.logs.find((l) => l.sessionId === id);
}

export function currentWeek(plan, date) {
  const past = plan.sessions.filter((s) => (state.moves[s.id] || s.date) <= date);
  if (!past.length) return plan.sessions[0].week;
  return past.reduce((a, b) => (b.date > a.date ? b : a)).week;
}

export function nextSession(after) {
  return allSessions().filter((s) => s.date > after).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

export function raceInfo(date) {
  const plan = state.plans.filter((p) => p.raceDate && p.raceDate >= date).sort((a, b) => (a.raceDate < b.raceDate ? -1 : 1))[0];
  if (!plan) return null;
  const week = currentWeek(plan, date);
  return { plan, daysLeft: D.daysBetween(date, plan.raceDate), week, pct: Math.max(2, Math.round((week / plan.weeks) * 100)) };
}

// Trainingen van een sport rond vandaag, om uit te kiezen bij het loggen
export function sessionsAround(sport, date, before = 7, after = 7) {
  const from = D.addDays(date, -before);
  const to = D.addDays(date, after);
  return allSessions().filter((s) => s.sport === sport && s.date >= from && s.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Beste standaardkeuze: vandaag, anders de dichtstbijzijnde nog niet gelogde
export function defaultSession(sport, date) {
  const list = sessionsAround(sport, date, 3, 6).filter((s) => !logForSession(s.id) && !s.race);
  const todays = list.find((s) => s.date === date);
  if (todays) return todays;
  const recent = list.filter((s) => s.date < date).pop();
  const upcoming = list.find((s) => s.date > date);
  return recent || upcoming || null;
}
