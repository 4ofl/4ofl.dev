(() => {
  "use strict";

  const root = document.documentElement;
  const spot = document.getElementById("spot");
  const modeBtn = document.getElementById("modeBtn");
  const clock = document.getElementById("clock");
  const retryBtn = document.getElementById("retryBtn");
  const copyUrlBtn = document.getElementById("copyUrlBtn");
  const termPath = document.getElementById("termPath");
  const termTime = document.getElementById("termTime");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Set the current requested path in the diagnostic terminal
  if (termPath) {
    const p = window.location.pathname || "/unknown-route";
    termPath.textContent = p;
  }
  if (termTime) {
    termTime.textContent = new Date().toISOString();
  }

  // Dynamic spotlight tracking mouse
  let sx = innerWidth / 2, sy = innerHeight / 2;
  let cx = sx, cy = sy;
  addEventListener("pointermove", (e) => {
    sx = e.clientX;
    sy = e.clientY;
  }, { passive: true });

  function trackSpot() {
    cx += (sx - cx) * 0.08;
    cy += (sy - cy) * 0.08;
    if (spot) {
      spot.style.setProperty("--sx", `${cx.toFixed(1)}px`);
      spot.style.setProperty("--sy", `${cy.toFixed(1)}px`);
      spot.style.setProperty("--so", "0.85");
    }
    requestAnimationFrame(trackSpot);
  }
  requestAnimationFrame(trackSpot);

  // Build / Break mode toggle
  function setMode(on, x, y) {
    const apply = () => {
      root.classList.toggle("break", on);
      if (modeBtn) modeBtn.setAttribute("aria-pressed", on ? "true" : "false");
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", on ? "#eae6df" : "#08080a");
    };

    if (reduce || !document.startViewTransition) {
      apply();
      return;
    }

    const ox = x ?? innerWidth / 2;
    const oy = y ?? innerHeight / 2;
    const r = Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy));

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

  // Keyboard navigation: [B] = toggle mode, [Esc] or [H] = home
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/input|textarea/i.test(document.activeElement?.tagName || "")) return;

    if (e.key === "b" || e.key === "B") {
      if (modeBtn) modeBtn.click();
    } else if (e.key === "Escape" || e.key === "h" || e.key === "H") {
      location.href = "/";
    }
  });

  // Action buttons
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      retryBtn.textContent = "re-querying…";
      setTimeout(() => {
        retryBtn.textContent = "route unavailable";
        setTimeout(() => (retryBtn.textContent = "retry route"), 1800);
      }, 600);
    });
  }

  if (copyUrlBtn) {
    copyUrlBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        copyUrlBtn.textContent = "copied";
      } catch {
        copyUrlBtn.textContent = "press ⌘/ctrl+c";
      }
      setTimeout(() => (copyUrlBtn.textContent = "copy path"), 1800);
    });
  }

  // Clock
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

  // Tooltip Engine for 404
  (() => {
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
      const r = target.getBoundingClientRect();
      const tr = el.getBoundingClientRect();
      const pad = 8;
      let top = r.top - tr.height - pad;
      let left = r.left + (r.width - tr.width) / 2;
      if (top < pad) top = r.bottom + pad;
      if (left < pad) left = pad;
      if (left + tr.width > innerWidth - pad) left = innerWidth - tr.width - pad;
      el.style.left = `${left.toFixed(1)}px`;
      el.style.top = `${top.toFixed(1)}px`;
      el.classList.add("visible");
    };

    const hide = () => {
      activeTarget = null;
      el.classList.remove("visible");
    };

    document.querySelectorAll("[title]").forEach((item) => {
      const titleText = item.getAttribute("title");
      if (titleText) {
        item.dataset.tooltip = titleText;
        item.removeAttribute("title");
      }
    });

    document.addEventListener("pointerover", (e) => {
      const target = e.target.closest("[data-tooltip]");
      if (!target) return;
      show(target, target.dataset.tooltip, target.dataset.tooltipKbd || "");
    }, { passive: true });

    document.addEventListener("pointerout", (e) => {
      const target = e.target.closest("[data-tooltip]");
      if (target && target === activeTarget) hide();
    }, { passive: true });
  })();
})();
