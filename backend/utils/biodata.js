/**
 * Marriage Biodata PDF Generator (D5 — flagship).
 *
 * Streams a shareable biodata PDF of the member's OWN profile using pdfkit,
 * modeled on utils/kundli.js / utils/invoice.js. Free for every tier: the
 * "Made with TricityMatch" footer on a PDF that gets WhatsApp-forwarded
 * through family networks is the acquisition loop.
 *
 * Two genuinely different layouts over ONE list of sections (buildSections),
 * so what is printed can never drift between them:
 *   classic  "Traditional": framed page, everything centred, serif type,
 *            "Label : value" rows. The sheet families print and pass around.
 *   modern   "Modern": coloured sidebar with the photo and identity, sans-serif,
 *            two-column detail grid. Reads well on a phone screen.
 * (The ids stay classic/modern: shipped mobile builds send them.)
 *
 * Currency renders as "Rs." (pdfkit's default fonts have no ₹ glyph).
 * Photo arrives as a pre-fetched JPEG buffer (controller fetches with a 2s
 * timeout and a Cloudinary f_jpg transform — pdfkit cannot decode webp — and
 * skips silently on failure; the PDF must never block on the CDN).
 */

const PDFDocument = require('pdfkit');
const { pdfSafe } = require('./pdfText');
const { placeLabel } = require('./tricityState');

const BRAND = {
  burgundy: '#8B2346',
  burgundyDeep: '#6E1B37',
  gold: '#C9A227',
  heading: '#1a1a2e',
  body: '#374151',
  muted: '#6b7280',
  faint: '#9ca3af',
  onAccent: '#FFFFFF',
  onAccentSoft: '#F3D9E2',
};

