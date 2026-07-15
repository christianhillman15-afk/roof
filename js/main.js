/* ============================================================
   Vertical Solutions Roofing — page interactions
   ============================================================ */
(function () {
  "use strict";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ----- nav backdrop after leaving the very top -----
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 30);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ----- reveal-on-scroll -----
  const revealIO = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); revealIO.unobserve(e.target); }
    }),
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => revealIO.observe(el));

  // ----- animated counters (supports prefix, suffix, decimals) -----
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      counterIO.unobserve(e.target);
      const el = e.target;
      const end = +el.dataset.count;
      const decimals = +(el.dataset.decimals || 0);
      const prefix = el.dataset.prefix || "";
      const suffix = el.dataset.suffix || "";
      const t0 = performance.now(), dur = 1400;
      (function step(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        const v = end * easeOut(t);
        const shown = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US");
        el.textContent = prefix + shown + (t === 1 ? suffix : "");
        if (t < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll("[data-count]").forEach((el) => counterIO.observe(el));

  // ----- before / after slider (reuses the hero scene renderer) -----
  const slider = document.getElementById("baSlider");
  const beforeWrap = document.getElementById("baBeforeWrap");
  const handle = document.getElementById("baHandle");
  const cvBefore = document.getElementById("baBefore");
  const cvAfter = document.getElementById("baAfter");

  if (slider && window.VERTICAL_RENDER) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // "before" shows the roof right after the storm: damaged, sky cleared
    const damagedP = window.VERTICAL_DAMAGED_P || 0.23;

    function paint() {
      const rect = slider.getBoundingClientRect();
      if (!rect.width) return;
      [cvBefore, cvAfter].forEach((cv) => {
        cv.width = Math.round(rect.width * dpr);
        cv.height = Math.round(rect.height * dpr);
        cv.style.width = rect.width + "px";
        cv.style.height = rect.height + "px";
        const c = cv.getContext("2d");
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        window.VERTICAL_RENDER(c, rect.width, rect.height, cv === cvBefore ? damagedP : 1, 0, { zoom: false });
      });
    }

    let pct = 50;
    function setPct(v) {
      pct = clamp(v, 2, 98);
      beforeWrap.style.width = pct + "%";
      handle.style.left = pct + "%";
      slider.setAttribute("aria-valuenow", Math.round(pct));
    }

    function fromEvent(ev) {
      const rect = slider.getBoundingClientRect();
      setPct(((ev.clientX - rect.left) / rect.width) * 100);
    }

    slider.addEventListener("pointerdown", (ev) => {
      slider.setPointerCapture(ev.pointerId);
      fromEvent(ev);
      const move = (e) => fromEvent(e);
      const up = () => {
        slider.removeEventListener("pointermove", move);
        slider.removeEventListener("pointerup", up);
        slider.removeEventListener("pointercancel", up);
      };
      slider.addEventListener("pointermove", move);
      slider.addEventListener("pointerup", up);
      slider.addEventListener("pointercancel", up);
    });
    slider.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft") { setPct(pct - 4); ev.preventDefault(); }
      if (ev.key === "ArrowRight") { setPct(pct + 4); ev.preventDefault(); }
    });

    const paintIO = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { paint(); paintIO.disconnect(); }
    }, { threshold: 0.05 });
    paintIO.observe(slider);
    window.addEventListener("resize", paint, { passive: true });
    setPct(50);
  }

  // ----- inspection form → opens a pre-filled email -----
  const form = document.getElementById("estimateForm");
  if (form) {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const v = (id) => (document.getElementById(id).value || "").trim();
      const subject = encodeURIComponent(`Free inspection request — ${v("fService") || "Roofing"} (${v("fCity") || ""})`);
      const body = encodeURIComponent(
        `Name: ${v("fName")}\nPhone: ${v("fPhone")}\nCity: ${v("fCity")}\nService: ${v("fService")}\n\nDetails:\n${v("fMsg")}\n\n— sent from verticalsolutionsroofing.com`
      );
      window.location.href = `mailto:info@verticalsolutionsroofing.com?subject=${subject}&body=${body}`;
    });
  }

  // ----- footer year -----
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
