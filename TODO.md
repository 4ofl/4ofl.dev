# Master TODO: 4ofl.dev (8.5 → 10 Roadmap)

Execution roadmap covering all 25 audit items. Organized in strict dependency order: content and layout stabilize first, followed by design tokens and security headers, then automated test suites and CI gates.

---

## Stage 1: The Hiring Wedge (Zero-Clutter Signals)
*Goal: Give recruiters and visitors immediate access to your proof points, resume, and contact WITHOUT touching or cluttering the visual purity of the hero.*

### 1.1 Hero Visual Preservation (Item 1 Redefined)
- [x] **Preserve Hero Visual Purity**: Keep the hero visual typography strictly untouched (`aby mathew`, `Violently opposed to legacy software.`, `bca undergrad · kerala, in`). Zero tag pills, zero badge clutter, zero noise.
- [x] **Project Accordions Carry the Proof**: Let the project rows directly beneath the fold (`#work`) deliver the immediate proof point, metrics, and architecture so the hero stays clean.

### 1.2 Non-Intrusive Contact & Reachability (Item 8 Redefined)
- [x] **Command Palette Power Surface (`⌘K`)**: Added instant contact actions into `#pal`:
  - `resume` (opens official `resume.pdf`)
  - `download resume` (downloads `aby_mathew_resume.pdf` with toast feedback)
  - `email aby` (`mailto:aby@4ofl.dev`)
  - `copy email` (copies `aby@4ofl.dev` + toast feedback)
  - `linkedin` & `github` quick triggers
- [x] **Nav Integration**: Maintained the clean desktop bar (`work`, `about`, `resume`, `contact`) and mobile sheet in the identical quiet lowercase monospace style. Kept `#contact` intact.

### 1.3 Resume as Code & Availability (Item 2)
- [x] **Custom Format PDF Generator Script**: Created `scripts/build-resume.js` compiling structured `resume/resume-data.json` into a single-page, ATS-compliant, vector PDF (`resume.pdf` & `assets/aby_mathew_resume.pdf`).
- [x] **Always Serves PDF**: Maintained 302 redirects in `_redirects` (`/resume` & `/cv` → `/resume.pdf`), pruned dead fallback route (`resume/index.html` & `js/resume.js`), and precached `resume.pdf` in `sw.js` (bumped to `4ofl-v16`).
- [x] **Quiet Availability Line**: Embedded summer/fall '26 availability inside `resume.pdf` and the `#facts` DL on the home page.

### 1.4 Hard Project Metrics & Outcome Copy (Item 3)
- [x] **June Metrics API Loader**: Consolidated live metric hydration in `js/common.js` (pruning duplicate `loadJuneStats` from `js/app.js`) across home (`#juneServers`, `#juneCommands`, `#juneUptime`) and case study (`#juneCaseServers`, `#juneCaseCommands`, `#juneCaseUptime`), displaying `—` until live data hydrates without faked values.
- [x] **Johns Fitness Status & Metrics**: Kept badge as `prototype` reflecting honest hardware bench-testing: 1,405 members migrated from legacy 2013 MDB, <15ms NVRAM DSP relay pulse, 0 dropped scans via SQLite WAL outbox.

---

## Stage 2: Technical Credibility Engine (`/writing/` & Proof)
*Goal: Provide undeniable evidence of systems depth and architectural reasoning.*

### 2.1 Deep-Dive Technical Write-ups (Item 5)
- [x] **Directory Structure**: Created `/writing/` index and routing in static assets, `sitemap.xml`, `sw.js` (bumped to `4ofl-v14`), and `_redirects`.
- [x] **Write-up 1 (SSRF Socket Pinning)**:
  - Title: *Socket-Level IP Pinning & Anti-SSRF in Node.js*.
  - Scope: DNS rebinding attacks, TOCTOU vulnerability in typical `fetch` wrappers, hooking Node's `net.Socket` / `http.Agent.createConnection` to validate remote IP addresses before TCP handshake.
