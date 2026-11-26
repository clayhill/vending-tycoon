/* Loads the shared scripts and then the page's own (<body data-page="…">),
 * in order. Every file is fetched with the page's load time as a query, so
 * a browser never mixes cached old files with new ones. */
(function () {
  'use strict';
  const T = new URLSearchParams(document.currentScript.src.split('?')[1] || '').get('t') || Date.now();
  const SHARED = ['js/pixel.js', 'js/font.js', 'js/scene.js', 'js/machines.js', 'js/icons.js'];
  const PAGES = {
    landing: ['js/landing.js'],
    soda: ['js/soda/config.js', 'js/vend/sim.js', 'js/vend/people.js', 'js/vend/game.js', 'js/soda/main.js'],
    snack: ['js/snack/config.js', 'js/vend/sim.js', 'js/vend/people.js', 'js/vend/game.js', 'js/snack/main.js'],
  };
  const files = SHARED.concat(PAGES[document.body.dataset.page] || []);
  (function next(i) {
    if (i === files.length) return;
    const s = document.createElement('script');
    s.src = files[i] + '?t=' + T;
    s.onload = () => next(i + 1);
    document.body.appendChild(s);
  })(0);
})();
