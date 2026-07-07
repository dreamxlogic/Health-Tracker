// Health Command Center — seed data generator.
// ~75 days of realistic sample data engineered so every insight type can fire.
// Reflects the user's real regimen and symptom set.

import { bulkPut, put, stamp, uuid, todayISO, clearStore, saveSettings, SAMPLE_WHAT_HELPED, SAMPLE_CONTEXTS } from './db.js';

const DAYS = 75;
const DOSE_CHANGE_DAY = 40;   // Wellbutrin 150 -> 300

// tiny seeded PRNG (mulberry32) so the same story appears each load
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20260703);
const rand = () => R();
const chance = (p) => R() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;

function dateNDaysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// ---------- medications (user's real list) ----------
export const SEED_MEDS = [
  { key: 'wellbutrin', name: 'Wellbutrin XL', dose: '300 mg', startDose: '150 mg', frequency: 'once daily', timing: '08:00',
    form: 'Tablet', purpose: 'Depression', color: '#F9C9A8', category: 'meds', prn: false, weekly: false,
    watchlist: ['nightSweats', 'anxiety', 'hotFlashes'] },
  { key: 'caplyta', name: 'Caplyta', dose: '42 mg', frequency: 'nightly', timing: '21:00',
    form: 'Capsule', purpose: 'Mood stability', color: '#C9BDF6', category: 'symptoms', prn: false, weekly: false,
    watchlist: ['energy'] },
  { key: 'buspirone', name: 'Buspirone', dose: '15 mg', frequency: 'nightly', timing: '21:00',
    form: 'Tablet', purpose: 'Anxiety', color: '#AEDFC4', category: 'symptoms', prn: false, weekly: false,
    watchlist: ['dizziness', 'hotFlashes'] },
  { key: 'xanax', name: 'Xanax', dose: '0.5 mg', frequency: 'as needed', timing: null,
    form: 'Tablet', purpose: 'Panic / acute anxiety', color: '#F3B3C0', category: 'alerts', prn: true, weekly: false,
    watchlist: [] },
  { key: 'lunesta', name: 'Lunesta', dose: '3 mg', frequency: 'as needed (sleep)', timing: null,
    form: 'Tablet', purpose: 'Sleep', color: '#B4D2F3', category: 'notes', prn: true, weekly: false,
    watchlist: ['vividDreams'] },
  { key: 'wegovy', name: 'Wegovy', dose: '1 mg', frequency: 'weekly / biweekly', timing: null,
    form: 'Injection', purpose: 'Weight / appetite', color: '#F6C6A8', category: 'meds', prn: false, weekly: true,
    watchlist: ['gi', 'appetite'] },
  { key: 'zofran', name: 'Zofran', dose: '4 mg', frequency: 'as needed', timing: null,
    form: 'Tablet', purpose: 'Nausea', color: '#E9B0D0', category: 'alerts', prn: true, weekly: false,
    watchlist: [] },
];

