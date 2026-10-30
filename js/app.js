(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const F = window.F;
  const reduce = F.reduce;
  const root = document.documentElement;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  let mx = -999,
    my = -999,
    lastMx = -999,
    lastMy = -999,
    curVx = 0,
    curVy = 0,
    lastMoveT = 0;
  const ripples = [];

  /* =========================================================
     hero name: letters swell toward the pointer, idle wave otherwise
     ========================================================= */
  const hero = $(".hero");
  const heroIn = $(".hero-in");
  const name = $("#name");
  name.innerHTML = [...("aby mathew")]
    .map((c) => (c === " " ? "<br>" : `<span>${c}</span>`))
    .join("");
  const L = $$("#name span");
  let centers = [];
  let heroP = 0;
  function cacheLetters() {
    const prev = heroIn.style.getPropertyValue("--p");
    heroIn.style.setProperty("--p", 0); // measure untransformed
    const sy = scrollY;
    centers = L.map((s) => {
      const r = s.getBoundingClientRect();
      return { el: s, cx: r.left + r.width / 2, cy: r.top + sy + r.height / 2 };
    });
    heroIn.style.setProperty("--p", prev || heroP);
  }

  /* =========================================================
     Memory Buffer / Hex Dump Grid = canvas background
     Memory registers, hex offsets, real commit buffer, read-head physics
     ========================================================= */
  const cv = $("#bg"),
    g = cv.getContext("2d");
  let W, H, D;
  let dots = [],
    nCols = 0,
    nRows = 0,
    gapX = 36,
    gapY = 32,
    startX = 0,
    startY = 0;
  let spacingMultiplier = 1.0;
  let isThrottleTier1 = false;
  let isStaticFallback = false;
  let gridDirty = true;
  let commits = null,
    commStart = 0,
    commMeta = null;

  try {
    const raw = localStorage.getItem("c:commits");
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && cached.data && cached.data.weeks) {
        commits = cached.data;
        commits.cached = true;
      }
    }
  } catch {}
  if (commits && !root.classList.contains("intro")) {
    commStart = performance.now();
  }

  const SEED_BYTES = [
    "00", "00", "..", "00", "4F", "0B", "0D", "..",
    "00", "FF", "C0", "00", "2A", "10", "..", "00",
    "7E", "01", "8C", "00", "ED", "EC", "E8", "..",
    "00", "5A", "..", "3E", "00", "B4", "02", "00",
  ];

  function initGrid() {
    dots = [];
    gapX = (innerWidth > 768 ? 36 : 32) * D * spacingMultiplier;
    gapY = (innerWidth > 768 ? 32 : 28) * D * spacingMultiplier;
    startX = (W % gapX) / 2 || gapX / 2;
    startY = (H % gapY) / 2 || gapY / 2;
    nCols = 0;
    nRows = 0;
    for (let y = startY; y < H; y += gapY) {
      nRows++;
      nCols = 0;
      for (let x = startX; x < W; x += gapX) {
        nCols++;
        const row = nRows - 1;
        const col = nCols - 1;
        const val = SEED_BYTES[((row * 13 + col * 7) ^ (row * 3)) % SEED_BYTES.length];
        const addrNum = (row * 32 + col) * 4;
        const addr = "0x" + addrNum.toString(16).toUpperCase().padStart(4, "0");
        dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0, val, addr, cm: null, row, col });
      }
    }
    mapCommits();
  }
  const size = () => {
    D = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * D;
    H = cv.height = innerHeight * D;
    initGrid();
    gridDirty = true;
  };
  size();

  /* commit data: mapped as an allocated memory buffer in top-right */
  function mapCommits() {
    commMeta = null;
    for (const d of dots) d.cm = null;
    if (!commits || !commits.weeks || !nCols || !nRows) return;
    const padPx = parseFloat(getComputedStyle(hero).paddingLeft) || 20;
    const maxCols = Math.max(4, Math.min(30, Math.floor((innerWidth - 2 * padPx) / 36)));
    const weeks = commits.weeks.slice(-maxCols);
    const cols = weeks.length;
    const cR = Math.min(nCols - 1, Math.floor((W - padPx * D - startX) / gapX));
    const c0 = Math.max(0, cR - cols + 1);
    const visibleCols = Math.min(cols, cR - c0 + 1);
    const visibleWeeks = weeks.slice(-visibleCols);
    const r0 = Math.max(0, Math.min(Math.max(0, nRows - 7), Math.ceil((96 * D - startY) / gapY)));
    if (visibleCols <= 0 || r0 >= nRows) return;

    visibleWeeks.forEach((wk, i) => {
      for (const [date, count, wd] of wk) {
        if (wd >= 7 || r0 + wd >= nRows) continue;
        const d = dots[(r0 + wd) * nCols + (c0 + i)];
        if (d) {
          const hexVal = !count ? ".." : count < 16 ? "0" + count.toString(16).toUpperCase() : count.toString(16).toUpperCase();
          d.cm = {
            date,
            count: count || 0,
            hexVal,
            col: i,
            row: wd,
            t: i * 20 + wd * 6,
            level: !count ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4,
          };
        }
      }
    });
    const total = commits.total || visibleWeeks.reduce((a, wk) => a + wk.reduce((b, x) => b + x[1], 0), 0);
    commMeta = {
      cols: visibleCols,
      total,
      c0,
      cR,
      r0,
      capX: startX + (c0 + visibleCols - 1) * gapX,
      capY: startY + (r0 + 7) * gapY,
      startAddr: dots[r0 * nCols + c0]?.addr || "0x0000",
      endAddr: dots[(r0 + 6) * nCols + (c0 + visibleCols - 1)]?.addr || "0x00D2",
    };
  }

  function triggerCommitsStart() {
    if (!commits) return;
    if (intro.on && intro.t0) {
      commStart = intro.t0 + 900;
    } else {
      commStart = performance.now();
    }
    gridDirty = true;
    requestFrame();
  }

  function applyCommits(data, cached) {
    const hadCommits = Boolean(commits);
    commits = data;
    commits.cached = cached;
    mapCommits();
    if (!hadCommits) {
      triggerCommitsStart();
    } else {
      gridDirty = true;
      requestFrame();
    }
  }

  F.api("/commits", "commits").then((r) => {
    if (r && r.data && r.data.weeks) {
      applyCommits(r.data, r.cached);
    } else {
      fetch("https://github-contributions-api.jogruber.de/v4/4ofl?y=last")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.contributions) {
            const weeksMap = [];
            let cur = [];
            data.contributions.slice(-210).forEach((c) => {
              const wd = new Date(c.date + "T00:00:00Z").getUTCDay();
              cur.push([c.date, c.count, wd]);
              if (cur.length === 7) {
                weeksMap.push(cur);
                cur = [];
              }
            });
            if (cur.length) weeksMap.push(cur);
            const resData = { total: data.total?.lastYear, weeks: weeksMap };
            try {
              localStorage.setItem("c:commits", JSON.stringify({ at: Date.now(), data: resData }));
            } catch {}
            applyCommits(resData, false);
          }
        })
        .catch(() => {});
    }
  });

  const fmtDate = (d) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  /* =========================================================
     intro: terminal / memory-byte scramble decoder
     ========================================================= */
  const TARGET_NAME = "aby mathew";
  const HEX_GLYPHS = "0123456789ABCDEFabcdef!<>-_/[]{}*#~+";
  const intro = { on: false, raf: null, revealed: false, t0: 0, endedAt: 0 };

  function endIntro() {
    intro.on = false;
    intro.revealed = true;
    intro.endedAt = performance.now();
    if (intro.raf) {
      cancelAnimationFrame(intro.raf);
      intro.raf = null;
    }
    const chars = [...TARGET_NAME].filter((c) => c !== " ");
    L.forEach((s, idx) => {
      s.textContent = chars[idx] || "";
      s.style.color = "";
      s.style.fontVariationSettings = '"wght" 300';
    });
    centers.forEach((it) => {
      it.curK = 0;
    });
    root.classList.remove("intro");
    try {
      sessionStorage.setItem("intro", "1");
    } catch {}
    if (commStart > performance.now()) {
      commStart = performance.now() - 40;
    }
    gridDirty = true;
    requestFrame();
  }

  function startIntro() {
    if (!root.classList.contains("intro")) return;
    if (reduce || scrollY > 40) return endIntro();

    const chars = [...TARGET_NAME].filter((c) => c !== " ");
    const n = chars.length;
    intro.on = true;
    intro.revealed = false;
    intro.t0 = performance.now();

    // Staggered byte resolve timeline (total ~1.5s, deliberate & readable)
    const lockDelays = [
      420,  // a (gives 420ms of full-word scramble)
      540,  // b
      660,  // y
      840,  // m (slight breath between first and last name)
      960,  // a
      1070, // t
      1180, // h
      1290, // e
      1400, // w
    ];
    const locked = new Array(n).fill(false);
    let lastFlipT = 0;

    if (commits) {
      commStart = intro.t0 + 900;
    }

    function stepScramble(now) {
      if (!intro.on) return;
      const elapsed = now - intro.t0;
      let allLocked = true;

      // Throttle character flipping to ~45ms so hex glyphs are clearly readable
      const shouldFlip = now - lastFlipT > 45;
      if (shouldFlip) lastFlipT = now;

      for (let i = 0; i < n; i++) {
        const s = L[i];
        if (!s) continue;

        if (elapsed >= lockDelays[i]) {
          if (!locked[i]) {
            locked[i] = true;
            s.textContent = chars[i];
            s.style.color = "var(--accent)";
            s.style.fontVariationSettings = '"wght" 650';
            setTimeout(() => {
              if (s) {
                s.style.color = "";
                s.style.fontVariationSettings = '"wght" 300';
              }
            }, 180);
          }
        } else {
          allLocked = false;
          if (shouldFlip) {
            s.textContent = HEX_GLYPHS[(Math.random() * HEX_GLYPHS.length) | 0];
          }
          s.style.color = "var(--mist)";
          s.style.fontVariationSettings = '"wght" 450';
        }
      }

      if (elapsed > 1050 && !intro.revealed) {
        intro.revealed = true;
        root.classList.remove("intro");
      }

      if (allLocked && elapsed >= 1550) {
        endIntro();
      } else {
        intro.raf = requestAnimationFrame(stepScramble);
      }
    }

    intro.raf = requestAnimationFrame(stepScramble);
  }

  const skipIntro = () => intro.on && endIntro();
  addEventListener("pointerdown", skipIntro, { passive: true });
  addEventListener("keydown", skipIntro);

  document.fonts.ready.then(() => {
    L.forEach((s) => {
      s.style.fontVariationSettings = '"wght" 800';
      s.style.width = s.getBoundingClientRect().width + "px";
      s.style.fontVariationSettings = '"wght" 300';
    });
    cacheLetters();
    startIntro();
    requestFrame();
  });

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
    if (reduce || isStaticFallback) return;
    ripples.push({
      x: cx * D,
      y: cy * D,
      r: 0,
      maxR: Math.max(innerWidth, innerHeight) * 0.42 * D,
      speed: 6.2 * D,
      life: 1.0,
    });
    gridDirty = true;
    requestFrame();
  }

  let animPending = false;
  function requestFrame() {
    if (!animPending && !reduce) {
      animPending = true;
      requestAnimationFrame(frame);
    }
  }

  function stepGrid(now) {
    g.clearRect(0, 0, W, H);
    const twoPi = 6.2831853;
    const hoverDist = 180 * D;
    const cursorRadius = 125 * D;
    const spring = 0.082;
    const damping = 0.84;
    const targetMx = mx * D;
    const targetMy = my * D;
    let hasMotion = false;
    const sy = scrollY;
    const heroProgress = clamp(sy / (innerHeight * 0.75));
    const hf = 0.5 * (1 + Math.cos(heroProgress * Math.PI));

    if (!isStaticFallback) {
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += rip.speed;
        rip.life -= 0.024;
        if (rip.life <= 0 || rip.r >= rip.maxR) ripples.splice(i, 1);
      }

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        if (mx > -900) {
          const dx = dot.x - targetMx;
          const dy = dot.y - targetMy;
          const dist = Math.hypot(dx, dy);
          if (dist < cursorRadius && dist > 0.1) {
            const force = (1 - dist / cursorRadius) * 4.4 * D;
            dot.vx += (dx / dist) * force;
            dot.vy += (dy / dist) * force;
            dot.vx += curVx * 0.1 * (1 - dist / cursorRadius) * D;
            dot.vy += curVy * 0.1 * (1 - dist / cursorRadius) * D;
          }
        }
        for (let r = 0; r < ripples.length; r++) {
          const rip = ripples[r];
          const rdx = dot.x - rip.x;
          const rdy = dot.y - rip.y;
          const dDot = Math.hypot(rdx, rdy);
          const waveDist = Math.abs(dDot - rip.r);
          const waveWidth = 46 * D;
          if (waveDist < waveWidth && dDot > 0.1) {
            const push = (1 - waveDist / waveWidth) * rip.life * 2.8 * D;
            dot.vx += (rdx / dDot) * push;
            dot.vy += (rdy / dDot) * push;
          }
        }
        dot.vx = (dot.vx + (dot.ox - dot.x) * spring) * damping;
        dot.vy = (dot.vy + (dot.oy - dot.y) * spring) * damping;
        dot.x += dot.vx;
        dot.y += dot.vy;
        if (
          Math.abs(dot.x - dot.ox) > 0.12 ||
          Math.abs(dot.y - dot.oy) > 0.12 ||
          Math.abs(dot.vx) > 0.08 ||
          Math.abs(dot.vy) > 0.08
        )
          hasMotion = true;
      }
      curVx *= 0.65;
      curVy *= 0.65;
    } else {
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        dot.x = dot.ox;
        dot.y = dot.oy;
      }
    }

    // 1. Left-edge Memory Address Gutter
    if (dots.length > 0) {
      g.font = `${7.5 * D}px "JetBrains Mono", monospace`;
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(140, 138, 133, 0.14)";
      for (let r = 0; r < nRows; r += 3) {
        const d = dots[r * nCols];
        if (d) g.fillText(d.addr + ":", 12 * D, d.y);
      }
    }

    // 2. Render Memory Cells (Hex Dump & Commits)
    g.font = `${8.5 * D}px "JetBrains Mono", monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";

    let hover = null;
    let hoverD = 20 * D;

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      let maxK = 0;
      if (mx > -900) {
        const dc = Math.hypot(dot.x / D - mx, dot.y / D - my);
        if (dc < hoverDist) maxK = Math.max(maxK, 1 - dc / hoverDist);
        if (dc * D < hoverD) {
          hoverD = dc * D;
          hover = dot;
        }
      }
      for (let r = 0; r < ripples.length; r++) {
        const rip = ripples[r];
        const dDot = Math.hypot(dot.x - rip.x, dot.y - rip.y);
        const waveDist = Math.abs(dDot - rip.r);
        const waveWidth = 46 * D;
        if (waveDist < waveWidth) {
          const intensity = (1 - waveDist / waveWidth) * rip.life;
          if (intensity > maxK) maxK = Math.max(maxK, intensity);
        }
      }

      // Commit Buffer Cell (Hero top-right) with sequential allocation sweep & scroll conversion
      if (dot.cm) {
        const cm = dot.cm;
        const dt = now - commStart - cm.t;
        const allocDur = 300;

        // Allocation sweep progress: 0 before wave arrives, 1 when fully allocated
        let a = 1;
        if (dt < 0) {
          a = 0;
          hasMotion = true; // Wave is coming, keep frame loop active!
        } else if (dt < allocDur) {
          a = clamp(dt / allocDur);
          hasMotion = true; // Wave is sweeping this cell!
        }

        // Phosphor allocation pulse during first 45% of arrival:
        const pulse = (a > 0 && a < 0.45) ? Math.sin((a / 0.45) * Math.PI) : 0;

        // Flip threshold for converting between commit hex and background raw hex:
        // Micro-stagger between 0.38 and 0.62 creates a digital memory decoding ripple across cells
        const flipHf = 0.5 + (((cm.col * 7 + cm.row * 13) % 11) - 5) * 0.024;
        const isCommitMode = a > 0.25 && hf >= flipHf;

        // Which character to display:
        // In hero / allocated: show commit hex value (or ".." for 0 commits)
        // When scrolled down / unallocated: show the underlying background hex character (dot.val)
        const displayVal = isCommitMode
          ? (cm.count > 0 ? cm.hexVal : "..")
          : dot.val;

        // Orange commit heatmap box & border:
        if (cm.count > 0 && a > 0 && hf > 0.02) {
          const fadeHf = Math.pow(hf, 1.4);
          const baseBoxAlpha = (0.2 + cm.level * 0.16) * a * fadeHf + maxK * 0.28 * hf;
          const boxAlpha = Math.min(0.92, baseBoxAlpha + pulse * 0.36);
          if (boxAlpha > 0.01) {
            g.fillStyle = `rgba(212, 116, 85, ${boxAlpha})`;
            g.fillRect(dot.x - 11 * D, dot.y - 7.5 * D, 22 * D, 15 * D);

            if (cm.level >= 3 || pulse > 0.1 || maxK > 0.35) {
              const borderAlpha = Math.min(0.85, (0.45 * a * fadeHf) + pulse * 0.5);
              if (borderAlpha > 0.01) {
                g.strokeStyle = pulse > 0.3 ? `rgba(255, 235, 220, ${borderAlpha})` : `rgba(212, 116, 85, ${borderAlpha})`;
                g.lineWidth = D;
                g.strokeRect(dot.x - 11 * D, dot.y - 7.5 * D, 22 * D, 15 * D);
              }
            }
          }
        }

        // Ambient hover box if hovered when unallocated or fully scrolled out:
        if (maxK > 0.38 && (!isCommitMode || cm.count === 0)) {
          g.fillStyle = `rgba(212, 116, 85, ${0.12 * maxK})`;
          g.fillRect(dot.x - 10 * D, dot.y - 7 * D, 20 * D, 14 * D);
        }

        // Text alpha calculation:
        // Peak brightness in hero: 0.95 for level 3/4, 0.72-0.88 for level 1/2, 0.22 for zero commits.
        // Ambient background brightness: 0.045 (or up to 0.5 on hover).
        // Smoothly blends from peak brightness down to ambient grey as user scrolls (hf: 1 -> 0).
        const peakAlpha = cm.count > 0 ? (cm.level >= 3 ? 0.95 : 0.72 + cm.level * 0.08) : 0.22;
        const ambAlpha = maxK > 0 ? (0.05 + 0.45 * maxK) : 0.045;
        const blend = a * Math.pow(hf, 1.2);
        const textAlpha = clamp(ambAlpha + (peakAlpha - ambAlpha) * blend + pulse * 0.35, 0.045, 1.0);

        if (maxK > 0.38) {
          g.fillStyle = `rgba(212, 116, 85, ${0.3 + 0.7 * maxK})`;
        } else {
          g.fillStyle = `rgba(237, 236, 232, ${textAlpha})`;
        }
        g.fillText(displayVal, dot.x, dot.y);
        continue;
      }

      // Ambient Memory Cells
      if (maxK > 0.38) {
        g.fillStyle = `rgba(212, 116, 85, ${0.12 * maxK})`;
        g.fillRect(dot.x - 10 * D, dot.y - 7 * D, 20 * D, 14 * D);
        g.fillStyle = `rgba(212, 116, 85, ${0.3 + 0.7 * maxK})`;
        g.fillText(dot.val, dot.x, dot.y);
      } else if (maxK > 0) {
        g.fillStyle = `rgba(237, 236, 232, ${0.05 + 0.45 * maxK})`;
        g.fillText(dot.val, dot.x, dot.y);
      } else {
        g.fillStyle = "rgba(237, 236, 232, 0.045)";
        g.fillText(dot.val, dot.x, dot.y);
      }
    }

    // Commit buffer caption in hero (fades in smoothly as the sweep reaches the right edge)
    if (commMeta && hf > 0.01) {
      const sweepEnd = commMeta.cols * 20 + 160;
      if (now - commStart < sweepEnd + 320) hasMotion = true;
      const capIn = clamp((now - commStart - sweepEnd) / 320);
      const capAlpha = 0.85 * hf * capIn;
      if (capAlpha > 0.01) {
        const label = `${commMeta.total ? commMeta.total.toLocaleString() + " " : ""}commits · last ${commMeta.cols}w`;
        g.font = `500 ${9.5 * D}px "JetBrains Mono", monospace`;
        g.textAlign = "right";
        g.textBaseline = "middle";
        g.fillStyle = `rgba(140, 138, 133, ${capAlpha})`;
        g.fillText(label, commMeta.capX + 11 * D, commMeta.capY);
      }
    }

    // 3. Memory Inspector HUD (Hover Tooltip)
    if (hover) {
      const isCm = Boolean(hover.cm && hf > 0.4 && now - commStart - hover.cm.t >= 0);
      const txt1 = isCm
        ? `PTR ${hover.addr} · ${hover.cm.count} commit${hover.cm.count === 1 ? "" : "s"}${hover.cm.count ? " [0x" + hover.cm.hexVal + "]" : ""}`
        : `PTR ${hover.addr}`;
      const txt2 = isCm
        ? `${fmtDate(hover.cm.date)}`
        : `VAL 0x${hover.val} · READ OK`;

      g.font = `500 ${10.5 * D}px "JetBrains Mono", monospace`;
      const w1 = g.measureText(txt1).width;
      g.font = `${9 * D}px "JetBrains Mono", monospace`;
      const w2 = g.measureText(txt2).width;
      const tw = Math.max(w1, w2) + 20 * D;
      const th = 34 * D;

      let bx = hover.x - tw / 2;
      bx = Math.min(W - tw - 12 * D, Math.max(12 * D, bx));
      const by = hover.y - th - 12 * D > 10 * D ? hover.y - th - 12 * D : hover.y + 16 * D;

      g.fillStyle = "rgba(16, 16, 20, 0.94)";
      g.strokeStyle = isCm && hover.cm.count ? "rgba(212, 116, 85, 0.55)" : "rgba(255, 255, 255, 0.16)";
      g.lineWidth = D;
      g.beginPath();
      if (g.roundRect) g.roundRect(bx, by, tw, th, 4 * D);
      else g.rect(bx, by, tw, th);
      g.fill();
      g.stroke();

      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      g.font = `500 ${10 * D}px "JetBrains Mono", monospace`;
      g.fillStyle = "#edece8";
      g.fillText(txt1, bx + 10 * D, by + 14 * D);

      g.font = `${8.5 * D}px "JetBrains Mono", monospace`;
      g.fillStyle = isCm && hover.cm.count ? "rgba(212, 116, 85, 0.85)" : "rgba(140, 138, 133, 0.85)";
      g.fillText(txt2, bx + 10 * D, by + 26 * D);
    }

    return hasMotion;
  }

  function updateLetters(now) {
    const sy = scrollY;
    if (sy > innerHeight || !centers.length) return;

    if (intro.on) return;

    // Smooth ramp-up from 0 to 1 over 1.2s after scramble concludes
    const timeSinceIntro = intro.endedAt ? now - intro.endedAt : 10000;
    const waveRamp = clamp(timeSinceIntro / 1200);

    const isPointerActive = mx > -900 && now - lastMoveT < 3000;
    const fade = clamp(1 - sy / innerHeight);
    for (let i = 0; i < centers.length; i++) {
      const it = centers[i];
      let targetK = 0;
      const mouseDist = isPointerActive ? Math.hypot(mx - it.cx, my - (it.cy - sy)) : 9999;
      const proxK = Math.max(0, 1 - mouseDist / 320);

      if (!reduce) {
        // Wave phase starts at 0 from left to right when intro finishes
        const waveT = intro.endedAt ? (now - intro.endedAt) * 0.0014 : now * 0.0014;
        const s = Math.max(0, Math.sin(waveT - i * 0.55));
        const idleK = s * s * s * 0.62 * fade * waveRamp;
        if (isPointerActive) {
          const proxBlend = clamp(1 - (mouseDist - 120) / 220);
          targetK = idleK * (1 - proxBlend) + proxK * proxBlend;
        } else {
          targetK = idleK;
        }
      } else if (isPointerActive) {
        targetK = proxK;
      }

      it.curK = it.curK !== undefined ? it.curK + (targetK - it.curK) * 0.09 : 0;
      it.el.style.fontVariationSettings = `"wght" ${(300 + 500 * it.curK) | 0}`;
      it.el.style.color = isPointerActive && it.curK > 0.55 && proxK > 0.4 ? "var(--accent)" : "";
    }
  }

  let heroVisible = true;
  let fpsSamples = [];
  let lastFrameTime = 0;

  function frame(now) {
    animPending = false;

    // Rolling FPS monitor over 60 active frames (adaptive throttle for low-tier hardware)
    if (lastFrameTime) {
      const dt = now - lastFrameTime;
      if (dt > 0 && dt < 250) {
        fpsSamples.push(1000 / dt);
        if (fpsSamples.length > 60) fpsSamples.shift();
        if (!intro.on && fpsSamples.length >= 60) {
          const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
          if (!isThrottleTier1 && avgFps < 40) {
            isThrottleTier1 = true;
            spacingMultiplier = 1.6;
            fpsSamples = [];
            size();
          } else if (isThrottleTier1 && !isStaticFallback && avgFps < 30) {
            isStaticFallback = true;
            fpsSamples = [];
            gridDirty = true;
          }
        }
      }
    }
    lastFrameTime = now;

    let busy = false;
    if (gridDirty || intro.on || ripples.length) {
      busy = stepGrid(now);
      gridDirty = busy || intro.on || ripples.length > 0 || Math.abs(curVx) > 0.05 || Math.abs(curVy) > 0.05;
    }
    if (heroVisible) updateLetters(now);
    if (gridDirty || busy || (heroVisible && !reduce && !isStaticFallback)) requestFrame();
  }
  new IntersectionObserver(
    (es) => {
      heroVisible = es[0].isIntersecting;
      if (heroVisible) requestFrame();
    },
    { threshold: 0 },
  ).observe(hero);

  addEventListener(
    "pointerdown",
    (e) => {
      curVx = e.clientX - (lastMx === -999 ? e.clientX : lastMx);
      curVy = e.clientY - (lastMy === -999 ? e.clientY : lastMy);
      lastMx = mx = e.clientX;
      lastMy = my = e.clientY;
      lastMoveT = performance.now();
      gridDirty = true;
      requestFrame();
    },
    { passive: true },
  );
  addEventListener(
    "pointermove",
    (e) => {
      curVx = e.clientX - (lastMx === -999 ? e.clientX : lastMx);
      curVy = e.clientY - (lastMy === -999 ? e.clientY : lastMy);
      lastMx = mx = e.clientX;
      lastMy = my = e.clientY;
      lastMoveT = performance.now();
      gridDirty = true;
      requestFrame();
    },
    { passive: true },
  );
  addEventListener(
    "pointerup",
    (e) => {
      if (e.pointerType === "touch") {
        setTimeout(() => {
          lastMx = mx = -999;
          lastMy = my = -999;
          curVx = 0;
          curVy = 0;
          gridDirty = true;
          requestFrame();
        }, 700);
      }
    },
    { passive: true },
  );
  document.documentElement.addEventListener(
    "mouseleave",
    () => {
      lastMx = mx = -999;
      lastMy = my = -999;
      curVx = 0;
      curVy = 0;
      gridDirty = true;
      requestFrame();
    },
    { passive: true },
  );
  requestFrame();

  /* =========================================================
     scroll choreography: hero exit
     ========================================================= */
  F.onScroll((y) => {
    if (intro.on && y > innerHeight * 0.45) {
      endIntro();
    }
    heroP = clamp(y / (innerHeight * 0.8));
    heroIn.style.setProperty("--p", heroP.toFixed(3));
    if (y < innerHeight) {
      gridDirty = true;
      requestFrame();
    }
  });

  /* =========================================================
     mobile nav
     ========================================================= */
  const mobileNav = $("#mobileNav"),
    menuBtn = $("#menuBtn"),
    menuCloseBtn = $("#menuCloseBtn"),
    mobileNavBackdrop = $("#mobileNavBackdrop"),
    mPalBtn = $("#mPalBtn");
  function openMobileNav() {
    mobileNav.hidden = false;
    mobileNav.setAttribute("aria-hidden", "false");
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    F.lenis && F.lenis.stop();
    menuCloseBtn.focus();
  }
  function closeMobileNav(returnFocus = true) {
    if (mobileNav.hidden) return;
    mobileNav.hidden = true;
    mobileNav.setAttribute("aria-hidden", "true");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    F.lenis && F.lenis.start();
    if (returnFocus) menuBtn.focus();
  }
  menuBtn.addEventListener("click", openMobileNav);
  menuCloseBtn.addEventListener("click", () => closeMobileNav(true));
  mobileNavBackdrop.addEventListener("click", () => closeMobileNav(true));
  mPalBtn.addEventListener("click", () => {
    closeMobileNav(false);
    openP();
  });
  $$(".m-link").forEach((a) => a.addEventListener("click", () => closeMobileNav(false)));

  mobileNav.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMobileNav(true);
      return;
    }
    if (e.key === "Tab") {
      const focusables = $$("button, [href], input", mobileNav).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* =========================================================
     last push (cached fallback when offline)
     ========================================================= */
  const recentEl = $("#recentPush");
  F.api("/", "recent").then((r) => {
    const d = r && r.data;
    if (!d || !d.at) return;
    const t = F.ago(new Date(d.at).getTime()).replace(" ago", "");
    const tail = r.cached ? " · cached" : "";
    recentEl.textContent = "";
    recentEl.append(document.createTextNode(`shipped ${t} ago · `));
    if (d.name) {
      const a = document.createElement("a");
      a.href = `https://github.com/4ofl/${d.name}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = `4ofl/${d.name} ↗`;
      recentEl.append(a);
    } else recentEl.append(document.createTextNode("private repository"));
    if (tail) recentEl.append(document.createTextNode(tail));
  });

  /* =========================================================
     accordion, exclusive single open row
     ========================================================= */
  const allRows = $$(".row");
  let jInit = null;
  allRows.forEach((row) => {
    const b = $(".rh", row);
    b.onclick = () => {
      const opening = !row.classList.contains("open");
      if (opening)
        allRows.forEach((o) => {
          if (o !== row && o.classList.contains("open")) {
            o.classList.remove("open");
            const ob = $(".rh", o);
            ob.setAttribute("aria-expanded", "false");
            $(".pi", o).setAttribute("inert", "");
          }
        });
      row.classList.toggle("open", opening);
      b.setAttribute("aria-expanded", opening ? "true" : "false");
      const pi = $(".pi", row);
      opening ? pi.removeAttribute("inert") : pi.setAttribute("inert", "");
      if (opening && row.dataset.slug === "johns-fitness") warmSqlite().catch(() => {});
    };
  });

  /* shared element morph: row title -> case study title (cross-document view transition) */
  addEventListener("pageswap", (e) => {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    const m = new URL(e.activation.entry.url).pathname.match(/^\/work\/([^/]+)\/?$/);
    if (!m) return;
    const t = $(`.row[data-slug="${m[1]}"] .rh b`);
    if (t) t.style.viewTransitionName = "proj";
  });

  addEventListener("pagereveal", (e) => {
    if (!e.viewTransition) return;
    const fromUrl = e.activation?.from?.url || (window.navigation?.activation?.from?.url) || document.referrer;
    if (!fromUrl) return;
    try {
      const m = new URL(fromUrl).pathname.match(/^\/work\/([^/]+)\/?$/);
      if (!m) return;
      const t = $(`.row[data-slug="${m[1]}"] .rh b`);
      if (t) {
        t.style.viewTransitionName = "proj";
        e.viewTransition.finished.finally(() => {
          t.style.viewTransitionName = "";
        });
      }
    } catch {}
  });



  /* =========================================================
     johns fitness: real SQLite (sql.js / WASM) in the browser
     ========================================================= */
  let on = true,
    q = 0;
  const net = $("#net"),
    log = $("#jlog"),
    res = $("#jres"),
    jdb = $("#jdb");
  const add = (t) => {
    const li = document.createElement("li");
    li.textContent = t;
    log.prepend(li);
    while (log.children.length > 4) log.lastChild.remove();
  };
  let dbPromise = null;
  const loadScript = (src) =>
    new Promise((ok, no) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = no;
      document.head.append(s);
    });
  function warmSqlite() {
    if (dbPromise) return dbPromise;
    jdb.textContent = "loading sqlite (wasm)…";
    dbPromise = (async () => {
      await loadScript("/js/vendor/sql-wasm.js");
      const SQL = await window.initSqlJs({ locateFile: (f) => "/js/vendor/" + f });
      const db = new SQL.Database();
      db.run(
        "CREATE TABLE members(id TEXT PRIMARY KEY, reg_no TEXT NOT NULL, enrollment_id INTEGER NOT NULL, tier TEXT NOT NULL, valid_until INTEGER NOT NULL);" +
          "CREATE TABLE sync_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);",
      );
      db.run("BEGIN");
      const ins = db.prepare("INSERT INTO members VALUES (?,?,?,?,?)");
      const now = Date.now();
      for (let i = 1; i <= 1405; i++) {
        const reg = "JF-" + String(i).padStart(4, "0");
        const isExpired = i === 77;
        const tier = i % 10 === 0 ? "staff" : i % 3 === 0 ? "annual" : "monthly";
        ins.run(["m_" + i, reg, i, tier, isExpired ? now - 864e5 : now + 864e5 * 30]);
      }
      ins.free();
      db.run("COMMIT");
      const ver = db.exec("SELECT sqlite_version()")[0].values[0][0];
      jdb.textContent = `real sqlite ${ver} (wasm) · 1,405 members · running in your browser`;
      return db;
    })().catch((err) => {
      dbPromise = null;
      jdb.textContent = "sqlite failed to load (offline before first visit?). nothing is faked here.";
      throw err;
    });
    return dbPromise;
  }
  const SCANS = [
    [42, "JF-0042 (annual)"],
    [10, "JF-0010 (staff)"],
    [77, "JF-0077 (expired)"],
    [9999, "unknown biometric slot"],
  ];
  let scanN = 0;
  net.onclick = async () => {
    on = !on;
    net.setAttribute("aria-pressed", on);
    net.textContent = on ? "network online" : "network offline";
    if (on && q) {
      try {
        const db = await warmSqlite();
        const n = db.exec("SELECT COUNT(*) FROM sync_outbox")[0].values[0][0];
        db.run("DELETE FROM sync_outbox");
        add(`flushed ${n} outbox event${n > 1 ? "s" : ""} · biometrics quarantined on premise`);
      } catch {}
      q = 0;
      $("#q").textContent = 0;
    }
  };
  $("#fp").onclick = async () => {
    let db;
    try {
      db = await warmSqlite();
    } catch {
      res.textContent = "sqlite not available, so no result.";
      return;
    }
    const [enrollmentId, label] = SCANS[scanN++ % SCANS.length];
    const t0 = performance.now();
    const st = db.prepare("SELECT reg_no, tier, valid_until > ? AS ok FROM members WHERE enrollment_id = ?");
    st.bind([Date.now(), enrollmentId]);
    const row = st.step() ? st.getAsObject() : null;
    st.free();
    const ms = Math.max(0.01, performance.now() - t0).toFixed(2);
    let verdict;
    if (!row) verdict = "denied · unknown enrollment slot";
    else if (!row.ok) verdict = `denied (${row.reg_no}) · membership expired`;
    else verdict = `verified (${row.reg_no}, ${row.tier}) · relay open`;
    res.textContent = "";
    res.append(document.createTextNode(`${verdict} · ${ms} ms `));
    const sm = document.createElement("small");
    sm.className = "dim";
    sm.textContent = `(local query, ${label})`;
    res.append(sm);
    if (on) add(`dsp match → sqlite ${ms}ms → ${row && row.ok ? "open relay" : "deny"} → synced (cloud simulated)`);
    else {
      db.run("INSERT INTO sync_outbox(entity_type, payload, created_at) VALUES (?,?,?)", [
        "AttendanceRecord",
        JSON.stringify({ enrollmentId, status: row && row.ok ? "granted" : "denied" }),
        Date.now(),
      ]);
      q = db.exec("SELECT COUNT(*) FROM sync_outbox")[0].values[0][0];
      $("#q").textContent = q;
      add(`dsp match → sqlite ${ms}ms → ${row && row.ok ? "open relay" : "deny"} → outbox queued (biometrics quarantined)`);
    }
  };

  /* =========================================================
     june terminal: real RTT, real status (or an honest "unavailable")
     ========================================================= */
  const jt = $("#jt"),
    ji = $("#ji");
  const JUNE_CMDS = ["/ping", "/status", "/remind", "/watch", "/sanitize", "/help"];
  const juneHistory = [];
  let juneHistIdx = -1;
  const out = (t, c) => {
    const d = document.createElement("div");
    d.textContent = t;
    if (c) d.className = "c";
    jt.append(d);
    jt.scrollTop = 1e9;
  };
  async function run(c) {
    out("> " + c, 1);
    if (!juneHistory.length || juneHistory[juneHistory.length - 1] !== c) juneHistory.push(c);
    juneHistIdx = juneHistory.length;
    const m = c.match(/^\/remind (\d+)s (.+)/);
    if (m) {
      const s = Math.min(+m[1], 3600);
      out(`reminder set for ${s}s (persisted to node:sqlite)`);
      setTimeout(() => out("⏰ " + m[2], 1), s * 1e3);
    } else if (c === "/ping") {
      const t0 = performance.now();
      try {
        await fetch(F.API + "/ping", { cache: "no-store" });
        out(`pong · edge round trip ${Math.round(performance.now() - t0)}ms`);
      } catch {
        out("no pong. can't reach the edge worker from here.");
      }
    } else if (c === "/status") {
      out("querying status feed…");
      const r = await F.api("/status", "status", 4000);
      const d = r && r.data;
      if (!d || d.state === "unknown" || (d.status === "error" && !d.discord)) {
        out("status feed unavailable right now.");
      } else {
        const parts = [];
        const sh = d.runtime && d.runtime.shardIds ? d.runtime.shardIds.join(",") : d.shard ?? "0";
        parts.push(`shard ${sh} (${d.status || d.state || "operational"})`);
        const ping = d.discord && d.discord.gatewayPingMs != null ? d.discord.gatewayPingMs : d.heartbeatMs;
        if (ping != null) parts.push(`gateway ${ping}ms`);
        const dbLat = d.database && d.database.latencyMs != null ? d.database.latencyMs : null;
        if (dbLat != null) parts.push(`sqlite ${dbLat}ms`);
        const up = d.uptimeSeconds != null ? d.uptimeSeconds : d.uptimeSec;
        if (up != null) parts.push(`uptime ${F.uptime(up)}`);
        out(parts.join(" · ") + (r.cached ? ` · cached ${F.ago(r.at)}` : ""));
      }
    } else if (c.startsWith("/watch")) {
      out("sentinel: non-blocking tls, dns a/aaaa, and sha-256 drift detection with socket ip pinning");
    } else if (c.startsWith("/sanitize")) {
      out("sanitizer: strips utm tracking params, neutralizes discord mass mentions, and clears exif tags");
    } else if (c === "/help") {
      out("/ping  /status  /remind <n>s <text>  /watch  /sanitize");
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
      if (juneHistory.length && juneHistIdx > 0) ji.value = juneHistory[--juneHistIdx];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (juneHistIdx < juneHistory.length - 1) ji.value = juneHistory[++juneHistIdx];
      else {
        juneHistIdx = juneHistory.length;
        ji.value = "";
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const val = ji.value.trim();
      const match = JUNE_CMDS.find((cmd) => cmd.startsWith(val));
      if (match) ji.value = match + (match === "/remind" ? " 5s " : "");
    }
  };

  /* =========================================================
     copy email, clock
     ========================================================= */
  const copyBtn = $("#copyBtn");
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
  const f = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const tickClock = () => {
    const el = $("#clock");
    if (el) el.textContent = f.format(new Date()) + " IST";
  };
  tickClock();
  setInterval(tickClock, 2e4);

  /* =========================================================
     june statistics loader (api placeholder & live polling)
     ========================================================= */
  async function loadJuneStats() {
    const api = window.JUNE_STATS_API || "/status";
    let servers = null;
    let commands = null;
    let uptime = null;

    try {
      const r = await F.api(api, "june-metrics", 60);
      const d = r && r.data;
      if (d && d.state !== "unknown") {
        if (d.servers != null || d.guilds != null) servers = String(d.servers ?? d.guilds);
        if (d.commands != null || d.commandsRun != null) commands = String(d.commands ?? d.commandsRun);
        if (d.uptime != null || d.uptimePct != null) uptime = String(d.uptime ?? d.uptimePct);
      }
    } catch {}

    const elS = $("#juneServers");
    const elC = $("#juneCommands");
    const elU = $("#juneUptime");
    const elCS = $("#juneCaseServers");
    const elCC = $("#juneCaseCommands");
    const elCU = $("#juneCaseUptime");
    if (elS && servers !== null) elS.textContent = servers;
    if (elC && commands !== null) elC.textContent = commands;
    if (elU && uptime !== null) elU.textContent = uptime;
    if (elCS && servers !== null) elCS.textContent = servers;
    if (elCC && commands !== null) elCC.textContent = commands;
    if (elCU && uptime !== null) elCU.textContent = uptime;
  }
  loadJuneStats();

  /* =========================================================
     spotlight command palette
     ========================================================= */
  const pal = $("#pal"),
    palBackdrop = $("#palBackdrop"),
    palCloseKbd = $("#palCloseKbd"),
    pin2 = $("#pin-input"),
    pl = $("#plist"),
    pEmpty = $("#pEmpty");

  const CMD = [
    // sections
    {
      group: "sections",
      name: "work",
      desc: "selected engineering projects & interactive demos",
      target: "#work",
      tag: "section",
      keywords: ["work", "projects", "portfolio", "demos", "01"],
    },
    {
      group: "sections",
      name: "about",
      desc: "background, technical workbench, and focus areas",
      target: "#about",
      tag: "section",
      keywords: ["about", "bio", "skills", "kerala", "undergrad", "workbench", "02"],
    },
    {
      group: "sections",
      name: "contact",
      desc: "email address, availability, and social links",
      target: "#contact",
      tag: "section",
      keywords: ["contact", "email", "reach", "hire", "talk", "03"],
    },

    // projects
    {
      group: "projects",
      name: "june",
      desc: "hardened discord bot · node:sqlite · socket ip pinning",
      target: "/work/june/",
      tag: "case study",
      keywords: ["june", "discord", "bot", "sqlite", "ssrf", "redos", "watchdog"],
    },
    {
      group: "projects",
      name: "johns fitness",
      desc: "offline-first access control · biomax dsp · 1,405 members",
      target: "/work/johns-fitness/",
      tag: "case study",
      keywords: ["johns", "fitness", "gym", "biometric", "biomax", "sqlite", "wasm", "wal", "offline"],
    },
    {
      group: "projects",
      name: "citecamp",
      desc: "rag assistant over watermarked academic circulars",
      target: "/work/citecamp/",
      tag: "case study",
      keywords: ["citecamp", "rag", "academic", "ai", "chunker", "pdf", "retrieval"],
    },

    // writing
    {
      group: "writing",
      name: "writing",
      desc: "all engineering write-ups & architectural notes",
      target: "/writing/",
      tag: "index",
      keywords: ["writing", "essays", "articles", "blog", "posts", "read"],
    },
    {
      group: "writing",
      name: "anti-ssrf & socket pinning",
      desc: "defeating dns rebinding & toctou in node.js",
      target: "/writing/ssrf-socket-pinning/",
      tag: "essay",
      keywords: ["ssrf", "socket", "pinning", "dns", "rebinding", "toctou", "security", "node"],
    },
    {
      group: "writing",
      name: "zombie websockets",
      desc: "recovering from half-open tcp gateway connections",
      target: "/writing/zombie-sockets/",
      tag: "essay",
      keywords: ["zombie", "websocket", "discord", "gateway", "tcp", "heartbeat", "sockets"],
    },
    {
      group: "writing",
      name: "mdb to sqlite wal",
      desc: "migrating 1,405 members from access 2013 to sqlite in .net 8",
      target: "/writing/mdb-to-sqlite-wal/",
      tag: "essay",
      keywords: ["mdb", "sqlite", "wal", "access", "database", "migration", ".net", "jet"],
    },

    // actions
    {
      group: "actions",
      name: "resume",
      desc: "open official pdf resume (aby_mathew_resume.pdf)",
      target: () => window.open("/resume.pdf", "_blank", "noopener"),
      tag: "document",
      keywords: ["resume", "cv", "pdf", "experience", "education", "hire"],
    },
    {
      group: "actions",
      name: "download resume",
      desc: "download aby_mathew_resume.pdf directly",
      target: () => {
        const a = document.createElement("a");
        a.href = "/resume.pdf";
        a.download = "aby_mathew_resume.pdf";
        a.click();
        F.toast("downloading aby_mathew_resume.pdf", 2500);
      },
      tag: "action",
      keywords: ["download", "resume", "cv", "pdf"],
    },
    {
      group: "actions",
      name: "email aby",
      desc: "mailto:aby@4ofl.dev",
      target: () => (location.href = "mailto:aby@4ofl.dev"),
      tag: "action",
      keywords: ["mail", "email", "send", "contact", "message"],
    },
    {
      group: "actions",
      name: "copy email",
      desc: "copy aby@4ofl.dev directly to clipboard",
      target: () => copyBtn.click(),
      tag: "action",
      keywords: ["email", "copy", "mail", "contact", "address", "aby@4ofl.dev"],
    },
    {
      group: "actions",
      name: "simulate biometric scan",
      desc: "trigger simulated fingerprint scan in johns fitness demo",
      target: () => {
        const row = document.querySelector('.row[data-slug="johns-fitness"]');
        if (row && !row.classList.contains("open")) {
          const btn = $(".rh", row);
          btn && btn.click();
        }
        setTimeout(() => {
          const fp = $("#fp");
          fp && fp.click();
        }, 280);
        if (F.lenis) F.lenis.scrollTo("#work", { duration: 1.0 });
        else document.getElementById("work")?.scrollIntoView({ behavior: "smooth" });
      },
      tag: "action",
      keywords: ["scan", "biometric", "fingerprint", "johns", "demo", "simulate", "relay"],
    },
    {
      group: "actions",
      name: "ping edge worker",
      desc: "test round-trip latency to cloudflare worker",
      target: async () => {
        const t0 = performance.now();
        const ok = await F.up("https://worker-round-credit-5733.abyperhaps.workers.dev/ping", 2500);
        const ms = (performance.now() - t0) | 0;
        F.toast(ok ? `<b>pong.</b> edge worker latency: ${ms}ms` : "worker ping timed out", 3500);
      },
      tag: "action",
      keywords: ["ping", "latency", "edge", "worker", "status", "api", "health"],
    },

    // CONNECT
    {
      group: "Links",
      name: "github",
      desc: "github.com/4ofl",
      target: "https://github.com/4ofl",
      tag: "external",
      keywords: ["github", "source", "code", "repos", "4ofl"],
    },
    {
      group: "Links",
      name: "june docs",
      desc: "docs.june.4ofl.dev",
      target: "https://docs.june.4ofl.dev",
      tag: "external",
      keywords: ["june docs", "documentation", "guide", "manual"],
    },
    {
      group: "Links",
      name: "linkedin",
      desc: "linkedin.com/in/abyperhaps",
      target: "https://linkedin.com/in/abyperhaps",
      tag: "external",
      keywords: ["linkedin", "profile", "connect", "abyperhaps"],
    },
    {
      group: "Links",
      name: "discord",
      desc: "discord.com/users/1310480351008657420",
      target: "https://discord.com/users/1310480351008657420",
      tag: "external",
      keywords: ["discord", "chat", "message", "dm"],
    },
  ];

  let sel = 0,
    list = CMD,
    currentQuery = "",
    lastFocus = null;

  function highlightMatch(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return `${before}<mark>${match}</mark>${after}`;
  }

  function paint() {
    pl.innerHTML = "";
    if (!list.length) {
      pl.hidden = true;
      pEmpty.hidden = false;
      pin2.removeAttribute("aria-activedescendant");
      return;
    }
    pl.hidden = false;
    pEmpty.hidden = true;

    let lastGroup = null;
    list.forEach((item, i) => {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group;
        const gh = document.createElement("li");
        gh.className = "p-group-title";
        gh.setAttribute("role", "presentation");
        gh.textContent = item.group;
        pl.append(gh);
      }

      const li = document.createElement("li");
      li.id = "p-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === sel ? "true" : "false");
      li.className = i === sel ? "on" : "";

      const left = document.createElement("div");
      left.className = "p-left";

      const title = document.createElement("span");
      title.className = "p-title";
      title.innerHTML = highlightMatch(item.name, currentQuery);
      left.append(title);

      if (item.desc) {
        const desc = document.createElement("span");
        desc.className = "p-desc";
        desc.textContent = item.desc;
        left.append(desc);
      }

      const type = document.createElement("span");
      type.className = "p-type";
      type.textContent = item.tag || "";

      li.append(left, type);
      li.onclick = () => go(i);
      pl.append(li);
    });

    if (list[sel]) {
      pin2.setAttribute("aria-activedescendant", "p-opt-" + sel);
      const activeEl = document.getElementById("p-opt-" + sel);
      if (activeEl && typeof activeEl.scrollIntoView === "function") {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    } else {
      pin2.removeAttribute("aria-activedescendant");
    }
  }

  function go(i) {
    const item = list[i];
    if (!item || !item.target) return;
    shut();
    const t = item.target;
    if (typeof t === "function") {
      t();
    } else if (t[0] === "#") {
      if (F.lenis) F.lenis.scrollTo(t, { duration: 1.15 });
      else $(t)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      history.pushState(null, "", t);
    } else if (t[0] === "/") {
      location.href = t;
    } else {
      open(t, "_blank", "noopener");
    }
  }

  function openP() {
    lastFocus = document.activeElement;
    pal.hidden = false;
    pin2.setAttribute("aria-expanded", "true");
    pin2.value = "";
    currentQuery = "";
    list = CMD;
    sel = 0;
    paint();
    pin2.focus();
    F.lenis && F.lenis.stop();
  }

  function shut() {
    if (pal.hidden) return;
    pal.hidden = true;
    pin2.setAttribute("aria-expanded", "false");
    pin2.removeAttribute("aria-activedescendant");
    F.lenis && F.lenis.start();
    lastFocus && lastFocus.focus && lastFocus.focus();
  }

  const kBtn = $("#kBtn");
  if (kBtn) kBtn.onclick = openP;
  palBackdrop && (palBackdrop.onclick = shut);
  if (palCloseKbd) {
    palCloseKbd.onclick = shut;
    palCloseKbd.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        shut();
      }
    };
  }

  pin2.oninput = () => {
    currentQuery = pin2.value.trim().toLowerCase();
    if (!currentQuery) {
      list = CMD;
    } else {
      list = CMD.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(currentQuery);
        const descMatch = c.desc && c.desc.toLowerCase().includes(currentQuery);
        const kwMatch = c.keywords && c.keywords.some((kw) => kw.toLowerCase().includes(currentQuery));
        return nameMatch || descMatch || kwMatch;
      });
    }
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
    if (e.key === "Escape") {
      e.preventDefault();
      shut();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (document.activeElement === palCloseKbd) {
        pin2.focus();
      } else {
        palCloseKbd ? palCloseKbd.focus() : pin2.focus();
      }
    } else if (e.key === "ArrowDown") {
      if (!list.length) return;
      e.preventDefault();
      sel = (sel + 1) % list.length;
      paint();
    } else if (e.key === "ArrowUp") {
      if (!list.length) return;
      e.preventDefault();
      sel = (sel - 1 + list.length) % list.length;
      paint();
    } else if (e.key === "Enter") {
      if (!list.length) return;
      e.preventDefault();
      go(sel);
    }
  });

  /* =========================================================
     nav scroll-spy
     ========================================================= */
  const navLinks = $$("nav.desktop-nav a[href^='#']");
  const spySections = ["work", "writing", "about", "contact"].map((id) => document.getElementById(id)).filter(Boolean);
  if ("IntersectionObserver" in window && spySections.length) {
    const spy = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting)
            navLinks.forEach((a) => {
              const active = a.getAttribute("href") === "#" + entry.target.id;
              a.classList.toggle("active", active);
              if (active) a.setAttribute("aria-current", "true");
              else a.removeAttribute("aria-current");
            });
        }),
      { rootMargin: "-20% 0px -55% 0px" },
    );
    spySections.forEach((s) => spy.observe(s));
    F.onScroll((y) => {
      if (y < 250) {
        navLinks.forEach((a) => {
          a.classList.remove("active");
          a.removeAttribute("aria-current");
        });
      }
    });
  }
})();
