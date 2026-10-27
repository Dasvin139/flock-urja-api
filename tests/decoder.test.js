import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseNameAndCode,
  decodeSvelteKitData,
  extractMeterDetail,
  MeterNotFoundError,
} from '../src/decoder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseNameAndCode extracts name and code properly', () => {
  const sample1 = parseNameAndCode('Vaishali DT 3 (DT-003)');
  assert.equal(sample1.name, 'Vaishali DT 3');
  assert.equal(sample1.code, 'DT-003');

  const sample2 = parseNameAndCode('Jaipur Zone 3 (Z-03)');
  assert.equal(sample2.name, 'Jaipur Zone 3');
  assert.equal(sample2.code, 'Z-03');

  const sampleNoCode = parseNameAndCode('Plain Name Without Code');
  assert.equal(sampleNoCode.name, 'Plain Name Without Code');
  assert.equal(sampleNoCode.code, null);
});

test('decodeSvelteKitData decodes J100002 fixture correctly', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'detail_J100002.json');
  const rawJson = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const decoded = decodeSvelteKitData(rawJson);
  assert.equal(decoded.meterId, 'J100002');
  assert.equal(decoded.hierarchy['Zone'], 'Jaipur Zone 3 (Z-03)');
  assert.equal(decoded.hierarchy['DT'], 'Vaishali DT 3 (DT-003)');

  const cleaned = extractMeterDetail(decoded);
  assert.equal(cleaned.meter_id, 'J100002');
  assert.equal(cleaned.serial_no, 'AL28136');
  assert.equal(cleaned.make, 'L&T');
  assert.equal(cleaned.phase_type, 'single');
  assert.equal(cleaned.install_status, 'Installed');
  assert.equal(cleaned.install_type, 'CT Operated');
  assert.equal(cleaned.hierarchy.zone.code, 'Z-03');
  assert.equal(cleaned.hierarchy.dt.name, 'Vaishali DT 3');
  assert.equal(cleaned.hierarchy.dt.code, 'DT-003');
});

test('decodeSvelteKitData throws MeterNotFoundError on error node', () => {
  const errorPayload = {
    type: 'data',
    nodes: [
      { type: 'skip' },
      { type: 'error', status: 404, error: { message: 'Meter not found' } },
    ],
  };

  assert.throws(() => decodeSvelteKitData(errorPayload), MeterNotFoundError);
});