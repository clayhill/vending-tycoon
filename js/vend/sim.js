/* The vending machine engine. VT.vend(K) takes a machine's config (see
 * js/soda/config.js, js/snack/config.js) and returns the functions that
 * create and advance a game and carry out the player's actions.
 *
 * A game is one plain, JSON-safe state object, advanced in fixed steps with
 * its own seeded RNG, so a save resumes exactly and a seed always plays out
 * the same. Customers arrive at a rate that follows the hour, the weather
 * and the star rating. Each has a favourite and a price they will pay; they
 * queue, then buy their favourite, settle for another, or walk off (sold
 * out, too pricey, machine down, line too long), and a bubble says which.
 * How that goes moves the rating, and the rating brings customers or not.
 *
 * Machines switch on extras in their config:
 *  - JAMS_PER_DAY: the coin mechanism jams now and then; a repair fixes it.
 *  - products with a `life` (days): every item has a best-before time, kept
 *    per slot in `exp` (oldest first, as the coil sells front to back).
 *    Stale items still sell, but the buyer is disgusted; binning them is waste.
 *  - STUCK: an item can hang in its coil after the customer paid. The next
 *    buyer from that coil gets it free with theirs. Coils wear every day and
 *    stick more often until a service.
 *  - LOTTERY (gumballs): no choosing. The slots are the flavours in one
 *    globe of GLOBE balls, all at one price per turn, and each turn gives a
 *    random ball. Customers who miss their favourite may go again; one whose
 *    colour is not in the globe may not bother. A `prize` ball delights its
 *    winner and builds hype, which brings extra customers for a few days.
 *  - KIDS: the share of customers who are kids (drawn smaller).
 *  - SUPPLY (coffee): drinks are brewed to order from shared supplies (beans,
 *    milk, cups…) by each product's recipe `use`, so the slots hold no stock.
 *    A brew takes the product's `brew` minutes while the customer waits. A
 *    supply with a `life` goes sour that many days after it was filled from
 *    empty (topping it up keeps the old date); a drink made with it is
 *    disgusting. Every shot of beans leaves grounds, and when the GROUNDS bin
 *    is full the machine stops until someone empties it.
 *
 * Every machine, now and then, drops something that has no business being
 * in a vending machine instead of what was paid for (WEIRD: the chance per
 * sale). Rarely, that something is a bundle of TNT: the customer picks it up,
 * the fuse burns down, and the machine explodes, taking its stock and the
 * coin box with it. The smoking wreck sells nothing until a new machine is
 * ordered (MACHINE dollars) and delivered (DELIVERY minutes), filled like
 * the first one. */
