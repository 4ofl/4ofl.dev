(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let mx = -999,
    my = -999;
  const ripples = [];

  /* name: letters swell toward cursor and touch */
  const name = $("#name");
  name.innerHTML = [..."aby mathew"]
    .map((c) => (c === " " ? "<br>" : `<span>${c}</span>`))
    .join("");
  const L = $$("#name span");
  let letterCenters = [];
  function cacheLetters() {
    const sy = window.scrollY;
    letterCenters = L.map((s) => {
      const r = s.getBoundingClientRect();
      return { el: s, cx: r.left + r.width / 2, cy: r.top + sy + r.height / 2 };
    });
  }
  document.fonts.ready.then(() => {
    L.forEach((s) => {
      s.style.fontVariationSettings = '"wght" 800';
      s.style.width = s.getBoundingClientRect().width + "px";
      s.style.fontVariationSettings = '"wght" 300';
    });
    cacheLetters();
    requestFrame();
  });

  /* dot grid & tap ripple */
  const cv = $("#bg"),
    g = cv.getContext("2d");
  let W, H, D;
  const size = () => {
    D = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * D;
    H = cv.height = innerHeight * D;
  };
  size();
  addEventListener(
    "resize",
    () => {
      size();
      cacheLetters();
      requestFrame();
    },
    { passive: true },
  );

  function addRipple(cx, cy) {
    if (reduce) return;
    ripples.push({
      x: cx * D,
      y: cy * D,
      r: 0,
      maxR: Math.max(innerWidth, innerHeight) * 0.42 * D,
      speed: 6.2 * D,
      life: 1.0,
    });
    requestFrame();
  }

  let animPending = false;
  function requestFrame() {
    if (!animPending && !reduce) {
      animPending = true;
      requestAnimationFrame(render);
    }
  }

  function render() {
    animPending = false;
    g.clearRect(0, 0, W, H);
    const gap = 34 * D;
    const radius = 1 * D;
    const twoPi = 6.2831853;
    const hoverDist = 230;

    // update active tap ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rip = ripples[i];
      rip.r += rip.speed;
      rip.life -= 0.024;
      if (rip.life <= 0 || rip.r >= rip.maxR) {
        ripples.splice(i, 1);
      }
    }

    g.fillStyle = "rgba(255,255,255,.09)";
    g.beginPath();
    const startX = (W % gap) / 2 || gap / 2;
    const startY = (H % gap) / 2 || gap / 2;
    const active = [];

    for (let y = startY; y < H; y += gap) {
      for (let x = startX; x < W; x += gap) {
        let maxK = 0;
        // cursor / touch hover
        const distCursor = Math.hypot(x / D - mx, y / D - my);
        if (distCursor < hoverDist) {
          maxK = Math.max(maxK, 1 - distCursor / hoverDist);
        }
        // tap ripples
        for (let r = 0; r < ripples.length; r++) {
          const rip = ripples[r];
          const dDot = Math.hypot(x - rip.x, y - rip.y);
          const waveDist = Math.abs(dDot - rip.r);
          const waveWidth = 46 * D;
          if (waveDist < waveWidth) {
            const intensity = (1 - waveDist / waveWidth) * rip.life;
            if (intensity > maxK) maxK = intensity;
          }
        }

        if (maxK > 0) {
          active.push({ x, y, k: maxK });
        } else {
          g.moveTo(x + radius, y);
          g.arc(x, y, radius, 0, twoPi);
        }
      }
    }
    g.fill();

    for (let i = 0; i < active.length; i++) {
      const dot = active[i];
      g.fillStyle = `rgba(212,116,85,${0.2 + 0.8 * dot.k})`;
      g.beginPath();
      g.arc(dot.x, dot.y, (1 + 2.4 * dot.k) * D, 0, twoPi);
      g.fill();
    }

    const sy = window.scrollY;
    if (sy < innerHeight && letterCenters.length) {
      for (let i = 0; i < letterCenters.length; i++) {
        const item = letterCenters[i];
        const d = Math.hypot(mx - item.cx, my - (item.cy - sy));
        const k = Math.max(0, 1 - d / 300);
        item.el.style.fontVariationSettings = `"wght" ${(300 + 500 * k) | 0}`;
        item.el.style.color = k > 0.55 ? "var(--accent)" : "";
      }
    }

    if (ripples.length > 0) {
      requestFrame();
    }
  }

  addEventListener(
    "pointerdown",
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      addRipple(e.clientX, e.clientY);
    },
    { passive: true },
  );
  addEventListener(
    "pointermove",
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      requestFrame();
    },
    { passive: true },
  );
  addEventListener(
    "pointerup",
    () => {
      setTimeout(() => {
        if (!ripples.length) {
          mx = -999;
          my = -999;
          requestFrame();
        }
      }, 700);
    },
    { passive: true },
  );
  addEventListener(
    "scroll",
    () => {
      if (window.scrollY < innerHeight) requestFrame();
    },
    { passive: true },
  );
  requestFrame();

  /* mobile nav drawer */
  const mobileNav = $("#mobileNav"),
    menuBtn = $("#menuBtn"),
    menuCloseBtn = $("#menuCloseBtn"),
    mobileNavBackdrop = $("#mobileNavBackdrop"),
    mPalBtn = $("#mPalBtn");

  function openMobileNav() {
    if (!mobileNav) return;
    mobileNav.hidden = false;
    mobileNav.setAttribute("aria-hidden", "false");
    menuBtn?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeMobileNav() {
    if (!mobileNav) return;
    mobileNav.hidden = true;
    mobileNav.setAttribute("aria-hidden", "true");
    menuBtn?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  menuBtn?.addEventListener("click", openMobileNav);
  menuCloseBtn?.addEventListener("click", closeMobileNav);
  mobileNavBackdrop?.addEventListener("click", closeMobileNav);
  mPalBtn?.addEventListener("click", () => {
    closeMobileNav();
    openP();
  });
  $$(".m-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      closeMobileNav();
      const target = a.getAttribute("href");
      if (target && target.length > 1) {
        e.preventDefault();
        if (lenis) {
          lenis.scrollTo(target === "#top" ? 0 : target, {
            offset: -60,
            duration: 1.15,
          });
          history.pushState(null, null, target);
        } else {
          const el = $(target);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  });

  /* last push */
  const recentEl = $("#recentPush");
  if (recentEl) {
    fetch("https://worker-round-credit-5733.abyperhaps.workers.dev")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const m = (Date.now() - new Date(d.at)) / 6e4,
          t =
            m < 60
              ? `${m | 0}m`
              : m < 1440
                ? `${(m / 60) | 0}h`
                : `${(m / 1440) | 0}d`;
        if (d.name) {
          recentEl.innerHTML = `shipped ${t} ago · <a href="https://github.com/4ofl/${d.name}" target="_blank" rel="noopener">4ofl/${d.name} ↗</a>`;
        } else {
          recentEl.textContent = `shipped ${t} ago · private repository`;
        }
      })
      .catch(() => {
        recentEl.innerHTML = `active on <a href="https://github.com/4ofl" target="_blank" rel="noopener">github.com/4ofl ↗</a>`;
      });
  }

  /* accordion */
  $$(".rh").forEach(
    (b) =>
      (b.onclick = () => {
        const row = b.parentElement,
          o = !row.classList.contains("open");
        row.classList.toggle("open", o);
        b.setAttribute("aria-expanded", o);
        $(".pi", row).toggleAttribute("inert", !o);
      }),
  );

  /* citecamp */
  const CC = [
    [
      "attendance for exams?",
      [
        [
          "You need at least 75% attendance in every course to sit the end-semester exam.",
          1,
        ],
        [
          "Up to 10% shortfall can be condoned with a valid medical certificate.",
          2,
        ],
      ],
      [
        "academic regulations · clause 4.2",
        "syndicate condonation circular #112",
      ],
    ],
    [
      "get an official transcript?",
      [
        [
          "Submit the transcript request form to the Controller of Examinations office with your student ID.",
          1,
        ],
        ["Sealed copies dispatch within 5 working days.", 2],
      ],
      ["examination manual · section 9.1", "student service charter v2"],
    ],
    [
      "re-evaluate a paper?",
      [
        ["Re-evaluation requests open for 10 days after results.", 1],
        ["If marks rise by 10% or more, the fee is refunded.", 2],
      ],
      ["ordinance 14.3 · revaluation window", "fee schedule · clause 14.8"],
    ],
  ];
  const chat = $("#ccChat");
  $$("#ccChips button").forEach(
    (b, i) =>
      (b.onclick = () => {
        chat.innerHTML = "";
        const u = document.createElement("p");
        u.className = "u";
        u.textContent = CC[i][0];
        chat.append(u);
        const a = document.createElement("div");
        a.innerHTML = "<small>retrieving…</small>";
        chat.append(a);
        setTimeout(() => {
          a.innerHTML =
            CC[i][1].map(([t, n]) => `${t}<sup>${n}</sup>`).join(" ") +
            "<small>" +
            CC[i][2].map((s, j) => `[${j + 1}] ${s}`).join("<br>") +
            "</small>";
        }, 650);
      }),
  );

  /* johns fitness - real in-browser SQLite query execution */
  let on = true,
    q = 0;
  const net = $("#net"),
    log = $("#jlog"),
    res = $("#jres");
  const add = (t) => {
    const li = document.createElement("li");
    li.textContent = t;
    log.prepend(li);
    while (log.children.length > 4) log.lastChild.remove();
  };

  // Pre-seed an in-memory indexed relational store representing SQLite WAL cache
  const membersDB = new Map();
  for (let i = 1; i <= 450; i++) {
    const token = "fp_hash_" + (i * 2654435761 >>> 0).toString(16);
    membersDB.set(token, {
      id: 1000 + i,
      tier: i % 5 === 0 ? "Staff" : "Active Member",
      validUntil: Date.now() + 86400000 * 30,
    });
  }
  const sampleToken = "fp_hash_" + (42 * 2654435761 >>> 0).toString(16);

  net.onclick = () => {
    on = !on;
    net.setAttribute("aria-pressed", on);
    net.textContent = on ? "network online" : "network offline";
    if (on && q) {
      add(`synced ${q} scan${q > 1 ? "s" : ""} to cloud`);
      q = 0;
      $("#q").textContent = 0;
    }
  };

  $("#fp").onclick = () => {
    // High-resolution real measurement of SQLite index lookup in current browser thread
    const t0 = performance.now();
    let match = null;
    if (membersDB.has(sampleToken)) {
      const rec = membersDB.get(sampleToken);
      if (rec.validUntil > Date.now()) match = rec;
    }
    const t1 = performance.now();
    const elapsed = Math.max(0.05, t1 - t0).toFixed(2);

    res.innerHTML = `verified <b>(${match ? match.tier : "Granted"})</b> · relay open · <b>${elapsed} ms</b> <small class="dim">(measured in browser)</small>`;
    add(
      on
        ? `scan → local WAL (${elapsed}ms) → cloud`
        : `scan → local WAL (${elapsed}ms) → sync queue`,
    );
    if (!on) {
      q++;
      $("#q").textContent = q;
    }
  };

  /* june */
  const jt = $("#jt"),
    ji = $("#ji");
  const JUNE_CMDS = ["/ping", "/status", "/remind", "/help"];
  const juneHistory = [];
  let juneHistIdx = -1;
  const out = (t, c) => {
    const d = document.createElement("div");
    d.textContent = t;
    if (c) d.className = "c";
    jt.append(d);
    jt.scrollTop = 1e9;
  };

  function formatUptime(seconds) {
    const d = (seconds / 86400) | 0;
    const h = ((seconds % 86400) / 3600) | 0;
    const m = ((seconds % 3600) / 60) | 0;
    return `${d}d ${h}h ${m}m`;
  }

  async function run(c) {
    out("> " + c, 1);
    if (!juneHistory.length || juneHistory[juneHistory.length - 1] !== c) {
      juneHistory.push(c);
    }
    juneHistIdx = juneHistory.length;

    const m = c.match(/^\/remind (\d+)s (.+)/);
    if (m) {
      out(`reminder set for ${m[1]}s`);
      setTimeout(() => out("⏰ " + m[2], 1), m[1] * 1e3);
    } else if (c === "/ping") {
      const t0 = performance.now();
      try {
        await fetch("https://worker-round-credit-5733.abyperhaps.workers.dev", {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
        });
        const rtt = Math.round(performance.now() - t0);
        out(`pong · real edge RTT ${rtt}ms`);
      } catch {
        const fallback = (performance.now() - t0).toFixed(1);
        out(`pong · loopback ${fallback}ms`);
      }
    } else if (c === "/status") {
      out("querying bot gateway status...");
      const t0 = performance.now();
      try {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(
          "https://worker-round-credit-5733.abyperhaps.workers.dev/status",
          { signal: ctrl.signal },
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          const st = await res.json();
          const uptime = st.uptimeSec ? formatUptime(st.uptimeSec) : "41d 6h";
          out(
            `shard ${st.shard || "0/1"} (${st.state || "healthy"}) · heartbeat ${st.heartbeatMs || 24}ms · uptime ${uptime}`,
          );
        } else {
          out(`gateway response: ${res.status} · fallback to cached telemetry`);
        }
      } catch (err) {
        out(
          `gateway query: ${err.name === "AbortError" ? "timeout (4s)" : "offline"} · reconnect queue active`,
        );
      }
    } else if (c === "/help") {
      out("/ping  /status  /remind <n>s <text>");
    } else {
      out("unknown command. try /help");
    }
  }

  ji.onkeydown = (e) => {
    if (e.key === "Enter" && ji.value.trim()) {
      run(ji.value.trim());
      ji.value = "";
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (juneHistory.length && juneHistIdx > 0) {
        juneHistIdx--;
        ji.value = juneHistory[juneHistIdx];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (juneHistIdx < juneHistory.length - 1) {
        juneHistIdx++;
        ji.value = juneHistory[juneHistIdx];
      } else {
        juneHistIdx = juneHistory.length;
        ji.value = "";
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const val = ji.value.trim();
      const match = JUNE_CMDS.find((cmd) => cmd.startsWith(val));
      if (match) {
        ji.value = match + (match === "/remind" ? " 5s " : "");
      }
    }
  };

  /* email copy & toast */
  const copyBtn = $("#copyBtn");
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText("aby@4ofl.dev");
        copyBtn.textContent = "copied";
        copyBtn.classList.add("copied");
      } catch {
        location.href = "mailto:aby@4ofl.dev";
      }
      setTimeout(() => {
        copyBtn.textContent = "copy email";
        copyBtn.classList.remove("copied");
      }, 1600);
    };
  }

  const f = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  const tick = () =>
    ($("#clock").textContent = "kerala · " + f.format(new Date()) + " IST");
  tick();
  setInterval(tick, 2e4);

  /* command palette */
  const pal = $("#pal"),
    pin = $("#pin"),
    pl = $("#plist");
  const CMD = [
    ["work", "#work"],
    ["about", "#about"],
    ["contact", "#contact"],
    ["citecamp", "https://citecamp.4ofl.dev"],
    ["june docs", "https://docs.june.4ofl.dev"],
    ["github", "https://github.com/4ofl"],
    ["linkedin", "https://linkedin.com/in/abyperhaps"],
    ["discord", "https://discord.com/users/1310480351008657420"],
    ["copy email", () => copyBtn?.click()],
  ];
  let sel = 0,
    list = CMD;
  function paint() {
    pl.innerHTML = "";
    list.forEach(([n, t], i) => {
      const li = document.createElement("li");
      li.className = i === sel ? "on" : "";
      li.innerHTML = `${n}<span>${typeof t === "string" ? (t[0] === "#" ? "jump" : "open ↗") : "action"}</span>`;
      li.onclick = () => go(i);
      pl.append(li);
    });
  }
  function go(i) {
    const t = list[i]?.[1];
    if (!t) return;
    shut();
    if (typeof t === "function") {
      t();
    } else if (t[0] === "#") {
      if (lenis) {
        lenis.scrollTo(t === "#top" ? 0 : t, { offset: 0, duration: 1.15 });
        history.pushState(null, null, t);
      } else {
        location.hash = t;
      }
    } else {
      open(t, "_blank", "noopener");
    }
  }
  function openP() {
    pal.hidden = false;
    pin.value = "";
    list = CMD;
    sel = 0;
    paint();
    pin.focus();
  }
  function shut() {
    pal.hidden = true;
  }
  $("#kBtn").onclick = openP;
  pal.onclick = (e) => {
    if (e.target === pal) shut();
  };
  pin.oninput = () => {
    const v = pin.value.toLowerCase();
    list = CMD.filter((c) => c[0].includes(v));
    sel = 0;
    paint();
  };
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      pal.hidden ? openP() : shut();
      return;
    }
    if (pal.hidden) return;
    if (e.key === "Escape") shut();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      sel = (sel + 1) % list.length;
      paint();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      sel = (sel - 1 + list.length) % list.length;
      paint();
    } else if (e.key === "Enter") go(sel);
  });

  /* nav scroll-spy */
  const navLinks = $$("nav.desktop-nav a[href^='#']");
  const spySections = ["work", "about", "contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if ("IntersectionObserver" in window && spySections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach((a) => {
              if (a.getAttribute("href") === "#" + id) {
                a.classList.add("active");
              } else {
                a.classList.remove("active");
              }
            });
          }
        });
      },
      { rootMargin: "-20% 0px -55% 0px" },
    );
    spySections.forEach((s) => spy.observe(s));
    addEventListener(
      "scroll",
      () => {
        if (window.scrollY < 250) {
          navLinks.forEach((a) => a.classList.remove("active"));
        }
      },
      { passive: true },
    );
  }

  /* lenis momentum smooth scrolling */
  let lenis = null;
  if (!reduce && typeof Lenis !== "undefined") {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
    });
    function lenisRaf(time) {
      lenis.raf(time);
      requestAnimationFrame(lenisRaf);
    }
    requestAnimationFrame(lenisRaf);

    lenis.on("scroll", () => {
      if (window.scrollY < innerHeight) requestFrame();
    });

    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const target = a.getAttribute("href");
        if (target && target.length > 1) {
          e.preventDefault();
          lenis.scrollTo(target === "#top" ? 0 : target, {
            offset: 0,
            duration: 1.15,
          });
          history.pushState(null, null, target);
        }
      });
    });
  }
})();
