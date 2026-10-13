// Garmin-bestanden inlezen, helemaal op de telefoon zelf.
// Ondersteunt .fit (het originele activiteitbestand) en .zip (zoals Garmin Connect het exporteert).

const FIT_EPOCH = 631065600; // 31-12-1989 00:00 UTC in Unix-seconden

// ---------- ZIP uitpakken ----------
async function unzipFirstFit(buf) {
  const v = new DataView(buf);
  // Zoek het einde van de centrale map
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Dit zip-bestand kan ik niet lezen.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOff = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.fit$/i.test(name)) continue;
    const lNameLen = v.getUint16(localOff + 26, true);
    const lExtraLen = v.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const data = new Uint8Array(buf, start, compSize);
    if (method === 0) return data.slice().buffer;
    if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Deze browser kan geen zip uitpakken. Gebruik het .fit-bestand.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).arrayBuffer();
    }
    throw new Error('Onbekende zip-compressie.');
  }
  throw new Error('Geen .fit-bestand gevonden in de zip.');
}

// ---------- FIT lezen ----------
const BASE = {
  0x00: [1, 'u8'], 0x01: [1, 's8'], 0x02: [1, 'u8'], 0x83: [2, 's16'], 0x84: [2, 'u16'], 0x85: [4, 's32'], 0x86: [4, 'u32'],
  0x07: [1, 'str'], 0x88: [4, 'f32'], 0x89: [8, 'f64'], 0x0a: [1, 'u8'], 0x8b: [2, 'u16'], 0x8c: [4, 'u32'], 0x0d: [1, 'u8'],
  0x8e: [8, 's64'], 0x8f: [8, 'u64'], 0x90: [8, 'u64'],
};
const INVALID = { u8: 0xff, s8: 0x7f, u16: 0xffff, s16: 0x7fff, u32: 0xffffffff, s32: 0x7fffffff };

function readValue(v, off, size, baseType, le) {
  const [bsize, kind] = BASE[baseType] || [1, 'u8'];
  if (size !== bsize || kind === 'str' || kind.endsWith('64')) return null; // reeksen, tekst en 64-bit slaan we over
  let val;
  switch (kind) {
    case 'u8': val = v.getUint8(off); break;
    case 's8': val = v.getInt8(off); break;
    case 'u16': val = v.getUint16(off, le); break;
    case 's16': val = v.getInt16(off, le); break;
    case 'u32': val = v.getUint32(off, le); break;
    case 's32': val = v.getInt32(off, le); break;
    case 'f32': val = v.getFloat32(off, le); return Number.isFinite(val) ? val : null;
    case 'f64': val = v.getFloat64(off, le); return Number.isFinite(val) ? val : null;
    default: return null;
  }
  if (baseType === 0x0a || baseType === 0x8b || baseType === 0x8c) return val === 0 ? null : val; // 'z'-typen: 0 = ongeldig
  return val === INVALID[kind] ? null : val;
}

export function parseFit(buf) {
  const v = new DataView(buf);
  const headerSize = v.getUint8(0);
  const dataSize = v.getUint32(4, true);
  const magic = String.fromCharCode(v.getUint8(8), v.getUint8(9), v.getUint8(10), v.getUint8(11));
  if (magic !== '.FIT') throw new Error('Dit is geen Garmin .fit-bestand.');
  const end = Math.min(headerSize + dataSize, buf.byteLength);
  const defs = {};
  const msgs = { session: [], lap: [], length: [] };
  const WANT = { 18: 'session', 19: 'lap', 101: 'length' };
  let p = headerSize;
  let lastTs = 0;
  while (p < end) {
    const h = v.getUint8(p++);
    if (h & 0x80) {
      // compacte tijdstempel-kop: datamelding
      const local = (h >> 5) & 0x03;
      const offset = h & 0x1f;
      lastTs = (lastTs & ~0x1f) + offset + (offset < (lastTs & 0x1f) ? 0x20 : 0);
      p = readData(local, { 253: lastTs });
      continue;
    }
    const local = h & 0x0f;
    if (h & 0x40) {
      const dev = h & 0x20;
      const le = v.getUint8(p + 1) === 0;
      const global = v.getUint16(p + 2, le);
      const n = v.getUint8(p + 4);
      p += 5;
      const fields = [];
      for (let i = 0; i < n; i++) { fields.push([v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2)]); p += 3; }
      let devSize = 0;
      if (dev) { const nd = v.getUint8(p++); for (let i = 0; i < nd; i++) { devSize += v.getUint8(p + 1); p += 3; } }
      defs[local] = { le, global, fields, devSize };
    } else {
      p = readData(local, null);
    }
  }

  function readData(local, extra) {
    const d = defs[local];
    if (!d) throw new Error('Het bestand lijkt beschadigd.');
    let q = p;
    const rec = {};
    for (const [num, size, type] of d.fields) {
      rec[num] = readValue(v, q, size, type, d.le);
      q += size;
    }
    q += d.devSize;
    if (rec[253] != null) lastTs = rec[253];
    if (extra) Object.assign(rec, extra);
    const name = WANT[d.global];
    if (name) msgs[name].push(rec);
    return q;
  }

  const s = msgs.session[0];
  if (!s) throw new Error('Geen activiteit gevonden in dit bestand.');
  const toDate = (t) => (t != null ? new Date((t + FIT_EPOCH) * 1000) : null);
  const sportCode = s[5];
  return {
    sport: sportCode === 1 ? 'run' : sportCode === 5 ? 'swim' : 'other',
    sportCode,
    start: toDate(s[2] ?? s[253]),
    distanceM: s[9] != null ? s[9] / 100 : null,
    durationSec: s[8] != null ? s[8] / 1000 : s[7] != null ? s[7] / 1000 : null,
    avgHr: s[16],
    poolLength: s[44] != null ? s[44] / 100 : null,
    lengths: s[33] ?? (msgs.length.length || null),
    laps: msgs.lap.map((l) => ({
      distanceM: l[9] != null ? l[9] / 100 : null,
      durationSec: l[8] != null ? l[8] / 1000 : l[7] != null ? l[7] / 1000 : null,
      avgHr: l[15],
    })),
  };
}

export async function readGarminFile(file) {
  let buf = await file.arrayBuffer();
  const head = new DataView(buf);
  if (buf.byteLength > 4 && head.getUint32(0, true) === 0x04034b50) buf = await unzipFirstFit(buf);
  return parseFit(buf);
}

// Rondes die bij de herhalingen horen (bijv. 6 × 400 m), op volgorde
export function matchIntervalLaps(laps, repDist, count) {
  const hits = laps.filter((l) => l.distanceM && Math.abs(l.distanceM - repDist) <= repDist * 0.15 && l.durationSec);
  return hits.slice(0, count).map((l) => l.durationSec);
}