(function (VT) {
  'use strict';
  const STEP = 0.25; // minutes
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cents = v => Math.round(v * 100) / 100;
  VT.money = v => (v < -0.004 ? '-$' : '$') + Math.abs(v).toFixed(2);

  function rand(st) {
    st.rng = (st.rng + 0x6d2b79f5) >>> 0;
    let t = st.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function gauss(st) { return Math.sqrt(-2 * Math.log(rand(st) || 1e-9)) * Math.cos(2 * Math.PI * rand(st)); }
  const blankDay = () => ({
    customers: 0, sold: 0, revenue: 0, cogs: 0, lostOut: 0, lostPrice: 0, lostQueue: 0, lostBroken: 0,
    rent: 0, repairs: 0, waste: 0, stuck: 0, stale: 0, prizes: 0, repeats: 0, weird: 0, wreck: 0,
  });
  // the oddities, and what the log calls them
  VT.ODDITIES = { duck: 'A RUBBER DUCK', fish: 'A WET FISH', boot: 'AN OLD BOOT', tape: 'A MIXTAPE', cactus: 'A TINY CACTUS', gnome: 'A GARDEN GNOME', tnt: 'A BUNDLE OF TNT' };
  const ODD = Object.keys(VT.ODDITIES).filter(k => k !== 'tnt');
  const TNT_SHARE = 0.12; // of the oddities, how many are TNT
  const FUSE = 14;        // game minutes from picking up the TNT to the bang

  VT.vend = function (K) {
    const S = K.STAGE, P = K.PRODUCTS, N = K.ROWS * K.COLS;
    const MEAN_H = K.HOURS.reduce((a, b) => a + b, 0) / 24;
    const POP = P.reduce((a, p) => a + p.pop, 0);
    const PERISH = P.some(p => p.life), LOTTO = !!K.LOTTERY, BREW = !!K.SUPPLY;
    const SUP = BREW ? Object.keys(K.SUPPLY) : [];
    const A = { K };
    const WEIRD = K.WEIRD === undefined ? 0.025 : K.WEIRD, TNT = K.TNT === undefined ? TNT_SHARE : K.TNT;
    A.total = st => st.slots.reduce((a, s) => a + s.stock, 0);
    const space = st => (LOTTO ? K.GLOBE - A.total(st) : Infinity);

    A.slotName = i => 'ABCDEFGH'[Math.floor(i / K.COLS)] + ((i % K.COLS) + 1);
    function log(st, kind, text) {
      st.log.push({ seq: ++st.seq, t: st.t, kind, text });
      if (st.log.length > 40) st.log.shift();
    }
    const rate = (st, d) => { st.rating = clamp(st.rating + d, 1, 5); };

    // ---- items in a slot ----
    const isStale = (st, s) => !!(s.exp && s.exp.length && s.exp[0] <= st.t);
    A.isStale = isStale;
    A.staleCount = (st, s) => (s.exp ? s.exp.filter(e => e <= st.t).length : 0);
    function take(s) { s.stock--; if (s.exp) s.exp.shift(); }
    function add(st, s, n) {
      s.stock += n;
      if (P[s.p].life) for (let k = 0; k < n; k++) s.exp.push(Math.round(st.t + P[s.p].life * K.DAY));
    }

    A.create = function (seed) {
      const st = {
        v: 1, machine: K.ID, seed: seed >>> 0, rng: seed >>> 0, t: 8 * 60, seq: 0, sales: 0, nextId: 1,
        wallet: K.START_WALLET, cashbox: 0, rating: 3, jam: false, wear: 0, hype: 0, temp: 22, sky: 'sun',
        wreck: null, order: null, booms: 0, arrivals: 0,
        slots: [], customers: [], today: blankDay(), history: [], log: [], lastSale: null,
      };
      K.LAYOUT.forEach((p, i) => {
        const s = { p, stock: 0, price: P[p].start || K.START_PRICE, hang: false };
        if (PERISH) s.exp = [];
        st.slots.push(s);
      });
      if (BREW) { st.sup = {}; st.supExp = {}; st.grounds = 0; }
      fill(st, true);
      log(st, 'info', 'DAY 1: YOUR MACHINE IS OPEN FOR BUSINESS');
      return st;
    };

    // a machine from the factory comes filled: a full set of each product (or,
    // for gumballs, the starter mix; for coffee, full tanks)
    function fill(st, first) {
      st.slots.forEach((s, i) => {
        add(st, s, LOTTO ? K.START_MIX[i] : BREW ? 0 : K.CAP);
        // the stock you start with was delivered over the last few days
        if (first && s.exp) { const age = Math.floor(rand(st) * P[s.p].life * 0.5) * K.DAY; s.exp = s.exp.map(e => e - age); }
      });
      if (BREW) for (const k of SUP) {
        st.sup[k] = K.SUPPLY[k].cap;
        if (K.SUPPLY[k].life) st.supExp[k] = st.t + K.SUPPLY[k].life * K.DAY;
      }
    }

    // fill in fields that older saves do not have
    A.upgrade = function (st) {
      st.today = Object.assign(blankDay(), st.today);
      if (st.wear === undefined) st.wear = 0;
      if (st.hype === undefined) st.hype = 0;
      for (const s of st.slots) {
        if (s.hang === undefined) s.hang = false;
        if (PERISH && !s.exp) s.exp = Array(s.stock).fill(st.t + K.DAY * 3);
      }
      for (const d of st.history) for (const k of ['waste', 'stuck', 'stale', 'prizes', 'repeats', 'weird', 'wreck']) if (d[k] === undefined) d[k] = 0;
      if (st.wreck === undefined) { st.wreck = null; st.order = null; st.booms = 0; st.arrivals = 0; }
      return st;
    };

    A.day = st => Math.floor(st.t / K.DAY) + 1;
    A.hour = st => (st.t % K.DAY) / 60;
    A.clock = (st, t = st.t) => {
      const m = Math.floor(t % K.DAY);
      return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    };
    A.profit = d => cents(d.revenue - d.cogs - d.rent - d.repairs - (d.waste || 0) - (d.wreck || 0));
    A.stockValue = st => cents(BREW ? SUP.reduce((a, k) => a + st.sup[k] * K.SUPPLY[k].cost, 0)
      : st.slots.reduce((s, x) => s + x.stock * P[x.p].cost, 0));
    // ---- brewing (coffee) ----
    // how many of slot i's drink the supplies can still make
    A.canMake = (st, i) => Math.min(...Object.entries(P[st.slots[i].p].use).map(([k, n]) => Math.floor(st.sup[k] / n + 1e-9)));
    A.sour = (st, k) => !!(K.SUPPLY[k].life && st.sup[k] > 0 && st.supExp[k] <= st.t);
    A.groundsFull = st => BREW && st.grounds >= K.GROUNDS;
    A.down = st => !!st.wreck || st.jam || A.full(st) || A.groundsFull(st);
    A.full = st => st.cashbox >= K.CASHBOX - 1e-9;
    // word of a prize win spreads: each point of hype brings 12% more customers
    A.hypeBoost = st => 1 + 0.12 * (st.hype || 0);
    A.stuckChance = st => (K.STUCK ? Math.min(K.STUCK.max, K.STUCK.base + K.STUCK.perDay * st.wear) : 0);

    // expected customers per minute right now
    A.rate = function (st) {
      const w = K.HOURS[Math.floor(A.hour(st))] / MEAN_H;
      return (K.CUSTOMERS_PER_DAY / K.DAY) * w * K.HEAT(st.temp) * K.SKY[st.sky] * (0.5 + st.rating / 6) * A.hypeBoost(st);
    };

    A.step = function (st, minutes) {
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
      if (st.order && st.t >= st.order.at) deliver(st);
      if (K.JAMS_PER_DAY && !st.jam && !st.wreck && rand(st) < (K.JAMS_PER_DAY * dt) / K.DAY) {
        st.jam = true;
        log(st, 'warn', K.JAM_MSG || 'COIN JAM! THE MACHINE NEEDS A REPAIR');
      }
      for (const k of SUP) {
        const e = st.supExp[k];
        if (e !== undefined && st.sup[k] > 0 && e > st.t - dt && e <= st.t) log(st, 'warn', `THE ${K.SUPPLY[k].name} HAS GONE SOUR: POUR IT AWAY`);
      }
      if (rand(st) < A.rate(st) * dt) arrive(st);
      move(st, dt);
    }

    function endDay(st) {
      const d = st.today, day = Math.floor(st.t / K.DAY);
      d.rent = K.RENT;
      st.wallet = cents(st.wallet - K.RENT);
      const profit = A.profit(d);
      st.history.push(Object.assign({ day, profit, temp: st.temp, sky: st.sky }, d));
      if (st.history.length > 60) st.history.shift();
      log(st, 'day', `DAY ${day} CLOSED: PROFIT ${VT.money(profit)}`);
      rate(st, (3 - st.rating) * 0.08);
      st.temp = Math.round(clamp(st.temp + gauss(st) * 3.5 + (22 - st.temp) * 0.25, 6, 36));
      const r = rand(st);
      st.sky = st.temp >= 26 ? 'sun' : r < 0.3 ? 'rain' : r < 0.65 ? 'cloud' : 'sun';
      st.today = blankDay();
      if (K.STUCK) st.wear++;
      if (st.hype) st.hype = st.hype < 0.1 ? 0 : Math.round(st.hype * 0.6 * 100) / 100;
      if (PERISH) {
        const n = st.slots.reduce((a, s) => a + A.staleCount(st, s), 0);
        if (n) log(st, 'warn', `${n} ${K.ITEMS} PAST THEIR DATE: BIN THEM`);
      }
    }

    function arrive(st) {
      let r = rand(st) * POP, fav = 0;
      while (fav < P.length - 1 && (r -= P[fav].pop) > 0) fav++;
      const c = {
        id: st.nextId++, look: (rand(st) * 2147483647) | 0, x: S.ENTER, phase: 'walk', timer: 0, bubble: null, bubbleT: 0, fav,
        wtp: cents(P[fav].ref * Math.exp(gauss(st) * 0.22) * (1 + Math.max(0, st.temp - 24) * (K.WTP_HEAT || 0))
          * (1 + Math.max(0, 16 - st.temp) * (K.WTP_COLD || 0))),
      };
      if (K.KIDS) c.kid = rand(st) < K.KIDS;
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
          if ((c.timer -= dt) <= 0) {
            // a brewed drink is ready: take it and say how it is
            if (c.tnt) explode(st, c);
            else if (c.brewing) {
              c.brewing = false; c.phase = 'leave'; c.bubble = c.after; c.bubbleT = 36;
              if (c.odd) { const w = c.odd; c.odd = null; st.lastSale = { n: ++st.sales, slot: c.slot, p: c.cup, weird: w }; oddity(st, c, w); }
            } else decide(st, c);
          }
          return;
        }
        const target = S.FRONT - i * S.GAP;
        if (c.x < target) { c.x = Math.min(target, c.x + S.WALK * dt); c.phase = 'walk'; }
        if (c.x >= target) {
          if (i === 0) { c.phase = 'use'; c.timer = S.USE; } else c.phase = 'queue';
        }
      });
      for (const c of st.customers) {
        if (c.phase === 'leave') c.x += S.WALK * (c.flee ? 3.2 : 1.3) * dt;
        if (c.bubbleT > 0 && (c.bubbleT -= dt) <= 0) c.bubble = null;
      }
      st.customers = st.customers.filter(c => c.x < S.EXIT);
    }

    function decide(st, c) {
      c.phase = 'leave'; c.bubbleT = 36;
      if (A.down(st)) return lose(st, c, 'broken');
      if (LOTTO) return turn(st, c);
      const open = st.slots.map((s, i) => ({ s, i })).filter(o => (BREW ? A.canMake(st, o.i) : o.s.stock) > 0);
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
      if (BREW) return brew(st, i, c, fav);
      const s = st.slots[i], p = P[s.p], d = st.today, where = A.slotName(i);
      const stale = isStale(st, s), bonus = s.hang;
      take(s);
      st.cashbox = cents(st.cashbox + s.price);
      d.sold++; d.revenue = cents(d.revenue + s.price); d.cogs = cents(d.cogs + p.cost);
      if (K.STUCK && !bonus && rand(st) < A.stuckChance(st)) {
        // it hangs in the coil: paid for, never delivered
        s.hang = true; d.stuck++;
        c.bubble = 'stuck'; rate(st, -0.04);
        log(st, 'lost', `STUCK! A ${p.name} HANGS IN ${where}`);
      } else {
        s.hang = false;
        st.lastSale = { n: ++st.sales, slot: i, p: s.p, two: bonus };
        const w = roll(st);
        if (w) { st.lastSale.weird = w; oddity(st, c, w, p.name); }
        else if (stale) {
          d.stale++; c.bubble = 'yuck'; rate(st, -0.05);
          log(st, 'lost', `SOLD A STALE ${p.name}. YUCK!`);
        } else if (bonus) {
          c.bubble = 'lucky'; rate(st, 0.02);
          log(st, 'sale', `TWO FOR ONE: THE STUCK ${p.name} DROPPED TOO`);
        } else {
          c.bubble = fav ? 'love' : 'ok'; rate(st, fav ? 0.006 : 0.002);
          log(st, 'sale', `SOLD ${p.name} AT ${where} FOR ${VT.money(s.price)}`);
        }
      }
      if (A.full(st)) log(st, 'warn', 'COIN BOX FULL! COLLECT THE CASH');
      if (!s.stock) log(st, 'warn', `${where} IS SOLD OUT`);
    }

    // Brewing a drink: paid for now, handed over when it is ready.
    function brew(st, i, c, fav) {
      const s = st.slots[i], p = P[s.p], d = st.today;
      const sour = Object.keys(p.use).filter(k => A.sour(st, k));
      for (const k in p.use) st.sup[k] -= p.use[k];
      st.grounds += p.use.beans || 0;
      st.cashbox = cents(st.cashbox + s.price);
      d.sold++; d.revenue = cents(d.revenue + s.price); d.cogs = cents(d.cogs + p.cost);
      st.lastSale = { n: ++st.sales, slot: i, p: s.p };
      c.phase = 'use'; c.brewing = true; c.timer = p.brew; c.bubble = null; c.cup = s.p; c.slot = i;
      c.odd = roll(st);
      if (c.odd) { /* what comes out is shown when the brew is done */ }
      else if (sour.length) {
        d.stale++; c.after = 'yuck'; rate(st, -0.05);
        log(st, 'lost', `SERVED A ${p.name} WITH SOUR ${K.SUPPLY[sour[0]].name}. YUCK!`);
      } else {
        c.after = fav ? 'love' : 'ok'; rate(st, fav ? 0.006 : 0.002);
        log(st, 'sale', `SOLD A ${p.name} FOR ${VT.money(s.price)}`);
      }
      if (A.full(st)) log(st, 'warn', 'COIN BOX FULL! COLLECT THE CASH');
      if (A.groundsFull(st)) log(st, 'warn', 'GROUNDS BIN FULL! EMPTY IT');
      for (const k in p.use) if (st.sup[k] === 0) log(st, 'warn', `OUT OF ${K.SUPPLY[k].name}`);
    }

    // ---- oddities and TNT ----
    // TNT only when the owner could pay for a new machine, and not again
    // within a few days of the last bang: bad luck should not end the game
    const tntOk = st => st.wallet >= K.MACHINE && (!st.lastBoom || st.t - st.lastBoom > 3 * K.DAY);
    const roll = st => {
      if (rand(st) >= WEIRD) return null;
      const tnt = rand(st) < TNT, odd = ODD[Math.floor(rand(st) * ODD.length)];
      return tnt && tntOk(st) ? 'tnt' : odd;
    };
    // what the customer does with it: puzzled, or holding a lit fuse
    function oddity(st, c, w, wanted) {
      const what = wanted || P[c.cup] && P[c.cup].name || K.ITEMS;
      c.held = w;
      if (w === 'tnt') {
        c.tnt = true; c.phase = 'use'; c.timer = FUSE; c.bubble = 'broken'; c.bubbleT = FUSE;
        log(st, 'warn', `UH-OH. ${VT.ODDITIES.tnt} CAME OUT INSTEAD OF THE ${what}`);
        return;
      }
      st.today.weird++;
      c.phase = 'leave'; c.bubble = 'what'; c.bubbleT = 36; rate(st, -0.004);
      log(st, 'day', `WHAT? ${VT.ODDITIES[w]} CAME OUT INSTEAD OF THE ${what}`);
    }
    // the TNT goes off: the machine, its stock and the coin box are gone
    function explode(st, c) {
      const d = st.today, lost = cents(A.stockValue(st) + st.cashbox);
      d.wreck = cents(d.wreck + lost);
      for (const s of st.slots) { s.stock = 0; s.hang = false; if (s.exp) s.exp = []; }
      if (BREW) { for (const k of SUP) st.sup[k] = 0; st.grounds = 0; }
      st.cashbox = 0; st.jam = false; st.wear = 0; st.hype = 0;
      st.wreck = { n: ++st.booms, t: st.t }; st.order = null; st.lastBoom = st.t;
      rate(st, -0.4);
      c.tnt = false; c.held = null; c.charred = true;
      for (const o of st.customers) {
        o.phase = 'leave'; o.flee = true; o.brewing = false; o.bubble = o === c ? 'boom' : 'broken'; o.bubbleT = 30;
        if (Math.abs(o.x - c.x) < 20) o.charred = true;
      }
      log(st, 'lost', `KABOOM! THE TNT WENT OFF AND THE MACHINE EXPLODED (${VT.money(lost)} OF STOCK AND CASH LOST)`);
    }
    // a new machine: ordered from the wreck, it arrives empty
    A.orderMachine = function (st) {
      if (!st.wreck || st.order) return false;
      st.wallet = cents(st.wallet - K.MACHINE);
      st.today.wreck = cents(st.today.wreck + K.MACHINE);
      st.order = { at: st.t + K.DELIVERY };
      log(st, 'info', `ORDERED A NEW MACHINE FOR ${VT.money(K.MACHINE)}. IT ARRIVES FILLED IN ${Math.round(K.DELIVERY / 60 * 10) / 10} HOURS`);
      return true;
    };
    function deliver(st) {
      st.wreck = null; st.order = null; st.arrivals = (st.arrivals || 0) + 1;
      // the factory fill was part of the price: it is stock now, not a cost
      const before = A.stockValue(st);
      fill(st, false);
      st.today.wreck = cents(st.today.wreck - (A.stockValue(st) - before));
      log(st, 'day', 'YOUR NEW MACHINE HAS ARRIVED, FILLED AND READY TO SELL!');
    }

    // A turn of the gumball crank: pay, get whatever ball comes out.
    function turn(st, c) {
      const d = st.today, total = A.total(st), price = st.slots[0].price, fav = P[c.fav].name;
      const spins = c.spins || 0;
      if (!total) return lose(st, c, 'soldout');
      const favLeft = st.slots.some(s => s.p === c.fav && s.stock > 0);
      if (!spins && !favLeft && rand(st) < 0.5) return lose(st, c, 'soldout');
      // each extra go is a harder sell
      if (price > c.wtp * Math.pow(0.8, spins) + 1e-9) {
        if (spins) { c.bubble = 'meh'; return; }
        return lose(st, c, 'price');
      }
      let r = rand(st) * total, i = 0;
      while (i < st.slots.length - 1 && (r -= st.slots[i].stock) >= 0) i++;
      const s = st.slots[i], p = P[s.p];
      take(s);
      st.cashbox = cents(st.cashbox + price);
      d.sold++; d.revenue = cents(d.revenue + price); d.cogs = cents(d.cogs + p.cost);
      c.spins = spins + 1;
      st.lastSale = { n: ++st.sales, slot: i, p: s.p };
      const w = roll(st);
      if (w) { st.lastSale.weird = w; oddity(st, c, w, 'GUMBALL'); }
      else if (p.prize) {
        d.prizes++; c.bubble = 'prize'; rate(st, 0.08);
        st.hype = Math.min(4, (st.hype || 0) + 1);
        log(st, 'day', `JACKPOT! A KID WON THE ${p.name}`);
      } else if (s.p === c.fav) {
        c.bubble = 'love'; rate(st, 0.01);
        log(st, 'sale', `GOT ${fav}, THEIR FAVOURITE`);
      } else if (c.spins < 3 && rand(st) < 0.5) {
        // not the one they wanted: one more go
        d.repeats++; c.phase = 'use'; c.timer = S.USE * 0.7; c.bubble = 'again'; c.bubbleT = 4;
        log(st, 'sale', `GOT ${p.name}, WANTED ${fav}: ONE MORE GO`);
      } else {
        c.bubble = 'meh'; rate(st, -0.001);
        log(st, 'sale', `GOT ${p.name}, WANTED ${fav}`);
      }
      if (A.full(st)) log(st, 'warn', 'COIN BOX FULL! COLLECT THE CASH');
      if (!s.stock) log(st, 'warn', `NO ${p.name} LEFT IN THE GLOBE`);
      if (!A.total(st)) log(st, 'warn', 'THE GLOBE IS EMPTY');
    }

    function lose(st, c, why) {
      const d = st.today, name = P[c.fav].name;
      c.bubble = why;
      if (why === 'broken') {
        d.lostBroken++; rate(st, st.wreck ? -0.005 : -0.03);
        log(st, 'lost', st.wreck ? 'NO SALE: THE MACHINE IS A SMOKING WRECK' : st.jam ? (K.JAM_LOST || 'NO SALE: THE MACHINE IS JAMMED')
          : A.full(st) ? 'NO SALE: THE COIN BOX IS FULL' : 'NO SALE: THE GROUNDS BIN IS FULL');
      } else if (why === 'price') {
        d.lostPrice++; rate(st, -0.01);
        log(st, 'lost', `NO SALE: ${name} WAS TOO PRICEY`);
      } else {
        d.lostOut++; rate(st, -0.03);
        log(st, 'lost', `NO SALE: WANTED ${name}, NONE LEFT`);
      }
    }

    // ---- what the player can do ----

    // (a gumball machine has one price for every turn)
    A.setPrice = function (st, i, price) {
      const v = cents(clamp(Math.round(price / K.PRICE_STEP) * K.PRICE_STEP, K.PRICE_MIN, K.PRICE_MAX));
      if (LOTTO) for (const s of st.slots) s.price = v; else st.slots[i].price = v;
    };

    // Bins a slot's stale items; their cost is written off as waste.
    function bin(st, i) {
      const s = st.slots[i], n = A.staleCount(st, s);
      if (!n) return { n: 0, cost: 0 };
      s.exp.splice(0, n); s.stock -= n;
      const cost = cents(n * P[s.p].cost);
      st.today.waste = cents(st.today.waste + cost);
      return { n, cost };
    }
    A.binStale = function (st, i) {
      const r = bin(st, i);
      if (r.n) log(st, 'info', `BINNED ${r.n} STALE ${P[st.slots[i].p].name} (${VT.money(r.cost)} WASTED)`);
      return r.n;
    };
    A.binAllStale = function (st) {
      let n = 0, cost = 0;
      for (let i = 0; i < N; i++) { const r = bin(st, i); n += r.n; cost += r.cost; }
      if (n) log(st, 'info', `BINNED ${n} STALE ${K.ITEMS} (${VT.money(cost)} WASTED)`);
      return n;
    };
    A.staleTotal = st => st.slots.reduce((a, s) => a + A.staleCount(st, s), 0);

    // Swapping a slot's product sends its fresh items back to the supplier
    // at cost; stale ones are binned.
    A.setProduct = function (st, i, p) {
      const s = st.slots[i];
      if (s.p === p) return;
      bin(st, i);
      const refund = cents(s.stock * P[s.p].cost);
      st.wallet = cents(st.wallet + refund);
      if (s.stock) log(st, 'info', `${A.slotName(i)}: RETURNED ${s.stock} ${P[s.p].name} FOR ${VT.money(refund)}`);
      s.p = p; s.stock = 0; s.hang = false;
      if (s.exp) s.exp = [];
      s.price = P[p].start || s.price;
      log(st, 'info', `${A.slotName(i)} NOW SELLS ${P[p].name}`);
    };

    // how many one restock adds: a slot fills up; a gumball flavour comes in
    // bags of BATCH, as far as there is room in the globe
    const want = (st, i) => (LOTTO ? Math.min(K.BATCH, space(st)) : K.CAP - st.slots[i].stock);
    A.restockCost = (st, i) => (BREW ? cents(Object.keys(P[st.slots[i].p].use).reduce((a, k) => a + A.refillCost(st, k), 0))
      : cents(want(st, i) * P[st.slots[i].p].cost));
    A.restockAllCost = st => (LOTTO ? cents(fillPlan(st).reduce((a, n, i) => a + n * P[st.slots[i].p].cost, 0))
      : BREW ? cents(SUP.reduce((a, k) => a + A.refillCost(st, k), 0))
        : cents(st.slots.reduce((a, s, i) => a + A.restockCost(st, i), 0)));
    // topping up a globe: share the room evenly among the flavours (not prizes)
    function fillPlan(st) {
      const plan = st.slots.map(() => 0), open = st.slots.map((s, i) => i).filter(i => !P[st.slots[i].p].prize);
      for (let room = space(st), k = 0; room > 0 && open.length; room--, k++) plan[open[k % open.length]]++;
      return plan;
    }
    // buys as many items as the wallet allows
    function restock(st, i, upto) {
      const s = st.slots[i], cost = P[s.p].cost;
      if (st.wreck) return { n: 0, cost: 0 };
      const n = Math.min(upto === undefined ? want(st, i) : upto, Math.max(0, Math.floor((st.wallet + 1e-9) / cost)));
      add(st, s, n);
      st.wallet = cents(st.wallet - n * cost);
      return { n, cost: cents(n * cost) };
    }
    // ---- supplies (coffee) ----
    // filling up: what has gone sour is poured away first
    A.refillCost = (st, k) => cents((K.SUPPLY[k].cap - (A.sour(st, k) ? 0 : st.sup[k])) * K.SUPPLY[k].cost);
    function drain(st, k) {
      const n = st.sup[k], cost = cents(n * K.SUPPLY[k].cost);
      st.sup[k] = 0;
      st.today.waste = cents(st.today.waste + cost);
      return { n, cost };
    }
    A.drain = function (st, k) {
      if (!st.sup[k]) return 0;
      const r = drain(st, k), S = K.SUPPLY[k];
      log(st, 'info', `POURED AWAY ${r.n} ${S.unit} OF ${S.name} (${VT.money(r.cost)} WASTED)`);
      return r.n;
    };
    function refill(st, k) {
      const S = K.SUPPLY[k];
      if (st.wreck) return { n: 0, cost: 0 };
      if (A.sour(st, k)) A.drain(st, k);
      const n = Math.min(S.cap - st.sup[k], Math.max(0, Math.floor((st.wallet + 1e-9) / S.cost)));
      if (n <= 0) return { n: 0, cost: 0 };
      // fresh into an empty tank starts a new date; topping up keeps the old one
      if (S.life && !st.sup[k]) st.supExp[k] = st.t + S.life * K.DAY;
      st.sup[k] += n;
      st.wallet = cents(st.wallet - n * S.cost);
      return { n, cost: cents(n * S.cost) };
    }
    A.refill = function (st, k) {
      const r = refill(st, k), S = K.SUPPLY[k];
      if (r.n) log(st, 'info', `REFILLED ${S.name}: ${r.n} ${S.unit} FOR ${VT.money(r.cost)}`);
      return r.n;
    };
    function refillMany(st, keys) {
      let n = 0, cost = 0;
      for (const k of keys) { const r = refill(st, k); n += r.n; cost += r.cost; }
      if (n) log(st, 'info', `REFILLED ${keys.length === SUP.length ? 'EVERYTHING' : keys.map(k => K.SUPPLY[k].name).join(' AND ')} FOR ${VT.money(cents(cost))}`);
      return n;
    }
    A.clean = function (st) {
      if (!st.grounds) return false;
      log(st, 'info', `EMPTIED THE GROUNDS BIN (${st.grounds} PUCKS)`);
      st.grounds = 0;
      return true;
    };

    A.restock = function (st, i) {
      if (BREW) return refillMany(st, Object.keys(P[st.slots[i].p].use));
      const r = restock(st, i);
      if (r.n) log(st, 'info', LOTTO ? `ADDED ${r.n} ${P[st.slots[i].p].name} BALLS FOR ${VT.money(r.cost)}`
        : `RESTOCKED ${A.slotName(i)}: ${r.n} ${K.ITEMS} FOR ${VT.money(r.cost)}`);
      return r.n;
    };
    A.restockAll = function (st) {
      if (BREW) return refillMany(st, SUP);
      let n = 0, cost = 0;
      const plan = LOTTO ? fillPlan(st) : null;
      for (let i = 0; i < N; i++) { const r = restock(st, i, plan ? plan[i] : undefined); n += r.n; cost += r.cost; }
      if (n) log(st, 'info', `${LOTTO ? 'TOPPED UP THE GLOBE WITH' : 'RESTOCKED'} ${n} ${K.ITEMS} FOR ${VT.money(cost)}`);
      return n;
    };

    A.collect = function (st) {
      const v = st.cashbox;
      if (!v) return 0;
      st.wallet = cents(st.wallet + v); st.cashbox = 0;
      log(st, 'info', `COLLECTED ${VT.money(v)} FROM THE COIN BOX`);
      return v;
    };

    A.repair = function (st) {
      if (!st.jam) return false;
      st.jam = false;
      st.wallet = cents(st.wallet - K.REPAIR);
      st.today.repairs = cents(st.today.repairs + K.REPAIR);
      log(st, 'info', `MACHINE REPAIRED FOR ${VT.money(K.REPAIR)}`);
      return true;
    };

    // a service: worn coils back to new, anything hanging in them cleared out
    A.service = function (st) {
      if (!K.STUCK) return false;
      st.wear = 0;
      for (const s of st.slots) s.hang = false;
      st.wallet = cents(st.wallet - K.STUCK.service);
      st.today.repairs = cents(st.today.repairs + K.STUCK.service);
      log(st, 'info', `COILS SERVICED FOR ${VT.money(K.STUCK.service)}`);
      return true;
    };

    return A;
  };
})(typeof window !== 'undefined' ? window.VT : globalThis.VT);
