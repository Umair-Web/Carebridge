const mongoose = require('mongoose');

const DepartmentCatalogSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    keywords: [{ type: String, lowercase: true, trim: true }],
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DepartmentCatalog', DepartmentCatalogSchema);
