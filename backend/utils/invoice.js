/**
 * Invoice Generator
 * Generates a PDF invoice/receipt using pdfkit.
 *
 * Usage:
 *   const { generateInvoicePDF } = require('./invoice');
 *   generateInvoicePDF(res, { subscription, user, profile });
 */

const PDFDocument = require('pdfkit');
const { pdfSafe } = require('./pdfText');
const config = require('../config/env');

const PLAN_LABELS = {
  basic_premium: 'Basic',
  premium_plus: 'Premium',
  elite: 'Elite',
  vip: 'VIP',
  nri: 'NRI Connect',
  founding_premium: 'Founding Member',
};

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
    ? pdfSafe(`${profile.firstName || ''} ${profile.lastName || ''}`)
    : 'N/A';
  doc.fontSize(10).fillColor(GRAY)
    .text(name, 50, billingY + 16)
    .text(user.email, 50, billingY + 30);

  doc.fontSize(11).fillColor(DARK).text('Date:', 350, billingY);
  doc.fontSize(10).fillColor(GRAY).text(
    new Date(subscription.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata',
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
    .text('Description', 50, tableTop, { width: 200 })
    .text('Plan', 260, tableTop, { width: 110 })
    .text('Period', 380, tableTop, { width: 90 })
    .text('Amount', 470, tableTop, { width: 75, align: 'right' });

  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  // ── Order Table Row ───────────────────────────────────
  const rowY = doc.y;
  // Member-facing names, not enum keys ("Premium_plus" was printed).
  const planLabel = PLAN_LABELS[subscription.planType]
    || (subscription.planType ? String(subscription.planType).replace(/_/g, ' ') : 'N/A');
  // "8 Oct 2026": a bare 8/10/2026 reads as August to some readers.
  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const startDate = subscription.startDate ? fmt(subscription.startDate) : 'N/A';
  const endDate = subscription.endDate ? fmt(subscription.endDate) : 'N/A';
  // "Rs.", not the rupee sign: the built-in PDF font has no glyph for it and
  // printed a stray character in its place.
  const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;
  const amountFormatted = money(subscription.amount);
  // A referral discount was applied at checkout: show the list price and the
  // discount, so the receipt explains why the total is lower than the plan price.
  const discountRs = Number(subscription.referral?.discountPaise || 0) / 100;
  const subtotalFormatted = money(Number(subscription.amount || 0) + discountRs);

  doc.fontSize(10).fillColor(GRAY)
    .text(`${planLabel} Subscription Plan`, 50, rowY, { width: 200 })
    .text(planLabel, 260, rowY, { width: 110 })
    .text(`${startDate} – ${endDate}`, 380, rowY, { width: 90 })
    .text(subtotalFormatted, 470, rowY, { width: 75, align: 'right' });

  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.5);

  // ── Totals ────────────────────────────────────────────
  const totalsY = doc.y;
  doc.fontSize(10).fillColor(GRAY).text('Subtotal', 380, totalsY);
  doc.fontSize(10).fillColor(DARK).text(subtotalFormatted, 470, totalsY, { width: 75, align: 'right' });
  let paidY = totalsY + 20;
  if (discountRs > 0) {
    doc.fontSize(10).fillColor(GRAY).text(pdfSafe(`Referral discount (${subscription.referral.code || 'code'})`), 260, paidY, { width: 210, align: 'right', lineBreak: false });
    doc.fontSize(10).fillColor(DARK).text(`- ${money(discountRs)}`, 470, paidY, { width: 75, align: 'right' });
    paidY += 20;
  }

  doc.fontSize(11).fillColor(BURGUNDY).text('Total Paid', 380, paidY);
  doc.fontSize(11).fillColor(BURGUNDY).text(amountFormatted, 470, paidY, { width: 75, align: 'right' });

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
    `Thank you for choosing TricityMatch. For support contact ${config.email.support}`,
    50, 750, { align: 'center', width: 495 }
  );

  doc.end();
};

module.exports = { generateInvoicePDF };
