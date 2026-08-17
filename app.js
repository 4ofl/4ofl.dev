(() => {
      const root = document.documentElement;
      const themeColor = document.querySelector('meta[name="theme-color"]');
      const storageKey = "4ofl-theme";

      const applyTheme = (theme, persist = true) => {
        root.dataset.theme = theme;
        themeColor?.setAttribute(
          "content",
          theme === "dark" ? "#0f0f0e" : "#efede7"
        );

        if (persist) {
          try {
            localStorage.setItem(storageKey, theme);
          } catch (_) {}
        }

        document.dispatchEvent(new CustomEvent("themechange"));
      };

      const themeToggleBtn = document.getElementById("theme-toggle");
      if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
          applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
        });
      }

      try {
        const savedTheme = localStorage.getItem(storageKey);
        if (savedTheme === "dark" || savedTheme === "light") {
          applyTheme(savedTheme, false);
        }
      } catch (_) {}

      addEventListener("keydown", (event) => {
        const target = event.target;
        const isTyping =
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

        if (
          isTyping ||
          event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.key.toLowerCase() !== "d"
        ) {
          return;
        }

        applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
      });
    })();

    (() => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

      const easeOutQuart = (progress) =>
        1 - Math.pow(1 - progress, 4);

      const scrollToTarget = (target) => {
        const start = window.scrollY;
        const targetY =
          target === document.documentElement
            ? 0
            : target.getBoundingClientRect().top + window.scrollY - 24;
        const distance = targetY - start;

        if (prefersReducedMotion.matches || Math.abs(distance) < 2) {
          window.scrollTo(0, targetY);
          return;
        }

        const duration = Math.min(850, Math.max(440, Math.abs(distance) * 0.42));
        const startedAt = performance.now();

        const step = (now) => {
          const progress = Math.min(1, (now - startedAt) / duration);
          window.scrollTo(0, start + distance * easeOutQuart(progress));

          if (progress < 1) {
            requestAnimationFrame(step);
          }
        };

        requestAnimationFrame(step);
      };

      document.querySelectorAll('a[href^="#"]').forEach((link) => {
        if (link.classList.contains("skip-link")) return;

        link.addEventListener("click", (event) => {
          const selector = link.getAttribute("href");
          const target =
            selector === "#top"
              ? document.documentElement
              : document.querySelector(selector);

          if (!target) return;

          event.preventDefault();
          scrollToTarget(target);
        });
      });

      const supportsCursor =
        window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !prefersReducedMotion.matches;

      if (!supportsCursor) return;

      const canvas = document.getElementById("cursor-canvas");
      const context = canvas.getContext("2d");
      let accentColor = "#2857ff";
      let inkColor = "#121212";

      const syncCanvasColors = () => {
        const styles = getComputedStyle(document.documentElement);
        accentColor = styles.getPropertyValue("--accent").trim() || "#2857ff";
        inkColor = styles.getPropertyValue("--ink").trim() || "#121212";
      };

      syncCanvasColors();
      document.addEventListener("themechange", syncCanvasColors);

      const particles = Array.from({ length: 4 }, (_, index) => ({
        x: innerWidth / 2,
        y: innerHeight / 2,
        vx: 0,
        vy: 0,
        lag: 0.17 - index * 0.025
      }));

      const pointer = {
        x: innerWidth / 2,
        y: innerHeight / 2,
        lastMove: performance.now()
      };

      let width = 0;
      let height = 0;
      let ratio = 1;

      const resize = () => {
        ratio = Math.min(devicePixelRatio || 1, 2);
        width = innerWidth;
        height = innerHeight;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      };

      resize();
      addEventListener("resize", resize);

      addEventListener("pointermove", (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.lastMove = performance.now();
      }, { passive: true });

      const markOffsets = [
        [-8, -9],
        [-8, 0],
        [1, 0],
        [1, 10]
      ];

      const drawMark = (opacity) => {
        context.save();
        context.globalAlpha = opacity;
        context.strokeStyle = accentColor;
        context.lineWidth = 1.35;
        context.lineCap = "square";

        const p0 = particles[0];
        const p1 = particles[1];
        const p2 = particles[2];
        const p3 = particles[3];

        context.beginPath();
        context.moveTo(p0.x, p0.y);
        context.lineTo(p1.x, p1.y);
        context.lineTo(p2.x, p2.y);
        context.moveTo(p2.x, p2.y);
        context.lineTo(p3.x, p3.y);
        context.stroke();
        context.restore();
      };

      const frame = (time) => {
        context.clearRect(0, 0, width, height);

        const idle = time - pointer.lastMove > 520;
        const settle = Math.min(1, Math.max(0, (time - pointer.lastMove - 520) / 360));

        particles.forEach((particle, index) => {
          const offset = idle ? markOffsets[index] : [0, 0];
          const targetX = pointer.x + offset[0];
          const targetY = pointer.y + offset[1];

          particle.vx += (targetX - particle.x) * particle.lag;
          particle.vy += (targetY - particle.y) * particle.lag;
          particle.vx *= 0.72;
          particle.vy *= 0.72;
          particle.x += particle.vx;
          particle.y += particle.vy;

          context.fillStyle = index === 0 ? accentColor : inkColor;
          context.fillRect(
            Math.round(particle.x) - 1.5,
            Math.round(particle.y) - 1.5,
            3,
            3
          );
        });

        if (idle) {
          drawMark(settle * 0.85);
        }

        animationId = requestAnimationFrame(frame);
      };

      let animationId;
      let isVisible = true;

      document.addEventListener("visibilitychange", () => {
        isVisible = document.visibilityState === "visible";
        if (isVisible) {
          pointer.lastMove = performance.now();
          animationId = requestAnimationFrame(frame);
        } else {
          cancelAnimationFrame(animationId);
        }
      });

      animationId = requestAnimationFrame(frame);
    })();

(() => {
  const scrollTopBtn = document.getElementById("scroll-top-btn");
  if (!scrollTopBtn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      scrollTopBtn.classList.add("visible");
    } else {
      scrollTopBtn.classList.remove("visible");
    }
  }, { passive: true });
})();
