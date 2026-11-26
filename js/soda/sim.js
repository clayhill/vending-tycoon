/* The soda machine simulation. The whole game is one plain, JSON-safe state
 * object, advanced in fixed steps with its own seeded RNG, so a save game
 * resumes exactly and a seed always plays out the same.
 *
 * Customers arrive at a rate that follows the hour, the weather and the
 * machine's star rating. Each has a favourite drink and a price they will
 * pay for it; they queue, then buy their favourite, settle for another, or
 * walk off (sold out, too pricey, jammed machine, line too long). How that
 * goes moves the rating, and the rating brings or keeps away customers. */
(function (VT) {
  'use strict';
  const K = VT.SODA, S = K.STAGE, P = K.PRODUCTS;
  const MEAN_H = K.HOURS.reduce((a, b) => a + b, 0) / 24;
  const POP = P.reduce((a, p) => a + p.pop, 0);
  const STEP = 0.25; // minutes
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cents = v => Math.round(v * 100) / 100;

  VT.money = v => (v < -0.004 ? '-$' : '$') + Math.abs(v).toFixed(2);
  VT.slotName = i => 'ABCD'[Math.floor(i / K.COLS)] + ((i % K.COLS) + 1);

  function rand(st) {
    st.rng = (st.rng + 0x6d2b79f5) >>> 0;
    let t = st.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function gauss(st) { return Math.sqrt(-2 * Math.log(rand(st) || 1e-9)) * Math.cos(2 * Math.PI * rand(st)); }
  const blankDay = () => ({ customers: 0, sold: 0, revenue: 0, cogs: 0, lostOut: 0, lostPrice: 0, lostQueue: 0, lostBroken: 0, rent: 0, repairs: 0 });
  function log(st, kind, text) {
    st.log.push({ seq: ++st.seq, t: st.t, kind, text });
    if (st.log.length > 40) st.log.shift();
  }
  const rate = (st, d) => { st.rating = clamp(st.rating + d, 1, 5); };

  VT.sodaNew = function (seed) {
    const st = {
      v: 1, seed: seed >>> 0, rng: seed >>> 0, t: 8 * 60, seq: 0, sales: 0, nextId: 1,
      wallet: K.START_WALLET, cashbox: 0, rating: 3, jam: false, temp: 22, sky: 'sun',
      slots: K.LAYOUT.map(p => ({ p, stock: K.CAP, price: K.START_PRICE })),
      customers: [], today: blankDay(), history: [], log: [], lastSale: null,
    };
    log(st, 'info', 'DAY 1: YOUR MACHINE IS OPEN FOR BUSINESS');
    return st;
  };

  VT.sodaDay = st => Math.floor(st.t / K.DAY) + 1;
  VT.sodaHour = st => (st.t % K.DAY) / 60;
  VT.sodaClock = st => {
    const m = Math.floor(st.t % K.DAY);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  VT.sodaProfit = d => cents(d.revenue - d.cogs - d.rent - d.repairs);
  VT.sodaStockValue = st => cents(st.slots.reduce((s, x) => s + x.stock * P[x.p].cost, 0));
  VT.sodaFull = st => st.cashbox >= K.CASHBOX - 1e-9;

  // expected customers per minute right now
  VT.sodaRate = function (st) {
    const w = K.HOURS[Math.floor(VT.sodaHour(st))] / MEAN_H;
    const heat = clamp(0.55 + (st.temp - 10) * 0.035, 0.45, 1.5);
    return (K.CUSTOMERS_PER_DAY / K.DAY) * w * heat * K.SKY[st.sky] * (0.5 + st.rating / 6);
  };

  VT.sodaStep = function (st, minutes) {
    let left = minutes;
    while (left > 1e-9) {
      const dt = Math.min(STEP, left);
      tick(st, dt);
      left -= dt;
    }
  };

  function tick(st, dt) {
    const day = Math.floor(st.t / K.DAY);
    st.t += dt;
    if (Math.floor(st.t / K.DAY) !== day) endDay(st);
    if (!st.jam && rand(st) < (K.JAMS_PER_DAY * dt) / K.DAY) {
      st.jam = true;
      log(st, 'warn', 'COIN JAM! THE MACHINE NEEDS A REPAIR');
    }
    if (rand(st) < VT.sodaRate(st) * dt) arrive(st);
    move(st, dt);
  }

  function endDay(st) {
    const d = st.today, day = Math.floor(st.t / K.DAY);
    d.rent = K.RENT;
    st.wallet = cents(st.wallet - K.RENT);
    const profit = VT.sodaProfit(d);
    st.history.push(Object.assign({ day, profit, temp: st.temp, sky: st.sky }, d));
    if (st.history.length > 60) st.history.shift();
    log(st, 'day', `DAY ${day} CLOSED: PROFIT ${VT.money(profit)}`);
    rate(st, (3 - st.rating) * 0.08);
    st.temp = Math.round(clamp(st.temp + gauss(st) * 3.5 + (22 - st.temp) * 0.25, 6, 36));
    const r = rand(st);
    st.sky = st.temp >= 26 ? 'sun' : r < 0.3 ? 'rain' : r < 0.65 ? 'cloud' : 'sun';
    st.today = blankDay();
  }

  function arrive(st) {
    let r = rand(st) * POP, fav = 0;
    while (fav < P.length - 1 && (r -= P[fav].pop) > 0) fav++;
    const c = {
      id: st.nextId++, look: (rand(st) * 2147483647) | 0, x: S.ENTER, phase: 'walk', timer: 0, bubble: null, bubbleT: 0, fav,
      wtp: cents(P[fav].ref * Math.exp(gauss(st) * 0.22) * (1 + Math.max(0, st.temp - 24) * 0.015)),
    };
    st.today.customers++;
    if (st.customers.filter(o => o.phase !== 'leave').length >= S.QUEUE) {
      c.phase = 'leave'; c.bubble = 'queue'; c.bubbleT = 40;
      st.today.lostQueue++;
      rate(st, -0.015);
      log(st, 'lost', 'NO SALE: THE LINE WAS TOO LONG');
    }
    st.customers.push(c);
  }

  function move(st, dt) {
    const line = st.customers.filter(c => c.phase !== 'leave');
    line.forEach((c, i) => {
      if (c.phase === 'use') {
        if ((c.timer -= dt) <= 0) decide(st, c);
        return;
      }
      const target = S.FRONT - i * S.GAP;
      if (c.x < target) { c.x = Math.min(target, c.x + S.WALK * dt); c.phase = 'walk'; }
      if (c.x >= target) {
        if (i === 0) { c.phase = 'use'; c.timer = S.USE; } else c.phase = 'queue';
      }
    });
    for (const c of st.customers) {
      if (c.phase === 'leave') c.x += S.WALK * 1.3 * dt;
      if (c.bubbleT > 0 && (c.bubbleT -= dt) <= 0) c.bubble = null;
    }
    st.customers = st.customers.filter(c => c.x < S.EXIT);
  }

  function decide(st, c) {
    c.phase = 'leave'; c.bubbleT = 36;
    if (st.jam || VT.sodaFull(st)) return lose(st, c, 'broken');
    const open = st.slots.map((s, i) => ({ s, i })).filter(o => o.s.stock > 0);
    const favs = open.filter(o => o.s.p === c.fav).sort((a, b) => a.s.price - b.s.price);
    if (favs.length && favs[0].s.price <= c.wtp + 1e-9) return sell(st, favs[0].i, c, true);
    // not their favourite, but something else might do at a lower price
    let best = null, gain = -1;
    for (const o of open) {
      if (o.s.p === c.fav) continue;
      const g = (c.wtp * P[o.s.p].ref) / P[c.fav].ref * 0.85 - o.s.price;
      if (g >= 0 && g > gain) { best = o; gain = g; }
    }
    if (best && rand(st) < 0.6) return sell(st, best.i, c, false);
    lose(st, c, favs.length ? 'price' : 'soldout');
  }

  function sell(st, i, c, fav) {
    const s = st.slots[i], p = P[s.p], d = st.today;
    s.stock--;
    st.cashbox = cents(st.cashbox + s.price);
    d.sold++; d.revenue = cents(d.revenue + s.price); d.cogs = cents(d.cogs + p.cost);
    st.lastSale = { n: ++st.sales, slot: i, p: s.p };
    c.bubble = fav ? 'love' : 'ok';
    rate(st, fav ? 0.006 : 0.002);
    log(st, 'sale', `SOLD ${p.name} AT ${VT.slotName(i)} FOR ${VT.money(s.price)}`);
    if (VT.sodaFull(st)) log(st, 'warn', 'COIN BOX FULL! COLLECT THE CASH');
    if (!s.stock) log(st, 'warn', `${VT.slotName(i)} IS SOLD OUT`);
  }

  function lose(st, c, why) {
    const d = st.today, name = P[c.fav].name;
    c.bubble = why;
    if (why === 'broken') {
      d.lostBroken++; rate(st, -0.03);
      log(st, 'lost', st.jam ? 'NO SALE: THE MACHINE IS JAMMED' : 'NO SALE: THE COIN BOX IS FULL');
    } else if (why === 'price') {
      d.lostPrice++; rate(st, -0.01);
      log(st, 'lost', `NO SALE: ${name} WAS TOO PRICEY`);
    } else {
      d.lostOut++; rate(st, -0.03);
      log(st, 'lost', `NO SALE: WANTED ${name}, NONE LEFT`);
    }
  }

  // ---- what the player can do ----

  VT.sodaSetPrice = function (st, i, price) {
    st.slots[i].price = cents(clamp(Math.round(price / K.PRICE_STEP) * K.PRICE_STEP, K.PRICE_MIN, K.PRICE_MAX));
  };

  // Swapping a slot's drink sends its cans back to the supplier at cost.
  VT.sodaSetProduct = function (st, i, p) {
    const s = st.slots[i];
    if (s.p === p) return;
    const refund = cents(s.stock * P[s.p].cost);
    st.wallet = cents(st.wallet + refund);
    if (s.stock) log(st, 'info', `${VT.slotName(i)}: RETURNED ${s.stock} ${P[s.p].name} FOR ${VT.money(refund)}`);
    s.p = p; s.stock = 0;
    log(st, 'info', `${VT.slotName(i)} NOW SELLS ${P[p].name}`);
  };

  VT.sodaRestockCost = (st, i) => cents((K.CAP - st.slots[i].stock) * P[st.slots[i].p].cost);
  VT.sodaRestockAllCost = st => cents(st.slots.reduce((a, s, i) => a + VT.sodaRestockCost(st, i), 0));

  // Buys as many cans as the wallet allows; returns how many.
  function restock(st, i) {
    const s = st.slots[i], cost = P[s.p].cost;
    const n = Math.min(K.CAP - s.stock, Math.max(0, Math.floor((st.wallet + 1e-9) / cost)));
    s.stock += n;
    st.wallet = cents(st.wallet - n * cost);
    return { n, cost: cents(n * cost) };
  }
  VT.sodaRestock = function (st, i) {
    const r = restock(st, i);
    if (r.n) log(st, 'info', `RESTOCKED ${VT.slotName(i)}: ${r.n} CANS FOR ${VT.money(r.cost)}`);
    return r.n;
  };
  VT.sodaRestockAll = function (st) {
    let n = 0, cost = 0;
    for (let i = 0; i < st.slots.length; i++) { const r = restock(st, i); n += r.n; cost += r.cost; }
    if (n) log(st, 'info', `RESTOCKED ${n} CANS FOR ${VT.money(cost)}`);
    return n;
  };

  VT.sodaCollect = function (st) {
    const v = st.cashbox;
    if (!v) return 0;
    st.wallet = cents(st.wallet + v); st.cashbox = 0;
    log(st, 'info', `COLLECTED ${VT.money(v)} FROM THE COIN BOX`);
    return v;
  };

  VT.sodaRepair = function (st) {
    if (!st.jam) return false;
    st.jam = false;
    st.wallet = cents(st.wallet - K.REPAIR);
    st.today.repairs = cents(st.today.repairs + K.REPAIR);
    log(st, 'info', `MACHINE REPAIRED FOR ${VT.money(K.REPAIR)}`);
    return true;
  };
})(typeof window !== 'undefined' ? window.VT : globalThis.VT);
