const test = require('node:test');
const assert = require('node:assert');
const User = require('../src/models/User');

test('isAncestorOf: direct creator and ancestor chain', async (t) => {
  const idA = '507f1f77bcf86cd799439011';
  const idB = '507f1f77bcf86cd799439012';
  const idC = '507f1f77bcf86cd799439013';
  const idD = '507f1f77bcf86cd799439014';

  const users = {
    [idA]: { _id: idA, createdBy: null },
    [idB]: { _id: idB, createdBy: idA },
    [idC]: { _id: idC, createdBy: idB },
    [idD]: { _id: idD, createdBy: null }
  };

  // Stub User.findById to mock database behavior
  t.mock.method(User, 'findById', (id) => {
    const found = users[id.toString()];
    if (!found) return {
      select: () => null
    };
    return {
      _id: found._id,
      createdBy: found.createdBy,
      select: function() {
        return this;
      }
    };
  });

  const docA = new User({ _id: idA, createdBy: null });
  const docB = new User({ _id: idB, createdBy: idA });
  const docC = new User({ _id: idC, createdBy: idB });
  const docD = new User({ _id: idD, createdBy: null });

  // A created B, B created C. D is independent.
  assert.strictEqual(await docA.isAncestorOf(idB), true, 'A should be ancestor of B');
  assert.strictEqual(await docA.isAncestorOf(idC), true, 'A should be ancestor of C');
  assert.strictEqual(await docB.isAncestorOf(idC), true, 'B should be ancestor of C');

  assert.strictEqual(await docB.isAncestorOf(idA), false, 'B should not be ancestor of A');
  assert.strictEqual(await docC.isAncestorOf(idB), false, 'C should not be ancestor of B');
  assert.strictEqual(await docD.isAncestorOf(idC), false, 'D should not be ancestor of C');
  assert.strictEqual(await docA.isAncestorOf(idD), false, 'A should not be ancestor of D');
});
