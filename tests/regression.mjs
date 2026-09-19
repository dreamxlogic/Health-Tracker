import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dbSource = await readFile(new URL('../db.js', import.meta.url), 'utf8');
const db = await import(`data:text/javascript;base64,${Buffer.from(dbSource).toString('base64')}`);

db.setDayBoundaryHour(4);
assert.equal(db.todayISO(new Date(2026, 8, 18, 3, 30)), '2026-09-17', '3:30 AM belongs to the prior tracking day');
assert.equal(db.todayISO(new Date(2026, 8, 18, 4, 0)), '2026-09-18', '4:00 AM begins the new tracking day');

const emptyStores = Object.fromEntries(db.STORES.map((name) => [name, []]));
assert.equal(db.validateBackup({ schema: 'hcc.backup.v2', stores: emptyStores }).total, 0);
const fixture = JSON.parse(await readFile(new URL('./fixtures/backup-empty.json', import.meta.url), 'utf8'));
assert.equal(db.validateBackup(fixture).total, 0, 'restore fixture should remain valid');
assert.throws(() => db.validateBackup({ schema: 'other', stores: emptyStores }), /Unsupported backup version/);
assert.throws(() => db.validateBackup({ schema: 'hcc.backup.v2', stores: { ...emptyStores, medicationProfiles: [{}] } }), /missing its id/);

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
for (const marker of [
  'Restore a backup',
  'Clear all health data?',
  'Log medication',
  'Mood &amp; stress',
  'Type an activity or care action',
  'storageWarningText',
  'health-pre-restore-',
  'showInSelfCare',
  'Complete dose history',
  'Set date & time',
  'Skip · leave blank',
  'skippedSteps',
]) assert.ok(html.includes(marker), `missing UI regression marker: ${marker}`);

assert.ok(html.includes("step !== 'cognition' && step !== 'food'"), 'only cognition and food should expose blank-data skipping');
assert.ok(html.includes('delete ratings[k]'), 'skipping must remove existing ratings instead of recording defaults');
assert.ok(html.includes('next.proteinG = null; next.proteinRange = null'), 'skipping food must leave protein blank');

for (const marker of ['this.raw.episodes || []', 'this.raw.medLogs || []', 'this.raw.checkIns || []', 'this.raw.stress || []', 'this.raw.selfCare || []']) {
  assert.ok(html.includes(marker), `${marker} must remain part of detailed export assembly`);
}
assert.ok(html.includes("notes: e.notes || ''"), 'symptom notes must remain in detailed exports');
assert.ok(html.includes("notes: s.notes || ''"), 'mood, stress, and self-care notes must remain in detailed exports');

assert.ok(!html.includes('maximum-scale=1'), 'pinch zoom must not be disabled');
assert.ok(html.includes('data-hcc-scroll-rail'), 'horizontal rails must expose keyboard affordances');
assert.ok(!html.includes('width:46px;height:27px'), 'legacy oversized switches must not return');
assert.ok(html.includes('.hcc-toggle{width:34px!important;height:20px!important'), 'all switch screens must share the compact control');
assert.ok(html.includes('.hcc-segmented>div{cursor:pointer;flex:1'), 'segmented controls must keep equal centered spacing');
assert.equal((html.match(/class="hcc-tool-card"/g) || []).length, 4, 'all four Insights tool cards must use one equal-size component');
assert.ok(html.includes('grid-template-columns:repeat(3,minmax(0,1fr))'), 'medication status choices must keep equal columns');

const reviewHtml = await readFile(new URL('../screen-review.html', import.meta.url), 'utf8');
const reviewJs = await readFile(new URL('../screen-review.js', import.meta.url), 'utf8');
for (const marker of ['Every screen is a separate review page', 'Submit feedback', 'Copy for Codex']) {
  assert.ok(reviewHtml.includes(marker), `missing screen-review marker: ${marker}`);
}
const screenDefinitions = [...reviewJs.matchAll(/^\s*\['[^']+','[^']+','[^']+'/gm)];
assert.equal(screenDefinitions.length, 55, `screen catalog must keep all 55 documented app states; found ${screenDefinitions.length}`);
assert.ok(dbSource.includes("'hcc-screen-review'"), 'review mode must use an isolated database');
console.log('Health Tracker regression checks passed');
