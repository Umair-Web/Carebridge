const test = require('node:test');
const assert = require('node:assert');
const { getFrontendBase, isLocalHostname } = require('../src/utils/frontendUrl');

test('isLocalHostname detects localhost', () => {
  assert.strictEqual(isLocalHostname('http://localhost:5173'), true);
  assert.strictEqual(isLocalHostname('https://carebridge.vercel.app'), false);
});

test('prefers a public FRONTEND_URL over request origin', () => {
  const prev = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'https://app.carebridgesystem.com';
  const req = { get: (h) => (h === 'origin' ? 'https://other.example' : '') };
  assert.strictEqual(getFrontendBase(req), 'https://app.carebridgesystem.com');
  process.env.FRONTEND_URL = prev;
});

test('ignores localhost FRONTEND_URL and uses request origin', () => {
  const prev = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = 'http://localhost:5173';
  const req = {
    get: (h) => (h === 'origin' ? 'https://carebridge.vercel.app' : ''),
    headers: {},
  };
  assert.strictEqual(getFrontendBase(req), 'https://carebridge.vercel.app');
  process.env.FRONTEND_URL = prev;
});
