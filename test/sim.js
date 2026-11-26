/* Plays every machine's simulation in Node and checks it: invariants every
 * game hour, money that adds up, and the same seed playing out the same.
 * Run with: node test/sim.js */
'use strict';
globalThis.VT = {};
require('../js/soda/config.js');
require('../js/snack/config.js');
require('../js/gumball/config.js');
require('../js/vend/sim.js');
const VT = globalThis.VT;
const SODA = VT.vend(VT.SODA), SNACK = VT.vend(VT.SNACK), GUM = VT.vend(VT.GUMBALL);

let failed = 0;
function check(ok, what) {
  if (!ok) { failed++; console.log('FAIL ' + what); }
}

// A simple operator: fixes the machine, empties the coin box, bins stale
// snacks, services worn coils and tops up slots.
function attentive(A, st) {
  if (st.jam) A.repair(st);
  if (A.K.STUCK && st.wear >= 7) A.service(st);
  if (st.cashbox > 40) A.collect(st);
  A.binAllStale(st);
  if (A.K.LOTTERY) { if (A.total(st) < 80) A.restockAll(st); }
  else st.slots.forEach((s, i) => { if (s.stock <= 2) A.restock(st, i); });
}

function play(A, seed, days, operator) {
  const K = A.K, st = A.create(seed);
  const start = st.wallet + st.cashbox + A.stockValue(st);
  for (let h = 0; h < days * 24; h++) {
    A.step(st, 60);
    if (operator) operator(A, st);
    const tag = `${K.ID} seed ${seed} hour ${h}`;
    check(st.slots.every(s => s.stock >= 0 && s.stock <= K.CAP && Number.isInteger(s.stock)), tag + ': stock in range');
    check(st.slots.every(s => !s.exp || (s.exp.length === s.stock && s.exp.every((e, k) => k === 0 || e >= s.exp[k - 1]))), tag + ': one date per item, oldest first');
    check(st.rating >= 1 && st.rating <= 5, tag + ': rating in range');
    check(st.cashbox >= 0 && st.cashbox < K.CASHBOX + K.PRICE_MAX, tag + ': coin box in range');
    check(st.customers.filter(c => c.phase !== 'leave').length <= K.STAGE.QUEUE, tag + ': queue no longer than its spots');
    check(st.log.length <= 40, tag + ': log trimmed');
    check(!K.LOTTERY || (A.total(st) <= K.GLOBE && st.slots.every(s => s.price === st.slots[0].price)), tag + ': globe within capacity, one price');
    // every dollar is accounted for: what you hold now minus what you started
    // with equals the profit booked so far (sales minus item costs, rent,
    // repairs and waste)
    const booked = st.history.reduce((a, d) => a + d.profit, 0) + A.profit(st.today);
    const held = st.wallet + st.cashbox + A.stockValue(st) - start;
    check(Math.abs(held - booked) < 0.05, `${tag}: money adds up (held ${held.toFixed(2)}, booked ${booked.toFixed(2)})`);
  }
  return st;
}

function summary(st) {
  const h = st.history, n = h.length || 1, sum = k => h.reduce((a, d) => a + d[k], 0);
  return {
    customers: (sum('customers') / n).toFixed(1), sold: (sum('sold') / n).toFixed(1),
    lost: { soldOut: sum('lostOut'), price: sum('lostPrice'), queue: sum('lostQueue'), broken: sum('lostBroken') },
    stuck: sum('stuck'), stale: sum('stale'), waste: sum('waste').toFixed(2),
    profitPerDay: (sum('profit') / n).toFixed(2), wallet: st.wallet.toFixed(2), rating: st.rating.toFixed(2),
  };
}

for (const A of [SODA, SNACK, GUM]) {
  const K = A.K;
  // 1. an attentive operator over a month, on several seeds
  for (const seed of [1, 7, 42, 2024]) {
    const st = play(A, seed, 30, attentive), s = summary(st);
    console.log(K.ID, 'attentive', seed, JSON.stringify(s));
    check(st.history.length === 30, `${K.ID} seed ${seed}: 30 days closed`);
    check(+s.customers > 15 && +s.customers < 70, `${K.ID} seed ${seed}: a plausible crowd (${s.customers}/day)`);
    check(+s.profitPerDay > 0, `${K.ID} seed ${seed}: an attentive operator makes money`);
  }

  // 2. nobody looks after the machine: sales stop and the rating drops
  {
    const st = play(A, 5, 25, null), s = summary(st);
    console.log(K.ID, 'neglected', 5, JSON.stringify(s));
    check(st.history[st.history.length - 1].sold <= 1, `${K.ID}: a neglected machine stops selling`);
    check(st.rating < 3, `${K.ID}: a neglected machine loses its rating`);
  }

  // 3. the same seed plays out the same, and a save survives JSON
  {
    const a = play(A, 99, 5, attentive), b = play(A, 99, 5, attentive);
    check(JSON.stringify(a) === JSON.stringify(b), `${K.ID}: same seed, same game`);
    const c = JSON.parse(JSON.stringify(a)), d = JSON.parse(JSON.stringify(a));
    A.step(c, 600); A.step(d, 600);
    check(JSON.stringify(c) === JSON.stringify(d), `${K.ID}: a restored save carries on the same`);
  }

  // 4. prices: way too high scares everyone off
  {
    const st = A.create(3);
    const high = Math.min(4.5, K.PRICE_MAX);
    st.slots.forEach((s, i) => A.setPrice(st, i, high + 0.1));
    check(st.slots[0].price === high, `${K.ID}: prices snap to the 25c step`);
    A.step(st, K.DAY * 2);
    check(st.history.every(d => d.sold === 0) && st.history.some(d => d.lostPrice > 0), `${K.ID}: nobody pays ${VT.money(high)}`);
  }

  // 5. swapping a product refunds its items at cost
  if (!K.LOTTERY) {
    const st = A.create(4), before = st.wallet, p0 = st.slots[0].p, other = (p0 + 2) % K.PRODUCTS.length;
    A.setProduct(st, 0, other);
    check(Math.abs(st.wallet - before - K.CAP * K.PRODUCTS[p0].cost) < 1e-9 && st.slots[0].stock === 0 && st.slots[0].p === other, `${K.ID}: swap refunds and empties the slot`);
  }
}

