// Health Command Center — storage layer (IndexedDB, local-first)
// Step 1 of PROTOTYPE_BUILD.md: schema, models, CRUD, auto-change-event hook.
// Plain ES module, dynamically imported by the DC logic class. No backend, no network.

export const DB_NAME = 'hcc';
export const DB_VERSION = 1;

// All object stores keyed by `id`. Every record also carries createdAt/updatedAt/eventDate/notes.
export const STORES = [
  'userSettings',
  'medicationProfiles',
  'medicationDailyLogs',
  'medicationChangeEvents',
  'symptomDefinitions',
  'dailyCheckIns',
  'symptomEpisodes',
  'doctorNotes',
  'stressEvents',
  'insights',
  'backupMetadata',
];

// ---------- low-level store (IndexedDB, with in-memory fallback) ----------
// Some sandboxed preview iframes run on an opaque origin where indexedDB.open
// throws or is null. In that case we transparently fall back to an in-memory
// store so the prototype always runs (data persists for the session).
let _dbPromise = null;
let USE_MEM = false;
const MEM = {};
function ensureMem() {
  if (MEM._init) return;
  for (const s of STORES) MEM[s] = new Map();
  MEM._init = true;
}

export function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve) => {
    let req;
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) throw new Error('no indexedDB');
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      USE_MEM = true; ensureMem(); resolve(null); return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          if (name !== 'userSettings' && name !== 'backupMetadata') {
            store.createIndex('eventDate', 'eventDate', { unique: false });
          }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { USE_MEM = true; ensureMem(); resolve(null); };
    req.onblocked = () => { USE_MEM = true; ensureMem(); resolve(null); };
  });
  return _dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

