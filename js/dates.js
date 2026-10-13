// Datums als 'JJJJ-MM-DD'-tekst in lokale tijd, zodat er nooit tijdzoneverschuivingen ontstaan.

export function parse(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  return iso(new Date());
}

export function addDays(isoDate, n) {
  const d = parse(isoDate);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function daysBetween(a, b) {
  return Math.round((parse(b) - parse(a)) / 86400000);
}

// Maandag = 0 ... zondag = 6
export function weekdayIndex(isoDate) {
  return (parse(isoDate).getDay() + 6) % 7;
}

export function mondayOf(isoDate) {
  return addDays(isoDate, -weekdayIndex(isoDate));
}

export const WD_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
export const WD_LONG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
export const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function longLabel(isoDate) {
  const d = parse(isoDate);
  const wd = WD_LONG[weekdayIndex(isoDate)];
  return `${wd[0].toUpperCase()}${wd.slice(1)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function shortLabel(isoDate) {
  const d = parse(isoDate);
  return `${WD_SHORT[weekdayIndex(isoDate)].toLowerCase()} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function dayMonth(isoDate) {
  const d = parse(isoDate);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
