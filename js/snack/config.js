/* Snack machine: twenty spiral coils of sweet and salty snacks. Unlike the
 * soda machine, snacks go stale and coils wear, so items get stuck. Loaded
 * in the browser and by the tests in Node, so nothing here touches the DOM. */
(function (VT) {
  'use strict';
  VT.SNACK = {
    ID: 'snack', NAME: 'SNACKS', ITEMS: 'SNACKS', SAVE: 'vt.snack.v1',
    MIN_PER_SEC: 8,
    SPEEDS: [0, 1, 2, 5, 10],
    DAY: 1440,
    ROWS: 5, COLS: 4, CAP: 6,  // five shelves of four coils, six snacks a coil
    CASHBOX: 120,
    START_WALLET: 50,
    RENT: 7,
    JAMS_PER_DAY: 0,           // no coin jams, but the coils wear
    STUCK: { base: 0.02, perDay: 0.01, max: 0.3, service: 8 },
    CUSTOMERS_PER_DAY: 32,
    PRICE_STEP: 0.25, PRICE_MIN: 0.25, PRICE_MAX: 5, START_PRICE: 1.25,
    // the afternoon slump and the late-night munchies
    HOURS: [0.1, 0.08, 0.05, 0.04, 0.05, 0.1, 0.3, 0.6, 0.8, 0.9, 1.1, 1.2, 1.3, 1.1, 1.2, 1.6, 1.5, 1.2, 1.0, 0.9, 0.8, 0.7, 0.5, 0.25],
    SKY: { sun: 1, cloud: 1, rain: 0.85 },
    // snacks sell a little better on cold days, and heat does not raise prices
    HEAT: t => Math.max(0.8, Math.min(1.2, 1.15 - (t - 10) * 0.012)),
    WTP_HEAT: 0,
    // shape: how the item is drawn; life: days until it goes stale
    PRODUCTS: [
      { id: 'chips', name: 'PIXEL CHIPS', shape: 'bag', color: '#ff9e3d', cost: 0.5, ref: 1.8, start: 1.5, life: 20, pop: 0.24 },
      { id: 'bar', name: 'CHROME BAR', shape: 'bar', color: '#ff2a6d', cost: 0.45, ref: 1.6, start: 1.25, life: 30, pop: 0.22 },
      { id: 'cookie', name: 'SYNTH COOKIES', shape: 'pack', color: '#e8a86a', cost: 0.55, ref: 1.9, start: 1.5, life: 7, pop: 0.14 },
      { id: 'pretzel', name: 'VHS PRETZELS', shape: 'bag', color: '#01cdfe', cost: 0.4, ref: 1.5, start: 1.25, life: 25, pop: 0.14 },
      { id: 'gummy', name: 'GUMMY GRID', shape: 'gummy', color: '#05ffa1', cost: 0.45, ref: 1.6, start: 1.25, life: 40, pop: 0.14 },
      { id: 'nuts', name: 'DISCO NUTS', shape: 'tub', color: '#b967ff', cost: 0.6, ref: 2.0, start: 1.75, life: 60, pop: 0.12 },
    ],
    LAYOUT: [0, 0, 3, 3, 1, 1, 2, 2, 0, 4, 4, 1, 5, 2, 3, 1, 0, 5, 4, 2],
    ART: { x: 11, y: 22, dx: 8, dy: 9, w: 7, h: 8 },
    // a new machine after an explosion: price and minutes to deliver; where
    // the machine stands (x from–to), its colour and where items come out
    MACHINE: 100, DELIVERY: 120, FOOT: [6, 57], BODY: '#1186b3', HATCH: [26.5, 77],
    STAGE: { W: 200, H: 104, MX: 70, MY: 4, FRONT: 58, GAP: 17, ENTER: -14, EXIT: 214, QUEUE: 4, WALK: 4, USE: 7 },
  };
})(typeof window !== 'undefined' ? (window.VT = window.VT || {}) : (globalThis.VT = globalThis.VT || {}));
