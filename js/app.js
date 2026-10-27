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
    gapX = (innerWidth > 768 ? 36 : 32) * D;
    gapY = (innerWidth > 768 ? 32 : 28) * D;
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
      commStart = intro.t0 + 1850;
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

  /* intro: the grid breaks loose and becomes the name */
  const intro = { on: false, t0: 0, n: 0, tx: null, ty: null, sx: null, sy: null, dl: null, revealed: false };
  function endIntro() {
    intro.on = false;
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
    try {
      const m = document.createElement("canvas");
      m.width = innerWidth;
      m.height = innerHeight;
      const mc = m.getContext("2d", { willReadFrequently: true });
      const fs = parseFloat(getComputedStyle(name).fontSize);
      mc.font = `800 ${fs}px "Bricolage Grotesque", sans-serif`;
      mc.textAlign = "center";
      mc.textBaseline = "alphabetic";
      mc.fillStyle = "#fff";
      const mt = mc.measureText("a");
      const A = mt.fontBoundingBoxAscent ?? fs * 0.93,
        Dd = mt.fontBoundingBoxDescent ?? fs * 0.25;
      L.forEach((s) => {
        const r = s.getBoundingClientRect();
        mc.fillText(s.textContent, r.left + r.width / 2, r.top + (r.height - (A + Dd)) / 2 + A);
      });
      const data = mc.getImageData(0, 0, m.width, m.height).data;
      let step = innerWidth < 600 ? 6 : innerWidth < 1100 ? 8 : 9;
      let pts;
      for (let tries = 0; tries < 4; tries++) {
        pts = [];
        for (let y = step / 2; y < m.height; y += step)
          for (let x = step / 2; x < m.width; x += step)
            if (data[(((y | 0) * m.width) + (x | 0)) * 4 + 3] > 128) pts.push(x, y);
        if (pts.length / 2 <= 3200) break;
        step += 2;
      }
      const n = pts.length / 2;
      if (n < 20) return endIntro();
      intro.n = n;
      intro.tx = new Float32Array(n);
      intro.ty = new Float32Array(n);
      intro.sx = new Float32Array(n);
      intro.sy = new Float32Array(n);
      intro.dl = new Float32Array(n);
      const gx0 = startX / D,
        gy0 = startY / D;
      for (let i = 0; i < n; i++) {
        const tx = pts[i * 2],
          ty = pts[i * 2 + 1];
        intro.tx[i] = tx;
        intro.ty[i] = ty;
        intro.sx[i] = gx0 + Math.round((tx - gx0) / 34) * 34 + (Math.random() - 0.5) * 10;
        intro.sy[i] = gy0 + Math.round((ty - gy0) / 34) * 34 + (Math.random() - 0.5) * 10;
        intro.dl[i] = Math.random() * 600;
      }
      intro.on = true;
      intro.t0 = performance.now();
      intro.revealed = false;
      if (commits) {
        commStart = intro.t0 + 1850;
      }
      requestFrame();
    } catch {
      endIntro();
    }
  }
  const skipIntro = () => intro.on && endIntro();
  addEventListener("pointerdown", skipIntro, { passive: true });
  addEventListener("keydown", skipIntro);
  addEventListener("wheel", skipIntro, { passive: true });

  document.fonts.ready.then(() => {
    const isIntro = root.classList.contains("intro");
    L.forEach((s) => {
      s.style.fontVariationSettings = '"wght" 800';
      s.style.width = s.getBoundingClientRect().width + "px";
      if (!isIntro) s.style.fontVariationSettings = '"wght" 300';
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
    if (reduce) return;
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
        ? `${fmtDate(hover.cm.date)} · BUFFER ALLOC`
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

    // 5. Intro: Memory bits assemble the name
    if (intro.on) {
      const t = now - intro.t0;
      if (t > 1900 && !intro.revealed) {
        intro.revealed = true;
        root.classList.remove("intro");
      }
      if (t > 2600) {
        endIntro();
      } else {
        const fade = t > 1900 ? 1 - clamp((t - 1900) / 700) : 1;
        const r = 1.35 * D;
        for (let pass = 0; pass < 2; pass++) {
          g.fillStyle = pass ? `rgba(212,116,85,${0.95 * fade})` : `rgba(237,236,232,${0.85 * fade})`;
          g.beginPath();
          for (let i = pass; i < intro.n; i += 2) {
            const e = 1 - Math.pow(1 - clamp((t - intro.dl[i]) / 1100), 3);
            const wob = (1 - e) * Math.sin(i * 12.9898 + t * 0.004) * 14;
            const x = (intro.sx[i] + (intro.tx[i] - intro.sx[i]) * e + wob) * D;
            const y = (intro.sy[i] + (intro.ty[i] - intro.sy[i]) * e) * D;
            g.rect(x - r, y - r, r * 2, r * 2);
          }
          g.fill();
        }
      }
    }
    return hasMotion;
  }

  function updateLetters(now) {
    const sy = scrollY;
    if (sy > innerHeight || !centers.length) return;

    if (intro.on) {
      const t = now - intro.t0;
      let introK = 1;
      if (t >= 1900) {
        const p = clamp((t - 1900) / 700);
        introK = 1 - p;
      }
      for (let i = 0; i < centers.length; i++) {
        const it = centers[i];
        it.curK = introK;
        it.el.style.fontVariationSettings = `"wght" ${(300 + 500 * introK) | 0}`;
        it.el.style.color = "";
      }
      return;
    }

    const isPointerActive = mx > -900 && now - lastMoveT < 3000;
    const fade = clamp(1 - sy / innerHeight);
    for (let i = 0; i < centers.length; i++) {
      const it = centers[i];
      let targetK = 0;
      const mouseDist = isPointerActive ? Math.hypot(mx - it.cx, my - (it.cy - sy)) : 9999;
      const proxK = Math.max(0, 1 - mouseDist / 320);

      if (!reduce) {
        const s = Math.max(0, Math.sin(now * 0.0014 - i * 0.55));
        const idleK = s * s * s * 0.62 * fade;
        if (isPointerActive) {
          const proxBlend = clamp(1 - (mouseDist - 120) / 220);
          targetK = idleK * (1 - proxBlend) + proxK * proxBlend;
        } else {
          targetK = idleK;
        }
      } else if (isPointerActive) {
        targetK = proxK;
      }

      it.curK = it.curK !== undefined ? it.curK + (targetK - it.curK) * 0.12 : targetK;
      it.el.style.fontVariationSettings = `"wght" ${(300 + 500 * it.curK) | 0}`;
      it.el.style.color = isPointerActive && it.curK > 0.55 && proxK > 0.4 ? "var(--accent)" : "";
    }
  }

  let heroVisible = true;
  function frame(now) {
    animPending = false;
    let busy = false;
    if (gridDirty || intro.on || ripples.length) {
      busy = stepGrid(now);
      gridDirty = busy || intro.on || ripples.length > 0 || Math.abs(curVx) > 0.05 || Math.abs(curVy) > 0.05;
    }
    if (heroVisible) updateLetters(now);
    if (gridDirty || busy || (heroVisible && !reduce)) requestFrame();
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
            ob.dataset.cursor = "open";
            $(".pi", o).setAttribute("inert", "");
          }
        });
      row.classList.toggle("open", opening);
      b.setAttribute("aria-expanded", opening ? "true" : "false");
      b.dataset.cursor = opening ? "close" : "open";
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
     citecamp: honest pipeline (planned, not running)
     ========================================================= */
  const NOTES = [
    "curated university documents only: regulations, circulars, manuals. no open web.",
    "circulars are watermarked scans. strip the watermark, OCR, and check the text before it goes near a chunker.",
    "split on clause and section boundaries, not fixed token windows, so a rule stays attached to its exception.",
    "hybrid search over the chunks. every hit keeps its document id and clause number.",
    "the model only sees what was retrieved. every claim ships with its source, or it doesn't ship.",
  ];
  const pipeBtns = $$("#ccPipe button");
  const ccNote = $("#ccNote");
  pipeBtns.forEach((b) =>
    b.addEventListener("click", () => {
      pipeBtns.forEach((o) => o.setAttribute("aria-pressed", o === b ? "true" : "false"));
      ccNote.textContent = NOTES[+b.dataset.n];
    }),
  );
  ccNote.textContent = NOTES[0];

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
  const tickClock = () => ($("#clock").textContent = "kerala " + f.format(new Date()) + " IST");
  tickClock();
  setInterval(tickClock, 2e4);

  /* =========================================================
     command palette
     ========================================================= */
  const pal = $("#pal"),
    pin2 = $("#pin-input"),
    pl = $("#plist");
  const CMD = [
    ["work", "#work"],
    ["about", "#about"],
    ["contact", "#contact"],
    ["case study · citecamp", "/work/citecamp/"],
    ["case study · johns fitness", "/work/johns-fitness/"],
    ["case study · june", "/work/june/"],
    ["june docs", "https://docs.june.4ofl.dev"],
    ["github", "https://github.com/4ofl"],
    ["linkedin", "https://linkedin.com/in/abyperhaps"],
    ["discord", "https://discord.com/users/1310480351008657420"],
    ["copy email", () => copyBtn.click()],
  ];
  let sel = 0,
    list = CMD,
    lastFocus = null;
  function paint() {
    pl.innerHTML = "";
    list.forEach(([n, t], i) => {
      const li = document.createElement("li");
      li.id = "p-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === sel ? "true" : "false");
      li.className = i === sel ? "on" : "";
      const tag = typeof t === "function" ? "action" : t[0] === "#" ? "jump" : t[0] === "/" ? "page" : "open ↗";
      li.textContent = n;
      const sp = document.createElement("span");
      sp.textContent = tag;
      li.append(sp);
      li.onclick = () => go(i);
      pl.append(li);
    });
    if (list.length && list[sel]) {
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
    const t = list[i] && list[i][1];
    if (!t) return;
    shut();
    if (typeof t === "function") t();
    else if (t[0] === "#") {
      if (F.lenis) F.lenis.scrollTo(t, { duration: 1.15 });
      else $(t).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      history.pushState(null, "", t);
    } else if (t[0] === "/") location.href = t;
    else open(t, "_blank", "noopener");
  }
  function openP() {
    lastFocus = document.activeElement;
    pal.hidden = false;
    pin2.setAttribute("aria-expanded", "true");
    pin2.value = "";
    list = CMD;
    sel = 0;
    paint();
    pin2.focus();
    F.lenis && F.lenis.stop();
  }
  function shut() {
    pal.hidden = true;
    pin2.setAttribute("aria-expanded", "false");
    pin2.removeAttribute("aria-activedescendant");
    F.lenis && F.lenis.start();
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  $("#kBtn").onclick = openP;
  pal.onclick = (e) => {
    if (e.target === pal) shut();
  };
  pin2.oninput = () => {
    const v = pin2.value.toLowerCase();
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
    if (pal.hidden || !list.length) return;
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

  /* =========================================================
     nav scroll-spy
     ========================================================= */
  const navLinks = $$("nav.desktop-nav a[href^='#']");
  const spySections = ["work", "about", "contact"].map((id) => document.getElementById(id)).filter(Boolean);
  if ("IntersectionObserver" in window && spySections.length) {
    const spy = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting)
            navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id));
        }),
      { rootMargin: "-20% 0px -55% 0px" },
    );
    spySections.forEach((s) => spy.observe(s));
    F.onScroll((y) => {
      if (y < 250) navLinks.forEach((a) => a.classList.remove("active"));
    });
  }
})();
