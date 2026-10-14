// Instellingen: back-up maken en terugzetten, lengte.
import { db, STORES } from './db.js';
import { state, loadState, saveSetting } from './plan.js';
import * as D from './dates.js';
import { esc, num, toast, icon } from './ui.js';

export const APP_VERSION = '1.0';

async function exportData() {
  const data = {};
  for (const s of STORES) data[s] = await db.all(s);
  data.settings = data.settings.filter((x) => !String(x.id).startsWith('draft-'));
  const payload = { app: 'tempo', format: 1, version: APP_VERSION, exportedAt: new Date().toISOString(), data };
  const name = `tempo-backup-${D.today()}.json`;
  const file = new File([JSON.stringify(payload, null, 1)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e.name === 'AbortError') return false;
      throw e;
    }
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  await saveSetting('lastBackup', D.today());
  return true;
}

async function importData(file) {
  const text = await file.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('Dit is geen Tempo-back-up.'); }
  if (!payload || payload.app !== 'tempo' || !payload.data) throw new Error('Dit is geen Tempo-back-up.');
  const d = payload.data;
  const counts = `${(d.logs || []).length} trainingen en ${(d.measurements || []).length} metingen`;
  if (!confirm(`Back-up van ${D.shortLabel(payload.exportedAt.slice(0, 10))} terugzetten (${counts})?\n\nDit vervangt alle gegevens die nu in Tempo staan.`)) return false;
  for (const s of STORES) {
    await db.clear(s);
    for (const item of d[s] || []) await db.put(s, item);
  }
  await loadState();
  return counts;
}

export function backupDue() {
  const last = state.settings.lastBackup;
  const hasData = state.logs.some((l) => l.source !== 'spreadsheet') || state.measurements.length;
  return hasData && (!last || D.daysBetween(last, D.today()) >= 14);
}

export function viewSettings() {
  const last = state.settings.lastBackup;
  const ownLogs = state.logs.filter((l) => l.source !== 'spreadsheet').length;
  const html = `<main class="page">
    <header class="page-head"><h1 class="display xl">Instellingen</h1></header>

    <section class="card form">
      <h2 class="h2">Back-up</h2>
      <p class="small">Je gegevens staan alleen op deze telefoon: ${ownLogs} trainingen, ${state.measurements.length} metingen en ${state.plans.filter((p) => p.custom).length} eigen schema's. Maak af en toe een back-up en bewaar die bijvoorbeeld in je Google Drive of in Bestanden.</p>
      <div class="readout"><span>LAATSTE BACK-UP</span><strong>${last ? esc(D.shortLabel(last)) : 'nog nooit'}</strong></div>
      <button type="button" class="btn" style="background:var(--ink)" data-export>${icon('share', 20)} Back-up maken</button>
      <label class="btn-outline file-btn">Back-up terugzetten<input type="file" data-import hidden></label>
      <p class="muted small">Bij "Back-up maken" opent je telefoon het deelmenu. Kies <strong>Bewaar in Bestanden</strong> of <strong>Drive</strong>. Terugzetten vervangt alles wat nu in Tempo staat.</p>
    </section>

    <section class="card form">
      <h2 class="h2">Persoonlijk</h2>
      <label class="field"><span>LENGTE (CM), VOOR JE BMI</span><input class="in" name="height" inputmode="numeric" value="${state.settings.height ? esc(state.settings.height) : ''}" placeholder="bijv. 182"></label>
      <div class="grid2">
        <label class="field"><span>GEBOORTEDATUM</span><input class="in" type="date" name="birthDate" value="${esc(state.settings.birthDate || '')}" max="${D.today()}"></label>
        <label class="field"><span>GESLACHT</span><select name="sex"><option value="">Kies…</option><option value="man"${state.settings.sex === 'man' ? ' selected' : ''}>Man</option><option value="vrouw"${state.settings.sex === 'vrouw' ? ' selected' : ''}>Vrouw</option></select></label>
      </div>
      <p class="muted small">Geboortedatum en geslacht zijn nodig voor je fitnessleeftijd: je VO2 Max wordt vergeleken met het gemiddelde van leeftijdsgenoten. Alles blijft op deze telefoon.</p>
      <button type="button" class="btn-outline" data-personal>Opslaan</button>
    </section>

    <section class="card">
      <h2 class="h2">Over Tempo</h2>
      <p class="muted small">Versie ${APP_VERSION}. Werkt ook zonder internet. Updates komen vanzelf binnen als je de app opent met internet.</p>
    </section>
  </main>`;

  function mount(root, rerender) {
    root.addEventListener('click', async (e) => {
      if (e.target.closest('[data-export]')) {
        try {
          const ok = await exportData();
          if (ok) { toast('Back-up gemaakt'); rerender(); }
        } catch (err) { toast('Back-up maken lukte niet. Probeer het opnieuw.', 'warn'); }
      }
      if (e.target.closest('[data-personal]')) {
        const hv = root.querySelector('[name="height"]').value.trim();
        const h = num(hv);
        if (hv && (!h || h < 100 || h > 250)) { toast('Vul je lengte in centimeters in, bijv. 182.', 'warn'); return; }
        if (h) await saveSetting('height', h);
        await saveSetting('birthDate', root.querySelector('[name="birthDate"]').value || null);
        await saveSetting('sex', root.querySelector('[name="sex"]').value || null);
        toast('Opgeslagen');
        if (location.hash.includes('terug=progressie')) location.hash = '#/progressie';
      }
    });
    root.querySelector('[data-import]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const res = await importData(file);
        if (res) { toast(`Teruggezet: ${res}`); rerender(); }
      } catch (err) { toast(err.message || 'Terugzetten lukte niet.', 'warn'); } finally { e.target.value = ''; }
    });
  }
  return { html, mount };
}
