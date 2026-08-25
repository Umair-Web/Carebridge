// Set a known key BEFORE requiring the module (crypto.js reads the env at load time).
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes

const test = require('node:test');
const assert = require('node:assert');
const { encrypt, decrypt } = require('../src/utils/crypto');

test('encrypt → decrypt round-trips the original value', () => {
  const original = '42101-1234567-1'; // CNIC-like value
  const ciphertext = encrypt(original);
  assert.notStrictEqual(ciphertext, original, 'ciphertext should differ from plaintext');
  assert.match(ciphertext, /^[0-9a-f]+:[0-9a-f]+$/, 'ciphertext should be iv:data hex');
  assert.strictEqual(decrypt(ciphertext), original);
});

test('encrypt produces a different ciphertext each call (random IV)', () => {
  const a = encrypt('same-value');
  const b = encrypt('same-value');
  assert.notStrictEqual(a, b, 'IV randomization should make ciphertexts differ');
  assert.strictEqual(decrypt(a), 'same-value');
  assert.strictEqual(decrypt(b), 'same-value');
});

test('empty / falsy values pass through untouched', () => {
  assert.strictEqual(encrypt(''), '');
  assert.strictEqual(encrypt(undefined), undefined);
  assert.strictEqual(decrypt(''), '');
});

test('decrypt leaves a non-encrypted (no colon) value unchanged', () => {
  assert.strictEqual(decrypt('plain-text-no-colon'), 'plain-text-no-colon');
});
