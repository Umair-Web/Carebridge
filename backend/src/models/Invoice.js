const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    invoiceNumber: { type: String, unique: true, required: true },
    amountPaisa: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['subscription', 'commission', 'service_fee'], 
      default: 'subscription' 
    },
    status: { 
      type: String, 
      enum: ['unpaid', 'paid', 'cancelled'], 
      default: 'unpaid' 
    },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    /** Manual entries/notes from Admin (Q20) */
    adminNotes: { type: String },
    items: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, required: true },
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', InvoiceSchema);