- [x] **Write-up 2 (The Zombie Socket Problem)**:
  - Title: *Handling Zombie WebSockets Without TCP Close Frames*.
  - Scope: Half-open socket states on Discord gateway, custom heartbeat state machines, idle timeout detection, and graceful sharded re-identification.
- [x] **Write-up 3 (Legacy MDB to SQLite WAL)**:
  - Title: *Reverse-Engineering 2013 MS Access MDBs to SQLite WAL in .NET 8*.
  - Scope: Corrupt schema recovery, character encoding edge-cases, single-transaction atomic migration, WAL concurrency for simultaneous reader/writer threads.

### 2.2 Johns Fitness Status Alignment (Item 4)
- [x] **Status Kept as Prototype**: Reverted badge to `prototype` and updated copy across `index.html` and `work/johns-fitness/index.html` to reflect honest hardware bench-testing status.
- [x] **Deployment Documentation**: Documented Intel N100 mini PC setup, BioMax N-Series TCP port 5005 listener, Win32 P/Invoke daemon, and Transactional Outbox pattern.

### 2.3 Third-Party Proof & Signals (Item 6)
- [ ] **Stakeholder Pull-Quote**: Deferred (add verified quote once live deployment milestones are reached).
- [ ] **Upstream Contribution**: Deferred.

---

## Stage 3: Design Tokens, Scale & Mobile Realism
*Goal: Eradicate one-off styles, unify voice, and ensure 360px mobile viewports shine.*

### 3.1 Strict Typographic & Spacing Token Scale (Item 17)
- [x] **Spacing Scale**: Define rigid tokens in `:root` inside `css/style.css`:
  - `--space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem; --space-6: 1.5rem; --space-8: 2rem; --space-12: 3rem; --space-16: 4rem;`
- [x] **Typographic Scale**: Define modular clamp steps:
  - `--step--1: 0.8rem; --step-0: 1rem; --step-1: 1.25rem; --step-2: 1.56rem; --step-3: 1.95rem; --step-4: 2.44rem; --step-hero: clamp(4.5rem, 18vw, 16rem);`
- [x] **Refactor Ad-Hoc CSS**: Audit `css/style.css` to replace hardcoded margins, paddings, and font sizes with CSS variables.

### 3.2 Mobile-First Layout Pass (360px Viewport) (Item 21)
- [x] **Canvas & Container Width**: Verify `overflow-x: hidden` and container constraints on narrow devices (360px wide).
- [x] **Interactive Demos on Mobile**:
  - June Terminal: Fix input wrapping and button sizing at ≤360px in `css/style.css`.
  - Biometric Demo: Ensure fingerprint button, outbox counter, and log list fit comfortably without horizontal scroll.
- [x] **Table & Architecture Overflow**: Wrap SVG architecture diagrams with smooth horizontal scroll triggers or responsive stacked fallbacks for mobile screens.

### 3.3 Voice Uniformity (Lowercase Mono Tone) (Item 19)
- [x] **Microcopy Audit**: Standardize all copy across home, case studies, command palette, and 404:
  - Consistently enforce the technical, understated lowercase mono voice (e.g., `command palette`, `no matching results`, `loads on first scan`).
  - Eliminate any accidental title-casing or inconsistent punctuation in tooltips and badges.

### 3.4 Motion Budget & Animation Audit (Item 20)
- [x] **Animation Inventory**: Review all CSS keyframes and JS RAF loops:
  - Keep: Letter swell near pointer, hex grid particle hover, terminal typing response.
  - Trim/Remove: Any decorative hover jiggle or non-essential transitions that don't confirm action or convey system state.
- [x] **Reduced Motion**: Verify `@media (prefers-reduced-motion: reduce)` instantly disables all canvas physics, letter transforms, and smooth scroll.

### 3.5 Case Study Visual Proof (Item 18)
- [ ] **June Visual**: Add a clean, unembellished screenshot of the terminal/bot operating live in Discord or the dashboard at `june.4ofl.dev`.
- [ ] **Johns Fitness Visual**: Add an authentic visual of the reception PWA or hardware terminal relay setup.
- [ ] **Citecamp Visual**: Add a pipeline data-flow visual or terminal ingest screenshot.

