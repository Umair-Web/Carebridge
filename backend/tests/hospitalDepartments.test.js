const test = require('node:test');
const assert = require('node:assert');
const {
  syncBedsInventoryWithDepartments,
  getActiveBedsInventory,
} = require('../src/utils/hospitalDepartments');

test('syncBedsInventoryWithDepartments creates rows for departments and drops leftover wards', () => {
  const hospital = {
    departments: ['Cardiology', 'Orthopedics'],
    inactiveDepartments: ['Orthopedics'],
    bedsInventory: [
      { ward: 'General', totalBeds: 20, occupiedBeds: 5, availableBeds: 15 },
      { ward: 'Cardiology', totalBeds: 8, occupiedBeds: 2, availableBeds: 6 },
    ],
  };

  const changed = syncBedsInventoryWithDepartments(hospital);
  assert.strictEqual(changed, true);
  assert.deepStrictEqual(
    hospital.bedsInventory.map((b) => b.ward),
    ['Cardiology', 'Orthopedics']
  );
  assert.strictEqual(hospital.bedsInventory[0].totalBeds, 8);
  assert.strictEqual(hospital.bedsInventory[1].totalBeds, 0);

  const active = getActiveBedsInventory(hospital);
  assert.deepStrictEqual(active.map((b) => b.ward), ['Cardiology']);
});
