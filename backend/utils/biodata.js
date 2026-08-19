/**
 * Marriage Biodata PDF Generator (D5 — flagship).
 *
 * Streams a shareable biodata PDF of the member's OWN profile using pdfkit,
 * modeled on utils/kundli.js / utils/invoice.js. Free for every tier: the
 * "Made with TricityMatch" footer on a PDF that gets WhatsApp-forwarded
 * through family networks is the acquisition loop.
 *
 * Templates select a const pack {palette, rules} — layout code is shared.
 * Currency renders as "Rs." (pdfkit's default fonts have no ₹ glyph).
 * Photo arrives as a pre-fetched JPEG buffer (controller fetches with a 2s
 * timeout and a Cloudinary f_jpg transform — pdfkit cannot decode webp — and
 * skips silently on failure; the PDF must never block on the CDN).
 */

const PDFDocument = require('pdfkit');

const TEMPLATES = {
  classic: {
    accent: '#7c2d3e',   // burgundy
    heading: '#1a1a2e',
    body: '#374151',
    muted: '#6b7280',
    faint: '#9ca3af',
    hairline: '#C9A227', // gold hairline under the header
    ruleWidth: 1,
  },
  modern: {
    accent: '#8B2346',
    heading: '#111827',
    body: '#374151',
    muted: '#6b7280',
    faint: '#9ca3af',
    hairline: '#8B2346',
    ruleWidth: 0.5,
  },
};

const PAGE_BOTTOM = 780; // A4 height 842 − bottom margin
const LEFT = 50;
const RIGHT = 545;

const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, ' ') : null);

const fmtDate = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
};

const calcAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return Number.isFinite(age) && age > 0 ? age : null;
};

const cmToFeet = (cm) => {
  const n = parseInt(cm, 10);
  if (!Number.isFinite(n) || n < 100) return null;
  const totalIn = Math.round(n / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}" (${n} cm)`;
};

// "Rs." — deliberately not ₹ (missing from pdfkit's built-in fonts).
const fmtIncome = (income) => {
  if (!income) return null;
  const s = String(income).replace(/₹/g, 'Rs. ');
  return /^\d+$/.test(s) ? `Rs. ${Number(s).toLocaleString('en-IN')}` : s;
};

/**
 * Generate + stream the biodata PDF.
 * @param {import('http').ServerResponse} res
 * @param {{ profile: object, template?: 'classic'|'modern', photoBuffer?: Buffer|null, profileCode?: string|null }} data
 */
