const test = require('node:test');
const assert = require('node:assert');
const { applyCloserToReferral, closerKindLabel } = require('../src/utils/closerActor');

test('closerKindLabel maps known kinds', () => {
  assert.strictEqual(closerKindLabel('hospital_team'), 'Hospital Team');
  assert.strictEqual(closerKindLabel('hospital_owner'), 'Hospital Admin');
  assert.strictEqual(closerKindLabel('jazzcash'), 'JazzCash Payment');
});

test('applyCloserToReferral writes denormalized fields', () => {
  const referral = {};
  applyCloserToReferral(referral, {
    closedBy: 'abc',
    closedByName: 'Ali Khan',
    closedByKind: 'hospital_team',
  });
  assert.strictEqual(referral.closedBy, 'abc');
  assert.strictEqual(referral.closedByName, 'Ali Khan');
  assert.strictEqual(referral.closedByKind, 'hospital_team');
});
