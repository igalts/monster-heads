'use strict';
// מפלצת הראשים: the app around the game (hydra.js) - save, sounds, title, map, pause, win and lose cards.
(() => {
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtTime = (s) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  // ---------- Saved progress (its own save, nothing shared with the other games) ----------
  const fresh = () => ({ stars: {}, best: {}, chal: {}, times: {}, streak: {}, unlocked: [], muted: false, mapWorld: null, coins: 0, lv: {}, specials: ['roar'], special: 'roar' });
  const store = {
    key: 'monsterHeads.v1',
    data: fresh(),
    load() {
      try { const d = JSON.parse(localStorage.getItem(this.key)); if (d) Object.assign(this.data, d); } catch (e) { /* ignore */ }
      this.loaded = true;
    },
    save() { if (!this.loaded) return; try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
  };
  const rec = () => store.data;

  // ---------- Sound (synthesized, no files) ----------
  const sfx = {
    ctx: null,
    init() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'triangle', vol = 0.08, when = 0, slide = 0) {
      if (!this.ctx || store.data.muted) return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    claim() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.09, i * 0.06)); },
    pop()   { this.tone(700, 0.12, 'square', 0.05, 0, 1600); },
    power() { [784, 988, 1319].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.08, i * 0.05)); },
    win()   { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.1, i * 0.13)); },
    lose()  { [392, 330, 262].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.09, i * 0.22)); },
    tap()   { this.tone(660, 0.06, 'triangle', 0.06); },
    ready() { [392, 523].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.06, i * 0.12)); },
    go()    { [659, 988].forEach((f, i) => this.tone(f, 0.16, 'square', 0.06, i * 0.09)); },
    boss()  { [110, 110, 147, 110].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.08, i * 0.2)); },
    ouch()  { this.tone(520, 0.3, 'square', 0.07, 0, 140); },
    defeat() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.2, 'sawtooth', 0.06, i * 0.12)); },
  };

  // ---------- Pictures ----------
  const images = {};
  function loadScene(name) {
    if (images[name]) return Promise.resolve();
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => { images[name] = im; res(); };
      im.onerror = () => res();
      im.src = `assets/${name}.svg`;
    });
  }

  // ---------- Screens ----------
  let G = null, paused = false, screen = 'title';
  function show(name) {
    screen = name;
    for (const id of ['title', 'map', 'world', 'game', 'shop']) $(`#${id}`).hidden = id !== name;
    if (name === 'shop') buildShop();
    if (name === 'title') buildTitle();
    if (name === 'map') buildMap();
    if (name === 'world') buildWorld();
  }
  function hideOverlays() { for (const id of ['pause', 'win', 'lose', 'ctrlInfo']) $(`#${id}`).hidden = true; }

  function startPlay() {
    G.state = 'play';
    const b = $('#banner'), g = G;
    b.className = 'banner go';
    b.innerHTML = '<div class="go-word">קדימה!</div>';
    sfx.go();
    setTimeout(() => { if (G === g && b.classList.contains('go')) b.hidden = true; }, 750);
  }
  function skipIntro() {
    if (!G || G.state !== 'ready' || paused || G.readyT > G.readyMax - 0.3) return;
    G.readyT = 0;
    startPlay();
  }
  // The health bar in the top bar (it used to be eggs).
  function buildLives() {
    const el = $('#lives');
    if (!el.firstChild) el.innerHTML = '<span class="hp-heart">❤</span><div class="hp"><i class="lag"></i><i class="fill"></i><u></u><span></span></div>';
    const k = clamp(G.hp / G.maxHp, 0, 1);
    el.querySelector('.fill').style.width = `${k * 100}%`;
    el.querySelector('.lag').style.width = `${k * 100}%`;
    el.querySelector('.hp span').textContent = `${Math.ceil(G.hp)} / ${G.maxHp}`;
    el.classList.toggle('low', k < 0.35);
    if (G.lastHp != null && G.hp < G.lastHp) { el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt'); }
    G.lastHp = G.hp;
  }
  const chalRow = (cfg, done, freshBits = 0, chals = game.chals) => `<span class="chal-row">${chals.map((ch) =>
    `<span class="chal${done & ch.bit ? ' done' : ''}${freshBits & ch.bit ? ' fresh' : ''}">${ch.icon} <bdi>${ch.label(cfg)}</bdi></span>`).join('')}</span>`;

  function finishWin(stars, doneNow, delay) {
    const r = rec(), WORLDS = game.worlds;
    r.stars[G.key] = Math.max(r.stars[G.key] || 0, stars);
    r.streak[G.key] = 0;
    const time = G.playT, prevBest = r.best[G.key];
    const record = !prevBest || time < prevBest;
    if (record) r.best[G.key] = time;
    r.times[G.key] = [time, ...(r.times[G.key] || [])].slice(0, 3);
    const before = r.chal[G.key] || 0, freshBits = doneNow & ~before;
    r.chal[G.key] = before | doneNow;
    r.coins = (r.coins || 0) + G.coins;
    let unlocked = null;
    const world = WORLDS[G.w];
    if (G.l === world.levels.length - 1 && world.unlock && !r.unlocked.includes(world.unlock)) {
      r.unlocked.push(world.unlock); unlocked = world.unlock;
      if (hydra.heads.activeHeads().length < hydra.heads.MAX_HEADS) hydra.heads.swapHead(unlocked, null); // it joins the fight if there's room
    }
    store.save();
    setTimeout(() => {
      if (!G || G.state !== 'won') return;
      $('#winStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : 'off'}">★</span>`).join('');
      $('#winChal').innerHTML = chalRow(G.cfg, r.chal[G.key], freshBits);
      $('#winScore').innerHTML = `<span class="gem-win">+${G.coins} 🪙</span><span>ניקוד: ${G.score}</span>`;
      if (freshBits) setTimeout(() => sfx.power(), 900);
      $('#winTime').innerHTML = `<span>⏱ <bdi>${fmtTime(time)}</bdi></span>${
        record && prevBest ? '<span class="record">שיא חדש!</span>' : !record ? `<span class="best">השיא <bdi>${fmtTime(prevBest)}</bdi></span>` : ''}`;
      const u = $('#unlock');
      if (unlocked) {
        const P = game.prize(unlocked);
        $('#unlockImg').src = P.src;
        $('#unlockText').innerHTML = `${P.title}<small class="perk-line">${P.line}</small>`;
        buildUnlockPick(unlocked);
        u.hidden = false;
        setTimeout(() => sfx.power(), 1300);
      } else u.hidden = true;
      const lastLevel = G.l >= world.levels.length - 1, lastWorld = G.w >= WORLDS.length - 1;
      $('#winTitle').textContent = lastLevel && lastWorld ? 'ניצחת את כל המשחק!' : G.bossFight ? 'ניצחת את הבוס!' : 'כל הכבוד!';
      $('#nextLabel').textContent = lastLevel ? 'לעולם הבא' : 'לשלב הבא';
      $('#winHero').src = hydra.heroNow();
      $('#nextBtn').hidden = lastLevel && lastWorld;
      $('#win').hidden = false;
      for (let i = 0; i < stars; i++) setTimeout(() => sfx.tone(880 + i * 220, 0.18, 'triangle', 0.1), 380 + i * 300);
    }, delay);
  }
  // The new head: it's in the fight already, or you pick which head it replaces.
  function buildUnlockPick(id) {
    const H = hydra.heads, box = $('#unlockPick'), on = H.activeHeads();
    if (on.includes(id)) {
      box.innerHTML = `<div class="pick-done">✓ ${H.HEADS[id].name} בקרב!</div>`;
      $('#winHero').src = hydra.heroNow();
      return;
    }
    box.innerHTML = `<div class="pick-ask">לקחת אותו לקרב? בוחרים ראש להחליף:</div><div class="pick-row">${
      on.map((h) => `<button class="pick-head" data-h="${h}"><img src="${H.headURL(h)}" alt=""><small>${H.HEADS[h].name.replace('ראש ', '')}</small></button>`).join('')}</div>`;
    for (const b of box.querySelectorAll('.pick-head')) {
      b.addEventListener('click', () => { sfx.init(); sfx.power(); H.swapHead(id, b.dataset.h); buildUnlockPick(id); });
    }
  }
  function lose() {
    const r = rec();
    r.streak[G.key] = (r.streak[G.key] || 0) + 1;
    r.coins = (r.coins || 0) + G.coins; // coins you picked up are kept even when you lose
    store.save();
    sfx.lose();
    $('#loseImg').src = G.ch.src;
    setTimeout(() => { if (G && G.state === 'dying') { G.state = 'lost'; $('#lose').hidden = false; } }, 1400);
  }
  let wakeLock = null;
  function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock) navigator.wakeLock.request('screen').then((l) => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
    } catch (e) { /* ignore */ }
  }

  // ---------- The game ----------
  const input = { dir: null };
  const core = {
    $, store, rec, sfx, images, input, G: () => G, setG: (g) => { G = g; }, isPaused: () => paused, setPaused: (v) => { paused = v; },
    loadScene, show, hideOverlays, buildLives, keepAwake, applyControlMode: () => {}, controlMode: () => 'swipe', startPlay, skipIntro,
    finishWin, lose, chalRow, fmtTime,
  };
  const hydra = window.DinoHydra(core);
  const game = hydra.game;
  const playLevel = (w, l) => game.start(w, l);

  // ---------- Title ----------
  const coinText = () => `🪙 ${store.data.coins || 0}`;
  function buildTitle() {
    game.buildTitle();
    $('#titleCoins').textContent = coinText();
    $('#muteBtn').textContent = store.data.muted ? '🔇' : '🔊';
  }

  // ---------- Worlds: a list of world portals, and each world's own screen with its levels ----------
  const worldOpen = (w) => w === 0 || (rec().stars[`${w}-5`] || 0) > 0;
  const levelOpen = (w, l) => (l === 0 ? worldOpen(w) : (rec().stars[`${w + 1}-${l}`] || 0) > 0);
  const starsIn = (w) => game.worlds[w].levels.reduce((n, _, l) => n + (rec().stars[`${w + 1}-${l + 1}`] || 0), 0);
  function currentMapWorld() {
    let w = rec().mapWorld;
    if (!Number.isInteger(w) || w < 0 || w >= game.worlds.length) { w = 0; for (let i = 0; i < game.worlds.length; i++) if (worldOpen(i)) w = i; }
    return w;
  }
  function buildMap() {
    $('#mapCoins').textContent = coinText();
    const list = $('#worldList'), cur = currentMapWorld();
    list.innerHTML = '';
    game.worlds.forEach((wd, w) => {
      const open = worldOpen(w), got = starsIn(w), total = wd.levels.length * 3, grown = rec().unlocked.includes(wd.unlock);
      const b = document.createElement('button');
      b.className = `world-card${open ? '' : ' locked'}${w === cur ? ' current' : ''}`;
      b.style.backgroundImage = `url(${game.map.banner(w)})`;
      b.innerHTML = `<span class="wc-shade"></span>
        <span class="wc-text"><span class="wc-num">עולם ${w + 1}</span><span class="wc-name">${wd.name}</span>
        <span class="wc-stars">${open ? `★ <bdi>${got}/${total}</bdi>` : `🔒 מסיימים את עולם ${w}`}</span></span>
        <span class="wc-prize${grown ? ' got' : ''}"><img src="${game.prize(wd.unlock).src}" alt=""><small>${grown ? '✓ יש לך' : 'פרס:'}</small><b>${game.heads[wd.unlock].name.replace('ראש ', '')}</b></span>`;
      b.addEventListener('click', () => {
        sfx.init();
        if (!open) { sfx.tone(200, 0.12, 'square', 0.04); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
        sfx.tap(); rec().mapWorld = w; store.save(); show('world');
      });
      list.appendChild(b);
    });
  }
  function buildWorld() {
    const w = currentMapWorld(), wd = game.worlds[w], r = rec();
    $('#worldBanner').src = game.map.banner(w);
    $('#worldBoss').src = game.map.boss(w);
    $('#worldNum').textContent = `עולם ${w + 1}`;
    $('#worldName').textContent = wd.name;
    $('#worldStars').innerHTML = `★ <bdi>${starsIn(w)}/${wd.levels.length * 3}</bdi>`;
    const grown = r.unlocked.includes(wd.unlock);
    $('#worldPrize').innerHTML = `<img src="${game.prize(wd.unlock).src}" alt=""><span><small>${grown ? '✓ קיבלת' : 'הפרס של העולם'}</small><b>${game.heads[wd.unlock].name}</b></span>`;
    $('#worldPrize').classList.toggle('got', grown);
    const list = $('#levelList');
    list.innerHTML = '';
    let next = wd.levels.findIndex((_, l) => levelOpen(w, l) && !(r.stars[`${w + 1}-${l + 1}`] || 0));
    wd.levels.forEach((cfg, l) => {
      const key = `${w + 1}-${l + 1}`, open = levelOpen(w, l), stars = r.stars[key] || 0, best = r.best[key];
      const b = document.createElement('button');
      b.className = `lvl-row${cfg.bossFight ? ' boss' : ''}${open ? ' open' : ' locked'}${l === next ? ' next' : ''}`;
      b.disabled = !open;
      const title = cfg.bossFight ? game.bosses[w].name : `שלב ${l + 1}`;
      const sub = cfg.bossFight ? `מנצחים ומקבלים את ${game.heads[wd.unlock].name}` : `${cfg.foes} דרקונים`;
      b.innerHTML = `<span class="lvl-num">${cfg.bossFight ? '☠' : l + 1}</span>
        <span class="lvl-main"><b>${title}</b><small>${open ? `${sub}${best ? ` · השיא <bdi>${fmtTime(best)}</bdi>` : ''}` : 'נפתח אחרי השלב הקודם'}</small>${open ? chalRow(cfg, r.chal[key] || 0) : ''}</span>
        <span class="lvl-side"><span class="lvl-stars">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'on' : ''}">★</i>`).join('')}</span>
        <span class="lvl-play">${!open ? '🔒' : l === next ? '<span class="go-pill"><svg viewBox="0 0 24 24"><path d="M7 5 L19 12 L7 19 Z"/></svg>שחק!</span>'
          : '<svg viewBox="0 0 24 24"><path d="M8 5 L19 12 L8 19 Z"/></svg>'}</span></span>${l === next ? '<span class="next-tag">הבא</span>' : ''}`;
      b.addEventListener('click', () => { sfx.init(); sfx.tap(); playLevel(w, l); });
      list.appendChild(b);
      if (l === next) requestAnimationFrame(() => b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    });
  }

  // ---------- Shop: weapon levels for every head, and the special powers ----------
  const S = hydra.shop;
  let shopTab = 'heads', shopFrom = 'title';
  function openShop() { shopFrom = screen; show('shop'); }
  function buy(price) {
    if ((store.data.coins || 0) < price) { sfx.tone(200, 0.15, 'square', 0.04); return false; }
    store.data.coins -= price; store.save(); sfx.power(); return true;
  }
  function buildShop() {
    const r = rec();
    r.lv = r.lv || {}; r.specials = r.specials || ['roar'];
    $('#shopCoins').textContent = coinText();
    for (const t of document.querySelectorAll('#shop .tab')) t.classList.toggle('on', t.dataset.tab === shopTab);
    const list = $('#shopList');
    list.innerHTML = '';
    if (shopTab === 'heads') {
      S.HEAD_ORDER.forEach((id, i) => {
        const H = S.HEADS[id], open = id === 'fire' || r.unlocked.includes(id), lv = S.heroLevel(id);
        const card = document.createElement('div');
        card.className = `shop-card${open ? '' : ' locked'}`;
        const pips = [1, 2, 3, 4].map((k) => `<i class="${k <= lv ? 'on' : ''}"></i>`).join('');
        let action = '';
        if (!open) action = `<div class="shop-note">נפתח אחרי עולם ${i}</div>`;
        else if (lv >= S.MAX_SHOP_LV) action = '<div class="shop-note max">רמה מקסימלית</div>';
        else {
          const price = S.LEVEL_PRICE[lv + 1];
          action = `<button class="buy${(r.coins || 0) < price ? ' poor' : ''}">שדרוג · ${price} 🪙</button>`;
        }
        card.innerHTML = `<img src="${S.headURL(id)}" alt=""><div class="shop-info"><div class="shop-name">${H.name}</div>
          <div class="pips">${pips}</div><div class="shop-desc">${open ? `רמה ${lv}: ${H.lv[lv - 1]}${lv < S.MAX_SHOP_LV ? `<br><span class="next">הבאה: ${H.lv[lv]}</span>` : ''}` : H.perk}</div></div>${action}`;
        const b = card.querySelector('.buy');
        if (b) b.addEventListener('click', () => { if (buy(S.LEVEL_PRICE[lv + 1])) { r.lv[id] = lv + 1; store.save(); buildShop(); } });
        list.appendChild(card);
      });
    } else {
      S.SPECIAL_ORDER.forEach((id) => {
        const sp = S.SPECIALS[id], owned = id === 'roar' || r.specials.includes(id), on = (r.special || 'roar') === id;
        const card = document.createElement('div');
        card.className = `shop-card special${on ? ' equipped' : ''}`;
        const action = on ? '<div class="shop-note max">✓ נבחר</div>'
          : owned ? '<button class="buy pick">בחירה</button>'
          : `<button class="buy${(r.coins || 0) < sp.price ? ' poor' : ''}">קנייה · ${sp.price} 🪙</button>`;
        card.innerHTML = `<img src="${S.specialURL(id)}" alt=""><div class="shop-info"><div class="shop-name">${sp.name}</div><div class="shop-desc">${sp.desc}</div></div>${action}`;
        const b = card.querySelector('.buy');
        if (b) b.addEventListener('click', () => {
          if (owned) { r.special = id; store.save(); sfx.tap(); buildShop(); return; }
          if (buy(sp.price)) { r.specials.push(id); r.special = id; store.save(); buildShop(); }
        });
        list.appendChild(card);
      });
    }
  }
  for (const t of document.querySelectorAll('#shop .tab')) t.addEventListener('click', () => { sfx.init(); sfx.tap(); shopTab = t.dataset.tab; buildShop(); });

  // ---------- Pause and help ----------
  function togglePause(on) {
    if (screen !== 'game' || !G || G.state === 'won' || G.state === 'lost' || G.state === 'dying') return;
    paused = on;
    $('#pause').hidden = !on;
    if (!on) $('#ctrlInfo').hidden = true;
    $('#pauseMuteBtn').classList.toggle('muted', !!store.data.muted);
    $('#pauseDino').src = G.ch.src;
    hydra.onPause();
  }
  const isTouch = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  function showHelp() {
    const rows = isTouch()
      ? [['👆', 'גוררים את האצבע: המפלצת זזה איתה'], ['🐲', 'הראשים יורים לבד'], ['🪙', 'אוספים מטבעות וכוח'], ['⚡', 'הכוח המיוחד מלא: נוגעים בכפתור שלו (או שתי נגיעות מהירות)'], ['🛒', 'בחנות קונים רמות לנשקים וכוחות מיוחדים']]
      : [['⬅️', 'חיצים: מזיזים את המפלצת'], ['🐲', 'הראשים יורים לבד'], ['🪙', 'אוספים מטבעות וכוח'], ['␣', 'רווח: הכוח המיוחד, כשהוא מלא'], ['P', 'הפסקה']];
    $('#ctrlList').innerHTML = rows.map(([ic, t]) => `<li><span class="hic emoji">${ic}</span><span>${t}</span></li>`).join('');
    $('#pause').hidden = true;
    $('#ctrlInfo').hidden = false;
  }

  // ---------- Buttons ----------
  const on = (id, fn) => $(id).addEventListener('click', (e) => { sfx.init(); sfx.tap(); fn(e); });
  on('#playBtn', () => { goFullscreen(); show('map'); });
  on('#mapBack', () => show('title'));
  on('#shopBtn', openShop);
  on('#mapShop', openShop);
  on('#winShopBtn', () => { rec().mapWorld = G.w; hideOverlays(); G = null; openShop(); shopFrom = 'world'; });
  on('#shopBack', () => show(shopFrom === 'shop' ? 'title' : shopFrom));
  on('#worldBack', () => show('map'));
  on('#muteBtn', () => { store.data.muted = !store.data.muted; store.save(); buildTitle(); });
  on('#pauseBtn', () => togglePause(true));
  on('#resumeBtn', () => togglePause(false));
  $('#pause').addEventListener('click', (e) => { if (e.target.id === 'pause') { sfx.tap(); togglePause(false); } });
  on('#restartBtn', () => playLevel(G.w, G.l));
  on('#pauseMapBtn', () => { paused = false; hideOverlays(); show('world'); });
  on('#pauseHomeBtn', () => { paused = false; hideOverlays(); show('title'); });
  on('#pauseMuteBtn', () => { store.data.muted = !store.data.muted; store.save(); $('#pauseMuteBtn').classList.toggle('muted', !!store.data.muted); });
  on('#ctrlInfoBtn', showHelp);
  on('#ctrlInfoClose', () => { $('#ctrlInfo').hidden = true; if (paused) $('#pause').hidden = false; });
  on('#nextBtn', () => {
    if (G.l + 1 < game.worlds[G.w].levels.length) playLevel(G.w, G.l + 1);
    else { rec().mapWorld = G.w + 1; store.save(); playLevel(G.w + 1, 0); }
  });
  on('#winRetryBtn', () => playLevel(G.w, G.l));
  on('#winMapBtn', () => { rec().mapWorld = G.w; hideOverlays(); show('world'); });
  on('#retryBtn', () => playLevel(G.w, G.l));
  on('#loseMapBtn', () => { hideOverlays(); show('world'); });
  const step = (confirming) => { $('#resetAsk').hidden = confirming; $('#resetConfirm').hidden = !confirming; };
  on('#settingsBtn', () => { step(false); $('#resetDone').hidden = true; $('#settings').hidden = false; });
  on('#settingsClose', () => { $('#settings').hidden = true; });
  on('#resetBtn', () => step(true));
  on('#resetNo', () => step(false));
  on('#resetYes', () => { const { muted } = store.data; store.data = { ...fresh(), muted }; store.save(); G = null; step(false); $('#resetDone').hidden = false; buildTitle(); });

  window.addEventListener('keydown', (e) => {
    if (screen !== 'game') return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { togglePause(!paused); return; }
    if (!paused) hydra.key(e, true);
  });
  window.addEventListener('keyup', (e) => { if (screen === 'game') hydra.key(e, false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) togglePause(true); else if (screen === 'game') keepAwake(); });
  window.addEventListener('resize', () => { if (screen === 'game') hydra.resize(); });

  // Full screen once, on the first tap (the installed app is full screen already).
  let fsDone = false;
  const installed = () => ['fullscreen', 'standalone'].some((m) => window.matchMedia && matchMedia(`(display-mode: ${m})`).matches);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) fsDone = true; });
  function goFullscreen() {
    const el = document.documentElement;
    if (fsDone || installed() || document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => {})).catch(() => {});
  }
  document.addEventListener('pointerup', () => { if (screen !== 'game') goFullscreen(); }, true);

  // ---------- Main loop ----------
  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    if (G && screen === 'game') { if (!paused) hydra.update(dt); hydra.render(); }
    if (screen === 'title') game.paintHero($('#titleHero'), t / 1000);
    requestAnimationFrame(frame);
  }

  store.load();
  loadScene('egg').then(() => { show('title'); requestAnimationFrame(frame); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__monster = { get G() { return G; }, hydra, store, playLevel, show, tick(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) hydra.update(dt); hydra.render(); } };
})();
