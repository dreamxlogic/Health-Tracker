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
]) assert.ok(html.includes(marker), `missing UI regression marker: ${marker}`);

assert.ok(!html.includes('maximum-scale=1'), 'pinch zoom must not be disabled');
assert.ok(html.includes('data-hcc-scroll-rail'), 'horizontal rails must expose keyboard affordances');
console.log('Health Tracker regression checks passed');
