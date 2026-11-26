/* Small pixel icons (weather, stars, speech-bubble symbols) and a 3×5
 * digit font. Each icon is rows of palette letters; '.' is transparent. */
(function (VT) {
  'use strict';

  const PAL = {
    k: '#0d0221', w: '#f1e6ff', p: '#ff71ce', r: '#ff2a6d', y: '#fffb96', o: '#ff9e3d',
    c: '#01cdfe', g: '#05ffa1', v: '#b967ff', s: '#9a95c8', d: '#3b1a63',
  };
  for (const k in PAL) PAL[k] = VT.rgb(PAL[k]);
  VT.PAL = PAL;

  VT.ICONS = {
    love: ['.......', '.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
    ok: ['.......', '......g', '.....gg', 'g...gg.', 'gg.gg..', '.ggg...', '..g....'],
    soldout: ['c.....c', '.c...c.', '..c.c..', '...c...', '..c.c..', '.c...c.', 'c.....c'],
    price: ['...o...', '.ooooo.', 'oo.o...', '.ooooo.', '...o.oo', '.ooooo.', '...o...'],
    broken: ['...r...', '..rrr..', '..rrr..', '...r...', '...r...', '.......', '...r...'],
    yuck: ['.ggggg.', 'gkgggkg', 'ggggggg', 'gkkkkkg', 'gkgkgkg', 'ggggggg', '.ggggg.'],
    stuck: ['...o...', '...o...', '.ooooo.', '..ooo..', '...o...', '.......', 'rrrrrrr'],
    lucky: ['y.....y', '..yyy..', '.y...y.', '....y..', '...y...', '..y....', '.yyyyy.'],
    queue: ['..vvv..', '.v...v.', 'v..v..v', 'v..vv.v', 'v.....v', '.v...v.', '..vvv..'],
    sun: ['....y....', '.y.....y.', '...yyy...', '..yyyyy..', 'y.yyyyy.y', '..yyyyy..', '...yyy...', '.y.....y.', '....y....'],
    cloud: ['.........', '.........', '...www...', '..wwwww..', '.wwwwwww.', 'wwwwwwwww', '.sssssss.', '.........', '.........'],
    rain: ['...sss...', '..sssss..', '.sssssss.', 'sssssssss', '.........', '.c..c..c.', 'c..c..c..', '.........', '.........'],
    star: ['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', 'y.....y'],
  };

  // draw an icon; map swaps palette letters, e.g. { y: someColour }
  VT.icon = function (fb, name, x, y, map) {
    VT.ICONS[name].forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.') fb.px(x + i, y + j, (map && map[ch]) || PAL[ch]);
      }
    });
  };

  const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
    '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
  VT.tiny = function (fb, str, x, y, c) {
    for (const ch of String(str)) {
      const g = DIGITS[ch];
      if (g) for (let k = 0; k < 15; k++) if (g[k] === '1') fb.px(x + (k % 3), y + ((k / 3) | 0), c);
      x += 4;
    }
  };

  // a small canvas that shows one drawing, scaled crisp
  VT.pixelCanvas = function (canvas, w, h, k) {
    const fb = new VT.FB(canvas);
    fb.resize(w, h);
    const fit = () => { const s = typeof k === 'function' ? k() : k; canvas.style.width = w * s + 'px'; canvas.style.height = h * s + 'px'; };
    fit(); addEventListener('resize', fit);
    return fb;
  };
})(window.VT);
