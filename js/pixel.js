/* Pixel toolkit: packed colours, ordered dithering and a small framebuffer.
 * Everything on screen is drawn into low-resolution canvases pixel by pixel
 * and scaled up with nearest-neighbour filtering, like a 16-bit console. */
(function () {
  'use strict';
  const VT = window.VT = window.VT || {};

  // Colours are packed as little-endian RGBA in a Uint32 (0xAABBGGRR).
  VT.rgb = function (hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
  };
  VT.mix = function (a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const ar = a & 255, ag = (a >>> 8) & 255, ab = (a >>> 16) & 255;
    const br = b & 255, bg = (b >>> 8) & 255, bb = (b >>> 16) & 255;
    return (0xff000000 | (Math.round(ab + (bb - ab) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ar + (br - ar) * t)) >>> 0;
  };

  // 4×4 Bayer matrix: the cross-hatched dithering of 90s consoles and DOS games.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  VT.bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

  // Gradient stops [[pos, '#hex'], …] → packed stops.
  VT.stops = list => list.map(([p, h]) => [p, VT.rgb(h)]);
  // A colour along the stops at t, quantised to `levels` bands per segment
  // and dithered between bands, so gradients look hand-pixelled.
  VT.ramp = function (stops, t, x, y, levels) {
    if (t <= stops[0][0]) return stops[0][1];
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const a = stops[i], b = stops[i + 1];
    let u = (t - a[0]) / (b[0] - a[0]);
    if (u >= 1) return b[1];
    const q = u * levels, base = Math.floor(q);
    u = (base + (q - base > VT.bayer(x, y) ? 1 : 0)) / levels;
    return VT.mix(a[1], b[1], u);
  };

  // Seeded RNG (mulberry32) so the scenery is the same on every visit.
  VT.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // A framebuffer on a canvas. 0 is a transparent pixel.
  VT.FB = class {
    constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); }
    resize(w, h) {
      this.c.width = this.w = w; this.c.height = this.h = h;
      this.img = this.ctx.createImageData(w, h);
      this.d = new Uint32Array(this.img.data.buffer);
    }
    clear(c = 0) { this.d.fill(c); }
    px(x, y, c) {
      x |= 0; y |= 0;
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
    }
    blend(x, y, c, a) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x;
      this.d[i] = this.d[i] ? VT.mix(this.d[i], c, a) : c;
    }
    rect(x, y, w, h, c) {
      const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
      const x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.h, (y + h) | 0);
      for (let j = y0; j < y1; j++) this.d.fill(c, j * this.w + x0, j * this.w + x1);
    }
    frame(x, y, w, h, c) {
      this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
      this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
    }
    // copy another buffer ({w, h, d}) in, skipping its transparent pixels
    blit(src, dx, dy) {
      for (let y = 0; y < src.h; y++) {
        const Y = y + dy;
        if (Y < 0 || Y >= this.h) continue;
        for (let x = 0; x < src.w; x++) {
          const c = src.d[y * src.w + x], X = x + dx;
          if (c && X >= 0 && X < this.w) this.d[Y * this.w + X] = c;
        }
      }
    }
    flush() { this.ctx.putImageData(this.img, 0, 0); }
  };

  // The size of one art pixel in CSS pixels, chosen from the viewport.
  VT.scale = function () {
    const w = innerWidth, h = innerHeight;
    return w >= 1180 && h >= 1060 ? 4 : w >= 620 && h >= 700 ? 3 : 2;
  };

  // One animation loop for everything on the page. Each item has draw(t).
  VT.run = function (items, still) {
    function frame(now) {
      const t = now / 1000;
      for (const it of items) it.draw(t);
      if (!still) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  VT.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
})();
