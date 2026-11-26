/* Gumball machine: one glass globe of mixed flavours, one price per turn
 * and a random ball every time. Mostly kids, chasing their favourite colour;
 * gold prize balls get everyone talking. Loaded in the browser and by the
 * tests in Node, so nothing here touches the DOM. */
(function (VT) {
  'use strict';
  VT.GUMBALL = {
    ID: 'gumball', NAME: 'GUMBALLS', ITEMS: 'GUMBALLS', SAVE: 'vt.gumball.v1',
    LOTTERY: true,
    GLOBE: 200, BATCH: 25,     // the globe's capacity; a bag of one flavour
    MIN_PER_SEC: 8,
    SPEEDS: [0, 1, 2, 5, 10],
    DAY: 1440,
    ROWS: 1, COLS: 7, CAP: 200, // the "slots" are the flavours in the globe
    CASHBOX: 60,               // a small box of quarters
    START_WALLET: 30,
    RENT: 5,
    REPAIR: 4,
    JAMS_PER_DAY: 0.15,        // the crank sticks now and then
    CUSTOMERS_PER_DAY: 30,
    KIDS: 0.7,
    PRICE_STEP: 0.25, PRICE_MIN: 0.25, PRICE_MAX: 3, START_PRICE: 0.5,
    // after school is rush hour
    HOURS: [0.02, 0.01, 0.01, 0.01, 0.01, 0.02, 0.05, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0, 1.0, 1.1, 1.8, 2.0, 1.6, 1.2, 0.8, 0.5, 0.25, 0.1, 0.05],
    SKY: { sun: 1.1, cloud: 1, rain: 0.6 },
    HEAT: t => Math.max(0.8, Math.min(1.1, 0.85 + (t - 10) * 0.012)),
    WTP_HEAT: 0,
    // a prize ball is nobody's favourite, but everybody's jackpot
    PRODUCTS: [
      { id: 'cherry', name: 'CHERRY BOMB', color: '#ff2a6d', cost: 0.05, ref: 0.8, pop: 0.22 },
      { id: 'blue', name: 'BLUE RAZZ', color: '#01cdfe', cost: 0.05, ref: 0.8, pop: 0.2 },
      { id: 'lime', name: 'LIME LASER', color: '#05ffa1', cost: 0.05, ref: 0.75, pop: 0.14 },
      { id: 'lemon', name: 'LEMON ZAP', color: '#fffb96', cost: 0.05, ref: 0.7, pop: 0.12 },
      { id: 'grape', name: 'GRAPE GLITCH', color: '#b967ff', cost: 0.05, ref: 0.8, pop: 0.16 },
      { id: 'bubble', name: 'BUBBLE POP', color: '#ff9ee0', cost: 0.05, ref: 0.85, pop: 0.16 },
      { id: 'prize', name: 'GOLD PRIZE', color: '#ffd34a', cost: 1.25, ref: 0.8, pop: 0, prize: true },
    ],
    LAYOUT: [0, 1, 2, 3, 4, 5, 6],
    START_MIX: [30, 30, 25, 20, 25, 30, 0],
    // a new machine after an explosion: price and minutes to deliver; where
    // the machine stands (x from–to), its colour and where items come out
    MACHINE: 50, DELIVERY: 90, FOOT: [17, 48], BODY: '#e8204f', HATCH: [32.5, 64.5],
    STAGE: { W: 200, H: 104, MX: 70, MY: 4, FRONT: 60, GAP: 15, ENTER: -14, EXIT: 214, QUEUE: 5, WALK: 4, USE: 5 },
  };
})(typeof window !== 'undefined' ? (window.VT = window.VT || {}) : (globalThis.VT = globalThis.VT || {}));
