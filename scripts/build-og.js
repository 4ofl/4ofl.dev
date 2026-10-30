const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
];

const chromePath = CHROME_PATHS.find(p => fs.existsSync(p));
if (!chromePath) {
  console.error('Error: Google Chrome executable not found on host machine.');
  process.exit(1);
}

const dataFile = path.resolve('data/og-cards.json');
if (!fs.existsSync(dataFile)) {
  console.error(`Error: Data file not found at ${dataFile}`);
  process.exit(1);
}

const cardsData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

function renderHtml(itemKey, item) {
  const isHome = itemKey === 'home';
  const fontsDir = path.resolve('assets/fonts').replace(/\\/g, '/');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Bricolage Grotesque';
    src: url('file:///${fontsDir}/bricolage-grotesque.woff2') format('woff2');
  }
  @font-face {
    font-family: 'JetBrains Mono';
    src: url('file:///${fontsDir}/jetbrains-mono-400.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Newsreader';
    src: url('file:///${fontsDir}/newsreader-400.woff2') format('woff2');
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 630px;
    background: #0b0b0d;
    color: #edece8;
    position: relative;
    overflow: hidden;
    margin: 0;
    padding: 64px 72px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  #bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 1200px;
    height: 630px;
    z-index: 1;
    pointer-events: none;
  }

  .content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: space-between;
  }

  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 20px;
  }
  .brand {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-weight: 700;
    font-size: 26px;
    letter-spacing: -0.04em;
    color: #edece8;
  }
  .brand i {
    font-style: normal;
    color: #d47455;
  }
  .top-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: #8c8a85;
    letter-spacing: 0.03em;
  }

  .main-block {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: auto 0;
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13.5px;
  }
  .cat-text {
    color: #8c8a85;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 12px;
    letter-spacing: 0.04em;
    font-style: normal;
  }
  .status-pill::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .st-live {
    background: rgba(111, 207, 142, 0.1);
    color: #6fcf8e;
    border: 1px solid rgba(111, 207, 142, 0.25);
  }
  .st-live::before { background: #6fcf8e; }

  .st-prototype {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.25);
  }
  .st-prototype::before { background: #fbbf24; }

  .st-concept {
    background: rgba(167, 139, 250, 0.1);
    color: #a78bfa;
    border: 1px solid rgba(167, 139, 250, 0.25);
  }
  .st-concept::before { background: #a78bfa; }

  .title {
    font-family: 'Bricolage Grotesque', sans-serif;
    font-size: ${isHome ? '96px' : '82px'};
    font-weight: 600;
    letter-spacing: -0.05em;
    line-height: 0.94;
    color: #edece8;
  }

  .desc {
    font-family: 'Newsreader', Georgia, serif;
    font-size: 23px;
    line-height: 1.45;
    color: rgba(237, 236, 232, 0.82);
    max-width: 960px;
  }

  .footer-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
  }
  .tags-list {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .tag-item {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 5px 11px;
    border-radius: 6px;
    color: #edece8;
    font-size: 12.5px;
  }
</style>
</head>
<body>
  <canvas id="bg" width="1200" height="630"></canvas>

  <div class="content">
    <div class="top-bar">
      <div class="brand">4ofl<i>.dev</i></div>
      <div class="top-sub">${item.brand || 'aby mathew · 4ofl.dev'}</div>
    </div>

    <div class="main-block">
      ${item.category ? `
        <div class="badge-row">
          <span class="cat-text">${item.category}</span>
          <span class="cat-text">·</span>
          <span class="status-pill st-${item.statusType || 'live'}">${item.status}</span>
        </div>
      ` : item.badge ? `
        <div class="badge-row">
          <span class="cat-text">${item.badge}</span>
        </div>
      ` : ''}
      <div class="title">${item.title}</div>
      <div class="desc">${item.description}</div>
    </div>

    <div class="footer-bar">
      <div class="tags-list">
        ${(item.tags || []).map(t => `<span class="tag-item">${t}</span>`).join('')}
      </div>
    </div>
  </div>

  <script>
    // Draw complete, edge-to-edge memory hex dump canvas (clean subtle grey)
    const cv = document.getElementById('bg');
    const g = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;

    const SEED_BYTES = [
      "00", "00", "..", "00", "4F", "0B", "0D", "..",
      "00", "FF", "C0", "00", "2A", "10", "..", "00",
      "7E", "01", "8C", "00", "ED", "EC", "E8", "..",
      "00", "5A", "..", "3E", "00", "B4", "02", "00",
    ];

    const gapX = 36;
    const gapY = 28;
    const nCols = Math.floor(W / gapX);
    const nRows = Math.floor(H / gapY);

    // 1. Left-edge Memory Address Gutter
    g.font = '8px "JetBrains Mono", monospace';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(140, 138, 133, 0.16)';
    for (let r = 0; r < nRows; r++) {
      const addrNum = r * 32 * 4;
      const addr = "0x" + addrNum.toString(16).toUpperCase().padStart(4, "0") + ":";
      g.fillText(addr, 14, (r + 0.5) * gapY);
    }

    // 2. Uniform Subtle Grey Hex Dump Cells Across the ENTIRE Viewport
    g.font = '9px "JetBrains Mono", monospace';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(237, 236, 232, 0.05)';

    for (let r = 0; r < nRows; r++) {
      for (let c = 2; c < nCols; c++) {
        const x = c * gapX + 16;
        const y = (r + 0.5) * gapY;
        const val = SEED_BYTES[((r * 13 + c * 7) ^ (r * 3)) % SEED_BYTES.length];
        g.fillText(val, x, y);
      }
    }
  </script>
</body>
</html>`;
}

async function build() {
  const tmpDir = path.resolve('scratch_og_temp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const keys = Object.keys(cardsData);
  console.log(`Building ${keys.length} OG social card images from ${dataFile}...`);

  for (const key of keys) {
    const item = cardsData[key];
    const html = renderHtml(key, item);
    const htmlFile = path.join(tmpDir, `${key}.html`);
    const outFile = path.resolve('assets', item.filename || `og-${key}.png`);

    fs.writeFileSync(htmlFile, html, 'utf8');

    console.log(`- Compiling ${item.filename}...`);
    const cmd = `"${chromePath}" --headless --disable-gpu --force-device-scale-factor=1 --window-size=1200,630 --screenshot="${outFile}" "file://${htmlFile.replace(/\\/g, '/')}"`;
    execSync(cmd, { stdio: 'pipe' });

    const stat = fs.statSync(outFile);
    console.log(`  ✓ ${outFile} (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  // Cleanup temp files
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('Done! All OG cards generated from JSON.');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});

