/**
 * Invoice Generator
 * Generates a PDF invoice/receipt using pdfkit.
 *
 * Usage:
 *   const { generateInvoicePDF } = require('./invoice');
 *   generateInvoicePDF(res, { subscription, user, profile });
 */

const PDFDocument = require('pdfkit');

/**
 * Stream a PDF invoice to the HTTP response.
 * @param {import('http').ServerResponse} res
 * @param {{ subscription: object, user: object, profile: object }} data
 */
const generateInvoicePDF = (res, { subscription, user, profile }) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="invoice-${subscription.id.substring(0, 8)}.pdf"`
  );

  doc.pipe(res);

  const BURGUNDY = '#7c2d3e';
  const DARK = '#1a1a2e';
  const GRAY = '#6b7280';

  // ── Header ────────────────────────────────────────────
  doc.fontSize(24).fillColor(BURGUNDY).text('TricityMatch', 50, 50);
  doc.fontSize(10).fillColor(GRAY).text('The Tricity Matrimonial Platform', 50, 80);
  doc.moveDown(0.5);
  doc.moveTo(50, 100).lineTo(545, 100).strokeColor(BURGUNDY).stroke();

  // ── Title ─────────────────────────────────────────────
  doc.fontSize(20).fillColor(DARK).text('Payment Receipt', 50, 120);
  doc.fontSize(10).fillColor(GRAY).text(
    `Invoice #INV-${subscription.id.substring(0, 8).toUpperCase()}`,
    50, 148
  );

  // ── Billing Info ──────────────────────────────────────
  doc.moveDown(2);
  const billingY = doc.y;

  doc.fontSize(11).fillColor(DARK).text('Billed To:', 50, billingY);
  const name = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : 'N/A';
  doc.fontSize(10).fillColor(GRAY)
    .text(name, 50, billingY + 16)
    .text(user.email, 50, billingY + 30);

  doc.fontSize(11).fillColor(DARK).text('Date:', 350, billingY);
  doc.fontSize(10).fillColor(GRAY).text(
    new Date(subscription.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric',
    }),
    350, billingY + 16
  );
  doc.fontSize(11).fillColor(DARK).text('Status:', 350, billingY + 36);
  doc.fontSize(10).fillColor(GRAY).text(
    subscription.status?.toUpperCase() || 'N/A',
    350, billingY + 52
  );

  doc.moveDown(4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  // ── Order Table Header ────────────────────────────────
  const tableTop = doc.y;
  doc.fontSize(10).fillColor(DARK)
    .text('Description', 50, tableTop, { width: 250 })
    .text('Plan', 310, tableTop, { width: 90 })
    .text('Period', 400, tableTop, { width: 80 })
    .text('Amount', 480, tableTop, { width: 65, align: 'right' });

  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  // ── Order Table Row ───────────────────────────────────
  const rowY = doc.y;
  const planLabel = subscription.planType
    ? subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1)
    : 'N/A';
  const startDate = subscription.startDate
    ? new Date(subscription.startDate).toLocaleDateString('en-IN')
    : 'N/A';
  const endDate = subscription.endDate
    ? new Date(subscription.endDate).toLocaleDateString('en-IN')
    : 'N/A';
  const amountFormatted = subscription.amount
    ? `₹${parseFloat(subscription.amount).toFixed(2)}`
    : '₹0.00';

  doc.fontSize(10).fillColor(GRAY)
    .text(`${planLabel} Subscription Plan`, 50, rowY, { width: 250 })
    .text(planLabel, 310, rowY, { width: 90 })
    .text(`${startDate} – ${endDate}`, 400, rowY, { width: 80 })
    .text(amountFormatted, 480, rowY, { width: 65, align: 'right' });

  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  // ── Totals ────────────────────────────────────────────
  const totalsY = doc.y;
  doc.fontSize(10).fillColor(GRAY).text('Subtotal', 400, totalsY);
  doc.fontSize(10).fillColor(DARK).text(amountFormatted, 480, totalsY, { width: 65, align: 'right' });

  doc.fontSize(11).fillColor(BURGUNDY).text('Total Paid', 400, totalsY + 20);
  doc.fontSize(11).fillColor(BURGUNDY).text(amountFormatted, 480, totalsY + 20, { width: 65, align: 'right' });

  // ── Payment Reference ─────────────────────────────────
  doc.moveDown(3);
  if (subscription.razorpayPaymentId) {
    doc.fontSize(9).fillColor(GRAY)
      .text(`Payment ID: ${subscription.razorpayPaymentId}`, 50, doc.y);
  }
  if (subscription.razorpayOrderId) {
    doc.fontSize(9).fillColor(GRAY)
      .text(`Order ID: ${subscription.razorpayOrderId}`, 50, doc.y + 14);
  }

  // ── Footer ────────────────────────────────────────────
  doc.fontSize(9).fillColor(GRAY).text(
    'Thank you for choosing TricityMatch. For support contact support@tricitymatch.com',
    50, 750, { align: 'center', width: 495 }
  );

  doc.end();
};

module.exports = { generateInvoicePDF };