// ---------- symptoms ----------
// control: scale | face | seg3 | toggle | toggleSev
export const SEED_SYMPTOMS = [
  // Sleep
  { key: 'sleepQuality', name: 'Sleep quality', category: 'sleep', color: '#8E7CF3', pinned: true, control: 'scale', step: 'sleep' },
  { key: 'vividDreams', name: 'Vivid dreams', category: 'sleep', color: '#8E7CF3', pinned: false, control: 'toggle', step: 'sleep' },
  { key: 'nightSweats', name: 'Night sweats', category: 'sleep', color: '#F1B04C', pinned: true, control: 'toggleSev', step: 'sleep' },
  // Feeling
  { key: 'mood', name: 'Mood', category: 'mood', color: '#8E7CF3', pinned: true, control: 'face', step: 'feeling' },
  { key: 'energy', name: 'Energy', category: 'mood', color: '#7BC894', pinned: true, control: 'scale', step: 'feeling' },
  { key: 'anxiety', name: 'Anxiety', category: 'mood', color: '#F1B04C', pinned: true, control: 'seg3', step: 'feeling' },
  { key: 'stress', name: 'Stress today', category: 'mood', color: '#E9695E', pinned: true, control: 'toggle', step: 'feeling' },
  { key: 'panic', name: 'Panic', category: 'mood', color: '#E9695E', pinned: true, control: 'toggle', step: 'feeling' },
  { key: 'irritability', name: 'Irritability', category: 'mood', color: '#E9897E', pinned: false, control: 'toggleSev', step: 'feeling' },
  // Body / GI
  { key: 'stomachPain', name: 'Stomach pain', category: 'gi', color: '#F1B04C', pinned: false, control: 'toggleSev', step: 'body' },
  { key: 'ibsFlare', name: 'IBS flare-up', category: 'gi', color: '#E9695E', pinned: false, control: 'toggleSev', step: 'body' },
  { key: 'heartburn', name: 'Heartburn', category: 'gi', color: '#F1893D', pinned: false, control: 'toggleSev', step: 'body' },
  { key: 'acidReflux', name: 'Acid reflux', category: 'gi', color: '#F1893D', pinned: false, control: 'toggleSev', step: 'body' },
  { key: 'dizziness', name: 'Dizziness', category: 'body', color: '#6A57C9', pinned: false, control: 'toggleSev', step: 'body' },
  { key: 'hotFlashes', name: 'Hot flashes', category: 'body', color: '#E9695E', pinned: true, control: 'toggleSev', step: 'body' },
  // Cognition
  { key: 'memory', name: 'Memory', category: 'cognition', color: '#6A57C9', pinned: true, control: 'scale', step: 'cognition' },
  { key: 'wordRecall', name: 'Word recall', category: 'cognition', color: '#6A57C9', pinned: false, control: 'scale', step: 'cognition' },
  { key: 'speech', name: 'Speech', category: 'cognition', color: '#6A57C9', pinned: false, control: 'scale', step: 'cognition' },
  // Food
  { key: 'appetite', name: 'Appetite', category: 'body', color: '#7BC894', pinned: false, control: 'scale', step: 'food' },
];

