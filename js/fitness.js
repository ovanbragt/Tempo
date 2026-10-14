// Fitnessleeftijd: de leeftijd waarop jouw VO2 Max gemiddeld is voor je geslacht.
// Normwaarden: HUNT3 Fitness Study (Loe et al., PLoS ONE 2013), tabel 4, gemiddelde VO2peak (ml/kg/min)
// per leeftijdsgroep; hier op het midden van elke groep gezet (20–29 → 25, … , 70+ → 75).
import * as D from './dates.js';

export const NORMS = {
  man: [[25, 54.0], [35, 48.6], [45, 46.6], [55, 41.9], [65, 38.4], [75, 34.2]],
  vrouw: [[25, 42.8], [35, 39.6], [45, 37.8], [55, 33.7], [65, 30.5], [75, 26.8]],
};

const lerp = (x, [x0, y0], [x1, y1]) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);

// Gemiddelde VO2 Max op een leeftijd
export function normAt(age, sex) {
  const n = NORMS[sex];
  if (!n || age == null) return null;
  if (age <= n[0][0]) return lerp(age, n[0], n[1]);
  for (let i = 0; i < n.length - 1; i++) if (age <= n[i + 1][0]) return lerp(age, n[i], n[i + 1]);
  return lerp(age, n[n.length - 2], n[n.length - 1]);
}

// Leeftijd waarop jouw VO2 Max het gemiddelde is (tussen 20 en 90)
export function fitnessAge(vo2, sex) {
  const n = NORMS[sex];
  if (!n || !vo2) return null;
  const inv = (a, b) => a[0] + ((b[0] - a[0]) * (vo2 - a[1])) / (b[1] - a[1]);
  let age;
  if (vo2 >= n[0][1]) age = inv(n[0], n[1]);
  else if (vo2 <= n[n.length - 1][1]) age = inv(n[n.length - 2], n[n.length - 1]);
  else {
    for (let i = 0; i < n.length - 1; i++) {
      if (vo2 <= n[i][1] && vo2 >= n[i + 1][1]) { age = inv(n[i], n[i + 1]); break; }
    }
  }
  return Math.min(90, Math.max(20, Math.round(age)));
}

export function ageOn(birthDate, date) {
  if (!birthDate) return null;
  const b = D.parse(birthDate); const d = D.parse(date);
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  return a;
}

// Buikomvang: WHO-grenzen voor verhoogd risico (Europese volwassenen)
export const WAIST_LIMIT = { man: 94, vrouw: 80 };
