/* A machine's game screen: runs the simulation in real time, draws the
 * street, the machine and its customers, and wires up the panels and the
 * keyboard. Every machine page calls VT.vendGame with its config and art:
 *
 *   VT.vendGame({ K: VT.SODA, draw: VT.drawSoda, icon: (fb, product) => … })
 *
 * Panels for extras (stale snacks, coil wear, the gumball globe, coffee
 * supplies) are wired
 * only when the page has their elements. The game saves itself in this browser every few
 * seconds, under the machine's own key. */
(function (VT) {
  'use strict';

  VT.vendGame = function ({ K, draw, icon, drawHD, iconHD }) {
    const A = VT.vend(K), S = K.STAGE, PR = K.PRODUCTS, ART = K.ART;
    const $ = id => document.getElementById(id);
    // HD: smooth vector drawing at full resolution (js/hd.js); colours as hex
    const HD = !!(VT.hd && drawHD);
    const col = h => (HD ? h : VT.rgb(h));
    const PC = PR.map(p => col(p.color)), LIQ = PR.map(p => p.liquid && col(p.liquid));
    const SUP = K.SUPPLY ? Object.keys(K.SUPPLY) : [];
    // on a gumball or coffee machine the arrows step through the slots
    const PICK = !!(K.LOTTERY || K.SUPPLY);

    const root = document.documentElement;
    const setPx = () => root.style.setProperty('--px', VT.scale() + 'px');
    setPx(); addEventListener('resize', setPx);

    // ---- state and saving ----
    const fresh = () => A.create((Math.random() * 4294967296) >>> 0);
    function load() {
      try {
        const s = JSON.parse(localStorage.getItem(K.SAVE));
        return s && s.v === 1 && Array.isArray(s.slots) && s.slots.length === K.ROWS * K.COLS ? A.upgrade(s) : null;
      } catch (e) { return null; }
    }
    function save() { try { localStorage.setItem(K.SAVE, JSON.stringify(st)); } catch (e) { /* private mode: play unsaved */ } }
    let st = load() || fresh();
    let speed = 1, sel = 0;
    addEventListener('pagehide', save);
    setInterval(save, 4000);

    // ---- the street: backdrop, machine and customers ----
    const bg = $('bg');
    const scene = (HD ? VT.sceneHD : VT.scene)(bg, { horizon: 0.72 });
    const stage = $('stage'), fb = HD ? null : new VT.FB(stage), so = HD ? VT.hdCanvas(stage, S.W, S.H) : null;
    if (fb) fb.resize(S.W, S.H);
    const mfb = new VT.FB(document.createElement('canvas'));
    mfb.resize(64, 88);
    function fitStage() {
      const wrap = stage.parentElement, fit = Math.min(wrap.clientWidth / S.W, (innerHeight * 0.62) / S.H);
      if (HD) { so.fit(Math.max(1.5, Math.min(6, fit))); return; }
      const k = Math.max(2, Math.min(6, Math.floor(fit)));
      stage.style.width = S.W * k + 'px'; stage.style.height = S.H * k + 'px';
    }
    fitStage(); addEventListener('resize', fitStage);
    if (HD) addEventListener('resize', () => requestAnimationFrame(() => refresh(true)));

    const PAVE = VT.rgb('#1c0838'), PAVE_LO = VT.rgb('#12042a'), PAVE_EDGE = VT.rgb('#ff71ce'), JOINT = VT.rgb('#0d0221');
    function pavement() {
      const top = S.H - 16;
      for (let y = top; y < S.H; y++) for (let x = 0; x < S.W; x++) {
        const c = y === top ? PAVE_EDGE : (x + (y - top) * 3) % 24 === 0 ? JOINT : VT.bayer(x, y) < (y - top) / 16 ? PAVE_LO : PAVE;
        fb.px(x, y, y === top && VT.bayer(x, y) > 0.6 ? PAVE : c);
      }
    }

    let lastSale = st.lastSale ? st.lastSale.n : 0, drop = null, odd = null;
    function view(t) {
      if (st.lastSale && st.lastSale.n !== lastSale) {
        lastSale = st.lastSale.n;
        // an oddity comes out instead of the product: the machine drops nothing of its own
        if (st.lastSale.weird) { drop = null; odd = { at: t, kind: st.lastSale.weird }; }
        else drop = { at: t, color: PC[st.lastSale.p], shape: PR[st.lastSale.p].shape, two: st.lastSale.two };
      }
      const sign = st.jam ? (K.JAM_SIGN || 'JAM!') : A.full(st) ? 'FULL' : A.groundsFull(st) ? 'BIN!' : null;
      if (K.SUPPLY) {
        const c = st.customers.find(o => o.brewing);
        return {
          slots: st.slots.map((s, i) => ({ color: PC[s.p], liquid: LIQ[s.p], can: A.canMake(st, i) > 0 })),
          sel, sign, price: st.slots[sel].price,
          brew: c ? { liquid: LIQ[c.cup], color: PC[c.cup], k: Math.min(1, (1 - c.timer / PR[c.cup].brew) * 1.15) } : null,
          sup: SUP.map(k => ({ k: st.sup[k] / K.SUPPLY[k].cap, sour: A.sour(st, k) })),
          grounds: st.grounds / K.GROUNDS,
        };
      }
      return {
        slots: st.slots.map(s => ({ color: PC[s.p], shape: PR[s.p].shape, prize: PR[s.p].prize, stock: s.stock, cap: K.CAP, stale: A.staleCount(st, s), hang: s.hang })),
        sel, drop, busy: st.customers.some(c => c.phase === 'use'),
        total: A.total(st), cap: K.GLOBE || K.CAP, price: st.slots[0].price,
        sign,
      };
    }

    // ---- oddities, the explosion, the wreck and the new machine (js/boom.js) ----
    const GEO = { x0: S.MX + K.FOOT[0], x1: S.MX + K.FOOT[1], top: S.MY + 4, base: S.MY + 86, body: K.BODY };
    GEO.cx = (GEO.x0 + GEO.x1) / 2; GEO.cy = S.MY + 52;
    const HATCH = [S.MX + K.HATCH[0], S.MY + K.HATCH[1]];
    let seenBoom = st.wreck ? st.wreck.n : st.booms || 0, seenArr = st.arrivals || 0, boom = null, boomAt = 0, arriveAt = -99, litId = 0;
    const BLAST = 0.1; // seconds into the blast when the machine turns into a wreck
    function effects(t) {
      if (st.wreck && st.wreck.n !== seenBoom) {
        seenBoom = st.wreck.n; boomAt = t;
        boom = VT.makeBoom(GEO, [K.BODY].concat(PR.map(p => p.color)), st.wreck.n + st.seed);
        kaboom();
      }
      if ((st.arrivals || 0) !== seenArr) { seenArr = st.arrivals || 0; arriveAt = t; }
      if (boom && VT.boomDone(boom, t - boomAt)) boom = null;
      // a lit fuse: the game drops to normal speed so you see it coming
      const lit = st.customers.find(c => c.tnt);
      if (lit && lit.id !== litId) { litId = lit.id; if (speed > 1) { speed = 1; refresh(); } }
    }
    function kaboom() {
      const wrap = stage.parentElement;
      if (!VT.reduced) { wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake'); }
      const el = $('toast');
      el.innerHTML = `<b class="boom">KABOOM!</b><span>THE MACHINE BLEW UP</span><span class="neg">LOST ${VT.money(st.today.wreck)} IN STOCK AND CASH</span><small>ORDER A NEW MACHINE TO KEEP SELLING</small>`;
      // let the blast play before the news covers it
      el.classList.remove('show'); clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { el.classList.add('show'); toastTimer = setTimeout(() => el.classList.remove('show'), 5000); }, 1300);
      save();
    }
    const showMachine = t => !st.wreck || (boom && t - boomAt < BLAST);
    const machineDY = t => Math.round(VT.arriveDY(t - arriveAt));
    // what a customer holds: up at the machine for the lit TNT, by their side when leaving
    const hand = (c, t) => {
      if (!c.held || (odd && odd.kind === c.held && t - odd.at < 0.45)) return null;
      const foot = c.phase === 'leave' ? S.H - 3 : S.H - 9;
      return c.phase === 'use' ? [c.x + 9, foot - (c.kid ? 15 : 21)] : [c.x + 0.5, foot - (c.kid ? 9 : 12)];
    };
    const hatchOdd = t => odd && t - odd.at < 0.45 + (odd.kind === 'tnt' ? 0 : 0.3);

    function pavementHD(c) {
      const top = S.H - 16, H = VT.HD;
      c.fillStyle = H.lin(c, 0, top, 0, S.H, [[0, '#24104a'], [0.5, '#1c0838'], [1, '#0e0322']]); c.fillRect(0, top, S.W, 16);
      c.strokeStyle = 'rgba(13,2,33,.8)'; c.lineWidth = 0.35;
      for (let x = -16; x < S.W; x += 8) { c.beginPath(); c.moveTo(x, top); c.lineTo(x + 5.3, S.H); c.stroke(); }
      c.save(); H.glow(c, '#ff71ce', 3); c.fillStyle = '#ff71ce'; c.fillRect(0, top - 0.3, S.W, 0.7); c.restore();
      c.fillStyle = 'rgba(255,113,206,.08)'; c.fillRect(0, top, S.W, 3);
    }
    function drawStageHD(t) {
      const c = so.begin(), H = VT.HD;
      pavementHD(c);
      const v = view(t);
      if (showMachine(t)) { c.save(); c.translate(S.MX, S.MY + VT.arriveDY(t - arriveAt)); drawHD(c, t, v); c.restore(); }
      else VT.drawWreckHD(c, GEO, t, st.wreck.n);
      VT.drawDustHD(c, GEO, t - arriveAt);
      if (hatchOdd(t)) VT.HD.oddity(c, HATCH[0], HATCH[1], odd.kind, t);
      const order = st.customers.slice().sort((a, b) => (a.phase === 'leave') - (b.phase === 'leave'));
      for (const p of order) {
        const foot = p.phase === 'leave' ? S.H - 3 : S.H - 9, moving = p.phase === 'walk' || p.phase === 'leave';
        c.save(); c.globalAlpha = 0.5; c.fillStyle = '#05000d'; c.beginPath(); c.ellipse(p.x + 0.5, foot + 0.3, 5, 1.1, 0, 0, 7); c.fill(); c.restore();
        if (p.charred) c.filter = 'brightness(0.3) saturate(0.5)';
        H.person(c, p.x, foot, p.look, moving ? p.x / 3 : null, p.phase === 'use', p.kid);
        if (p.charred) {
          c.filter = 'none';
          const hy = foot - 1 - (p.kid ? 6 : 9.5) - (p.kid ? 9 : 12) - 5.4;
          c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x + 2.9, hy - 0.4, 0.75, 0, 7); c.fill();
          H.singed(c, p.x, hy - 5, t);
        }
        const held = hand(p, t);
        if (held) H.oddity(c, held[0], held[1], p.held, t);
        const by = foot - VT.bubbleHeight(p.kid);
        if (p.bubble) H.bubble(c, p.x + 1, by, p.bubble, t);
        else if (p.phase === 'use') H.bubble(c, p.x + 1, by, 'think', t);
      }
      if (boom) VT.drawBoomHD(c, boom, t - boomAt, S.W, S.H);
    }

    function drawStage(t) {
      if (HD) return drawStageHD(t);
      fb.clear();
      pavement();
      const v = view(t);
      if (showMachine(t)) { draw(mfb, t, v); fb.blit(mfb, S.MX, S.MY + machineDY(t)); }
      else VT.drawWreck(fb, GEO, t, st.wreck.n);
      VT.drawDust(fb, GEO, t - arriveAt);
      if (hatchOdd(t)) VT.drawOddity(fb, HATCH[0], HATCH[1], odd.kind, t);
      // the queue stands at the back, people leaving walk past in front
      const order = st.customers.slice().sort((a, b) => (a.phase === 'leave') - (b.phase === 'leave'));
      for (const c of order) {
        const x = Math.round(c.x), foot = c.phase === 'leave' ? S.H - 3 : S.H - 9;
        const moving = c.phase === 'walk' || c.phase === 'leave';
        VT.drawPerson(fb, x, foot, c.look, moving ? Math.floor(c.x / 3) & 3 : 0, c.phase === 'use', c.kid, c.charred);
        if (c.charred) VT.drawSinged(fb, x, foot - (c.kid ? 31 : 37), t);
        const held = hand(c, t);
        if (held) VT.drawOddity(fb, held[0], held[1], c.held, t);
        const by = foot - VT.bubbleHeight(c.kid);
        if (c.bubble) VT.drawBubble(fb, x + 1, by, c.bubble, t);
        else if (c.phase === 'use') VT.drawBubble(fb, x + 1, by, 'think', t);
      }
      if (boom) VT.drawBoom(fb, boom, t - boomAt, S.W, S.H);
      fb.flush();
    }

    // clicking an item on the machine selects its slot (a globe has none to click)
    function slotAt(e) {
      if (!ART) return -1;
      const r = stage.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * S.W) - S.MX - ART.x;
      const y = Math.floor(((e.clientY - r.top) / r.height) * S.H) - S.MY - ART.y + 1;
      const c = Math.floor(x / ART.dx), row = Math.floor(y / ART.dy);
      return c >= 0 && c < K.COLS && row >= 0 && row < K.ROWS ? row * K.COLS + c : -1;
    }
    stage.addEventListener('click', e => { const i = slotAt(e); if (i >= 0) { sel = i; refresh(true); } });
    stage.addEventListener('mousemove', e => { stage.style.cursor = slotAt(e) >= 0 ? 'pointer' : ''; });

    // ---- small pixel widgets ----
    const widget = (id, w, h, k) => (HD ? VT.hdCanvas($(id), w, h, k) : VT.pixelCanvas($(id), w, h, k));
    const wx = widget('wx', 9, 9, 3);
    const stars = widget('stars', 39, 7, 3);
    const slotIcon = widget('slotIcon', 9, 10, 3);
    const chart = widget('chart', 74, 44, () => Math.max(3, VT.scale()));
    const DIM_STAR = { y: VT.PAL.d };
    function drawStarsHD(r) {
      const c = stars.begin();
      for (let i = 0; i < 5; i++) {
        c.save(); c.globalAlpha = 0.35; VT.HD.icon(c, 'star', i * 8, 0, 7); c.restore();
        const fill = Math.max(0, Math.min(1, r - i));
        if (fill > 0) { c.save(); c.beginPath(); c.rect(i * 8, 0, fill * 7, 7); c.clip(); VT.HD.icon(c, 'prize', i * 8, 0, 7); c.restore(); }
      }
    }
    function drawChartHD() {
      const days = st.history.slice(-7), c = chart.begin(), base = 34, top = 3, H = VT.HD;
      const max = Math.max(5, ...days.map(d => Math.max(d.revenue, Math.abs(d.profit))));
      const zero = days.some(d => d.profit < 0) ? Math.round(base - (base - top) * 0.75) : base;
      const sc = (zero - top) / max;
      c.strokeStyle = 'rgba(180,154,214,.18)'; c.lineWidth = 0.25;
      for (let k = 1; k <= 3; k++) { const y = zero - (zero - top) * k / 3; c.beginPath(); c.moveTo(0, y); c.lineTo(74, y); c.stroke(); }
      c.fillStyle = '#3b1a63'; c.fillRect(0, zero - 0.2, 74, 0.5);
      days.forEach((d, i) => {
        const x = 2 + i * 10, hr = Math.max(0.6, d.revenue * sc), hp = Math.abs(d.profit) * sc;
        c.fillStyle = H.lin(c, 0, zero - hr, 0, zero, [[0, '#7ae6ff'], [1, '#01a0d0']]); H.rr(c, x, zero - hr, 3.6, hr, 0.8); c.fill();
        if (d.profit >= 0) { c.fillStyle = H.lin(c, 0, zero - hp, 0, zero, [[0, '#8affcf'], [1, '#05c080']]); H.rr(c, x + 4, zero - hp, 3.6, hp, 0.8); c.fill(); }
        else { c.fillStyle = '#ff2a6d'; H.rr(c, x + 4, zero + 0.3, 3.6, Math.min(hp, base - zero), 0.8); c.fill(); }
        c.fillStyle = '#9a95c8'; c.font = H.font(3.6, 600, 'Rajdhani'); c.textAlign = 'center'; c.fillText(String(d.day % 100), x + 3.8, 41.5);
      });
      if (!days.length) { c.fillStyle = '#3b1a63'; c.font = H.font(4, 600, 'Rajdhani'); c.textAlign = 'center'; c.fillText('NO DAYS YET', 37, 22); }
    }
    function drawStars(r) {
      if (HD) return drawStarsHD(r);
      stars.clear();
      for (let i = 0; i < 5; i++) {
        VT.icon(stars, 'star', i * 8, 0, DIM_STAR);
        const fill = Math.max(0, Math.min(1, r - i));
        if (fill > 0) {
          const tmp = { w: 7, h: 7, d: new Uint32Array(49), px(x, y, c) { if (x < Math.round(fill * 7)) this.d[y * 7 + x] = c; } };
          VT.icon(tmp, 'star', 0, 0);
          stars.blit(tmp, i * 8, 0);
        }
      }
      stars.flush();
    }
    function drawChart() {
      if (HD) return drawChartHD();
      const days = st.history.slice(-7), C = chart, base = 34, top = 3;
      C.clear();
      const max = Math.max(5, ...days.map(d => Math.max(d.revenue, Math.abs(d.profit))));
      const zero = days.some(d => d.profit < 0) ? Math.round(base - (base - top) * 0.75) : base;
      const sc = (zero - top) / max;
      for (let x = 0; x < 74; x++) C.px(x, zero, VT.PAL.d);
      days.forEach((d, i) => {
        const x = 2 + i * 10, hr = Math.max(1, Math.round(d.revenue * sc)), hp = Math.round(Math.abs(d.profit) * sc);
        C.rect(x, zero - hr, 4, hr, VT.PAL.c);
        if (d.profit >= 0) C.rect(x + 4, zero - hp, 4, hp, VT.PAL.g);
        else C.rect(x + 4, zero + 1, 4, Math.min(hp, base - zero), VT.PAL.r);
        VT.tiny(C, d.day % 100, x + (d.day % 100 > 9 ? 0 : 2), 38, VT.PAL.s);
      });
      if (!days.length) VT.tiny(C, 0, 35, 18, VT.PAL.d);
      C.flush();
    }

    // ---- panels ----
    const set = (id, v) => { const el = $(id); if (el && el.textContent !== v) el.textContent = v; };
    const moneyTo = (id, v) => { set(id, VT.money(v)); if ($(id)) $(id).classList.toggle('neg', v < -0.004); };
    const prop = (id, k, v) => { const el = $(id); if (el) el[k] = v; };
    let shown = {};
    function refresh(force) {
      if (force) shown = {};
      set('day', 'DAY ' + A.day(st)); set('time', A.clock(st));
      set('temp', st.temp + '°C');
      if (HD) { const c = wx.begin(); VT.HD.icon(c, st.sky, 0, 0, 9, performance.now() / 1000); }
      if (shown.sky !== st.sky) { shown.sky = st.sky; if (!HD) { wx.clear(); VT.icon(wx, st.sky, 0, 0); wx.flush(); } $('wx').parentElement.title = st.sky === 'sun' ? 'Sunny' : st.sky === 'cloud' ? 'Cloudy' : 'Rain'; }
      const r = Math.round(st.rating * 4) / 4;
      if (shown.rating !== r) { shown.rating = r; drawStars(r); $('rating').setAttribute('aria-label', `Rating ${r.toFixed(1)} of 5`); }

      const full = A.full(st);
      const down = A.down(st);
      set('state', st.wreck ? (st.order ? 'ON ITS WAY' : 'WRECKED') : st.jam ? (K.JAM_STATE || 'JAMMED') : full ? 'BOX FULL' : down ? 'BIN FULL' : 'RUNNING');
      $('state').className = 'pill' + (down ? ' alarm' : '');
      moneyTo('wallet', st.wallet); moneyTo('cashbox', st.cashbox);
      $('cashMeter').style.width = Math.min(100, (st.cashbox / K.CASHBOX) * 100) + '%';
      $('cashMeter').classList.toggle('hot', st.cashbox > K.CASHBOX * 0.75);
      $('collect').disabled = !st.cashbox;
      const allCost = A.restockAllCost(st), cheapest = Math.min(...PR.map(p => p.cost));
      set('restockAllCost', allCost ? VT.money(allCost) : '');
      $('restockAll').disabled = !allCost || st.wallet < cheapest;
      prop('repair', 'hidden', !st.jam);
      // coil wear (snacks)
      if (K.STUCK && $('wearMeter')) {
        const ch = A.stuckChance(st);
        set('wear', `${st.wear < 4 ? 'GOOD' : st.wear < 9 ? 'WORN' : 'BAD'} · ${Math.round(ch * 100)}% STICK`);
        $('wearMeter').style.width = (ch / K.STUCK.max) * 100 + '%';
        $('wearMeter').classList.toggle('hot', st.wear >= 7);
        set('serviceCost', VT.money(K.STUCK.service));
        prop('service', 'disabled', !st.wear && !st.slots.some(s => s.hang));
      }
      // the gumball globe and the buzz from prize wins
      if (K.LOTTERY) {
        const total = A.total(st);
        set('globe', total + '/' + K.GLOBE);
        $('globeMeter').style.width = (total / K.GLOBE) * 100 + '%';
        $('globeMeter').classList.toggle('hot', total < K.GLOBE * 0.2);
        set('hype', st.hype > 0.05 ? '+' + Math.round((A.hypeBoost(st) - 1) * 100) + '% CROWD' : 'NONE');
        set('sPrizes', String(st.today.prizes)); set('sRepeats', String(st.today.repeats));
        const turns = st.today.customers - (st.today.lostOut + st.today.lostPrice + st.today.lostQueue + st.today.lostBroken);
        set('sPerKid', turns > 0 ? (st.today.sold / turns).toFixed(1) : '—');
      }
      // coffee: the supplies, the milk's date and the grounds bin
      if (K.SUPPLY) {
        for (const k of SUP) {
          const S = K.SUPPLY[k], n = st.sup[k], sour = A.sour(st, k), cost = A.refillCost(st, k);
          set('sup-' + k, sour ? 'SOUR!' : n + '/' + S.cap);
          $('sup-' + k).classList.toggle('neg', sour || n < S.cap * 0.2);
          set('refillCost-' + k, cost ? VT.money(cost) : '');
          prop('refill-' + k, 'disabled', !cost || st.wallet < S.cost);
          if (S.life) {
            const left = st.supExp[k] - st.t; // minutes
            set('fresh-' + k, !n ? '—' : left <= 0 ? 'SOUR!' : left < 60 ? Math.ceil(left) + ' MIN' : left < 24 * 60 ? Math.floor(left / 60) + 'H' : Math.floor(left / 1440) + 'D ' + Math.floor((left % 1440) / 60) + 'H');
            $('fresh-' + k).classList.toggle('neg', !!n && left < 6 * 60);
            prop('drain', 'disabled', !n);
            prop('drain', 'className', 'btn small' + (sour ? ' warn' : ''));
          }
        }
        set('grounds', st.grounds + '/' + K.GROUNDS);
        $('groundsMeter').style.width = (st.grounds / K.GROUNDS) * 100 + '%';
        $('groundsMeter').classList.toggle('hot', st.grounds >= K.GROUNDS * 0.75);
        prop('clean', 'disabled', !st.grounds);
        prop('clean', 'className', 'btn' + (A.groundsFull(st) ? ' warn' : ''));
      }
      const staleN = A.staleTotal(st);
      set('binAllCount', staleN ? String(staleN) : '');
      prop('binAll', 'disabled', !staleN);
      prop('binAll', 'className', 'btn' + (staleN ? ' warn' : ''));

      const d = st.today, lost = d.lostOut + d.lostPrice + d.lostQueue + d.lostBroken;
      set('sCustomers', String(d.customers)); set('sSold', String(d.sold));
      moneyTo('sRevenue', d.revenue); moneyTo('sProfit', A.profit(d)); set('sLost', String(lost));
      set('sStuck', String(d.stuck)); set('sStale', String(d.stale)); moneyTo('sWaste', d.waste);
      const why = [[d.lostOut, 'SOLD OUT'], [d.lostPrice, 'TOO PRICEY'], [d.lostQueue, 'LONG LINE'], [d.lostBroken, 'MACHINE DOWN']].filter(w => w[0]).map(w => w[0] + ' ' + w[1]);
      set('sWhy', why.join(' · '));

      const s = st.slots[sel], p = PR[s.p];
      set('slotName', A.slotName(sel)); set('productName', p.name);
      if (shown.icon !== s.p) {
        shown.icon = s.p;
        if (HD) { const c = slotIcon.begin(); iconHD(c, s.p); } else { slotIcon.clear(); icon(slotIcon, s.p); slotIcon.flush(); }
      }
      if (K.LOTTERY) {
        // a flavour's share of the globe, which is its chance on each turn
        const total = A.total(st), share = total ? s.stock / total : 0;
        set('stock', s.stock + ' BALLS'); set('share', Math.round(share * 100) + '%');
        $('stockMeter').style.width = share * 100 + '%';
        $('stockMeter').classList.toggle('hot', !s.stock && !p.prize);
        set('batch', String(Math.min(K.BATCH, K.GLOBE - total)));
      } else if (K.SUPPLY) {
        const n = A.canMake(st, sel), unit = { beans: 'SHOT', milk: 'MILK', cocoa: 'COCOA', cups: 'CUP' };
        set('stock', n ? n + ' MORE' : 'OUT');
        $('stock').classList.toggle('neg', n < 5);
        $('stockMeter').style.width = Math.min(100, (n / 40) * 100) + '%';
        $('stockMeter').classList.toggle('hot', n < 5);
        set('recipe', Object.entries(p.use).map(([k, m]) => (m > 1 ? m + ' ' : '') + (unit[k] || k.toUpperCase())).join(' + '));
        set('brewTime', p.brew + ' MIN');
      } else {
        set('stock', s.stock + '/' + K.CAP);
        $('stockMeter').style.width = (s.stock / K.CAP) * 100 + '%';
        $('stockMeter').classList.toggle('hot', s.stock <= 2);
      }
      set('price', VT.money(s.price)); set('cost', VT.money(p.cost)); moneyTo('margin', s.price - p.cost);
      const rc = A.restockCost(st, sel);
      set('restockCost', rc ? VT.money(rc) : '');
      prop('restock', 'disabled', !rc || st.wallet < p.cost);
      $('priceDown').disabled = s.price <= K.PRICE_MIN; $('priceUp').disabled = s.price >= K.PRICE_MAX;
      // freshness (snacks)
      if ($('fresh')) {
        const n = A.staleCount(st, s), left = s.exp && s.exp.length ? (s.exp[0] - st.t) / K.DAY : null;
        set('fresh', left === null ? '—' : left <= 0 ? 'STALE!' : left < 1 ? 'TODAY' : Math.ceil(left) + (Math.ceil(left) === 1 ? ' DAY' : ' DAYS'));
        $('fresh').classList.toggle('neg', left !== null && left < 1);
        set('shelfLife', p.life + ' DAYS');
        set('binCount', n ? String(n) : '');
        prop('bin', 'disabled', !n);
        prop('bin', 'className', 'btn' + (n ? ' warn' : ''));
      }

      if (shown.days !== st.history.length) { shown.days = st.history.length; drawChart(); }
      const top = st.log.length ? st.log[st.log.length - 1].seq : 0;
      if (shown.logSeq !== top) {
        shown.logSeq = top;
        $('log').replaceChildren(...st.log.slice(-5).reverse().map(e => {
          const li = document.createElement('li'), time = document.createElement('time');
          li.className = e.kind; time.textContent = A.clock(st, e.t);
          li.append(time, ' ' + e.text);
          return li;
        }));
      }
      // a wreck: nothing to do but order a new machine and wait for it
      prop('order', 'hidden', !st.wreck);
      if (st.wreck) {
        const left = st.order ? Math.max(0, st.order.at - st.t) : 0;
        set('orderLabel', st.order ? 'ARRIVES IN' : 'NEW MACHINE');
        set('orderCost', st.order ? (left >= 60 ? Math.floor(left / 60) + 'H ' : '') + Math.ceil(left % 60) + 'M' : VT.money(K.MACHINE));
        prop('order', 'disabled', !!st.order);
        for (const id of ['restockAll', 'restock', 'service', 'binAll', 'bin', 'clean', 'drain', 'collect'].concat(SUP.map(k => 'refill-' + k))) prop(id, 'disabled', true);
      }
      document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === speed)));
      // the sky brightens by day and darkens at night
      const h = A.hour(st), light = Math.max(0, Math.sin((Math.PI * (h - 5)) / 15));
      bg.style.filter = `brightness(${(0.5 + light * 0.65).toFixed(2)}) saturate(${(0.8 + light * 0.35).toFixed(2)})`;
    }

    // ---- toast at the end of each day ----
    let toastTimer = 0, daysSeen = st.history.length;
    function checkDay() {
      if (st.history.length === daysSeen) return;
      daysSeen = st.history.length;
      const d = st.history[st.history.length - 1], el = $('toast');
      const extra = (d.waste ? ` · WASTE ${VT.money(d.waste)}` : '') + (d.wreck ? ` · EXPLOSION ${VT.money(d.wreck)}` : '');
      el.innerHTML = `<b>DAY ${d.day} CLOSED</b><span>${d.sold} ${K.ITEMS} · SALES ${VT.money(d.revenue)}</span><span class="${d.profit < 0 ? 'neg' : 'pos'}">PROFIT ${VT.money(d.profit)}</span><small>RENT ${VT.money(d.rent)} PAID${extra}</small>`;
      el.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
      save();
    }

    // ---- controls ----
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { fn(); refresh(); }); };
    on('collect', () => A.collect(st));
    on('restockAll', () => A.restockAll(st));
    on('repair', () => A.repair(st));
    on('order', () => A.orderMachine(st));
    on('service', () => A.service(st));
    on('binAll', () => A.binAllStale(st));
    on('bin', () => A.binStale(st, sel));
    on('restock', () => A.restock(st, sel));
    on('clean', () => A.clean(st));
    on('drain', () => A.drain(st, 'milk'));
    for (const k of SUP) on('refill-' + k, () => A.refill(st, k));
    on('priceUp', () => A.setPrice(st, sel, st.slots[sel].price + K.PRICE_STEP));
    on('priceDown', () => A.setPrice(st, sel, st.slots[sel].price - K.PRICE_STEP));
    const N = st.slots.length;
    on('prevProduct', () => { if (PICK) sel = (sel + N - 1) % N; else A.setProduct(st, sel, (st.slots[sel].p + PR.length - 1) % PR.length); });
    on('nextProduct', () => { if (PICK) sel = (sel + 1) % N; else A.setProduct(st, sel, (st.slots[sel].p + 1) % PR.length); });
    document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { speed = +b.dataset.speed; refresh(); }));
    let sure = 0;
    $('newGame').addEventListener('click', () => {
      const b = $('newGame');
      if (!sure) {
        b.textContent = 'SURE? CLICK AGAIN'; b.classList.add('warn');
        sure = setTimeout(() => { sure = 0; b.textContent = 'NEW GAME'; b.classList.remove('warn'); }, 3000);
        return;
      }
      clearTimeout(sure); sure = 0; b.textContent = 'NEW GAME'; b.classList.remove('warn');
      st = fresh(); sel = 0; lastSale = 0; drop = null; odd = null; daysSeen = 0; speed = 1;
      seenBoom = 0; seenArr = 0; boom = null; arriveAt = -99;
      save(); refresh(true);
    });

    addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key, c = sel % K.COLS, r = Math.floor(sel / K.COLS);
      const move = i => { e.preventDefault(); sel = i; refresh(); };
      const click = id => { const el = $(id); if (el && !el.disabled && !el.hidden) el.click(); };
      if (k === 'Escape') location.href = 'index.html';
      else if (k === ' ' && !e.target.closest('button')) { e.preventDefault(); speed = speed ? 0 : 1; refresh(); }
      else if (k >= '1' && k <= '4') { speed = K.SPEEDS[+k]; refresh(); }
      else if (k === 'ArrowLeft') move(r * K.COLS + (c + K.COLS - 1) % K.COLS);
      else if (k === 'ArrowRight') move(r * K.COLS + (c + 1) % K.COLS);
      else if (k === 'ArrowUp') move(((r + K.ROWS - 1) % K.ROWS) * K.COLS + c);
      else if (k === 'ArrowDown') move(((r + 1) % K.ROWS) * K.COLS + c);
      else if (k === '+' || k === '=') click('priceUp');
      else if (k === '-' || k === '_') click('priceDown');
      else if (k === 'r' || k === 'R') click('restock');
      else if (k === 'c' || k === 'C') click('collect');
      else if (k === 'b' || k === 'B') { click('bin'); click('drain'); }
      else if (k === 'g' || k === 'G') click('clean');
      else if (k === 'o' || k === 'O') click('order');
      else if (k === 's' || k === 'S') click('service');
    });

    // ---- the loop ----
    let last = performance.now(), lastUi = 0;
    function frame(now) {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (speed) A.step(st, dt * K.MIN_PER_SEC * speed);
      const t = now / 1000;
      effects(t);
      scene.draw(t);
      drawStage(t);
      if (now - lastUi > 120) { lastUi = now; refresh(); checkDay(); }
      requestAnimationFrame(frame);
    }
    // for poking at it from the console
    VT.game = { A, get st() { return st; }, set speed(v) { speed = v; } };
    refresh(true);
    requestAnimationFrame(frame);
  };
})(window.VT);
