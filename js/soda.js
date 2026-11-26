/* The soda machine's screen: a placeholder until the simulation lands. */
(function (VT) {
  'use strict';

  const root = document.documentElement;
  const setPx = () => root.style.setProperty('--px', VT.scale() + 'px');
  setPx(); addEventListener('resize', setPx);

  // the machine as big as fits in about half the screen height
  const big = () => Math.max(2, Math.min(7, Math.floor((innerHeight * 0.5) / 88), Math.floor((innerWidth - 32) / 64)));
  const items = [
    VT.scene(document.getElementById('bg'), { horizon: 0.7 }),
    VT.logo(document.getElementById('logo'), 'SODA CANS', null, { s1: 3, max: 4 }),
    VT.art(document.getElementById('machine'), 'soda', big),
  ];

  // caution tape across the machine, its stripes crawling sideways
  const tape = document.getElementById('tape'), tfb = new VT.FB(tape), MSG = 'UNDER CONSTRUCTION';
  const TW = VT.textWidth(MSG) + 30, TH = 13;
  tfb.resize(TW, TH);
  const Y = VT.rgb('#ffe24a'), K = VT.rgb('#0d0221'), PINK = VT.rgb('#ff71ce');
  const fitTape = () => { const k = Math.max(2, Math.min(big() - 1, Math.floor((innerWidth - 24) / TW))); tape.style.width = TW * k + 'px'; tape.style.height = TH * k + 'px'; };
  fitTape(); addEventListener('resize', fitTape);
  items.push({
    draw(t) {
      const o = Math.floor(t * 8);
      for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) tfb.px(x, y, y === 0 || y === TH - 1 ? K : ((x + y + o) >> 2) & 1 ? Y : K);
      const tx = (TW - VT.textWidth(MSG)) >> 1;
      tfb.rect(tx - 3, 2, VT.textWidth(MSG) + 6, 9, K);
      VT.text(tfb, MSG, tx, 3, 1, (gx, gy) => (gy < 3 ? Y : VT.mix(Y, PINK, 0.35)));
      tfb.flush();
    },
  });

  VT.run(items, VT.reduced);
  if (VT.reduced) addEventListener('resize', () => requestAnimationFrame(() => items.forEach(it => it.draw(0))));
  addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Backspace') location.href = 'index.html'; });
})(window.VT);
