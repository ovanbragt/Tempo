// Opslag op de telefoon zelf (IndexedDB). Niets gaat naar internet.
import { STRENGTH_HISTORY } from './data.js';

const DB_NAME = 'tempo';
const DB_VERSION = 2;
export const STORES = ['logs', 'moves', 'measurements', 'settings', 'plans'];

let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
  }));
}

export const db = {
  all: (store) => run(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => run(store, 'readonly', (s) => s.get(id)),
  put: (store, value) => run(store, 'readwrite', (s) => s.put(value)),
  remove: (store, id) => run(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => run(store, 'readwrite', (s) => s.clear()),
};

// Eerste keer openen: eerdere krachttrainingen uit de spreadsheet inladen.
export async function seedOnce() {
  const flag = await db.get('settings', 'seeded');
  if (flag) return;
  for (const h of STRENGTH_HISTORY) {
    await db.put('logs', { ...h, sport: 'strength', source: 'spreadsheet' });
  }
  await db.put('settings', { id: 'seeded', value: true, at: new Date().toISOString() });
}

// Vraag de browser om de gegevens niet zomaar op te ruimen.
export async function askPersistent() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch (e) { /* niet ondersteund: geen probleem */ }
}
