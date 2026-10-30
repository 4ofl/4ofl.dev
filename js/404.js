(() => {
        "use strict";
        const $ = (s) => document.querySelector(s),
          out = $("#out"),
          inp = $("#in");
        const R = [
          ["home", "/"],
          ["work", "/#work"],
          ["about", "/#about"],
          ["contact", "/#contact"],
          ["citecamp", "https://citecamp.4ofl.dev"],
          ["june", "https://docs.june.4ofl.dev"],
          ["github", "https://github.com/4ofl"],
        ];
        const lev = (a, b) => {
          const d = Array.from({ length: a.length + 1 }, (_, i) => [
            i,
            ...Array(b.length).fill(0),
          ]);
          for (let j = 1; j <= b.length; j++) d[0][j] = j;
          for (let i = 1; i <= a.length; i++)
            for (let j = 1; j <= b.length; j++)
              d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
              );
          return d[a.length][b.length];
        };
        const line = (t, c) => {
          const d = document.createElement("div");
          d.textContent = t;
          if (c) d.className = c;
          out.append(d);
          out.scrollTop = 1e9;
          return d;
        };
        const link = (label, href) => {
          const d = document.createElement("div"),
            a = document.createElement("a");
          a.href = href;
          a.textContent = label;
          if (href[0] !== "/") {
            a.target = "_blank";
            a.rel = "noopener";
          }
          d.append("→ ", a);
          out.append(d);
          out.scrollTop = 1e9;
        };
        const go = (href) => {
          if (href[0] === "/") {
            if (document.startViewTransition) {
              document.startViewTransition(() => {
                location.href = href;
              });
            } else {
              location.href = href;
            }
          } else {
            open(href, "_blank", "noopener");
          }
        };

        const homeBtn = $("#homeBtn");
        if (homeBtn) {
          homeBtn.onclick = (e) => {
            if (document.startViewTransition) {
              e.preventDefault();
              document.startViewTransition(() => {
                location.href = "/";
              });
            }
          };
        }

        const path = location.pathname,
          seg = decodeURIComponent(path.split("/").filter(Boolean).pop() || "")
            .toLowerCase()
            .replace(/\.\w+$/, "");
        line("> GET " + path, "c");
        line("< 404 NOT_FOUND [route_unresolved]", "e");
        line("< 0 documents retrieved");
        let best = null,
          bd = 99;
        for (const r of R) {
          const d = Math.min(
            lev(seg, r[0]),
            r[0].startsWith(seg) && seg ? 0 : 99,
          );
          if (d < bd) {
            bd = d;
            best = r;
          }
        }
        if (seg && best && bd <= Math.max(2, seg.length / 2)) {
          line(`closest match: "${best[0]}" (distance ${bd})`);
          link(best[0], best[1]);
        } else {
          line("no close match. returning you home is the safest bet.");
          link("home", "/");
        }

        const cmdHistory = [];
        let histIdx = -1;
        const CMDS = [
          "help",
          "ls",
          "cd",
          "home",
          "neofetch",
          "specs",
          "whoami",
          "date",
          "clear",
        ];

        const run = (raw) => {
          const c = raw.trim();
          if (!c) return;
          line("> " + c, "c");
          if (!cmdHistory.length || cmdHistory[cmdHistory.length - 1] !== c) {
            cmdHistory.push(c);
          }
          histIdx = cmdHistory.length;
          const [cmd, ...a] = c.toLowerCase().split(/\s+/),
            arg = a.join(" ");
          if (cmd === "help")
            line(
              "help · ls · cd <route> · home · neofetch · whoami · date · clear",
            );
          else if (cmd === "ls") R.forEach((r) => line("  " + r[0]));
          else if (cmd === "cd" || cmd === "open") {
            const r =
              R.find((x) => x[0] === arg) ||
              R.map((x) => [x, lev(arg, x[0])]).sort(
                (p, q) => p[1] - q[1],
              )[0]?.[0];
            if (!arg) line("cd: where to?", "e");
            else {
              line("resolving " + r[0] + "…");
              setTimeout(() => go(r[1]), 350);
            }
          } else if (cmd === "home") {
            line("returning…");
            setTimeout(() => go("/"), 300);
          } else if (cmd === "neofetch" || cmd === "specs") {
            const pre = document.createElement("pre");
            pre.style.cssText =
              "font:inherit;margin:0.35rem 0;line-height:1.45;color:var(--bone);overflow-x:auto;";
            pre.innerHTML = `<span style="color:var(--accent);font-weight:bold;">
  ██╗  ██╗ ██████╗ ███████╗██╗     
  ██║  ██║██╔═══██╗██╔════╝██║     
  ███████║██║   ██║█████╗  ██║     
  ╚════██║██║   ██║██╔══╝  ██║     
       ██║╚██████╔╝██║     ███████╗
       ╚═╝ ╚═════╝ ╚═╝     ╚══════╝</span>

  <span style="color:var(--mist);">os:</span>      Arch Linux · Edge Runtime
  <span style="color:var(--mist);">host:</span>    Kerala, IN (Asia/Kolkata)
  <span style="color:var(--mist);">uptime:</span>  41d 6h
  <span style="color:var(--mist);">shell:</span>   4ofl-gw v1.4
  <span style="color:var(--mist);">stack:</span>   Python, C, SQLite, Docker, Node.js
  <span style="color:var(--mist);">focus:</span>   local-first, RAG pipelines, edge AI
  <span style="color:var(--mist);">status:</span>  violently opposed to legacy software`;
            out.append(pre);
            out.scrollTop = 1e9;
          } else if (cmd === "whoami")
            line(
              "a visitor on a route that doesn't exist. aby mathew built this index.",
            );
          else if (cmd === "date") line(new Date().toISOString());
          else if (cmd === "clear") out.innerHTML = "";
          else if (cmd === "sudo")
            line("nice try. this index is read-only.", "e");
          else if (cmd === "rm")
            line(
              "rm: refusing. you already found one thing that's missing.",
              "e",
            );
          else {
            const m = CMDS.map((x) => [x, lev(cmd, x)]).sort(
              (p, q) => p[1] - q[1],
            )[0];
            line(
              `${cmd}: command not found${m[1] <= 2 ? ` · did you mean "${m[0]}"?` : ""}`,
              "e",
            );
          }
        };
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            run(inp.value);
            inp.value = "";
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (cmdHistory.length && histIdx > 0) {
              histIdx--;
              inp.value = cmdHistory[histIdx];
            }
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (histIdx < cmdHistory.length - 1) {
              histIdx++;
              inp.value = cmdHistory[histIdx];
            } else {
              histIdx = cmdHistory.length;
              inp.value = "";
            }
          } else if (e.key === "Tab") {
            e.preventDefault();
            const val = inp.value.trim().toLowerCase();
            if (val.startsWith("cd ")) {
              const target = val.slice(3).trim();
              const match = R.find((r) => r[0].startsWith(target));
              if (match) inp.value = "cd " + match[0];
            } else if (val) {
              const match = CMDS.find((cmd) => cmd.startsWith(val));
              if (match) inp.value = match + (match === "cd" ? " " : "");
            }
          }
        });
        $("#chips").addEventListener("click", (e) => {
          if (e.target.tagName === "BUTTON") run(e.target.textContent);
        });
        addEventListener("keydown", (e) => {
          if (e.key === "Escape") go("/");
        });
        if (matchMedia("(pointer:fine)").matches) inp.focus();

        /* big 404 reacts to cursor + dot grid */
        const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
        const code = $("#code");
        code.innerHTML = [..."404"].map((c) => `<span>${c}</span>`).join("");
        const S = [...code.children];

        let mx = -999,
          my = -999,
          lastMx = -999,
          lastMy = -999,
          curVx = 0,
          curVy = 0;
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
        const ripples = [];

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
              dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0, val, addr });
            }
          }
        }

        const size = () => {
          D = Math.min(devicePixelRatio || 1, 2);
          W = cv.width = innerWidth * D;
          H = cv.height = innerHeight * D;
          initGrid();
        };
        size();
        addEventListener(
          "resize",
          () => {
            size();
            requestFrame();
          },
          { passive: true },
        );

        let animPending = false;
        function requestFrame() {
          if (!animPending && !reduce) {
            animPending = true;
            requestAnimationFrame(frame);
          }
        }

        function frame() {
          animPending = false;
          g.clearRect(0, 0, W, H);
          const hoverDist = 180 * D;
          const cursorRadius = 125 * D;
          const spring = 0.082;
          const damping = 0.84;
          const targetMx = mx * D;
          const targetMy = my * D;
          let hasMotion = false;

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

          // Left-edge address gutter
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

          // Memory Cells
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

          // Hover Tooltip Inspector
          if (hover) {
            const txt1 = `PTR ${hover.addr}`;
            const txt2 = `VAL 0x${hover.val} · NOT_FOUND 404`;
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
            g.strokeStyle = "rgba(255, 255, 255, 0.16)";
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
            g.fillStyle = "rgba(212, 116, 85, 0.85)";
            g.fillText(txt2, bx + 10 * D, by + 26 * D);
          }

          // 404 text font variation react
          for (let i = 0; i < S.length; i++) {
            const s = S[i];
            const r = s.getBoundingClientRect();
            const d = Math.hypot(
              mx - (r.left + r.width / 2),
              my - (r.top + r.height / 2),
            );
            const k = Math.max(0, 1 - d / 280);
            s.style.fontVariationSettings = `"wght" ${(300 + 500 * k) | 0}`;
            s.style.color = k > 0.55 ? "var(--accent)" : "";
          }

          if (hasMotion || ripples.length > 0 || Math.abs(curVx) > 0.05 || Math.abs(curVy) > 0.05) {
            requestFrame();
          }
        }

        addEventListener(
          "pointerdown",
          (e) => {
            curVx = e.clientX - (lastMx === -999 ? e.clientX : lastMx);
            curVy = e.clientY - (lastMy === -999 ? e.clientY : lastMy);
            lastMx = mx = e.clientX;
            lastMy = my = e.clientY;
            if (!reduce) {
              ripples.push({
                x: e.clientX * D,
                y: e.clientY * D,
                r: 0,
                maxR: Math.max(innerWidth, innerHeight) * 0.42 * D,
                speed: 6.2 * D,
                life: 1.0,
              });
            }
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
            requestFrame();
          },
          { passive: true },
        );
        requestFrame();
      })();
