/* Launch page: the backdrop, the logo, a live preview of every machine and
 * an arcade-style select menu (arrows, Enter, mouse or touch). */
(function (VT) {
  'use strict';

  const root = document.documentElement;
  const setPx = () => root.style.setProperty('--px', VT.scale() + 'px');
  setPx(); addEventListener('resize', setPx);

  const items = [VT.scene(document.getElementById('bg')), VT.logo(document.getElementById('logo'), 'VENDING', 'TYCOON')];
  for (const c of document.querySelectorAll('canvas[data-art]')) items.push(VT.art(c, c.dataset.art));

  // the bouncing pointer above the selected machine: a down arrow sprite
  const ARROW = ['1111111', '0111110', '0011100', '0001000'];
  for (const el of document.querySelectorAll('.cursor')) {
    const c = document.createElement('canvas'), fb = new VT.FB(c);
    fb.resize(9, 6);
    const ink = VT.rgb('#0d0221'), sun = VT.rgb('#fffb96'), hot = VT.rgb('#ff2a6d');
    ARROW.forEach((row, y) => [...row].forEach((b, x) => { if (b === '1') { fb.px(x + 2, y + 2, ink); fb.px(x + 1, y + 1, y === 0 ? sun : hot); } }));
    ARROW.forEach((row, y) => [...row].forEach((b, x) => { if (b === '1' && y > 0) fb.px(x + 1, y + 1, x === 3 - y + 1 ? sun : hot); }));
    fb.flush();
    const fit = () => { const k = VT.scale() + 1; c.style.width = 9 * k + 'px'; c.style.height = 6 * k + 'px'; };
    fit(); addEventListener('resize', fit);
    el.appendChild(c);
  }

  VT.run(items, VT.reduced);
  if (VT.reduced) addEventListener('resize', () => requestAnimationFrame(() => items.forEach(it => it.draw(0))));

  // menu
  const slots = [...document.querySelectorAll('.slot')], status = document.getElementById('status');
  const idle = status.innerHTML;
  let sel = 0, timer = 0;
  function select(i, focus) {
    sel = (i + slots.length) % slots.length;
    slots.forEach((s, j) => s.classList.toggle('on', j === sel));
    if (focus) slots[sel].focus();
  }
  function say(text, warn) {
    clearTimeout(timer);
    status.textContent = text; status.classList.toggle('warn', !!warn);
    timer = setTimeout(() => { status.innerHTML = idle; status.classList.remove('warn'); }, 1600);
  }
  function deny(s) {
    s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
    say('LOCKED · COMING SOON', true);
  }
  function start(s) {
    if (s.classList.contains('locked')) return deny(s);
    if (VT.reduced) { location.href = s.href; return; }
    document.body.classList.add('warp');
    setTimeout(() => { location.href = s.href; }, 430);
  }
  slots.forEach((s, i) => {
    s.addEventListener('mouseenter', () => select(i));
    s.addEventListener('focus', () => select(i));
    s.addEventListener('click', e => { e.preventDefault(); select(i); start(s); });
  });
  addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1, true); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1, true); }
    else if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.coin')) { e.preventDefault(); start(slots[sel]); }
    else if (e.key === 'c' || e.key === 'C') coin();
  });
  // pageshow: coming back with the browser's back button undoes the warp
  addEventListener('pageshow', () => document.body.classList.remove('warp'));

  // insert coin: purely for fun, for now
  let credit = 0;
  const creditEl = document.getElementById('credit');
  function coin() { credit = Math.min(99, credit + 1); creditEl.textContent = String(credit).padStart(2, '0'); say('COIN ACCEPTED'); }
  document.getElementById('coin').addEventListener('click', coin);
})(window.VT);
