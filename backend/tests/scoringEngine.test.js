const test = require('node:test');
const assert = require('node:assert');
const { scoreHospital, calculateDistance } = require('../src/utils/scoringEngine');

// A hospital that fully matches the referral below.
const baseHospital = () => ({
  _id: 'hospitalA',
  hospitalName: 'Test General Hospital',
  bedsInventory: [{ ward: 'Cardiology', totalBeds: 10, occupiedBeds: 5, availableBeds: 5 }],
  departments: ['Cardiology'],
  location: { coordinates: [67.0099, 24.8607] }, // [lng, lat]
  ratePackages: [{ department: 'Cardiology', minPrice: 1000, maxPrice: 5000 }],
  avgResponseTime: 60,
  acceptanceRate: 80,
});

const baseReferral = () => ({
  urgency: 'routine',
  department: 'Cardiology',
  location: { lat: 24.8607, lng: 67.0099 }, // identical coords -> distance ~0
  budgetMax: 6000, // >= package maxPrice -> full cost-fit
});

test('scores a fully-matching hospital with the expected breakdown', () => {
  const result = scoreHospital(baseHospital(), baseReferral(), null);
  assert.ok(result, 'should return a score object');
  assert.strictEqual(result.breakdown.specialty, 30);
  assert.strictEqual(result.breakdown.beds, 13); // round(5/10 * 25)
  assert.strictEqual(result.breakdown.distance, 15); // distance ~0 -> full weight
  assert.strictEqual(result.breakdown.cost, 10); // package fits budget
  assert.strictEqual(result.breakdown.preference, 0); // no consultant preference
  assert.strictEqual(result.totalScore, 75);
});

test('returns null when the hospital lacks the required department', () => {
  const h = baseHospital();
  h.departments = ['Orthopedics'];
  assert.strictEqual(scoreHospital(h, baseReferral(), null), null);
});

test('returns null when the referred department has no available beds', () => {
  const h = baseHospital();
  h.bedsInventory = [{ ward: 'Cardiology', totalBeds: 10, occupiedBeds: 10, availableBeds: 0 }];
  assert.strictEqual(scoreHospital(h, baseReferral(), null), null);
});

test('emergency referrals use beds from the referred department', () => {
  const h = baseHospital();
  const r = baseReferral();
  r.urgency = 'emergency';
  const result = scoreHospital(h, r, null);
  assert.ok(result, 'should score when the department has available beds');
});

test('totalScore is capped at 100', () => {
  const result = scoreHospital(baseHospital(), baseReferral(), null, {
    specialtyMatch: 100,
    bedAvailability: 100,
    distance: 100,
    costFit: 100,
    slaHistory: 100,
    preference: 100,
  });
  assert.strictEqual(result.totalScore, 100);
});

test('calculateDistance returns ~0 for identical coordinates', () => {
  assert.ok(calculateDistance(24.8607, 67.0099, 24.8607, 67.0099) < 0.001);
});
