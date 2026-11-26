/* Pixel art of the machines, drawn into a 64×88 framebuffer each frame:
 * the soda machine, and dark silhouettes of the machines still locked. */
(function (VT) {
  'use strict';

  const P = {};
  for (const [k, v] of Object.entries({
    ink: '#0d0221', body: '#ff2a6d', bodyHi: '#ff71ce', bodyLo: '#c0145a', side: '#7a0c3a', sideLo: '#5a072b',
    sign: '#120428', neon: '#01cdfe', neonDim: '#0b4f7a', neonOff: '#16365a',
    glass: '#170a36', glassHi: '#2a1458', shelf: '#4fb6e0', metal: '#d8d2f0', metalLo: '#7a6fae', panel: '#3a0d4f',
    lcd: '#0a2a1e', lcdOn: '#05ffa1', slot: '#04000c', white: '#ffffff', shadow: '#05000d',
    lockBody: '#22093f', lockDot: '#2f0f55', lockEdge: '#6b3aa0', lockQ: '#ff71ce',
  })) P[k] = VT.rgb(v);
  const CANS = ['#01cdfe', '#05ffa1', '#fffb96', '#b967ff', '#ff9e3d'].map(VT.rgb);

  // shadow on the floor under every machine
  function shadow(fb, x0, x1) {
    const c = (x0 + x1) / 2, rx = (x1 - x0) / 2 + 3;
    for (let y = 83; y < 88; y++) for (let x = c - rx; x <= c + rx; x++) {
      const e = ((x - c) / rx) ** 2 + ((y - 84) / 3) ** 2;
      if (e < 1 && (1 - e) * 1.3 > VT.bayer(x, y)) fb.px(x, y, P.shadow);
    }
  }

  // a 7×8 can standing on a shelf
  function can(fb, x, y, c) {
    fb.rect(x + 1, y, 5, 1, P.metalLo);
    fb.rect(x, y + 1, 7, 1, P.metal);
    fb.rect(x, y + 2, 7, 5, c);
    fb.rect(x + 1, y + 2, 1, 5, VT.mix(c, P.white, 0.55));
    fb.rect(x + 6, y + 2, 1, 5, VT.mix(c, P.ink, 0.45));
    fb.rect(x, y + 4, 7, 1, VT.mix(c, P.white, 0.75));
    fb.rect(x + 1, y + 7, 5, 1, P.metalLo);
  }

  function soda(fb, t) {
    fb.clear();
    shadow(fb, 8, 55);
    // cabinet: front face, a darker side face for depth, outlined in ink
    fb.rect(8, 3, 48, 81, P.ink);
    fb.rect(9, 4, 40, 79, P.body);
    fb.rect(9, 4, 40, 1, P.bodyHi);
    fb.rect(9, 4, 2, 79, P.bodyHi);
    fb.rect(47, 4, 2, 79, P.bodyLo);
    fb.rect(49, 4, 1, 79, P.ink);
    fb.rect(50, 4, 5, 79, P.side);
    for (let y = 12; y < 78; y += 4) fb.rect(51, y, 3, 1, P.sideLo);

    // neon sign
    fb.rect(11, 6, 37, 13, P.ink);
    fb.rect(12, 7, 35, 11, P.sign);
    const flick = t % 6.2, on = !(flick > 3.1 && flick < 3.22) && !(flick > 3.3 && flick < 3.36);
    const x = 12 + ((35 - VT.textWidth('SODA')) >> 1);
    if (on) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) VT.text(fb, 'SODA', x + dx, 9 + dy, 1, P.neonDim);
    VT.text(fb, 'SODA', x, 9, 1, on ? P.neon : P.neonOff);
    if (on) VT.text(fb, 'SODA', x, 9, 1, (gx, gy) => (gy < 2 ? VT.mix(P.neon, P.white, 0.6) : P.neon));

    // window with three columns of cans on four shelves
    fb.rect(11, 21, 29, 44, P.ink);
    fb.frame(12, 22, 27, 42, P.metal);
    fb.rect(13, 23, 25, 40, P.glass);
    for (let r = 0; r < 4; r++) {
      const y = 24 + r * 10;
      for (let c = 0; c < 3; c++) can(fb, 14 + c * 8, y, CANS[(r + c * 2) % CANS.length]);
      fb.rect(13, y + 8, 25, 1, P.shelf);
      fb.rect(13, y + 9, 25, 1, P.glassHi);
    }
    // a reflection sweeping across the glass
    const sweep = ((t * 16) % 110) - 30;
    for (let y = 23; y < 63; y++) for (let x2 = 13; x2 < 38; x2++) {
      const k = x2 - 13 + (y - 23) * 0.55 - sweep;
      if (k >= 0 && k < 4) fb.blend(x2, y, P.white, k < 1 || k >= 3 ? 0.18 : 0.38);
      else if ((x2 + y) % 23 === 0) fb.blend(x2, y, P.white, 0.12);
    }

    // control panel: price display, coin slot, a button per shelf, coin return
    fb.rect(41, 21, 7, 44, P.panel);
    fb.frame(41, 21, 7, 44, P.ink);
    fb.rect(42, 23, 5, 5, P.lcd);
    const blink = Math.floor(t * 2) % 2;
    fb.rect(43, 24, 1, 3, P.lcdOn); fb.rect(45, 24, 1, 3, blink ? P.lcdOn : P.lcd); fb.px(44, 26, P.lcdOn);
    fb.rect(42, 30, 5, 6, P.metal);
    fb.rect(43, 30, 3, 1, P.white);
    fb.rect(44, 31, 1, 4, P.slot);
    const lit = Math.floor(t * 3) % 4;
    for (let i = 0; i < 4; i++) {
      const c = CANS[i];
      fb.rect(42, 38 + i * 5, 5, 3, P.ink);
      fb.rect(42, 38 + i * 5, 5, 2, i === lit ? VT.mix(c, P.white, 0.3) : VT.mix(c, P.ink, 0.55));
    }
    fb.rect(42, 58, 5, 5, P.metalLo);
    fb.rect(43, 59, 3, 3, P.slot);

    // trim and the delivery hatch, where a can drops every few seconds
    fb.rect(9, 66, 38, 1, P.bodyLo);
    fb.rect(11, 69, 29, 11, P.ink);
    fb.rect(12, 70, 27, 9, P.slot);
    fb.rect(12, 70, 27, 2, P.metalLo);
    fb.rect(12, 70, 27, 1, P.metal);
    const p = (t % 3.4) / 3.4;
    if (p > 0.18 && p < 0.86) {
      const bounce = p < 0.26 ? Math.round(Math.sin(((p - 0.18) / 0.08) * Math.PI) * -2) : 0;
      const c = CANS[Math.floor(t / 3.4) % CANS.length], y = 74 + bounce;
      fb.rect(21, y, 9, 5, c);
      fb.rect(21, y + 1, 9, 1, VT.mix(c, P.white, 0.55));
      fb.rect(21, y + 4, 9, 1, VT.mix(c, P.ink, 0.4));
      fb.rect(20, y + 1, 1, 3, P.metal); fb.rect(30, y + 1, 1, 3, P.metalLo);
    }
    fb.rect(9, 81, 38, 2, P.bodyLo);
    // feet
    fb.rect(11, 84, 5, 2, P.ink); fb.rect(43, 84, 5, 2, P.ink);
  }

  // Dark machines, so you can guess what is coming: a wide snack machine,
  // a gumball globe and a coffee kiosk. A pink "?" flickers on each.
  function dots(fb, x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) fb.px(i, j, (i + j) % 2 ? P.lockBody : P.lockDot);
  }
  function box(fb, x, y, w, h) {
    fb.rect(x - 1, y - 1, w + 2, h + 2, P.lockEdge);
    dots(fb, x, y, w, h);
  }
  const SHAPES = {
    snack(fb) {
      box(fb, 6, 4, 52, 79);
      fb.frame(10, 9, 32, 52, P.lockEdge);
      for (let r = 0; r < 5; r++) fb.rect(11, 18 + r * 9, 30, 1, P.lockEdge);
      fb.frame(45, 12, 9, 22, P.lockEdge);
      fb.frame(10, 67, 32, 10, P.lockEdge);
    },
    gumball(fb) {
      const cx = 32, cy = 28, r = 19;
      for (let y = cy - r - 1; y <= cy + r + 1; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) fb.px(x, y, (x + y) % 2 ? P.lockBody : P.lockDot);
        else if (d <= r + 1.2) fb.px(x, y, P.lockEdge);
      }
      fb.rect(28, cy - r - 4, 9, 3, P.lockEdge);
      box(fb, 24, 48, 17, 12);
      fb.frame(29, 52, 7, 5, P.lockEdge);
      for (let y = 61; y < 82; y++) { const w = 6 + ((y - 61) >> 1); dots(fb, 32 - w, y, w * 2, 1); fb.px(31 - w, y, P.lockEdge); fb.px(32 + w, y, P.lockEdge); }
      fb.rect(15, 82, 35, 1, P.lockEdge);
    },
    coffee(fb) {
      box(fb, 13, 4, 38, 79);
      fb.frame(17, 9, 30, 14, P.lockEdge);
      for (let i = 0; i < 6; i++) fb.frame(17 + (i % 3) * 10, 27 + (i >> 1 & 1) * 0 + Math.floor(i / 3) * 7, 8, 5, P.lockEdge);
      fb.frame(22, 46, 20, 24, P.lockEdge);
      fb.rect(28, 58, 8, 9, P.lockEdge);
      dots(fb, 29, 58, 6, 8);
    },
  };

  function locked(fb, t, shape) {
    fb.clear();
    shadow(fb, 8, 55);
    SHAPES[shape](fb);
    const f = (t * 1.3 + shape.length) % 4;
    if (!(f > 2.6 && f < 2.75)) {
      const qx = 32 - (VT.textWidth('?', 3) >> 1), qy = shape === 'gumball' ? 18 : 30;
      VT.text(fb, '?', qx + 1, qy + 1, 3, P.ink);
      VT.text(fb, '?', qx, qy, 3, (gx, gy) => (gy < 3 ? VT.mix(P.lockQ, P.white, 0.5) : P.lockQ));
    }
    // a scan line rolls down, like a weak signal
    const sy = Math.floor((t * 22) % 120) - 16;
    for (let x = 0; x < 64; x++) if (fb.d[sy * 64 + x]) fb.blend(x, sy, P.lockEdge, 0.5);
  }

  // Bind a canvas to a machine's art. size: art pixels per CSS-pixel step.
  VT.art = function (canvas, kind, size) {
    const fb = new VT.FB(canvas);
    fb.resize(64, 88);
    function fit() {
      const k = size ? size() : VT.scale();
      canvas.style.width = 64 * k + 'px'; canvas.style.height = 88 * k + 'px';
    }
    fit(); addEventListener('resize', fit);
    return {
      draw(t) {
        if (kind === 'soda') soda(fb, t); else locked(fb, t, kind);
        fb.flush();
      },
    };
  };
})(window.VT);
