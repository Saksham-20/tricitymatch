/**
 * ========================================================================
 * QA REPORT GENERATOR  –  TricityMatch QA Suite
 * ========================================================================
 * Reads all individual JSON reports from qa-reports/ and assembles
 * a single, self-contained HTML report with:
 *  • Executive summary
 *  • Per-category findings
 *  • Severity-based issue list
 *  • Screenshot gallery
 *  • Suggested fixes with code snippets
 *
 * Run after all tests:
 *   node e2e/utils/generate-report.js
 * ========================================================================
 */
const fs   = require('fs');
const path = require('path');

const REPORTS_DIR       = path.join(process.cwd(), 'qa-reports');
const SCREENSHOT_DIR    = path.join(REPORTS_DIR, 'screenshots');
const OUTPUT_FILE       = path.join(REPORTS_DIR, 'QA-REPORT.html');

// ── Load individual reports ───────────────────────────────────────────────────
function readReport(filename) {
  const fp = path.join(REPORTS_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

// ── Screenshot list (relative paths) ─────────────────────────────────────────
function getAllScreenshots() {
  const shots = [];
  if (!fs.existsSync(SCREENSHOT_DIR)) return shots;

  function walk(dir, rel) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const r    = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, r);
      else if (e.name.endsWith('.png')) shots.push(r);
    }
  }
  walk(SCREENSHOT_DIR, '');
  return shots;
}

// ── Severity badge ────────────────────────────────────────────────────────────
function badge(severity) {
  const map = {
    critical: '#dc2626', serious: '#ea580c',
    moderate: '#d97706', minor: '#65a30d',
    info:     '#0ea5e9', warning: '#f59e0b',
  };
  const color = map[severity] || '#6b7280';
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase">${severity}</span>`;
}

