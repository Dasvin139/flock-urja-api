import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCache } from '../src/cache.js';

test('MemoryCache stores and retrieves values', () => {
  const cache = new MemoryCache();
  cache.set('test-key', { sample: 123 }, 5000);

  const value = cache.get('test-key');
  assert.deepEqual(value, { sample: 123 });
});

test('MemoryCache expires keys after TTL', async () => {
  const cache = new MemoryCache();
  cache.set('short-lived', 'hello', 50); 

  assert.equal(cache.get('short-lived'), 'hello');

  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(cache.get('short-lived'), null);
});

test('getOrSet uses cache unless forceRefresh is true', async () => {
  const cache = new MemoryCache();
  let callCount = 0;
  const fetcher = async () => {
    callCount++;
    return `result-${callCount}`;
  };

  const val1 = await cache.getOrSet('key', fetcher, 5000);
  assert.equal(val1, 'result-1');
  assert.equal(callCount, 1);

  const val2 = await cache.getOrSet('key', fetcher, 5000);
  assert.equal(val2, 'result-1');
  assert.equal(callCount, 1);

  const val3 = await cache.getOrSet('key', fetcher, 5000, true);
  assert.equal(val3, 'result-2');
  assert.equal(callCount, 2);
});