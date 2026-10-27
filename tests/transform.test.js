import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFloatSafe,
  parsePortalTimestamp,
  transformEnergyReadings,
} from '../src/transform.js';

test('parseFloatSafe handles valid floats and placeholders', () => {
  assert.equal(parseFloatSafe('48438.74'), 48438.74);
  assert.equal(parseFloatSafe('0'), 0);
  assert.equal(parseFloatSafe(''), null);
  assert.equal(parseFloatSafe('-'), null);
  assert.equal(parseFloatSafe('N/A'), null);
  assert.equal(parseFloatSafe(null), null);
  assert.equal(parseFloatSafe(undefined), null);
});

test('parsePortalTimestamp converts DD/MM/YYYY HH:MM to ISO with +05:30', () => {
  assert.equal(
    parsePortalTimestamp('24/06/2026 00:30'),
    '2026-06-24T00:30:00+05:30'
  );
  assert.equal(parsePortalTimestamp('invalid-date'), null);
  assert.equal(parsePortalTimestamp(null), null);
});

test('transformEnergyReadings computes interval kWh correctly', () => {
  const rawData = [
    { timestamp: '23/06/2026 23:30', kwh: '48438.74', kvah: '52313.84', voltR: '226' },
    { timestamp: '24/06/2026 00:00', kwh: '48439.16', kvah: '52314.29', voltR: '229' },
    { timestamp: '24/06/2026 00:30', kwh: '48439.58', kvah: '52314.75', voltR: '220' },
  ];

  const result = transformEnergyReadings(rawData);

  assert.equal(result.count, 3);
  assert.equal(result.readings[0].interval_kwh, null);
  assert.equal(result.readings[0].volt_r, 226);
  assert.equal(result.readings[1].interval_kwh, 0.42);
  assert.equal(result.readings[2].interval_kwh, 0.42);

  assert.equal(result.total_interval_kwh, 0.84);
});