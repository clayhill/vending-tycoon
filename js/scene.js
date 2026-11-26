/* The vaporwave backdrop: a dithered dusk sky with stars, a striped sun
 * sinking behind wireframe-pink mountains, a neon grid rolling towards the
 * viewer and palm silhouettes. Drawn at low resolution, scaled up crisp. */
(function (VT) {
  'use strict';

  const SKY = VT.stops([[0, '#06011a'], [0.32, '#1a0644'], [0.6, '#4d1180'], [0.84, '#b02f8f'], [1, '#ff6f91']]);
  const SUN = VT.stops([[0, '#fffb96'], [0.38, '#ffc46b'], [0.68, '#ff71ce'], [1, '#ff2a6d']]);
  const FLOOR = VT.stops([[0, '#3a0b5e'], [0.12, '#180536'], [1, '#05010d']]);
  const FAR = VT.stops([[0, '#6a2a9a'], [1, '#2a0a50']]);
  const NEAR = VT.stops([[0, '#2c0b52'], [1, '#12042a']]);
  const C = {
    halo: VT.rgb('#ff4fa3'), ridgeFar: VT.rgb('#ff71ce'), ridgeNear: VT.rgb('#01cdfe'),
    grid: VT.rgb('#ff2a6d'), gridV: VT.rgb('#ff4fd8'), horizon: VT.rgb('#ffb3e6'),
    star: VT.rgb('#ffffff'), starB: VT.rgb('#9be9ff'), palm: VT.rgb('#0a0118'), palmRim: VT.rgb('#3b0d5c'),
  };

  // Low-poly ridges from summed triangle waves.
  const tri = u => 1 - Math.abs((((u % 2) + 2) % 2) - 1);
  function ridge(rnd) {
    const oct = [0, 1, 2, 3].map(o => ({ f: (0.012 + rnd() * 0.01) * (1 << o), p: rnd() * 10, a: 1 / (1 << o) }));
    return x => oct.reduce((s, o) => s + o.a * tri(x * o.f + o.p), 0) / 1.875;
  }

  // A palm tree as a list of pixels: a curved, ringed trunk and drooping fronds.
  function palm(put, bx, by, h, lean) {
    let tx = bx, ty = by;
    for (let i = 0; i <= h; i++) {
      const t = i / h, x = Math.round(bx + lean * t * t * h * 0.45), y = by - i;
      const w = t < 0.35 ? 4 : 3;
      for (let j = 0; j < w; j++) put(x + j, y, i % 4 === 0 && j === 0 ? C.palmRim : C.palm);
      tx = x + 1; ty = y;
    }
    const len = h * 0.34;
    for (const a of [0.15, 0.55, 1.05, 1.5, 2.0, 2.55, 2.95]) {
      const L = len * (a > 1 && a < 2.2 ? 0.72 : 1);
      for (let s = 0; s < L; s += 0.5) {
        const x = Math.round(tx + Math.cos(a) * s), y = Math.round(ty - Math.sin(a) * s * 0.75 + (s * s) / L * 0.6);
        const th = s < L * 0.5 ? 2 : 1;
        for (let k = 0; k < th; k++) put(x, y + k, C.palm);
        if ((s | 0) % 2 === 0 && s > 2) {
          const drop = Math.max(1, Math.round(3 * (1 - s / L)) + 1);
          for (let k = 1; k <= drop; k++) put(x + (Math.cos(a) > 0 ? k >> 1 : -(k >> 1)), y + th + k - 1, C.palm);
        }
      }
    }
    for (const [dx, dy] of [[-1, 1], [1, 2], [0, 3]]) put(tx + dx, ty + dy, C.palmRim);
  }

  VT.scene = function (canvas, opt = {}) {
    const fb = new VT.FB(canvas);
    let W, H, hz, cx, sunR, sunY, back, front, ridgeTop, stars, palms;

    function build() {
      const S = Math.max(2, Math.round(innerHeight / 270));
      W = Math.max(16, Math.ceil(innerWidth / S)); H = Math.max(16, Math.ceil(innerHeight / S));
      fb.resize(W, H);
      canvas.style.width = W * S + 'px'; canvas.style.height = H * S + 'px';
      hz = Math.round(H * (opt.horizon || 0.64)); cx = W >> 1;
      sunR = Math.round(Math.min(H * 0.26, W * 0.24)); sunY = hz - Math.round(sunR * 0.3);
      const rnd = VT.rng(1987);

      back = new Uint32Array(W * H);
      for (let y = 0; y < hz; y++) for (let x = 0; x < W; x++) back[y * W + x] = VT.ramp(SKY, y / (hz - 1), x, y, 5);
      // a dithered halo around the sun
      const R = sunR + 18;
      for (let y = Math.max(0, sunY - R); y < hz; y++) for (let x = Math.max(0, cx - R); x < Math.min(W, cx + R); x++) {
        const d = Math.hypot(x - cx, y - sunY);
        if (d <= sunR || d >= R) continue;
        const a = Math.floor((1 - (d - sunR) / 18) * 4 + VT.bayer(x, y)) / 4 * 0.42;
        back[y * W + x] = VT.mix(back[y * W + x], C.halo, a);
      }

      stars = [];
      const n = Math.round((W * hz) / 700);
      for (let i = 0; i < n; i++) stars.push({ x: (rnd() * W) | 0, y: (rnd() * hz * 0.72) | 0, p: rnd() * 6.3, big: rnd() < 0.08, c: rnd() < 0.3 ? C.starB : C.star });

      front = new Uint32Array(W * H);
      ridgeTop = hz;
      const layers = [[ridge(rnd), H * 0.2, FAR, C.ridgeFar], [ridge(rnd), H * 0.11, NEAR, C.ridgeNear]];
      for (const [f, amp, ramp, edge] of layers) for (let x = 0; x < W; x++) {
        const e = Math.min(1, Math.abs(x - cx) / (W * 0.32));
        const h = Math.round(amp * (0.15 + 0.85 * e) * (0.35 + 0.65 * f(x)));
        const top = hz - h;
        ridgeTop = Math.min(ridgeTop, top);
        for (let y = top; y < hz; y++) front[y * W + x] = y === top ? VT.mix(edge, ramp[0][1], 0.35) : VT.ramp(ramp, (y - top) / Math.max(1, h), x, y, 3);
      }
      for (let y = hz; y < H; y++) for (let x = 0; x < W; x++) front[y * W + x] = VT.ramp(FLOOR, (y - hz) / (H - hz), x, y, 4);

      const list = [];
      const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) list.push(y * W + x, c); };
      const ph = H * 0.62;
      palm(put, Math.round(W * 0.05), H + 4, Math.round(ph), 0.5);
      palm(put, Math.round(W * 0.15), H + 4, Math.round(ph * 0.62), 0.35);
      palm(put, Math.round(W * 0.93), H + 4, Math.round(ph * 0.85), -0.5);
      palms = new Uint32Array(list);
    }

    const skip = new Uint8Array(4096);
    function draw(t) {
      const d = fb.d;
      d.set(back);
      for (const s of stars) {
        const b = Math.sin(t * 1.7 + s.p * 3);
        if (b < -0.55) continue;
        const i = s.y * W + s.x;
        d[i] = VT.mix(d[i], s.c, 0.45 + 0.55 * Math.max(0, b));
        if (s.big && b > 0.6) for (const o of [-1, 1, -W, W]) d[i + o] = VT.mix(d[i + o], s.c, 0.5);
      }

      // the sun, its lower half cut by stripes that drift downwards
      const start = Math.round(sunY - sunR * 0.12);
      skip.fill(0, 0, H);
      const phase = (t * 0.35) % 1;
      for (let j = -1; j < 8; j++) {
        const u = (j + phase) / 7;
        if (u < 0) continue;
        const ys = Math.round(start + (hz - start) * u), th = Math.round(1 + u * 5);
        for (let k = 0; k < th; k++) if (ys + k < H && ys + k >= start) skip[ys + k] = 1;
      }
      for (let y = Math.max(0, sunY - sunR); y < hz; y++) {
        if (skip[y]) continue;
        const dy = y - sunY, hw = Math.sqrt(Math.max(0, sunR * sunR - dy * dy)) | 0, tt = (y - (sunY - sunR)) / (2 * sunR);
        for (let x = Math.max(0, cx - hw); x <= Math.min(W - 1, cx + hw); x++) d[y * W + x] = VT.ramp(SUN, tt, x, y, 4);
      }

      for (let y = ridgeTop; y < hz; y++) for (let x = 0, i = y * W; x < W; x++, i++) if (front[i]) d[i] = front[i];
      d.set(front.subarray(hz * W), hz * W);

      // the grid: rows rush towards the viewer, columns fan out from the sun
      const K = H - hz, sp = Math.max(10, Math.round(W / 15)), fade = y => Math.min(1, ((y - hz) / K) * 2.4 + 0.12);
      const ph = (t * 0.8) % 1;
      for (let i = 0; i < 80; i++) {
        const z = 1 + i - ph;
        if (z <= 0) continue;
        const y = hz + Math.round(K / z);
        if (y >= H) continue;
        if (K / z - K / (z + 1) < 1.6) break;
        const a = fade(y);
        for (let x = 0, r = y * W; x < W; x++) d[r + x] = VT.mix(d[r + x], C.grid, a);
        if (a > 0.5) for (let x = 0, r = (y + 1) * W; x < W && y + 1 < H; x++) d[r + x] = VT.mix(d[r + x], C.grid, (a - 0.5) * 0.6);
      }
      for (let k = -70; k <= 70; k++) {
        let px = cx;
        for (let y = hz + 1; y < H; y++) {
          const x = Math.round(cx + (k * sp * 2.6 * (y - hz)) / K);
          const lo = Math.max(0, Math.min(px, x)), hi = Math.min(W - 1, Math.max(px, x));
          const a = fade(y) * 0.85;
          for (let xx = lo; xx <= hi; xx++) d[y * W + xx] = VT.mix(d[y * W + xx], C.gridV, a);
          px = x;
          if ((k < 0 && x < 0) || (k > 0 && x >= W)) break;
        }
      }
      d.fill(C.horizon, hz * W, hz * W + W);

      for (let i = 0; i < palms.length; i += 2) d[palms[i]] = palms[i + 1];
      fb.flush();
    }

    build();
    let pending = 0;
    addEventListener('resize', () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { build(); if (VT.reduced) draw(0); }); });
    return { draw };
  };
})(window.VT);
