/* The things that should never come out of a vending machine, and what
 * happens when one of them is TNT: the oddities as pixel sprites and vector
 * drawings, the explosion (flash, fireball, shockwave, debris, sparks), the
 * smoking wreck left behind, and the dust when a new machine lands. Pixel
 * and HD versions follow the same timings and the same geometry, given in
 * stage units: { x0, x1 } the machine's width, top and base its height. */
(function (VT) {
  'use strict';

  // ---- the oddities ----
  const OPAL = {
    k: '#0d0221', w: '#f1e6ff', p: '#ff71ce', r: '#ff2a6d', y: '#fffb96', o: '#ff9e3d', c: '#01cdfe',
    g: '#05ffa1', v: '#b967ff', s: '#9a95c8', d: '#3b1a63', b: '#7a4a2a', n: '#d9a066', m: '#a0102e', e: '#1f9e5a', u: '#2f62d8',
  };
  const PIX = {};
  for (const k in OPAL) PIX[k] = VT.rgb(OPAL[k]);
  const SPR = {
    duck: ['...yyy...', '..yyyky..', '..yyyyoo.', 'yy.yyy...', 'yyyyyyyy.', '.yyyyyyo.', '..yyyyy..'],
    fish: ['.......c.', '...ccc...', 'c.cccccc.', 'ccccwcckc', 'c.cccccc.', '...ccc...', '.c.......'],
    boot: ['.bbb.....', '.bnb.....', '.bbb.....', '.bnb.....', '.bbbbbb..', 'bbbbbbbb.', 'kssssssk.'],
    tape: ['ppppppppp', 'pwwwwwwwp', 'pwkwwwkwp', 'pwwwwwwwp', 'pp.sss.pp', 'ppppppppp', '.........'],
    cactus: ['....g....', '.g..g..g.', '.gg.g.gg.', '..ggegg..', '....g....', '..ooooo..', '...ooo...'],
    gnome: ['....r....', '...rrr...', '..rrrrr..', '..wnnnw..', '..wwwww..', '.uwwwwwu.', '..uu.uu..'],
    tnt: ['.....y...', '.c...k.v.', 'rmkrmkrm.', 'rmkrmkrm.', 'nnnnnnnn.', 'rmkrmkrm.', 'rmkrmkrm.'],
  };
  const INK = PIX.k;

  // an oddity centred on (cx, cy), with an ink outline so it reads anywhere
  VT.drawOddity = function (fb, cx, cy, kind, t) {
    const rows = SPR[kind];
    if (!rows) return;
    const x0 = Math.round(cx) - 4, y0 = Math.round(cy) - 3;
    const on = (i, j) => j >= 0 && j < 7 && i >= 0 && i < 9 && rows[j][i] !== '.';
    for (let j = -1; j <= 7; j++) for (let i = -1; i <= 9; i++) {
      if (on(i, j)) continue;
      if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) fb.px(x0 + i, y0 + j, INK);
    }
    const spark = [PIX.y, PIX.w, PIX.o, PIX.r][Math.floor(t * 14) & 3];
    rows.forEach((row, j) => {
      for (let i = 0; i < 9; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        fb.px(x0 + i, y0 + j, kind === 'tnt' && j === 0 ? spark : PIX[ch]);
      }
    });
    // the lit fuse spits sparks
    if (kind === 'tnt') for (let k = 0; k < 3; k++) {
      const a = t * 9 + k * 2.1, r = 1 + ((t * 7 + k) % 2);
      fb.px(x0 + 5 + Math.round(Math.cos(a) * r), y0 - Math.round(Math.abs(Math.sin(a)) * r), k ? PIX.y : PIX.w);
    }
  };

  // ---- the oddities in HD: about 9 × 7 units, centred on (cx, cy) ----
  function oddityHD(c, cx, cy, kind, t) {
    const H = VT.HD;
    c.save();
    c.translate(cx, cy);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = H.INK; c.lineWidth = 0.5;
    const blob = (fill, path) => { c.beginPath(); path(); c.fillStyle = fill; c.fill(); c.stroke(); };
    switch (kind) {
      case 'duck':
        blob(H.lin(c, 0, -3, 0, 3.5, [[0, '#fffbc4'], [1, '#f6d743']]), () => {
          c.moveTo(-4.3, -0.6); c.quadraticCurveTo(-3.2, 3.6, 0.5, 3.4); c.quadraticCurveTo(4.2, 3.4, 3.8, 0.4);
          c.quadraticCurveTo(2.2, 0.8, 1, 0.2); c.quadraticCurveTo(-1.5, 0.8, -4.3, -0.6);
        });
        blob('#fff070', () => c.arc(1.6, -1.4, 2.1, 0, 7));
        blob('#ff9e3d', () => { c.moveTo(3.3, -1.6); c.quadraticCurveTo(5.4, -1.4, 5.2, -0.6); c.quadraticCurveTo(4.2, -0.3, 3.4, -0.6); });
        c.fillStyle = H.INK; c.beginPath(); c.arc(2.3, -1.9, 0.38, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-1, 0.9, 1.6, 0.6, -0.3, 0, 7); c.fill();
        break;
      case 'fish':
        blob(H.lin(c, 0, -2.5, 0, 2.5, [[0, '#7fe9ff'], [0.55, '#01cdfe'], [1, '#2f62d8']]), () => {
          c.moveTo(-2.8, 0); c.quadraticCurveTo(0.5, -3.2, 4.4, -0.2); c.quadraticCurveTo(0.5, 3, -2.8, 0);
        });
        blob('#2f9ee8', () => { c.moveTo(-2.6, 0); c.lineTo(-4.6, -2); c.lineTo(-4.2, 0); c.lineTo(-4.6, 2); c.closePath(); });
        c.fillStyle = '#fff'; c.beginPath(); c.arc(2.6, -0.6, 0.6, 0, 7); c.fill();
        c.fillStyle = H.INK; c.beginPath(); c.arc(2.75, -0.6, 0.3, 0, 7); c.fill();
        c.strokeStyle = 'rgba(13,2,33,.5)'; c.lineWidth = 0.3; c.beginPath(); c.arc(1, 0, 1.2, -1, 1); c.stroke();
        // drips
        c.fillStyle = '#9ff3ff';
        for (let k = 0; k < 2; k++) { const f = (t * 0.9 + k * 0.5) % 1; c.globalAlpha = 1 - f; c.beginPath(); c.arc(-0.5 + k * 2.2, 1.8 + f * 3, 0.35, 0, 7); c.fill(); }
        break;
      case 'boot':
        blob(H.lin(c, -4, 0, 4, 0, [[0, '#5a3218'], [0.5, '#8a5630'], [1, '#6a3d20']]), () => {
          c.moveTo(-3.4, -3.6); c.lineTo(-0.6, -3.6); c.lineTo(-0.4, 0.4); c.quadraticCurveTo(3.8, 0.6, 4.2, 2.2);
          c.lineTo(4.2, 2.8); c.lineTo(-3.8, 2.8); c.closePath();
        });
        c.fillStyle = '#2a1808'; c.fillRect(-3.8, 2.4, 8, 0.8);
        c.strokeStyle = '#d9a066'; c.lineWidth = 0.35;
        for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-2.8, -2.6 + k * 1.1); c.lineTo(-1.2, -2.2 + k * 1.1); c.stroke(); }
        c.fillStyle = '#d9a066'; c.beginPath(); c.arc(1.2, 1.4, 0.35, 0, 7); c.fill(); // a hole in the toe
        break;
      case 'tape':
        c.fillStyle = H.lin(c, 0, -3, 0, 3, [[0, '#ff9ae0'], [1, '#ff2a9d']]);
        H.rr(c, -4.5, -3, 9, 6, 0.8); c.fill(); c.stroke();
        c.fillStyle = '#f7f0ff'; H.rr(c, -3.6, -2.3, 7.2, 2.9, 0.4); c.fill();
        c.fillStyle = '#ff71ce'; c.fillRect(-3.6, -2.3, 7.2, 0.6);
        c.fillStyle = H.INK; c.font = H.font(0.9, 900); c.textAlign = 'center'; c.fillText('MIX 87', 0, 0.2);
        for (const x of [-1.8, 1.8]) { c.fillStyle = '#3b1a63'; c.beginPath(); c.arc(x, -0.4, 0.75, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, -0.4, 0.3, 0, 7); c.fill(); }
        c.fillStyle = '#9a95c8'; c.beginPath(); c.moveTo(-2.6, 3); c.lineTo(-2, 1.6); c.lineTo(2, 1.6); c.lineTo(2.6, 3); c.fill();
        break;
      case 'cactus':
        blob(H.lin(c, -2, 0, 2, 0, [[0, '#0e8a4a'], [0.5, '#2ee88a'], [1, '#12a050']]), () => {
          H.rr(c, -1.1, -3.8, 2.2, 6, 1.1);
          H.rr(c, -3.4, -2.4, 1.7, 3, 0.85); H.rr(c, 1.7, -2.8, 1.7, 3, 0.85);
          c.rect(-2.2, -0.2, 1.4, 1); c.rect(0.8, -0.6, 1.4, 1);
        });
        c.fillStyle = '#ff71ce'; c.beginPath(); c.arc(0, -3.9, 0.7, 0, 7); c.fill(); // a flower
        c.strokeStyle = '#f1e6ff'; c.lineWidth = 0.2;
        for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(-1.1, -2.5 + k); c.lineTo(-1.6, -2.7 + k); c.moveTo(1.1, -2.2 + k * 0.9); c.lineTo(1.6, -2.4 + k * 0.9); c.stroke(); }
        c.strokeStyle = H.INK; c.lineWidth = 0.5;
        blob(H.lin(c, 0, 1.8, 0, 3.8, [[0, '#e07a3a'], [1, '#a84a1a']]), () => { c.moveTo(-2.4, 1.8); c.lineTo(2.4, 1.8); c.lineTo(1.8, 3.8); c.lineTo(-1.8, 3.8); c.closePath(); });
        break;
      case 'gnome':
        blob(H.lin(c, -2, 0, 2, 0, [[0, '#2040a8'], [1, '#3f7cf0']]), () => { c.moveTo(-2.6, 3.6); c.quadraticCurveTo(-2.6, 0.4, 0, 0.4); c.quadraticCurveTo(2.6, 0.4, 2.6, 3.6); c.closePath(); });
        blob('#f7f0ff', () => { c.moveTo(-1.9, -0.8); c.quadraticCurveTo(0, 4.4, 1.9, -0.8); c.closePath(); });
        blob('#f3cfb3', () => c.ellipse(0, -1.2, 1.5, 1.1, 0, 0, 7));
        c.fillStyle = '#ff8a8a'; c.beginPath(); c.arc(0.3, -0.9, 0.5, 0, 7); c.fill(); // nose
        blob(H.lin(c, 0, -4.6, 0, -1.6, [[0, '#ff5a8a'], [1, '#d0103e']]), () => { c.moveTo(-2, -1.7); c.quadraticCurveTo(-0.2, -6, 1.4, -4.8); c.quadraticCurveTo(0.8, -3.2, 2, -1.7); c.closePath(); });
        c.fillStyle = '#3a1a10'; c.fillRect(-2.6, 3.4, 2.2, 0.6); c.fillRect(0.4, 3.4, 2.2, 0.6);
        break;
      case 'tnt': {
        // three sticks of dynamite, taped, with wires and a lit fuse
        for (let k = 0; k < 3; k++) {
          const x = -3.6 + k * 2.3;
          c.fillStyle = H.lin(c, x, 0, x + 2.2, 0, [[0, '#ff6a7a'], [0.45, '#e8203a'], [1, '#8a0a20']]);
          H.rr(c, x, -2.6, 2.2, 6, 0.6); c.fill(); c.stroke();
          c.fillStyle = '#d9a066'; c.fillRect(x + 0.3, -2.6, 1.6, 0.5);
        }
        c.fillStyle = '#1a1030'; c.fillRect(-3.8, 0, 7.3, 1.2);
        c.fillStyle = '#fffb96'; c.font = H.font(1.05, 900); c.textAlign = 'center'; c.fillText('TNT', -0.1, 3);
        // the wires
        c.lineWidth = 0.4;
        c.strokeStyle = '#01cdfe'; c.beginPath(); c.moveTo(-3, 0.6); c.bezierCurveTo(-5.4, 0, -5, -3.5, -2.6, -3.4); c.stroke();
        c.strokeStyle = '#ff9e3d'; c.beginPath(); c.moveTo(3, 0.6); c.bezierCurveTo(5.4, 1.4, 5.8, -2.6, 3.6, -3); c.stroke();
        // the fuse and its spark
        c.strokeStyle = '#3b1a63'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(1, -2.6); c.quadraticCurveTo(1.4, -4.4, 3, -4.6); c.stroke();
        const fl = 0.75 + Math.sin(t * 40) * 0.25;
        c.save(); H.glow(c, '#ff9e3d', 4);
        c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(3.1, -4.6, 0.9 * fl, 0, 7); c.fill();
        c.restore();
        c.strokeStyle = '#fffb96'; c.lineWidth = 0.25;
        for (let k = 0; k < 5; k++) {
          const a = t * 11 + k * 1.3, r = 1 + ((t * 6 + k * 0.37) % 1) * 1.6;
          c.beginPath(); c.moveTo(3.1, -4.6); c.lineTo(3.1 + Math.cos(a) * r, -4.6 - Math.abs(Math.sin(a)) * r); c.stroke();
        }
        break;
      }
    }
    c.restore();
  }

  // ---- the explosion ----
  const rnd = seed => () => (seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296;
  const DUR = 4.5; // seconds until the last debris has settled and faded

  // g = { x0, x1, top, base, cx, cy }; colours: hex strings (body, then extras)
  VT.makeBoom = function (g, colors, seed) {
    const r = rnd(seed * 7919 + 1), parts = [];
    const pal = ['#0d0221', '#3b1a63', '#9a95c8', '#f1e6ff'].concat(colors);
    for (let k = 0; k < 46; k++) {
      const a = -Math.PI * (0.06 + r() * 0.88), sp = 40 + r() * 110;
      parts.push({
        x: g.x0 + r() * (g.x1 - g.x0), y: g.top + r() * (g.base - g.top) * 0.8,
        vx: Math.cos(a) * sp * (r() < 0.5 ? 1 : -1) * 0.8, vy: Math.sin(a) * sp,
        w: 1 + Math.floor(r() * 4), h: 1 + Math.floor(r() * 3), spin: (r() - 0.5) * 14,
        col: k < 10 ? colors[0] : pal[Math.floor(r() * pal.length)],
      });
    }
    const sparks = [];
    for (let k = 0; k < 60; k++) {
      const a = r() * Math.PI * 2, sp = 60 + r() * 170;
      sparks.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.3 + r() * 0.6 });
    }
    return { g, parts, sparks, seed };
  };
  VT.boomDone = (b, age) => age > DUR;
  const G = 170; // gravity, units/s²
  function partAt(p, age, floor) {
    // fly, fall and come to rest on the pavement (one small bounce)
    let x = p.x + p.vx * age, y = p.y + p.vy * age + 0.5 * G * age * age, rot = p.spin * age;
    if (y > floor) {
      const tHit = (-p.vy + Math.sqrt(Math.max(0, p.vy * p.vy + 2 * G * (floor - p.y)))) / G;
      const vy = -(p.vy + G * tHit) * 0.3, dt = age - tHit, bx = p.x + p.vx * tHit;
      y = floor + vy * dt + 0.5 * G * dt * dt;
      x = bx + p.vx * 0.4 * Math.min(dt, 0.4);
      rot = p.spin * tHit;
      if (y > floor) y = floor;
    }
    return [x, y, rot];
  }
  // flash, fireball and shockwave strength at an age
  const flashA = age => Math.max(0, 1 - age / 0.18);
  const fireR = age => (age < 0.5 ? 10 + 34 * Math.sqrt(age / 0.5) : 44 + (age - 0.5) * 6);
  const fireA = age => Math.max(0, 1 - Math.max(0, age - 0.25) / 0.9);
  const ringR = age => age * 240, ringA = age => Math.max(0, 1 - age / 0.45);

  VT.drawBoom = function (fb, b, age, W, H) {
    const g = b.g, floor = g.base;
    const C = { w: PIX.w, y: PIX.y, o: PIX.o, r: PIX.r, m: PIX.m, k: VT.rgb('#2a1030'), s: VT.rgb('#5a4a70') };
    // fireball: hot white core to red rim, burning down to smoke
    const fr = fireR(age), fa = fireA(age);
    if (fa > 0) {
      const R = Math.ceil(fr);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = g.cx + dx, y = g.cy + dy * 0.85;
        if (y > floor + 2) continue;
        // a lumpy edge
        const ang = Math.atan2(dy, dx), lump = 1 + 0.14 * Math.sin(ang * 5 + b.seed) + 0.08 * Math.sin(ang * 9 - age * 6);
        const d = Math.sqrt(dx * dx + dy * dy) / (fr * lump);
        if (d > 1) continue;
        const heat = d + (1 - fa) * 0.9 + VT.bayer(x, y) * 0.18;
        const col = heat < 0.3 ? C.w : heat < 0.5 ? C.y : heat < 0.72 ? C.o : heat < 0.9 ? C.r : heat < 1.1 ? C.m : heat < 1.4 ? C.k : C.s;
        if (heat > 1.55 && VT.bayer(x, y) > fa * 2) continue;
        fb.px(x, y, col);
      }
    }
    // the shockwave
    if (ringA(age) > 0) {
      const R = ringR(age);
      for (let k = 0; k < 160; k++) {
        const a = (k / 160) * Math.PI * 2, x = g.cx + Math.cos(a) * R, y = g.cy + Math.sin(a) * R * 0.6;
        if (y < floor && VT.bayer(x | 0, y | 0) < ringA(age)) fb.px(x, y, C.w);
      }
    }
    // sparks
    for (const s of b.sparks) {
      if (age > s.life) continue;
      const x = g.cx + s.vx * age, y = g.cy + s.vy * age + 0.5 * G * age * age;
      fb.px(x, y, age < s.life * 0.5 ? C.y : C.o);
    }
    // debris
    for (const p of b.parts) {
      const [x, y] = partAt(p, age, floor);
      if (age > DUR - 1 && VT.bayer(x | 0, y | 0) < (age - (DUR - 1))) continue;
      const col = VT.rgb(p.col), hot = age < 0.6 ? VT.mix(col, C.o, 0.5) : col;
      fb.rect(Math.round(x), Math.round(y) - p.h, p.w, p.h, hot);
    }
    // the white flash over everything
    const f = flashA(age);
    if (f > 0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (VT.bayer(x, y) < f) fb.px(x, y, C.w);
  };

  VT.drawBoomHD = function (c, b, age, W, Hh) {
    const g = b.g, H = VT.HD, floor = g.base;
    c.save();
    const fr = fireR(age), fa = fireA(age);
    if (fa > 0) {
      c.globalCompositeOperation = 'lighter';
      // a few overlapping lobes make a billowing fireball
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + b.seed, d = k ? fr * 0.38 : 0;
        const x = g.cx + Math.cos(a) * d, y = Math.min(floor - 4, g.cy + Math.sin(a) * d * 0.7 - age * 8 * k / 7), r = fr * (k ? 0.62 : 0.85);
        c.globalAlpha = fa * (k ? 0.7 : 1);
        c.fillStyle = H.rad(c, x, y, 0, r, [[0, '#ffffff'], [0.25, '#fff6a0'], [0.5, '#ff9e3d'], [0.78, 'rgba(255,42,109,.6)'], [1, 'rgba(160,16,46,0)']]);
        c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      // the dark smoke it leaves behind
      const sa = Math.min(1, Math.max(0, age - 0.35) * 2) * Math.max(0, 1 - (age - 1.2) / 2.4);
      if (sa > 0) for (let k = 0; k < 6; k++) {
        const x = g.cx + (k - 2.5) * 9, y = g.cy - age * 14 - (k % 2) * 6, r = 10 + age * 7;
        c.globalAlpha = sa * 0.55;
        c.fillStyle = H.rad(c, x, y, 0, r, [[0, 'rgba(42,16,48,1)'], [1, 'rgba(42,16,48,0)']]);
        c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
    }
    // shockwave
    const ra = ringA(age);
    if (ra > 0) {
      c.globalAlpha = ra; c.strokeStyle = '#ffffff'; c.lineWidth = 2.5 * ra + 0.3;
      c.beginPath(); c.ellipse(g.cx, g.cy, ringR(age), ringR(age) * 0.6, 0, 0, 7); c.stroke();
    }
    // sparks as short streaks
    c.globalAlpha = 1; c.lineCap = 'round';
    for (const s of b.sparks) {
      if (age > s.life) continue;
      const x = g.cx + s.vx * age, y = g.cy + s.vy * age + 0.5 * G * age * age;
      c.strokeStyle = age < s.life * 0.5 ? '#fffb96' : '#ff9e3d'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - s.vx * 0.02, y - (s.vy + G * age) * 0.02); c.stroke();
    }
    // debris, tumbling
    for (const p of b.parts) {
      const [x, y, rot] = partAt(p, age, floor);
      c.globalAlpha = age > DUR - 1 ? Math.max(0, DUR - age) : 1;
      c.save(); c.translate(x, y - p.h / 2); c.rotate(rot);
      c.fillStyle = age < 0.6 ? H.shade(p.col, 0.3) : p.col;
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.strokeStyle = H.INK; c.lineWidth = 0.3; c.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      if (age < 1.2) { c.globalAlpha *= 1 - age / 1.2; c.fillStyle = '#ff9e3d'; c.fillRect(-p.w / 2, -p.h / 2, p.w, 0.5); }
      c.restore();
    }
    const f = flashA(age);
    if (f > 0) { c.globalAlpha = f; c.fillStyle = '#fffdf0'; c.fillRect(0, 0, W, Hh); }
    c.restore();
  };

  // ---- the wreck: a charred, smoking heap where the machine was ----
  // the torn-off stump of the cabinet: a jagged top, one side wall still
  // standing, two bent frame posts and rubble scattered round it
  function heights(g, n) {
    const r = rnd(n * 104729 + 7), w = Math.round(g.x1 - g.x0), hs = [], right = r() < 0.5;
    let jag = 0;
    for (let i = 0; i <= w; i++) {
      const u = i / w, env = 1 - Math.pow(Math.abs(2 * u - 1), 4);
      jag = (jag + (r() - 0.5) * 7) * 0.75;
      let h = 7 + 15 * env + jag - (r() < 0.1 ? r() * 7 : 0);
      const side = right ? 1 - u : u;
      if (side < 0.12) h = 34 + r() * 6 - side * 60;
      hs.push(Math.round(Math.max(3, Math.min(42, h))));
    }
    const posts = [[Math.round(w * (0.3 + r() * 0.1)), 30 + r() * 10, -0.5 + r() * 0.3], [Math.round(w * (0.62 + r() * 0.1)), 22 + r() * 12, 0.3 + r() * 0.5]];
    const rubble = [];
    for (let k = 0; k < 9; k++) rubble.push([(k & 1 ? g.x1 + 2 + r() * 22 : g.x0 - 2 - r() * 22), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)]);
    return { hs, posts, rubble };
  }
  // smoke puffs and flames, from the time alone
  const puffs = (g, t, k) => {
    const f = (t * 0.22 + k / 7) % 1, w = g.x1 - g.x0;
    return { x: g.x0 + w * (0.2 + ((k * 0.37) % 0.6)) + Math.sin(t * 0.8 + k) * 3 + f * 10, y: g.base - 12 - f * 70, r: 3 + f * 9, a: (1 - f) * Math.min(1, f * 6) };
  };

  VT.drawWreck = function (fb, g, t, n) {
    const { hs, posts, rubble } = heights(g, n);
    const CH = VT.rgb('#1a0c22'), CH2 = VT.rgb('#2e1838'), BODY = VT.mix(VT.rgb(g.body), CH, 0.55), BODY2 = VT.mix(VT.rgb(g.body), CH, 0.3), EMB = PIX.o, HOT = PIX.y, MET = VT.rgb('#5a5070');
    const x0 = Math.round(g.x0);
    for (const [x, w, h] of rubble) fb.rect(Math.round(x), g.base - h + 1, w, h, BODY);
    // frame posts
    for (const [i, len, lean] of posts) for (let j = 0; j < len; j++) {
      const x = x0 + i + Math.round(lean * j * 0.6), y = g.base - j;
      fb.px(x, y, MET); fb.px(x + 1, y, CH);
    }
    hs.forEach((h, i) => {
      for (let j = 0; j < h; j++) {
        const x = x0 + i, y = g.base - j, b = VT.bayer(x, y);
        // scorched from the top down; the plinth still shows some paint
        const burn = (h - j) / h;
        let col = j > h - 2 ? CH : j < 5 && i > 1 && i < hs.length - 2 ? (b < 0.6 ? BODY2 : BODY) : b < 0.25 + burn * 0.35 ? BODY : b < 0.75 ? CH2 : CH;
        if (i === 0 || i === hs.length - 1) col = CH;
        // embers glow near the top and pulse
        const glow = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.7);
        if (j > h - 4 && j < h - 1 && b > 0.9 - glow * 0.12) col = glow > 0.8 ? HOT : EMB;
        fb.px(x, y, col);
      }
    });
    // flames licking up from three spots
    for (let k = 0; k < 3; k++) {
      const i = Math.round(hs.length * (0.25 + k * 0.25)), h = hs[i] || 6, fh = 5 + 3 * Math.sin(t * 7 + k * 2) + 2 * Math.sin(t * 13 + k);
      for (let j = 0; j < fh; j++) {
        const w = Math.max(0, Math.round((1 - j / fh) * 2.5)), y = g.base - h - j, sway = Math.round(Math.sin(t * 9 + j * 0.6 + k) * (j / fh) * 1.5);
        for (let dx = -w; dx <= w; dx++) {
          const e = Math.abs(dx) / (w + 1) + j / fh;
          fb.px(x0 + i + dx + sway, y, e < 0.45 ? HOT : e < 0.85 ? EMB : PIX.r);
        }
      }
    }
    // smoke
    for (let k = 0; k < 7; k++) {
      const p = puffs(g, t, k), R = Math.ceil(p.r), col = k & 1 ? VT.rgb('#3a2a4a') : VT.rgb('#4e3e60');
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > p.r * p.r) continue;
        const x = Math.round(p.x + dx), y = Math.round(p.y + dy);
        if (VT.bayer(x, y) < p.a * 0.55) fb.px(x, y, col);
      }
    }
  };

  VT.drawWreckHD = function (c, g, t, n) {
    const H = VT.HD, { hs, posts, rubble } = heights(g, n);
    c.save();
    // smoke behind
    for (let k = 0; k < 7; k++) {
      const p = puffs(g, t, k);
      c.globalAlpha = p.a * 0.6;
      c.fillStyle = H.rad(c, p.x, p.y, 0, p.r * 1.3, [[0, k & 1 ? 'rgba(58,42,74,1)' : 'rgba(78,62,96,1)'], [1, 'rgba(58,42,74,0)']]);
      c.beginPath(); c.arc(p.x, p.y, p.r * 1.3, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    // bent posts
    c.lineCap = 'round';
    for (const [i, len, lean] of posts) {
      const x = g.x0 + i;
      c.strokeStyle = H.INK; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, g.base); c.quadraticCurveTo(x + lean * len * 0.2, g.base - len * 0.6, x + lean * len * 0.6, g.base - len); c.stroke();
      c.strokeStyle = '#6a6080'; c.lineWidth = 1.3; c.stroke();
    }
    // the heap
    c.beginPath(); c.moveTo(g.x0, g.base);
    hs.forEach((h, i) => c.lineTo(g.x0 + i, g.base - h));
    c.lineTo(g.x0 + hs.length - 1, g.base); c.closePath();
    c.fillStyle = H.lin(c, 0, g.base - 20, 0, g.base, [[0, H.shade(g.body, -0.72)], [0.5, '#2a1434'], [1, '#12061a']]);
    c.fill(); c.strokeStyle = H.INK; c.lineWidth = 0.6; c.stroke();
    // the plinth, still with some paint on it
    c.fillStyle = H.lin(c, 0, g.base - 5, 0, g.base, [[0, H.shade(g.body, -0.45)], [1, H.shade(g.body, -0.65)]]);
    c.fillRect(g.x0 + 1, g.base - 5, hs.length - 3, 5);
    c.fillStyle = H.shade(g.body, -0.55);
    for (const [x, w, h] of rubble) { c.fillRect(x, g.base - h, w, h); c.strokeRect(x, g.base - h, w, h); }
    // twisted panels and a blown-out door
    c.fillStyle = H.shade(g.body, -0.5);
    c.save(); c.translate(g.x0 + hs.length * 0.42, g.base - hs[Math.round(hs.length * 0.42)] + 2); c.rotate(-0.5); c.fillRect(-5, -1.5, 10, 3); c.strokeRect(-5, -1.5, 10, 3); c.restore();
    c.fillStyle = '#3b3a5a';
    c.save(); c.translate(g.x0 + hs.length * 0.66, g.base - 4); c.rotate(0.35); c.fillRect(-6, -2.5, 12, 4); c.strokeRect(-6, -2.5, 12, 4); c.restore();
    // embers along the top
    c.globalCompositeOperation = 'lighter';
    for (let i = 2; i < hs.length - 2; i += 3) {
      const glow = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.7);
      c.globalAlpha = glow * 0.7;
      c.fillStyle = glow > 0.85 ? '#ffd27a' : '#ff6a2a';
      c.beginPath(); c.arc(g.x0 + i, g.base - hs[i] + 1.6, 0.3 + glow * 0.35, 0, 7); c.fill();
    }
    // flames
    for (let k = 0; k < 3; k++) {
      const i = Math.round(hs.length * (0.25 + k * 0.25)), x = g.x0 + i, y = g.base - (hs[i] || 6) + 1;
      const fh = 7 + 3 * Math.sin(t * 7 + k * 2) + 2 * Math.sin(t * 13 + k), sway = Math.sin(t * 9 + k) * 1.6;
      c.globalAlpha = 0.95;
      c.fillStyle = H.lin(c, 0, y - fh, 0, y, [[0, 'rgba(255,42,109,0)'], [0.35, '#ff2a6d'], [0.6, '#ff9e3d'], [1, '#fffb96']]);
      c.beginPath(); c.moveTo(x - 3, y); c.quadraticCurveTo(x - 3.2, y - fh * 0.5, x + sway, y - fh); c.quadraticCurveTo(x + 3.2, y - fh * 0.5, x + 3, y); c.fill();
    }
    c.restore();
  };

  // ---- a new machine lands: where it is and the dust it kicks up ----
  VT.ARRIVE = 0.9;
  VT.arriveDY = age => {
    if (age >= VT.ARRIVE) return 0;
    const fall = 0.45;
    if (age < fall) { const k = age / fall; return -110 * (1 - k * k); }
    const b = (age - fall) / (VT.ARRIVE - fall);
    return -Math.abs(Math.sin(b * Math.PI * 2)) * 6 * (1 - b);
  };
  VT.drawDust = function (fb, g, age) {
    const k = (age - 0.45) / 1.1;
    if (k < 0 || k > 1) return;
    const col = VT.rgb('#9a95c8');
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
      const x = (s < 0 ? g.x0 : g.x1) + s * (k * 16 + i * 4), y = g.base - 2 - i % 2 - k * 3, r = 1.5 + k * 3;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && VT.bayer((x + dx) | 0, (y + dy) | 0) < (1 - k) * 0.7) fb.px(x + dx, y + dy, col);
    }
  };
  VT.drawDustHD = function (c, g, age) {
    const k = (age - 0.45) / 1.1;
    if (k < 0 || k > 1) return;
    const H = VT.HD;
    c.save(); c.globalAlpha = (1 - k) * 0.7;
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
      const x = (s < 0 ? g.x0 : g.x1) + s * (k * 16 + i * 4), y = g.base - 2 - (i % 2) - k * 3, r = 2 + k * 4;
      c.fillStyle = H.rad(c, x, y, 0, r, [[0, 'rgba(200,190,230,.9)'], [1, 'rgba(200,190,230,0)']]);
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    c.restore();
  };

  // a little wisp of smoke above a singed customer
  VT.drawSinged = function (fb, x, y, t) {
    const col = VT.rgb('#6a5a80');
    for (let k = 0; k < 2; k++) { const f = (t * 0.8 + k * 0.5) % 1; fb.px(x + Math.round(Math.sin(t * 4 + k * 3) * 1.5), y - Math.round(f * 8), col); }
  };

  // hook the vector oddities into the HD helpers once they exist
  const attach = () => { if (VT.HD) { VT.HD.oddity = oddityHD; VT.HD.singed = singedHD; } };
  function singedHD(c, x, y, t) {
    c.save();
    for (let k = 0; k < 3; k++) {
      const f = (t * 0.7 + k / 3) % 1;
      c.globalAlpha = (1 - f) * 0.5; c.fillStyle = '#7a6a90';
      c.beginPath(); c.arc(x + Math.sin(t * 3 + k * 2) * 1.6, y - f * 9, 0.8 + f * 1.6, 0, 7); c.fill();
    }
    c.restore();
  }
  attach();
  VT.oddityHD = (...a) => oddityHD(...a);
})(window.VT);
