#!/usr/bin/env node
/**
 * Custom PDF Resume Builder for Aby Mathew (4ofl.dev)
 * Compiles resume/resume-data.json into an ATS-compliant, print-perfect vector PDF.
 * Usage:
 *   node scripts/build-resume.js          # Compile once
 *   node scripts/build-resume.js --watch  # Watch resume-data.json and auto-recompile
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "resume", "resume-data.json");
const OUTPUT_PDF = path.join(ROOT, "resume.pdf");
const ASSET_PDF = path.join(ROOT, "assets", "aby_mathew_resume.pdf");
const HTML_TEMP = path.join(ROOT, ".resume_preview.html");

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Error: Data file not found at ${DATA_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function renderHtml(data) {
  const skillsHtml = data.skills
    .map(
      (s) =>
        `<div class="skill-row"><span class="skill-cat">${s.category}:</span> <span class="skill-items">${s.items}</span></div>`
    )
    .join("\n");

  const expHtml = data.experience
    .map((exp) => {
      const pts = exp.points.map((p) => `<li>${p}</li>`).join("\n");
      const linkHtml = exp.link
        ? `<a class="proj-link" href="${exp.link}">${exp.link.replace("https://", "")} ↗</a>`
        : "";
      return `
      <div class="exp-block">
        <div class="exp-header">
          <div class="exp-left">
            <span class="exp-title">${exp.name}</span>
            <span class="exp-role">${exp.role}</span>
          </div>
          <div class="exp-right">
            <span class="exp-date">${exp.date}</span>
            ${linkHtml}
          </div>
        </div>
        <div class="exp-highlight">${exp.highlight}</div>
        <ul class="exp-points">
          ${pts}
        </ul>
      </div>`;
    })
    .join("\n");

  const eduHtml = data.education
    .map(
      (edu) => `
      <div class="edu-block">
        <div class="exp-header">
          <div class="exp-left">
            <span class="exp-title">${edu.degree}</span>
            <span class="exp-role">${edu.institution}</span>
          </div>
          <div class="exp-right">
            <span class="exp-date">${edu.date}</span>
            <span class="exp-loc">${edu.location}</span>
          </div>
        </div>
        <div class="edu-notes">${edu.notes}</div>
      </div>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${data.name} — Resume</title>
<style>
@page {
  size: A4 portrait;
  margin: 10mm 12mm 8mm 12mm;
}
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #121316;
  background: #ffffff;
  font-size: 9pt;
  line-height: 1.34;
  -webkit-font-smoothing: antialiased;
  -webkit-print-color-adjust: exact;
}
a {
  color: #1a1a1c;
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
.resume-container {
  max-width: 100%;
}
.header {
  border-bottom: 1.5pt solid #1a1a1c;
  padding-bottom: 5pt;
  margin-bottom: 7pt;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.name {
  font-size: 20pt;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0b0b0d;
}
.contact-line {
  font-size: 8.5pt;
  color: #2b2b2e;
  font-family: "JetBrains Mono", Consolas, monospace;
}
.contact-line a {
  color: #0b0b0d;
  font-weight: 500;
}
.contact-line .sep {
  color: #a09f9a;
  margin: 0 4pt;
}
.title-line {
  margin-top: 2pt;
  font-size: 9.5pt;
  font-weight: 600;
  color: #333338;
}
.avail-tag {
  display: inline-block;
  margin-left: 6pt;
  font-size: 8pt;
  font-family: "JetBrains Mono", monospace;
  font-weight: 500;
  color: #8b3d22;
  background: #fbf1ed;
  padding: 1pt 5pt;
  border-radius: 2pt;
  border: 0.5pt solid #e8c4b6;
}
.summary {
  margin-top: 4pt;
  font-size: 8.7pt;
  line-height: 1.3;
  color: #3c3c42;
}
.section-title {
  font-size: 9.5pt;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #0b0b0d;
  border-bottom: 0.75pt solid #d0cfcb;
  padding-bottom: 1.5pt;
  margin-top: 7pt;
  margin-bottom: 4pt;
}
.skill-row {
  font-size: 8.7pt;
  line-height: 1.32;
  margin-bottom: 1.5pt;
}
.skill-cat {
  font-weight: 700;
  color: #151518;
}
.skill-items {
  color: #38383e;
}
.exp-block {
  margin-bottom: 5.5pt;
  page-break-inside: avoid;
}
.exp-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.exp-left {
  display: flex;
  align-items: baseline;
  gap: 5pt;
}
.exp-title {
  font-weight: 700;
  font-size: 9.5pt;
  color: #0b0b0d;
}
.exp-role {
  font-style: italic;
  font-size: 8.7pt;
  color: #4a4a50;
}
.exp-right {
  display: flex;
  align-items: baseline;
  gap: 6pt;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 8pt;
  color: #606066;
}
.proj-link {
  color: #7a3a24;
  font-weight: 500;
}
.exp-highlight {
  font-size: 8.5pt;
  font-weight: 500;
  color: #2b2b2e;
  margin-top: 1pt;
  margin-bottom: 1.5pt;
}
.exp-points {
  list-style: none;
  padding-left: 0;
}
.exp-points li {
  position: relative;
  padding-left: 9pt;
  font-size: 8.5pt;
  line-height: 1.28;
  color: #2d2d33;
  margin-bottom: 1.5pt;
}
.exp-points li::before {
  content: "▪";
  position: absolute;
  left: 0;
  color: #7a3a24;
  font-size: 8pt;
  line-height: 1;
  top: 1pt;
}
code {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 7.8pt;
  background: #f4f3f0;
  padding: 0 2pt;
  border-radius: 2pt;
  border: 0.4pt solid #e0dfda;
  color: #1a1a1c;
}
.edu-block {
  page-break-inside: avoid;
}
.edu-notes {
  font-size: 8.3pt;
  color: #55555c;
  margin-top: 1pt;
}
</style>
</head>
<body>
<div class="resume-container">
  <header class="header">
    <div class="header-top">
      <div class="name">${data.name}</div>
      <div class="contact-line">
        <a href="mailto:${data.email}">${data.email}</a>
        <span class="sep">/</span>
        <a href="${data.website}">${data.website.replace("https://", "")}</a>
        <span class="sep">/</span>
        <a href="${data.github}">${data.github.replace("https://", "")}</a>
        <span class="sep">/</span>
        <a href="${data.linkedin}">${data.linkedin.replace("https://", "")}</a>
      </div>
    </div>
    <div class="title-line">
      ${data.title}
      <span class="avail-tag">summer/fall '26</span>
    </div>
    <p class="summary">${data.summary}</p>
  </header>

  <section>
    <div class="section-title">Technical Skills &amp; Workbench</div>
    ${skillsHtml}
  </section>

  <section>
    <div class="section-title">Selected Engineering Projects</div>
    ${expHtml}
  </section>

  <section>
    <div class="section-title">Education &amp; Credentials</div>
    ${eduHtml}
  </section>
</div>
</body>
</html>`;
}

function findBrowser() {
  const envBrowser = process.env.CHROME_BIN || process.env.CHROMIUM_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envBrowser && fs.existsSync(envBrowser)) return envBrowser;

  const candidates = [
    // Windows
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    // Linux / CI (GitHub Actions ubuntu-latest)
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // Fallback: check PATH using `where` (Windows) or `which` (POSIX)
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const binary = process.platform === "win32" ? "chrome" : "google-chrome";
    const check = spawnSync(cmd, [binary], { encoding: "utf-8" });
    if (check.status === 0 && check.stdout) {
      const found = check.stdout.trim().split(/\r?\n/)[0];
      if (fs.existsSync(found)) return found;
    }
  } catch {}

  return null;
}

function compile() {
  const browser = findBrowser();
  if (!browser) {
    console.error("Error: Chromium/Edge not found.");
    return false;
  }

  try {
    const data = loadData();
    const html = renderHtml(data);
    fs.writeFileSync(HTML_TEMP, html, "utf-8");

    const t0 = Date.now();
    const res = spawnSync(browser, [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--no-pdf-header-footer",
      `--print-to-pdf=${OUTPUT_PDF}`,
      HTML_TEMP,
    ]);

    if (fs.existsSync(OUTPUT_PDF) && fs.statSync(OUTPUT_PDF).size > 0) {
      const size = fs.statSync(OUTPUT_PDF).size;
      if (fs.existsSync(HTML_TEMP)) fs.unlinkSync(HTML_TEMP);
      try {
        fs.copyFileSync(OUTPUT_PDF, ASSET_PDF);
      } catch (e) {
        console.warn(`[resume] Warning: Failed to mirror to ${path.relative(ROOT, ASSET_PDF)}:`, e.message);
      }
      const elapsed = Date.now() - t0;
      console.log(`[resume] Compiled resume.pdf (${size.toLocaleString()} bytes) in ${elapsed}ms`);
      return true;
    } else {
      console.error("[resume] Failed to generate PDF:", res.stderr ? res.stderr.toString() : "unknown error");
      return false;
    }
  } catch (err) {
    console.error("[resume] Compile error:", err.message);
    return false;
  }
}

function watch() {
  compile();
  console.log(`[watch] Watching ${path.relative(ROOT, DATA_FILE)} for changes...`);

  let debounceTimer = null;
  const triggerRecompile = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[watch] Detected change in resume data. Recompiling...`);
      compile();
    }, 250);
  };

  fs.watch(DATA_FILE, triggerRecompile);
  fs.watch(__filename, triggerRecompile);
}

if (process.argv.includes("--watch")) {
  watch();
} else if (require.main === module) {
  compile();
}

module.exports = { compile, watch, DATA_FILE, OUTPUT_PDF, ASSET_PDF };
