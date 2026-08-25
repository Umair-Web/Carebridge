const mongoose = require('mongoose');

/** Atomic sequence for referral codes (CB-YYYY-NNNN). */
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', CounterSchema);
