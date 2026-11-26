/* Customers: little side-on pixel people, each with their own look from a
 * seed (skin, hair, clothes, cap or shades), a four-frame walk, an arm that
 * reaches for the machine, and a speech bubble that says how it went. Kids
 * are the same with shorter legs and body, so their heads look bigger. */
(function (VT) {
  'use strict';
  const pal = a => a.map(VT.rgb);
  const SKIN = pal(['#f3cfb3', '#e0ac7e', '#c68c5e', '#8d5a36', '#5a3a22']);
  const HAIR = pal(['#1c140f', '#4a2a1a', '#a0522d', '#e8c26a', '#ff71ce', '#01cdfe', '#b967ff', '#f1e6ff']);
  const SHIRT = pal(['#ff2a6d', '#01cdfe', '#05ffa1', '#fffb96', '#b967ff', '#ff9e3d', '#f1e6ff', '#ff71ce']);
  const PANTS = pal(['#2b0a4f', '#1a2a6a', '#3a3a52', '#5a2d8a', '#0d4b5a', '#6a1a3a']);
  const INK = VT.rgb('#0d0221'), SHOE = VT.rgb('#1a1030'), WHITE = VT.rgb('#f1e6ff');
  const W = 20, H = 38, FOOT = 35;
  const KID_DROP = 6; // how much lower a kid's shoulders and head sit

  function hash(n) {
    n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0; n ^= n >>> 13;
    n = Math.imul(n, 0xc2b2ae35) >>> 0;
    return (n ^ (n >>> 16)) >>> 0;
  }

  // a customer's look from their seed: the same in pixel art and in HD
  const HEX = { skin: ['#f3cfb3', '#e0ac7e', '#c68c5e', '#8d5a36', '#5a3a22'], hair: ['#1c140f', '#4a2a1a', '#a0522d', '#e8c26a', '#ff71ce', '#01cdfe', '#b967ff', '#f1e6ff'],
    shirt: ['#ff2a6d', '#01cdfe', '#05ffa1', '#fffb96', '#b967ff', '#ff9e3d', '#f1e6ff', '#ff71ce'], pants: ['#2b0a4f', '#1a2a6a', '#3a3a52', '#5a2d8a', '#0d4b5a', '#6a1a3a'] };
  VT.lookOf = function (look, kid) {
    const h = hash(look);
    return {
      skin: HEX.skin[h % 5], hair: HEX.hair[(h >>> 4) % 8], shirt: HEX.shirt[(h >>> 8) % 8], pants: HEX.pants[(h >>> 12) % 6], capC: HEX.shirt[(h >>> 20) % 8],
      long: (h >>> 16) & 1, cap: ((h >>> 17) & 3) === 0, shades: !kid && ((h >>> 24) & 7) === 0,
    };
  };

  const cache = new Map();
  function sprite(look, step, reach, kid, burnt) {
    const key = look + ':' + step + ':' + reach + ':' + kid + ':' + burnt;
    if (cache.has(key)) return cache.get(key);
    const d = new Uint32Array(W * H);
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) d[y * W + x] = c; };
    const box = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, c); };
    const h = hash(look);
    const skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 4) % HAIR.length], shirt = SHIRT[(h >>> 8) % SHIRT.length];
    const pants = PANTS[(h >>> 12) % PANTS.length], capC = SHIRT[(h >>> 20) % SHIRT.length];
    const long = (h >>> 16) & 1, cap = ((h >>> 17) & 3) === 0, shades = !kid && ((h >>> 24) & 7) === 0;
    const dark = c => VT.mix(c, INK, 0.35), lite = c => VT.mix(c, WHITE, 0.3);
    const cx = 9, f = FOOT, D = kid ? KID_DROP : 0;
    // legs (upper, lower) and body heights: a kid's are shorter
    const [up, low, body] = kid ? [2, 3, 9] : [4, 4, 12];

    // legs: the far one darker; the lower legs scissor as they walk
    const sw = [0, 2, 0, -2][step];
    for (const [x0, off, c] of [[cx - 3, -sw, dark(pants)], [cx, sw, pants]]) {
      box(x0, f - 1 - low - up, 3, up, c);
      box(x0 + off, f - 1 - low, 3, low, c);
      box(x0 + off, f - 1, 4, 2, SHOE);
    }
    // body, belt, neck, head (everything above the legs sits D lower for a kid)
    const belt = f - 2 - low - up, top = belt - body + 1;
    box(cx - 4, top, 8, body, shirt);
    box(cx - 4, top, 1, body, dark(shirt));
    box(cx + 3, top, 1, body, lite(shirt));
    box(cx - 4, belt, 8, 1, dark(pants));
    box(cx - 1, f - 22 + D, 2, 1, skin);
    box(cx - 4, f - 31 + D, 9, 9, skin);
    put(cx - 4, f - 31 + D, 0); put(cx + 4, f - 31 + D, 0); put(cx - 4, f - 23 + D, 0); put(cx + 4, f - 23 + D, 0);
    put(cx + 5, f - 27 + D, skin);
    if (shades) box(cx, f - 28 + D, 5, 2, INK); else box(cx + 2, f - 28 + D, 1, 2, INK);
    // hair or a cap
    if (cap) {
      box(cx - 4, f - 33 + D, 9, 3, capC); box(cx + 4, f - 31 + D, 4, 1, dark(capC));
      box(cx - 4, f - 30 + D, 2, 3, hair);
    } else {
      box(cx - 4, f - 33 + D, 9, 3, hair); box(cx - 3, f - 34 + D, 6, 1, hair);
      box(cx - 4, f - 30 + D, 3, long ? (kid ? 6 : 9) : 4, hair);
    }
    // the near arm swings, or reaches out for the buttons
    if (reach) {
      box(cx - 1, top + 1, 3, 2, shirt); box(cx + 2, top + 1, 6, 2, shirt);
      box(cx + 8, top + 1, 2, 2, skin);
    } else {
      const a = [0, 1, 0, -1][step], ua = kid ? 3 : 5, la = kid ? 3 : 4;
      box(cx - 1, top + 1, 2, ua, dark(shirt));
      box(cx - 1 + a, top + 1 + ua, 2, la, dark(shirt));
      box(cx - 1 + a, top + 1 + ua + la, 2, 2, skin);
    }
    // ink outline around the whole figure
    const out = d.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[y * W + x]) continue;
      if ((x > 0 && d[y * W + x - 1]) || (x < W - 1 && d[y * W + x + 1]) || (y > 0 && d[(y - 1) * W + x]) || (y < H - 1 && d[(y + 1) * W + x])) out[y * W + x] = INK;
    }
    // singed by an explosion: sooty all over, but the eyes still blink white
    if (burnt) {
      for (let i = 0; i < out.length; i++) if (out[i] && out[i] !== INK) out[i] = VT.mix(out[i], INK, 0.78);
      const ey = f - 28 + (kid ? KID_DROP : 0);
      out[ey * W + cx + 2] = WHITE; out[(ey + 1) * W + cx + 2] = WHITE;
      // hair blown upright
      for (let i = -3; i <= 3; i += 2) out[(f - 35 + (kid ? KID_DROP : 0)) * W + cx + i] = INK;
    }
    const spr = { w: W, h: H, d: out };
    cache.set(key, spr);
    return spr;
  }

  // a person whose feet stand at (x, foot)
  VT.drawPerson = function (fb, x, foot, look, step, reach, kid, burnt) {
    fb.blit(sprite(look, step, reach ? 1 : 0, kid ? 1 : 0, burnt ? 1 : 0), x - 9, foot - FOOT);
  };
  // how far above the feet a person's bubble goes
  VT.bubbleHeight = kid => 37 - (kid ? KID_DROP : 0);

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
