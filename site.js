// Shared behaviour: theme switch, table of contents, reading progress, copy buttons.
(function () {
  const root = document.documentElement;
  const store = { get() { try { return localStorage.getItem("kw-theme"); } catch (e) { return null; } }, set(v) { try { localStorage.setItem("kw-theme", v); } catch (e) {} } };
  const saved = store.get();
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  const isDark = () => { const t = root.getAttribute("data-theme"); return t ? t === "dark" : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); };
  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

  document.addEventListener("DOMContentLoaded", () => {
    // theme button
    const bar = document.querySelector(".nav-in");
    if (bar) {
      const b = document.createElement("button"); b.type = "button"; b.className = "theme-btn"; b.id = "theme-btn";
      const paint = () => { b.innerHTML = isDark() ? SUN : MOON; b.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme"); b.title = b.getAttribute("aria-label"); };
      b.onclick = () => { const next = isDark() ? "light" : "dark"; root.setAttribute("data-theme", next); store.set(next); paint(); };
      paint(); bar.appendChild(b);
    }
    // copy buttons: <button data-copy="text">
    document.querySelectorAll("[data-copy]").forEach((b) => {
      const label = b.textContent;
      b.addEventListener("click", () => {
        const done = (ok) => { b.textContent = ok ? "Copied" : "Copy failed, select the address instead"; setTimeout(() => (b.textContent = label), 1800); };
        try { navigator.clipboard.writeText(b.dataset.copy).then(() => done(true), () => done(false)); } catch (e) { done(false); }
      });
    });
    // table of contents for article pages
    if (document.body.hasAttribute("data-toc")) {
      const heads = [...document.querySelectorAll("main h2")].filter((h) => !h.closest(".inshort"));
      if (heads.length > 2) {
        const nav = document.createElement("nav"); nav.className = "toc"; nav.setAttribute("aria-label", "On this page");
        const inner = document.createElement("div"); inner.className = "toc-in"; inner.innerHTML = '<span class="toc-t">On this page</span>';
        const links = heads.map((h, i) => {
          const sec = h.closest("section") || h;
          if (!sec.id) sec.id = "part-" + (i + 1);
          const a = document.createElement("a"); a.href = "#" + sec.id; a.textContent = h.dataset.short || h.textContent.replace(/\s*\(.*?\)\s*$/, "");
          a.addEventListener("click", (ev) => { ev.preventDefault(); sec.scrollIntoView({ behavior: "smooth", block: "start" }); });
          inner.appendChild(a); return { a, sec };
        });
        nav.appendChild(inner);
        const header = document.querySelector("header.nav"); header.insertAdjacentElement("afterend", nav);
        const bar = document.createElement("div"); bar.className = "progress-top"; document.body.appendChild(bar);
        let tick = false;
        const onScroll = () => {
          if (tick) return; tick = true;
          requestAnimationFrame(() => {
            tick = false;
            const max = document.documentElement.scrollHeight - innerHeight;
            bar.style.width = (max > 0 ? Math.min(100, scrollY / max * 100) : 0) + "%";
            let cur = links[0];
            for (const l of links) if (l.sec.getBoundingClientRect().top < innerHeight * 0.35) cur = l;
            links.forEach((l) => l.a.classList.toggle("on", l === cur && scrollY > 80));
          });
        };
        addEventListener("scroll", onScroll, { passive: true }); onScroll();
      }
    }
  });
})();