// Kept for the controller's template whitelist.
const TEMPLATES = {
  classic: { id: 'classic', label: 'Traditional' },
  modern: { id: 'modern', label: 'Modern' },
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;

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

const shortHeight = (cm) => {
  const n = parseInt(cm, 10);
  if (!Number.isFinite(n) || n < 100) return null;
  const totalIn = Math.round(n / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
};

// The stored state is never printed: it defaulted to "Punjab" for everyone. The
// state comes from the city instead ("Panchkula, Haryana"), Chandigarh reads
// just "Chandigarh", and a city we cannot place is printed on its own.
const placeOf = (profile) => placeLabel(cap(profile.city));

// "Rs." — deliberately not ₹ (missing from pdfkit's built-in fonts).
const fmtIncome = (income) => {
  if (!income) return null;
  const s = String(income).replace(/₹/g, 'Rs. ');
  return /^\d+$/.test(s) ? `Rs. ${Number(s).toLocaleString('en-IN')}` : s;
};

/**
 * Everything the biodata says, in order, as data. Rows whose value is empty are
 * dropped here, and a section with nothing left is dropped entirely, so neither
 * layout prints "—" walls or empty headings.
 */
const buildSections = (profile) => {
  const sections = [];
  const add = (title, rows, opts = {}) => {
    const kept = rows
      .map(([label, value]) => [label, value === null || value === undefined ? '' : pdfSafe(value)])
      .filter(([, value]) => value !== '');
    if (opts.paragraph) {
      const text = pdfSafe(opts.paragraph);
      if (text) sections.push({ title, rows: [], paragraph: text });
      return;
    }
    if (kept.length) sections.push({ title, rows: kept });
  };

  add('Personal Details', [
    ['Date of Birth', fmtDate(profile.dateOfBirth)],
    ['Height', cmToFeet(profile.height)],
    ['Marital Status', cap(profile.maritalStatus)],
    ['Mother Tongue', cap(profile.motherTongue)],
    ['Nationality', cap(profile.nationality)],
    ['City', placeOf(profile)],
  ]);

  add('Horoscope Details', [
    ['Rashi', cap(profile.rashi)],
    ['Nakshatra', cap(profile.nakshatra)],
    ['Manglik', cap(profile.manglikStatus)],
    ['Gotra', cap(profile.gotra)],
    ['Time of Birth', profile.birthTime || null],
    ['Place of Birth', cap(profile.placeOfBirth)],
  ]);

  add('Religion & Community', [
    ['Religion', cap(profile.religion)],
    ['Caste', cap(profile.caste)],
    ['Sub-caste', cap(profile.subCaste)],
  ]);

  add('Education & Career', [
    ['Education', profile.education || null],
    ['Institution', profile.institution || null],
    ['Profession', profile.profession || null],
    ['Industry', profile.industry || null],
    ['Annual Income', fmtIncome(profile.income)],
  ]);

  // Family fields are flat columns on the profile (there is no familyDetails
  // object). 0 is an answer ("no brothers"), so test for null, not falsy.
  add('Family Details', [
    ['Family Type', cap(profile.familyType)],
    ['Family Values', cap(profile.familyValues)],
    ['Family Status', cap(profile.familyStatus)],
    ["Father's Occupation", profile.fatherOccupation || null],
    ["Mother's Occupation", profile.motherOccupation || null],
    ['Brothers', profile.brothers != null ? String(profile.brothers) : null],
    ['Sisters', profile.sisters != null ? String(profile.sisters) : null],
    ['Family Location', profile.familyLocation || null],
  ]);

  add('Lifestyle', [
    ['Diet', cap(profile.diet)],
    ['Smoking', cap(profile.smoking)],
    ['Drinking', cap(profile.drinking)],
  ]);

  if (profile.isNri || profile.residenceCountry) {
    add('NRI Details', [
      ['Residing In', cap(profile.residenceCountry)],
      ['Residency Status', cap(profile.residenceStatus)],
    ]);
  }

  add('About', [], { paragraph: profile.bio });
  return sections;
};

const identityOf = (profile) => {
  const name = pdfSafe(`${profile.firstName || ''} ${profile.lastName || ''}`, 'Member');
  const age = calcAge(profile.dateOfBirth);
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'M';
  return { name, age, initials };
};

const FOOTER_TEXT = 'Made with TricityMatch — tricitymatch.com';

// ─────────────────────────────────────────────────────────────────────────────
// Traditional: framed, centred, serif. "Label : value".
// ─────────────────────────────────────────────────────────────────────────────
const renderTraditional = (doc, { profile, photoBuffer, profileCode }) => {
  const LEFT = 62;
  const RIGHT = PAGE_W - 62;
  const CENTRE = PAGE_W / 2;
  const BOTTOM = PAGE_H - 78;
  const LABEL_X = LEFT + 8;
  const LABEL_W = 150;
  const COLON_X = LABEL_X + LABEL_W + 4;
  const VALUE_X = COLON_X + 12;
  const VALUE_W = RIGHT - VALUE_X;
  const { name, age } = identityOf(profile);
  let y = 50;

  const ornamentLine = (yy, text, font, size, color) => {
    doc.font(font).fontSize(size);
    const w = doc.widthOfString(text, { characterSpacing: 1.5 });
    doc.fillColor(color).text(text, CENTRE - w / 2, yy, { characterSpacing: 1.5, lineBreak: false });
    const midY = yy + size / 2 + 1;
    doc.moveTo(LEFT, midY).lineTo(CENTRE - w / 2 - 12, midY).lineWidth(0.6).strokeColor(BRAND.gold).stroke();
    doc.moveTo(CENTRE + w / 2 + 12, midY).lineTo(RIGHT, midY).lineWidth(0.6).strokeColor(BRAND.gold).stroke();
  };

  const continuationHeader = () => {
    doc.font('Times-Italic').fontSize(9).fillColor(BRAND.muted)
      .text(`Marriage Biodata · ${name}`, LEFT, 44, { width: RIGHT - LEFT, align: 'center' });
    y = 70;
  };

  const ensureSpace = (needed) => {
    if (y + needed <= BOTTOM) return;
    doc.addPage();
    continuationHeader();
  };

  // ── Title, photo, identity ──
  ornamentLine(y, 'MARRIAGE BIODATA', 'Times-Bold', 15, BRAND.burgundy);
  y += 34;

  if (photoBuffer) {
    const w = 118;
    const h = 140;
    const x = CENTRE - w / 2;
    try {
      doc.image(photoBuffer, x, y, { fit: [w, h], align: 'center', valign: 'center' });
      doc.rect(x - 4, y - 4, w + 8, h + 8).lineWidth(0.8).strokeColor(BRAND.gold).stroke();
      y += h + 16;
    } catch {
      // Undecodable buffer — render without the photo rather than crash the stream.
    }
  }

  doc.font('Times-Bold').fontSize(22).fillColor(BRAND.heading)
    .text(name, LEFT, y, { width: RIGHT - LEFT, align: 'center' });
  y = doc.y + 2;
  const subtitle = [age ? `${age} years` : null, cap(profile.maritalStatus), cap(profile.city)].filter(Boolean).join('  ·  ');
  if (subtitle) {
    doc.font('Times-Italic').fontSize(11.5).fillColor(BRAND.muted)
      .text(subtitle, LEFT, y, { width: RIGHT - LEFT, align: 'center' });
    y = doc.y + 2;
  }
  if (profileCode) {
    doc.font('Times-Roman').fontSize(9).fillColor(BRAND.faint)
      .text(`Profile ID: ${profileCode}`, LEFT, y, { width: RIGHT - LEFT, align: 'center' });
    y = doc.y;
  }
  y += 8;

  // ── Sections ──
  for (const section of buildSections(profile)) {
    ensureSpace(48);
    y += 12;
    ornamentLine(y, section.title.toUpperCase(), 'Times-Bold', 11, BRAND.burgundy);
    y += 22;

    if (section.paragraph) {
      doc.font('Times-Roman').fontSize(11);
      const h = doc.heightOfString(section.paragraph, { width: RIGHT - LEFT - 16, align: 'justify' }) + 4;
      ensureSpace(h);
      doc.fillColor(BRAND.body).text(section.paragraph, LEFT + 8, y, { width: RIGHT - LEFT - 16, align: 'justify' });
      y += h;
      continue;
    }

    for (const [label, value] of section.rows) {
      doc.font('Times-Roman').fontSize(11);
      const rowH = Math.max(17, doc.heightOfString(value, { width: VALUE_W }) + 5);
      ensureSpace(rowH);
      doc.font('Times-Bold').fontSize(11).fillColor(BRAND.heading).text(label, LABEL_X, y, { width: LABEL_W });
      doc.font('Times-Bold').fillColor(BRAND.gold).text(':', COLON_X, y, { lineBreak: false });
      doc.font('Times-Roman').fontSize(11).fillColor(BRAND.body).text(value, VALUE_X, y, { width: VALUE_W });
      y += rowH;
    }
  }

  // ── Frame + footer on every page ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.rect(18, 18, PAGE_W - 36, PAGE_H - 36).lineWidth(1.6).strokeColor(BRAND.burgundy).stroke();
    doc.rect(25, 25, PAGE_W - 50, PAGE_H - 50).lineWidth(0.6).strokeColor(BRAND.gold).stroke();
    doc.font('Times-Italic').fontSize(8).fillColor(BRAND.faint)
      .text(FOOTER_TEXT, LEFT, PAGE_H - 52, { width: RIGHT - LEFT, align: 'center', lineBreak: false });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Modern: coloured sidebar with photo + identity, sans-serif two-column grid.
// ─────────────────────────────────────────────────────────────────────────────
const renderModern = (doc, { profile, photoBuffer, profileCode }) => {
  const SIDEBAR_W = 182;
  const LEFT = SIDEBAR_W + 26;
  const RIGHT = PAGE_W - 34;
  const BOTTOM = PAGE_H - 60;
  const GAP = 18;
  const COL_W = (RIGHT - LEFT - GAP) / 2;
  const { name, age, initials } = identityOf(profile);
  let y = 40;

  const sidebar = () => {
    doc.rect(0, 0, SIDEBAR_W, PAGE_H).fill(BRAND.burgundy);
  };

  const ensureSpace = (needed) => {
    if (y + needed <= BOTTOM) return;
    doc.addPage();
    sidebar();
    y = 44;
  };

  // ── Sidebar, first page ──
  sidebar();
  const SX = 22;
  const SW = SIDEBAR_W - 44;
  let sy = 40;
  if (photoBuffer) {
    const h = 172;
    try {
      doc.save();
      doc.roundedRect(SX, sy, SW, h, 10).clip();
      doc.rect(SX, sy, SW, h).fill(BRAND.burgundyDeep);
      doc.image(photoBuffer, SX, sy, { cover: [SW, h], align: 'center', valign: 'center' });
      doc.restore();
      sy += h + 18;
    } catch {
      doc.restore();
    }
  }
  if (sy === 40) {
    // No photo: an initials disc so the sidebar is never an empty block.
    doc.circle(SIDEBAR_W / 2, sy + 52, 48).fill(BRAND.burgundyDeep);
    doc.font('Helvetica-Bold').fontSize(30).fillColor(BRAND.onAccent)
      .text(initials, 0, sy + 38, { width: SIDEBAR_W, align: 'center', lineBreak: false });
    sy += 122;
  }

  doc.font('Helvetica-Bold').fontSize(17).fillColor(BRAND.onAccent).text(name, SX, sy, { width: SW });
  sy = doc.y + 4;
  const lineOne = [age ? `${age} yrs` : null, shortHeight(profile.height)].filter(Boolean).join('  ·  ');
  if (lineOne) {
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.onAccentSoft).text(lineOne, SX, sy, { width: SW });
    sy = doc.y + 2;
  }
  const place = placeOf(profile);
  if (place) {
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.onAccentSoft).text(place, SX, sy, { width: SW });
    sy = doc.y + 2;
  }

  // "At a glance": the facts a family scans for first.
  const glance = [
    ['Religion', [cap(profile.religion), cap(profile.caste)].filter(Boolean).join(' · ')],
    ['Mother tongue', cap(profile.motherTongue)],
    ['Education', profile.education || null],
    ['Profession', profile.profession || null],
  ].map(([l, v]) => [l, v ? pdfSafe(v) : '']).filter(([, v]) => v);
  if (glance.length) {
    sy += 18;
    doc.moveTo(SX, sy).lineTo(SX + SW, sy).lineWidth(0.5).strokeColor(BRAND.onAccentSoft).stroke();
    sy += 12;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND.onAccentSoft)
      .text('AT A GLANCE', SX, sy, { characterSpacing: 1.2 });
    sy += 16;
    for (const [label, value] of glance) {
      doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.onAccentSoft).text(label, SX, sy, { width: SW });
      sy = doc.y + 1;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.onAccent).text(value, SX, sy, { width: SW });
      sy = doc.y + 9;
    }
  }
  if (profileCode) {
    doc.font('Helvetica').fontSize(8).fillColor(BRAND.onAccentSoft)
      .text(`Profile ID\n${profileCode}`, SX, PAGE_H - 92, { width: SW });
  }

  // ── Main column ──
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BRAND.burgundy)
    .text('MARRIAGE BIODATA', LEFT, y, { characterSpacing: 2 });
  y += 14;
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor('#E5E7EB').stroke();
  y += 12;

  const cellHeight = (label, value) => {
    doc.font('Helvetica').fontSize(10.5);
    return 12 + doc.heightOfString(value, { width: COL_W });
  };
  const cell = (x, label, value) => {
    doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted).text(label, x, y, { width: COL_W, characterSpacing: 0.3 });
    doc.font('Helvetica').fontSize(10.5).fillColor(BRAND.heading).text(value, x, y + 11, { width: COL_W });
  };

  for (const section of buildSections(profile)) {
    ensureSpace(46);
    y += 10;
    doc.rect(LEFT, y + 1, 3, 11).fill(BRAND.burgundy);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BRAND.heading)
      .text(section.title.toUpperCase(), LEFT + 10, y, { characterSpacing: 1 });
    y += 22;

    if (section.paragraph) {
      doc.font('Helvetica').fontSize(10.5);
      const h = doc.heightOfString(section.paragraph, { width: RIGHT - LEFT, lineGap: 2 }) + 6;
      ensureSpace(h);
      doc.fillColor(BRAND.body).text(section.paragraph, LEFT, y, { width: RIGHT - LEFT, lineGap: 2 });
      y += h;
      continue;
    }

    for (let i = 0; i < section.rows.length; i += 2) {
      const a = section.rows[i];
      const b = section.rows[i + 1];
      const rowH = Math.max(cellHeight(...a), b ? cellHeight(...b) : 0) + 9;
      ensureSpace(rowH);
      cell(LEFT, a[0], a[1]);
      if (b) cell(LEFT + COL_W + GAP, b[0], b[1]);
      y += rowH;
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.faint)
      .text(FOOTER_TEXT, LEFT, PAGE_H - 34, { width: RIGHT - LEFT, align: 'right', lineBreak: false });
  }
};

/**
 * Generate + stream the biodata PDF.
 * @param {import('http').ServerResponse} res
 * @param {{ profile: object, template?: 'classic'|'modern', photoBuffer?: Buffer|null, profileCode?: string|null }} data
 */
const generateBiodataPDF = (res, data) => {
  const { profile, photoBuffer = null, profileCode = null } = data;
  const template = TEMPLATES[data.template] ? data.template : 'classic';

  // bufferPages so the frame/footer loop can revisit every page before end().
  const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="biodata-tricitymatch-${template === 'modern' ? 'modern' : 'traditional'}.pdf"`);

  doc.pipe(res);
  const render = template === 'modern' ? renderModern : renderTraditional;
  render(doc, { profile, photoBuffer, profileCode });
  doc.end();
};

module.exports = { generateBiodataPDF, buildSections, TEMPLATES };
