/**
 * 4ofl.dev Smoke Test Suite
 * Validates route integrity, head tag hygiene, strict CSP, cache headers,
 * zero inline styles, zero faked metrics, sitemap synchronization, and JS syntax.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

const HTML_PAGES = [
  "index.html",
  "404.html",
  "work/june/index.html",
  "work/johns-fitness/index.html",
  "work/citecamp/index.html",
  "writing/index.html",
  "writing/ssrf-socket-pinning/index.html",
  "writing/zombie-sockets/index.html",
  "writing/mdb-to-sqlite-wal/index.html",
];

const JS_FILES = [
  "js/app.js",
  "js/common.js",
  "js/intro.js",
  "js/404.js",
  "sw.js",
  "worker/worker.js",
  "scripts/build-resume.js",
  "scripts/build-og.js",
];

describe("1. Static Route & File Existence", () => {
  for (const page of HTML_PAGES) {
    test(`Page file exists: ${page}`, () => {
      const fullPath = path.join(ROOT, page);
      assert.ok(fs.existsSync(fullPath), `Missing file: ${page}`);
      const content = fs.readFileSync(fullPath, "utf8");
      assert.ok(content.length > 100, `File appears too short or empty: ${page}`);
    });
  }

  test("Dead /resume route pruned and redirects configured", () => {
    assert.strictEqual(
      fs.existsSync(path.join(ROOT, "resume", "index.html")),
      false,
      "resume/index.html should be pruned (dead route)",
    );
    assert.strictEqual(
      fs.existsSync(path.join(ROOT, "js", "resume.js")),
      false,
      "js/resume.js should be pruned (dead file)",
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, "resume", "resume-data.json")),
      "resume/resume-data.json must exist as source of truth",
    );
    assert.ok(fs.existsSync(path.join(ROOT, "resume.pdf")), "resume.pdf must exist");

    const redirects = fs.readFileSync(path.join(ROOT, "_redirects"), "utf8");
    assert.match(redirects, /\/resume\s+\/resume\.pdf/, "_redirects must route /resume to /resume.pdf");
  });

  test("OG Social Cards exist for all routes", () => {
    const cards = [
      "assets/social-card.png",
      "assets/og-june.png",
      "assets/og-johns-fitness.png",
      "assets/og-citecamp.png",
    ];
    for (const card of cards) {
      assert.ok(fs.existsSync(path.join(ROOT, card)), `Missing social card asset: ${card}`);
    }
  });

  test("Edge worker file exists and is tracked", () => {
    const workerFile = path.join(ROOT, "worker", "worker.js");
    assert.ok(fs.existsSync(workerFile), "worker/worker.js must exist");
    const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    assert.ok(!gitignore.includes("worker/"), ".gitignore must not ignore worker/");
    assert.ok(!gitignore.includes("worker.js"), ".gitignore must not ignore worker.js");
  });
});

describe("2. Head Tag & SEO Hygiene", () => {
  for (const page of HTML_PAGES) {
    test(`Head hygiene on ${page}`, () => {
      const content = fs.readFileSync(path.join(ROOT, page), "utf8");

      assert.match(content, /<title>[^<]+<\/title>/i, `${page} missing <title>`);
      assert.match(content, /<meta[^>]+name=["']description["'][^>]+>/i, `${page} missing description meta tag`);
      assert.match(content, /<link[^>]+rel=["']canonical["'][^>]+>/i, `${page} missing canonical link`);
      assert.match(content, /<meta[^>]+property=["']og:image["'][^>]+>/i, `${page} missing og:image`);
      assert.match(content, /<meta[^>]+name=["']twitter:image["'][^>]+>/i, `${page} missing twitter:image`);

      // Check single H1 per page
      const h1Count = (content.match(/<h1\b[^>]*>/gi) || []).length;
      assert.strictEqual(h1Count, 1, `${page} must contain exactly one <h1>, found ${h1Count}`);
    });
  }
});

describe("3. Security Headers, CSP & Cache Policy", () => {
  const headers = fs.readFileSync(path.join(ROOT, "_headers"), "utf8");

  test("Security headers are enforced", () => {
    assert.match(headers, /X-Content-Type-Options:\s*nosniff/i);
    assert.match(headers, /X-Frame-Options:\s*DENY/i);
    assert.match(headers, /Referrer-Policy:\s*strict-origin-when-cross-origin/i);
    assert.match(headers, /Strict-Transport-Security:\s*max-age=31536000/i);
  });

  test("Content-Security-Policy allows worker domains and jogruber contributions", () => {
    assert.match(headers, /connect-src[^;]*https:\/\/\*\.workers\.dev/);
    assert.match(headers, /connect-src[^;]*https:\/\/github-contributions-api\.jogruber\.de/);
  });

  test("Content-Security-Policy script-src is self without fragile inline hashes", () => {
    assert.match(headers, /script-src 'self';/);
  });

  test("Cache policy: static JS and CSS use must-revalidate; immutable strictly for fonts", () => {
    assert.match(headers, /\/css\/\*\s+Cache-Control:\s*public,\s*max-age=0,\s*must-revalidate/);
    assert.match(headers, /\/js\/\*\s+Cache-Control:\s*public,\s*max-age=0,\s*must-revalidate/);
    assert.match(headers, /\/assets\/fonts\/\*\s+Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/);
  });

  test("Zero inline style='' attributes on any HTML page", () => {
    for (const page of HTML_PAGES) {
      const content = fs.readFileSync(path.join(ROOT, page), "utf8");
      const inlineStyles = content.match(/style\s*=\s*["'][^"']*["']/gi) || [];
      assert.strictEqual(
        inlineStyles.length,
        0,
        `${page} contains inline style attribute(s): ${inlineStyles.join(", ")}`,
      );
    }
  });

  test("No inline executable script blocks without type=application/ld+json", () => {
    for (const page of HTML_PAGES) {
      const content = fs.readFileSync(path.join(ROOT, page), "utf8");
      const scripts = content.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const s of scripts) {
        if (/type=["']application\/ld\+json["']/i.test(s)) continue;
        if (/src=["'][^"']+["']/i.test(s)) continue;
        assert.fail(`${page} contains inline executable script: ${s.slice(0, 80)}...`);
      }
    }
  });
});

describe("4. Metrics Truthfulness", () => {
  test("Uptime is not hardcoded to fake 99.9%", () => {
    const indexContent = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const juneContent = fs.readFileSync(path.join(ROOT, "work", "june", "index.html"), "utf8");

    assert.ok(!indexContent.includes("99.9%"), "index.html must not hardcode 99.9% uptime");
    assert.ok(!juneContent.includes("99.9%"), "work/june/index.html must not hardcode 99.9% uptime");

    // Elements should render dash placeholder before hydration
    assert.match(indexContent, /<b id="juneUptime">—<\/b>/);
    assert.match(juneContent, /<span id="juneCaseUptime">—<\/span>/);
  });
});

describe("5. Sitemap & Service Worker Integrity", () => {
  test("Sitemap URLs match existing pages and have lastmod", () => {
    const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
    const locs = [...sitemap.matchAll(/<loc>(https:\/\/4ofl\.dev([^<]*))<\/loc>/g)];
    assert.ok(locs.length > 0, "Sitemap must contain URLs");

    for (const match of locs) {
      const pathname = match[2];
      const relPath = pathname === "/" ? "index.html" : path.join(pathname.replace(/^\//, ""), "index.html");
      assert.ok(
        fs.existsSync(path.join(ROOT, relPath)),
        `Sitemap references non-existent page: ${pathname} (${relPath})`,
      );
    }

    const lastmods = [...sitemap.matchAll(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)];
    assert.strictEqual(
      lastmods.length,
      locs.length,
      "Every sitemap <url> entry must have a <lastmod> timestamp",
    );
  });

  test("Service Worker precaches valid existing files", () => {
    const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    const coreMatch = sw.match(/const CORE = \[([\s\S]*?)\];/);
    assert.ok(coreMatch, "sw.js must define CORE array");

    const entries = [...coreMatch[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
    for (const entry of entries) {
      let filePath;
      if (entry === "/") {
        filePath = path.join(ROOT, "index.html");
      } else if (entry.endsWith("/")) {
        filePath = path.join(ROOT, entry.slice(1), "index.html");
      } else {
        filePath = path.join(ROOT, entry.slice(1));
      }
      assert.ok(fs.existsSync(filePath), `Service worker precaches missing file: ${entry} (${filePath})`);
    }
  });
});

describe("6. JavaScript Syntax Validation", () => {
  for (const jsFile of JS_FILES) {
    test(`Syntax validation: ${jsFile}`, () => {
      const fullPath = path.join(ROOT, jsFile);
      assert.ok(fs.existsSync(fullPath), `File missing: ${jsFile}`);
      // node --check verifies JS syntax without executing
      assert.doesNotThrow(() => {
        execSync(`node --check "${fullPath}"`, { stdio: "pipe" });
      }, `Syntax error in ${jsFile}`);
    });
  }
});