// ---------- generator ----------
export async function loadSampleData() {
  for (const s of ['medicationProfiles', 'medicationDailyLogs', 'medicationChangeEvents',
    'symptomDefinitions', 'dailyCheckIns', 'symptomEpisodes', 'stressEvents', 'doctorNotes', 'insights']) {
    await clearStore(s);
  }

  // --- symptom definitions ---
  const symById = {};
  const symDefs = SEED_SYMPTOMS.map((s) => {
    const rec = stamp({
      id: `sym-${s.key}`, key: s.key, name: s.name, category: s.category, color: s.color,
      pinned: s.pinned, archived: false,
      trackingStyle: s.control === 'toggle' || s.control === 'toggleSev' ? 'both' : 'daily',
      askAs: s.control === 'toggle' || s.control === 'toggleSev' ? 'toggle' : 'scale',
      control: s.control, appearsInCheckIn: true, checkInStep: s.step,
    }, todayISO());
    symById[s.key] = rec.id;
    return rec;
  });
  await bulkPut('symptomDefinitions', symDefs);

  // --- medication profiles + change events ---
  const medById = {};
  const medProfiles = [];
  const changeEvents = [];
  for (const m of SEED_MEDS) {
    const startDate = todayISO(dateNDaysAgo(DAYS));
    const id = `med-${m.key}`;
    medById[m.key] = id;
    medProfiles.push(stamp({
      id, name: m.name, dose: m.dose, frequency: m.frequency, timing: m.timing, form: m.form,
      purpose: m.purpose, color: m.color, category: m.category, prn: m.prn, weekly: !!m.weekly,
      active: true, watchlist: m.watchlist, startedDate: startDate,
    }, startDate));
    changeEvents.push(stamp({
      medId: id, changeType: 'start', prev: null,
      next: `${m.startDose || m.dose} · ${m.frequency}`, reason: null, expectedImpact: null,
      symptomsToWatch: m.watchlist,
    }, startDate));
  }
  // Wellbutrin dose change 150 -> 300 at day 40
  const changeDate = todayISO(dateNDaysAgo(DAYS - DOSE_CHANGE_DAY));
  changeEvents.push(stamp({
    medId: medById.wellbutrin, changeType: 'dose', prev: '150 mg', next: '300 mg',
    reason: 'Partial response, psychiatrist increased dose',
    expectedImpact: 'Mood lift over 2–3 weeks; watch for activation & hot flashes',
    symptomsToWatch: ['nightSweats', 'anxiety', 'hotFlashes'],
  }, changeDate));
  await bulkPut('medicationProfiles', medProfiles);
  await bulkPut('medicationChangeEvents', changeEvents);

  // --- daily rows ---
  const checkIns = [];
  const medLogs = [];
  const episodes = [];
  const stressEvents = [];
  let prevSleepHours = 7;

  for (let i = 0; i < DAYS; i++) {
    const day = DAYS - 1 - i;
    const date = todayISO(dateNDaysAgo(day));
    const afterChange = i >= DOSE_CHANGE_DAY;
    const prevShort = prevSleepHours < 6;

    // sleep
    const shortNight = chance(0.32);
    const sleepHours = round1(shortNight ? 4.5 + rand() * 1.4 : 6.6 + rand() * 1.8);
    const wakeups = shortNight ? 1 + Math.floor(rand() * 3) : Math.floor(rand() * 2);
    const sleepQuality = clamp(Math.round((sleepHours - 3) * 1.4 + (rand() * 2 - 1)), 0, 10);

    // stress
    const stressToday = chance(0.18);
    if (stressToday) stressEvents.push(stamp({ intensity: clamp(Math.round(6.5 + rand() * 3 - 1.5), 0, 10), label: 'Stressful day', major: chance(0.25) }, date));

    // food / allergy trigger
    const skippedMeal = chance(0.22);
    const allergicFood = chance(0.2);   // dairy/gluten
    const proteinG = Math.round(skippedMeal ? 25 + rand() * 25 : 55 + rand() * 45);
    const appetite = clamp(Math.round(6 - (afterChange ? 1 : 0) + (rand() * 2 - 1)), 0, 10); // wegovy lowers appetite

    // cognition — memory dips after short sleep (insight)
    const memory = clamp(Math.round(7 - (prevShort ? 2.2 : 0) + (rand() * 2 - 1)), 0, 10);
    const wordRecall = clamp(Math.round(6.5 - (prevShort ? 1.6 : 0) + (rand() * 2 - 1)), 0, 10);
    const speech = clamp(Math.round(7 - (prevShort ? 0.8 : 0) + (rand() * 2 - 1)), 0, 10);

    // feeling
    const anxiety = clamp(Math.round(3 + (skippedMeal ? 1.8 : 0) + (stressToday ? 2.2 : 0) + (rand() * 2 - 1)), 0, 10);
    const mood = clamp(Math.round((afterChange ? 6.4 : 4.6) - (stressToday ? 1.5 : 0) + (rand() * 2 - 1)), 0, 10);
    const energy = clamp(Math.round(5 - (prevShort ? 1.5 : 0) + (rand() * 2 - 1)), 0, 10);

    // occurrences
    const vividDreams = chance(0.28);
    const nightSweats = chance(afterChange ? 0.42 : 0.10);
    const hotFlashes = chance(afterChange ? 0.35 : 0.08);
    const dizziness = chance(0.14);               // buspirone-related, some days
    const panic = stressToday ? chance(0.55) : chance(0.06);
    const irritability = chance(stressToday ? 0.5 : 0.12);
    const stomachPain = chance(allergicFood ? 0.5 : 0.08);
    const ibsFlare = chance(allergicFood ? 0.4 : 0.06);
    const heartburn = chance(allergicFood ? 0.4 : 0.1);
    const acidReflux = chance(allergicFood ? 0.35 : 0.08);

    const occurrences = { vividDreams, nightSweats, hotFlashes, dizziness, panic, irritability, stomachPain, ibsFlare, heartburn, acidReflux, stress: stressToday };
    const occurrenceSev = {};
    const sev = () => clamp(Math.round(4 + rand() * 4 - 1), 1, 10);
    for (const k of ['nightSweats', 'hotFlashes', 'dizziness', 'irritability', 'stomachPain', 'ibsFlare', 'heartburn', 'acidReflux']) if (occurrences[k]) occurrenceSev[k] = sev();

    checkIns.push(stamp({
      id: `checkin-${date}`,
      ratings: { sleepQuality, mood, anxiety, energy, memory, wordRecall, speech, appetite },
      occurrences, occurrenceSev,
      sleepHours, wakeups, proteinG,
      contextTags: [allergicFood ? (chance(0.5) ? 'dairy' : 'gluten') : null].filter(Boolean),
      completed: true, completedSteps: ['sleep', 'feeling', 'body', 'cognition', 'food', 'meds'],
    }, date));

    // scheduled med logs
    for (const key of ['wellbutrin', 'caplyta', 'buspirone']) {
      const roll = rand();
      const status = roll < 0.86 ? 'taken' : roll < 0.94 ? 'late' : roll < 0.98 ? 'skipped' : 'missed';
      const m = SEED_MEDS.find((x) => x.key === key);
      medLogs.push(stamp({
        id: `mdl-${medById[key]}-${date}`, medId: medById[key], status, isPrn: false,
        scheduledTime: m.timing, takenTime: (status === 'skipped' || status === 'missed') ? null : `${date}T${m.timing || '08:00'}:00`,
      }, date));
    }
    // Wegovy weekly (~ every 7 days)
    if (day % 7 === 0) medLogs.push(stamp({ id: `mdl-${medById.wegovy}-${date}`, medId: medById.wegovy, status: 'taken', isPrn: false, scheduledTime: null, takenTime: `${date}T09:00:00` }, date));

    // Night-sweat episodes
    if (nightSweats && chance(0.5)) {
      episodes.push(stamp({
        symptomId: symById.nightSweats, symptomName: 'Night sweats', severity: occurrenceSev.nightSweats || 5,
        time: `${date}T03:${10 + Math.floor(rand() * 40)}:00`, when: 'lastNight', durationMin: null, trigger: null, whatHelped: [],
        suspectedMedId: afterChange && chance(0.5) ? medById.wellbutrin : null, confidence: afterChange ? 'possible' : null,
        context: sleepQuality <= 4 ? ['poorSleep'] : [], relatedMedicationIds: [], retro: false,
      }, date));
    }
    // GI episodes on allergic-food days
    if (allergicFood && (stomachPain || ibsFlare) && chance(0.6)) {
      episodes.push(stamp({
        symptomId: symById.stomachPain, symptomName: ibsFlare ? 'IBS flare-up' : 'Stomach pain',
        severity: occurrenceSev.stomachPain || occurrenceSev.ibsFlare || 6,
        time: `${date}T13:${Math.floor(rand() * 59)}:00`, when: 'earlier', durationMin: 30 + Math.floor(rand() * 90),
        trigger: 'Food', whatHelped: chance(0.5) ? ['Antacid'] : [], suspectedMedId: null, confidence: null,
        context: [chance(0.5) ? 'dairy' : 'gluten'], relatedMedicationIds: [], retro: false,
      }, date));
    }
    // Panic -> Xanax PRN (auto-linked)
    if (panic) {
      const sevBefore = clamp(Math.round(6 + rand() * 3 - 1), 4, 10);
      const usedXanax = chance(0.7);
      episodes.push(stamp({
        symptomId: symById.panic, symptomName: 'Panic episode', severity: sevBefore,
        time: `${date}T${14 + Math.floor(rand() * 6)}:${Math.floor(rand() * 59)}:00`, when: 'earlier', durationMin: 10 + Math.floor(rand() * 25),
        trigger: stressToday ? 'Stress / conflict' : null, whatHelped: usedXanax ? ['Xanax'] : ['Breathing'],
        suspectedMedId: null, confidence: null,
        context: [stressToday ? 'stress' : null, skippedMeal ? 'skippedMeal' : null].filter(Boolean),
        relatedMedicationIds: usedXanax ? [medById.xanax] : [], retro: false,
      }, date));
      if (usedXanax) medLogs.push(stamp({
        id: `prn-${medById.xanax}-${date}-${uuid().slice(0, 4)}`, medId: medById.xanax, status: 'prn', isPrn: true, dose: '0.5 mg', quantity: 1,
        takenTime: `${date}T${14 + Math.floor(rand() * 6)}:00:00`, reason: 'panic', symptomBeforeId: symById.panic,
        severityBefore: sevBefore, severityAfter: clamp(sevBefore - 3 - Math.floor(rand() * 2), 0, 10),
      }, date));
    }

    prevSleepHours = sleepHours;
  }

  await bulkPut('dailyCheckIns', checkIns);
  await bulkPut('medicationDailyLogs', medLogs);
  await bulkPut('symptomEpisodes', episodes);
  await bulkPut('stressEvents', stressEvents);

  await saveSettings({ sampleDataLoaded: true, whatHelped: SAMPLE_WHAT_HELPED, contexts: SAMPLE_CONTEXTS });
  await put('backupMetadata', stamp({ id: 'lastBackup', at: todayISO(dateNDaysAgo(12)) }, todayISO(dateNDaysAgo(12))));

  return { meds: medProfiles.length, symptoms: symDefs.length, checkIns: checkIns.length, medLogs: medLogs.length, episodes: episodes.length, changeEvents: changeEvents.length };
}
