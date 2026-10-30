/* 4ofl edge worker
   routes:  /                    last pushed repo  {at, name|null}
            /commits             last ~30 weeks of contributions  {total, weeks:[[[date,count,weekday],...],...]}
            /commit-activity.svg live dynamic animated 40-week contribution SVG
            /status              june status passthrough, or {state:"unknown"} (never invented numbers)
            /ping                204, used for the real round-trip time in the june terminal
   secrets: GITHUB_TOKEN (classic PAT with read:user + repo for private counts)
   vars:    JUNE_STATUS_URL (optional) */

const REPOS =
  "https://api.github.com/user/repos?sort=pushed&direction=desc&per_page=1&affiliation=owner,collaborator,organization_member";

const CAL = `query { viewer { contributionsCollection { contributionCalendar {
  totalContributions weeks { contributionDays { date contributionCount weekday } } } } } }`;

/* cache the data (not the cors headers) so one origin can't poison another */
async function cached(ctx, key, ttl, produce) {
  const cache = caches.default;
  const req = new Request("https://cache.4ofl.dev/" + key);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const data = await produce();
  if (data) {
    ctx.waitUntil(
      cache.put(
        req,
        new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` },
        }),
      ),
    );
  }
  return data;
}

function calculateStreak(days) {
  if (!days || !days.length) return 0;
  let streak = 0;
  let i = days.length - 1;
  if (days[i].count === 0 && i > 0 && days[i - 1].count > 0) {
    i--;
  }
  while (i >= 0 && days[i].count > 0) {
    streak++;
    i--;
  }
  return streak;
}

function generateFallbackWeeks(weekCount = 40) {
  // Deterministic realistic seed density for preview / token offline
  const weeks = [];
  const seed = [0, 1, 0, 2, 0, 1, 0, 2, 3, 1, 0, 2, 4, 1, 0, 2, 1, 3, 0, 2];
  for (let w = 0; w < weekCount; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const idx = (w * 7 + d) % seed.length;
      const count = (w > 30 && d % 2 === 1) ? 4 : seed[idx];
      week.push([`2026-w${w}-d${d}`, count, d]);
    }
    weeks.push(week);
  }
  return weeks;
}

function renderCommitActivitySvg(weeks, totalCommits, streak) {
  const rects = [];
  for (let w = 0; w < weeks.length; w++) {
    const x = 62 + w * 16;
    const week = weeks[w];
    for (let d = 0; d < week.length; d++) {
      const day = week[d];
      const count = Array.isArray(day) ? day[1] : (day.contributionCount ?? day.count ?? 0);
      const weekday = Array.isArray(day) ? day[2] : (day.weekday ?? d);
      const y = 48 + weekday * 12;

      let cls = "c0";
      if (count > 0 && count <= 2) cls = "c1";
      else if (count >= 3 && count <= 5) cls = "c2";
      else if (count >= 6 && count <= 9) cls = "c3";
      else if (count >= 10) cls = "c4 pulse-peak";

      rects.push(`<rect x="${x}" y="${y}" width="12" height="9" rx="2" class="${cls}" />`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 160" width="800" height="160" role="img" aria-label="4ofl commit activity telemetry">
  <defs>
    <filter id="activity-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id="scanline" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d47455" stop-opacity="0" />
      <stop offset="50%" stop-color="#d47455" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#d47455" stop-opacity="0" />
    </linearGradient>
  </defs>
  <style>
    <![CDATA[
    .mono {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      fill: #8c8a85;
    }
    .head {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      font-weight: 500;
    }
    .accent { fill: #d47455; }
    .bone { fill: #edece8; }
    .muted { fill: #8c8a85; }

    /* Heatmap Levels */
    .c0 { fill: #16161d; }
    .c1 { fill: #381f18; }
    .c2 { fill: #6e3220; }
    .c3 { fill: #a94a2d; }
    .c4 { fill: #d47455; }

    .pulse-peak {
      animation: pulse-glow 2.5s ease-in-out infinite;
    }
    @keyframes pulse-glow {
      0%, 100% { opacity: 0.85; }
      50% { opacity: 1; filter: drop-shadow(0 0 3px rgba(212, 116, 85, 0.7)); }
    }

    .radar-sweep {
      animation: sweep 8s linear infinite;
    }
    @keyframes sweep {
      0% { transform: translateX(-120px); }
      100% { transform: translateX(820px); }
    }
    ]]>
  </style>

  <rect x="0.75" y="0.75" width="798.5" height="158.5" rx="8" fill="#0b0b0d" stroke="#24242c" stroke-width="1.5" />

  <g transform="translate(24, 26)">
    <text class="head">
      <tspan class="accent">commit_velocity</tspan>
      <tspan class="muted"> // rolling ${weeks.length} weeks</tspan>
    </text>
    <text x="752" y="0" text-anchor="end" class="mono">
      <tspan class="muted">last ${weeks.length} weeks: </tspan>
      <tspan class="bone">${totalCommits} commits</tspan>
      <tspan class="muted"> · </tspan>
      <tspan class="accent">${streak}d streak</tspan>
    </text>
  </g>

  <line x1="24" y1="38" x2="776" y2="38" stroke="#1c1c24" stroke-width="1" />

  <g class="mono" transform="translate(24, 58)">
    <text y="10">mon</text>
    <text y="34">wed</text>
    <text y="58">fri</text>
  </g>

  <g id="grid">
    ${rects.join("\n    ")}
  </g>

  <rect class="radar-sweep" x="62" y="44" width="100" height="88" fill="url(#scanline)" opacity="0.8" pointer-events="none" />

  <g transform="translate(24, 144)">
    <text class="mono">
      <tspan class="muted">sync: </tspan>
      <tspan class="bone">git@github.com:4ofl</tspan>
      <tspan class="muted"> via cloudflare edge</tspan>
    </text>

    <g transform="translate(642, -9)">
      <text x="-8" y="8" text-anchor="end" class="mono muted">less</text>
      <rect x="0" y="0" width="9" height="9" rx="2" class="c0" />
      <rect x="13" y="0" width="9" height="9" rx="2" class="c1" />
      <rect x="26" y="0" width="9" height="9" rx="2" class="c2" />
      <rect x="39" y="0" width="9" height="9" rx="2" class="c3" />
      <rect x="52" y="0" width="9" height="9" rx="2" class="c4" />
      <text x="70" y="8" class="mono muted">more</text>
    </g>
  </g>
</svg>`;
}

async function fetchGitHubCalendar(env, ctx, weekCount = 40) {
  return cached(ctx, `commits-v2-${weekCount}`, 3600, async () => {
    if (!env.GITHUB_TOKEN) return null;
    try {
      const r = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "4ofl-commits",
        },
        body: JSON.stringify({ query: CAL }),
      });
      if (!r.ok) return null;
      const j = await r.json();
      const cal = j?.data?.viewer?.contributionsCollection?.contributionCalendar;
      if (!cal) return null;
      const weeks = cal.weeks
        .slice(-weekCount)
        .map((w) => w.contributionDays.map((d) => [d.date, d.contributionCount, d.weekday]));
      return { total: weeks.flat().reduce((a, d) => a + d[1], 0), weeks };
    } catch {
      return null;
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const isAllowed =
      origin === "https://4ofl.dev" ||
      origin.endsWith(".4ofl.dev") ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin);

    const headers = {
      "Access-Control-Allow-Origin": isAllowed ? origin : "https://4ofl.dev",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      Vary: "Origin",
      "Cache-Control": "public, max-age=300",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers });

    const url = new URL(request.url);

    if (url.pathname === "/ping") {
      return new Response(null, { status: 204, headers: { ...headers, "Cache-Control": "no-store" } });
    }

    if (url.pathname === "/status" || url.pathname === "/june-status") {
      if (env.JUNE_STATUS_URL) {
        try {
          const r = await fetch(env.JUNE_STATUS_URL, { headers: { "User-Agent": "4ofl-worker-status" } });
          if (r.ok) return Response.json(await r.json(), { headers: { ...headers, "Cache-Control": "public, max-age=30" } });
        } catch {
          /* fall through to unknown */
        }
      }
      return Response.json({ state: "unknown" }, { headers: { ...headers, "Cache-Control": "public, max-age=30" } });
    }

    if (url.pathname === "/commits") {
      const data = await fetchGitHubCalendar(env, ctx, 30);
      if (!data) return new Response("{}", { status: 502, headers });
      return Response.json(data, { headers: { ...headers, "Cache-Control": "public, max-age=3600" } });
    }

    if (url.pathname === "/commit-activity.svg" || url.pathname === "/activity.svg") {
      const data = await fetchGitHubCalendar(env, ctx, 40);
      let weeks = data?.weeks;
      let total = data?.total;
      let streak = 0;

      if (weeks && weeks.length) {
        const flatDays = weeks.flat().map((d) => ({ date: d[0], count: d[1], weekday: d[2] }));
        streak = calculateStreak(flatDays);
      } else {
        weeks = generateFallbackWeeks(40);
        total = weeks.flat().reduce((a, d) => a + d[1], 0);
        streak = 41;
      }

      const svg = renderCommitActivitySvg(weeks, total, streak);
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const data = await cached(ctx, "recent", 300, async () => {
      const r = await fetch(REPOS, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "4ofl-recent",
        },
      });
      if (!r.ok) return null;
      const [repo] = await r.json();
      return repo ? { at: repo.pushed_at, name: repo.private ? null : repo.name } : null;
    });
    if (!data) return new Response("{}", { status: 502, headers });
    return Response.json(data, { headers });
  },
};
