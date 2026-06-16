/**
 * Kundli / Matchmaking Report Generator
 * Streams a PDF Ashtakoot Guna Milan + Manglik + numerology report using pdfkit.
 *
 * Usage:
 *   const { generateKundliPDF } = require('./kundli');
 *   generateKundliPDF(res, { myProfile, theirProfile, ashtakoot, manglik, rashiScore, numerology, summary });
 */

const PDFDocument = require('pdfkit');

const BURGUNDY = '#7c2d3e';
const DARK = '#1a1a2e';
const GRAY = '#6b7280';
const LIGHT = '#9ca3af';
const GREEN = '#16a34a';
const RED = '#dc2626';

const fullName = (p) =>
  p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'N/A' : 'N/A';

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '—';
  }
};

const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, ' ') : '—');

/**
 * Stream a kundli matchmaking PDF to the HTTP response.
 * @param {import('http').ServerResponse} res
 * @param {{
 *   myProfile: object, theirProfile: object,
 *   ashtakoot: object|null, manglikCompatible: boolean, manglikDetail: string,
 *   rashiScore: number|null, numerology: object|null, summary: string
 * }} data
 */
const generateKundliPDF = (res, data) => {
  const { myProfile, theirProfile, ashtakoot, manglikCompatible, manglikDetail, rashiScore, numerology, summary } = data;
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="kundli-match-${(theirProfile?.userId || 'report').toString().substring(0, 8)}.pdf"`
  );

  doc.pipe(res);

  // ── Header ────────────────────────────────────────────
  doc.fontSize(24).fillColor(BURGUNDY).text('TricityMatch', 50, 50);
  doc.fontSize(10).fillColor(GRAY).text('Kundli Matching Report · Ashtakoot Guna Milan', 50, 80);
  doc.moveTo(50, 100).lineTo(545, 100).strokeColor(BURGUNDY).stroke();

  doc.fontSize(18).fillColor(DARK).text('Horoscope Compatibility', 50, 116);
  doc.fontSize(10).fillColor(GRAY).text(`Generated ${fmtDate(new Date())}`, 50, 142);

  // ── Birth details (two columns) ───────────────────────
  let y = 170;
  doc.fontSize(12).fillColor(BURGUNDY).text('Birth Details', 50, y);
  y += 22;

  const colA = 50;
  const colB = 320;
  doc.fontSize(11).fillColor(DARK).text(fullName(myProfile), colA, y);
  doc.fontSize(11).fillColor(DARK).text(fullName(theirProfile), colB, y);
  y += 18;

  const detailRow = (label, aVal, bVal) => {
    doc.fontSize(9).fillColor(LIGHT).text(label, colA, y);
    doc.fontSize(10).fillColor(GRAY).text(aVal, colA, y + 11, { width: 250 });
    doc.fontSize(9).fillColor(LIGHT).text(label, colB, y);
    doc.fontSize(10).fillColor(GRAY).text(bVal, colB, y + 11, { width: 225 });
    y += 32;
  };

  detailRow('Date of Birth', fmtDate(myProfile?.dateOfBirth), fmtDate(theirProfile?.dateOfBirth));
  detailRow('Place of Birth', myProfile?.placeOfBirth || '—', theirProfile?.placeOfBirth || '—');
  detailRow('Rashi (Moon Sign)', cap(myProfile?.rashi), cap(theirProfile?.rashi));
  detailRow('Nakshatra', cap(myProfile?.nakshatra), cap(theirProfile?.nakshatra));
  detailRow('Manglik Status', cap(myProfile?.manglikStatus), cap(theirProfile?.manglikStatus));

  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
  y += 16;

  // ── Ashtakoot Guna table ──────────────────────────────
  doc.fontSize(12).fillColor(BURGUNDY).text('Ashtakoot Guna Milan', 50, y);
  y += 24;

  if (ashtakoot && ashtakoot.gunas) {
    // table header
    doc.fontSize(9).fillColor(LIGHT)
      .text('Guna', 50, y, { width: 110 })
      .text('Meaning', 160, y, { width: 250 })
      .text('Score', 460, y, { width: 85, align: 'right' });
    y += 14;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
    y += 6;

    for (const key of ['varna', 'vashya', 'tara', 'yoni', 'maitri', 'gana', 'bhakoot', 'nadi']) {
      const g = ashtakoot.gunas[key];
      if (!g) continue;
      const full = g.score === g.max;
      doc.fontSize(10).fillColor(DARK).text(g.name, 50, y, { width: 110 });
      doc.fontSize(9).fillColor(GRAY).text(g.detail, 160, y, { width: 290 });
      doc.fontSize(10).fillColor(full ? GREEN : (g.score === 0 ? RED : DARK))
        .text(`${g.score} / ${g.max}`, 460, y, { width: 85, align: 'right' });
      y += 20;
    }

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
    y += 8;

    // total
    const total = ashtakoot.rawOut36 ?? 0;
    doc.fontSize(12).fillColor(BURGUNDY).text('Total Guna Milan', 50, y);
    doc.fontSize(13).fillColor(total >= 18 ? GREEN : RED)
      .text(`${total} / 36  (${ashtakoot.interpretation})`, 320, y, { width: 225, align: 'right' });
    y += 26;

    // doshas
    const doshas = [];
    if (ashtakoot.hasNadiDosha) doshas.push('Nadi Dosha present');
    if (ashtakoot.hasBhakootDosha) doshas.push('Bhakoot Dosha present');
    if (ashtakoot.hasGanaDosha) doshas.push('Gana Dosha present');
    if (doshas.length) {
      doc.fontSize(10).fillColor(RED).text(`⚠ ${doshas.join(' · ')}`, 50, y, { width: 495 });
      y += 18;
    }
  } else if (rashiScore !== null && rashiScore !== undefined) {
    doc.fontSize(10).fillColor(GRAY).text(
      `Full nakshatra data unavailable. Rashi-based compatibility: ${rashiScore}%.`,
      50, y, { width: 495 }
    );
    y += 22;
  } else {
    doc.fontSize(10).fillColor(GRAY).text(
      'Insufficient horoscope data for Guna Milan. Add nakshatra and birth details to both profiles.',
      50, y, { width: 495 }
    );
    y += 22;
  }

  y += 6;

  // ── Manglik ───────────────────────────────────────────
  doc.fontSize(12).fillColor(BURGUNDY).text('Manglik (Mangal Dosha)', 50, y);
  y += 20;
  doc.fontSize(10).fillColor(manglikCompatible ? GREEN : RED)
    .text(manglikCompatible ? '✓ Compatible' : '⚠ Needs consideration', 50, y);
  doc.fontSize(10).fillColor(GRAY).text(manglikDetail || '—', 200, y, { width: 345 });
  y += 28;

  // ── Numerology ────────────────────────────────────────
  if (numerology) {
    doc.fontSize(12).fillColor(BURGUNDY).text('Numerology (Life Path)', 50, y);
    y += 20;
    const np1 = numerology.person1?.number ?? '—';
    const np2 = numerology.person2?.number ?? '—';
    const compat = numerology.compatibility;
    doc.fontSize(10).fillColor(GRAY)
      .text(`${fullName(myProfile)}: Life Path ${np1}`, 50, y, { width: 250 })
      .text(`${fullName(theirProfile)}: Life Path ${np2}`, 320, y, { width: 225 });
    y += 16;
    if (compat) {
      const pct = compat.score ?? compat.percentage ?? null;
      const pctLabel = pct !== null ? `${pct}%` : '';
      doc.fontSize(10).fillColor(DARK)
        .text(`Harmony: ${pctLabel} ${compat.label || compat.interpretation || ''}`.trim(), 50, y, { width: 495 });
      y += 18;
    }
  }

  y += 6;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
  y += 12;

  // ── Summary ───────────────────────────────────────────
  doc.fontSize(12).fillColor(BURGUNDY).text('Summary', 50, y);
  y += 20;
  doc.fontSize(10).fillColor(DARK).text(summary || '—', 50, y, { width: 495 });

  // ── Footer disclaimer (fixed) ─────────────────────────
  doc.fontSize(8).fillColor(LIGHT).text(
    'This report is generated from the birth details provided and is for guidance only. ' +
    'For important decisions, please consult a qualified astrologer. © TricityMatch',
    50, 770, { align: 'center', width: 495 }
  );

  doc.end();
};

module.exports = { generateKundliPDF };
