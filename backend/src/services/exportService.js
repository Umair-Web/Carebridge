/**
 * Export Service (Q21) - Supports PDF (frontend) and XLSX/CSV (backend)
 */

exports.exportToCSV = (data, fields) => {
  if (!data || !data.length) return '';

  const header = fields.join(',');
  const rows = data.map(row => {
    return fields.map(field => {
      let val = row[field] === undefined || row[field] === null ? '' : row[field];
      // Escape commas and quotes
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"')) {
        val = `"${val}"`;
      }
      return val;
    }).join(',');
  });

  return [header, ...rows].join('\n');
};

/**
 * Placeholder for true XLSX generation (requires exceljs/xlsx library)
 * CSV is a compatible format for Excel reconciliation as requested in Q21.
 */
exports.generateReconciliationExport = async (records) => {
  const fields = ['createdAt', 'referralCode', 'amountPaisa', 'status', 'note'];
  return exports.exportToCSV(records, fields);
};
