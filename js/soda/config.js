/* Soda machine: products, prices, demand and the stage's layout. Loaded in
 * the browser and by the tests in Node, so nothing here touches the DOM. */
(function (VT) {
  'use strict';
  VT.SODA = {
    ID: 'soda', NAME: 'SODA CANS', ITEMS: 'CANS', SAVE: 'vt.soda.v1',
    MIN_PER_SEC: 8,           // game minutes per real second at 1×
    SPEEDS: [0, 1, 2, 5, 10],
    DAY: 1440,                // minutes
    ROWS: 4, COLS: 3, CAP: 7, // shelves, columns, cans per slot
    CASHBOX: 100,             // the coin box refuses coins once it holds this much
    START_WALLET: 40,
    RENT: 6,                  // charged at midnight for the spot
    REPAIR: 5,
    JAMS_PER_DAY: 0.2,
    CUSTOMERS_PER_DAY: 34,    // at a 3-star rating on a mild, dry day
    PRICE_STEP: 0.25, PRICE_MIN: 0.25, PRICE_MAX: 5, START_PRICE: 1.25,
    // how busy each hour of the day is, relative to the others
    HOURS: [0.1, 0.06, 0.04, 0.04, 0.06, 0.15, 0.4, 0.9, 1.0, 0.8, 0.8, 1.1, 1.6, 1.5, 1.2, 1.1, 1.2, 1.3, 1.1, 0.9, 0.7, 0.5, 0.3, 0.2],
    SKY: { sun: 1, cloud: 0.9, rain: 0.7 },
    // hot days bring thirsty customers, who will also pay a little more
    HEAT: t => Math.max(0.45, Math.min(1.5, 0.55 + (t - 10) * 0.035)),
    WTP_HEAT: 0.015,
    // cost: what a can costs you; ref: what a typical fan would pay; pop: share of fans
    PRODUCTS: [
      { id: 'cola', name: 'NEON COLA', color: '#01cdfe', cost: 0.45, ref: 1.6, pop: 0.3 },
      { id: 'mint', name: 'MINT WAVE', color: '#05ffa1', cost: 0.4, ref: 1.4, pop: 0.18 },
      { id: 'lemon', name: 'LEMON BYTE', color: '#fffb96', cost: 0.35, ref: 1.3, pop: 0.16 },
      { id: 'grape', name: 'GRAPE STATIC', color: '#b967ff', cost: 0.4, ref: 1.45, pop: 0.16 },
      { id: 'orange', name: 'SUNSET FIZZ', color: '#ff9e3d', cost: 0.4, ref: 1.5, pop: 0.2 },
    ],
    LAYOUT: [0, 0, 4, 1, 2, 3, 0, 4, 1, 2, 3, 0], // product per slot, row by row from the top
    // where the slots sit in the 64×88 machine art: first item, pitch, item size
    ART: { x: 14, y: 24, dx: 8, dy: 10, w: 7, h: 9 },
    // the stage in art pixels: machine position, the queue's spots, walking speed (px/min)
    STAGE: { W: 200, H: 104, MX: 70, MY: 4, FRONT: 58, GAP: 17, ENTER: -14, EXIT: 214, QUEUE: 4, WALK: 4, USE: 6 },
  };
})(typeof window !== 'undefined' ? (window.VT = window.VT || {}) : (globalThis.VT = globalThis.VT || {}));