### 3.6 Dedicated Social Cards (Item 22)
- [x] **Home OG Card**: Ensure `assets/social-card.png` matches the current branding.
- [x] **Case Study OG Cards**:
  - Create `/assets/og-june.png`
  - Create `/assets/og-johns-fitness.png`
  - Create `/assets/og-citecamp.png`
- [x] **Meta Tags**: Wire unique `<meta property="og:image">` and `<meta name="twitter:image">` into each case study HTML `<head>`.

---

## Stage 4: Craft Hardening & Accessibility Standards
*Goal: Flawless security posture, rock-solid keyboard navigation, and adaptive performance.*

### 4.1 Cloudflare `_headers` & Strict CSP (Item 11)
- [x] **Create `_headers` File**: Place in workspace root for Cloudflare Pages / Workers static assets with cache-control (`max-age=0, must-revalidate` on static JS/CSS; immutable strictly for fonts).
- [x] **Strict Content Security Policy (CSP)**:
  - `default-src 'self';`
  - `script-src 'self';` (extracted synchronous head check to `/js/intro.js`, eliminating fragile inline script hashes).
  - `style-src 'self' 'unsafe-inline';` (migrated all ~51 inline `style=""` attributes to CSS and `data-d` attributes).
  - `font-src 'self' data:;`
  - `img-src 'self' data: https:;`
  - `connect-src 'self' https://worker.4ofl.dev https://cache.4ofl.dev https://api.4ofl.dev https://*.workers.dev https://github-contributions-api.jogruber.de;`
  - `frame-ancestors 'none'; object-src 'none'; base-uri 'self';`
- [x] **Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

### 4.2 Keyboard Navigation & Screen-Reader Pass (Item 13)
- [x] **Palette Focus Trap**: When command palette (`#pal`) opens:
  - Restrict `Tab` / `Shift+Tab` cycling strictly within `#pin-input` and `#plist`.
  - Pressing `Esc` closes palette and returns focus to the trigger element.
- [x] **Visible Focus Styles**: Implement a crisp, high-contrast `:focus-visible` ring across all buttons, anchors, and inputs in `css/style.css`.
- [x] **Navigation Semantics**:
  - Add `aria-current="page"` to active links.
  - Ensure accordion buttons (`.rh`) accurately toggle `aria-expanded="true|false"` and manage `aria-controls`.
- [x] **Semantic Heading Tree**: Ensure every case study and main section has a logical hierarchy (`<h1>` → `<h2>` → `<h3>`) with visible project titles.

### 4.3 Low-End Device Canvas Throttle (Item 15)
- [x] **FPS Delta Monitor**: In `js/app.js`, calculate rolling average FPS over 60 frames.
- [x] **Adaptive Fallback**: If average FPS drops below 40:
  - Automatically double dot spacing (`gapX *= 1.6; gapY *= 1.6`) to halve the active dot count.
  - If FPS remains low, disable continuous physics loops and render a clean, static grid.

### 4.4 Dead Code & Fallback Purge (Item 12)
- [x] **CSS Clean-up**: Run a dead CSS pass on `css/style.css` to remove obsolete prefixes, unused experimental rules, and duplicate styles.
- [x] **JavaScript Audit**: Audit `js/common.js` and `js/app.js` to prune unused event handlers, debug logs, or abandoned utility functions.

---

## Stage 5: The Memorable Layer & Power Surfaces
*Goal: Turn the site into an interactive power tool without adding gimmicks.*

### 5.1 Command Palette as Power Surface (Item 24)
- [ ] **Action Commands**: Support direct actions in `#plist`:
  - `resume` → navigates to `/resume/`
  - `copy email` → copies `aby@4ofl.dev` and closes palette with toast
  - `status` → queries live `/status` endpoint from `worker/worker.js` and prints live roundtrip latency
  - `theme` / `reduced motion` toggle
  - Direct deep links to the 3 technical write-ups.
