import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { MemoryCache } from '../src/cache.js';

// Mock client simulating the portal
class MockPortalClient {
  async getAllMeters() {
    return [
      { meterId: 'J100000', serialNo: 'SE33962', make: 'HPL', phaseType: 'single', installStatus: 'Decommissioned', dtCode: 'DT-001' },
      { meterId: 'J100001', serialNo: 'GE84132', make: 'L&T', phaseType: 'single', installStatus: 'Installed', dtCode: 'DT-002' },
      { meterId: 'J100005', serialNo: 'HP63682', make: 'Allied', phaseType: 'three', installStatus: 'Faulty', dtCode: 'DT-006' },
      { meterId: 'J100400', serialNo: 'GN31592', make: 'Genus', phaseType: 'three', installStatus: 'Installed', dtCode: 'DT-007' },
    ];
  }

  async getMeterDetail(meterId) {
    if (meterId === 'J100001') {
      return {
        meter_id: 'J100001',
        serial_no: 'GE84132',
        make: 'L&T',
        phase_type: 'single',
        install_status: 'Installed',
        install_type: 'CT Operated',
        hierarchy: {
          zone: { name: 'Jaipur Zone 1', code: 'Z-01' },
          dt: { name: 'Malviya Nagar DT 2', code: 'DT-002' },
        },
      };
    }
    const err = new Error(`Meter '${meterId}' not found`);
    err.status = 404;
    throw err;
  }

  async getMeterEnergy(meterId) {
    if (meterId === 'J100001') {
      return [
        { timestamp: '24/06/2026 00:00', kwh: '100.00', kvah: '110.00', voltR: '230' },
        { timestamp: '24/06/2026 00:30', kwh: '100.45', kvah: '110.50', voltR: '232' },
      ];
    }
    const err = new Error(`Meter '${meterId}' not found`);
    err.status = 404;
    throw err;
  }
}

test('API GET /health returns 200 ok', async () => {
  const app = createApp(new MockPortalClient(), new MemoryCache());
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.status, 'ok');
  } finally {
    server.close();
  }
});

test('API GET /api/v1/meters filters and paginates', async () => {
  const app = createApp(new MockPortalClient(), new MemoryCache());
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/meters?make=Genus`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.total, 1);
    assert.equal(data.items[0].meterId, 'J100400');

    const resSearch = await fetch(`http://localhost:${port}/api/v1/meters?q=10000`);
    const searchData = await resSearch.json();
    assert.equal(searchData.total, 3); 
  } finally {
    server.close();
  }
});

test('API GET /api/v1/meters/:meterId returns 404 for unknown meter', async () => {
  const app = createApp(new MockPortalClient(), new MemoryCache());
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/meters/UNKNOWN999`);
    const data = await res.json();
    assert.equal(res.status, 404);
    assert.equal(data.error, 'not_found');
  } finally {
    server.close();
  }
});

test('API GET /api/v1/meters/:meterId/consumption returns interval_kwh', async () => {
  const app = createApp(new MockPortalClient(), new MemoryCache());
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/v1/meters/J100001/consumption`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.meter_id, 'J100001');
    assert.equal(data.count, 2);
    assert.equal(data.readings[1].interval_kwh, 0.45);
    assert.equal(data.total_interval_kwh, 0.45);
  } finally {
    server.close();
  }
});