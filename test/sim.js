/* Plays the soda simulation in Node and checks it: invariants every game
 * hour, money that adds up, and the same seed playing out the same.
 * Run with: node test/sim.js */
'use strict';
globalThis.VT = {};
require('../js/soda/config.js');
require('../js/soda/sim.js');
const VT = globalThis.VT, K = VT.SODA;

let failed = 0;
function check(ok, what) {
  if (!ok) { failed++; console.log('FAIL ' + what); }
}

// A simple operator: repairs jams, empties the coin box and tops up slots.
function attentive(st) {
  if (st.jam) VT.sodaRepair(st);
  if (st.cashbox > 40) VT.sodaCollect(st);
  st.slots.forEach((s, i) => { if (s.stock <= 2) VT.sodaRestock(st, i); });
}

function play(seed, days, operator) {
  const st = VT.sodaNew(seed);
  const start = st.wallet + st.cashbox + VT.sodaStockValue(st);
  for (let h = 0; h < days * 24; h++) {
    VT.sodaStep(st, 60);
    if (operator) operator(st);
    const tag = `seed ${seed} hour ${h}`;
    check(st.slots.every(s => s.stock >= 0 && s.stock <= K.CAP && Number.isInteger(s.stock)), tag + ': stock in range');
    check(st.rating >= 1 && st.rating <= 5, tag + ': rating in range');
    check(st.cashbox >= 0 && st.cashbox < K.CASHBOX + K.PRICE_MAX, tag + ': coin box in range');
    check(st.customers.filter(c => c.phase !== 'leave').length <= K.STAGE.QUEUE, tag + ': queue no longer than its spots');
    check(st.log.length <= 40, tag + ': log trimmed');
    // every dollar is accounted for: what you hold now minus what you started
    // with equals the profit booked so far (sales minus can costs, rent, repairs)
    const booked = st.history.reduce((a, d) => a + d.profit, 0) + VT.sodaProfit(st.today);
    const held = st.wallet + st.cashbox + VT.sodaStockValue(st) - start;
    check(Math.abs(held - booked) < 0.05, `${tag}: money adds up (held ${held.toFixed(2)}, booked ${booked.toFixed(2)})`);
  }
  return st;
}

function summary(st) {
  const h = st.history, n = h.length || 1, sum = k => h.reduce((a, d) => a + d[k], 0);
  return {
    days: h.length, customers: (sum('customers') / n).toFixed(1), sold: (sum('sold') / n).toFixed(1),
    lost: { soldOut: sum('lostOut'), price: sum('lostPrice'), queue: sum('lostQueue'), broken: sum('lostBroken') },
    profitPerDay: (sum('profit') / n).toFixed(2), wallet: st.wallet.toFixed(2), rating: st.rating.toFixed(2),
  };
}

// 1. an attentive operator over a month, on several seeds
for (const seed of [1, 7, 42, 2024]) {
  const st = play(seed, 30, attentive);
  const s = summary(st);
  console.log('attentive', seed, JSON.stringify(s));
  check(st.history.length === 30, `seed ${seed}: 30 days closed`);
  check(+s.customers > 15 && +s.customers < 70, `seed ${seed}: a plausible crowd (${s.customers}/day)`);
  check(+s.profitPerDay > 0, `seed ${seed}: an attentive operator makes money`);
}

// 2. nobody looks after the machine: it sells out or jams, and sales stop
{
  const st = play(5, 20, null);
  const s = summary(st);
  console.log('neglected', 5, JSON.stringify(s));
  check(st.history[st.history.length - 1].sold === 0, 'neglected machine stops selling');
  check(st.rating < 3, 'neglected machine loses its rating');
}

// 3. the same seed plays out the same, and a save survives JSON
{
  const a = play(99, 5, attentive), b = play(99, 5, attentive);
  check(JSON.stringify(a) === JSON.stringify(b), 'same seed, same game');
  const c = JSON.parse(JSON.stringify(a)), d = JSON.parse(JSON.stringify(a));
  VT.sodaStep(c, 600); VT.sodaStep(d, 600);
  check(JSON.stringify(c) === JSON.stringify(d), 'a restored save carries on the same');
}

// 4. prices: way too high scares everyone off
{
  const st = VT.sodaNew(3);
  st.slots.forEach((s, i) => VT.sodaSetPrice(st, i, 4.6));
  check(st.slots[0].price === 4.5, 'prices snap to the 25c step');
  VT.sodaStep(st, K.DAY * 2);
  check(st.history.every(d => d.sold === 0) && st.history.some(d => d.lostPrice > 0), 'nobody pays $4.50');
}

// 5. swapping a drink refunds its cans at cost
{
  const st = VT.sodaNew(4), before = st.wallet;
  VT.sodaSetProduct(st, 0, 2);
  check(Math.abs(st.wallet - before - K.CAP * K.PRODUCTS[0].cost) < 1e-9 && st.slots[0].stock === 0 && st.slots[0].p === 2, 'swap refunds and empties the slot');
}

if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
