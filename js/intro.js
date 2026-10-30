/* 4ofl.dev: intro state pre-check. Runs synchronously in <head> to prevent FOUC */
try {
  if (
    !sessionStorage.getItem("intro") &&
    !matchMedia("(prefers-reduced-motion:reduce)").matches &&
    !location.hash
  ) {
    document.documentElement.classList.add("intro");
    setTimeout(function () {
      document.documentElement.classList.remove("intro");
    }, 5000);
  }
} catch (e) {}

