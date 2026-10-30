/* 4ofl edge worker
   routes:  /          last pushed repo  {at, name|null}
            /commits   last ~30 weeks of contributions  {total, weeks:[[[date,count,weekday],...],...]}
            /status    june status passthrough, or {state:"unknown"} (never invented numbers)
            /ping      204, used for the real round-trip time in the june terminal
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
      const data = await cached(ctx, "commits", 3600, async () => {
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
          .slice(-30)
          .map((w) => w.contributionDays.map((d) => [d.date, d.contributionCount, d.weekday]));
        return { total: weeks.flat().reduce((a, d) => a + d[1], 0), weeks };
      });
      if (!data) return new Response("{}", { status: 502, headers });
      return Response.json(data, { headers: { ...headers, "Cache-Control": "public, max-age=3600" } });
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
