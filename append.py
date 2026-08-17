with open('app.js', 'a', encoding='utf-8') as f:
    f.write('''\n
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
''')
