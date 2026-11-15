// Character-level LSTM (4 layers x 512 hidden, residual + LayerNorm), inference only.
// Weights: int8 per-column-quantised kernels exported from the trained Flax checkpoint.
(function (root) {
  const CHARS = "abcdefghijklmnopqrstuvwxyz ";
  const V = 27, H = 512, L = 4, G = 4 * H, D = 1024;

  function parse(buf) {
    let off = 0;
    const f32 = (n) => { const a = new Float32Array(buf, off, n); off += n * 4; return a; };
    const i8 = (n) => { const a = new Int8Array(buf, off, n); off += n; return a; };
    const m = { emb: f32(V * H), layers: [] };
    for (let l = 0; l < L; l++) {
      const Wx = i8(H * G), sx = f32(G), Wh = i8(H * G), sh = f32(G), b = f32(G), lns = f32(H), lnb = f32(H);
      m.layers.push({ Wx, sx, Wh, sh, b, lns, lnb });
    }
    m.W0 = i8(H * D); m.s0 = f32(D); m.b0 = f32(D); m.W1 = f32(D * V); m.b1 = f32(V);
    return m;
  }

  // y[j] = scale[j] * sum_i x[i] * W[i, j]   (W row-major, in x out)
  function matvecQ(x, W, scale, nIn, nOut, y) {
    y.fill(0);
    for (let i = 0; i < nIn; i++) {
      const xi = x[i]; if (xi === 0) continue;
      const row = i * nOut;
      for (let j = 0; j < nOut; j++) y[j] += xi * W[row + j];
    }
    for (let j = 0; j < nOut; j++) y[j] *= scale[j];
  }
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const gelu = (x) => 0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x * x * x)));

  class CharLSTM {
    constructor(buf) {
      this.m = parse(buf);
      this.gx = new Float32Array(G); this.gh = new Float32Array(G);
      this.d0 = new Float32Array(D);
    }
    zeroState() {
      const s = [];
      for (let l = 0; l < L; l++) s.push({ h: new Float32Array(H), c: new Float32Array(H) });
      return s;
    }
    cloneState(s) { return s.map((x) => ({ h: x.h.slice(), c: x.c.slice() })); }

    // Advance the state by one character; returns logits (Float32Array of 27).
    step(state, ch) {
      const m = this.m;
      let x = m.emb.slice(ch * H, ch * H + H);
      for (let l = 0; l < L; l++) {
        const P = m.layers[l], st = state[l];
        matvecQ(x, P.Wx, P.sx, H, G, this.gx);
        matvecQ(st.h, P.Wh, P.sh, H, G, this.gh);
        const y = new Float32Array(H);
        for (let k = 0; k < H; k++) {
          const i = sig(this.gx[k] + this.gh[k] + P.b[k]);
          const f = sig(this.gx[H + k] + this.gh[H + k] + P.b[H + k]);
          const g = Math.tanh(this.gx[2 * H + k] + this.gh[2 * H + k] + P.b[2 * H + k]);
          const o = sig(this.gx[3 * H + k] + this.gh[3 * H + k] + P.b[3 * H + k]);
          const c = f * st.c[k] + i * g;
          st.c[k] = c; st.h[k] = o * Math.tanh(c);
          y[k] = st.h[k] + (l > 0 ? x[k] : 0);
        }
        // LayerNorm (eps 1e-6, as in Flax)
        let mu = 0; for (let k = 0; k < H; k++) mu += y[k]; mu /= H;
        let v = 0; for (let k = 0; k < H; k++) v += (y[k] - mu) ** 2; v /= H;
        const inv = 1 / Math.sqrt(v + 1e-6);
        for (let k = 0; k < H; k++) y[k] = (y[k] - mu) * inv * P.lns[k] + P.lnb[k];
        x = y;
      }
      matvecQ(x, m.W0, m.s0, H, D, this.d0);
      for (let j = 0; j < D; j++) this.d0[j] = gelu(this.d0[j] + m.b0[j]);
      const out = m.b1.slice();
      for (let i = 0; i < D; i++) { const di = this.d0[i]; const row = i * V; for (let j = 0; j < V; j++) out[j] += di * m.W1[row + j]; }
      return out;
    }
  }
  function softmax(logits, temp = 1) {
    let mx = -Infinity; for (const z of logits) mx = Math.max(mx, z / temp);
    const p = Array.from(logits, (z) => Math.exp(z / temp - mx)); const s = p.reduce((a, b) => a + b, 0);
    return p.map((x) => x / s);
  }
  const api = { CharLSTM, softmax, CHARS };
  if (typeof module !== "undefined") module.exports = api; else root.CharLSTMLib = api;
})(this);