const generateBiodataPDF = (res, data) => {
  const { profile, photoBuffer = null, profileCode = null } = data;
  const T = TEMPLATES[data.template] || TEMPLATES.classic;

  // bufferPages so the footer loop can revisit every page before end().
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="biodata-tricitymatch.pdf"');

  doc.pipe(res);

  let y = 50;

  const stampHeader = () => {
    doc.fontSize(20).fillColor(T.accent).text('TricityMatch', LEFT, y);
    doc.fontSize(9).fillColor(T.muted).text('Marriage Biodata', LEFT, y + 24);
    doc.moveTo(LEFT, y + 40).lineTo(RIGHT, y + 40).lineWidth(T.ruleWidth).strokeColor(T.hairline).stroke();
    y += 54;
  };

  // Page-break helper — existing PDF utils have none, and a biodata with a
  // full family + about section overflows A4. Re-stamps the header on the
  // fresh page so continuation pages stay branded.
  const ensureSpace = (needed) => {
    if (y + needed <= PAGE_BOTTOM) return;
    doc.addPage();
    y = 50;
    stampHeader();
  };

  const sectionTitle = (title) => {
    ensureSpace(44);
    y += 10;
    doc.fontSize(12).fillColor(T.accent).text(title.toUpperCase(), LEFT, y, { characterSpacing: 1 });
    doc.moveTo(LEFT, y + 16).lineTo(RIGHT, y + 16).lineWidth(0.5).strokeColor(T.faint).stroke();
    y += 26;
  };

  // Label/value row; skips null values entirely (no "—" walls).
  const detailRow = (label, value) => {
    if (value === null || value === undefined || value === '') return;
    const text = String(value);
    const rowH = Math.max(16, doc.heightOfString(text, { width: RIGHT - 200 }) + 4);
    ensureSpace(rowH);
    doc.fontSize(9).fillColor(T.faint).text(label, LEFT, y, { width: 140 });
    doc.fontSize(10).fillColor(T.body).text(text, 200, y, { width: RIGHT - 200 });
    y += rowH;
  };

  const paragraph = (text) => {
    if (!text) return;
    const h = doc.heightOfString(text, { width: RIGHT - LEFT }) + 6;
    ensureSpace(h);
    doc.fontSize(10).fillColor(T.body).text(text, LEFT, y, { width: RIGHT - LEFT });
    y += h;
  };

  // ── Header + identity block ─────────────────────────────
  stampHeader();

  const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Member';
  const age = calcAge(profile.dateOfBirth);

  if (photoBuffer) {
    try {
      doc.image(photoBuffer, RIGHT - 110, y, { fit: [110, 130] });
    } catch {
      // Undecodable buffer — render without the photo rather than crash the stream.
    }
  }

  doc.fontSize(22).fillColor(T.heading).text(name, LEFT, y, { width: RIGHT - LEFT - 130 });
  y += 30;
  const subtitleBits = [
    age ? `${age} years` : null,
    cap(profile.maritalStatus),
    profile.city ? cap(profile.city) : null,
  ].filter(Boolean).join('  ·  ');
  if (subtitleBits) {
    doc.fontSize(11).fillColor(T.muted).text(subtitleBits, LEFT, y, { width: RIGHT - LEFT - 130 });
    y += 20;
  }
  if (profileCode) {
    doc.fontSize(9).fillColor(T.faint).text(`Profile ID: ${profileCode}`, LEFT, y);
    y += 16;
  }
  // Clear the photo block before sections start.
  if (photoBuffer) y = Math.max(y, 240);

  // ── Personal ────────────────────────────────────────────
  sectionTitle('Personal Details');
  detailRow('Date of Birth', fmtDate(profile.dateOfBirth));
  detailRow('Height', cmToFeet(profile.height));
  detailRow('Marital Status', cap(profile.maritalStatus));
  detailRow('Mother Tongue', cap(profile.motherTongue));
  detailRow('City', [cap(profile.city), cap(profile.state)].filter(Boolean).join(', '));

  // ── Horoscope ───────────────────────────────────────────
  if (profile.rashi || profile.nakshatra || profile.manglikStatus || profile.gotra || profile.timeOfBirth || profile.placeOfBirth) {
    sectionTitle('Horoscope Details');
    detailRow('Rashi', cap(profile.rashi));
    detailRow('Nakshatra', cap(profile.nakshatra));
    detailRow('Manglik', cap(profile.manglikStatus));
    detailRow('Gotra', cap(profile.gotra));
    detailRow('Time of Birth', profile.timeOfBirth || null);
    detailRow('Place of Birth', cap(profile.placeOfBirth));
  }

  // ── Religion & community ────────────────────────────────
  if (profile.religion || profile.caste) {
    sectionTitle('Religion & Community');
    detailRow('Religion', cap(profile.religion));
    detailRow('Caste', cap(profile.caste));
    detailRow('Sub-caste', cap(profile.subCaste));
  }

  // ── Education & career ──────────────────────────────────
  sectionTitle('Education & Career');
  detailRow('Education', profile.education || null);
  detailRow('Profession', profile.profession || null);
  detailRow('Company', profile.company || null);
  detailRow('Annual Income', fmtIncome(profile.income));

  // ── Family ──────────────────────────────────────────────
  const fam = profile.familyDetails || {};
  if (Object.keys(fam).length || profile.familyType || profile.familyValues) {
    sectionTitle('Family Details');
    detailRow('Family Type', cap(profile.familyType));
    detailRow('Family Values', cap(profile.familyValues));
    detailRow("Father's Occupation", fam.fatherOccupation || null);
    detailRow("Mother's Occupation", fam.motherOccupation || null);
    detailRow('Brothers', fam.brothers != null ? String(fam.brothers) : null);
    detailRow('Sisters', fam.sisters != null ? String(fam.sisters) : null);
    detailRow('Family Location', fam.familyLocation || null);
  }

  // ── Lifestyle ───────────────────────────────────────────
  if (profile.diet || profile.smoking || profile.drinking) {
    sectionTitle('Lifestyle');
    detailRow('Diet', cap(profile.diet));
    detailRow('Smoking', cap(profile.smoking));
    detailRow('Drinking', cap(profile.drinking));
  }

  // ── NRI (conditional) ───────────────────────────────────
  if (profile.nriStatus || profile.countryOfResidence) {
    sectionTitle('NRI Details');
    detailRow('Residing In', cap(profile.countryOfResidence));
    detailRow('Visa Status', cap(profile.visaStatus));
  }

  // ── About ───────────────────────────────────────────────
  if (profile.aboutMe) {
    sectionTitle('About');
    paragraph(profile.aboutMe);
  }

  // ── Footer (every page gets one via the range loop) ─────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor(T.faint).text(
      'Made with TricityMatch — tricitymatch.com',
      LEFT,
      812,
      { width: RIGHT - LEFT, align: 'center', lineBreak: false }
    );
  }

  doc.end();
};

module.exports = { generateBiodataPDF, TEMPLATES };
