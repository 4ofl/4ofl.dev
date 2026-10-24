(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  const API = "https://worker-round-credit-5733.abyperhaps.workers.dev";
  const F = (window.F = { API, reduce, fine, lenis: null, scrollFns: [] });

  /* ---------- toast ---------- */
  let toastEl, toastT;
  F.toast = (html, ms = 3200) => {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.append(toastEl);
    }
    toastEl.innerHTML = html; // static strings only
    requestAnimationFrame(() => toastEl.classList.add("on"));
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("on"), ms);
  };

  /* ---------- online / offline ---------- */
  const ind = $("#net-ind");
  const paintNet = () => {
    if (!ind) return;
    ind.textContent = navigator.onLine ? "online" : "offline";
    ind.dataset.on = navigator.onLine;
  };
  const OFFLINE_MSG =
    "<b>offline.</b> this site still works. offline-first, like johns fitness.";
  addEventListener("offline", () => {
    paintNet();
    F.toast(OFFLINE_MSG, 4500);
  });
  addEventListener("online", () => {
    paintNet();
    F.toast("back online.", 2000);
  });
  paintNet();
  if (!navigator.onLine) F.toast(OFFLINE_MSG, 4500);

  /* ---------- service worker ---------- */
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  ) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
    if (!navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(() => {
        try {
          if (!localStorage.getItem("sw-told")) {
            localStorage.setItem("sw-told", "1");
            F.toast("<b>cached.</b> this site now works offline.", 4000);
          }
        } catch {}
      });
    }
  }

  /* ---------- api helper: network first, last-known value as fallback ---------- */
  F.api = async (path, key, timeout = 5000) => {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), timeout);
      const r = await fetch(API + path, { signal: c.signal });
      clearTimeout(t);
      if (!r.ok) throw 0;
      const data = await r.json();
      try {
        localStorage.setItem("c:" + key, JSON.stringify({ at: Date.now(), data }));
      } catch {}
      return { data, at: Date.now(), cached: false };
    } catch {
      try {
        const o = JSON.parse(localStorage.getItem("c:" + key));
        if (o && o.data) return { ...o, cached: true };
      } catch {}
      return null;
    }
  };
  F.ago = (ms) => {
    const m = (Date.now() - ms) / 6e4;
    return m < 1 ? "just now" : m < 60 ? `${m | 0}m ago` : m < 1440 ? `${(m / 60) | 0}h ago` : `${(m / 1440) | 0}d ago`;
  };
  F.uptime = (sec) =>
    `${(sec / 86400) | 0}d ${((sec % 86400) / 3600) | 0}h ${((sec % 3600) / 60) | 0}m`;
  F.up = (url, ms = 4000) =>
    new Promise((res) => {
      const c = new AbortController();
      const t = setTimeout(() => {
        c.abort();
        res(false);
      }, ms);
      fetch(url, { mode: "no-cors", cache: "no-store", signal: c.signal })
        .then(() => {
          clearTimeout(t);
          res(true);
        })
        .catch(() => {
          clearTimeout(t);
          res(false);
        });
    });

  /* ---------- smooth scroll + anchors ---------- */
  if (!reduce && typeof Lenis !== "undefined") {
    try {
      const lenis = (F.lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
        autoRaf: false,
      }));
      const raf = (t) => {
        lenis.raf(t);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    } catch {
      F.lenis = null; // native scrolling still works
    }
  }
  const onHome = location.pathname === "/" || location.pathname === "/index.html";
  $$('a[href^="#"], a[href^="/#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (href.startsWith("/#") && !onHome) return; // let the browser navigate home
      const hash = href.startsWith("/#") ? href.slice(1) : href;
      const el = hash === "#top" ? null : $(hash);
      if (hash !== "#top" && !el) return;
      e.preventDefault();
      if (F.lenis) F.lenis.scrollTo(el || 0, { duration: 1.15, force: true });
      else if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      else scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      history.pushState(null, "", hash);
    });
  });

  /* ---------- shared scroll hub ---------- */
  F.onScroll = (fn) => F.scrollFns.push(fn);
  let tick = false;
  addEventListener(
    "scroll",
    () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        tick = false;
        const y = scrollY;
        for (const fn of F.scrollFns) fn(y);
      });
    },
    { passive: true },
  );

  /* ---------- custom cursor (fine pointers only) ---------- */
  if (fine && !reduce) {
    const c = document.createElement("div");
    c.className = "cur";
    c.setAttribute("aria-hidden", "true");
    c.innerHTML = '<i class="cur-ring"></i><i class="cur-dot"></i><span class="cur-lbl"></span>';
    document.body.append(c);
    document.documentElement.classList.add("has-cur");
    const ring = $(".cur-ring", c),
      dot = $(".cur-dot", c),
      lbl = $(".cur-lbl", c);
    let x = -100,
      y = -100,
      rx = -100,
      ry = -100,
      shown = false,
      raf = 0,
      cur = "";
    const loop = () => {
      rx += (x - rx) * 0.22;
      ry += (y - ry) * 0.22;
      const t = `translate3d(${rx}px,${ry}px,0)`;
      ring.style.transform = t;
      lbl.style.transform = t;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.15 ? requestAnimationFrame(loop) : 0;
    };
    addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        x = e.clientX;
        y = e.clientY;
        dot.style.transform = `translate3d(${x}px,${y}px,0)`;
        if (!shown) {
          shown = true;
          rx = x;
          ry = y;
          c.classList.add("on");
        }
        if (!raf) raf = requestAnimationFrame(loop);
        const el = e.target.closest("[data-cursor],a,button,input,textarea");
        let state = "";
        if (el) {
          if (el.matches("input,textarea")) state = "txt";
          else if (el.dataset.cursor) state = "lbl:" + el.dataset.cursor;
          else if (el.matches('a[target="_blank"]')) state = "lbl:↗";
          else state = "hov";
        }
        if (state !== cur) {
          cur = state;
          c.classList.toggle("txt", state === "txt");
          c.classList.toggle("hov", state === "hov");
          c.classList.toggle("lbl", state.startsWith("lbl:"));
          if (state.startsWith("lbl:")) {
            const raw = state.slice(4);
            lbl.textContent = raw === "open" ? "+ open" : raw === "close" ? "- close" : raw;
          }
        }
      },
      { passive: true },
    );
    addEventListener("pointerdown", () => c.classList.add("down"), { passive: true });
    addEventListener("pointerup", () => c.classList.remove("down"), { passive: true });
    document.documentElement.addEventListener("mouseleave", () => c.classList.remove("on"));
    document.documentElement.addEventListener("mouseenter", () => shown && c.classList.add("on"));
  }

  /* ---------- reveals: word-by-word headlines, drawn diagrams ---------- */
  if (!reduce) {
    $$(".big").forEach((el) => {
      const words = el.textContent.trim().split(/\s+/);
      el.textContent = "";
      words.forEach((w, i) => {
        const o = document.createElement("span");
        o.className = "w";
        const n = document.createElement("span");
        n.textContent = w;
        n.style.setProperty("--i", i);
        o.append(n);
        el.append(o);
        if (i < words.length - 1) el.append(" ");
      });
    });
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.3 },
    );
    $$(".big, .arch").forEach((el) => io.observe(el));
  } else {
    $$(".big, .arch").forEach((el) => el.classList.add("in"));
  }

  /* ---------- live bits used by project pages ---------- */
  const mEl = $("#metrics");
  if (mEl) {
    const set = (k, v) => {
      const e = $(`[data-m="${k}"]`, mEl);
      if (e) e.textContent = v;
    };
    const note = $("#metricsNote");
    F.api("/status", "status").then((r) => {
      const d = r && r.data;
      if (!d || d.state === "unknown" || (d.status === "error" && !d.discord)) {
        ["state", "shard", "hb", "up"].forEach((k) => set(k, "n/a"));
        if (note) note.textContent = "status feed unavailable right now. nothing is estimated or faked here.";
        return;
      }
      const st = d.status || d.state || (d.discord && d.discord.connected ? "operational" : "n/a");
      const sh = d.runtime && d.runtime.shardIds ? d.runtime.shardIds.join(",") : d.shard != null ? d.shard : "0";
      const ping = d.discord && d.discord.gatewayPingMs != null ? d.discord.gatewayPingMs : d.heartbeatMs;
      const up = d.uptimeSeconds != null ? d.uptimeSeconds : d.uptimeSec;

      set("state", st);
      set("shard", "shard " + sh);
      set("hb", ping != null ? ping + " ms" : "n/a");
      set("up", up != null ? F.uptime(up) : "n/a");
      if (note) note.textContent = r.cached ? `last seen ${F.ago(r.at)} (cached, you may be offline).` : "live from the status feed.";
    });
  }
})();