// snacks only: going stale, getting stuck
{
  const A = SNACK, K = A.K;
  const cookie = K.PRODUCTS.findIndex(p => p.id === 'cookie');
  const st = A.create(11), i = st.slots.findIndex(s => s.p === cookie);
  st.slots.forEach((s, j) => A.setPrice(st, j, K.PRICE_MAX)); // nothing sells, so the cookies sit there
  A.step(st, K.PRODUCTS[cookie].life * K.DAY);
  check(A.staleCount(st, st.slots[i]) > 0, 'cookies go stale after their shelf life');
  const n = A.staleCount(st, st.slots[i]), stock = st.slots[i].stock, waste = st.today.waste;
  A.binStale(st, i);
  check(st.slots[i].stock === stock - n && A.staleCount(st, st.slots[i]) === 0, 'binning removes exactly the stale ones');
  check(Math.abs(st.today.waste - waste - n * K.PRODUCTS[cookie].cost) < 1e-9, 'binned snacks count as waste');
  A.restock(st, i);
  check(st.slots[i].exp[st.slots[i].exp.length - 1] === Math.round(st.t + K.PRODUCTS[cookie].life * K.DAY), 'restocked snacks get a fresh date');

  const w = A.create(12);
  w.wear = 100;
  check(A.stuckChance(w) === K.STUCK.max, 'stuck chance is capped');
  A.step(w, K.DAY * 2);
  check(w.history.some(d => d.stuck > 0), 'worn coils make snacks stick');
  check(w.history.every(d => d.stuck <= d.sold), 'only sold snacks can stick');
  A.service(w);
  check(w.wear === 0 && w.slots.every(s => !s.hang) && A.stuckChance(w) === K.STUCK.base, 'a service resets the coils');
}

// gumballs only: chance, repeat goes, prizes and hype
{
  const A = GUM, K = A.K, prize = K.PRODUCTS.findIndex(p => p.prize);
  const st = A.create(21);
  A.setPrice(st, 3, 0.75);
  check(st.slots.every(s => s.price === 0.75), 'one price for every turn');
  A.restock(st, prize); A.restock(st, prize);
  check(st.slots[prize].stock === 2 * K.BATCH - (2 * K.BATCH - st.slots[prize].stock) && A.total(st) <= K.GLOBE, 'a prize bag fits in the globe');
  let hyped = false;
  for (let h = 0; h < 30 * 24; h++) {
    A.step(st, 60);
    if (st.hype > 0) hyped = true;
    if (st.cashbox > 30) A.collect(st);
    if (st.jam) A.repair(st);
    if (A.total(st) < 80) A.restockAll(st);
  }
  const sum = k => st.history.reduce((a, d) => a + d[k], 0);
  console.log('gumball prizes', sum('prizes'), 'repeat goes', sum('repeats'), 'turns', sum('sold'));
  check(sum('repeats') > 0, 'kids who miss their favourite go again');
  check(sum('prizes') > 0 && hyped, 'prize balls get won and build hype');
  check(st.hype <= 4, 'hype is capped');

  const top = A.create(22);
  top.wallet = 1000;
  A.restockAll(top);
  check(A.total(top) === K.GLOBE && top.slots[prize].stock === 0, 'topping up fills the globe, without prizes');

  // a globe of only lemon: cherry fans often don't bother
  const lemon = A.create(23);
  lemon.slots.forEach((s, i) => { if (i !== 3) s.stock = 0; });
  lemon.slots[3].stock = K.GLOBE;
  A.step(lemon, K.DAY * 3);
  check(lemon.history.some(d => d.lostOut > 0), 'kids skip a globe without their colour');
}

// an old soda save (from before snacks) still loads
{
  const old = SODA.create(8);
  delete old.wear; for (const s of old.slots) delete s.hang;
  for (const k of ['waste', 'stuck', 'stale']) delete old.today[k];
  const st = SODA.upgrade(JSON.parse(JSON.stringify(old)));
  SODA.step(st, SODA.K.DAY);
  check(Number.isFinite(SODA.profit(st.history[0])) && st.history[0].waste === 0, 'old soda saves upgrade cleanly');
}

if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
