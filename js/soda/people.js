/* Customers: little side-on pixel people, each with their own look from a
 * seed (skin, hair, clothes, cap or shades), a four-frame walk, an arm that
 * reaches for the machine, and a speech bubble that says how it went. */
(function (VT) {
  'use strict';
  const pal = a => a.map(VT.rgb);
  const SKIN = pal(['#f3cfb3', '#e0ac7e', '#c68c5e', '#8d5a36', '#5a3a22']);
  const HAIR = pal(['#1c140f', '#4a2a1a', '#a0522d', '#e8c26a', '#ff71ce', '#01cdfe', '#b967ff', '#f1e6ff']);
  const SHIRT = pal(['#ff2a6d', '#01cdfe', '#05ffa1', '#fffb96', '#b967ff', '#ff9e3d', '#f1e6ff', '#ff71ce']);
  const PANTS = pal(['#2b0a4f', '#1a2a6a', '#3a3a52', '#5a2d8a', '#0d4b5a', '#6a1a3a']);
  const INK = VT.rgb('#0d0221'), SHOE = VT.rgb('#1a1030'), WHITE = VT.rgb('#f1e6ff');
  const W = 20, H = 38, FOOT = 35;

  function hash(n) {
    n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0; n ^= n >>> 13;
    n = Math.imul(n, 0xc2b2ae35) >>> 0;
    return (n ^ (n >>> 16)) >>> 0;
  }

  const cache = new Map();
  function sprite(look, step, reach) {
    const key = look + ':' + step + ':' + reach;
    if (cache.has(key)) return cache.get(key);
    const d = new Uint32Array(W * H);
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) d[y * W + x] = c; };
    const box = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, c); };
    const h = hash(look);
    const skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 4) % HAIR.length], shirt = SHIRT[(h >>> 8) % SHIRT.length];
    const pants = PANTS[(h >>> 12) % PANTS.length], capC = SHIRT[(h >>> 20) % SHIRT.length];
    const long = (h >>> 16) & 1, cap = ((h >>> 17) & 3) === 0, shades = ((h >>> 24) & 7) === 0;
    const dark = c => VT.mix(c, INK, 0.35), lite = c => VT.mix(c, WHITE, 0.3);
    const cx = 9, f = FOOT;

    // legs: the far one darker; the lower legs scissor as they walk
    const sw = [0, 2, 0, -2][step];
    for (const [x0, off, c] of [[cx - 3, -sw, dark(pants)], [cx, sw, pants]]) {
      box(x0, f - 9, 3, 4, c);
      box(x0 + off, f - 5, 3, 4, c);
      box(x0 + off, f - 1, 4, 2, SHOE);
    }
    // body, belt, neck, head
    box(cx - 4, f - 21, 8, 12, shirt);
    box(cx - 4, f - 21, 1, 12, dark(shirt));
    box(cx + 3, f - 21, 1, 12, lite(shirt));
    box(cx - 4, f - 10, 8, 1, dark(pants));
    box(cx - 1, f - 22, 2, 1, skin);
    box(cx - 4, f - 31, 9, 9, skin);
    put(cx - 4, f - 31, 0); put(cx + 4, f - 31, 0); put(cx - 4, f - 23, 0); put(cx + 4, f - 23, 0);
    put(cx + 5, f - 27, skin);
    if (shades) box(cx, f - 28, 5, 2, INK); else box(cx + 2, f - 28, 1, 2, INK);
    // hair or a cap
    if (cap) {
      box(cx - 4, f - 33, 9, 3, capC); box(cx + 4, f - 31, 4, 1, dark(capC));
      box(cx - 4, f - 30, 2, 3, hair);
    } else {
      box(cx - 4, f - 33, 9, 3, hair); box(cx - 3, f - 34, 6, 1, hair);
      box(cx - 4, f - 30, 3, long ? 9 : 4, hair);
    }
    // the near arm swings, or reaches out for the buttons
    if (reach) {
      box(cx - 1, f - 20, 3, 2, shirt); box(cx + 2, f - 20, 6, 2, shirt);
      box(cx + 8, f - 20, 2, 2, skin);
    } else {
      const a = [0, 1, 0, -1][step];
      box(cx - 1, f - 20, 2, 5, dark(shirt));
      box(cx - 1 + a, f - 15, 2, 4, dark(shirt));
      box(cx - 1 + a, f - 11, 2, 2, skin);
    }
    // ink outline around the whole figure
    const out = d.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[y * W + x]) continue;
      if ((x > 0 && d[y * W + x - 1]) || (x < W - 1 && d[y * W + x + 1]) || (y > 0 && d[(y - 1) * W + x]) || (y < H - 1 && d[(y + 1) * W + x])) out[y * W + x] = INK;
    }
    const spr = { w: W, h: H, d: out };
    cache.set(key, spr);
    return spr;
  }

  // a person whose feet stand at (x, foot)
  VT.drawPerson = function (fb, x, foot, look, step, reach) {
    fb.blit(sprite(look, step, reach ? 1 : 0), x - 9, foot - FOOT);
  };

  // a speech bubble whose tail points down at (x, y)
  VT.drawBubble = function (fb, x, y, kind, t) {
    const bx = x - 3, by = y - 13;
    fb.rect(bx, by, 11, 11, INK);
    fb.rect(bx + 1, by + 1, 9, 9, WHITE);
    fb.px(bx, by, 0); fb.px(bx + 10, by, 0); fb.px(bx, by + 10, 0); fb.px(bx + 10, by + 10, 0);
    fb.rect(bx + 2, by + 10, 2, 1, WHITE); fb.px(bx + 2, by + 11, WHITE);
    fb.px(bx + 1, by + 11, INK); fb.px(bx + 4, by + 10, INK); fb.px(bx + 3, by + 11, INK); fb.px(bx + 2, by + 12, INK);
    if (kind === 'think') {
      const n = Math.floor(t * 3) % 4;
      for (let i = 0; i < 3; i++) fb.rect(bx + 2 + i * 3, by + 5, 1, 1, i < n ? INK : VT.PAL.s);
    } else VT.icon(fb, kind, bx + 2, by + 2);
  };
})(window.VT);
