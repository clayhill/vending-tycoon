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
    low: '#ff9e3d', sel: '#fffb96', coil: '#3a2470', alarm: '#ff2a6d', alarmDim: '#5a0a2a',
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

  // view (optional) is the live machine: { slots: [{ color, stock, cap }],
  // sel: selected slot, sign: 'SODA' | 'JAM!' | 'FULL', drop: { at, color } }.
  // Without it the machine is a decorative showpiece, fully stocked.
  function soda(fb, t, view) {
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
    const word = (view && view.sign) || 'SODA', alarm = word !== 'SODA';
    const flick = t % 6.2, on = alarm ? Math.floor(t * 2.5) % 2 === 0 : !(flick > 3.1 && flick < 3.22) && !(flick > 3.3 && flick < 3.36);
    const tube = alarm ? P.alarm : P.neon, glow = alarm ? P.alarmDim : P.neonDim;
    const x = 12 + ((35 - VT.textWidth(word)) >> 1);
    if (on) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) VT.text(fb, word, x + dx, 9 + dy, 1, glow);
    VT.text(fb, word, x, 9, 1, on ? tube : alarm ? P.alarmDim : P.neonOff);
    if (on) VT.text(fb, word, x, 9, 1, (gx, gy) => (gy < 2 ? VT.mix(tube, P.white, 0.6) : tube));

    // window with three columns of cans on four shelves
    fb.rect(11, 21, 29, 44, P.ink);
    fb.frame(12, 22, 27, 42, P.metal);
    fb.rect(13, 23, 25, 40, P.glass);
    for (let r = 0; r < 4; r++) {
      const y = 24 + r * 10;
      fb.rect(13, y + 8, 25, 1, P.shelf);
      fb.rect(13, y + 9, 25, 1, P.glassHi);
      for (let c = 0; c < 3; c++) {
        const cx = 14 + c * 8;
        if (!view) { can(fb, cx, y, CANS[(r + c * 2) % CANS.length]); continue; }
        const i = r * 3 + c, s = view.slots[i];
        if (s.stock > 0) can(fb, cx, y, s.color);
        else for (let k = 0; k < 4; k++) fb.rect(cx + (k & 1), y + 1 + k * 2, 6, 1, P.coil); // the empty spiral
        if (view.sel === i && Math.floor(t * 3) % 3) fb.frame(cx - 1, y - 1, 9, 10, P.sel);
        // stock pips along the shelf edge
        for (let k = 0; k < s.cap; k++) fb.px(cx + k, y + 8, k < s.stock ? (s.stock <= 2 ? P.low : P.lcdOn) : P.ink);
      }
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
    // decorative: a can every few seconds; live: the last can sold
    const age = view ? (view.drop ? t - view.drop.at : 99) : ((t % 3.4) / 3.4 - 0.18) * 3.4;
    if (age >= 0 && age < (view ? 2.4 : 2.3)) {
      const bounce = age < 0.27 ? Math.round(Math.sin((age / 0.27) * Math.PI) * -2) : 0;
      const c = view ? view.drop.color : CANS[Math.floor(t / 3.4) % CANS.length], y = 74 + bounce;
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

  VT.drawSoda = soda;
  VT.drawCan = can;

  // ---- the snack machine ----
  const SN = {};
  for (const [k, v] of Object.entries({
    body: '#1186b3', bodyHi: '#44c8ee', bodyLo: '#0a5f82', side: '#08435e', sideLo: '#052f42',
    neon: '#ff71ce', neonDim: '#6a1a4a', neonOff: '#3a1030', coil: '#b9b3d8', coilLo: '#6b5f9e',
    stale: '#7a8a5a', stink: '#9be05a', bill: '#05ffa1',
  })) SN[k] = VT.rgb(v);

  // a snack, 7 wide and 6 tall, drawn by its shape
  function snackItem(fb, x, y, shape, c) {
    const hi = VT.mix(c, P.white, 0.45), lo = VT.mix(c, P.ink, 0.4);
    if (shape === 'bag') { // a crimped bag with a label
      fb.rect(x, y, 7, 1, lo);
      for (let k = 0; k < 7; k += 2) fb.px(x + k, y, hi);
      fb.rect(x, y + 1, 7, 4, c);
      fb.rect(x + 1, y + 1, 1, 4, hi); fb.rect(x + 6, y + 1, 1, 4, lo);
      fb.rect(x + 2, y + 2, 3, 2, P.white); fb.px(x + 3, y + 3, lo);
      fb.rect(x, y + 5, 7, 1, lo);
    } else if (shape === 'bar') { // a wrapped bar standing in the coil
      fb.rect(x + 1, y, 5, 6, c);
      fb.rect(x + 1, y, 5, 1, lo); fb.rect(x + 1, y + 5, 5, 1, lo);
      fb.rect(x + 2, y + 1, 1, 4, hi);
      fb.rect(x + 1, y + 2, 5, 2, P.white); fb.rect(x + 3, y + 2, 2, 2, lo);
    } else if (shape === 'pack') { // cookies in a clear tray
      fb.rect(x, y + 1, 7, 5, VT.mix(P.glass, P.white, 0.35));
      fb.rect(x, y + 1, 7, 1, P.white);
      fb.rect(x + 1, y + 2, 2, 2, c); fb.rect(x + 4, y + 2, 2, 2, c); fb.rect(x + 2, y + 4, 3, 1, c);
      fb.px(x + 2, y + 2, lo); fb.px(x + 4, y + 3, lo); fb.px(x + 3, y + 4, lo);
    } else if (shape === 'gummy') { // a see-through pack of gummies
      fb.rect(x, y, 7, 1, lo);
      fb.rect(x, y + 1, 7, 5, VT.mix(c, P.ink, 0.55));
      const dots = [c, VT.rgb('#ff71ce'), VT.rgb('#fffb96')];
      [[1, 2], [3, 1], [5, 2], [2, 4], [4, 4], [5, 4], [1, 4], [3, 3]].forEach(([dx, dy], k) => fb.px(x + dx, y + dy, dots[k % 3]));
    } else { // 'tub': a round tub with a lid
      fb.rect(x + 1, y, 5, 1, P.metal);
      fb.rect(x, y + 1, 7, 1, P.metalLo);
      fb.rect(x, y + 2, 7, 4, c);
      fb.rect(x + 1, y + 2, 1, 4, hi); fb.rect(x + 6, y + 2, 1, 4, lo);
      fb.rect(x + 2, y + 3, 3, 1, P.white);
    }
  }
  VT.drawSnackItem = snackItem;

  // the showpiece's contents when no game is running
  const SHOW = [['bag', '#ff9e3d'], ['bag', '#ff9e3d'], ['bag', '#01cdfe'], ['bag', '#01cdfe'], ['bar', '#ff2a6d'], ['bar', '#ff2a6d'],
    ['pack', '#e8a86a'], ['pack', '#e8a86a'], ['bag', '#ff9e3d'], ['gummy', '#05ffa1'], ['gummy', '#05ffa1'], ['bar', '#ff2a6d'],
    ['tub', '#b967ff'], ['pack', '#e8a86a'], ['bag', '#01cdfe'], ['bar', '#ff2a6d'], ['bag', '#ff9e3d'], ['tub', '#b967ff'], ['gummy', '#05ffa1'], ['pack', '#e8a86a']];

  // view (optional): { slots: [{ color, shape, stock, cap, stale, hang }],
  // sel, sign, drop: { at, color, shape, two }, busy: a customer is typing }
  function snack(fb, t, view) {
    fb.clear();
    shadow(fb, 5, 58);
    fb.rect(5, 3, 54, 81, P.ink);
    fb.rect(6, 4, 46, 79, SN.body);
    fb.rect(6, 4, 46, 1, SN.bodyHi);
    fb.rect(6, 4, 2, 79, SN.bodyHi);
    fb.rect(50, 4, 2, 79, SN.bodyLo);
    fb.rect(52, 4, 1, 79, P.ink);
    fb.rect(53, 4, 5, 79, SN.side);
    for (let y = 12; y < 78; y += 4) fb.rect(54, y, 3, 1, SN.sideLo);

    // neon sign
    fb.rect(8, 6, 42, 13, P.ink);
    fb.rect(9, 7, 40, 11, P.sign);
    const word = (view && view.sign) || 'SNACKS', alarm = word !== 'SNACKS';
    const flick = (t + 2.3) % 7.1, on = alarm ? Math.floor(t * 2.5) % 2 === 0 : !(flick > 4.0 && flick < 4.1);
    const tube = alarm ? P.alarm : SN.neon, glow = alarm ? P.alarmDim : SN.neonDim;
    const wx = 9 + ((40 - VT.textWidth(word)) >> 1);
    if (on) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) VT.text(fb, word, wx + dx, 9 + dy, 1, glow);
    VT.text(fb, word, wx, 9, 1, on ? (gx, gy) => (gy < 2 ? VT.mix(tube, P.white, 0.6) : tube) : SN.neonOff);

    // window: five shelves of four coils
    fb.rect(8, 20, 37, 50, P.ink);
    fb.frame(9, 21, 35, 48, P.metal);
    fb.rect(10, 22, 33, 46, P.glass);
    for (let r = 0; r < 5; r++) {
      const y = 22 + r * 9;
      fb.rect(10, y + 7, 33, 1, P.shelf);
      fb.rect(10, y + 8, 33, 1, P.glassHi);
      for (let c = 0; c < 4; c++) {
        const x = 11 + c * 8, i = r * 4 + c;
        for (let k = 0; k < 7; k++) fb.px(x + k, y + 6, k % 2 ? SN.coil : SN.coilLo); // the spiral
        if (!view) { snackItem(fb, x, y, SHOW[i][0], VT.rgb(SHOW[i][1])); continue; }
        const s = view.slots[i];
        if (s.stock > 0) {
          const stale = s.stale > 0;
          snackItem(fb, x, y, s.shape, stale ? VT.mix(s.color, SN.stale, 0.7) : s.color);
          if (stale) { const k = Math.floor(t * 4) % 3; fb.px(x + 1 + k * 2, y - (k & 1), SN.stink); fb.px(x + 2 + k, y + 1 - (k & 1), SN.stink); }
        }
        // a snack that got stuck hangs off the end of its coil
        if (s.hang) snackItem(fb, x, y + 3, s.shape, s.color);
        if (view.sel === i && Math.floor(t * 3) % 3) fb.frame(x - 1, y - 1, 9, 9, P.sel);
        for (let k = 0; k < Math.min(7, s.cap); k++) {
          fb.px(x + k, y + 7, k < s.stock ? (k < s.stale ? P.alarm : s.stock <= 2 ? P.low : P.lcdOn) : P.ink);
        }
      }
    }
    const sweep = ((t * 14) % 120) - 30;
    for (let y = 22; y < 68; y++) for (let x = 10; x < 43; x++) {
      const k = x - 10 + (y - 22) * 0.55 - sweep;
      if (k >= 0 && k < 4) fb.blend(x, y, P.white, k < 1 || k >= 3 ? 0.15 : 0.32);
    }

    // keypad panel: display, twelve keys, coin and bill slots, coin return
    fb.rect(45, 20, 6, 50, P.panel);
    fb.frame(44, 20, 8, 50, P.ink);
    fb.rect(45, 22, 6, 5, P.lcd);
    const typing = view ? view.busy : Math.floor(t * 0.7) % 3 === 0;
    const key = typing ? Math.floor(t * 5) % 12 : -1;
    fb.rect(46, 23, 2, 3, P.lcdOn);
    if (Math.floor(t * 2) % 2) fb.rect(49, 23, 1, 3, P.lcdOn);
    for (let k = 0; k < 12; k++) fb.px(46 + (k % 3) * 2, 29 + Math.floor(k / 3) * 2, k === key ? P.sel : P.metal);
    fb.rect(45, 38, 6, 5, P.metal); fb.rect(46, 38, 4, 1, P.white); fb.rect(47, 39, 1, 3, P.slot);
    fb.rect(45, 45, 6, 3, P.slot); fb.rect(46, 46, 4, 1, Math.floor(t * 1.5) % 2 ? SN.bill : P.slot);
    fb.rect(45, 61, 6, 5, P.metalLo); fb.rect(46, 62, 4, 3, P.slot);

    // the pick-up flap, with whatever just dropped
    fb.rect(6, 71, 46, 1, SN.bodyLo);
    fb.rect(8, 73, 37, 9, P.ink);
    fb.rect(9, 74, 35, 7, P.slot);
    fb.rect(9, 74, 35, 2, P.metalLo); fb.rect(9, 74, 35, 1, P.metal);
    const age = view ? (view.drop ? t - view.drop.at : 99) : ((t % 4.1) / 4.1 - 0.2) * 4.1;
    if (age >= 0 && age < 2.4) {
      const bounce = age < 0.27 ? Math.round(Math.sin((age / 0.27) * Math.PI) * -2) : 0;
      const d = view ? view.drop : { shape: SHOW[Math.floor(t / 4.1) % 20][0], color: VT.rgb(SHOW[Math.floor(t / 4.1) % 20][1]) };
      snackItem(fb, 22, 75 + bounce, d.shape, d.color);
      if (d.two) snackItem(fb, 30, 75, d.shape, d.color);
    }
    fb.rect(6, 82, 46, 1, SN.bodyLo);
    fb.rect(8, 84, 5, 2, P.ink); fb.rect(45, 84, 5, 2, P.ink);
  }
  VT.drawSnack = snack;

  // ---- the gumball machine ----
  const GB = {};
  for (const [k, v] of Object.entries({
    red: '#e8204f', redHi: '#ff6f8f', redLo: '#9a0f35', redDk: '#5e0820', gold: '#ffd34a', goldHi: '#fff6b0',
  })) GB[k] = VT.rgb(v);
  const SHOW_MIX = ['#ff2a6d', '#01cdfe', '#05ffa1', '#fffb96', '#b967ff', '#ff9ee0'].map(VT.rgb);
  // where balls sit in the globe, packed from the bottom up
  const GCX = 32, GCY = 27, GR = 19, SPOTS = [];
  for (let row = 0; ; row++) {
    const y = GCY + GR - 4 - row * 3;
    if (y < GCY - GR + 1) break;
    for (let x = GCX - GR + (row % 2 ? 2 : 1); x <= GCX + GR - 3; x += 3) {
      if (Math.hypot(x + 1 - GCX, y + 1 - GCY) <= GR - 2.2) SPOTS.push([x, y]);
    }
  }
  const spotHash = i => ((Math.imul(i + 1, 2654435761) >>> 0) % 10007) / 10007;

  // a 3×3 gumball with a highlight
  function ball(fb, x, y, c) {
    const lo = VT.mix(c, P.ink, 0.4);
    fb.rect(x, y, 3, 3, c);
    fb.px(x + 2, y + 2, lo); fb.px(x, y + 2, lo); fb.px(x + 2, y, lo);
    fb.px(x, y, VT.mix(c, P.white, 0.6));
  }
  VT.drawGumball = function (fb, x, y, c) { ball(fb, x, y, c); };

  // view (optional): { slots: [{ color, stock, prize }], total, cap, price,
  // sign, drop: { at, color }, busy: someone is turning the crank }
  function gumball(fb, t, view) {
    fb.clear();
    shadow(fb, 14, 50);
    // the glass globe and the balls inside, filled to the globe's level
    for (let y = GCY - GR - 1; y <= GCY + GR + 1; y++) for (let x = GCX - GR - 1; x <= GCX + GR + 1; x++) {
      const d = Math.hypot(x + 0.5 - GCX, y + 0.5 - GCY);
      if (d <= GR - 0.5) fb.px(x, y, P.glass);
      else if (d <= GR + 0.6) fb.px(x, y, P.metalLo);
      else if (d <= GR + 1.5) fb.px(x, y, P.ink);
    }
    const total = view ? view.total : 1, cap = view ? view.cap : 1;
    const n = Math.round(SPOTS.length * Math.min(1, total / cap));
    // each spot's colour comes from the globe's mix, the same spot staying the same colour
    const cum = [];
    if (view) { let a = 0; for (const s of view.slots) { a += s.stock / Math.max(1, total); cum.push(a); } }
    for (let i = 0; i < n; i++) {
      const [x, y] = SPOTS[i], u = spotHash(i);
      let c;
      if (!view) c = SHOW_MIX[Math.floor(u * SHOW_MIX.length)];
      else { let k = 0; while (k < cum.length - 1 && u >= cum[k]) k++; c = view.slots[k].color; if (view.slots[k].prize) c = Math.floor(t * 3 + i) % 4 ? GB.gold : GB.goldHi; }
      ball(fb, x, y, c);
    }
    // the glass shine
    for (let k = 0; k < 9; k++) {
      const a = -2.3 + k * 0.12;
      fb.blend(Math.round(GCX + Math.cos(a) * (GR - 4)), Math.round(GCY + Math.sin(a) * (GR - 4)), P.white, 0.7);
      fb.blend(Math.round(GCX + Math.cos(a) * (GR - 5)), Math.round(GCY + Math.sin(a) * (GR - 5)), P.white, 0.3);
    }
    // the lid and its knob
    fb.rect(25, 5, 15, 4, P.ink); fb.rect(26, 6, 13, 3, GB.red); fb.rect(26, 6, 13, 1, GB.redHi);
    fb.rect(30, 2, 5, 4, P.ink); fb.rect(31, 3, 3, 3, GB.red); fb.px(31, 3, GB.redHi);
    // the collar under the globe
    fb.rect(17, 45, 31, 4, P.ink); fb.rect(18, 46, 29, 2, P.metal); fb.rect(18, 47, 29, 1, P.metalLo);

    // the body: a cast red head with the coin mechanism and the crank
    fb.rect(17, 49, 31, 20, P.ink);
    fb.rect(18, 49, 29, 19, GB.red);
    fb.rect(18, 49, 2, 19, GB.redHi); fb.rect(44, 49, 3, 19, GB.redLo);
    fb.rect(24, 51, 17, 13, P.ink); fb.rect(25, 52, 15, 11, P.metal);
    fb.rect(25, 62, 15, 1, P.metalLo); fb.rect(25, 52, 15, 1, P.white);
    // price plate, or an alarm
    // the price plate: cents ("50"), dollars and dimes ("1.2"), or a flashing "!"
    const alarm = view && view.sign, flash = Math.floor(t * 2.5) % 2 === 0;
    fb.rect(26, 53, 7, 5, alarm && flash ? P.alarm : P.ink);
    if (alarm) { if (flash) { fb.rect(29, 54, 1, 2, P.white); fb.px(29, 57, P.white); } }
    else {
      const cents = view ? Math.round(view.price * 100) : 25;
      if (cents < 100) VT.tiny(fb, String(cents).padStart(2, '0'), 26, 53, P.lcdOn);
      else {
        VT.tiny(fb, String(Math.floor(cents / 100) % 10), 26, 53, P.lcdOn);
        fb.px(29, 57, P.lcdOn);
        VT.tiny(fb, String(Math.floor((cents % 100) / 10)), 30, 53, P.lcdOn);
      }
    }
    fb.rect(28, 59, 3, 1, P.slot); // coin slot
    // the crank: a knob with a handle that turns while someone is buying
    const turning = view ? view.busy : Math.floor(t * 0.5) % 3 === 0;
    const ang = turning ? t * 5 : 0.9;
    fb.rect(34, 54, 5, 5, P.ink); fb.rect(35, 55, 3, 3, P.metalLo); fb.px(36, 56, P.white);
    for (let k = 1; k <= 3; k++) fb.px(Math.round(36 + Math.cos(ang) * k), Math.round(56 + Math.sin(ang) * k), P.ink);
    fb.rect(Math.round(36 + Math.cos(ang) * 4) - 1, Math.round(56 + Math.sin(ang) * 4) - 1, 2, 2, GB.redHi);
    // the chute, where the ball rolls out
    fb.rect(28, 64, 9, 4, P.ink); fb.rect(29, 65, 7, 2, P.slot); fb.rect(29, 64, 7, 1, P.metalLo);
    const age = view ? (view.drop ? t - view.drop.at : 99) : ((t % 3.6) / 3.6 - 0.25) * 3.6;
    if (age >= 0 && age < 2.4) {
      const roll = Math.min(3, Math.floor(age * 8));
      const c = view ? view.drop.color : SHOW_MIX[Math.floor(t / 3.6) % 6];
      ball(fb, 29 + roll, 64, c);
    }
    // stand and base
    fb.rect(29, 68, 7, 14, P.ink); fb.rect(30, 68, 5, 14, GB.redLo); fb.rect(30, 68, 1, 14, GB.red);
    for (let k = 0; k < 3; k++) fb.rect(30, 71 + k * 4, 5, 1, GB.redDk);
    fb.rect(17, 80, 31, 5, P.ink); fb.rect(18, 81, 29, 3, GB.red); fb.rect(18, 81, 29, 1, GB.redHi); fb.rect(18, 83, 29, 1, GB.redLo);
  }
  VT.drawGumballMachine = gumball;

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
        if (kind === 'soda') soda(fb, t);
        else if (kind === 'snacks') snack(fb, t);
        else if (kind === 'gumballs') gumball(fb, t);
        else locked(fb, t, kind);
        fb.flush();
      },
    };
  };
})(window.VT);
