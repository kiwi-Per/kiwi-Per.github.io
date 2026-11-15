// Small interactive pieces used on the homepage and project pages. No dependencies.
(function (root) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, a = {}, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const h = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.innerHTML = html; return e; };
  const calm = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ------------------------------------------------------------------
     Maze: a simplified version of the strategy in Shannon's Theseus.
     Each square keeps one "relay": the direction the mouse last left by.
     Exploring: leave by the next open direction clockwise from the relay.
     When the goal is reached, the relays already form a route to it.
  ------------------------------------------------------------------ */
  function maze(host, statusEl) {
    const N = 5, S = 60, M = 8, W = N * S + 2 * M, DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
    let seed = 11; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let hw, vw, relay, pos, angle = 90, timer = null, steps = 0, mem = 0, trail = [], phase = "idle";
    const start = { r: 0, c: 0 }; let goal = { r: 4, c: 4 };
    const inb = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
    const wall = (r, c, d) => d === 0 ? (r === 0 || hw[r - 1][c]) : d === 2 ? (r === N - 1 || hw[r][c]) : d === 1 ? (c === N - 1 || vw[r][c]) : (c === 0 || vw[r][c - 1]);
    const setWall = (r, c, d, v) => { if (d === 0) hw[r - 1][c] = v; else if (d === 2) hw[r][c] = v; else if (d === 1) vw[r][c] = v; else vw[r][c - 1] = v; };
    function generate() {
      hw = Array.from({ length: N - 1 }, () => Array(N).fill(true)); vw = Array.from({ length: N }, () => Array(N - 1).fill(true));
      const seen = Array.from({ length: N }, () => Array(N).fill(false)), st = [[0, 0]]; seen[0][0] = true;
      while (st.length) {
        const [r, c] = st[st.length - 1], o = [];
        for (let d = 0; d < 4; d++) { const nr = r + DR[d], nc = c + DC[d]; if (inb(nr, nc) && !seen[nr][nc]) o.push([d, nr, nc]); }
        if (!o.length) { st.pop(); continue; }
        const [d, nr, nc] = o[Math.floor(rnd() * o.length)]; setWall(r, c, d, false); seen[nr][nc] = true; st.push([nr, nc]);
      }
      for (let k = 0; k < 3; k++) { if (rnd() < 0.5) hw[Math.floor(rnd() * (N - 1))][Math.floor(rnd() * N)] = false; else vw[Math.floor(rnd() * N)][Math.floor(rnd() * (N - 1))] = false; }
    }
    // ---- drawing
    host.classList.add("maze");
    const svg = el("svg", { viewBox: `0 0 ${W} ${W}`, role: "img", "aria-label": "A five by five maze with a mouse that learns the route to the goal" }, host);
    el("rect", { x: M, y: M, width: N * S, height: N * S, class: "floor" }, svg);
    const cx = (c) => M + c * S + S / 2, cy = (r) => M + r * S + S / 2;
    const cells = [], relays = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const rect = el("rect", { x: M + c * S, y: M + r * S, width: S, height: S, class: "cell" }, svg);
      rect.addEventListener("click", () => { if (r === start.r && c === start.c) return; goal = { r, c }; restart(); });
      cells.push(rect);
    }
    const trailEl = el("polyline", { class: "trail", points: "" }, svg);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) relays.push(el("path", { d: "M0,-9 L6,3 L0,0 L-6,3 Z", class: "relay", visibility: "hidden" }, svg));
    const goalRing = el("circle", { r: 15, class: "goal-ring" }, svg), goalEl = el("circle", { r: 9, class: "goal" }, svg);
    const walls = [];
    const addWall = (x1, y1, x2, y2, get, set) => {
      const hit = el("line", { x1, y1, x2, y2, class: "hit" }, svg), line = el("line", { x1, y1, x2, y2, class: "wall" }, svg);
      hit.addEventListener("click", () => { set(!get()); restart(); });
      walls.push({ line, get });
    };
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) addWall(M + c * S + 4, M + (r + 1) * S, M + (c + 1) * S - 4, M + (r + 1) * S, () => hw[r][c], (v) => (hw[r][c] = v));
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) addWall(M + (c + 1) * S, M + r * S + 4, M + (c + 1) * S, M + (r + 1) * S - 4, () => vw[r][c], (v) => (vw[r][c] = v));
    el("rect", { x: M, y: M, width: N * S, height: N * S, rx: 3, class: "border" }, svg);
    const mouse = el("g", { class: "mouse" }, svg);
    el("path", { d: "M0,14 q-7,8 2,14", class: "m-tail" }, mouse);
    el("ellipse", { cx: 0, cy: 2, rx: 10, ry: 14, class: "m-body" }, mouse);
    el("circle", { cx: -8, cy: -6, r: 5, class: "m-ear" }, mouse); el("circle", { cx: 8, cy: -6, r: 5, class: "m-ear" }, mouse);
    el("circle", { cx: -3.5, cy: -8, r: 1.4, class: "m-eye" }, mouse); el("circle", { cx: 3.5, cy: -8, r: 1.4, class: "m-eye" }, mouse);

    function draw(jump) {
      walls.forEach((w) => w.line.classList.toggle("off", !w.get()));
      const onPath = new Set(trail.map((p) => p.r * N + p.c));
      relays.forEach((p, i) => {
        const r = Math.floor(i / N), c = i % N, d = relay[r][c];
        if (d == null || (r === goal.r && c === goal.c)) { p.setAttribute("visibility", "hidden"); return; }
        p.setAttribute("visibility", "visible"); p.setAttribute("transform", `translate(${cx(c)},${cy(r)}) rotate(${d * 90})`);
        p.classList.toggle("path", (phase === "memory" || phase === "done") && onPath.has(i));
      });
      goalEl.setAttribute("cx", cx(goal.c)); goalEl.setAttribute("cy", cy(goal.r)); goalRing.setAttribute("cx", cx(goal.c)); goalRing.setAttribute("cy", cy(goal.r));
      trailEl.setAttribute("points", trail.map((p) => `${cx(p.c)},${cy(p.r)}`).join(" "));
      mouse.classList.toggle("jump", !!jump);
      mouse.style.transform = `translate(${cx(pos.c)}px, ${cy(pos.r)}px) rotate(${angle}deg)`;
      say();
    }
    function say() {
      if (!statusEl) return;
      statusEl.innerHTML = phase === "explore" ? `Exploring. <b>${steps}</b> moves so far.`
        : phase === "blocked" ? "The mouse cannot reach the goal. Click a wall to open a way in."
        : phase === "memory" ? `First run took <b>${steps}</b> moves. Now running from memory: <b>${mem}</b>.`
        : phase === "done" ? `First run: <b>${steps}</b> moves. From memory: <b>${mem}</b> moves.` : "";
    }
    const turnTo = (d) => { let delta = ((d * 90 - angle) % 360 + 540) % 360 - 180; angle += delta; };
    function stepExplore() {
      if (pos.r === goal.r && pos.c === goal.c) return false;
      if (steps >= 700) { phase = "blocked"; return false; }
      const cur = relay[pos.r][pos.c], d0 = cur == null ? 1 : (cur + 1) % 4;
      for (let k = 0; k < 4; k++) {
        const d = (d0 + k) % 4;
        if (!wall(pos.r, pos.c, d)) { relay[pos.r][pos.c] = d; pos = { r: pos.r + DR[d], c: pos.c + DC[d] }; turnTo(d); steps++; return true; }
      }
      phase = "blocked"; return false;
    }
    function stepMemory() {
      if (pos.r === goal.r && pos.c === goal.c) { phase = "done"; return false; }
      const d = relay[pos.r][pos.c]; pos = { r: pos.r + DR[d], c: pos.c + DC[d] }; turnTo(d); mem++; trail.push(pos); return true;
    }
    function toMemory() { phase = "memory"; pos = { ...start }; mem = 0; trail = [pos]; angle = 90; draw(true); }
    function restart() {
      clearTimeout(timer);
      relay = Array.from({ length: N }, () => Array(N).fill(null)); pos = { ...start }; steps = 0; mem = 0; trail = []; angle = 90; phase = "explore";
      if (calm()) { while (stepExplore()); if (phase !== "blocked") { toMemory(); while (stepMemory()); } draw(true); return; }
      draw(true);
      const loopE = () => { if (stepExplore()) { draw(); timer = setTimeout(loopE, 95); } else if (phase === "blocked") draw(); else { draw(); timer = setTimeout(() => { toMemory(); timer = setTimeout(loopM, 450); }, 600); } };
      const loopM = () => { const moved = stepMemory(); draw(); if (moved) timer = setTimeout(loopM, 230); };
      timer = setTimeout(loopE, 500);
    }
    generate(); restart();
    return { again: restart, shuffle() { generate(); goal = { r: 4, c: 4 }; restart(); } };
  }

  /* ------------------------------------------------------------------
     Leak simulator: the data loader settings from the traffic-sign notebook.
     9,200 photos, batches of 256, a shuffle buffer of 8 batches that is
     re-drawn every epoch, first 25 batches train, next 8 validate, rest test.
  ------------------------------------------------------------------ */
  function leakSim(host) {
    const n = 9200, bs = 256, buf = bs * 8, trainN = 25 * bs, valN = 8 * bs;
    const pass = () => { const o = new Uint16Array(n), q = []; let nx = 0, k = 0; for (; nx < buf; nx++) q.push(nx); while (q.length) { const i = (Math.random() * q.length) | 0; o[k++] = q[i]; if (nx < n) q[i] = nx++; else { q[i] = q[q.length - 1]; q.pop(); } } return o; };
    let test, seen, epochs, timer = null;
    host.innerHTML = "";
    const top = h("div", { class: "leak-top" }, '<div class="leak-pct" aria-live="polite">0%</div><div class="leak-cap"></div>');
    const grid = h("div", { class: "leak-grid", role: "img", "aria-label": "Each square is one of the 752 test photos" });
    const key = h("div", { class: "leak-key" }, '<span><i style="background:var(--s2)"></i>already used for training</span><span><i style="background:var(--seq-0);outline:1px solid var(--line)"></i>never used for training</span>');
    const ctl = h("div", { class: "controls" });
    const b1 = h("button", { class: "btn sm primary", type: "button" }, "Train 1 more epoch"), b20 = h("button", { class: "btn sm", type: "button" }, "Train 20 epochs"), b0 = h("button", { class: "btn sm", type: "button" }, "Start over");
    ctl.append(b1, b20, b0); host.append(top, grid, key, ctl);
    const pct = top.querySelector(".leak-pct"), cap = top.querySelector(".leak-cap");
    const cellsEl = [];
    function paint() {
      let s = 0; for (let i = 0; i < test.length; i++) { const on = seen[test[i]] === 1; s += on; cellsEl[i].className = on ? "on" : ""; }
      pct.textContent = Math.round(s / test.length * 100) + "%";
      cap.innerHTML = `of the <b>${test.length}</b> test photos have already been used for training, after <b>${epochs}</b> epoch${epochs === 1 ? "" : "s"}.`;
    }
    function epoch() { const o = pass(); for (let i = 0; i < trainN; i++) seen[o[i]] = 1; epochs++; }
    function reset(first) {
      clearInterval(timer); test = pass().slice(trainN + valN); seen = new Uint8Array(n); epochs = 0;
      if (!cellsEl.length) for (let i = 0; i < test.length; i++) { const c = document.createElement("i"); grid.appendChild(c); cellsEl.push(c); }
      if (first) epoch();
      paint();
    }
    b1.onclick = () => { clearInterval(timer); epoch(); paint(); };
    b20.onclick = () => { clearInterval(timer); if (calm()) { for (let i = 0; i < 20; i++) epoch(); paint(); return; } let k = 0; timer = setInterval(() => { epoch(); paint(); if (++k >= 20) clearInterval(timer); }, 110); };
    b0.onclick = () => reset(false);
    reset(true);
  }

  /* ------------------------------------------------------------------
     Sheppard's formula: P(signs agree) = 1/2 + arcsin(rho) / pi
  ------------------------------------------------------------------ */
  function sheppard(host, found) {
    const acc = (r) => 0.5 + Math.asin(r) / Math.PI;
    host.innerHTML = "";
    const lab = h("label", { class: "slider", style: "display:flex;gap:12px" }, 'Correlation <input type="range" id="shep-rho" min="0" max="0.6" step="0.005" value="' + found + '" style="flex:1"><output for="shep-rho"></output>');
    const fig = h("div", { class: "chart" }), out = h("div", { class: "shep-out" }, "<div><b></b><span>direction calls correct</span></div><div><b></b><span>of the return explained</span></div><div><b></b><span>times the correlation I found</span></div>");
    host.append(lab, fig, out);
    const rho = lab.querySelector("input"), o = lab.querySelector("output"), nums = out.querySelectorAll("b");
    const draw = () => {
      const r = +rho.value, W = Math.max(280, fig.clientWidth || 520), H = 190, m = { t: 14, r: 12, b: 34, l: 42 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      const sx = (v) => m.l + v / 0.6 * iw, sy = (v) => m.t + ih - (v - 0.5) / 0.22 * ih;
      fig.innerHTML = ""; const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Accuracy against correlation" }, fig);
      for (const v of [0.5, 0.6, 0.7]) { el("line", { x1: m.l, x2: m.l + iw, y1: sy(v), y2: sy(v), class: "gridline" }, svg); el("text", { x: m.l - 8, y: sy(v) + 4, "text-anchor": "end" }, svg).textContent = Math.round(v * 100) + "%"; }
      for (const v of [0, 0.2, 0.4, 0.6]) el("text", { x: sx(v), y: H - m.b + 16, "text-anchor": "middle" }, svg).textContent = v.toFixed(1);
      el("text", { x: m.l + iw / 2, y: H - 2, "text-anchor": "middle" }, svg).textContent = "Correlation between forecast and return";
      let d = ""; for (let i = 0; i <= 120; i++) { const v = i / 200; d += (i ? "L" : "M") + sx(v).toFixed(1) + "," + sy(acc(v)).toFixed(1); }
      el("path", { d, fill: "none", stroke: "var(--s1)", "stroke-width": 2.5 }, svg);
      const mark = (v, t, c, anchor) => { el("line", { x1: sx(v), x2: sx(v), y1: m.t, y2: m.t + ih, stroke: c, "stroke-dasharray": "4 3" }, svg); el("text", { x: sx(v) + (anchor === "end" ? -5 : 5), y: m.t + 10, "text-anchor": anchor || "start", style: "fill:var(--fg)" }, svg).textContent = t; };
      mark(found, "what I found", "var(--s3)"); mark(0.309, "60% needs this", "var(--s2)");
      el("circle", { cx: sx(r), cy: sy(acc(r)), r: 7, fill: "var(--s1)", stroke: "var(--card)", "stroke-width": 2.5 }, svg);
      o.textContent = r.toFixed(3); nums[0].textContent = (acc(r) * 100).toFixed(1) + "%"; nums[1].textContent = (r * r * 100).toFixed(r < 0.1 ? 2 : 1) + "%"; nums[2].textContent = (r / found).toFixed(1) + "×";
    };
    rho.addEventListener("input", draw); draw();
    let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 150); });
  }

  /* ------------------------------------------------------------------
     Surprise strip: precomputed output of the trained LSTM for a few sentences.
  ------------------------------------------------------------------ */
  function surprise(host, data) {
    host.innerHTML = "";
    const chips = h("div", { class: "chips", role: "group", "aria-label": "Sentence" }), strip = h("div", { class: "strip" });
    const scale = h("div", { class: "scale" }, 'Surprise: <i class="b0"></i>low <i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i><i class="b5"></i>high');
    const read = h("p", { class: "readout" }, "Point at a letter to see what the model expected.");
    host.append(chips, strip, scale, read);
    const show = (c) => c === " " ? "␣" : c, bucket = (b) => b < 0.5 ? 0 : b < 1 ? 1 : b < 2 ? 2 : b < 3 ? 3 : b < 5 ? 4 : 5;
    let cur = 0;
    const draw = () => {
      const d = data[cur];
      strip.innerHTML = [...d.t].map((c, i) => `<span data-i="${i}" class="${d.bits[i] == null ? "" : "b" + bucket(d.bits[i])}${c === " " ? " sp" : ""}">${c === " " ? "&nbsp;" : c}</span>`).join("");
      chips.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", i === cur));
    };
    data.forEach((d, i) => { const b = h("button", { type: "button" }, "Sentence " + (i + 1)); b.onclick = () => { cur = i; draw(); read.textContent = "Point at a letter to see what the model expected."; }; chips.appendChild(b); });
    const tell = (ev) => {
      const s = ev.target.closest("span[data-i]"); if (!s) return; const d = data[cur], i = +s.dataset.i;
      if (d.bits[i] == null) { read.textContent = "First letter: the model has nothing to go on yet."; return; }
      const top = d.top[i], hit = top[0][0] === d.t[i];
      read.innerHTML = `<b>“${show(d.t[i])}”</b> ${hit ? "was the model's first guess" : "surprised the model"} (${d.bits[i].toFixed(1)} bits). It expected ${top.map(([c, p]) => `${show(c)} ${Math.round(p * 100)}%`).join(", ")}.`;
    };
    strip.addEventListener("pointerover", tell); strip.addEventListener("click", tell);
    draw();
  }

  root.Widgets = { maze, leakSim, sheppard, surprise };
})(window);
