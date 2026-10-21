(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rad = (d) => (d * Math.PI) / 180;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 40) : ms));

  /* ──────────────────────────────────────────────────────────────────
   * Shared Animation & Timeline State
   * ────────────────────────────────────────────────────────────────── */
  const fx = (window.fx = {
    x: innerWidth * 0.27,
    y: innerHeight * 0.5,
    s: 420,
    twistE: 1,
    dockE: 0,
    progress: 0,
    hover: 0,
    kick: 0,
    fourOpacity: 1,
    morphE: 0,
    vw: innerWidth,
    vh: innerHeight
  });

  const root = document.documentElement;
  const nameReveal = $("#nameReveal");
  const wordmark = $("#wordmark");
  const topFade = $("#topFade");
  const hint = $("#scrollHint");
  const spot = $("#spot");
  const peek = $("#peek");
  const aboutP = $("#aboutP");
  const modeBtn = $("#modeBtn");

  // Page load sequence & hero arrival trigger
  const markLoaded = () => {
    requestAnimationFrame(() => {
      document.body.classList.add("loaded");
    });
  };
  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", markLoaded);
  } else {
    markLoaded();
  }

  let vw = innerWidth, vh = innerHeight;
  addEventListener("resize", () => {
    vw = fx.vw = innerWidth;
    vh = fx.vh = innerHeight;
  }, { passive: true });

  const scrollToTop = () => {
    scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    fx.kick = (fx.kick || 0) + 1;
  };
  if (wordmark) wordmark.addEventListener("click", scrollToTop);

  /* ──────────────────────────────────────────────────────────────────
   * Build / Break Mode with Circular View Transition
   * ────────────────────────────────────────────────────────────────── */
  function setMode(on, x, y) {
    const apply = () => {
      root.classList.toggle("break", on);
      if (modeBtn) modeBtn.setAttribute("aria-pressed", on ? "true" : "false");
      fx.kick = (fx.kick || 0) + 1;
      const themeMeta = $('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", on ? "#eae6df" : "#08080a");
    };

    if (reduce || !document.startViewTransition) {
      apply();
      return;
    }

    const ox = x ?? (modeBtn ? modeBtn.getBoundingClientRect().left : vw / 2);
    const oy = y ?? (modeBtn ? modeBtn.getBoundingClientRect().top : vh / 2);
    const r = Math.hypot(Math.max(ox, vw - ox), Math.max(oy, vh - oy));

    document.startViewTransition(apply).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${ox}px ${oy}px)`, `circle(${r}px at ${ox}px ${oy}px)`] },
        { duration: 850, easing: "cubic-bezier(.7, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
  }

  if (modeBtn) {
    modeBtn.addEventListener("click", (e) => {
      const b = modeBtn.getBoundingClientRect();
      const x = e.detail ? e.clientX : b.left + b.width / 2;
      const y = e.detail ? e.clientY : b.top + b.height / 2;
      setMode(!root.classList.contains("break"), x, y);
    });
  }

  addEventListener("keydown", (e) => {
    if ((e.key !== "b" && e.key !== "B") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/input|textarea/i.test(document.activeElement?.tagName || "")) return;
    if (modeBtn) modeBtn.click();
  });

  /* ──────────────────────────────────────────────────────────────────
   * Custom Tooltip Engine
   * ────────────────────────────────────────────────────────────────── */
  const tooltip = (() => {
    const el = document.createElement("div");
    el.className = "custom-tooltip";
    el.setAttribute("role", "tooltip");
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);

    let activeTarget = null;

    const show = (target, text, kbd) => {
      if (!text) return;
      activeTarget = target;
      el.innerHTML = "";
      el.appendChild(document.createTextNode(text));
      if (kbd) {
        const kbdEl = document.createElement("span");
        kbdEl.className = "custom-tooltip-kbd";
        kbdEl.textContent = kbd;
        el.appendChild(kbdEl);
      }
      position(target);
      el.classList.add("visible");
    };

    const position = (target) => {
      if (!target) return;
      const r = target.getBoundingClientRect();
      const tr = el.getBoundingClientRect();
      const pad = 8;

      let top = r.top - tr.height - pad;
      let left = r.left + (r.width - tr.width) / 2;

      // Flip to bottom if clipping top
      if (top < pad) {
        top = r.bottom + pad;
      }
      // Horizontal clamping
      if (left < pad) left = pad;
      if (left + tr.width > vw - pad) left = vw - tr.width - pad;

      el.style.left = `${left.toFixed(1)}px`;
      el.style.top = `${top.toFixed(1)}px`;
    };

    const hide = () => {
      activeTarget = null;
      el.classList.remove("visible");
    };

    // Auto-discover tooltips on hover
    const initTooltips = () => {
      // Convert native title attributes to data-tooltip to avoid default browser popup
      $$("[title]").forEach((item) => {
        const titleText = item.getAttribute("title");
        if (titleText) {
          item.dataset.tooltip = titleText;
          item.removeAttribute("title");
        }
      });

      document.addEventListener("pointerover", (e) => {
        const target = e.target.closest("[data-tooltip]");
        if (!target) return;
        const text = target.dataset.tooltip;
        const kbd = target.dataset.tooltipKbd || "";
        show(target, text, kbd);
      }, { passive: true });

      document.addEventListener("pointerout", (e) => {
        const target = e.target.closest("[data-tooltip]");
        if (target && target === activeTarget) hide();
      }, { passive: true });

      addEventListener("scroll", hide, { passive: true });
    };

    initTooltips();

    return { show, hide, position };
  })();

  /* ──────────────────────────────────────────────────────────────────
   * About Section: Word-by-Word Reading Light-Up on Scroll
   * ────────────────────────────────────────────────────────────────── */
  let wEls = [];
  let litWords = -1;

  if (aboutP) {
    const rawText = aboutP.textContent.trim();
    const words = rawText.split(/\s+/);
    aboutP.setAttribute("aria-label", rawText);
    aboutP.innerHTML = words.map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(" ");
    wEls = $$(".w", aboutP);
  }

  function updateAbout() {
    if (!aboutP || !wEls.length) return;
    let n = wEls.length;
    if (!reduce) {
      const r = aboutP.getBoundingClientRect();
      const p = clamp01((vh * 0.84 - r.top) / (vh * 0.42 + r.height * 0.7));
      n = Math.round(p * wEls.length);
    }
    if (n === litWords) return;
    litWords = n;
    wEls.forEach((el, i) => el.classList.toggle("on", i < n));
  }

  /* ──────────────────────────────────────────────────────────────────
   * Hover Cursor Peek Preview for Work Items
   * ────────────────────────────────────────────────────────────────── */
  const pk = { x: -999, y: -999, tx: -999, ty: -999 };
  function peekTick(dt) {
    if (!peek) return;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 14);
    pk.x += (pk.tx - pk.x) * k;
    pk.y += (pk.ty - pk.y) * k;
    let px = pk.x + 28;
    if (px + 250 > vw - 12) px = pk.x - 28 - 250;
    peek.style.transform = `translate3d(${px.toFixed(1)}px, ${(pk.y + 24).toFixed(1)}px, 0)`;
  }

  /* ──────────────────────────────────────────────────────────────────
   * Accordion Work Rows
   * ────────────────────────────────────────────────────────────────── */
  const index = $("#index");
  const rows = index ? $$(".row", index) : [];

  function setOpen(row, on) {
    row.classList.toggle("open", on);
    if (on) fx.kick = (fx.kick || 0) + 1;
    const head = $(".row-head", row);
    const panel = $(".row-panel", row);
    if (head) head.setAttribute("aria-expanded", on ? "true" : "false");
    if (panel) panel.inert = !on;
  }

  rows.forEach((row, i) => {
    const head = $(".row-head", row);
    if (!head) return;

    head.addEventListener("click", () => {
      const willOpen = !row.classList.contains("open");
      rows.forEach((r) => setOpen(r, false));
      if (willOpen) {
        setOpen(row, true);
        if (peek) peek.classList.remove("on");
        setTimeout(() => row.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }), 60);
      }
      if (index) index.classList.toggle("has-open", willOpen);
    });

    head.addEventListener("pointerenter", (e) => {
      fx.hover = 1;
      if (row.classList.contains("open") || !peek) return;
      $$(".peek-item", peek).forEach((el) => el.classList.toggle("on", +el.dataset.p === i));
      pk.x = pk.tx = e.clientX;
      pk.y = pk.ty = e.clientY;
      peek.classList.add("on");
    });

    head.addEventListener("pointermove", (e) => {
      pk.tx = e.clientX;
      pk.ty = e.clientY;
      const r = head.getBoundingClientRect();
      head.style.setProperty("--gx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
    });

    head.addEventListener("pointerleave", () => {
      fx.hover = 0;
      if (peek) peek.classList.remove("on");
    });
  });

  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && index && index.classList.contains("has-open")) {
      rows.forEach((r) => setOpen(r, false));
      index.classList.remove("has-open");
    }
  });

  /* ──────────────────────────────────────────────────────────────────
   * Footer Clock (Kerala, IST)
   * ────────────────────────────────────────────────────────────────── */
  const clock = $("#clock");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata"
    });
    const setClock = () => {
      clock.textContent = "kerala · " + fmt.format(new Date()) + " IST";
    };
    setClock();
    setInterval(setClock, 20000);
  }

  /* ──────────────────────────────────────────────────────────────────
   * Demo 01: CiteCamp Academic RAG Chat
   * ────────────────────────────────────────────────────────────────── */
  const CC = [
    {
      q: "what attendance do I need to sit the semester exam?",
      parts: [
        ["You need at least 75% attendance in every course to be eligible for the end-semester exam.", 1],
        ["A shortfall of up to 10% can be condoned with a valid medical certificate.", 2]
      ],
      src: ["academic regulations · clause 4.2 (attendance)", "syndicate condonation circular #112"]
    },
    {
      q: "how do I get an official transcript?",
      parts: [
        ["Submit the transcript request form to the Controller of Examinations office along with your student ID.", 1],
        ["Sealed copies dispatch within 5 working days.", 2]
      ],
      src: ["examination manual · section 9.1", "student service charter v2"]
    },
    {
      q: "can I get a paper re-evaluated?",
      parts: [
        ["Re-evaluation requests open for 10 days after results are published.", 1],
        ["If marks increase by 10% or more, the fee is refunded.", 2]
      ],
      src: ["ordinance 14.3 · revaluation window", "university fee schedule · clause 14.8"]
    }
  ];

  const ccChat = $("#ccChat");
  const ccBtns = $$("#ccChips .chip");
  let ccBusy = false;

  async function askCC(i) {
    if (ccBusy || !ccChat) return;
    ccBusy = true;
    ccBtns.forEach((b) => (b.disabled = true));
    const d = CC[i];

    if ($(".empty", ccChat)) ccChat.innerHTML = "";

    const me = document.createElement("div");
    me.className = "msg me";
    me.textContent = d.q;
    ccChat.appendChild(me);

    const bot = document.createElement("div");
    bot.className = "msg bot";
    const status = document.createElement("span");
    status.className = "status";
    status.textContent = "searching 3 indexed documents…";
    bot.appendChild(status);
    ccChat.appendChild(bot);
    ccChat.scrollTop = ccChat.scrollHeight;

    await wait(600);
    status.textContent = "pinning 2 source clauses…";
    await wait(450);
    bot.innerHTML = "";

    const p = document.createElement("p");
    bot.appendChild(p);

    for (const [text, n] of d.parts) {
      for (const w of text.split(" ")) {
        p.appendChild(document.createTextNode(w + " "));
        ccChat.scrollTop = ccChat.scrollHeight;
        await wait(22);
      }
      const c = document.createElement("span");
      c.className = "cite";
      c.textContent = n;
      p.appendChild(c);
      p.appendChild(document.createTextNode(" "));
      await wait(100);
    }

    const ol = document.createElement("ol");
    ol.className = "src";
    d.src.forEach((s, k) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="cite">${k + 1}</span><span>${s}</span>`;
      ol.appendChild(li);
    });
    bot.appendChild(ol);
    ccChat.scrollTop = ccChat.scrollHeight;

    ccBusy = false;
    ccBtns.forEach((b) => (b.disabled = false));
  }

  ccBtns.forEach((b) => b.addEventListener("click", () => askCC(+b.dataset.q)));

  /* ──────────────────────────────────────────────────────────────────
   * Demo 02: Johns Fitness Edge Biometric Scanner & Local WAL Sync
   * ────────────────────────────────────────────────────────────────── */
  const jfeNet = $("#jfeNet");
  const jfeNetLabel = $("#jfeNetLabel");
  const jfeQ = $("#jfeQ");
  const jfeFp = $("#jfeFp");
  const jfeRes = $("#jfeRes");
  const jfeSub = $("#jfeSub");
  const jfeLog = $("#jfeLog");

  let online = true;
  let scanning = false;
  let draining = false;
  const pending = [];
  const pad2 = (n) => String(n).padStart(2, "0");
  const stamp = () => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };
  const setQ = () => {
    if (jfeQ) jfeQ.textContent = pending.length;
  };

  function markSynced(li) {
    if (!li) return;
    const s = $(".state", li);
    if (s) {
      s.textContent = "synced";
      s.classList.remove("queued");
      s.classList.add("synced");
    }
  }

  async function drain() {
    if (draining) return;
    draining = true;
    while (online && pending.length) {
      await wait(380);
      if (!online) break;
      markSynced(pending.shift());
      setQ();
    }
    draining = false;
  }

  if (jfeNet) {
    jfeNet.addEventListener("click", () => {
      online = !online;
      jfeNet.setAttribute("aria-checked", online ? "true" : "false");
      if (jfeNetLabel) jfeNetLabel.textContent = online ? "network online" : "network offline";
      if (online) drain();
    });
  }

  if (jfeFp) {
    jfeFp.addEventListener("click", async () => {
      if (scanning) return;
      scanning = true;
      jfeFp.classList.add("go");
      if (jfeRes) jfeRes.textContent = "reading…";
      if (jfeSub) jfeSub.textContent = "matching template against local sqlite WAL";
      await wait(420);
      jfeFp.classList.remove("go");

      const ms = 9 + Math.floor(Math.random() * 7);
      const id = String(100 + Math.floor(Math.random() * 900)).padStart(4, "0");
      if (jfeRes) jfeRes.textContent = "verified";
      if (jfeSub) jfeSub.textContent = `turnstile open · ${ms} ms · ${online ? "online" : "local sqlite"}`;

      if (jfeLog) {
        const li = document.createElement("li");
        li.innerHTML = `<span>member #${id}</span><span class="when">${stamp()}</span><span class="state ${online ? "synced" : "queued"}">${online ? "syncing…" : "queued"}</span>`;
        jfeLog.prepend(li);
        while (jfeLog.children.length > 5) jfeLog.lastChild.remove();
        if (online) {
          wait(500).then(() => markSynced(li));
        } else {
          pending.push(li);
          setQ();
        }
      }
      scanning = false;
    });
  }

  /* ──────────────────────────────────────────────────────────────────
   * Demo 03: June Discord Gateway Terminal Simulation
   * ────────────────────────────────────────────────────────────────── */
  const jnTerm = $("#jnTerm");
  const jnBtns = $$("#jnChips .chip");
  const jnInput = $("#jnInput");

  function jnLine(text, cls) {
    if (!jnTerm) return;
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    jnTerm.appendChild(d);
    jnTerm.scrollTop = jnTerm.scrollHeight;
  }

  async function jnRun(cmd) {
    if (!cmd) return;
    jnLine("> " + cmd, "cmd");
    await wait(240);

    const c = cmd.trim().toLowerCase();
    if (c === "/ping") {
      jnLine(`pong · gateway ${26 + Math.floor(Math.random() * 14)}ms · rest ${88 + Math.floor(Math.random() * 25)}ms`, "out");
    } else if (c === "/status") {
      jnLine("gateway connected · shard 0/1 · uptime 41d 18h · rss 46.2MB", "out");
    } else if (c.startsWith("/remind")) {
      const parts = cmd.split(" ");
      const task = parts.slice(2).join(" ") || "stretch";
      jnLine(`scheduled timer #8841 · firing in 5s… (${task})`, "out");
      wait(5000).then(() => jnLine(`🔔 @aby reminder: ${task} (drift +1.1ms)`, "cmd"));
    } else if (c === "/help") {
      jnLine("available commands: /ping, /status, /remind 5s <task>, /whoami, /clear", "out");
    } else if (c === "/whoami") {
      jnLine("june: bespoke automation bot & state gateway for Aby Mathew.", "out");
    } else if (c === "/clear") {
      jnTerm.innerHTML = "";
    } else {
      jnLine(`unknown command: ${cmd}. try /help`, "out");
    }
  }

  jnBtns.forEach((b) => b.addEventListener("click", () => jnRun(b.dataset.c)));

  if (jnInput) {
    jnInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = jnInput.value.trim();
        if (val) {
          jnRun(val);
          jnInput.value = "";
        }
      }
    });
  }

  /* ──────────────────────────────────────────────────────────────────
   * Contact Section: Email Click-to-Copy
   * ────────────────────────────────────────────────────────────────── */
  const mail = $("#mail");

  if (mail) {
    let copyTimeout;

    const copyText = (txt) => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
      } else {
        fallbackCopy(txt);
      }
    };

    const fallbackCopy = (txt) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (_) {}
    };

    mail.addEventListener("pointermove", (e) => {
      const r = mail.getBoundingClientRect();
      mail.style.setProperty("--gx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
    });

    mail.addEventListener("click", (e) => {
      e.preventDefault();
      const addr = mail.textContent.trim();
      copyText(addr);

      mail.dataset.tooltip = "copied.";
      tooltip.show(mail, "copied.");

      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        mail.dataset.tooltip = "click to copy";
        if (document.querySelector(".custom-tooltip.visible")) {
          tooltip.show(mail, "click to copy");
        }
      }, 2000);
    });

    mail.addEventListener("pointerleave", () => {
      clearTimeout(copyTimeout);
      mail.dataset.tooltip = "click to copy";
    });
  }

  /* ──────────────────────────────────────────────────────────────────
   * Recent Activity (GitHub Integration)
   * ────────────────────────────────────────────────────────────────── */
  (() => {
    const slot = $("#recentPush");
    if (!slot) return;

    const ago = (iso) => {
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
      if (s < 86400) return `${Math.round(s / 3600)}h ago`;
      return `${Math.round(s / 86400)}d ago`;
    };

    const RECENT_URL = "https://worker-round-credit-5733.abyperhaps.workers.dev";
    const CACHE_KEY = "4ofl-recent";

    const render = ({ repo, at }) => {
      if (repo) {
        slot.innerHTML = `<a href="https://github.com/${repo}" target="_blank" rel="noopener noreferrer">${repo.split("/")[1] || repo}</a> · ${ago(at)}`;
      } else {
        slot.textContent = `private repo · ${ago(at)}`;
      }
    };

    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached) {
        render(cached);
        if (Date.now() - cached.t < 2 * 60 * 1000) return;
      }
    } catch (_) {}

    const fetchPublic = () =>
      fetch("https://api.github.com/users/4ofl/events/public?per_page=15")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((events) => {
          const push = events.find((e) => e.type === "PushEvent");
          if (!push) return Promise.reject();
          return { repo: push.repo.name, at: push.created_at };
        });

    fetch(RECENT_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => (d.at ? { repo: d.name ? `4ofl/${d.name}` : null, at: d.at } : fetchPublic()))
      .catch(() => fetchPublic())
      .then((data) => {
        const payload = { ...data, t: Date.now() };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch (_) {}
        render(payload);
      })
      .catch(() => {});
  })();

  /* ──────────────────────────────────────────────────────────────────
   * Active Nav Link Highlighter via IntersectionObserver
   * ────────────────────────────────────────────────────────────────── */
  const navLinks = $$(".nav a");
  const sections = $$("main section");

  if (navLinks.length && sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          navLinks.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + en.target.id));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
  }

  /* ──────────────────────────────────────────────────────────────────
   * Scroll Choreography (Hero Name -> Docked Wordmark)
   * ────────────────────────────────────────────────────────────────── */
  let sm = scrollY;
  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    sm += (scrollY - sm) * (1 - Math.exp(-dt * (reduce ? 30 : 8)));
    const p = clamp01(sm / (vh * 0.92));

    const dockE = easeInOut(clamp01((p - 0.03) / 0.8));
    const mobile = vw < 768;
    const pad = Math.max(20, Math.min(vw * 0.045, 64));
    const baseS = Math.min(vh * 0.56, (vw * 0.72) / 0.95, 480);

    const heroPos = mobile
      ? { x: vw / 2, y: vh * 0.31, s: Math.min(vh * 0.3, vw * 0.55) }
      : { x: vw * 0.26, y: vh * 0.5, s: baseS };
    const dockPos = { x: pad + 56, y: 44, s: 70 };

    const moveT = clamp01(dockE / 0.48);
    const x = lerp(heroPos.x, lerp(heroPos.x, dockPos.x, 0.55), moveT);
    const y = lerp(heroPos.y, lerp(heroPos.y, dockPos.y, 0.55), moveT);
    const s = lerp(heroPos.s, heroPos.s * 0.68, moveT);

    const fourOpacity = clamp01(1 - dockE / 0.38);
    const morphE = clamp01((dockE - 0.14) / 0.72);

    Object.assign(fx, { x, y, s, twistE: 1, dockE, progress: p, fourOpacity, morphE });

    if (spot) {
      const spotX = lerp(heroPos.x, dockPos.x, dockE);
      const spotY = lerp(heroPos.y, dockPos.y, dockE);
      spot.style.setProperty("--sx", spotX.toFixed(0) + "px");
      spot.style.setProperty("--sy", spotY.toFixed(0) + "px");
      spot.style.setProperty("--so", lerp(1, 0.38, dockE).toFixed(3));
    }

    if (nameReveal) {
      const fadeOut = clamp01((p - 0.06) / 0.52);
      nameReveal.style.opacity = (1 - fadeOut).toFixed(3);
      const liftY = -fadeOut * 36;
      nameReveal.style.transform = mobile
        ? `translate(-50%, calc(-50% + ${liftY.toFixed(1)}px))`
        : `translate(0px, calc(-50% + ${liftY.toFixed(1)}px))`;
    }

    if (wordmark) {
      wordmark.style.opacity = clamp01((dockE - 0.08) / 0.14).toFixed(3);
      const active = dockE > 0.72;
      wordmark.classList.toggle("active", active);
      wordmark.tabIndex = active ? 0 : -1;
    }

    if (topFade) topFade.style.opacity = dockE.toFixed(3);
    if (hint) hint.style.opacity = Math.max(0, 1 - p * 4).toFixed(3);

    updateAbout();
    peekTick(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ──────────────────────────────────────────────────────────────────
   * Three.js 3D Chrome 4 & Dissolving Streamlines Engine
   * ────────────────────────────────────────────────────────────────── */
  (() => {
    if (!window.THREE) return;
    const canvas = document.getElementById("gl");
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const FOV = 30, CAM_Z = 14;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, CAM_Z);

    /* Studio environment with softboxes */
    function buildEnvironment() {
      const W = 2048, H = 1024;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d");
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#272522");
      bg.addColorStop(0.45, "#0e0d0c");
      bg.addColorStop(0.55, "#08080a");
      bg.addColorStop(1, "#020203");
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);

      const box = (x, y, w, h, color, blur) => {
        g.save();
        g.shadowColor = color;
        g.shadowBlur = blur;
        g.fillStyle = color;
        g.fillRect(x, y, w, h);
        g.restore();
      };
      box(180, 230, 360, 190, "#fffaf2", 60);
      box(1050, 200, 460, 130, "#f7f2eb", 70);
      box(1560, 300, 90, 360, "#e3d7c8", 50);
      box(760, 340, 65, 300, "#ffbe8f", 45);
      box(0, 40, W, 34, "#ebe4da", 40);
      box(1850, 250, 150, 220, "#ffffff", 55);
      box(420, 640, 520, 36, "#a39b90", 40);
      box(1300, 700, 380, 24, "#ffd7b5", 35);

      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.encoding = THREE.sRGBEncoding;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      pmrem.dispose();
      return env;
    }
    scene.environment = buildEnvironment();

    /* Extruded "4" Geometry */
    function build4(bevelSeg = 12, curveSeg = 12) {
      const outer = [
        [54, 0], [80, 0], [80, 22], [96, 22], [96, 42],
        [80, 42], [80, 100], [54, 100], [0, 42], [0, 22], [54, 22]
      ];
      const shape = new THREE.Shape();
      shape.moveTo(outer[0][0], outer[0][1]);
      for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1]);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(26, 42);
      hole.lineTo(54, 72);
      hole.lineTo(54, 42);
      hole.closePath();
      shape.holes.push(hole);

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 16,
        bevelEnabled: true,
        bevelThickness: 6,
        bevelSize: 3.5,
        bevelSegments: bevelSeg,
        curveSegments: curveSeg
      });
      geo.scale(0.04, 0.04, 0.04);
      geo.center();
      geo.computeBoundingBox();
      return geo;
    }

    const geometry = build4();
    const H0 = geometry.boundingBox.max.y - geometry.boundingBox.min.y;

    const planeSolid = new THREE.Plane(new THREE.Vector3(0, -1, 0), 9999);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xe6e3dc,
      metalness: 1,
      roughness: 0.07,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
      clippingPlanes: [planeSolid]
    });
    material.transparent = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.order = "YXZ";
    scene.add(mesh);

    /* Floor Reflection */
    const floorU = { value: 0 }, fadeU = { value: 1 };
    const reflMat = material.clone();
    reflMat.transparent = true;
    reflMat.depthWrite = false;
    reflMat.opacity = 0;
    reflMat.onBeforeCompile = (sh) => {
      sh.uniforms.uFloorY = floorU;
      sh.uniforms.uFade = fadeU;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vWorldY;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vWorldY;\nuniform float uFloorY;\nuniform float uFade;")
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(uFloorY - uFade, uFloorY, vWorldY);");
    };
    const refl = new THREE.Mesh(geometry, reflMat);
    refl.rotation.order = "YXZ";
    refl.visible = false;
    scene.add(refl);

    /* Wireframe Twin for Break Mode & Dissolve Sweep */
    const wirePlaneLow = new THREE.Plane(new THREE.Vector3(0, 1, 0), 9999);
    const wirePlaneHigh = new THREE.Plane(new THREE.Vector3(0, -1, 0), 9999);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xedece8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
      clippingPlanes: [wirePlaneLow, wirePlaneHigh]
    });
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(build4(2, 2), 15), wireMat);
    wire.rotation.order = "YXZ";
    wire.visible = false;
    scene.add(wire);

    const lightA = new THREE.PointLight(0xfffcf7, 1.6, 0);
    const lightB = new THREE.PointLight(0xffc99e, 1.35, 0);
    scene.add(lightA, lightB);

    const ptr = { x: innerWidth / 2, y: innerHeight / 2 };
    const gyro = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };
    let gyroOn = false;

    addEventListener("pointermove", (e) => {
      ptr.x = e.clientX;
      ptr.y = e.clientY;
    }, { passive: true });

    function onOrient(e) {
      if (e.gamma == null || e.beta == null) return;
      gyro.x = clamp(e.gamma / 30, -1, 1);
      gyro.y = clamp((e.beta - 60) / 30, -1, 1);
    }

    addEventListener("touchend", () => {
      if (gyroOn || !("DeviceOrientationEvent" in window)) return;
      gyroOn = true;
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
          .then((s) => {
            if (s === "granted") addEventListener("deviceorientation", onOrient);
          })
          .catch(() => {
            gyroOn = false;
          });
      } else {
        addEventListener("deviceorientation", onOrient);
      }
    }, { once: true, passive: true });

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2(2, 2);
    let hovering = false;
    let spin = 0, spinTarget = 0, lastKick = 0;

    addEventListener("click", () => {
      if (fx.dockE < 0.25 && hovering) spinTarget += Math.PI * 2;
    });

    /* Vector Signature Paths */
    const GLYPH_PATHS = [
      "M86.7 4.0C86.4 3.7 86.0 3.7 85.6 3.9C83.3 5.2 81.1 6.8 79 8.5C76.8 10.2 74.6 12.1 72.5 13.8C68.0 17.5 63.5 21.2 59.0 24.9C56.4 27 53.9 29.1 51.3 31.2L51.3 31.2C51.3 31.3 51.2 31.3 51.1 31.4C51.1 31.4 51.1 31.4 51.1 31.4C51.0 31.4 51.0 31.5 50.9 31.6C50.9 31.6 50.9 31.6 50.9 31.6C50.8 31.6 50.7 31.7 50.7 31.7C50.7 31.7 50.6 31.8 50.6 31.8C50.3 32.1 49.8 32.4 49.4 32.8C49.4 32.8 49.3 32.9 49.2 32.9C47.9 34.0 46.2 35.3 45.2 36.2C45.2 36.2 45.2 36.2 45.2 36.2C45.0 36.4 44.9 36.4 44.9 36.5C44.8 36.5 44.8 36.6 44.7 36.6C44.7 36.7 44.6 36.7 44.6 36.7L44.4 36.8C44.4 36.8 44.4 36.8 44.4 36.8C44.4 36.9 44.3 37.0 44.3 37.0C44.3 37.0 44.3 37.0 44.3 37.0L43.4 37.7C39.3 39.1 35.1 40.5 31.1 42C26.0 43.8 20.9 45.7 16 48C13.5 49.1 11.2 50.3 8.9 51.5C7.7 52.2 6.5 52.9 5.4 53.5C4.8 53.9 4.2 54.2 3.6 54.5C3.0 55.0 2.2 55.4 2.4 56.3C2.6 57.1 3.6 57.5 4.2 56.8C4.3 56.6 4.4 56.4 4.4 56.2C4.5 56.2 4.5 56.1 4.5 56.1C4.8 55.9 5.1 55.7 5.3 55.6C5.9 55.3 6.4 55.0 6.9 54.6C8.0 54 9.1 53.4 10.2 52.8C12.4 51.6 14.6 50.5 16.9 49.5C21.4 47.5 26.0 45.7 30.6 44.0C33.6 42.9 36.6 41.9 39.6 40.9C37.1 42.9 34.6 44.9 32.1 47.0C27.6 50.6 23.2 54.2 18.8 58.0C18.3 58.4 17.7 58.9 17.2 59.4C16.8 59.7 16.9 60.3 17.2 60.7C17.6 61.0 18.1 61.0 18.5 60.7C22.7 56.9 27.2 53.3 31.7 49.6C35.9 46.1 40.1 42.7 44.3 39.2C44.6 39.1 44.9 39.1 45.1 38.9C48.9 37.7 52.7 36.4 56.5 35.3C57.9 34.9 60.9 34.1 64.4 33.4C64.4 33.4 64.5 33.4 64.9 33.3C64.8 33.3 64.8 33.4 64.8 33.4L64.7 33.6L64.7 33.6C61.7 38.0 58.7 42.5 55.7 46.9C55.7 46.9 55.7 46.9 55.7 46.9C55.4 47.5 55 48 54.6 48.5C54.1 49.3 53.1 50.8 52.9 51.1C52.1 52.3 51.3 53.5 50.6 54.7C50.1 55.3 49.8 55.9 49.4 56.6C49.1 56.9 49.4 57.5 49.7 57.7C50.2 58.0 50.7 57.8 50.9 57.4C51.9 55.7 53.0 54.1 54.1 52.5L54.1 52.5C54.1 52.5 54.1 52.4 54.2 52.4C54.3 52.2 54.4 52.0 54.5 51.9L54.8 51.5C54.8 51.5 54.8 51.5 54.8 51.5C55.1 51 55.4 50.5 55.7 50.0C58.2 46.3 60.7 42.6 63.2 38.9C64.4 37.1 65.6 35.3 66.9 33.5L67.2 32.9C68.2 32.8 69.3 32.6 70.5 32.4L72.5 32.2C73.1 32.1 73.6 32.0 74.1 32.0C74.1 32.0 74.9 31.9 74.7 30.6C74.7 30.5 74.7 30.5 74.7 30.5C74.1 30.5 73.4 30.6 73.1 30.6C71.4 30.7 69.9 30.8 68.6 31.0L68.9 30.5L68.9 30.5C69.0 30.3 69.2 30.1 69.3 29.9L69.3 29.9L69.5 29.6C69.7 29.3 69.9 29.0 70.1 28.7C70.1 28.7 70.1 28.7 70.1 28.7L71.6 26.5C71.6 26.5 71.6 26.5 71.6 26.5C71.7 26.3 71.9 26.0 72.0 25.9L72.3 25.6L72.3 25.6C74.2 22.7 76.2 19.8 78.2 17.0C81.0 13.0 83.9 9 86.8 5.1C87.0 4.8 86.9 4.3 86.7 4.0ZM69.9 25.8C69.8 26.2 69.5 26.5 69.3 26.8C69.2 27 68.1 28.6 67.5 29.5C67.2 29.9 66.9 30.4 66.6 30.7L66.6 30.7L66.6 30.8C66.6 30.8 66.6 30.8 66.5 30.8L66.5 30.8C66.5 30.9 66.5 30.9 66.5 31.0L66.5 31.0L66.2 31.3C66.1 31.3 66.0 31.3 65.9 31.4C60.7 32.2 52.5 34.7 51.2 35.1C50.1 35.5 49.1 35.8 48.1 36.1L50.1 34.5L50.1 34.5L54.4 30.9C55.8 29.8 57.2 28.7 58.5 27.5C63.0 23.9 67.4 20.2 71.9 16.5C74.1 14.7 76.3 12.9 78.5 11.1C79.8 10.1 81.1 9 82.4 8.0C78.1 13.9 74.0 19.9 69.9 25.8Z",
      "M90.0 14.0C89.4 13.9 88.9 13.9 88.4 14.0C87.5 14.2 86.9 14.8 86.3 15.4C84.0 17.7 81.8 20.2 79.8 22.7C78.3 24.5 77.0 26.5 75.7 28.4L72.0 34.6C71.9 34.7 71.8 34.8 71.7 35.0C70.9 36.4 70.1 37.9 69.5 39.4C69.1 40.3 68.9 41.2 69.3 42.2C69.3 42.2 69.4 42.3 69.4 42.4C69.5 42.4 69.5 42.5 69.5 42.5C69.5 42.6 69.6 42.7 69.6 42.8C70.8 44.2 73.6 42.5 75.2 41.3C76.3 40.4 77.3 39.4 78.3 38.5C79.2 37.6 80.4 36.4 81.0 35.3L82.7 34.2C83.4 33.8 85.7 32.4 86.9 31.7C87.8 31.0 87.0 30.5 87.0 30.5L87.0 30.5L81.3 33C81.3 33 81.2 32.7 81.1 32.3C81.1 32.3 81.1 32.3 81.1 32.3C81.1 32.2 81.0 32.1 81.0 32.0C80.7 31.6 80.3 31.1 79.4 31.0L79.4 31.0C79.3 31.0 79.2 31.0 79.1 31.0C78.3 31.0 77.6 31.4 77.1 31.9C76.1 32.8 75.5 34.1 75.5 35.6C75.5 36.1 75.9 36.5 76.4 36.7C76.7 36.8 77.0 36.9 77.3 36.9C76.4 37.8 75.5 38.6 74.4 39.4C73.8 40.0 73.1 40.4 72.4 40.9C72.0 41.2 71.5 41.5 71.1 41.8C70.9 41.4 71.0 40.8 71.1 40.4C71.2 40.3 71.3 40.2 71.3 40.1L71.3 40.1C71.4 39.9 71.4 39.8 71.5 39.7C72.9 36.7 74.6 33.7 76.4 30.9C76.5 30.7 76.7 30.5 76.8 30.4C78.6 28.9 80.4 27.4 82.2 25.9C84.5 23.9 86.6 21.8 88.5 19.5C88.9 19.0 89.4 18.4 89.8 17.8C90.0 17.5 90.2 17.2 90.4 16.9C90.6 16.5 90.9 16.1 91 15.7C91.1 15 90.7 14.2 90.0 14.0ZM77.4 34.9C77.5 34.7 77.5 34.7 77.6 34.6C77.6 34.5 77.6 34.4 77.6 34.4C77.6 34.4 77.7 34.3 77.7 34.3C77.7 34.3 77.7 34.2 77.7 34.2C77.7 34.2 77.8 34.1 77.8 34.1C77.9 34.0 77.9 33.9 78.0 33.8C78.0 33.7 78.2 33.7 78.2 33.5C78.2 33.5 78.3 33.5 78.3 33.5C78.3 33.5 78.3 33.4 78.3 33.4C78.5 33.3 78.7 33.2 78.9 33.1C78.9 33 79 32.9 79.1 32.9L79.1 32.9C79.1 32.9 79.1 32.9 79.1 32.9C79.2 32.9 79.5 32.8 79.5 33.2C79.5 33.2 79.5 33.2 79.5 33.2C79.5 33.4 79.5 33.5 79.5 33.5L79.5 33.5C79.5 33.6 79.5 33.6 79.5 33.7C79.5 33.7 79.5 33.7 79.5 33.7C79.4 33.7 79.4 33.7 79.4 33.8C79.4 34.0 79.3 34.1 79.2 34.3C79.2 34.3 79.2 34.3 79.2 34.3C79.2 34.4 79.1 34.4 79 34.5C78.6 34.7 78.2 34.9 77.7 35.0C77.6 35.1 77.5 35.1 77.4 35.2C77.4 35.0 77.4 35.0 77.4 34.9ZM88.4 16.3C88 16.9 87.6 17.3 87.3 17.9C86.5 18.8 85.7 19.8 84.8 20.8C83.9 21.7 83.1 22.4 82.2 23.3C81.9 23.5 81.6 23.8 81.3 24.1C81.6 23.6 81.9 23.2 82.3 22.8C83.3 21.5 84.5 20.2 85.6 19.0C86.1 18.4 86.7 17.8 87.3 17.2C87.6 16.9 87.8 16.6 88.1 16.4C88.2 16.3 88.4 16.1 88.5 16.0C88.6 16.0 88.6 16.0 88.6 16.0C88.5 16.1 88.5 16.2 88.4 16.3ZM89.2 15.1C89.2 15.1 89.2 15.1 89.2 15.1C89.2 15 89.2 15 89.2 15.1Z",
      "M101.0 30.5L83.1 49.3L81.1 51.3C81.6 50.6 82.1 49.9 82.5 49.1C85.1 45.2 87.6 41.4 90.2 37.6C91.6 35.4 93.0 33.2 94.5 31.0C94.7 30.6 94.6 30.1 94.3 29.9C93.9 29.6 93.5 29.6 93.1 29.9C91.4 31.4 89.8 33.1 88.3 34.8C86.7 36.5 85.4 38.2 83.9 39.9C83.6 40.3 83.3 40.6 83.0 40.9C83.1 40.6 83.3 40.3 83.4 40.1C83.9 39.1 84.5 38.1 85 37.1C86.1 35.2 87.2 33.3 88.5 31.4C88.7 31.0 88.5 30.5 88.1 30.2C87.7 30 87.2 30.2 86.9 30.5C85.7 32.4 84.6 34.3 83.6 36.2C83.0 37.1 82.5 38.1 82 39.1C81.5 40.0 80.9 41.0 80.7 42.1C80.6 42.8 80.7 43.5 81.4 43.8C82 44.0 82.6 43.7 83.1 43.3C83.9 42.7 84.5 41.9 85.2 41.1C86.0 40.2 86.8 39.2 87.6 38.3L85.2 41.9C82.7 45.6 80.1 49.3 77.9 53.3C77.4 54.1 77.0 55.0 76.5 55.8C76.4 56.2 76.3 56.8 76.8 57.1C77.8 57.5 79.1 56.3 79.9 55.6C80.1 55.3 80.3 55.1 80.6 54.8L80.6 54.8C82.5 52.6 85.7 49.1 85.7 49.1C91.9 42.4 99.3 34.4 101.3 32.0C102.0 31.3 101.0 30.5 101.0 30.5Z",
      "M157.4 4.8C157.3 4.6 157.1 4.4 156.8 4.4C156.6 4.4 156.4 4.5 156.2 4.6C155.3 4.9 154.5 5.5 153.8 6.1C152.2 7.6 150.6 9.1 149.1 10.5C144.6 14.6 140.3 18.7 136.1 23.0C132.8 26.3 129.8 29.7 126.8 33.2C130.1 28.6 133.4 24 136.4 19.3C137.6 17.6 138.6 15.8 139.5 14.1C140.0 13.2 140.5 12.3 140.9 11.4C141.1 10.9 141.3 10.4 141.3 9.8C141.3 9.2 141.0 8.4 140.3 8.4C140.1 8.4 139.9 8.5 139.8 8.5C139.5 8.6 139.3 8.7 139.1 8.8C138.6 9.2 138.1 9.6 137.6 10.0C136.8 10.7 136.1 11.5 135.3 12.2C131.9 15.2 128.7 18.6 125.7 22.1C122.7 25.6 119.7 29.1 116.9 32.7C113.9 36.3 111.1 39.9 108.3 43.6C107.0 45.5 105.6 47.3 104.3 49.1C104.0 49.5 103.8 49.9 103.5 50.2C104.2 48.7 105.0 47.3 105.8 45.8C107.7 42.7 109.8 39.5 111.9 36.5C116.2 30.1 120.5 23.6 124.8 17.2C127.2 13.6 129.6 9.9 132.0 6.2C132.3 5.8 132.1 5.3 131.7 5.0C131.3 4.8 130.8 5.0 130.5 5.3C126.2 11.9 121.9 18.4 117.5 24.9C115.4 28.1 113.2 31.4 111.0 34.6C108.9 37.7 106.8 40.9 104.9 44.0C103.4 46.5 102.0 49.0 101.0 51.7C100.6 52.9 100.0 55.1 100.8 55.4C101.5 55.7 103.2 53.7 104.2 52.3C104.4 52.0 104.6 51.7 104.9 51.4C104.9 51.3 105.0 51.2 105.0 51.1C105.0 51.1 105.0 51.1 105.0 51.1C106.3 49.4 107.6 47.6 108.8 46.0C111.4 42.4 114.1 38.9 116.9 35.4C119.7 31.9 122.6 28.4 125.6 24.9C128.4 21.5 131.4 18.2 134.7 15.1C135.7 14.2 136.8 13.2 137.8 12.2C138.2 11.8 138.7 11.3 139.2 11.0C139.2 11.0 139.2 11.0 139.2 11.0C139.1 11.2 138.9 11.4 138.8 11.6C138.5 12.4 138.1 13.1 137.7 13.9C136.8 15.4 135.9 16.9 134.9 18.4C133 21.3 131.0 24.2 129.0 27.1C124.8 33 120.5 38.8 116.5 44.9C114.4 48.2 112.3 51.5 110.6 55.1C110.4 55.3 110.4 55.6 110.6 55.9C110.6 56.0 110.7 56.2 110.9 56.3C111.1 56.4 111.3 56.4 111.5 56.4C111.7 56.3 111.9 56.2 112.1 56.0C112.2 55.7 112.4 55.5 112.5 55.3C115.7 50.3 119.1 45.5 122.7 40.9C126.5 36.1 130.5 31.4 134.7 26.9C138.8 22.6 143.2 18.4 147.6 14.2C149.9 12.2 152.1 10.1 154.4 8.0C154.8 7.6 155.3 7.2 155.7 6.8C155.7 6.8 155.7 6.8 155.7 6.8C155.5 7.3 155.3 7.7 155.1 8.2C153.8 10.9 152.1 13.4 150.5 15.8C148.8 18.4 147.0 20.9 145.3 23.4C141.7 28.4 137.9 33.4 134.3 38.3C130.7 43.3 127.1 48.3 123.9 53.6C123.2 54.8 122.4 56.2 121.8 57.5C121.4 58.4 120.8 59.5 120.9 60.5C120.9 61.1 121.2 61.6 121.7 61.9C122.2 62.2 122.9 62.2 123.5 62.0C124.2 61.8 124.7 61.4 125.2 60.9C125.6 60.4 126.0 59.9 126.5 59.5C128.6 57.4 130.5 55.0 132.5 52.7C134.1 50.9 135.8 49.0 137.4 47.2C137.4 47.2 137.4 47.2 137.4 47.2C139.8 44.5 149.9 32.5 150.3 31.9C150.6 31.4 149.9 30.5 149.9 30.5C149.4 31.0 149.0 31.6 148.5 32.0C147.5 33.2 146.5 34.4 145.5 35.5C143.4 37.9 141.2 40.3 139.1 42.6C137.1 44.9 135.0 47.2 132.9 49.6C131.0 51.8 129.1 54.1 127.1 56.3C126.1 57.4 125.1 58.4 124.2 59.4C124.0 59.6 123.8 59.8 123.6 60C123.6 60 123.5 60.1 123.5 60.1C123.5 60.1 123.4 60.1 123.4 60.1C123.3 60.2 123.2 60.2 123.2 60.3C123.1 60.3 123.1 60.3 123.1 60.3C123.1 60.3 123.1 60.3 123.0 60.3C123.0 60.3 122.9 60.4 122.9 60.4C122.9 60.4 122.9 60.4 122.9 60.4C122.9 60.4 122.9 60.4 122.8 60.4C122.7 60.4 122.7 60.4 122.6 60.4C122.6 60.4 122.6 60.4 122.6 60.4C122.6 60.4 122.6 60.4 122.6 60.3C122.6 60.2 122.7 59.9 122.6 60.2C122.6 60.1 122.6 60 122.7 59.9C122.7 59.7 122.8 59.5 122.9 59.3C122.9 59.3 122.9 59.3 122.9 59.2C122.9 59.3 122.9 59.3 122.9 59.3C122.9 59.3 122.9 59.2 122.9 59.2C123.0 59.0 123.1 58.9 123.2 58.7C123.8 57.3 124.5 56.0 125.3 54.7C128.4 49.5 131.9 44.6 135.5 39.7C139.1 34.7 142.8 29.8 146.4 24.8C148.2 22.4 149.9 19.9 151.5 17.4C153.2 15 154.8 12.5 156.2 9.9C156.6 9.1 157 8.3 157.2 7.4C157.5 6.7 157.8 5.6 157.4 4.8ZM139.5 10.6C139.6 10.6 139.6 10.6 139.6 10.6C139.6 10.6 139.6 10.6 139.5 10.6C139.5 10.6 139.5 10.6 139.5 10.6ZM122.5 60.4C122.5 60.4 122.5 60.4 122.5 60.4C122.5 60.4 122.5 60.4 122.5 60.4ZM155.9 5.8C155.9 5.8 155.9 5.8 155.9 5.8C155.9 5.8 155.9 5.8 155.9 5.8C155.9 5.8 155.9 5.8 155.9 5.8Z",
      "M155.6 37.8C158.4 35.5 162.1 31.9 162.4 31.4C162.6 31.0 161.9 30.5 161.9 30.5L148.9 41.0C148.8 41.1 148.7 41.2 148.6 41.3L148.6 41.3L148.4 41.5C147.4 42.2 147.9 41.2 148.1 40.8C148.2 40.7 148.2 40.6 148.3 40.4C148.8 39.6 149.3 38.8 149.8 38.0C151.2 35.8 152.7 33.7 154.2 31.7C154.5 31.3 154.7 30.8 154.4 30.5C154.1 30.3 153.6 30.3 153.2 30.6C153.2 30.7 153.1 30.7 153.0 30.7L153.0 30.5C153.0 30.2 152.9 29.9 152.6 29.8L152.3 29.6C150.5 29.1 147.3 33 146.6 34.0C146.1 34.6 145.9 35.2 145.8 35.5C145.8 35.9 145.9 36.5 146.4 36.7C146.8 36.8 147.3 36.8 147.8 36.7C148.1 36.5 148.5 36.4 148.8 36.2C149.0 36.1 149.1 36 149.2 35.9C149.2 35.9 149.3 35.9 149.3 35.9L148.5 37.0C147.9 38.0 147.2 39.1 146.7 40.1C146.1 41.1 145.4 42.3 145.8 43.1C146.0 43.3 146.1 43.5 146.2 43.6L146.6 43.7C146.6 43.7 146.7 43.8 146.8 43.8L146.8 43.8C146.8 43.8 146.8 43.8 146.8 43.8C147.0 43.8 147.2 43.8 147.3 43.8C147.7 43.7 148.2 43.6 148.7 43.2L148.7 43.2C148.7 43.2 148.8 43.2 148.8 43.2C149.3 42.9 149.7 42.6 150.2 42.2C155.6 37.8 155.6 37.8 155.6 37.8ZM148.2 34.7C148.7 34.2 149.1 33.7 149.7 33.1C149.9 32.9 150.2 32.6 150.5 32.3L150.8 31.9L151.0 31.7C151.1 31.9 151.2 32.0 151.4 32.1L149.6 33.6Z",
      "M182.3 19.0C178.4 19.5 174.5 19.9 170.6 20.3L173.4 16.1C173.6 15.8 173.7 15.5 174.0 15.2C174.5 14.4 173.5 13.6 172.8 14.0C172.4 14.2 172.1 14.5 172 14.8C171.9 14.9 171.9 15.1 171.9 15.2L168.3 20.6C166 20.9 163.7 21.1 161.3 21.4C159.3 21.6 157.4 21.8 155.4 22.0C154.9 22.1 154.5 22.4 154.5 22.9C154.5 23.3 154.9 23.8 155.4 23.8C159.3 23.3 163.2 22.9 167.1 22.5L153.3 43.4L153.3 43.4L153.1 43.8C152.7 44.4 152.1 45.6 152.9 46.1C153.7 46.6 155.3 45.5 156.0 44.9L156.0 44.9L156.0 44.9C156.0 44.9 156.1 44.9 156.2 44.8L172.2 31.9C173.1 31.1 172.1 30.5 172.1 30.5L158.6 40.8L155.8 42.9L161.0 34.9C161.6 34.0 162.3 33.1 162.9 32.2L169.4 22.3C171.7 22.0 174.0 21.7 176.4 21.5C178.4 21.2 180.3 21 182.3 20.8C182.8 20.8 183.2 20.5 183.2 19.9C183.2 19.5 182.8 19.0 182.3 19.0Z",
      "M179.3 40.6L187.8 32.5L188.0 32.3L188.4 31.8C188.9 31.3 188.1 30.5 188.1 30.5C185.1 33.1 182.1 35.6 179.3 38.2C178.5 38.9 177.7 39.7 176.9 40.4C176.3 41.0 175.5 41.8 174.8 42.4C174.6 42.6 174.3 42.7 174.1 42.9C174.3 41.9 174.6 41.0 174.9 40.1C175.3 39 175.8 37.9 176.2 36.8C176.4 36.4 176.7 35.8 176.9 35.3C177.0 35.1 177.0 35.0 177.0 34.8L177.0 34.8C177.0 34.8 177.0 34.8 177.0 34.7C177.1 34.7 177.1 34.7 177.1 34.7C177.1 34.7 177.1 34.7 177.1 34.7C177.1 34.7 177.1 34.6 177.1 34.6C177.1 34.6 177.1 34.6 177.2 34.6C177.2 34.2 177.4 33.4 177.0 33.2C177.0 33.2 176.9 33.1 176.9 33.1C176.9 33.1 176.9 33.1 176.9 33.1C176.9 33.1 176.8 33.1 176.7 33.1C176.4 33 176.0 33.3 175.7 33.5C175.6 33.5 175.5 33.7 175.4 33.7L175.4 33.7C173.8 35.0 172.2 36.3 170.6 37.6C169.8 38.2 169.1 38.8 168.3 39.4C170.3 36.5 172.2 33.5 174.2 30.5C176.8 26.6 179.4 22.7 182.0 18.8C183.5 16.6 185.0 14.4 186.4 12.2C186.6 11.8 186.5 11.2 186.1 11.0C185.7 10.7 185.1 10.9 184.9 11.3C182.3 15.2 179.7 19.1 177.0 23.1C174.5 27 171.8 30.9 169.2 34.8C167.9 36.9 166.5 39 165.1 41.0C165.1 41.0 164.3 42.2 165.1 42.7C166.4 43.3 167.4 42.3 168.4 41.6C169.4 40.7 170.4 40.0 171.3 39.2C172.4 38.4 173.4 37.6 174.4 36.8C174.0 37.5 173.7 38.2 173.4 38.9C173.0 40.0 172.7 41.0 172.5 42.1C172.4 42.4 172.4 42.7 172.3 43.0C172.3 43.3 172.2 43.6 172.3 44.0C172.5 44.7 173.3 45.1 174.0 44.9C174.5 44.8 175 44.5 175.4 44.1C175.8 43.8 176.3 43.4 176.7 43.0C177.5 42.3 178.3 41.5 179.1 40.8C179.1 40.7 179.2 40.7 179.3 40.6L179.3 40.6Z",
      "M199.9 30.5L199.6 30.7C199.6 30.7 199.6 30.7 199.5 30.8C199.5 30.8 199.5 30.8 199.5 30.8C199.5 30.8 199.5 30.8 199.5 30.8L199.2 31.0C199.2 31.0 199.2 31.0 199.2 31.0C199.2 31.0 199.1 31.0 199 31.1C198.7 31.3 198.5 31.4 198.2 31.6C198.2 31.6 198.2 31.6 198.1 31.6L198.1 31.6C197.6 32.0 197.1 32.3 196.6 32.6C195.5 33.2 194.5 33.9 193.4 34.6C191.3 35.9 189.2 37.2 187.1 38.5C186.6 38.8 186.0 39.1 185.5 39.5C185.0 39.8 184.5 40.1 184 40.4C183.9 40.4 183.9 40.4 183.9 40.4C183.9 40.4 183.9 40.4 183.8 40.4C183.7 40.0 183.9 39.2 184.1 38.7C184.2 38.5 184.2 38.3 184.4 38.2C184.4 38.0 184.5 37.9 184.5 37.8C185.2 37.7 186.0 37.1 186.7 36.7C187 36.5 187.2 36.4 187.5 36.1C188.2 35.6 188.9 35.1 189.5 34.4C189.8 34.1 190.1 33.8 190.2 33.4C190.2 33.4 190.2 33.4 190.2 33.4C190.2 33.4 190.2 33.4 190.2 33.4C190.4 33.1 190.9 32.0 190.4 31.1C189.6 29.8 188.0 30.5 188.0 30.5C187.9 30.6 187.7 30.7 187.7 30.8C186.8 31.5 185.9 32.5 185.3 33.4C185.1 33.5 185.1 33.6 185.0 33.7C184.7 34.1 184.3 34.6 184 35.1C184 35.2 183.9 35.2 183.9 35.2L183.9 35.2C183.6 35.8 183.3 36.3 183.0 36.8C182.6 37.8 182.0 38.9 182.0 40.0C182.0 40.9 182.4 42 183.4 42.2C184 42.3 184.5 42.1 185.1 41.8C185.7 41.5 186.3 41.0 186.9 40.7C188.7 39.5 190.5 38.5 192.2 37.4L192.2 37.4C193.6 36.5 198.5 33.2 200.0 32.2C200.6 31.8 199.9 30.5 199.9 30.5ZM189.0 32.1C189.0 32.1 188.1 33.7 186.3 34.9C186.3 34.9 187.2 33.4 189.0 32.1Z",
      "M213.6 31.4C213.9 30.8 213.3 30.5 213.3 30.5L213.3 30.5C212.9 31.0 212.4 31.6 211.9 32.0C211.4 32.5 210.6 32.9 209.9 33.3C209.5 33.5 209.3 33.6 208.8 33.8C208.7 33.8 208.5 33.8 208.3 33.9C208.4 33.5 208.4 33.1 208.4 32.7C208.4 32.6 208.2 31.1 207.5 30.3C207.3 30.1 206.8 29.8 206.1 29.9C205.3 30.2 205 31.0 204.9 31.3C204.9 31.6 204.8 31.9 204.8 32.2C204.6 33.4 204.9 34.7 206.0 35.3C205.4 36.5 204.6 37.7 203.7 38.6C203.2 39.2 202.7 39.8 202.1 40.3C201.5 40.8 201.0 41.2 200.3 41.6C200.1 41.7 200.0 41.8 199.8 41.9C199.8 41.9 199.5 41.9 199.6 41.9C199.6 41.9 199.6 41.9 199.5 41.9C199.5 41.9 199.5 41.9 199.5 41.9C199.5 41.9 199.5 41.9 199.5 41.8C199.5 41.8 199.5 41.8 199.6 41.8C199.6 41.7 199.6 41.6 199.6 41.5C199.7 41.4 199.7 41.3 199.8 41.1C199.9 40.7 200.1 40.3 200.3 40.0C200.7 39 201.2 38.1 201.7 37.3C202.2 36.4 202.7 35.4 202.8 34.3C202.9 33.6 202.1 33.2 201.5 33.5C200.4 34.2 199.3 35.1 198.3 36C199.4 34.4 200.4 32.8 201.6 31.3C201.8 30.9 201.7 30.4 201.3 30.1C201.0 29.9 200.5 29.9 200.2 30.2C200.0 30.5 199.8 30.7 199.6 30.9C199.5 31.1 199.4 31.3 199.4 31.4C198.3 32.9 197.3 34.4 196.3 35.9C195.8 36.8 195.2 37.7 194.6 38.6C194.0 39.5 193.4 40.4 193.2 41.5C193.1 41.8 193.2 42.2 193.5 42.4C193.7 42.6 194.1 42.7 194.4 42.5C196 41.4 197.1 39.8 198.4 38.5C198.8 38.0 199.3 37.5 199.8 37.0C199.3 37.9 198.9 38.6 198.5 39.5C198.2 40.3 197.7 41.3 197.8 42.2C197.9 42.7 198.2 43.3 198.6 43.5C199.1 43.8 199.7 43.7 200.3 43.6C201.2 43.3 202 42.6 202.7 42C203.4 41.5 204.1 40.9 204.7 40.1C205.9 38.9 206.9 37.4 207.6 35.8C211.5 35.3 213.6 31.4 213.6 31.4ZM206.7 33C206.7 33.1 206.7 33.2 206.6 33.3C206.6 33.3 206.6 33.4 206.6 33.4C206.6 33.4 206.6 33.4 206.6 33.4C206.6 33.4 206.6 33.3 206.6 33.3C206.6 33.2 206.6 33.1 206.6 33.1C206.5 33 206.5 32.9 206.5 32.8C206.5 32.6 206.5 32.5 206.5 32.4C206.5 32.3 206.6 32.3 206.6 32.3C206.6 32.3 206.6 32.2 206.6 32.2C206.6 32.2 206.6 32.3 206.6 32.3C206.6 32.4 206.6 32.5 206.7 32.6C206.7 32.6 206.7 32.6 206.7 32.6C206.7 32.6 206.7 32.7 206.7 32.7C206.7 32.8 206.7 32.9 206.7 33Z"
    ];
    const GLYPH_STARTS = [
      [87, 4], [90, 14], [101, 31], [157, 5], [156, 38],
      [182, 19], [179, 41], [200, 31], [214, 31]
    ];

    const streamlineCanvas = document.getElementById("streamlines");
    const sctx = streamlineCanvas ? streamlineCanvas.getContext("2d") : null;
    const wordmarkSvg = document.getElementById("wordmarkSvg");
    const glyphStrokes = [];
    const glyphFills = [];
    const strokeLengths = [];

    if (wordmarkSvg && GLYPH_PATHS) {
      wordmarkSvg.innerHTML = "";
      GLYPH_PATHS.forEach((d) => {
        const sPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        sPath.setAttribute("d", d);
        sPath.setAttribute("class", "glyph-stroke");
        sPath.setAttribute("fill", "none");
        wordmarkSvg.appendChild(sPath);
        glyphStrokes.push(sPath);

        const fPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        fPath.setAttribute("d", d);
        fPath.setAttribute("class", "glyph-fill");
        fPath.setAttribute("opacity", "0");
        wordmarkSvg.appendChild(fPath);
        glyphFills.push(fPath);

        const len = sPath.getTotalLength ? sPath.getTotalLength() : 100;
        strokeLengths.push(len);
        sPath.style.strokeDasharray = `${len} ${len}`;
        sPath.style.strokeDashoffset = String(len);
      });
    }

    /* Edge sources: 36 edge points disintegrating from 4 top-to-bottom */
    const NL = 36;
    const EDGE = (() => {
      const outer = [
        [54, 0], [80, 0], [80, 22], [96, 22], [96, 42],
        [80, 42], [80, 100], [54, 100], [0, 42], [0, 22], [54, 22]
      ];
      const pts = outer.map((q) => [(q[0] - 48) * 0.04, (q[1] - 50) * 0.04]);
      const F = (H0 / 2) * 1.08;
      const out = [];
      let lastX = 0;
      for (let j = 0; j < NL; j++) {
        const y = 2.0 - ((j + 0.5) / NL) * 4.0;
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] - y) * (b[1] - y) < 0) {
            xs.push(lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1])));
          }
        }
        xs.sort((m, n) => m - n);
        const x = xs.length ? xs[j % xs.length] : lastX;
        lastX = x;
        out.push({ v: new THREE.Vector3(x, y, 0.4), fr: clamp01((F - y) / (2 * F)) });
      }
      return out;
    })();

    const EDGE_DST = (() => {
      const out = [];
      for (let j = 0; j < NL; j++) {
        const g = Math.min(8, Math.floor(j / 4));
        let pt = { x: GLYPH_STARTS[g][0], y: GLYPH_STARTS[g][1] };
        try {
          if (glyphStrokes[g]?.getPointAtLength) {
            const q = glyphStrokes[g].getPointAtLength((strokeLengths[g] || 100) * (((j % 4) + 0.5) / 4));
            pt = { x: q.x, y: q.y };
          }
        } catch (_) {}
        out.push(pt);
      }
      return out;
    })();

    function bezierPoint(p0, p1, p2, p3, t) {
      const u = 1 - t;
      const tt = t * t, uu = u * u;
      const uuu = uu * u, ttt = tt * t;
      return {
        x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
      };
    }

    const _tempV = new THREE.Vector3();

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();

      if (streamlineCanvas && sctx) {
        streamlineCanvas.width = innerWidth * dpr;
        streamlineCanvas.height = innerHeight * dpr;
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    addEventListener("resize", resize, { passive: true });
    resize();

    let lastFrame = performance.now();
    let isVisible = true;

    document.addEventListener("visibilitychange", () => {
      isVisible = document.visibilityState === "visible";
      if (isVisible) {
        lastFrame = performance.now();
        requestAnimationFrame(frame);
      }
    });

    function frame(now) {
      if (!isVisible) return;
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      const t = now / 1000;
      const curVw = innerWidth, curVh = innerHeight;

      if ((fx.kick || 0) !== lastKick) {
        lastKick = fx.kick;
        spinTarget += Math.PI * 2;
      }

      const dockE = fx.dockE || 0;
      const broke = root.classList.contains("break");

      const upp = (2 * CAM_Z * Math.tan(rad(FOV / 2))) / curVh;
      const worldH = fx.s * upp;
      const sc = worldH / H0;

      // 1. Placement and tilt
      mesh.position.set((fx.x - curVw / 2) * upp, (curVh / 2 - fx.y) * upp, 0);

      let tx, ty;
      if (gyroOn) {
        tx = gyro.x;
        ty = gyro.y;
      } else {
        const cx = (ptr.x / curVw - 0.5) * 2;
        const cy = (ptr.y / curVh - 0.5) * 2;
        const lx = clamp((ptr.x - fx.x) / (curVw * 0.45), -1, 1);
        const ly = clamp((ptr.y - fx.y) / (curVh * 0.45), -1, 1);
        tx = lerp(cx, lx, dockE);
        ty = lerp(cy, ly, dockE);
      }

      const amp = 1 + fx.hover * 0.7 * dockE;
      const tk = 1 - Math.exp(-dt * 5);
      tilt.x += (tx * amp - tilt.x) * tk;
      tilt.y += (ty * amp - tilt.y) * tk;
      spin += (spinTarget - spin) * (1 - Math.exp(-dt * 4.5));

      const float = reduce ? 0 : Math.sin(t * 0.9) * 0.04;
      const dockBoost = 1 + dockE * 0.6;
      mesh.rotation.x = tilt.y * 0.26 * dockBoost + float;
      const baseRotY = rad(-14) * (1 - dockE) + tilt.x * 0.42 * dockBoost + spin;
      mesh.rotation.y = lerp(baseRotY, 0, clamp01(dockE / 0.35));
      mesh.rotation.z = 0;

      // 2. Top-to-bottom dissolve
      const A0 = 0.02, A1 = 0.28, B0 = 0.07, B1 = 0.38;
      const aT = clamp01((dockE - A0) / (A1 - A0));
      const bT = clamp01((dockE - B0) / (B1 - B0));
      const F = (H0 / 2) * 1.08 * sc;
      const cC = mesh.position.y + lerp(F, -F, aT);
      const cL = mesh.position.y + lerp(F, -F, bT);
      const soft = worldH * 0.02;

      planeSolid.constant = cC;
      mesh.visible = !broke && aT < 1;
      material.opacity = 1;

      wirePlaneLow.constant = broke ? 9999 : soft - cC;
      wirePlaneHigh.constant = cL;
      wire.visible = bT < 1 && (broke || aT > 0);
      wireMat.color.setHex(broke ? 0x141312 : 0xedece8);
      wireMat.opacity = broke ? 0.9 : 0.95;

      mesh.scale.setScalar(sc);
      wire.scale.copy(mesh.scale);
      wire.position.copy(mesh.position);
      wire.rotation.copy(mesh.rotation);
      mesh.updateMatrixWorld();

      // Floor reflection
      const ro = 0.28 * Math.pow(1 - clamp01(dockE / 0.16), 2);
      refl.visible = !broke && ro > 0.008;
      if (refl.visible) {
        const floorY = mesh.position.y - worldH * 0.5 - worldH * 0.02;
        floorU.value = floorY;
        fadeU.value = worldH * 0.55;
        refl.position.set(mesh.position.x, 2 * floorY - mesh.position.y, 0);
        refl.scale.set(sc, -sc, sc);
        refl.rotation.set(-mesh.rotation.x, mesh.rotation.y, -mesh.rotation.z);
        reflMat.opacity = ro;
      }

      // Dynamic light tracking
      if (!reduce) {
        lightA.position.set(Math.cos(t * 0.6) * 6 + tilt.x * 4, Math.sin(t * 0.5) * 4 - tilt.y * 3, 8);
        lightB.position.set(Math.cos(t * 0.4 + 2) * -6, Math.sin(t * 0.7 + 1) * 3, 7);
      } else {
        lightA.position.set(tilt.x * 4 + 4, -tilt.y * 3 + 3, 8);
      }
      lightA.intensity = 1.6 * clamp01(1 - dockE / 0.3);

      // 3. Kinetic Streamlines and SVG Wordmark Drawing
      if (sctx) {
        sctx.clearRect(0, 0, curVw, curVh);

        if (wordmarkSvg && dockE > 0.06 && dockE < 0.98) {
          const r = wordmarkSvg.getBoundingClientRect();
          const svgScale = r.width / 220;
          const renderedH = 64 * svgScale;
          const offsetY = r.top + (r.height - renderedH) / 2;
          const glyphArrive = new Array(9).fill(1);

          for (let j = 0; j < NL; j++) {
            const g = Math.min(8, Math.floor(j / 4));
            const launchE = B0 + EDGE[j].fr * (B1 - B0) - 0.015;
            const arriveE = launchE + 0.26;
            glyphArrive[g] = Math.min(glyphArrive[g], arriveE);
            if (dockE < launchE) continue;

            _tempV.copy(EDGE[j].v).applyMatrix4(mesh.matrixWorld).project(camera);
            const srcX = (_tempV.x * 0.5 + 0.5) * curVw;
            const srcY = (-_tempV.y * 0.5 + 0.5) * curVh;
            const dstX = r.left + EDGE_DST[j].x * svgScale;
            const dstY = offsetY + EDGE_DST[j].y * svgScale;

            const tHead = easeInOut(clamp01((dockE - launchE) / (arriveE - launchE)));
            const tTail = easeInOut(clamp01((dockE - launchE - 0.07) / (arriveE - launchE + 0.03)));
            if (tHead <= tTail + 0.002) continue;

            const dx = dstX - srcX;
            const sw = j % 2 ? 1 : -1;
            const P0 = { x: srcX, y: srcY };
            const P1 = { x: srcX + dx * 0.22 + sw * (22 + (j % 5) * 6), y: srcY - (40 + (j % 4) * 18) };
            const P2 = { x: dstX - dx * 0.18, y: dstY + (12 + (j % 3) * 9) };
            const P3 = { x: dstX, y: dstY };

            sctx.beginPath();
            for (let k = 0; k <= 18; k++) {
              const u = tTail + (tHead - tTail) * (k / 18);
              const pt = bezierPoint(P0, P1, P2, P3, u);
              if (k === 0) sctx.moveTo(pt.x, pt.y);
              else sctx.lineTo(pt.x, pt.y);
            }
            const al = clamp01((dockE - launchE) / 0.03) * (1 - clamp01((tTail - 0.85) / 0.15));
            sctx.strokeStyle = broke
              ? `rgba(184, 58, 34, ${(0.9 * al).toFixed(3)})`
              : `rgba(237, 236, 232, ${(0.95 * al).toFixed(3)})`;
            sctx.lineWidth = lerp(1.8, 1.0, tHead);
            sctx.shadowColor = broke ? "rgba(184, 58, 34, 0.7)" : "rgba(255, 255, 255, 0.8)";
            sctx.shadowBlur = broke ? 4 : 8;
            sctx.stroke();

            if (tHead < 0.98 && tHead > 0.03) {
              const hp = bezierPoint(P0, P1, P2, P3, tHead);
              sctx.beginPath();
              sctx.arc(hp.x, hp.y, broke ? 1.7 : 2.3, 0, Math.PI * 2);
              sctx.fillStyle = broke ? "#b83a22" : "#ffffff";
              sctx.shadowBlur = broke ? 6 : 12;
              sctx.fill();
            }
          }
          sctx.shadowBlur = 0;

          // Animate glyph stroke-dashoffset & opacity
          for (let i = 0; i < 9; i++) {
            const letterDrawE = clamp01((dockE - (glyphArrive[i] - 0.05)) / 0.26);
            const sPath = glyphStrokes[i], fPath = glyphFills[i], len = strokeLengths[i];
            if (sPath) {
              sPath.style.strokeDashoffset = (len * (1 - easeInOut(letterDrawE))).toFixed(1);
              sPath.style.opacity = letterDrawE > 0 ? (1 - clamp01((dockE - 0.78) / 0.16)).toFixed(3) : "0";
            }
            if (fPath) {
              fPath.style.opacity = clamp01((dockE - 0.72) / 0.2).toFixed(3);
            }
          }
        } else {
          if (dockE <= 0.06) {
            for (let i = 0; i < 9; i++) {
              if (glyphStrokes[i]) {
                glyphStrokes[i].style.strokeDashoffset = strokeLengths[i].toFixed(1);
                glyphStrokes[i].style.opacity = "0";
              }
              if (glyphFills[i]) glyphFills[i].style.opacity = "0";
            }
          }
          if (dockE >= 0.98) {
            for (let i = 0; i < 9; i++) {
              if (glyphStrokes[i]) {
                glyphStrokes[i].style.strokeDashoffset = "0";
                glyphStrokes[i].style.opacity = "0";
              }
              if (glyphFills[i]) glyphFills[i].style.opacity = "1";
            }
          }
        }
      }

      // Cursor raycasting for hover pointer on 3D "4"
      if ((mesh.visible || wire.visible) && dockE < 0.28) {
        ndc.set((ptr.x / curVw) * 2 - 1, -(ptr.y / curVh) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        hovering = (mesh.visible && ray.intersectObject(mesh, false).length > 0) ||
                   (wire.visible && ray.intersectObject(wire, false).length > 0);
        document.body.style.cursor = hovering ? "pointer" : "";
      } else if (hovering) {
        hovering = false;
        document.body.style.cursor = "";
      }

      // Optimize: Only render WebGL when 3D geometry is in view
      if (mesh.visible || wire.visible || refl.visible) {
        renderer.render(scene, camera);
      } else {
        renderer.clear();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();
})();
