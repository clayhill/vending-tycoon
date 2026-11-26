/* A 5×7 bitmap font, and logo lettering built from it: chrome or neon
 * faces with outlines, extruded depth, a halo and a moving glint. */
(function (VT) {
  'use strict';

  const SRC = {
    A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
    C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
    E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
    G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
    I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
    K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
    M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
    O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
    Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
    S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
    U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
    W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
    Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
    0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
    2: '01110 10001 00001 00010 00100 01000 11111', 3: '11111 00010 00100 00010 00001 10001 01110',
    4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
    6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
    8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
    ' ': '00000 00000 00000 00000 00000 00000 00000', '!': '00100 00100 00100 00100 00100 00000 00100',
    '?': '01110 10001 00001 00010 00100 00000 00100', '.': '00000 00000 00000 00000 00000 01100 01100',
    '-': '00000 00000 00000 11111 00000 00000 00000', ':': '00000 01100 01100 00000 01100 01100 00000',
    '$': '00100 01111 10100 01110 00101 11110 00100', '/': '00001 00010 00010 00100 01000 01000 10000',
    '<': '00010 00100 01000 10000 01000 00100 00010', '>': '01000 00100 00010 00001 00010 00100 01000',
  };
  const GLYPHS = {};
  for (const k in SRC) GLYPHS[k] = SRC[k].split(' ').map(r => parseInt(r, 2));

  VT.textWidth = (str, s = 1) => str.length * 6 * s - s;

  // Plain text into a framebuffer; col is a packed colour or fn(gx, gy) → colour.
  VT.text = function (fb, str, x0, y0, s, col) {
    let cx = x0;
    for (const ch of str.toUpperCase()) {
      const g = GLYPHS[ch] || GLYPHS['?'];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (!(g[r] & (16 >> c))) continue;
        for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
          const X = cx + c * s + dx, Y = y0 + r * s + dy;
          fb.px(X, Y, typeof col === 'function' ? col(X - x0, Y - y0) : col);
        }
      }
      cx += 6 * s;
    }
  };

  // Text as a 0/1 mask; slant shears it into italics.
  VT.mask = function (str, s, slant = 0) {
    const shear = Math.ceil(6 * s * slant), w = VT.textWidth(str, s) + shear, h = 7 * s;
    const m = new Uint8Array(w * h);
    let cx = 0;
    for (const ch of str.toUpperCase()) {
      const g = GLYPHS[ch] || GLYPHS['?'];
      for (let r = 0; r < 7; r++) for (let dy = 0; dy < s; dy++) {
        const y = r * s + dy, sh = Math.floor((h - 1 - y) * slant);
        for (let c = 0; c < 5; c++) {
          if (!(g[r] & (16 >> c))) continue;
          for (let dx = 0; dx < s; dx++) m[y * w + cx + c * s + dx + sh] = 1;
        }
      }
      cx += 6 * s;
    }
    return { w, h, m };
  };

  // Stamp a mask into buf (width W): halo, outline, extrusion, then the face.
  // Returns the face pixels' indices so a glint can run over them later.
  function stamp(buf, W, H, mk, ox, oy, st) {
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
    const each = fn => { for (let y = 0; y < mk.h; y++) for (let x = 0; x < mk.w; x++) if (mk.m[y * mk.w + x]) fn(x, y); };
    const depth = st.depth || 0;
    if (st.halo) each((x, y) => {
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        const d = Math.hypot(i, j), X = ox + x + i, Y = oy + y + j;
        if (d > 3.2 || X < 0 || Y < 0 || X >= W || Y >= H || buf[Y * W + X]) continue;
        if ((1 - d / 3.6) * 0.7 > VT.bayer(X, Y)) buf[Y * W + X] = st.halo;
      }
    });
    each((x, y) => {
      for (let d = 0; d <= depth; d++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) put(ox + x + d + i, oy + y + d + j, st.outline);
    });
    for (let d = depth; d >= 1; d--) each((x, y) => put(ox + x + d, oy + y + d, st.extrude(d / depth, ox + x + d, oy + y + d)));
    const face = [];
    each((x, y) => {
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= W || Y >= H) return;
      buf[Y * W + X] = st.face(y / (mk.h - 1), X, Y);
      face.push(Y * W + X, X, Y);
    });
    return face;
  }

  const CHROME = VT.stops([[0, '#1257c4'], [0.44, '#a9f0ff'], [0.5, '#ffffff'], [0.53, '#3a0f5e'], [0.74, '#c23c9a'], [1, '#ffd6f3']]);
  const SUNSET = VT.stops([[0, '#fffb96'], [0.5, '#ff9e6b'], [1, '#ff2a6d']]);
  const INK = VT.rgb('#0d0221'), HOT = VT.rgb('#ff2a6d'), DEEP = VT.rgb('#5c0a35');
  const CYAN = VT.rgb('#01cdfe'), NAVY = VT.rgb('#073a66'), HALO = VT.rgb('#5a1a7a'), WHITE = VT.rgb('#ffffff');

  const STYLES = {
    chrome: { depth: 3, outline: INK, extrude: (u) => VT.mix(HOT, DEEP, u), face: (t, x, y) => VT.ramp(CHROME, t, x, y, 3) },
    neon: { depth: 2, outline: INK, halo: HALO, extrude: (u) => VT.mix(CYAN, NAVY, u), face: (t, x, y) => VT.ramp(SUNSET, t, x, y, 3) },
  };

  // Two-line logo: big chrome first line, slanted neon second line. The
  // canvas is sized in whole CSS pixels per art pixel so every pixel is crisp.
  VT.logo = function (canvas, line1, line2, opt = {}) {
    const fb = new VT.FB(canvas);
    const m1 = VT.mask(line1, opt.s1 || 4), m2 = line2 ? VT.mask(line2, opt.s2 || 3, 0.3) : null;
    const W = Math.max(m1.w + 8, m2 ? m2.w + 10 : 0), H = m1.h + (m2 ? m2.h + 9 : 0) + 8;
    fb.resize(W, H);
    const base = new Uint32Array(W * H);
    const x1 = Math.floor((W - m1.w) / 2) - 1, y1 = 2;
    let face = [];
    if (m2) face = face.concat(stamp(base, W, H, m2, Math.floor((W - m2.w) / 2), y1 + m1.h + 7, STYLES.neon));
    face = face.concat(stamp(base, W, H, m1, x1, y1, STYLES.chrome));
    function fit() {
      const k = Math.max(2, Math.min(opt.max || 6, Math.floor((innerWidth - 32) / W) || 2, Math.floor(innerHeight * (opt.height || 0.3) / H) || 2));
      canvas.style.width = W * k + 'px'; canvas.style.height = H * k + 'px';
    }
    fit(); addEventListener('resize', fit);
    return {
      draw(t) {
        fb.d.set(base);
        // a glint sweeps across the lettering every few seconds
        const pos = ((t % 4.5) / 4.5) * (W + H) * 1.8 - H;
        for (let i = 0; i < face.length; i += 3) {
          const k = face[i + 1] + face[i + 2] * 0.7 - pos;
          if (k >= 0 && k < 5) fb.d[face[i]] = k < 1.5 || k > 3.5 ? VT.mix(fb.d[face[i]], WHITE, 0.6) : WHITE;
        }
        fb.flush();
      },
    };
  };
})(window.VT);