- [ ] **Fuzzy Search & Keyboard Navigation**: Ensure up/down arrow navigation with wrapping and `Enter` key execution is flawless.

### 5.2 Real Live Edge Data (Item 23)
- [ ] **June Status Indicator**: Connect the live pulse dot to real API data from `/status` via the edge worker.
- [ ] **Contribution Grid**: Ensure the GitHub contribution buffer in `js/app.js` loads and caches seamlessly via `/commits`.
- [ ] **Last Deploy Timestamp**: Add subtle build/deploy date in footer or about facts (`last deploy: YYYY-MM-DD · cloudflare edge`).

### 5.3 Signature Interaction Protection (Item 25)
- [ ] **Protect Grid & Intro Sweep**: Keep the introductory memory sweep and interactive hex dump canvas as the sole signature interaction.
- [ ] **Do Not Clutter**: Refuse any extra audio, 3D canvas, or competing interactive layers.

---

## Stage 6: Verification, CI Gates & Repository Governance
*Goal: Codify standards into automated checks that fail the build if quality degrades.*

### 6.1 Performance Budget & Architecture Documentation (Items 14 & 16)
- [x] **Document Performance Budget**: In `README.md`, declared explicit thresholds:
  - Total JS bundle: `< 45 KB` (gzipped)
  - First Contentful Paint (FCP): `< 0.8s`
  - Largest Contentful Paint (LCP): `< 1.8s` on simulated mid-tier mobile
  - Cumulative Layout Shift (CLS): `0`
- [x] **Architecture Breakdown**: Documented:
  - Cloudflare Edge Worker routing (`/commits`, `/status`, `/ping`, `/`).
  - Cache headers and Service Worker caching strategy (`sw.js`).
  - Deployment instructions via Wrangler CLI and `package.json`.

### 6.2 Automated Smoke Test Suite & CI Gate (Item 10)
- [x] **Setup Test Suite (`tests/smoke.test.js`)**: 38-assertion automated test runner (`npm test`) validating:
  - All routes (`/`, `/work/*`, `/writing/*`, `404.html`, `resume.pdf`) exist and return valid content.
  - SEO & Head tag hygiene (`<title>`, `<meta name="description">`, `<link rel="canonical">`, `og:image`, `twitter:image`, single `<h1>`).
  - CSP and cache policy enforcement in `_headers`.
  - Zero inline `style=""` attributes across all HTML pages.
  - Zero faked metrics (`—` placeholders until live hydration).
  - Sitemap synchronization and `<lastmod>` presence.
  - Service worker `CORE` cache list integrity.
  - Node syntax checks across all JS scripts (`worker/worker.js`, `sw.js`, `js/*.js`, `scripts/*.js`).
- [x] **CI Workflow (`.github/workflows/ci.yml`)**: Automated quality gate running `npm test` on push and PRs.

### 6.3 GitHub Actions Lighthouse CI (Item 9)
- [ ] **Workflow Configuration**: Create `.github/workflows/ci.yml`.
- [ ] **Hard Pass/Fail Assertions**:
  ```yaml
  assertions:
    categories:accessibility: ["error", { "minScore": 1.0 }]
    categories:best-practices: ["error", { "minScore": 1.0 }]
    categories:seo: ["error", { "minScore": 1.0 }]
    categories:performance: ["error", { "minScore": 0.95 }]
  ```
- [ ] **Failure Gate**: Block branch merges or production deployments if any score falls below the budget.

### 6.4 GitHub Profile & Pinned Repositories (Item 7)
- [ ] **Synchronize Descriptions**: Align GitHub repo descriptions for `johnsfitness-edge`, `june`, and `4ofl.dev` with the site's exact copy.
- [ ] **Clean Pinned READMEs**: Ensure pinned repos have clean, professional READMEs featuring architecture diagrams, installation instructions, and real performance metrics.
