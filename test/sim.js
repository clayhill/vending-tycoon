/* Plays every machine's simulation in Node and checks it: invariants every
 * game hour, money that adds up, and the same seed playing out the same.
 * Run with: node test/sim.js */
'use strict';
globalThis.VT = {};
require('../js/soda/config.js');
require('../js/snack/config.js');
require('../js/gumball/config.js');
require('../js/coffee/config.js');
require('../js/vend/sim.js');
const VT = globalThis.VT;
const SODA = VT.vend(VT.SODA), SNACK = VT.vend(VT.SNACK), GUM = VT.vend(VT.GUMBALL), COFFEE = VT.vend(VT.COFFEE);

let failed = 0;
function check(ok, what) {
  if (!ok) { failed++; console.log('FAIL ' + what); }
}

// A simple operator: fixes the machine, empties the coin box, bins stale
// snacks, services worn coils and tops up slots (or, for coffee, empties the
// grounds and refills what runs low or goes sour).
function attentive(A, st) {
  if (st.wreck) { if (!st.order) A.orderMachine(st); return; }
  if (st.jam) A.repair(st);
  if (A.K.STUCK && st.wear >= 7) A.service(st);
  if (st.cashbox > 40) A.collect(st);
  A.binAllStale(st);
  if (A.K.LOTTERY) { if (A.total(st) < 80) A.restockAll(st); }
  else if (A.K.SUPPLY) {
    if (st.grounds > 35) A.clean(st);
    for (const k in A.K.SUPPLY) if (A.sour(st, k) || st.sup[k] < A.K.SUPPLY[k].cap * 0.3) A.refill(st, k);
  }
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
    check(!K.SUPPLY || (Object.keys(K.SUPPLY).every(k => Number.isInteger(st.sup[k]) && st.sup[k] >= 0 && st.sup[k] <= K.SUPPLY[k].cap) && st.grounds <= K.GROUNDS), tag + ': supplies and grounds in range');
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

for (const A of [SODA, SNACK, GUM, COFFEE]) {
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
    const high = K.SUPPLY ? K.PRICE_MAX : Math.min(4.5, K.PRICE_MAX);
    st.slots.forEach((s, i) => A.setPrice(st, i, high + 0.1));
    check(st.slots[0].price === high, `${K.ID}: prices snap to the 25c step`);
    A.step(st, K.DAY * 2);
    check(st.history.every(d => d.sold === 0) && st.history.some(d => d.lostPrice > 0), `${K.ID}: nobody pays ${VT.money(high)}`);
  }

  // 5. swapping a product refunds its items at cost
  if (!K.LOTTERY && !K.SUPPLY) {
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

// coffee only: brewing, sour milk, the grounds bin and the cold
{
  const A = COFFEE, K = A.K, latte = K.PRODUCTS.findIndex(p => p.id === 'latte');
  check(K.PRODUCTS[0].cost === 0.26 && K.PRODUCTS[latte].cost === 0.5, 'a drink costs what goes into it');

  const st = A.create(31);
  for (let i = 0; i < 6; i++) A.setPrice(st, i, K.PRICE_MAX); // nothing sells, so the milk sits there
  A.step(st, K.SUPPLY.milk.life * K.DAY + 1);
  check(A.sour(st, 'milk') && !A.sour(st, 'beans'), 'milk goes sour after its life; beans do not');
  check(st.log.some(e => e.text.includes('MILK HAS GONE SOUR')), 'the machine says when the milk turns');
  // topping up sour milk pours it away first, and fresh milk gets a new date
  const waste = st.today.waste, milk = st.sup.milk;
  st.sup.milk = 30;
  A.refill(st, 'milk');
  check(st.sup.milk === K.SUPPLY.milk.cap && !A.sour(st, 'milk') && Math.abs(st.today.waste - waste - 30 * K.SUPPLY.milk.cost) < 1e-9, 'refilling sour milk wastes it and starts fresh');
  // topping up good milk keeps the oldest date
  const exp = st.supExp.milk;
  st.sup.milk = 10; st.wallet = 100;
  A.step(st, 60); A.refill(st, 'milk');
  check(st.supExp.milk === exp, 'topping up keeps the old date');
  check(milk === K.SUPPLY.milk.cap, 'unsold milk stays in the tank');

  // a sour latte is a disgusted customer
  const sour = A.create(32);
  sour.supExp.milk = sour.t; // turned just now
  for (let i = 0; i < 6; i++) A.setPrice(sour, i, i === latte ? 0.5 : K.PRICE_MAX);
  A.step(sour, K.DAY);
  check(sour.history[0].stale > 0, 'drinks made with sour milk count as spoiled');

  // brewing takes time, then the customer leaves with the drink
  const b = A.create(33);
  let brewing = false, served = false;
  for (let m = 0; m < 600 && !served; m++) {
    A.step(b, 1);
    if (b.customers.some(c => c.brewing)) brewing = true;
    if (brewing && b.customers.some(c => c.phase === 'leave' && (c.bubble === 'love' || c.bubble === 'ok'))) served = true;
  }
  check(brewing && served, 'a drink brews while the customer waits, then they leave happy');

  // a full grounds bin stops the machine until it is emptied
  const g = A.create(34);
  g.grounds = K.GROUNDS;
  A.step(g, K.DAY);
  check(g.history[0].sold === 0 && g.history[0].lostBroken > 0, 'a full grounds bin stops the machine');
  A.clean(g);
  A.step(g, K.DAY);
  check(g.grounds > 0 && g.history[1].sold > 0, 'emptying the bin gets it brewing again');

  // the cold brings customers
  const cold = A.create(35), warm = A.create(35);
  cold.temp = 6; warm.temp = 30;
  check(A.rate(cold) > A.rate(warm) * 1.5, 'cold days bring more coffee drinkers');

  // neglected: the supplies run out and nothing more can be made
  const n = play(A, 36, 12, null);
  check(n.slots.every((s, i) => A.canMake(n, i) === 0) || A.down(n), 'a neglected coffee machine runs dry, clogs or chokes on grounds');
}

// oddities and TNT, on every machine
for (const base of [VT.SODA, VT.SNACK, VT.GUMBALL, VT.COFFEE]) {
  // every sale weird, none of it TNT: customers are puzzled but it is paid for
  const W = VT.vend(Object.assign({}, base, { WEIRD: 1, TNT: 0 })), K = W.K;
  const w = W.create(51);
  W.step(w, K.DAY);
  const d = w.history[0];
  check(d.sold > 0 && d.weird === d.sold && d.revenue > 0, `${K.ID}: oddities come out instead, and are paid for`);
  check(w.log.some(e => e.text.startsWith('WHAT?')), `${K.ID}: the log says what came out`);
  check(!w.wreck, `${K.ID}: an oddity alone does not blow anything up`);

  // every oddity TNT: the first sale ends in a wreck
  const T = VT.vend(Object.assign({}, base, { WEIRD: 1, TNT: 1 }));
  const t = T.create(52);
  const start = t.wallet + t.cashbox + T.stockValue(t);
  let lit = false;
  for (let m = 0; m < 24 * 60 && !t.wreck; m++) { T.step(t, 1); if (t.customers.some(c => c.tnt)) lit = true; }
  check(lit && t.wreck, `${K.ID}: the customer picks up lit TNT and the machine explodes`);
  check(T.stockValue(t) === 0 && t.cashbox === 0 && t.today.wreck > 0, `${K.ID}: the explosion takes stock and coin box`);
  check(t.customers.some(c => c.flee && c.charred) && !t.customers.some(c => c.phase === 'use'), `${K.ID}: everyone runs, the TNT customer singed`);
  check(T.restockAll(t) === 0 || T.stockValue(t) === 0, `${K.ID}: a wreck cannot be restocked`);
  const sold = t.today.sold;
  T.step(t, 120);
  check(t.today.sold === sold && t.wreck, `${K.ID}: a wreck sells nothing`);
  const wallet = t.wallet;
  check(T.orderMachine(t) && !T.orderMachine(t) && Math.abs(wallet - t.wallet - K.MACHINE) < 1e-9, `${K.ID}: ordering a new machine costs ${K.MACHINE}, once`);
  T.step(t, K.DELIVERY + 1);
  check(!t.wreck && !t.order, `${K.ID}: the new machine arrives`);
  const booked = t.history.reduce((a, x) => a + x.profit, 0) + T.profit(t.today);
  check(Math.abs(t.wallet + t.cashbox + T.stockValue(t) - start - booked) < 0.05, `${K.ID}: the explosion and new machine are booked`);
  check(T.stockValue(t) > 0, `${K.ID}: the new machine arrives filled`);
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