export async function put(store, record) {
  const db = await openDB();
  if (USE_MEM || !db) { ensureMem(); MEM[store].set(record.id, record); return record; }
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function bulkPut(store, records) {
  const db = await openDB();
  if (USE_MEM || !db) { ensureMem(); for (const r of records) MEM[store].set(r.id, r); return records.length; }
  return new Promise((resolve, reject) => {
    const os = tx(db, store, 'readwrite');
    for (const r of records) os.put(r);
    os.transaction.oncomplete = () => resolve(records.length);
    os.transaction.onerror = () => reject(os.transaction.error);
  });
}

export async function get(store, id) {
  const db = await openDB();
  if (USE_MEM || !db) { ensureMem(); return MEM[store].get(id) || null; }
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await openDB();
  if (USE_MEM || !db) { ensureMem(); return [...MEM[store].values()]; }
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readonly').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(store, id) {
  const db = await openDB();
  if (USE_MEM || !db) { ensureMem(); MEM[store].delete(id); return true; }
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(store) {
  const db = await openDB();
  if (USE_MEM || !db) { ensureMem(); MEM[store].clear(); return true; }
  return new Promise((resolve, reject) => {
    const req = tx(db, store, 'readwrite').clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function wipeAll() {
  for (const s of STORES) await clearStore(s);
}

// ---------- helpers ----------
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowISO() { return new Date().toISOString(); }

// Stamp a new record with system fields.
export function stamp(partial, eventDate) {
  const now = nowISO();
  return {
    id: partial.id || uuid(),
    createdAt: partial.createdAt || now,
    updatedAt: now,
    eventDate: eventDate || partial.eventDate || todayISO(),
    notes: partial.notes ?? null,
    ...partial,
  };
}

// ---------- domain writers ----------

// Fields on a MedicationProfile that, when changed, spawn a MedicationChangeEvent.
const TRACKED_MED_FIELDS = ['dose', 'schedule', 'timing', 'frequency', 'active'];

const CHANGE_TYPE_FOR = {
  dose: 'dose', schedule: 'schedule', timing: 'timing',
  frequency: 'frequency', active: 'status',
};

// Save a med profile. Any change to dose/schedule/timing/frequency/active
// auto-creates a MedicationChangeEvent (start/stop/dose/etc) — the core hook.
export async function saveMedicationProfile(next, opts = {}) {
  const prev = next.id ? await get('medicationProfiles', next.id) : null;
  const record = stamp({ ...(prev || {}), ...next, id: next.id || uuid() }, next.eventDate);
  await put('medicationProfiles', record);

  const events = [];
  if (!prev) {
    // First time we see this med → a "start" change event, dated at its
    // startDate override if provided (med may predate tracking).
    events.push(makeChangeEvent(record.id, 'start', null, describeMed(record),
      { ...opts, eventDate: record.startDate || opts.eventDate }));
  } else {
    for (const f of TRACKED_MED_FIELDS) {
      const a = prev[f];
      const b = record[f];
      if (a !== b && !(a == null && b == null)) {
        let changeType = CHANGE_TYPE_FOR[f];
        if (f === 'active') changeType = b ? 'restart' : 'stop';
        events.push(makeChangeEvent(record.id, changeType, fmt(a), fmt(b), opts));
      }
    }
  }
  for (const ev of events) await put('medicationChangeEvents', ev);

  // Start/end date overrides rewrite history rather than spawning generic events.
  if (prev && (record.startDate || null) !== (prev.startDate || null) && record.startDate) {
    const all = await getAll('medicationChangeEvents');
    const startEv = all.filter(e => e.medId === record.id && e.changeType === 'start')
      .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1))[0];
    if (startEv) {
      await put('medicationChangeEvents', { ...startEv, eventDate: record.startDate, updatedAt: nowISO() });
    } else {
      await put('medicationChangeEvents', makeChangeEvent(record.id, 'start', null, describeMed(record), { eventDate: record.startDate }));
    }
  }
  if ((record.endDate || null) !== (prev ? prev.endDate || null : null)) {
    const endId = `mce-end-${record.id}`;
    if (record.endDate) {
      await put('medicationChangeEvents', stamp({
        id: endId, medId: record.id, changeType: 'stop',
        prev: describeMed(record), next: 'Planned stop',
        reason: opts.reason ?? null, expectedImpact: null, symptomsToWatch: [],
      }, record.endDate));
    } else {
      await remove('medicationChangeEvents', endId);
    }
  }
  return { record, events };
}

function fmt(v) { return v == null ? null : String(v); }
function describeMed(m) { return [m.dose, m.frequency].filter(Boolean).join(' · '); }

function makeChangeEvent(medId, changeType, prev, next, opts = {}) {
  return stamp({
    medId,
    changeType,            // start | stop | restart | dose | schedule | timing | frequency
    prev,
    next,
    reason: opts.reason ?? null,
    expectedImpact: opts.expectedImpact ?? null,
    symptomsToWatch: opts.symptomsToWatch ?? [],
  }, opts.eventDate);
}

// Log a scheduled med for a day (Taken / Late / Skipped / Missed).
export async function setMedDailyStatus({ medId, eventDate, status, scheduledTime, takenTime }) {
  const id = `mdl-${medId}-${eventDate}`;   // deterministic: one status per med per day
  const existing = await get('medicationDailyLogs', id);
  const rec = stamp({
    ...(existing || {}),
    id, medId, status, isPrn: false,
    scheduledTime: scheduledTime ?? existing?.scheduledTime ?? null,
    takenTime: takenTime ?? (status === 'skipped' ? null : nowISO()),
  }, eventDate);
  return put('medicationDailyLogs', rec);
}

// Log a PRN (as-needed) dose with context. `quantity` = number of doses taken at once.
export async function logPrnDose({ medId, eventDate, dose, quantity, time, reason, symptomBeforeId, severityBefore, severityAfter, notes }) {
  const rec = stamp({
    id: `prn-${medId}-${eventDate}-${uuid().slice(0, 5)}`,
    medId, status: 'prn', isPrn: true, dose: dose ?? null,
    quantity: quantity ?? 1,
    takenTime: time ?? nowISO(),
    reason: reason ?? null,
    symptomBeforeId: symptomBeforeId ?? null,
    severityBefore: severityBefore ?? null,
    severityAfter: severityAfter ?? null,
    notes: notes ?? null,
  }, eventDate);
  return put('medicationDailyLogs', rec);
}

// Save a daily check-in (upsert by date).
export async function saveCheckIn(checkIn) {
  const date = checkIn.eventDate || todayISO();
  const id = checkIn.id || `checkin-${date}`;
  const existing = await get('dailyCheckIns', id);
  const rec = stamp({ ...(existing || {}), ...checkIn, id }, date);
  return put('dailyCheckIns', rec);
}

// Save a symptom / side-effect episode (unified flow). If a PRN med "what helped"
// is selected, an auto-linked PRN dose is also written.
export async function saveEpisode(ep) {
  const rec = stamp({
    symptomId: ep.symptomId,
    symptomName: ep.symptomName ?? null,
    severity: ep.severity ?? null,          // 0–10
    time: ep.time ?? nowISO(),
    when: ep.when ?? null,                   // 'now' | 'earlier' | 'lastNight' ...
    durationMin: ep.durationMin ?? null,
    trigger: ep.trigger ?? null,
    whatHelped: ep.whatHelped ?? [],
    relatedMedicationIds: ep.relatedMedicationIds ?? [],
    suspectedMedId: ep.suspectedMedId ?? null,
    confidence: ep.confidence ?? null,       // unsure | possible | likely
    context: ep.context ?? [],               // ['poorSleep','skippedMeal',...]
    retro: ep.retro ?? false,
  }, ep.eventDate);
  await put('symptomEpisodes', rec);

  // Auto-log a linked PRN dose if a PRN med was chosen under "what helped".
  if (ep.prnMedId) {
    await logPrnDose({
      medId: ep.prnMedId,
      eventDate: rec.eventDate,
      dose: ep.prnDose ?? null,
      reason: rec.symptomName || 'symptom',
      symptomBeforeId: rec.symptomId,
      severityBefore: rec.severity,
    });
    if (!rec.relatedMedicationIds.includes(ep.prnMedId)) {
      rec.relatedMedicationIds.push(ep.prnMedId);
      await put('symptomEpisodes', rec);
    }
  }
  return rec;
}

export async function saveStressEvent(ev) {
  return put('stressEvents', stamp({ intensity: ev.intensity ?? null, label: ev.label ?? null, ...ev }, ev.eventDate));
}

// ---------- settings ----------
export const DEFAULT_SETTINGS = {
  id: 'settings',
  displayName: 'Alex',
  displayAvatar: null,          // dataURL of uploaded profile picture
  dayBoundaryHour: 4,
  proteinThresholdG: 50,
  analysisRangeDays: 90,
  pinLockEnabled: false,
  sampleDataLoaded: false,
  // Which wizard steps exist, their display names, and on/off state.
  checkInSteps: [
    { key: 'sleep', name: 'Sleep', enabled: true },
    { key: 'feeling', name: 'Feeling', enabled: true },
    { key: 'body', name: 'Body', enabled: true },
    { key: 'cognition', name: 'Cognition', enabled: true },
    { key: 'food', name: 'Food & Fuel', enabled: true },
    { key: 'meds', name: 'Meds', enabled: true },
  ],
  // Editable "what helped" options; cats = which symptom categories they show for ('all' = every).
  // Fresh installs start BLANK — the onboarding wizard suggests options, the user adds one by one.
  whatHelped: [],
  // Editable context tags; key is the stable analysis id. Blank on fresh install.
  contexts: [],
};

// Prefilled lists used by sample data (and surfaced as onboarding suggestions).
export const SAMPLE_WHAT_HELPED = [
  { id: 'wh1', label: 'Breathing', cats: ['mood'] },
  { id: 'wh2', label: 'Rest', cats: ['all'] },
  { id: 'wh3', label: 'Cold water', cats: ['mood', 'body'] },
  { id: 'wh4', label: 'Walk', cats: ['mood', 'body'] },
  { id: 'wh5', label: 'Ate something', cats: ['gi', 'mood'] },
  { id: 'wh6', label: 'Antacid', cats: ['gi'] },
  { id: 'wh7', label: 'Lie down', cats: ['body', 'cognition'] },
];
export const SAMPLE_CONTEXTS = [
  { id: 'cx1', label: 'Poor sleep', key: 'poorSleep', cats: ['all'] },
  { id: 'cx2', label: 'Skipped meal', key: 'skippedMeal', cats: ['all'] },
  { id: 'cx3', label: 'Stress / conflict', key: 'stress', cats: ['all'] },
  { id: 'cx4', label: 'Caffeine late', key: 'caffeine', cats: ['all'] },
  { id: 'cx5', label: 'Dairy', key: 'dairy', cats: ['gi'] },
  { id: 'cx6', label: 'Gluten', key: 'gluten', cats: ['gi'] },
  { id: 'cx7', label: 'Alcohol', key: 'alcohol', cats: ['all'] },
];

export async function getSettings() {
  const s = await get('userSettings', 'settings');
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export async function saveSettings(patch) {
  const cur = await getSettings();
  const next = stamp({ ...cur, ...patch, id: 'settings' });
  await put('userSettings', next);
  return next;
}

// ---------- symptom definition CRUD ----------
export async function saveSymptomDefinition(next) {
  const prev = next.id ? await get('symptomDefinitions', next.id) : null;
  const key = next.key || (prev && prev.key) || ('c' + uuid().slice(0, 6));
  const rec = stamp({
    archived: false, pinned: false, appearsInCheckIn: true,
    trackingStyle: 'both', askAs: 'scale', control: 'scale', color: '#8E7CF3',
    ...(prev || {}), ...next, key, id: next.id || `sym-${key}`,
  });
  await put('symptomDefinitions', rec);
  return rec;
}
export async function deleteSymptomDefinition(id) { return remove('symptomDefinitions', id); }
export async function deleteMedicationProfile(id) { return remove('medicationProfiles', id); }