// ── Build HTML ────────────────────────────────────────────────────────────────
function buildHTML(data) {
  const { crawl, errors, a11y, perf, assets, screenshots } = data;

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const crawlSummary = crawl ? `
    <tr><td>Pages Crawled</td><td><strong>${crawl.summary.totalVisited}</strong></td></tr>
    <tr><td>Console Errors</td><td class="${crawl.summary.totalErrors > 0 ? 'warn' : 'ok'}">${crawl.summary.totalErrors}</td></tr>
    <tr><td>Network Failures</td><td class="${crawl.summary.totalNetworkFailures > 0 ? 'warn' : 'ok'}">${crawl.summary.totalNetworkFailures}</td></tr>
    <tr><td>Broken Images</td><td class="${crawl.summary.totalBrokenImages > 0 ? 'fail' : 'ok'}">${crawl.summary.totalBrokenImages}</td></tr>
    <tr><td>Overflow Elements</td><td class="${crawl.summary.totalOverflows > 0 ? 'warn' : 'ok'}">${crawl.summary.totalOverflows}</td></tr>
  ` : '<tr><td colspan="2">Crawl report not found – run 02-crawler.spec.js</td></tr>';

  const a11ySummary = a11y ? `
    <tr><td>Total Violations</td><td class="${a11y.totalViolations > 0 ? 'warn' : 'ok'}">${a11y.totalViolations}</td></tr>
    <tr><td>Critical Violations</td><td class="${a11y.criticalViolations > 0 ? 'fail' : 'ok'}">${a11y.criticalViolations}</td></tr>
    <tr><td>Standard</td><td>${a11y.standard}</td></tr>
  ` : '<tr><td colspan="2">Accessibility report not found</td></tr>';

  const perfRows = perf ? perf.pages.map(p => `
    <tr>
      <td>${p.name}</td>
      <td class="${p.vitals.fcp > 3000 ? 'warn' : 'ok'}">${Math.round(p.vitals.fcp)}ms</td>
      <td class="${p.vitals.lcp > 4000 ? 'warn' : 'ok'}">${Math.round(p.vitals.lcp)}ms</td>
      <td class="${p.vitals.cls > 0.1 ? 'warn' : 'ok'}">${p.vitals.cls.toFixed(3)}</td>
      <td class="${p.resources.totalSizeKB > 3000 ? 'warn' : 'ok'}">${p.resources.totalSizeKB} KB</td>
      <td>${p.resources.totalRequests}</td>
    </tr>
  `).join('') : '<tr><td colspan="6">Performance report not found</td></tr>';

  const a11yViolations = a11y ? a11y.pages.flatMap(p =>
    p.violations.map(v => `
      <tr>
        <td><a href="${p.path}">${p.path}</a></td>
        <td>${badge(v.impact || 'moderate')}</td>
        <td><code>${v.id}</code></td>
        <td>${v.description}</td>
        <td><a href="${v.helpUrl}" target="_blank">Fix →</a></td>
      </tr>
    `)
  ).join('') : '';

  const crawlErrors = crawl ? crawl.pages.filter(p =>
    p.consoleErrors.length > 0 || p.networkFailures.length > 0
  ).map(p => `
    <tr>
      <td><a href="${p.url}">${p.url}</a></td>
      <td class="${p.consoleErrors.length > 0 ? 'fail' : 'ok'}">${p.consoleErrors.length} JS errors</td>
      <td class="${p.networkFailures.length > 0 ? 'warn' : 'ok'}">${p.networkFailures.length} net errors</td>
      <td class="${p.brokenImages.length > 0 ? 'fail' : 'ok'}">${p.brokenImages.length} broken imgs</td>
      <td class="${p.overflowElements.length > 0 ? 'warn' : 'ok'}">${p.overflowElements.length} overflows</td>
      <td>${p.loadTimeMs}ms</td>
    </tr>
  `).join('') : '';

  const screenshotGallery = screenshots.length > 0 ? `
    <div class="gallery">
      ${screenshots.slice(0, 60).map(s => `
        <div class="thumb">
          <img src="screenshots/${s}" loading="lazy" alt="${s}" onclick="openLightbox(this.src)"/>
          <p>${s.replace(/[_]/g, ' ').slice(0, 40)}</p>
        </div>
      `).join('')}
    </div>
  ` : '<p>No screenshots found – run the visual audit tests first.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TricityMatch – QA Report</title>
  <style>
    :root {
      --brand: #ec4899;
      --ok: #16a34a;
      --warn: #d97706;
      --fail: #dc2626;
      --bg: #f9fafb;
      --card: #ffffff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background: var(--bg); color: #1f2937; }
    header { background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; padding: 2rem 3rem; }
    header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    header p { opacity: 0.85; }
    main { max-width: 1400px; margin: 0 auto; padding: 2rem 3rem; }
    section { background: var(--card); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    h2 { font-size: 1.25rem; color: #111827; margin-bottom: 1rem; border-bottom: 2px solid #f3f4f6; padding-bottom: .5rem; }
    h3 { font-size: 1rem; color: #374151; margin-bottom: .75rem; margin-top: 1.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    th { background: #f8fafc; text-align: left; padding: .5rem .75rem; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
    td { padding: .5rem .75rem; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr:hover td { background: #fafafa; }
    .ok   { color: var(--ok); font-weight: 600; }
    .warn { color: var(--warn); font-weight: 600; }
    .fail { color: var(--fail); font-weight: 600; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(200px,1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-card { background: #f8fafc; border-radius: 8px; padding: 1.25rem; text-align: center; border: 1px solid #e5e7eb; }
    .stat-card .num { font-size: 2rem; font-weight: 700; }
    .stat-card .label { font-size: .8rem; color: #6b7280; margin-top: .25rem; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap: 1rem; }
    .thumb { border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .thumb img { width: 100%; height: 140px; object-fit: cover; cursor: pointer; transition: transform .2s; }
    .thumb img:hover { transform: scale(1.03); }
    .thumb p { padding: .4rem .6rem; font-size: .75rem; color: #6b7280; background: #f9fafb; }
    code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: .85em; }
    a { color: #7c3aed; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .fix-section { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 1rem 1.25rem; border-radius: 0 8px 8px 0; margin-bottom: 1rem; }
    .fix-section h4 { font-size: .9rem; color: #92400e; margin-bottom: .5rem; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: .8rem; margin-top: .5rem; }
    .lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.85); z-index: 1000; align-items: center; justify-content: center; }
    .lightbox.open { display: flex; }
    .lightbox img { max-width: 90vw; max-height: 90vh; border-radius: 8px; }
    .lightbox-close { position: fixed; top: 1rem; right: 1.5rem; color: white; font-size: 2rem; cursor: pointer; }
    @media (max-width: 768px) { main { padding: 1rem; } header { padding: 1.5rem; } }
  </style>
</head>
<body>
<header>
  <h1>🎯 TricityMatch – QA Audit Report</h1>
  <p>Generated: ${now} &nbsp;|&nbsp; Automated by Playwright + axe-core</p>
</header>

<main>

<!-- ── EXECUTIVE SUMMARY ──────────────────────────────────────────────────── -->
<section>
  <h2>📊 Executive Summary</h2>
  <div class="summary-grid">
    <div class="stat-card">
      <div class="num ${crawl?.summary?.totalErrors > 0 ? 'fail' : 'ok'}">${crawl?.summary?.totalErrors ?? '–'}</div>
      <div class="label">Console Errors</div>
    </div>
    <div class="stat-card">
      <div class="num ${crawl?.summary?.totalBrokenImages > 0 ? 'fail' : 'ok'}">${crawl?.summary?.totalBrokenImages ?? '–'}</div>
      <div class="label">Broken Images</div>
    </div>
    <div class="stat-card">
      <div class="num ${a11y?.criticalViolations > 0 ? 'fail' : 'ok'}">${a11y?.criticalViolations ?? '–'}</div>
      <div class="label">Critical A11y Violations</div>
    </div>
    <div class="stat-card">
      <div class="num ${crawl?.summary?.totalNetworkFailures > 0 ? 'warn' : 'ok'}">${crawl?.summary?.totalNetworkFailures ?? '–'}</div>
      <div class="label">Network Failures</div>
    </div>
    <div class="stat-card">
      <div class="num">${crawl?.summary?.totalVisited ?? '–'}</div>
      <div class="label">Pages Crawled</div>
    </div>
    <div class="stat-card">
      <div class="num">${perf ? Math.round(perf.pages[0]?.vitals.fcp ?? 0) + 'ms' : '–'}</div>
      <div class="label">Homepage FCP</div>
    </div>
  </div>
</section>

<!-- ── CRAWL RESULTS ──────────────────────────────────────────────────────── -->
<section>
  <h2>🕷 Crawler Results</h2>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>${crawlSummary}</tbody>
  </table>

  <h3>Per-Page Status</h3>
  <table>
    <thead><tr><th>URL</th><th>JS Errors</th><th>Network Errors</th><th>Broken Images</th><th>Overflows</th><th>Load Time</th></tr></thead>
    <tbody>${crawlErrors || '<tr><td colspan="6">No errors found – all clean ✓</td></tr>'}</tbody>
  </table>
</section>

<!-- ── ACCESSIBILITY ──────────────────────────────────────────────────────── -->
<section>
  <h2>♿ Accessibility Audit (WCAG 2.1 AA)</h2>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>${a11ySummary}</tbody>
  </table>

  <h3>Violations by Page</h3>
  <table>
    <thead><tr><th>Page</th><th>Severity</th><th>Rule ID</th><th>Description</th><th>Fix</th></tr></thead>
    <tbody>${a11yViolations || '<tr><td colspan="5">No violations found ✓</td></tr>'}</tbody>
  </table>
</section>

<!-- ── PERFORMANCE ────────────────────────────────────────────────────────── -->
<section>
  <h2>⚡ Performance Audit</h2>
  <table>
    <thead><tr><th>Page</th><th>FCP (&lt;3s)</th><th>LCP (&lt;4s)</th><th>CLS (&lt;0.1)</th><th>Size (&lt;5MB)</th><th>Requests</th></tr></thead>
    <tbody>${perfRows}</tbody>
  </table>
</section>

<!-- ── SUGGESTED FIXES ────────────────────────────────────────────────────── -->
<section>
  <h2>🔧 Suggested Fixes</h2>

  <div class="fix-section">
    <h4>🖼 Missing alt text on images (Accessibility)</h4>
    <p>All <code>&lt;img&gt;</code> elements must have descriptive alt text for screen readers.</p>
    <pre>&lt;!-- ❌ Bad --&gt;
&lt;img src="/profile.jpg" /&gt;

&lt;!-- ✅ Good --&gt;
&lt;img src="/profile.jpg" alt="Profile photo of Priya Sharma" /&gt;

&lt;!-- ✅ Decorative images: use empty alt --&gt;
&lt;img src="/divider.svg" alt="" role="presentation" /&gt;</pre>
  </div>

  <div class="fix-section">
    <h4>📱 Horizontal overflow on mobile (Layout)</h4>
    <p>Elements poking outside the viewport on mobile cause a horizontal scrollbar.</p>
    <pre>/* ❌ Common cause */
.container { width: 1200px; }

/* ✅ Fix */
.container { max-width: 1200px; width: 100%; padding: 0 1rem; }

/* ✅ Global safety net (add to your index.css) */
html, body { overflow-x: hidden; }
* { max-width: 100%; }</pre>
  </div>

  <div class="fix-section">
    <h4>⌨ Visible focus ring (Accessibility)</h4>
    <p>Focus indicators are required for keyboard users and WCAG 2.1.</p>
    <pre>/* ❌ Never do this globally */
* { outline: none; }

/* ✅ Keep focus rings with custom style */
:focus-visible {
  outline: 2px solid #ec4899;
  outline-offset: 2px;
  border-radius: 4px;
}

/* ✅ Tailwind utility */
className="focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"</pre>
  </div>

  <div class="fix-section">
    <h4>⚡ Large JavaScript bundles (Performance)</h4>
    <p>Split your code to reduce initial bundle size and improve FCP.</p>
    <pre>// ✅ Already done in App.jsx via lazy() – good!
// Ensure all page-level imports are lazy-loaded:
const Dashboard = lazy(() => import('./pages/Dashboard'));

// ✅ Also lazy-load heavy components (e.g., charts, rich text editors)
const CompatibilityChart = lazy(() => import('./components/CompatibilityChart'));

// ✅ Add loading state for Suspense boundary
&lt;Suspense fallback={&lt;Skeleton /&gt;}&gt;
  &lt;Dashboard /&gt;
&lt;/Suspense&gt;</pre>
  </div>

  <div class="fix-section">
    <h4>🌏 HTML lang attribute (Accessibility + SEO)</h4>
    <p>Without a <code>lang</code> attr, screen readers guess the language.</p>
    <pre>&lt;!-- In index.html --&gt;
&lt;!-- ❌ --&gt;
&lt;html&gt;

&lt;!-- ✅ --&gt;
&lt;html lang="en"&gt;

&lt;!-- Or for Hindi content sections --&gt;
&lt;p lang="hi"&gt;हिन्दी सामग्री&lt;/p&gt;</pre>
  </div>

  <div class="fix-section">
    <h4>🎨 Colour contrast (Accessibility)</h4>
    <p>Text must meet minimum contrast ratios: 4.5:1 for normal text, 3:1 for large text.</p>
    <pre>/* ❌ Low contrast */
.subtitle { color: #aaa; background: #fff; } /* ratio ≈ 2.3:1 */

/* ✅ Accessible */
.subtitle { color: #6b7280; background: #fff; } /* ratio ≈ 4.6:1 */

/* ✅ Tailwind tokens that pass AA */
/* text-gray-600 on white  → 4.6:1 */
/* text-pink-700 on white  → 4.5:1 */
/* text-indigo-600 on white → 4.6:1 */</pre>
  </div>

  <div class="fix-section">
    <h4>📱 Add Web App Manifest (PWA / SEO)</h4>
    <p>A manifest improves discoverability and enables "Add to Home Screen".</p>
    <pre>// public/manifest.json
{
  "name": "TricityMatch",
  "short_name": "TricityMatch",
  "description": "Tricity's Premier Matrimonial Platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ec4899",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}

// In index.html
&lt;link rel="manifest" href="/manifest.json" /&gt;</pre>
  </div>

  <div class="fix-section">
    <h4>🔗 Form labels (Accessibility)</h4>
    <p>Every form input needs an associated label for screen readers.</p>
    <pre>&lt;!-- ❌ Placeholder is not a label --&gt;
&lt;input type="email" placeholder="Enter your email" /&gt;

&lt;!-- ✅ Proper label --&gt;
&lt;label htmlFor="email"&gt;Email address&lt;/label&gt;
&lt;input id="email" type="email" placeholder="you@example.com" /&gt;

&lt;!-- ✅ Or aria-label if label is not visible --&gt;
&lt;input type="search" aria-label="Search profiles" /&gt;</pre>
  </div>
</section>

<!-- ── SCREENSHOT GALLERY ─────────────────────────────────────────────────── -->
<section>
  <h2>📸 Screenshot Gallery</h2>
  ${screenshotGallery}
</section>

</main>

<!-- Lightbox -->
<div class="lightbox" id="lightbox" onclick="closeLightbox()">
  <span class="lightbox-close">✕</span>
  <img id="lightbox-img" src="" alt=""/>
</div>

<script>
  function openLightbox(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('open');
  }
  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
</script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('\n📋 Generating QA HTML Report...\n');

  if (!fs.existsSync(REPORTS_DIR)) {
    console.error(`❌  qa-reports/ directory not found at ${REPORTS_DIR}`);
    console.error('   Run the Playwright tests first: npm run qa');
    process.exit(1);
  }

  const data = {
    crawl:       readReport('crawl-report.json'),
    errors:      readReport('error-report.json'),
    a11y:        readReport('accessibility-report.json'),
    perf:        readReport('performance-report.json'),
    assets:      readReport('broken-assets-report.json'),
    screenshots: getAllScreenshots(),
  };

  const found = Object.entries(data)
    .filter(([k, v]) => k !== 'screenshots' && v !== null)
    .map(([k]) => k);

  console.log(`   Reports found  : ${found.join(', ') || 'none'}`);
  console.log(`   Screenshots    : ${data.screenshots.length}`);

  const html = buildHTML(data);
  fs.writeFileSync(OUTPUT_FILE, html, 'utf8');

  console.log(`\n✅  Report written to: ${OUTPUT_FILE}`);
  console.log('   Open in browser: file://' + OUTPUT_FILE.replace(/\\/g, '/'));
}

main();
