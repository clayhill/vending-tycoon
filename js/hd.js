/* High-resolution rendering: the same scenes drawn as smooth vector art at
 * the screen's full resolution, instead of low-resolution pixels scaled up.
 * The choice is kept in this browser (localStorage 'vt.render') and set with
 * the PIXEL / HD switch at the top of every page; switching reloads the page
 * (a game saves itself first), so each renderer is chosen once, at start.
 *
 * Drawings work in the same units as the pixel art (a machine is 64×88, the
 * street 200×104), so layout, hit areas and sizes stay the same in both. */
(function (VT) {
  'use strict';
  const KEY = 'vt.render';
  let hd = false;
  try { hd = localStorage.getItem(KEY) === 'hd'; } catch (e) { /* storage blocked: pixels */ }
  VT.hd = hd;
  document.documentElement.classList.toggle('hd', hd);
  if (hd) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&display=swap';
    document.head.appendChild(l);
  }
  VT.setHD = function (on) {
    try { localStorage.setItem(KEY, on ? 'hd' : 'pixel'); } catch (e) { /* storage blocked */ }
    dispatchEvent(new Event('pagehide'));
    location.reload();
  };

  // the PIXEL / HD switch, in the page's top bar
  (function toggle() {
    const host = document.querySelector('.bar') || document.querySelector('.hud');
    if (!host) return;
    const g = document.createElement('div');
    g.className = 'render'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Rendering');
    for (const [label, on, title] of [['PIXEL', false, 'Pixel art, scaled up crisp'], ['HD', true, 'High-resolution detailed rendering']]) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn small'; b.textContent = label; b.title = title;
      b.setAttribute('aria-pressed', String(on === hd));
      b.addEventListener('click', () => { if (on !== hd) VT.setHD(on); });
      g.appendChild(b);
    }
    if (host.classList.contains('bar')) host.insertBefore(g, host.querySelector('.speed'));
    else host.appendChild(g);
  })();

  // ---- a canvas drawn in logical units at the screen's full resolution ----
  VT.hdCanvas = function (canvas, w, h, k) {
    const ctx = canvas.getContext('2d');
    const o = { canvas, ctx, w, h, s: 1 };
    o.fit = function (kk) {
      const dpr = Math.min(3, devicePixelRatio || 1), q = typeof kk === 'function' ? kk() : kk;
      canvas.style.width = w * q + 'px'; canvas.style.height = h * q + 'px';
      const W = Math.max(1, Math.round(w * q * dpr)), H = Math.max(1, Math.round(h * q * dpr));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      o.s = W / w;
    };
    o.begin = function () {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(o.s, 0, 0, o.s, 0, 0);
      return ctx;
    };
    if (k !== undefined) { o.fit(k); addEventListener('resize', () => o.fit(k)); }
    return o;
  };

  // ---- drawing helpers ----
  const H = VT.HD = {};
  H.rr = function (c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  };
  H.lin = function (c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    for (const [p, col] of stops) g.addColorStop(p, col);
    return g;
  };
  H.rad = function (c, x, y, r0, r1, stops) {
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    for (const [p, col] of stops) g.addColorStop(p, col);
    return g;
  };
  // shadowBlur is in device pixels, so scale it by the current transform
  H.glow = function (c, col, blur) { c.shadowColor = col; c.shadowBlur = blur * c.getTransform().a; };
  H.noGlow = function (c) { c.shadowColor = 'transparent'; c.shadowBlur = 0; };
  H.box = function (c, x, y, w, h, r, fill, stroke, lw) {
    H.rr(c, x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 0.5; c.stroke(); }
  };
  H.shade = function (hex, t) { // t > 0 lightens towards white, t < 0 darkens towards ink
    const n = parseInt(hex.slice(1), 16), to = t > 0 ? [255, 255, 255] : [13, 2, 33], a = Math.abs(t);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (to[i] - v) * a));
    return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('');
  };
  H.font = (size, weight = 700, fam = 'Orbitron') => `${weight} ${size}px ${fam}, 'Arial Black', sans-serif`;
  H.INK = '#0d0221';

  // ---- icons, drawn into a 7×7 box (bubbles, weather, stars) ----
  H.icon = function (c, name, x, y, sz = 7, t = 0) {
    c.save();
    c.translate(x, y); c.scale(sz / 7, sz / 7);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const face = (col, mouth) => {
      c.fillStyle = col; c.beginPath(); c.arc(3.5, 3.5, 3.3, 0, 7); c.fill();
      c.fillStyle = H.INK; c.beginPath(); c.arc(2.3, 2.8, 0.5, 0, 7); c.arc(4.7, 2.8, 0.5, 0, 7); c.fill();
      c.strokeStyle = H.INK; c.lineWidth = 0.55; c.beginPath(); mouth(); c.stroke();
    };
    switch (name) {
      case 'what':
        c.fillStyle = '#b967ff'; c.font = H.font(7.4, 900); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillText('?', 3.5 + Math.sin(t * 5) * 0.3, 6.6);
        break;
      case 'boom': {
        const k = 1 + Math.sin(t * 18) * 0.08;
        c.beginPath();
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = (i & 1 ? 1.6 : 3.5) * k; c.lineTo(3.5 + Math.cos(a) * r, 3.5 + Math.sin(a) * r); }
        c.closePath(); c.fillStyle = H.rad(c, 3.5, 3.5, 0, 3.5, [[0, '#fffb96'], [0.5, '#ff9e3d'], [1, '#ff2a6d']]); c.fill();
        break;
      }
      case 'love':
        c.fillStyle = H.lin(c, 0, 0, 0, 7, [[0, '#ff71ce'], [1, '#ff2a6d']]);
        c.beginPath(); c.moveTo(3.5, 6.4);
        c.bezierCurveTo(-0.8, 3.4, 0.6, -0.4, 3.5, 1.9); c.bezierCurveTo(6.4, -0.4, 7.8, 3.4, 3.5, 6.4); c.fill();
        c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(1.9, 2.4, 0.7, 0.45, -0.6, 0, 7); c.fill();
        break;
      case 'ok':
        c.strokeStyle = '#05ffa1'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0.8, 3.8); c.lineTo(2.7, 5.6); c.lineTo(6.3, 1.4); c.stroke();
        break;
      case 'soldout':
        c.strokeStyle = '#01cdfe'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(1, 1); c.lineTo(6, 6); c.moveTo(6, 1); c.lineTo(1, 6); c.stroke();
        break;
      case 'price':
        c.fillStyle = '#ff9e3d'; c.font = H.font(7, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 3.5, 3.8);
        break;
      case 'broken':
        c.fillStyle = '#ff2a6d'; H.rr(c, 2.7, 0.3, 1.6, 4.2, 0.8); c.fill(); c.beginPath(); c.arc(3.5, 6, 0.85, 0, 7); c.fill();
        break;
      case 'yuck':
        face('#7ad94a', () => { c.moveTo(1.6, 5.2); c.quadraticCurveTo(2.5, 4.3, 3.5, 5.1); c.quadraticCurveTo(4.5, 5.9, 5.4, 5); });
        c.fillStyle = '#5ab02e'; c.beginPath(); c.ellipse(5.6, 5.9, 0.6, 0.9, 0, 0, 7); c.fill();
        break;
      case 'meh':
        face('#b967ff', () => { c.moveTo(2, 5); c.lineTo(5, 5); });
        break;
      case 'stuck':
        c.strokeStyle = '#ff9e3d'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(3.5, 0.5); c.lineTo(3.5, 4); c.moveTo(1.8, 2.6); c.lineTo(3.5, 4.3); c.lineTo(5.2, 2.6); c.stroke();
        c.fillStyle = '#ff2a6d'; H.rr(c, 0.4, 5.4, 6.2, 1.2, 0.5); c.fill();
        break;
      case 'lucky':
        c.fillStyle = '#fffb96'; c.font = H.font(5.4, 900); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('2×', 3.5, 3.9);
        break;
      case 'prize': case 'star': {
        c.fillStyle = name === 'prize' ? H.lin(c, 0, 0, 0, 7, [[0, '#fff6b0'], [1, '#ffb020']]) : '#fffb96';
        c.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 1.45 : 3.5; c.lineTo(3.5 + Math.cos(a) * r, 3.75 + Math.sin(a) * r); }
        c.closePath(); c.fill();
        break;
      }
      case 'again':
        c.strokeStyle = '#01cdfe'; c.lineWidth = 1.1; c.beginPath(); c.arc(3.5, 3.7, 2.5, -0.4, 4.4); c.stroke();
        c.fillStyle = '#01cdfe'; c.beginPath(); c.moveTo(6.6, 0.6); c.lineTo(6.6, 3.2); c.lineTo(4.2, 2.4); c.closePath(); c.fill();
        break;
      case 'queue':
        c.strokeStyle = '#b967ff'; c.lineWidth = 0.9; c.beginPath(); c.arc(3.5, 3.5, 3, 0, 7); c.stroke();
        c.beginPath(); c.moveTo(3.5, 1.6); c.lineTo(3.5, 3.6); c.lineTo(5, 4.4); c.stroke();
        break;
      case 'think':
        for (let i = 0; i < 3; i++) {
          c.fillStyle = i < Math.floor(t * 3) % 4 ? H.INK : '#9a95c8';
          c.beginPath(); c.arc(1.2 + i * 2.3, 3.6, 0.75, 0, 7); c.fill();
        }
        break;
      case 'sun': {
        c.fillStyle = H.rad(c, 3.5, 3.5, 0.5, 2.4, [[0, '#ffffff'], [0.5, '#fffb96'], [1, '#ffc46b']]);
        c.beginPath(); c.arc(3.5, 3.5, 2, 0, 7); c.fill();
        c.strokeStyle = '#fffb96'; c.lineWidth = 0.55;
        for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; c.beginPath(); c.moveTo(3.5 + Math.cos(a) * 2.6, 3.5 + Math.sin(a) * 2.6); c.lineTo(3.5 + Math.cos(a) * 3.4, 3.5 + Math.sin(a) * 3.4); c.stroke(); }
        break;
      }
      case 'cloud': case 'rain': {
        const y0 = name === 'rain' ? -0.9 : 0;
        c.fillStyle = H.lin(c, 0, 2, 0, 6, [[0, '#f1e6ff'], [1, '#9a95c8']]);
        c.beginPath(); c.arc(2.3, 4.2 + y0, 1.6, 0, 7); c.arc(3.9, 3.2 + y0, 2, 0, 7); c.arc(5.4, 4.4 + y0, 1.4, 0, 7); c.rect(2.2, 4.2 + y0, 3.3, 1.6); c.fill();
        if (name === 'rain') {
          c.strokeStyle = '#01cdfe'; c.lineWidth = 0.55;
          for (let k = 0; k < 3; k++) { const x = 2 + k * 1.6, o = ((t * 2 + k * 0.37) % 1) * 1.2; c.beginPath(); c.moveTo(x, 5.6 + o); c.lineTo(x - 0.4, 6.6 + o); c.stroke(); }
        }
        break;
      }
    }
    c.restore();
  };

  // a speech bubble whose tail points down at (x, y), like the pixel one
  H.bubble = function (c, x, y, kind, t) {
    const bx = x - 3, by = y - 13;
    c.save();
    c.shadowColor = 'rgba(5,0,15,.5)'; c.shadowBlur = 2 * c.getTransform().a; c.shadowOffsetY = 0.6 * c.getTransform().a;
    c.beginPath();
    H.rr(c, bx, by, 11, 10.5, 2.6);
    c.moveTo(bx + 2.2, by + 10); c.lineTo(bx + 2.3, by + 12.6); c.lineTo(bx + 4.6, by + 10);
    c.fillStyle = '#ffffff'; c.fill();
    c.restore();
    c.strokeStyle = H.INK; c.lineWidth = 0.55; H.rr(c, bx, by, 11, 10.5, 2.6); c.stroke();
    H.icon(c, kind, bx + 2, by + 1.8, 7, t);
  };

  // ---- customers: smooth side-on figures with the same looks as the pixel ones ----
  H.person = function (c, x, foot, look, phase, reach, kid) {
    const L = VT.lookOf(look, kid);
    const legH = kid ? 6 : 9.5, bodyH = kid ? 9 : 12, headR = 4.6;
    const hip = foot - 1 - legH, top = hip - bodyH, hy = top - headR - 0.8;
    const swing = phase === null ? 0 : Math.sin(phase * Math.PI / 2) * 0.45;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    const limb = (x0, y0, a, len, w, col) => {
      const x1 = x0 + Math.sin(a) * len, y1 = y0 + Math.cos(a) * len;
      c.strokeStyle = H.INK; c.lineWidth = w + 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      return [x1, y1];
    };
    const shoe = (fx, fy) => { c.fillStyle = '#1a1030'; c.beginPath(); c.ellipse(fx + 1, fy - 0.2, 2.1, 1.1, 0, 0, 7); c.fill(); };
    // the far leg and arm, darker
    const farPants = H.shade(L.pants, -0.35), farShirt = H.shade(L.shirt, -0.35);
    shoe(...limb(x - 0.5, hip, -swing, legH, 2.8, farPants));
    if (!reach) limb(x - 1, top + 1.5, swing * 0.9, kid ? 6 : 8, 2, farShirt);
    // body
    c.fillStyle = H.lin(c, x - 4, 0, x + 4, 0, [[0, H.shade(L.shirt, -0.25)], [0.6, L.shirt], [1, H.shade(L.shirt, 0.25)]]);
    H.rr(c, x - 4, top, 8, bodyH + 0.6, 2.4); c.fill();
    c.strokeStyle = H.INK; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = H.shade(L.pants, -0.2); c.fillRect(x - 3.7, hip - 0.6, 7.4, 1.2);
    // the near leg
    shoe(...limb(x + 0.8, hip, swing, legH, 2.8, L.pants));
    // head
    c.fillStyle = L.skin; c.fillRect(x - 0.8, top - 1.5, 1.8, 2);
    c.beginPath(); c.ellipse(x + 0.4, hy, headR, headR * 1.02, 0, 0, 7); c.fill();
    c.strokeStyle = H.INK; c.lineWidth = 0.6; c.stroke();
    c.beginPath(); c.ellipse(x + 4.7, hy + 0.9, 0.9, 0.7, 0, 0, 7); c.fillStyle = L.skin; c.fill(); // nose
    c.fillStyle = H.shade(L.skin, -0.2); c.beginPath(); c.ellipse(x - 1.2, hy + 0.6, 0.9, 1.2, 0, 0, 7); c.fill(); // ear
    if (L.shades) { c.fillStyle = H.INK; H.rr(c, x + 1, hy - 1.4, 4, 1.8, 0.6); c.fill(); c.fillStyle = '#01cdfe'; c.fillRect(x + 2.6, hy - 1.1, 1.4, 0.4); }
    else { c.fillStyle = H.INK; c.beginPath(); c.ellipse(x + 2.9, hy - 0.4, 0.55, 0.8, 0, 0, 7); c.fill(); }
    c.strokeStyle = H.shade(L.skin, -0.45); c.lineWidth = 0.4; c.beginPath(); c.arc(x + 3.2, hy + 2.1, 0.9, 0.3, 1.9); c.stroke(); // smile
    // hair or a cap
    c.fillStyle = L.hair;
    if (L.cap) {
      c.beginPath(); c.ellipse(x + 0.3, hy - 2.2, headR + 0.3, 2.6, 0, Math.PI, 0); c.fillStyle = L.capC; c.fill();
      c.fillStyle = H.shade(L.capC, -0.3); H.rr(c, x + 2.5, hy - 2.5, 4.8, 1.1, 0.5); c.fill();
      c.fillStyle = L.hair; c.beginPath(); c.ellipse(x - 2.6, hy - 0.2, 1.6, 2.2, 0, 0, 7); c.fill();
    } else {
      c.beginPath();
      c.moveTo(x - 4.3, hy + (L.long ? (kid ? 4.5 : 7) : 1.4));
      c.quadraticCurveTo(x - 5.4, hy - 4.4, x + 0.5, hy - 5.2);
      c.quadraticCurveTo(x + 4.8, hy - 5, x + 4.6, hy - 1.6);
      c.quadraticCurveTo(x + 1.5, hy - 3, x - 0.6, hy - 1.2);
      c.lineTo(x - 1.6, hy + (L.long ? (kid ? 4.5 : 7) : 1.4));
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(x, hy - 4, 2, 0.6, -0.2, 0, 7); c.fill();
    }
    // the near arm: swinging, or reaching for the machine
    if (reach) {
      const [hx, hy2] = limb(x + 0.5, top + 1.8, Math.PI / 2 - 0.1, kid ? 6.5 : 8, 2.2, L.shirt);
      c.fillStyle = L.skin; c.beginPath(); c.arc(hx + 0.6, hy2, 1.2, 0, 7); c.fill();
    } else {
      const [hx, hy2] = limb(x + 0.5, top + 1.8, -swing * 0.9, kid ? 6 : 8, 2.2, H.shade(L.shirt, -0.15));
      c.fillStyle = L.skin; c.beginPath(); c.arc(hx, hy2 + 0.4, 1.2, 0, 7); c.fill();
    }
    c.restore();
  };

  // ---- the backdrop: dusk sky, a striped sun, glowing ridges, a neon grid, palms ----
  VT.sceneHD = function (canvas, opt = {}) {
    const ctx = canvas.getContext('2d');
    let W, Hh, dpr, hz, cx, sunR, sunY, back, ridges, palms, stars, sun;

    function layer() { const c = document.createElement('canvas'); c.width = W; c.height = Hh; return [c, c.getContext('2d')]; }
    function palm(c, bx, by, h, lean) {
      const tx = bx + lean * h * 0.45, ty = by - h;
      c.strokeStyle = '#0a0118'; c.lineCap = 'round';
      // a ringed trunk tapering upwards
      for (let i = 0; i < 40; i++) {
        const u = i / 40, u2 = (i + 1) / 40;
        c.lineWidth = h * (0.05 - u * 0.025);
        c.beginPath();
        c.moveTo(bx + lean * u * u * h * 0.45, by - u * h);
        c.lineTo(bx + lean * u2 * u2 * h * 0.45, by - u2 * h);
        c.stroke();
        if (i % 3 === 0) { c.strokeStyle = 'rgba(59,13,92,.9)'; c.lineWidth = h * 0.006; c.beginPath(); const x = bx + lean * u * u * h * 0.45; c.moveTo(x - h * 0.02, by - u * h); c.lineTo(x + h * 0.02, by - u * h - h * 0.005); c.stroke(); c.strokeStyle = '#0a0118'; }
      }
      // fronds: drooping leaves made of many thin leaflets
      const len = h * 0.36;
      for (const a of [0.1, 0.5, 0.95, 1.45, 1.95, 2.5, 3.0]) {
        const L = len * (a > 1 && a < 2.2 ? 0.75 : 1);
        c.fillStyle = '#0a0118';
        for (let s = 0; s < 1; s += 0.03) {
          const x = tx + Math.cos(a) * L * s, y = ty - Math.sin(a) * L * s * 0.75 + s * s * L * 0.55;
          const lw = L * 0.16 * Math.sin(Math.PI * Math.min(1, s * 1.2 + 0.08));
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a + 1.9) * lw * 0.35, y + lw);
          c.lineTo(x + Math.cos(a) * L * 0.04, y + 0.5);
          c.lineTo(x + Math.cos(a - 1.9) * lw * 0.35, y + lw * 0.9);
          c.fill();
        }
        c.lineWidth = h * 0.008; c.beginPath(); c.moveTo(tx, ty);
        c.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty - Math.sin(a) * L * 0.5, tx + Math.cos(a) * L, ty - Math.sin(a) * L * 0.75 + L * 0.55); c.stroke();
      }
      c.fillStyle = '#3b0d5c';
      for (const [dx, dy] of [[-1, 1.6], [1.2, 2.4], [0, 3]]) { c.beginPath(); c.arc(tx + dx * h * 0.012, ty + dy * h * 0.012, h * 0.012, 0, 7); c.fill(); }
    }
    function build() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = Math.max(16, Math.round(innerWidth * dpr)); Hh = Math.max(16, Math.round(innerHeight * dpr));
      canvas.width = W; canvas.height = Hh;
      canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
      hz = Math.round(Hh * (opt.horizon || 0.64)); cx = W / 2;
      sunR = Math.min(Hh * 0.26, W * 0.24); sunY = hz - sunR * 0.3;
      const rnd = VT.rng(1987);
      // sky, halo and a faint band of haze above the horizon
      let c;
      [back, c] = layer();
      c.fillStyle = H.lin(c, 0, 0, 0, hz, [[0, '#06011a'], [0.32, '#1a0644'], [0.6, '#4d1180'], [0.84, '#b02f8f'], [1, '#ff6f91']]);
      c.fillRect(0, 0, W, hz);
      c.fillStyle = H.rad(c, cx, sunY, sunR * 0.8, sunR * 2.1, [[0, 'rgba(255,79,163,.55)'], [0.45, 'rgba(255,79,163,.18)'], [1, 'rgba(255,79,163,0)']]);
      c.fillRect(0, 0, W, hz);
      stars = [];
      const n = Math.round((W * hz) / (700 * 9 * dpr * dpr) * 1.6);
      for (let i = 0; i < n; i++) stars.push({ x: rnd() * W, y: rnd() * hz * 0.72, p: rnd() * 6.3, r: (rnd() < 0.08 ? 1.6 : 0.8) * dpr, c: rnd() < 0.3 ? '155,233,255' : '255,255,255' });
      // ridges: two layers of low-poly mountains with a neon rim
      [ridges, c] = layer();
      const tri = u => 1 - Math.abs((((u % 2) + 2) % 2) - 1);
      const ridge = () => { const oct = [0, 1, 2, 3].map(o => ({ f: (0.012 + rnd() * 0.01) * (1 << o), p: rnd() * 10, a: 1 / (1 << o) })); return x => oct.reduce((s, o) => s + o.a * tri(x * o.f + o.p), 0) / 1.875; };
      const unit = Hh / 270 * 1.0;
      for (const [f, amp, top, bot, edge] of [[ridge(), 0.2, '#6a2a9a', '#2a0a50', '#ff71ce'], [ridge(), 0.11, '#2c0b52', '#12042a', '#01cdfe']]) {
        const pts = [];
        for (let x = 0; x <= W + 8 * unit; x += 4 * unit) {
          const e = Math.min(1, Math.abs(x - cx) / (W * 0.32));
          pts.push([x, hz - Hh * amp * (0.15 + 0.85 * e) * (0.35 + 0.65 * f(x / (Hh / 270) / 1))]);
        }
        c.beginPath(); c.moveTo(0, hz); for (const [x, y] of pts) c.lineTo(x, y); c.lineTo(W, hz); c.closePath();
        c.fillStyle = H.lin(c, 0, hz - Hh * amp, 0, hz, [[0, top], [1, bot]]); c.fill();
        c.save(); c.shadowColor = edge; c.shadowBlur = 10 * dpr; c.strokeStyle = edge; c.globalAlpha = 0.8; c.lineWidth = 1.4 * dpr;
        c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.restore();
        // faint facets
        c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = dpr;
        for (let i = 2; i < pts.length; i += 5) { c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i][0] + (i % 2 ? 30 : -30) * dpr, hz); c.stroke(); }
      }
      // the sun with its glow, rendered once; each frame only clips the stripes
      [sun, c] = layer();
      c.shadowColor = 'rgba(255,113,206,.9)'; c.shadowBlur = 30 * dpr;
      c.fillStyle = H.lin(c, 0, sunY - sunR, 0, sunY + sunR, [[0, '#fffb96'], [0.38, '#ffc46b'], [0.68, '#ff71ce'], [1, '#ff2a6d']]);
      c.beginPath(); c.arc(cx, sunY, sunR, 0, 7); c.fill();
      [palms, c] = layer();
      const ph = Hh * 0.62;
      palm(c, W * 0.05, Hh + 4 * dpr, ph, 0.5);
      palm(c, W * 0.15, Hh + 4 * dpr, ph * 0.62, 0.35);
      palm(c, W * 0.93, Hh + 4 * dpr, ph * 0.85, -0.5);
    }

    function draw(t) {
      const c = ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(back, 0, 0);
      for (const s of stars) {
        const b = Math.sin(t * 1.7 + s.p * 3);
        if (b < -0.55) continue;
        c.fillStyle = `rgba(${s.c},${(0.4 + 0.6 * Math.max(0, b)).toFixed(2)})`;
        c.beginPath(); c.arc(s.x, s.y, s.r * (s.r > dpr && b > 0.6 ? 1.4 : 1), 0, 7); c.fill();
      }
      // the sun, its lower half cut by stripes that drift downwards
      c.save();
      c.beginPath();
      const start = sunY - sunR * 0.12, phase = (t * 0.35) % 1;
      c.rect(0, 0, W, start);
      let prev = start;
      for (let j = 0; j < 9; j++) {
        const u = (j + phase) / 7, ys = start + (hz - start) * u, th = (1 + u * 5) * Hh / 270;
        if (u > 0 && ys > prev) c.rect(0, prev, W, Math.max(0, ys - prev));
        prev = Math.max(prev, ys + th);
      }
      c.clip();
      c.drawImage(sun, 0, 0);
      c.restore();
      c.drawImage(ridges, 0, 0);
      // the floor and its grid: rows rush towards the viewer, columns fan out
      c.save();
      c.beginPath(); c.rect(0, hz, W, Hh - hz); c.clip();
      c.fillStyle = H.lin(c, 0, hz, 0, Hh, [[0, '#3a0b5e'], [0.12, '#180536'], [1, '#05010d']]);
      c.fillRect(0, hz, W, Hh - hz);
      const K = Hh - hz, sp = Math.max(10, W / 15 / (Hh / 270)) * (Hh / 270);
      const ph = (t * 0.8) % 1;
      for (let i = 0; i < 80; i++) {
        const z = 1 + i - ph;
        if (z <= 0) continue;
        const y = hz + K / z;
        if (K / z - K / (z + 1) < 1.6 * Hh / 270) break;
        const a = Math.min(1, ((y - hz) / K) * 2.4 + 0.12);
        const lw = (0.6 + 2.4 * (y - hz) / K) * dpr;
        // a soft glow (a wide faint line), then the bright line
        c.strokeStyle = `rgba(255,42,109,${(a * 0.22).toFixed(3)})`; c.lineWidth = lw * 4;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
        c.strokeStyle = `rgba(255,42,109,${a.toFixed(2)})`; c.lineWidth = lw;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
      c.lineWidth = 1.3 * dpr;
      const g = c.createLinearGradient(0, hz, 0, Hh);
      g.addColorStop(0, 'rgba(255,79,216,.1)'); g.addColorStop(0.4, 'rgba(255,79,216,.75)'); g.addColorStop(1, 'rgba(255,79,216,.9)');
      c.strokeStyle = g; c.beginPath();
      for (let k = -70; k <= 70; k++) {
        const x1 = cx + k * sp * 2.6;
        if (x1 < -W * 4 || x1 > W * 5) continue;
        c.moveTo(cx, hz); c.lineTo(x1, Hh);
      }
      c.stroke();
      c.restore();
      c.fillStyle = H.lin(c, 0, hz - 8 * dpr, 0, hz + 8 * dpr, [[0, 'rgba(255,179,230,0)'], [0.5, 'rgba(255,179,230,.45)'], [1, 'rgba(255,179,230,0)']]);
      c.fillRect(0, hz - 8 * dpr, W, 16 * dpr);
      c.fillStyle = '#ffb3e6'; c.fillRect(0, hz - dpr * 0.5, W, dpr * 1.2);
      c.drawImage(palms, 0, 0);
    }

    build();
    let pending = 0;
    addEventListener('resize', () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { build(); if (VT.reduced) draw(0); }); });
    return { draw };
  };

  // ---- the two-line logo, set in type with chrome and neon ----
  VT.logoHD = function (canvas, line1, line2) {
    const o = VT.hdCanvas(canvas, 300, 120);
    // the lettering and its glows are drawn once per size; each frame adds the glint
    let art = null, artFor = '';
    function render() {
      const cv = document.createElement('canvas');
      cv.width = canvas.width; cv.height = canvas.height;
      const c = cv.getContext('2d');
      c.setTransform(o.s, 0, 0, o.s, 0, 0);
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      // line 1: chrome, extruded in hot pink
      c.font = H.font(50, 900);
      for (let d = 5; d > 0; d--) { c.fillStyle = H.shade('#ff2a6d', -d * 0.1); c.fillText(line1, 150 + d * 0.6, 58 + d * 0.8); }
      c.save(); H.glow(c, 'rgba(255,42,109,.6)', 14);
      c.fillStyle = H.lin(c, 0, 18, 0, 58, [[0, '#e9f8ff'], [0.45, '#5fc8ff'], [0.5, '#2a1a6a'], [0.62, '#ff71ce'], [1, '#ffd7f0']]);
      c.fillText(line1, 150, 58); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.6; c.strokeText(line1, 150, 58);
      // line 2: slanted neon sunset
      c.save(); c.translate(150, 104); c.transform(1, 0, -0.3, 1, 0, 0);
      c.font = H.font(36, 900);
      for (let d = 3; d > 0; d--) { c.fillStyle = H.shade('#01cdfe', -d * 0.2); c.fillText(line2, d * 0.5, d * 0.8); }
      H.glow(c, 'rgba(1,205,254,.8)', 12);
      c.fillStyle = H.lin(c, 0, -30, 0, 0, [[0, '#fffb96'], [0.5, '#ff9e3d'], [1, '#ff2a6d']]);
      c.fillText(line2, 0, 0);
      c.restore();
      // a mask of line 1 only, for the glint
      const m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height;
      const mc = m.getContext('2d'); mc.setTransform(o.s, 0, 0, o.s, 0, 0);
      mc.textAlign = 'center'; mc.font = H.font(50, 900); mc.fillText(line1, 150, 58);
      art = { cv, m, mc };
    }
    const fit = () => { o.fit(Math.max(1, Math.min(4.2, (innerWidth - 32) / 300, (innerHeight * 0.34) / 120))); artFor = ''; };
    fit(); addEventListener('resize', fit);
    // web fonts may arrive after the first frame: draw again once they are in
    if (document.fonts) document.fonts.ready.then(() => { artFor = ''; });
    return {
      draw(t) {
        const key = canvas.width + 'x' + canvas.height + (document.fonts ? document.fonts.status : '');
        if (artFor !== key) { render(); artFor = key; }
        const c = o.ctx;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.drawImage(art.cv, 0, 0);
        // a glint sweeping across the first line
        const mc = art.mc, gx = ((t % 4.5) / 4.5) * 500 - 100;
        mc.save(); mc.setTransform(1, 0, 0, 1, 0, 0); mc.clearRect(0, 0, art.m.width, art.m.height); mc.restore();
        mc.globalCompositeOperation = 'source-over'; mc.fillStyle = '#fff'; mc.textAlign = 'center'; mc.font = H.font(50, 900); mc.fillText(line1, 150, 58);
        mc.globalCompositeOperation = 'source-in';
        mc.fillStyle = H.lin(mc, gx - 20, 0, gx + 20, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]);
        mc.fillRect(0, 0, 300, 64);
        mc.globalCompositeOperation = 'source-over';
        c.drawImage(art.m, 0, 0);
      },
    };
  };
})(window.VT);
