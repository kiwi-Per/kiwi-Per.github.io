// Tiny dependency-free SVG charts: line (with crosshair tooltip + legend toggles) and scatter.
(function (root) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function niceTicks(min, max, n = 5) {
    const span = max - min || 1;
    const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  function makeTip(container) {
    const tip = document.createElement("div"); tip.className = "tip"; container.appendChild(tip); return tip;
  }
  function placeTip(tip, container, x, y) {
    tip.style.display = "block";
    const cw = container.clientWidth, tw = tip.offsetWidth;
    let left = x + 14; if (left + tw > cw) left = x - tw - 14;
    tip.style.left = Math.max(0, left) + "px"; tip.style.top = Math.max(0, y - 10) + "px";
  }

  function frame(container, o) {
    container.innerHTML = ""; container.classList.add("chart");
    const W = Math.max(300, container.clientWidth || o.width || 760), H = o.height || 300, m = { t: 12, r: 16, b: 40, l: 54, ...(o.margin || {}) };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.title || "chart" }, container);
    return { svg, W, H, m, iw: W - m.l - m.r, ih: H - m.t - m.b };
  }

  function axes(f, xs, ys, o) {
    const { svg, m, iw, ih } = f;
    const g = el("g", {}, svg);
    for (const t of ys.ticks) {
      const y = m.t + ys.s(t);
      el("line", { x1: m.l, x2: m.l + iw, y1: y, y2: y, class: "gridline" }, g);
      el("text", { x: m.l - 8, y: y + 4, "text-anchor": "end" }, g).textContent = (o.yFmt || String)(t);
    }
    for (const t of xs.ticks) {
      const x = m.l + xs.s(t);
      el("text", { x, y: m.t + ih + 18, "text-anchor": "middle" }, g).textContent = (o.xFmt || String)(t);
    }
    el("line", { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, class: "axisline" }, g);
    if (o.xLabel) el("text", { x: m.l + iw / 2, y: m.t + ih + 36, "text-anchor": "middle" }, g).textContent = o.xLabel;
    if (o.yLabel) { const t = el("text", { x: 14, y: m.t + ih / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${m.t + ih / 2})` }, g); t.textContent = o.yLabel; }
  }

  function scale(min, max, size, invert, log) {
    if (log) {
      const a = Math.log10(min), b = Math.log10(max);
      return (v) => { const p = (Math.log10(v) - a) / (b - a); return invert ? size * (1 - p) : size * p; };
    }
    return (v) => { const p = (v - min) / (max - min || 1); return invert ? size * (1 - p) : size * p; };
  }

  // series: [{name, color: '--s1', points: [[x,y],...], dashed}]
  function line(container, o) {
    const visible = new Set(o.series.map((s) => s.name));
    const legend = document.createElement("div"); legend.className = "legend";
    const host = document.createElement("div");
    container.innerHTML = ""; container.append(legend, host);
    if (o.series.length > 1) {
      for (const s of o.series) {
        const b = document.createElement("button"); b.setAttribute("aria-pressed", "true");
        b.innerHTML = `<span class="sw" style="background:var(${s.color})"></span>${s.name}`;
        b.onclick = () => { visible.has(s.name) ? visible.delete(s.name) : visible.add(s.name); if (!visible.size) visible.add(s.name); b.setAttribute("aria-pressed", visible.has(s.name)); draw(); };
        legend.appendChild(b);
      }
    }
    function draw() {
      const f = frame(host, o);
      const shown = o.series.filter((s) => visible.has(s.name));
      const all = shown.flatMap((s) => s.points);
      const xmin = o.xMin ?? Math.min(...all.map((p) => p[0])), xmax = o.xMax ?? Math.max(...all.map((p) => p[0]));
      let ymin = o.yMin ?? Math.min(...all.map((p) => p[1])), ymax = o.yMax ?? Math.max(...all.map((p) => p[1]));
      const pad = (ymax - ymin) * 0.06; if (o.yMin === undefined) ymin -= pad; if (o.yMax === undefined) ymax += pad;
      const xs = { s: scale(xmin, xmax, f.iw), ticks: o.xTicks || niceTicks(xmin, xmax, 6) };
      const yt = niceTicks(ymin, ymax, 5);
      const ys = { s: scale(ymin, ymax, f.ih, true), ticks: yt.filter((t) => t >= ymin && t <= ymax) };
      axes(f, xs, ys, o);
      const g = el("g", { transform: `translate(${f.m.l},${f.m.t})` }, f.svg);
      for (const s of shown) {
        const d = s.points.map((p, i) => `${i ? "L" : "M"}${xs.s(p[0]).toFixed(1)},${ys.s(p[1]).toFixed(1)}`).join("");
        el("path", { d, fill: "none", stroke: `var(${s.color})`, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": s.dashed ? "5 4" : "none" }, g);
      }
      // crosshair + tooltip
      const tip = makeTip(host);
      const cross = el("line", { y1: 0, y2: f.ih, class: "crosshair", visibility: "hidden" }, g);
      const dots = shown.map((s) => el("circle", { r: 4, fill: `var(${s.color})`, stroke: "var(--card)", "stroke-width": 2, visibility: "hidden" }, g));
      const hit = el("rect", { x: 0, y: 0, width: f.iw, height: f.ih, fill: "transparent" }, g);
      const move = (ev) => {
        const r = f.svg.getBoundingClientRect(), k = f.W / r.width;
        const px = (ev.clientX - r.left) * k - f.m.l;
        const xv = xmin + (px / f.iw) * (xmax - xmin);
        let rows = "", cx = null;
        shown.forEach((s, i) => {
          let best = s.points[0]; for (const p of s.points) if (Math.abs(p[0] - xv) < Math.abs(best[0] - xv)) best = p;
          cx = xs.s(best[0]);
          dots[i].setAttribute("cx", cx); dots[i].setAttribute("cy", ys.s(best[1])); dots[i].setAttribute("visibility", "visible");
          rows += `<div class="row"><span class="sw" style="background:var(${s.color})"></span>${s.name}: <b>${(o.tipFmt || o.yFmt || String)(best[1])}</b></div>`;
          if (i === 0) rows = `<div class="muted">${o.xLabel || "x"}: ${(o.xFmt || String)(best[0])}</div>` + rows;
        });
        cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
        tip.innerHTML = rows;
        placeTip(tip, host, (ev.clientX - r.left), (ev.clientY - r.top));
      };
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerleave", () => { tip.style.display = "none"; cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); });
    }
    draw(); onResize(draw);
  }

  // points: [{x, y, label, color, tip, r}]
  function scatter(container, o) { const redraw = () => scatter0(container, o); redraw(); onResize(redraw, container); }
  function scatter0(container, o) {
    container.innerHTML = "";
    if (o.legend) {
      const lg = document.createElement("div"); lg.className = "legend";
      lg.innerHTML = o.legend.map((l) => `<span style="display:inline-flex;align-items:center;gap:6px"><span class="sw dot" style="background:var(${l.color})"></span>${l.name}</span>`).join("");
      container.appendChild(lg);
    }
    const host = document.createElement("div"); container.appendChild(host);
    const f = frame(host, o);
    const xs = o.xLog
      ? { s: scale(o.xMin, o.xMax, f.iw, false, true), ticks: o.xTicks }
      : { s: scale(o.xMin, o.xMax, f.iw), ticks: o.xTicks || niceTicks(o.xMin, o.xMax, 6) };
    const ys = { s: scale(o.yMin, o.yMax, f.ih, true), ticks: o.yTicks || niceTicks(o.yMin, o.yMax, 5) };
    axes(f, xs, ys, o);
    const g = el("g", { transform: `translate(${f.m.l},${f.m.t})` }, f.svg);
    if (o.path) {
      const d = o.path.points.map((p, i) => `${i ? "L" : "M"}${xs.s(p[0]).toFixed(1)},${ys.s(p[1]).toFixed(1)}`).join("");
      el("path", { d, fill: "none", stroke: `var(${o.path.color})`, "stroke-width": 2 }, g);
    }
    const tip = makeTip(host);
    for (const p of o.points) {
      const cx = xs.s(p.x), cy = ys.s(p.y);
      el("circle", { cx, cy, r: p.r || 5, fill: `var(${p.color || "--s1"})`, stroke: "var(--card)", "stroke-width": 2 }, g);
      if (p.label) {
        const anchor = cx > f.iw * 0.8 ? "end" : "start";
        el("text", { x: cx + (anchor === "end" ? -10 : 10), y: cy + (p.labelDy || 4), "text-anchor": anchor, style: "fill:var(--fg);font-size:12px" }, g).textContent = p.label;
      }
      const hit = el("circle", { cx, cy, r: 12, fill: "transparent", style: "cursor:default" }, g);
      hit.addEventListener("pointerenter", (ev) => { const r = f.svg.getBoundingClientRect(); tip.innerHTML = p.tip; placeTip(tip, host, ev.clientX - r.left, ev.clientY - r.top); });
      hit.addEventListener("pointerleave", () => (tip.style.display = "none"));
    }
  }

  const redraws = new Map(); let rt;
  function onResize(fn, key) { redraws.set(key || fn, fn); }
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => redraws.forEach((f) => f()), 150); });
  root.Charts = { line, scatter, makeTip, placeTip, cssVar };
})(window);
