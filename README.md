# 4ofl.dev

Personal site and systems engineering portfolio for Aby Mathew. Static HTML/CSS/JS deployed to Cloudflare edge with an accompanying edge worker.

## layout

- `index.html`, `css/style.css`, `js/app.js` (home), `js/common.js` (shared runtime: cursor, toast, offline, reveals)
- `js/intro.js`: zero-dependency synchronous head check preventing FOUC under strict `'self'` script CSP
- `work/<slug>/index.html`: case studies (`/work/june/`, `/work/johns-fitness/`, `/work/citecamp/`)
- `writing/<slug>/index.html`: systems write-ups (anti-SSRF socket pinning, zombie sockets, MDB to SQLite WAL)
- `sw.js`: offline service worker (network-first HTML, cache-first assets)
- `js/vendor/sql-wasm.*`: sql.js (SQLite 3 compiled to WebAssembly) for the interactive hardware outbox demo
- `worker/worker.js`: Cloudflare edge worker handling `/commits`, `/status`, `/ping`, and repository metadata

## performance budget

Strict runtime and asset weight thresholds enforced across all routes:

- **Total Home JS**: `< 45 KB` gzipped (`app.js` ~15.8 KB + `common.js` ~3.2 KB + `lenis.min.js` ~5.4 KB; WASM lazy-loaded on demand)
- **Total CSS**: `< 10 KB` gzipped (`style.css` ~6.6 KB gzipped)
- **First Contentful Paint (FCP)**: `< 0.8s`
- **Largest Contentful Paint (LCP)**: `< 1.8s` on simulated mid-tier mobile
- **Cumulative Layout Shift (CLS)**: `0`
- **First Input Delay / INP**: `< 50ms`

## security & headers

Defined in `_headers`:

- **Content-Security-Policy**: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self' https://worker.4ofl.dev https://cache.4ofl.dev https://api.4ofl.dev https://*.workers.dev https://github-contributions-api.jogruber.de; frame-ancestors 'none'; object-src 'none'; base-uri 'self';`
- **HSTS**: `max-age=31536000; includeSubDomains; preload`
- **Nosniff, XFO & Referrer**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- **Cache Strategy**: `max-age=0, must-revalidate` on static JS/CSS; `max-age=31536000, immutable` strictly on versioned fonts.

## worker routes & secrets

Edge handler located at `worker/worker.js`:

- `GET /`: returns timestamp and name of most recent pushed GitHub repository
- `GET /commits`: returns cached last 30 weeks of GitHub contribution matrix
- `GET /status`: passthrough proxy to live June bot heartbeat, or `{ state: "unknown" }`
- `GET /ping`: lightweight 204 response used for live round-trip latency measurements
- **Secrets**:
  - `GITHUB_TOKEN`: GitHub personal access token with `read:user` (+ `repo` for private commit counts)
  - `JUNE_STATUS_URL` (optional): live JSON status feed URL

## scripts & local development

```bash
npm test              # Run the 38-assertion smoke test suite (routes, SEO, CSP, syntax)
npm run build:resume  # Compile resume/resume-data.json to vector ATS PDF via headless Chrome
npm run build:og      # Dynamically render crisp 1200x630 OG social cards via data/og-cards.json
npm run dev           # Start local preview server via Wrangler
npm run deploy        # Deploy static assets to Cloudflare Pages
```
