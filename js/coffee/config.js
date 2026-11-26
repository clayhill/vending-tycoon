/* Coffee machine: hot drinks brewed to order from shared supplies (beans,
 * milk, cocoa and cups), each to its recipe. Brewing takes a few minutes, so
 * the morning rush builds a line; the milk goes sour, the grounds bin fills
 * up, and cold days bring more customers who pay more. Loaded in the browser
 * and by the tests in Node, so nothing here touches the DOM. */
(function (VT) {
  'use strict';
  const SUPPLY = {
    beans: { name: 'BEANS', unit: 'SHOTS', cap: 120, cost: 0.2 },
    milk: { name: 'MILK', unit: 'CUPS', cap: 70, cost: 0.12, life: 2 },
    cocoa: { name: 'COCOA', unit: 'SCOOPS', cap: 50, cost: 0.15 },
    cups: { name: 'CUPS', unit: 'CUPS', cap: 120, cost: 0.06 },
  };
  // use: the recipe, in units of each supply; brew: minutes at the nozzle;
  // color: the button and label; liquid: what fills the cup
  const PRODUCTS = [
    { id: 'espresso', name: 'ESPRESSO', color: '#ff9e3d', liquid: '#4a2210', use: { beans: 1, cups: 1 }, brew: 1.5, ref: 1.9, start: 1.5, pop: 0.14 },
    { id: 'americano', name: 'AMERICANO', color: '#01cdfe', liquid: '#3a1a0c', use: { beans: 1, cups: 1 }, brew: 2.5, ref: 2.1, start: 1.75, pop: 0.18 },
    { id: 'cappuccino', name: 'CAPPUCCINO', color: '#f1e6ff', liquid: '#c99a6e', use: { beans: 1, milk: 1, cups: 1 }, brew: 3, ref: 2.7, start: 2.25, pop: 0.2 },
    { id: 'latte', name: 'VAPOR LATTE', color: '#ff71ce', liquid: '#d9b08a', use: { beans: 1, milk: 2, cups: 1 }, brew: 3, ref: 2.9, start: 2.5, pop: 0.22 },
    { id: 'mocha', name: 'MOCHA WAVE', color: '#b967ff', liquid: '#7a4a2e', use: { beans: 1, milk: 1, cocoa: 1, cups: 1 }, brew: 3.5, ref: 3.2, start: 2.75, pop: 0.12 },
    { id: 'cocoa', name: 'HOT COCOA', color: '#05ffa1', liquid: '#6a3a22', use: { milk: 2, cocoa: 1, cups: 1 }, brew: 2.5, ref: 2.4, start: 2, pop: 0.14 },
  ];
  // a drink costs you what goes into it
  for (const p of PRODUCTS) p.cost = Math.round(Object.entries(p.use).reduce((a, [k, n]) => a + n * SUPPLY[k].cost, 0) * 100) / 100;

  VT.COFFEE = {
    ID: 'coffee', NAME: 'COFFEE', ITEMS: 'DRINKS', SAVE: 'vt.coffee.v1',
    SUPPLY,
    GROUNDS: 50,               // pucks of grounds before the bin is full
    MIN_PER_SEC: 8,
    SPEEDS: [0, 1, 2, 5, 10],
    DAY: 1440,
    ROWS: 2, COLS: 3, CAP: 0,  // six drink buttons; the stock is in SUPPLY
    CASHBOX: 150,
    START_WALLET: 80,
    RENT: 25,                  // a kiosk spot by the station is not cheap
    REPAIR: 6,
    JAMS_PER_DAY: 0.15,
    JAM_MSG: 'THE BREWER IS CLOGGED! IT NEEDS A REPAIR',
    JAM_LOST: 'NO SALE: THE BREWER IS CLOGGED',
    JAM_SIGN: 'CLOG!', JAM_STATE: 'CLOGGED',
    CUSTOMERS_PER_DAY: 34,
    PRICE_STEP: 0.25, PRICE_MIN: 0.5, PRICE_MAX: 6, START_PRICE: 2,
    // the morning commute, lunch and a mid-afternoon pick-me-up
    HOURS: [0.05, 0.03, 0.02, 0.02, 0.05, 0.2, 0.9, 2.4, 2.6, 1.6, 1.0, 0.9, 1.2, 1.1, 0.9, 1.2, 1.1, 0.8, 0.6, 0.4, 0.3, 0.2, 0.12, 0.08],
    SKY: { sun: 0.95, cloud: 1, rain: 1.1 },
    // the colder it is, the more hot drinks sell, and the more people pay
    HEAT: t => Math.max(0.6, Math.min(1.4, 1.3 - (t - 10) * 0.025)),
    WTP_HEAT: 0, WTP_COLD: 0.02,
    PRODUCTS,
    LAYOUT: [0, 1, 2, 3, 4, 5],
    ART: { x: 10, y: 24, dx: 14, dy: 9, w: 12, h: 7 },
    // a new machine after an explosion: price and minutes to deliver; where
    // the machine stands (x from–to), its colour and where items come out
    MACHINE: 180, DELIVERY: 150, FOOT: [8, 56], BODY: '#8a3ab9', HATCH: [29.5, 71],
    STAGE: { W: 200, H: 104, MX: 70, MY: 4, FRONT: 60, GAP: 16, ENTER: -14, EXIT: 214, QUEUE: 5, WALK: 4, USE: 2.5 },
  };
})(typeof window !== 'undefined' ? (window.VT = window.VT || {}) : (globalThis.VT = globalThis.VT || {}));
