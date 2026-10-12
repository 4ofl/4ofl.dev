(() => {
  "use strict";

  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const themeMeta = $('meta[name="theme-color"]');
  const STORAGE_KEY = "4ofl-theme";
  const EMAIL = "aby@4ofl.dev";

  /* ------------------------------------------------------------------ *
   * Theme (with circular View Transition reveal)
   * ------------------------------------------------------------------ */
  const currentTheme = () => (root.dataset.theme === "dark" ? "dark" : "light");

  const setTheme = (theme, persist = true) => {
    root.dataset.theme = theme;
    themeMeta?.setAttribute("content", theme === "dark" ? "#0f0f0e" : "#efede7");

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (_) {}
    }

    document.dispatchEvent(new CustomEvent("themechange"));
  };

  const toggleTheme = (origin) => {
    const next = currentTheme() === "dark" ? "light" : "dark";

    if (!document.startViewTransition || reduced.matches) {
      setTheme(next);
      return;
    }

    const button = $("#theme-toggle");
    let x = innerWidth / 2;
    let y = 0;

    if (origin) {
      x = origin.x;
      y = origin.y;
    } else if (button) {
      const rect = button.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    const radius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    );

    root.classList.add("theme-switching");
    const transition = document.startViewTransition(() => setTheme(next));

    transition.ready
      .then(() =>
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 650,
            easing: "cubic-bezier(.16, 1, .3, 1)",
            pseudoElement: "::view-transition-new(root)"
          }
        )
      )
      .catch(() => {});

    transition.finished.finally(() => root.classList.remove("theme-switching"));
  };

  (() => {
    let initial = "light";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      initial =
        saved === "dark" || saved === "light"
          ? saved
          : matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    } catch (_) {}
    setTheme(initial, false);
  })();

  $("#theme-toggle")?.addEventListener("click", (event) => {
    toggleTheme(event.detail === 0 ? null : { x: event.clientX, y: event.clientY });
  });

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_) {}
      area.remove();
      return ok;
    }
  };

  /* ------------------------------------------------------------------ *
   * Smooth anchor scrolling
   * ------------------------------------------------------------------ */
  (() => {
    const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);

    const scrollToTarget = (target) => {
      const start = scrollY;
      const targetY =
        target === root ? 0 : target.getBoundingClientRect().top + scrollY - 24;
      const distance = targetY - start;

      if (reduced.matches || Math.abs(distance) < 2) {
        scrollTo(0, targetY);
        return;
      }

      const duration = Math.min(850, Math.max(440, Math.abs(distance) * 0.42));
      const startedAt = performance.now();

      const step = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        scrollTo(0, start + distance * easeOutQuart(progress));
        if (progress < 1) requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    };

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const selector = link.getAttribute("href");
        const target = selector === "#top" ? root : document.querySelector(selector);
        if (!target) return;
        event.preventDefault();
        scrollToTarget(target);
      });
    });
  })();

  /* ------------------------------------------------------------------ *
   * Scroll-to-top button
   * ------------------------------------------------------------------ */
  (() => {
    const button = $("#scroll-top-btn");
    if (!button) return;
    addEventListener(
      "scroll",
      () => button.classList.toggle("visible", scrollY > 300),
      { passive: true }
    );
  })();

  /* ------------------------------------------------------------------ *
   * Clock (Kerala, IST)
   * ------------------------------------------------------------------ */
  (() => {
    const clock = $("#clock");
    if (!clock) return;
    const format = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const tick = () => {
      clock.textContent = `Kerala · ${format.format(new Date())} IST`;
    };
    tick();
    setInterval(tick, 15000);
  })();

  /* ------------------------------------------------------------------ *
   * Copy email
   * ------------------------------------------------------------------ */
  (() => {
    const button = $("#copy-email");
    if (!button) return;
    let timer;
    button.addEventListener("click", async () => {
      const ok = await copyText(EMAIL);
      button.textContent = ok ? "copied ✓" : "press ⌘/ctrl+c";
      clearTimeout(timer);
      timer = setTimeout(() => (button.textContent = "copy"), 1800);
    });
  })();

  /* ------------------------------------------------------------------ *
   * "Recently" — latest public push on GitHub (hidden if unavailable)
   * ------------------------------------------------------------------ */
  (() => {
    const slot = $("#recent");
    if (!slot) return;

    const ago = (iso) => {
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
      if (s < 86400) return `${Math.round(s / 3600)}h ago`;
      return `${Math.round(s / 86400)}d ago`;
    };

    const render = ({ repo, at }) => {
      const link = document.createElement("a");
      link.href = `https://github.com/${repo}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = repo.split("/")[1] || repo;
      slot.replaceChildren("Last push: ", link, ` · ${ago(at)}`);
      slot.hidden = false;
    };

    const CACHE = "4ofl-recent";
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE) || "null");
      if (cached && Date.now() - cached.t < 30 * 60 * 1000) {
        render(cached);
        return;
      }
    } catch (_) {}

    fetch("https://api.github.com/users/4ofl/events/public?per_page=30", {
      headers: { Accept: "application/vnd.github+json" }
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((events) => {
        const push = events.find((e) => e.type === "PushEvent");
        if (!push) return;
        const data = { repo: push.repo.name, at: push.created_at, t: Date.now() };
        try {
          sessionStorage.setItem(CACHE, JSON.stringify(data));
        } catch (_) {}
        render(data);
      })
      .catch(() => {});
  })();

  /* ------------------------------------------------------------------ *
   * Terminal (press ` or tap >_ in the footer)
   * ------------------------------------------------------------------ */
  const terminal = (() => {
    const PROJECTS = {
      citecamp: "https://citecamp.4ofl.dev",
      june: "https://june.4ofl.dev",
      johnsfitness: "https://github.com/4ofl/johnsfitness-edge"
    };

    let el, out, input, lastFocus;
    const history = [];
    let historyIndex = 0;

    const print = (text, cls) => {
      const line = document.createElement("div");
      line.textContent = text;
      if (cls) line.className = cls;
      out.appendChild(line);
      out.scrollTop = out.scrollHeight;
    };

    const build = () => {
      el = document.createElement("div");
      el.className = "term";
      el.hidden = true;
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", "Terminal");
      el.innerHTML =
        '<div class="term-box">' +
        '<div class="term-bar"><span>aby@4ofl.dev ~</span>' +
        '<button type="button" class="term-x" aria-label="Close terminal">esc</button></div>' +
        '<div class="term-out" aria-live="polite"></div>' +
        '<label class="term-line"><span class="term-ps" aria-hidden="true">$</span>' +
        '<input class="term-in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command"></label>' +
        "</div>";
      document.body.appendChild(el);
      out = $(".term-out", el);
      input = $(".term-in", el);

      el.addEventListener("pointerdown", (e) => {
        if (e.target === el) close();
      });
      $(".term-x", el).addEventListener("click", close);

      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "`") {
          e.preventDefault();
          close();
        } else if (e.key === "Enter") {
          const value = input.value;
          input.value = "";
          run(value);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          historyIndex = Math.max(0, historyIndex - 1);
          input.value = history[historyIndex] || "";
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          historyIndex = Math.min(history.length, historyIndex + 1);
          input.value = history[historyIndex] || "";
        }
      });

      print("4ofl.dev terminal. type help.");
    };

    const run = (raw) => {
      const line = raw.trim();
      if (!line) return;
      print(`$ ${line}`, "cmd");
      history.push(line);
      historyIndex = history.length;

      const [name, ...args] = line.split(/\s+/);
      const cmd = name.toLowerCase();

      switch (cmd) {
        case "help":
          print(
            [
              "whoami      who is this",
              "projects    what i'm building",
              "open <name> citecamp | june | johnsfitness",
              "theme       toggle (or: theme dark | light)",
              "email       copy my email",
              "github      open my github",
              "clear       clear the screen",
              "exit        close (or press esc)"
            ].join("\n")
          );
          break;
        case "whoami":
          print("aby mathew\nsoftware + infrastructure, kerala, india.\nbuilding things 'n breaking others.");
          break;
        case "projects":
        case "ls":
          print("citecamp/   june/   johns-fitness/");
          break;
        case "open": {
          const key = args.join("").toLowerCase().replace(/[^a-z]/g, "");
          const url = PROJECTS[key];
          if (!url) {
            print(`open: no such project: ${args.join(" ") || "(none)"}`, "err");
            break;
          }
          print(`opening ${url}`);
          window.open(url, "_blank", "noopener");
          break;
        }
        case "theme": {
          const want = args[0];
          const next =
            want === "dark" || want === "light"
              ? want
              : currentTheme() === "dark"
                ? "light"
                : "dark";
          if (next !== currentTheme()) toggleTheme();
          print(`theme: ${next}`);
          break;
        }
        case "email":
          copyText(EMAIL).then((ok) => print(ok ? `copied ${EMAIL}` : EMAIL));
          break;
        case "github":
          print("opening github.com/4ofl");
          window.open("https://github.com/4ofl", "_blank", "noopener");
          break;
        case "clear":
          out.textContent = "";
          break;
        case "exit":
        case "quit":
          close();
          break;
        case "sudo":
          print("aby is not in the sudoers file. this incident will be reported.", "err");
          break;
        case "rm":
          print("nice try.", "err");
          break;
        default:
          print(`command not found: ${cmd}. try help`, "err");
      }
    };

    const isOpen = () => !!el && !el.hidden;

    const open = () => {
      if (!el) build();
      lastFocus = document.activeElement;
      el.hidden = false;
      input.focus();
    };

    function close() {
      if (!el) return;
      el.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    const toggle = () => (isOpen() ? close() : open());

    $("#term-open")?.addEventListener("click", open);

    return { open, close, toggle, isOpen };
  })();

  /* ------------------------------------------------------------------ *
   * Keyboard shortcuts: d = theme, ` = terminal
   * ------------------------------------------------------------------ */
  addEventListener("keydown", (event) => {
    const t = event.target;
    const typing =
      t instanceof HTMLElement &&
      (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

    if (typing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "`") {
      event.preventDefault();
      terminal.toggle();
    } else if (event.key.toLowerCase() === "d") {
      toggleTheme();
    }
  });

  console.log(
    "%c4ofl.dev%c  press ` for a terminal.",
    "font-weight:900;color:#2857ff",
    "color:inherit"
  );

  /* ------------------------------------------------------------------ *
   * Fine-pointer effects: cursor, hero "4" parallax, project preview
   * ------------------------------------------------------------------ */
  if (!finePointer.matches || reduced.matches) return;

  const pointer = {
    x: innerWidth / 2,
    y: innerHeight / 2,
    lastMove: performance.now(),
    mode: "default"
  };

  const modeFor = (el) => {
    if (!(el instanceof Element)) return "default";
    if (el.closest(".term")) return "hidden";
    if (el.closest(".project")) return "project";
    if (el.closest("a, button, input, [role='button']")) return "link";
    if (el.closest("p, h1, h2, h3, .about-meta, .current")) return "text";
    return "default";
  };

  addEventListener(
    "pointermove",
    (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.lastMove = performance.now();
      pointer.mode = modeFor(event.target);
    },
    { passive: true }
  );

  root.addEventListener("mouseleave", () => {
    pointer.mode = "hidden";
  });

  /* ---- cursor ---- */
  (() => {
    const canvas = $("#cursor-canvas");
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    let accent = "#2857ff";
    let ink = "#121212";
    let width = 0;
    let height = 0;
    let alpha = 1;
    let rings = [];
    let rafId = 0;

    const syncColors = () => {
      const styles = getComputedStyle(root);
      accent = styles.getPropertyValue("--accent").trim() || accent;
      ink = styles.getPropertyValue("--ink").trim() || ink;
    };
    syncColors();
    document.addEventListener("themechange", syncColors);

    const MARK = [[-8, -9], [-8, 0], [1, 0], [1, 10]];
    const CORNERS = [[-11, -11], [11, -11], [11, 11], [-11, 11]];
    const CARET = [[0, -10], [0, -3], [0, 3], [0, 10]];
    const ZERO = [0, 0];

    const particles = Array.from({ length: 4 }, (_, i) => ({
      x: pointer.x,
      y: pointer.y,
      vx: 0,
      vy: 0,
      lag: 0.17 - i * 0.025
    }));

    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      width = innerWidth;
      height = innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    addEventListener("resize", resize);

    addEventListener(
      "pointerdown",
      (event) => rings.push({ x: event.clientX, y: event.clientY, t: performance.now() }),
      { passive: true }
    );

    const drawMark = () => {
      const [a, b, c, d] = particles;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    };

    const drawBrackets = () => {
      particles.forEach((p, i) => {
        const ix = -Math.sign(CORNERS[i][0]);
        const iy = -Math.sign(CORNERS[i][1]);
        ctx.beginPath();
        ctx.moveTo(p.x + ix * 6, p.y);
        ctx.lineTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + iy * 6);
        ctx.stroke();
      });
    };

    const drawCaret = () => {
      ctx.beginPath();
      ctx.moveTo(particles[0].x, particles[0].y);
      ctx.lineTo(particles[3].x, particles[3].y);
      ctx.stroke();
    };

    const frame = (time) => {
      ctx.clearRect(0, 0, width, height);

      const mode = pointer.mode;
      const goal = mode === "project" || mode === "hidden" ? 0 : 1;
      alpha += (goal - alpha) * 0.2;

      const idle = time - pointer.lastMove > 520;
      const settle = Math.min(1, Math.max(0, (time - pointer.lastMove - 520) / 360));
      const offsets =
        mode === "link" ? CORNERS : mode === "text" ? CARET : idle ? MARK : null;

      particles.forEach((p, i) => {
        const o = offsets ? offsets[i] : ZERO;
        p.vx += (pointer.x + o[0] - p.x) * p.lag;
        p.vy += (pointer.y + o[1] - p.y) * p.lag;
        p.vx *= 0.72;
        p.vy *= 0.72;
        p.x += p.vx;
        p.y += p.vy;
      });

      if (alpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = alpha;

        particles.forEach((p, i) => {
          ctx.fillStyle = i === 0 ? accent : ink;
          ctx.fillRect(Math.round(p.x) - 1.5, Math.round(p.y) - 1.5, 3, 3);
        });

        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.35;
        ctx.lineCap = "square";

        if (mode === "link") {
          drawBrackets();
        } else if (mode === "text") {
          drawCaret();
        } else if (idle) {
          ctx.globalAlpha = alpha * settle * 0.85;
          drawMark();
        }

        ctx.restore();
      }

      rings = rings.filter((r) => time - r.t < 480);
      rings.forEach((r) => {
        const k = Math.max(0, (time - r.t) / 480);
        const e = 1 - Math.pow(1 - k, 3);
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.7;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 4 + e * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      rafId = requestAnimationFrame(frame);
    };

    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(rafId);
      if (document.visibilityState === "visible") {
        pointer.lastMove = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    });

    rafId = requestAnimationFrame(frame);
  })();

  /* ---- hero "4" parallax ---- */
  (() => {
    const hero = $(".hero");
    if (!hero) return;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let running = false;

    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      hero.style.setProperty("--px", cx.toFixed(2) + "px");
      hero.style.setProperty("--py", cy.toFixed(2) + "px");

      if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    };

    addEventListener(
      "pointermove",
      (event) => {
        tx = (event.clientX / innerWidth - 0.5) * -36;
        ty = (event.clientY / innerHeight - 0.5) * -24;
        if (!running) {
          running = true;
          requestAnimationFrame(loop);
        }
      },
      { passive: true }
    );
  })();

  /* ---- floating project preview ---- */
  (() => {
    const rows = document.querySelectorAll(".project");
    if (!rows.length) return;

    const card = document.createElement("div");
    card.className = "preview";
    card.setAttribute("aria-hidden", "true");
    card.innerHTML =
      '<div class="preview-shot"></div>' +
      '<div class="preview-body">' +
      '<div class="preview-top"><span class="preview-status"></span><span class="preview-host"></span></div>' +
      '<div class="preview-name"></div>' +
      '<div class="preview-tags"></div>' +
      "</div>";
    document.body.appendChild(card);

    const shot = $(".preview-shot", card);
    const status = $(".preview-status", card);
    const host = $(".preview-host", card);
    const name = $(".preview-name", card);
    const tags = $(".preview-tags", card);

    const fill = (row) => {
      name.textContent = $("h3", row)?.textContent.trim() || "";
      status.textContent = $(".project-status", row)?.textContent.trim() || "";
      const link = $("a.project-link", row);
      try {
        host.textContent = link ? new URL(link.href).host : "";
      } catch (_) {
        host.textContent = "";
      }

      tags.replaceChildren(
        ...(row.dataset.tags || "")
          .split(",")
          .filter(Boolean)
          .map((tag) => {
            const span = document.createElement("span");
            span.textContent = tag.trim();
            return span;
          })
      );

      // Optional: add data-shot="/shots/june.png" to a .project to show a screenshot.
      const src = row.dataset.shot;
      card.classList.toggle("has-shot", !!src);
      shot.style.backgroundImage = src ? `url(${JSON.stringify(src)})` : "";
    };

    let px = 0;
    let py = 0;
    let vx = 0;
    let vy = 0;
    let active = false;
    let rafId = 0;

    const target = () => {
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      let x = pointer.x + 28;
      let y = pointer.y + 22;
      if (x + w > innerWidth - 16) x = pointer.x - w - 28;
      if (y + h > innerHeight - 16) y = innerHeight - h - 16;
      return [Math.max(16, x), Math.max(16, y)];
    };

    const tick = () => {
      if (!active) return;
      const [tx, ty] = target();
      vx += (tx - px) * 0.14;
      vy += (ty - py) * 0.14;
      vx *= 0.74;
      vy *= 0.74;
      px += vx;
      py += vy;
      const tilt = Math.max(-5, Math.min(5, vx * 0.18));
      card.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
      rafId = requestAnimationFrame(tick);
    };

    rows.forEach((row) => {
      row.addEventListener("pointerenter", () => {
        fill(row);
        const [tx, ty] = target();
        if (!active) {
          px = tx;
          py = ty;
          vx = 0;
          vy = 0;
        }
        active = true;
        card.classList.add("on");
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
      });

      row.addEventListener("pointerleave", () => {
        active = false;
        card.classList.remove("on");
        cancelAnimationFrame(rafId);
      });
    });
  })();
})();
