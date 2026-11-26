/* The machines in high resolution: soda, snacks, gumballs and coffee, drawn
 * with smooth shapes, gradients and glows in the same 64×88 units as the
 * pixel art, from the same live view (see js/machines.js). Also the items
 * they sell, for the panels. Without a view a machine is a showpiece. */
(function (VT) {
  'use strict';
  const H = VT.HD, INK = H.INK, sh = H.shade;
  const C = {
    metal: '#d8d2f0', metalLo: '#7a6fae', glass: '#170a36', glassHi: '#2a1458', lcd: '#0a2a1e', lcdOn: '#05ffa1',
    slot: '#04000c', sel: '#fffb96', low: '#ff9e3d', alarm: '#ff2a6d', white: '#ffffff', panel: '#3a0d4f', sign: '#120428',
  };
  const CANS = ['#01cdfe', '#05ffa1', '#fffb96', '#b967ff', '#ff9e3d'];

  function shadow(c, x0, x1) {
    const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2 + 4;
    c.save(); c.translate(cx, 84.5); c.scale(rx, 3.2);
    c.fillStyle = H.rad(c, 0, 0, 0, 1, [[0, 'rgba(5,0,13,.85)'], [1, 'rgba(5,0,13,0)']]);
    c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill(); c.restore();
  }
  // a cabinet: front face with a soft sheen, a darker side face with vents
  function cabinet(c, x, y, w, h, side, body) {
    H.box(c, x - 1, y - 1, w + side + 2, h + 2, 2.2, INK);
    c.fillStyle = H.lin(c, x, 0, x + w, 0, [[0, sh(body, 0.35)], [0.12, body], [0.85, body], [1, sh(body, -0.3)]]);
    H.rr(c, x, y, w, h, 1.8); c.fill();
    c.fillStyle = H.lin(c, 0, y, 0, y + 8, [[0, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
    H.rr(c, x, y, w, 8, 1.8); c.fill();
    c.fillStyle = H.lin(c, x + w, 0, x + w + side, 0, [[0, sh(body, -0.55)], [1, sh(body, -0.7)]]);
    H.rr(c, x + w + 0.6, y, side, h, 1.4); c.fill();
    c.fillStyle = 'rgba(0,0,0,.35)';
    for (let yy = y + 8; yy < y + h - 4; yy += 4) H.rr(c, x + w + 1.6, yy, side - 2, 1.1, 0.5), c.fill();
  }
  // a neon word in a dark sign box; alarm words flash red
  function sign(c, x, y, w, h, word, base, col, t, phase) {
    H.box(c, x, y, w, h, 1.6, INK);
    H.box(c, x + 0.8, y + 0.8, w - 1.6, h - 1.6, 1.2, C.sign);
    const alarm = word !== base, f = (t + phase) % 6.2;
    const on = alarm ? Math.floor(t * 2.5) % 2 === 0 : !(f > 3.1 && f < 3.22) && !(f > 3.3 && f < 3.36);
    const tube = alarm ? C.alarm : col;
    c.save();
    c.font = H.font(Math.min(h * 0.62, (w * 1.55) / word.length), 900); c.textAlign = 'center'; c.textBaseline = 'middle';
    if (on) { H.glow(c, tube, 4); c.fillStyle = sh(tube, 0.35); c.fillText(word, x + w / 2, y + h / 2 + 0.4); H.glow(c, tube, 1.2); c.fillText(word, x + w / 2, y + h / 2 + 0.4); }
    else { c.fillStyle = sh(tube, -0.7); c.fillText(word, x + w / 2, y + h / 2 + 0.4); }
    c.restore();
    if (on) { c.fillStyle = H.lin(c, 0, y, 0, y + h, [[0, 'rgba(255,255,255,.08)'], [1, 'rgba(255,255,255,0)']]); H.rr(c, x + 0.8, y + 0.8, w - 1.6, h / 2, 1); c.fill(); }
  }
  // a pane of glass: dark with a reflection sweeping across it
  function glass(c, x, y, w, h, t, speed) {
    c.fillStyle = H.lin(c, 0, y, 0, y + h, [[0, '#1d0d44'], [1, C.glass]]);
    c.fillRect(x, y, w, h);
  }
  function sweep(c, x, y, w, h, t, speed) {
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const p = ((t * speed) % (w + h + 40)) - 30 + x;
    c.fillStyle = H.lin(c, p, y, p + 8, y + 4, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]);
    c.beginPath(); c.moveTo(p, y); c.lineTo(p + 8, y); c.lineTo(p + 8 - h * 0.55, y + h); c.lineTo(p - h * 0.55, y + h); c.fill();
    c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.4, y); c.lineTo(x, y + h * 0.6); c.fill();
    c.restore();
  }
  function lcdText(c, txt, x, y, w, h, col = C.lcdOn) {
    H.box(c, x, y, w, h, 0.8, C.lcd);
    c.save(); H.glow(c, col, 2); c.fillStyle = col; c.font = H.font(Math.min(h * 0.72, (w * 1.2) / txt.length), 700); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, x + w / 2, y + h / 2 + 0.3); c.restore();
  }
  const fmt = p => (Math.round(p * 100) / 100).toFixed(2);

  // ---- items ----
  // a can, 7×8 with its top at (x, y)
  function can(c, x, y, col) {
    c.fillStyle = H.lin(c, x, 0, x + 7, 0, [[0, sh(col, -0.45)], [0.3, sh(col, 0.45)], [0.55, col], [1, sh(col, -0.5)]]);
    H.rr(c, x, y + 1, 7, 6.6, 0.9); c.fill();
    c.fillStyle = H.lin(c, x, 0, x + 7, 0, [[0, C.metalLo], [0.35, '#ffffff'], [1, C.metalLo]]);
    c.beginPath(); c.ellipse(x + 3.5, y + 1.1, 3.5, 0.9, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x + 0.4, y + 3.2, 6.2, 0.9);
    c.fillStyle = sh(col, -0.3); c.beginPath(); c.arc(x + 3.5, y + 5.3, 0.9, 0, 7); c.fill();
    c.fillStyle = H.lin(c, x, 0, x + 7, 0, [[0, C.metalLo], [0.4, C.metal], [1, C.metalLo]]);
    c.beginPath(); c.ellipse(x + 3.5, y + 7.5, 3.3, 0.6, 0, 0, 7); c.fill();
  }
  // a snack, 7×6, by its shape
  function snack(c, x, y, shape, col) {
    const hi = sh(col, 0.45), lo = sh(col, -0.4);
    c.save();
    if (shape === 'bag') {
      c.fillStyle = H.lin(c, x, 0, x + 7, 0, [[0, lo], [0.3, hi], [0.6, col], [1, lo]]);
      c.beginPath(); c.moveTo(x, y + 0.5); c.lineTo(x + 7, y + 0.5); c.quadraticCurveTo(x + 7.6, y + 3, x + 7, y + 5.6); c.lineTo(x, y + 5.6); c.quadraticCurveTo(x - 0.6, y + 3, x, y + 0.5); c.fill();
      c.fillStyle = lo; for (let k = 0; k < 7; k += 1) c.fillRect(x + k, y + (k % 2 ? 0.1 : 0.5), 0.6, 0.6), c.fillRect(x + k, y + 5.3, 0.6, 0.6);
      c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x + 3.5, y + 3, 1.8, 1.2, 0, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(x + 3.5, y + 3, 0.6, 0, 7); c.fill();
    } else if (shape === 'bar') {
      c.fillStyle = H.lin(c, x + 1, 0, x + 6, 0, [[0, lo], [0.35, hi], [1, lo]]); H.rr(c, x + 1, y, 5, 6, 0.6); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(x + 1, y + 2, 5, 2);
      c.fillStyle = lo; c.font = H.font(1.6, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BAR', x + 3.5, y + 3.05);
    } else if (shape === 'pack') {
      c.fillStyle = 'rgba(200,190,255,.35)'; H.rr(c, x, y + 1, 7, 5, 0.8); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 0.3; c.stroke();
      for (const [dx, dy] of [[1.8, 2.8], [5.2, 2.8], [3.5, 4.4]]) {
        c.fillStyle = H.rad(c, x + dx - 0.4, y + dy - 0.4, 0.1, 1.4, [[0, hi], [1, col]]); c.beginPath(); c.arc(x + dx, y + dy, 1.3, 0, 7); c.fill();
        c.fillStyle = lo; c.beginPath(); c.arc(x + dx + 0.3, y + dy - 0.2, 0.25, 0, 7); c.arc(x + dx - 0.4, y + dy + 0.4, 0.22, 0, 7); c.fill();
      }
    } else if (shape === 'gummy') {
      c.fillStyle = sh(col, -0.6); H.rr(c, x, y + 0.6, 7, 5.4, 0.8); c.fill();
      c.fillStyle = lo; c.fillRect(x, y, 7, 0.9);
      const dots = [col, '#ff71ce', '#fffb96'];
      [[1.3, 2.4], [3.3, 1.8], [5.4, 2.5], [2.2, 4.4], [4.4, 4.3], [5.7, 4.6], [1.2, 4.6], [3.4, 3.4]].forEach(([dx, dy], k) => {
        c.fillStyle = dots[k % 3]; c.beginPath(); c.ellipse(x + dx, y + dy, 0.75, 0.6, k, 0, 7); c.fill();
      });
      c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x + 0.6, y + 1.2, 1, 4);
    } else {
      c.fillStyle = H.lin(c, x, 0, x + 7, 0, [[0, lo], [0.3, hi], [1, lo]]); H.rr(c, x, y + 1.6, 7, 4.4, 1); c.fill();
      c.fillStyle = H.lin(c, x, 0, x + 7, 0, [[0, C.metalLo], [0.4, '#ffffff'], [1, C.metalLo]]); H.rr(c, x - 0.2, y + 0.6, 7.4, 1.4, 0.6); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(x + 1.5, y + 3.2, 4, 0.9);
    }
    c.restore();
  }
  function gumball(c, x, y, col, r = 1.5) {
    c.fillStyle = H.rad(c, x - r * 0.35, y - r * 0.4, r * 0.1, r * 1.1, [[0, sh(col, 0.65)], [0.45, col], [1, sh(col, -0.45)]]);
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  // a paper cup, 7 wide and 9 tall from (x, y), k full, sleeve in its colour
  function cup(c, x, y, liquid, sleeve, k) {
    c.save();
    c.beginPath(); c.moveTo(x - 0.2, y + 0.6); c.lineTo(x + 7.2, y + 0.6); c.lineTo(x + 6.2, y + 9.4); c.lineTo(x + 0.8, y + 9.4); c.closePath();
    c.fillStyle = H.lin(c, x, 0, x + 7, 0, [[0, '#c9bde6'], [0.35, '#ffffff'], [1, '#a898cc']]); c.fill();
    c.clip();
    if (k > 0) { const top = y + 9.4 - k * 8.2; c.fillStyle = H.lin(c, 0, top, 0, y + 9.4, [[0, sh(liquid, 0.25)], [0.3, liquid], [1, sh(liquid, -0.3)]]); c.fillRect(x - 1, top, 9, 10); c.fillStyle = sh(liquid, 0.45); c.fillRect(x - 1, top, 9, 0.5); }
    c.fillStyle = H.lin(c, x, 0, x + 7, 0, [[0, sh(sleeve, -0.35)], [0.35, sh(sleeve, 0.3)], [1, sh(sleeve, -0.45)]]);
    c.fillRect(x - 1, y + 3.6, 9, 3.2);
    c.restore();
    c.fillStyle = '#ffffff'; H.rr(c, x - 0.5, y, 8, 1, 0.5); c.fill();
  }
  VT.HD.items = { can, snack, gumball, cup };

  // ---- soda ----
  function soda(c, t, view) {
    shadow(c, 8, 55);
    cabinet(c, 9, 4, 40, 79, 6, '#ff2a6d');
    sign(c, 11, 6, 37, 13, (view && view.sign) || 'SODA', 'SODA', '#01cdfe', t, 0);
    H.box(c, 11, 21, 29, 44, 1, INK);
    H.box(c, 12, 22, 27, 42, 0.8, null, C.metal, 0.9);
    glass(c, 13, 23, 25, 40);
    for (let r = 0; r < 4; r++) {
      const y = 24 + r * 10;
      c.fillStyle = H.lin(c, 0, y + 8, 0, y + 9.5, [[0, '#7fd8ff'], [1, '#2a6a9a']]); c.fillRect(13, y + 8, 25, 1.4);
      for (let k = 0; k < 3; k++) {
        const cx = 14 + k * 8;
        if (!view) { can(c, cx, y, CANS[(r + k * 2) % CANS.length]); continue; }
        const i = r * 3 + k, s = view.slots[i];
        if (s.stock > 0) can(c, cx, y, s.color);
        else { c.strokeStyle = '#3a2470'; c.lineWidth = 0.6; c.beginPath(); for (let q = 0; q < 4; q++) c.ellipse(cx + 3.5, y + 1.6 + q * 1.8, 3, 0.7, 0, 0, Math.PI); c.stroke(); }
        if (view.sel === i) { c.save(); H.glow(c, C.sel, 2.5); c.strokeStyle = sh(C.sel, 0); c.globalAlpha = 0.65 + 0.35 * Math.sin(t * 8); c.lineWidth = 0.7; H.rr(c, cx - 1, y - 1, 9, 10, 1.2); c.stroke(); c.restore(); }
        for (let q = 0; q < s.cap; q++) { c.fillStyle = q < s.stock ? (s.stock <= 2 ? C.low : C.lcdOn) : INK; c.beginPath(); c.arc(cx + 0.5 + q, y + 8.7, 0.38, 0, 7); c.fill(); }
      }
    }
    sweep(c, 13, 23, 25, 40, t, 16);
    // control panel
    H.box(c, 41, 21, 7, 44, 0.8, C.panel, INK, 0.6);
    H.box(c, 42, 23, 5, 5, 0.6, C.lcd);
    c.save(); H.glow(c, C.lcdOn, 1.5); c.fillStyle = C.lcdOn; c.fillRect(42.9, 24.2, 0.8, 2.6); if (Math.floor(t * 2) % 2) c.fillRect(45, 24.2, 0.8, 2.6); c.restore();
    coinSlot(c, 42, 30, 5, 6);
    const lit = Math.floor(t * 3) % 4;
    for (let i = 0; i < 4; i++) {
      c.save(); if (i === lit) H.glow(c, CANS[i], 3);
      c.fillStyle = H.lin(c, 0, 38 + i * 5, 0, 41 + i * 5, [[0, i === lit ? sh(CANS[i], 0.3) : sh(CANS[i], -0.5)], [1, sh(CANS[i], -0.65)]]);
      H.rr(c, 42, 38 + i * 5, 5, 3, 0.8); c.fill(); c.restore();
    }
    H.box(c, 42, 58, 5, 5, 0.7, C.metalLo); H.box(c, 43, 59, 3, 3, 0.5, C.slot);
    // the hatch and a can rolling out
    c.fillStyle = sh('#ff2a6d', -0.3); c.fillRect(9, 66, 40, 0.8);
    hatch(c, 11, 69, 29, 11);
    const age = view ? (view.drop ? t - view.drop.at : 99) : ((t % 3.4) / 3.4 - 0.18) * 3.4;
    if (age >= 0 && age < 2.4) {
      const b = age < 0.27 ? Math.sin((age / 0.27) * Math.PI) * -2 : 0, col = view ? view.drop.color : CANS[Math.floor(t / 3.4) % CANS.length];
      c.save(); c.translate(25.5, 76.5 + b); c.rotate(Math.PI / 2); can(c, -3.5, -4.5, col); c.restore();
    }
    feet(c, 11, 43);
  }
  function coinSlot(c, x, y, w, h) {
    c.fillStyle = H.lin(c, x, 0, x + w, 0, [[0, C.metalLo], [0.4, '#ffffff'], [1, C.metalLo]]); H.rr(c, x, y, w, h, 0.8); c.fill();
    H.box(c, x + w / 2 - 0.45, y + 1, 0.9, h - 2, 0.4, C.slot);
  }
  function hatch(c, x, y, w, h) {
    H.box(c, x, y, w, h, 1, INK);
    c.fillStyle = H.lin(c, 0, y + 1, 0, y + h - 1, [[0, '#2a1a4a'], [0.3, C.slot], [1, C.slot]]); H.rr(c, x + 1, y + 1, w - 2, h - 2, 0.8); c.fill();
    c.fillStyle = H.lin(c, 0, y + 1, 0, y + 3, [[0, C.metal], [1, C.metalLo]]); c.fillRect(x + 1, y + 1, w - 2, 1.8);
  }
  function feet(c, a, b) { H.box(c, a, 83.4, 5, 2.4, 0.8, INK); H.box(c, b, 83.4, 5, 2.4, 0.8, INK); }

  // ---- snacks ----
  const SHOW = [['bag', '#ff9e3d'], ['bag', '#ff9e3d'], ['bag', '#01cdfe'], ['bag', '#01cdfe'], ['bar', '#ff2a6d'], ['bar', '#ff2a6d'],
    ['pack', '#e8a86a'], ['pack', '#e8a86a'], ['bag', '#ff9e3d'], ['gummy', '#05ffa1'], ['gummy', '#05ffa1'], ['bar', '#ff2a6d'],
    ['tub', '#b967ff'], ['pack', '#e8a86a'], ['bag', '#01cdfe'], ['bar', '#ff2a6d'], ['bag', '#ff9e3d'], ['tub', '#b967ff'], ['gummy', '#05ffa1'], ['pack', '#e8a86a']];
  function snackMachine(c, t, view) {
    shadow(c, 5, 58);
    cabinet(c, 6, 4, 46, 79, 6, '#1186b3');
    sign(c, 8, 6, 42, 13, (view && view.sign) || 'SNACKS', 'SNACKS', '#ff71ce', t, 2.3);
    H.box(c, 8, 20, 37, 50, 1, INK);
    H.box(c, 9, 21, 35, 48, 0.8, null, C.metal, 0.9);
    glass(c, 10, 22, 33, 46);
    for (let r = 0; r < 5; r++) {
      const y = 22 + r * 9;
      c.fillStyle = H.lin(c, 0, y + 7, 0, y + 8.4, [[0, '#7fd8ff'], [1, '#2a5a8a']]); c.fillRect(10, y + 7, 33, 1.3);
      for (let k = 0; k < 4; k++) {
        const x = 11 + k * 8, i = r * 4 + k;
        // the spiral coil
        c.strokeStyle = '#b9b3d8'; c.lineWidth = 0.45; c.beginPath();
        for (let q = 0; q <= 14; q++) { const a = q * 1.6; c.lineTo(x + q * 0.5, y + 6.3 + Math.sin(a) * 0.55); }
        c.stroke();
        if (!view) { snack(c, x, y, SHOW[i][0], SHOW[i][1]); continue; }
        const s = view.slots[i];
        if (s.stock > 0) {
          const stale = s.stale > 0;
          snack(c, x, y, s.shape, stale ? mixHex(s.color, '#7a8a5a', 0.7) : s.color);
          if (stale) { c.strokeStyle = 'rgba(155,224,90,.8)'; c.lineWidth = 0.4; for (let q = 0; q < 2; q++) { const o = (t * 2 + q * 0.5) % 1; c.beginPath(); c.moveTo(x + 2 + q * 3, y - o * 2); c.quadraticCurveTo(x + 3 + q * 3, y - 1 - o * 2, x + 2 + q * 3, y - 2 - o * 2); c.stroke(); } }
        }
        if (s.hang) snack(c, x, y + 3, s.shape, s.color);
        if (view.sel === i) { c.save(); H.glow(c, C.sel, 2.5); c.strokeStyle = C.sel; c.globalAlpha = 0.65 + 0.35 * Math.sin(t * 8); c.lineWidth = 0.7; H.rr(c, x - 1, y - 1, 9, 9, 1.2); c.stroke(); c.restore(); }
        for (let q = 0; q < Math.min(7, s.cap); q++) { c.fillStyle = q < s.stock ? (q < s.stale ? C.alarm : s.stock <= 2 ? C.low : C.lcdOn) : INK; c.beginPath(); c.arc(x + 0.5 + q, y + 7.65, 0.36, 0, 7); c.fill(); }
      }
    }
    sweep(c, 10, 22, 33, 46, t, 14);
    // keypad
    H.box(c, 44, 20, 8, 50, 0.8, C.panel, INK, 0.6);
    H.box(c, 45, 22, 6, 5, 0.6, C.lcd);
    c.save(); H.glow(c, C.lcdOn, 1.5); c.fillStyle = C.lcdOn; c.fillRect(46, 23, 1.6, 3); if (Math.floor(t * 2) % 2) c.fillRect(49, 23, 0.8, 3); c.restore();
    const typing = view ? view.busy : Math.floor(t * 0.7) % 3 === 0, key = typing ? Math.floor(t * 5) % 12 : -1;
    for (let k = 0; k < 12; k++) { c.fillStyle = k === key ? C.sel : C.metal; H.rr(c, 45.6 + (k % 3) * 1.8, 28.6 + Math.floor(k / 3) * 2, 1.3, 1.3, 0.3); c.fill(); }
    coinSlot(c, 45, 38, 6, 5);
    H.box(c, 45, 45, 6, 3, 0.5, C.slot); c.fillStyle = Math.floor(t * 1.5) % 2 ? '#05ffa1' : C.slot; c.fillRect(46, 46.2, 4, 0.6);
    H.box(c, 45, 61, 6, 5, 0.7, C.metalLo); H.box(c, 46, 62, 4, 3, 0.5, C.slot);
    c.fillStyle = sh('#1186b3', -0.3); c.fillRect(6, 71, 46, 0.8);
    hatch(c, 8, 73, 37, 9);
    const age = view ? (view.drop ? t - view.drop.at : 99) : ((t % 4.1) / 4.1 - 0.2) * 4.1;
    if (age >= 0 && age < 2.4) {
      const b = age < 0.27 ? Math.sin((age / 0.27) * Math.PI) * -2 : 0;
      const d = view ? view.drop : { shape: SHOW[Math.floor(t / 4.1) % 20][0], color: SHOW[Math.floor(t / 4.1) % 20][1] };
      snack(c, 22, 75 + b, d.shape, d.color);
      if (d.two) snack(c, 30, 75, d.shape, d.color);
    }
    c.fillStyle = sh('#1186b3', -0.3); c.fillRect(6, 82, 46, 0.8);
    feet(c, 8, 45);
  }
  function mixHex(a, b, t) {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  // ---- gumballs ----
  const GCX = 32, GCY = 27, GR = 19, SPOTS = [];
  for (let row = 0; ; row++) {
    const y = GCY + GR - 4 - row * 3;
    if (y < GCY - GR + 1) break;
    for (let x = GCX - GR + (row % 2 ? 2 : 1); x <= GCX + GR - 3; x += 3) if (Math.hypot(x + 1 - GCX, y + 1 - GCY) <= GR - 2.2) SPOTS.push([x + 1.5, y + 1.5]);
  }
  const spotHash = i => ((Math.imul(i + 1, 2654435761) >>> 0) % 10007) / 10007;
  const SHOW_MIX = ['#ff2a6d', '#01cdfe', '#05ffa1', '#fffb96', '#b967ff', '#ff9ee0'];
  function gumballMachine(c, t, view) {
    shadow(c, 14, 50);
    // the globe
    c.save();
    c.beginPath(); c.arc(GCX, GCY, GR, 0, 7);
    c.fillStyle = H.rad(c, GCX - 6, GCY - 8, 2, GR + 2, [[0, '#2a1a5a'], [1, '#0d0526']]); c.fill();
    c.clip();
    const total = view ? view.total : 1, cap = view ? view.cap : 1, n = Math.round(SPOTS.length * Math.min(1, total / cap));
    const cum = [];
    if (view) { let a = 0; for (const s of view.slots) { a += s.stock / Math.max(1, total); cum.push(a); } }
    for (let i = 0; i < n; i++) {
      const [x, y] = SPOTS[i], u = spotHash(i);
      let col;
      if (!view) col = SHOW_MIX[Math.floor(u * SHOW_MIX.length)];
      else {
        let k = 0; while (k < cum.length - 1 && u >= cum[k]) k++;
        col = view.slots[k].color;
        if (view.slots[k].prize) { col = '#ffd34a'; if (Math.floor(t * 3 + i) % 4 === 0) { c.save(); H.glow(c, '#fff6b0', 3); gumball(c, x, y, '#fff6b0', 1.55); c.restore(); continue; } }
      }
      gumball(c, x, y, col, 1.55);
    }
    // the glass: shine and rim
    c.fillStyle = H.rad(c, GCX - 8, GCY - 9, 0, 9, [[0, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 64, 60);
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 0.9; c.lineCap = 'round';
    c.beginPath(); c.arc(GCX, GCY, GR - 3.5, -2.45, -1.55); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(GCX, GCY, GR - 3.5, 0.3, 0.9); c.stroke();
    c.strokeStyle = C.metalLo; c.lineWidth = 1; c.beginPath(); c.arc(GCX, GCY, GR + 0.2, 0, 7); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 0.7; c.beginPath(); c.arc(GCX, GCY, GR + 1, 0, 7); c.stroke();
    const red = '#e8204f';
    const redBox = (x, y, w, h, r) => { H.box(c, x - 0.6, y - 0.6, w + 1.2, h + 1.2, r + 0.4, INK); c.fillStyle = H.lin(c, x, 0, x + w, 0, [[0, '#ff6f8f'], [0.25, red], [0.8, red], [1, '#9a0f35']]); H.rr(c, x, y, w, h, r); c.fill(); };
    // lid and knob
    redBox(25.5, 5.5, 14, 3.4, 1.2); redBox(30.5, 2.6, 4, 3.2, 1.4);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(27, 6, 10, 0.5);
    // collar
    c.fillStyle = H.lin(c, 0, 45, 0, 49, [[0, '#ffffff'], [0.5, C.metal], [1, C.metalLo]]); H.box(c, 17, 45, 31, 4, 1, null, INK, 0.5); H.rr(c, 17, 45, 31, 4, 1); c.fill();
    // body
    redBox(18, 49, 29, 19.5, 2);
    H.box(c, 24, 51, 17, 13, 1.4, INK);
    c.fillStyle = H.lin(c, 0, 52, 0, 63, [[0, '#ffffff'], [0.4, C.metal], [1, C.metalLo]]); H.rr(c, 25, 52, 15, 11, 1); c.fill();
    // price plate, or a flashing alarm
    const alarm = view && view.sign, flash = Math.floor(t * 2.5) % 2 === 0;
    if (alarm) { H.box(c, 26, 53, 8, 5, 0.6, flash ? C.alarm : INK); if (flash) { c.fillStyle = '#fff'; c.font = H.font(4.4, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 30, 55.8); } }
    else {
      const cents = view ? Math.round(view.price * 100) : 25;
      lcdText(c, cents < 100 ? cents + '¢' : '$' + (cents / 100).toFixed(cents % 100 ? 2 : 0), 25.6, 53, 8.4, 5);
    }
    c.fillStyle = C.slot; H.rr(c, 27.5, 59.2, 4, 1, 0.4); c.fill();
    // the crank
    const turning = view ? view.busy : Math.floor(t * 0.5) % 3 === 0, ang = turning ? t * 5 : 0.9;
    c.fillStyle = H.rad(c, 36, 56, 0.4, 3, [[0, '#ffffff'], [1, C.metalLo]]); c.beginPath(); c.arc(36.5, 56.5, 2.6, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.5; c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(36.5, 56.5); c.lineTo(36.5 + Math.cos(ang) * 3.8, 56.5 + Math.sin(ang) * 3.8); c.stroke();
    c.fillStyle = '#ff6f8f'; c.beginPath(); c.arc(36.5 + Math.cos(ang) * 4.1, 56.5 + Math.sin(ang) * 4.1, 1.1, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.4; c.stroke();
    // chute and a ball rolling out
    H.box(c, 28, 64, 9, 4, 0.8, INK); H.box(c, 29, 65, 7, 2.2, 0.6, C.slot);
    const age = view ? (view.drop ? t - view.drop.at : 99) : ((t % 3.6) / 3.6 - 0.25) * 3.6;
    if (age >= 0 && age < 2.4) gumball(c, 30.5 + Math.min(3, age * 8), 65.5, view ? view.drop.color : SHOW_MIX[Math.floor(t / 3.6) % 6], 1.5);
    // stand and base
    c.fillStyle = H.lin(c, 29, 0, 36, 0, [[0, red], [0.4, '#9a0f35'], [1, '#5e0820']]); H.box(c, 29, 68, 7, 14, 0.6, null, INK, 0.5); H.rr(c, 29, 68, 7, 14, 0.6); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 3; k++) c.fillRect(30, 71 + k * 4, 5, 0.6);
    redBox(17.5, 80.5, 30, 4, 1.6);
  }

  // ---- coffee ----
  const SHOW_DRINKS = [['#ff9e3d', '#4a2210'], ['#01cdfe', '#3a1a0c'], ['#f1e6ff', '#c99a6e'], ['#ff71ce', '#d9b08a'], ['#b967ff', '#7a4a2e'], ['#05ffa1', '#6a3a22']]
    .map(([color, liquid]) => ({ color, liquid, can: true }));
  function coffee(c, t, view) {
    shadow(c, 6, 57);
    cabinet(c, 8, 4, 43, 79, 5, '#8a3ab9');
    sign(c, 10, 6, 39, 13, (view && view.sign) || 'COFFEE', 'COFFEE', '#ff9e3d', t, 4.1);
    // drink buttons
    H.box(c, 9, 21, 41, 21, 1.2, INK); H.box(c, 10, 22, 39, 19, 1, '#1a0a30');
    const slots = view ? view.slots : SHOW_DRINKS, lit = view ? -1 : Math.floor(t * 0.8) % 6;
    for (let i = 0; i < 6; i++) {
      const x = 10 + (i % 3) * 14, y = 24 + Math.floor(i / 3) * 9, s = slots[i];
      c.save();
      if (i === lit || (view && view.sel === i)) H.glow(c, s.color, 3);
      c.fillStyle = H.lin(c, 0, y, 0, y + 7, [[0, '#3a1e60'], [1, '#22103e']]); H.rr(c, x, y, 12, 7, 1.2); c.fill();
      c.restore();
      c.strokeStyle = view && view.sel === i ? C.sel : INK; c.lineWidth = view && view.sel === i ? 0.6 : 0.5; H.rr(c, x, y, 12, 7, 1.2); c.stroke();
      c.fillStyle = s.can ? s.color : sh(s.color, -0.7); H.rr(c, x + 1, y + 0.9, 10, 1, 0.5); c.fill();
      // a little cup and saucer
      c.fillStyle = s.can ? '#f1e6ff' : '#5a4a7a';
      c.beginPath(); c.moveTo(x + 3, y + 2.6); c.lineTo(x + 7, y + 2.6); c.lineTo(x + 6.5, y + 5.4); c.lineTo(x + 3.5, y + 5.4); c.fill();
      c.strokeStyle = c.fillStyle; c.lineWidth = 0.4; c.beginPath(); c.arc(x + 7, y + 3.9, 0.8, -1.5, 1.5); c.stroke();
      c.fillStyle = s.liquid; c.fillRect(x + 3.2, y + 2.7, 3.6, 0.6);
      c.fillStyle = '#b8a8d8'; H.rr(c, x + 2.4, y + 5.4, 5.6, 0.6, 0.3); c.fill();
      c.save(); H.glow(c, s.can ? C.lcdOn : C.alarm, 1.5); c.fillStyle = s.can ? C.lcdOn : C.alarm; c.beginPath(); c.arc(x + 9.8, y + 4, 0.55, 0, 7); c.fill(); c.restore();
    }
    // price, coin slot and supply gauges
    const cents = view ? Math.round(view.price * 100) : 250 + 25 * (Math.floor(t / 2) % 3);
    H.box(c, 10, 44, 19, 8, 1, INK); lcdText(c, '$' + fmt(cents / 100), 11, 45, 17, 6);
    coinSlot(c, 31, 44, 5, 8);
    const gauges = view ? view.sup : [{ k: 0.8 }, { k: 0.6 }, { k: 0.9 }, { k: 0.7 }], GC = ['#c07a4a', '#f1e6ff', '#ff9ee0', '#01cdfe'];
    H.box(c, 38, 44, 11, 8, 1, INK);
    gauges.forEach((g, j) => {
      const x = 39 + j * 2.5;
      c.fillStyle = '#1a0a30'; H.rr(c, x, 45, 1.8, 6, 0.5); c.fill();
      const col = g.sour ? (Math.floor(t * 3) % 2 ? '#9be05a' : INK) : g.k < 0.2 ? C.alarm : GC[j % 4];
      if (g.k > 0) { c.fillStyle = col; H.rr(c, x, 51 - g.k * 6, 1.8, g.k * 6, 0.5); c.fill(); }
    });
    // the brewing bay
    H.box(c, 15, 54, 29, 24, 1.4, INK);
    const b = view ? view.brew : (() => { const u = (t % 6) / 6, d = SHOW_DRINKS[Math.floor(t / 6) % 6]; return u < 0.85 ? { liquid: d.liquid, color: d.color, k: Math.min(1, u / 0.65) } : null; })();
    c.fillStyle = H.lin(c, 0, 55, 0, 77, [[0, b ? '#3a1a3a' : '#120626'], [0.4, '#0a0418'], [1, '#0a0418']]); H.rr(c, 16, 55, 27, 22, 1); c.fill();
    if (b) { c.fillStyle = H.rad(c, 29.5, 56, 0, 12, [[0, 'rgba(255,158,61,.35)'], [1, 'rgba(255,158,61,0)']]); c.fillRect(16, 55, 27, 22); }
    c.fillStyle = H.lin(c, 0, 55, 0, 58, [[0, '#ffffff'], [1, C.metalLo]]); H.rr(c, 25, 55, 9, 3, 0.8); c.fill();
    c.fillStyle = C.metalLo; H.rr(c, 28, 57.5, 3, 2.4, 0.5); c.fill();
    if (b) {
      if (b.k < 1) {
        c.strokeStyle = b.liquid; c.lineWidth = 0.9; c.beginPath(); c.moveTo(29.5, 60); c.lineTo(29.5, 75 - b.k * 7.5); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.3; c.setLineDash([0.6, 1.2]); c.lineDashOffset = -t * 12; c.beginPath(); c.moveTo(29.3, 60); c.lineTo(29.3, 75 - b.k * 7.5); c.stroke(); c.setLineDash([]);
      }
      cup(c, 26, 66, b.liquid, b.color, b.k);
      if (b.k > 0.4) {
        c.strokeStyle = 'rgba(241,230,255,.45)'; c.lineWidth = 0.6; c.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const o = ((t * 0.7 + k * 0.33) % 1);
          c.globalAlpha = 1 - o; c.beginPath();
          for (let q = 0; q <= 8; q++) { const yy = 65 - o * 6 - q * 0.6; c.lineTo(27.5 + k * 2 + Math.sin(q * 0.9 + t * 3 + k) * 0.7, yy); }
          c.stroke(); c.globalAlpha = 1;
        }
      }
    }
    c.fillStyle = H.lin(c, 0, 75.8, 0, 77, [[0, C.metal], [1, C.metalLo]]); c.fillRect(17, 75.8, 25, 1.1);
    c.fillStyle = INK; for (let x = 18; x < 41; x += 1.5) c.fillRect(x, 76, 0.5, 0.6);
    // the grounds drawer and its light
    c.fillStyle = sh('#8a3ab9', -0.35); c.fillRect(9, 79, 41, 3);
    H.box(c, 22, 79, 15, 3, 0.6, INK); c.fillStyle = C.metalLo; H.rr(c, 23, 80, 13, 0.9, 0.4); c.fill();
    const gr = view ? view.grounds : 0.3;
    c.save(); const gl = gr >= 1 ? (Math.floor(t * 3) % 2 ? C.alarm : INK) : gr > 0.75 ? C.low : C.lcdOn; H.glow(c, gl, 1.5); c.fillStyle = gl; c.beginPath(); c.arc(40, 80.5, 0.8, 0, 7); c.fill(); c.restore();
    feet(c, 9, 45);
  }

  VT.drawSodaHD = soda;
  VT.drawSnackHD = snackMachine;
  VT.drawGumballHD = gumballMachine;
  VT.drawCoffeeHD = coffee;

  // a machine's art on a canvas at full resolution, like VT.art
  VT.artHD = function (canvas, kind, size) {
    const o = VT.hdCanvas(canvas, 64, 88);
    const fit = () => o.fit(size ? size() : VT.scale());
    fit(); addEventListener('resize', fit);
    const DRAW = { soda, snacks: snackMachine, gumballs: gumballMachine, coffees: coffee };
    return { draw(t) { const c = o.begin(); if (DRAW[kind]) DRAW[kind](c, t, null); } };
  };
})(window.VT);
