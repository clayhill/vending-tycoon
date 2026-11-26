/* The soda machine game screen: runs the simulation in real time, draws the
 * street and the machine, and wires up the panels and the keyboard. The
 * game saves itself in this browser every few seconds. */
(function (VT) {
  'use strict';
  const K = VT.SODA, S = K.STAGE, PR = K.PRODUCTS, SAVE = 'vt.soda.v1';
  const $ = id => document.getElementById(id);
  const PC = PR.map(p => VT.rgb(p.color));

  const root = document.documentElement;
  const setPx = () => root.style.setProperty('--px', VT.scale() + 'px');
  setPx(); addEventListener('resize', setPx);

  // ---- state and saving ----
  const fresh = () => VT.sodaNew((Math.random() * 4294967296) >>> 0);
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE));
      return s && s.v === 1 && Array.isArray(s.slots) ? s : null;
    } catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify(st)); } catch (e) { /* private mode: play unsaved */ } }
  let st = load() || fresh();
  let speed = 1, sel = 0;
  addEventListener('pagehide', save);
  setInterval(save, 4000);

  // ---- the street: backdrop, machine and customers ----
  const bg = $('bg');
  const scene = VT.scene(bg, { horizon: 0.72 });
  const stage = $('stage'), fb = new VT.FB(stage);
  fb.resize(S.W, S.H);
  const mfb = new VT.FB(document.createElement('canvas'));
  mfb.resize(64, 88);
  function fitStage() {
    const wrap = stage.parentElement;
    const k = Math.max(2, Math.min(6, Math.floor(wrap.clientWidth / S.W), Math.floor((innerHeight * 0.62) / S.H)));
    stage.style.width = S.W * k + 'px'; stage.style.height = S.H * k + 'px';
  }
  fitStage(); addEventListener('resize', fitStage);

  const PAVE = VT.rgb('#1c0838'), PAVE_LO = VT.rgb('#12042a'), PAVE_EDGE = VT.rgb('#ff71ce'), JOINT = VT.rgb('#0d0221');
  function pavement() {
    const top = S.H - 16;
    for (let y = top; y < S.H; y++) for (let x = 0; x < S.W; x++) {
      const c = y === top ? PAVE_EDGE : (x + (y - top) * 3) % 24 === 0 ? JOINT : VT.bayer(x, y) < (y - top) / 16 ? PAVE_LO : PAVE;
      fb.px(x, y, y === top && VT.bayer(x, y) > 0.6 ? PAVE : c);
    }
  }

  let lastSale = st.lastSale ? st.lastSale.n : 0, drop = null;
  function view(t) {
    if (st.lastSale && st.lastSale.n !== lastSale) { lastSale = st.lastSale.n; drop = { at: t, color: PC[st.lastSale.p] }; }
    return {
      slots: st.slots.map(s => ({ color: PC[s.p], stock: s.stock, cap: K.CAP })),
      sel, drop, sign: st.jam ? 'JAM!' : VT.sodaFull(st) ? 'FULL' : 'SODA',
    };
  }

  function drawStage(t) {
    fb.clear();
    pavement();
    VT.drawSoda(mfb, t, view(t));
    fb.blit(mfb, S.MX, S.MY);
    // the queue stands at the back, people leaving walk past in front
    const order = st.customers.slice().sort((a, b) => (a.phase === 'leave') - (b.phase === 'leave'));
    for (const c of order) {
      const x = Math.round(c.x), foot = c.phase === 'leave' ? S.H - 3 : S.H - 9;
      const moving = c.phase === 'walk' || c.phase === 'leave';
      VT.drawPerson(fb, x, foot, c.look, moving ? Math.floor(c.x / 3) & 3 : 0, c.phase === 'use');
      if (c.bubble) VT.drawBubble(fb, x + 1, foot - 37, c.bubble, t);
      else if (c.phase === 'use') VT.drawBubble(fb, x + 1, foot - 37, 'think', t);
    }
    fb.flush();
  }

  // clicking a can on the machine selects its slot
  function slotAt(e) {
    const r = stage.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * S.W) - S.MX - 14;
    const y = Math.floor(((e.clientY - r.top) / r.height) * S.H) - S.MY - 23;
    const c = Math.floor(x / 8), row = Math.floor(y / 10);
    return c >= 0 && c < K.COLS && row >= 0 && row < K.ROWS && x % 8 < 8 ? row * K.COLS + c : -1;
  }
  stage.addEventListener('click', e => { const i = slotAt(e); if (i >= 0) { sel = i; refresh(true); } });
  stage.addEventListener('mousemove', e => { stage.style.cursor = slotAt(e) >= 0 ? 'pointer' : ''; });

  // ---- small pixel widgets ----
  const wx = VT.pixelCanvas($('wx'), 9, 9, 3);
  const stars = VT.pixelCanvas($('stars'), 39, 7, 3);
  const slotCan = VT.pixelCanvas($('slotCan'), 9, 10, 3);
  const chart = VT.pixelCanvas($('chart'), 74, 44, () => Math.max(3, VT.scale()));
  const DIM_STAR = { y: VT.PAL.d };
  function drawStars(r) {
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
    const days = st.history.slice(-7), C = chart, base = 34, top = 3;
    C.clear();
    const max = Math.max(5, ...days.map(d => Math.max(d.revenue, Math.abs(d.profit))));
    const neg = days.some(d => d.profit < 0);
    const zero = neg ? Math.round(base - (base - top) * 0.75) : base;
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
  const set = (id, v) => { const el = $(id); if (el.textContent !== v) el.textContent = v; };
  const moneyTo = (id, v) => { set(id, VT.money(v)); $(id).classList.toggle('neg', v < -0.004); };
  let shown = { sky: '', rating: -1, days: -1, logSeq: -1, can: -1 };
  function refresh(force) {
    if (force) shown = { sky: '', rating: -1, days: -1, logSeq: -1, can: -1 };
    set('day', 'DAY ' + VT.sodaDay(st)); set('time', VT.sodaClock(st));
    set('temp', st.temp + '°C');
    if (shown.sky !== st.sky) { shown.sky = st.sky; wx.clear(); VT.icon(wx, st.sky, 0, 0); wx.flush(); $('wx').parentElement.title = st.sky === 'sun' ? 'Sunny' : st.sky === 'cloud' ? 'Cloudy' : 'Rain'; }
    const r = Math.round(st.rating * 4) / 4;
    if (shown.rating !== r) { shown.rating = r; drawStars(r); $('rating').setAttribute('aria-label', `Rating ${r.toFixed(1)} of 5`); }

    const full = VT.sodaFull(st);
    set('state', st.jam ? 'JAMMED' : full ? 'BOX FULL' : 'RUNNING');
    $('state').className = 'pill' + (st.jam || full ? ' alarm' : '');
    moneyTo('wallet', st.wallet); moneyTo('cashbox', st.cashbox);
    $('cashMeter').style.width = Math.min(100, (st.cashbox / K.CASHBOX) * 100) + '%';
    $('cashMeter').classList.toggle('hot', st.cashbox > K.CASHBOX * 0.75);
    $('collect').disabled = !st.cashbox;
    const allCost = VT.sodaRestockAllCost(st);
    set('restockAllCost', allCost ? VT.money(allCost) : '');
    $('restockAll').disabled = !allCost || st.wallet < 0.35;
    $('repair').hidden = !st.jam;

    const d = st.today, lost = d.lostOut + d.lostPrice + d.lostQueue + d.lostBroken;
    set('sCustomers', String(d.customers)); set('sSold', String(d.sold));
    moneyTo('sRevenue', d.revenue); moneyTo('sProfit', VT.sodaProfit(d)); set('sLost', String(lost));
    const why = [[d.lostOut, 'SOLD OUT'], [d.lostPrice, 'TOO PRICEY'], [d.lostQueue, 'LONG LINE'], [d.lostBroken, 'MACHINE DOWN']].filter(w => w[0]).map(w => w[0] + ' ' + w[1]);
    set('sWhy', why.join(' · '));

    const s = st.slots[sel], p = PR[s.p];
    set('slotName', VT.slotName(sel)); set('productName', p.name);
    if (shown.can !== s.p) { shown.can = s.p; slotCan.clear(); VT.drawCan(slotCan, 1, 1, PC[s.p]); slotCan.flush(); }
    set('stock', s.stock + '/' + K.CAP);
    $('stockMeter').style.width = (s.stock / K.CAP) * 100 + '%';
    $('stockMeter').classList.toggle('hot', s.stock <= 2);
    set('price', VT.money(s.price)); set('cost', VT.money(p.cost)); moneyTo('margin', s.price - p.cost);
    const rc = VT.sodaRestockCost(st, sel);
    set('restockCost', rc ? VT.money(rc) : '');
    $('restock').disabled = !rc || st.wallet < p.cost;
    $('priceDown').disabled = s.price <= K.PRICE_MIN; $('priceUp').disabled = s.price >= K.PRICE_MAX;

    if (shown.days !== st.history.length) { shown.days = st.history.length; drawChart(); }
    const top = st.log.length ? st.log[st.log.length - 1].seq : 0;
    if (shown.logSeq !== top) {
      shown.logSeq = top;
      const list = $('log');
      list.replaceChildren(...st.log.slice(-5).reverse().map(e => {
        const li = document.createElement('li');
        li.className = e.kind;
        const m = Math.floor(e.t % K.DAY);
        li.innerHTML = `<time>${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}</time> `;
        li.append(e.text);
        return li;
      }));
    }
    document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.speed === speed)));
    // the sky brightens by day and darkens at night
    const h = VT.sodaHour(st), light = Math.max(0, Math.sin((Math.PI * (h - 5)) / 15));
    bg.style.filter = `brightness(${(0.5 + light * 0.65).toFixed(2)}) saturate(${(0.8 + light * 0.35).toFixed(2)})`;
  }

  // ---- toast at the end of each day ----
  let toastTimer = 0, daysSeen = st.history.length;
  function toast(html) {
    const el = $('toast');
    el.innerHTML = html; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function checkDay() {
    if (st.history.length === daysSeen) return;
    daysSeen = st.history.length;
    const d = st.history[st.history.length - 1];
    toast(`<b>DAY ${d.day} CLOSED</b><span>${d.sold} CANS · SALES ${VT.money(d.revenue)}</span><span class="${d.profit < 0 ? 'neg' : 'pos'}">PROFIT ${VT.money(d.profit)}</span><small>RENT ${VT.money(d.rent)} PAID</small>`);
    save();
  }

  // ---- controls ----
  const act = fn => () => { fn(); refresh(); };
  $('collect').addEventListener('click', act(() => VT.sodaCollect(st)));
  $('restockAll').addEventListener('click', act(() => VT.sodaRestockAll(st)));
  $('repair').addEventListener('click', act(() => VT.sodaRepair(st)));
  $('restock').addEventListener('click', act(() => VT.sodaRestock(st, sel)));
  $('priceUp').addEventListener('click', act(() => VT.sodaSetPrice(st, sel, st.slots[sel].price + K.PRICE_STEP)));
  $('priceDown').addEventListener('click', act(() => VT.sodaSetPrice(st, sel, st.slots[sel].price - K.PRICE_STEP)));
  const swap = dir => act(() => VT.sodaSetProduct(st, sel, (st.slots[sel].p + dir + PR.length) % PR.length));
  $('prevProduct').addEventListener('click', swap(-1));
  $('nextProduct').addEventListener('click', swap(1));
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
    st = fresh(); sel = 0; lastSale = 0; drop = null; daysSeen = 0; speed = 1;
    save(); refresh(true);
  });

  addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key, c = sel % K.COLS, r = Math.floor(sel / K.COLS);
    const move = i => { e.preventDefault(); sel = i; refresh(); };
    if (k === 'Escape') location.href = 'index.html';
    else if (k === ' ' && !e.target.closest('button')) { e.preventDefault(); speed = speed ? 0 : 1; refresh(); }
    else if (k >= '1' && k <= '4') { speed = K.SPEEDS[+k]; refresh(); }
    else if (k === 'ArrowLeft') move(r * K.COLS + (c + K.COLS - 1) % K.COLS);
    else if (k === 'ArrowRight') move(r * K.COLS + (c + 1) % K.COLS);
    else if (k === 'ArrowUp') move(((r + K.ROWS - 1) % K.ROWS) * K.COLS + c);
    else if (k === 'ArrowDown') move(((r + 1) % K.ROWS) * K.COLS + c);
    else if (k === '+' || k === '=') $('priceUp').click();
    else if (k === '-' || k === '_') $('priceDown').click();
    else if (k === 'r' || k === 'R') $('restock').click();
    else if (k === 'c' || k === 'C') $('collect').click();
  });

  // ---- the loop ----
  let last = performance.now(), lastUi = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (speed) VT.sodaStep(st, dt * K.MIN_PER_SEC * speed);
    const t = now / 1000;
    scene.draw(t);
    drawStage(t);
    if (now - lastUi > 120) { lastUi = now; refresh(); checkDay(); }
    requestAnimationFrame(frame);
  }
  refresh(true);
  requestAnimationFrame(frame);
})(window.VT);
