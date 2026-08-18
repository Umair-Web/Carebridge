import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPkr } from './formatPkr';

export const generateEarningsPDF = (consultant, referrals, payouts) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('CareBridge Health', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Earnings & Statements Report', 14, 28);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 28, { align: 'right' });

  // Consultant Info
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, 32, pageWidth - 14, 32);
  
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.setFont(undefined, 'bold');
  doc.text('Consultant Details', 14, 42);
  
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${consultant.userId?.name || 'N/A'}`, 14, 48);
  doc.text(`PMDC: ${consultant.pmdcNumber || 'N/A'}`, 14, 53);
  doc.text(`Specialty: ${consultant.specialty || 'N/A'}`, 14, 58);
  
  doc.text(`Total Lifetime Earnings: ${formatPkr(consultant.totalEarnings || 0)}`, pageWidth - 14, 48, { align: 'right' });
  doc.text(`Current Month Earnings: ${formatPkr(consultant.monthlyEarnings || 0)}`, pageWidth - 14, 53, { align: 'right' });

  // Referrals Table
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Recent Referral Activity', 14, 72);

  const referralRows = referrals.map(r => [
    r.referralCode,
    new Date(r.createdAt).toLocaleDateString(),
    r.patientName,
    r.targetHospitalId?.hospitalName || 'N/A',
    r.status.toUpperCase(),
    r.status === 'closed' ? '1,000 PKR' : 'Pending'
  ]);

  autoTable(doc, {
    startY: 76,
    head: [['Code', 'Date', 'Patient', 'Hospital', 'Status', 'Payout']],
    body: referralRows,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }, // blue-500
    styles: { fontSize: 9 }
  });

  // Payouts Table
  const finalY = doc.lastAutoTable.finalY || 150;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Disbursement History', 14, finalY + 15);

  const payoutRows = payouts.map(p => [
    new Date(p.createdAt).toLocaleDateString(),
    p.referralId?.referralCode || 'N/A',
    formatPkr(p.amountPaisa),
    p.status.toUpperCase(),
    p.note || '-'
  ]);

  autoTable(doc, {
    startY: finalY + 19,
    head: [['Date', 'Ref Code', 'Amount', 'Status', 'Note']],
    body: payoutRows,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] }, // emerald-500
    styles: { fontSize: 9 }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Page ${i} of ${pageCount} - CareBridge Health System - Confidential`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  doc.save(`CareBridge_Statement_${new Date().toISOString().slice(0, 10)}.pdf`);
};
