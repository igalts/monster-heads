'use strict';
// מפלצת הראשים: a flying shooter. A many-headed monster flies up through five dragon worlds; its heads shoot on their own.
// It starts with one head (fire); beating each world's boss grows a new head with its own weapon:
//   fire: fireballs   ice: a freezing beam   poison: globs that burst into a cloud
//   lightning: arcs that jump between enemies   wind: waves that blow enemy shots away   stars: stars that hunt enemies
// Every head's weapon has levels 1-4, bought in the shop with the coins you collect. A power-up adds one more level for a while.
// The special power (roar, shield, time freeze or meteor shower, also from the shop) fills up as you beat enemies.
// app.js builds the pieces around it (save, sounds, map, shop, win card) and hands them in as `core`.
window.DinoHydra = (core) => {
  const { $, store, rec, sfx, images } = core;
  const INK = '#120C1E';
  const VW = 360, VH = 640;
  const TAU = Math.PI * 2;
  const FONT = '"Secular One", "Rubik", sans-serif';
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (k) => 1 - (1 - k) * (1 - k);

  // ---------- Heads and their weapons ----------
  const HEADS = {
    fire:   { name: 'ראש האש',    c: '#E8452C', dark: '#8E1E12', glow: '#FFB020', perk: 'כדורי אש',
              lv: ['כדור אש אחד', 'שני כדורי אש', 'שלושה כדורים במניפה', 'כדורים גדולים וחזקים'] },
    ice:    { name: 'ראש הקרח',   c: '#7FD4FF', dark: '#2A6FA8', glow: '#BFF4FF', perk: 'קרן קרח שמקפיאה',
              lv: ['קרן קרח', 'קרן חזקה יותר', 'הקרן עוברת דרך כולם', 'קרן ענקית'] },
    poison: { name: 'ראש הרעל',   c: '#5BC23A', dark: '#245C16', glow: '#B6FF6A', perk: 'בועות שמתפוצצות לענן רעל',
              lv: ['בועת רעל', 'ענן גדול יותר', 'רעל חזק יותר', 'בועות בלי הפסקה'] },
    bolt:   { name: 'ראש הברק',   c: '#FFC93C', dark: '#8A5A00', glow: '#FFF6A0', perk: 'ברק שקופץ בין אויבים',
              lv: ['ברק קופץ ל-2', 'קופץ ל-3', 'קופץ ל-4', 'סערת ברקים'] },
    wind:   { name: 'ראש הרוח',   c: '#9FF0E0', dark: '#1F7F74', glow: '#E6FFFA', perk: 'גלי רוח שמעיפים יריות',
              lv: ['גל רוח', 'גל רחב', 'גל חזק', 'סופה'] },
    star:   { name: 'ראש הכוכבים', c: '#9B7BFF', dark: '#3A2290', glow: '#F0C8FF', perk: 'כוכבים שמחפשים אויבים',
              lv: ['כוכב מחפש', 'כוכבים מהירים', 'שני כוכבים', 'מטר כוכבים'] },
  };
  const HEAD_ORDER = ['fire', 'ice', 'poison', 'bolt', 'wind', 'star'];
  Object.keys(HEADS).forEach((id) => { HEADS[id].id = id; });
  const LEVEL_PRICE = [0, 0, 40, 100, 200]; // coins to buy level 2, 3, 4
  const MAX_SHOP_LV = 4;
  const SPECIALS = {
    roar:   { name: 'שאגה',        price: 0,   desc: 'מנקה את המסך מיריות ופוגעת בכל האויבים' },
    shield: { name: 'מגן',         price: 120, desc: 'בועת מגן ל-6 שניות: שום דבר לא פוגע' },
    freeze: { name: 'עצירת זמן',   price: 180, desc: 'כל האויבים והיריות קופאים ל-4 שניות' },
    meteor: { name: 'גשם מטאורים', price: 260, desc: 'מטאורים נופלים על כל האויבים' },
  };
  const SPECIAL_ORDER = ['roar', 'shield', 'freeze', 'meteor'];
  const BODY = { c: '#3B2F5C', plate: '#5A4A86', bone: '#E6DCC4' };
  const heroLevel = (id) => clamp((rec().lv || {})[id] || 1, 1, MAX_SHOP_LV);

  // ---------- Worlds and levels ----------
  // len: seconds of enemy waves in the level. Boss levels have a short way in, then the boss.
  const L = (len) => ({ len });
  const WORLDS = [
    { name: 'מערות הלבה', unlock: 'ice', bg: 'hbg-1', motes: ['#FF9F1C', '#FFD23F'], moteUp: true,
      levels: [L(42), L(48), L(52), L(56), L(14)] },
    { name: 'ביצת הרפאים', unlock: 'poison', bg: 'hbg-2', motes: ['#7CFFB0', '#C77DFF'], moteUp: true,
      levels: [L(50), L(54), L(58), L(60), L(14)] },
    { name: 'דרקון השלד', unlock: 'bolt', bg: 'hbg-3', motes: ['#D9CFB8', '#FF8A4A'],
      levels: [L(54), L(58), L(60), L(62), L(14)] },
    { name: 'תהום הקריסטלים', unlock: 'wind', bg: 'hbg-4', motes: ['#4AF0FF', '#FF4FD8', '#B8A8FF'],
      levels: [L(56), L(60), L(62), L(64), L(14)] },
    { name: 'מצודת הסערה', unlock: 'star', bg: 'hbg-5', motes: ['#BFD3FF', '#FFF6B0'], streaks: true,
      levels: [L(58), L(62), L(64), L(66), L(14)] },
  ];
  WORLDS.forEach((wd) => { wd.levels[wd.levels.length - 1].bossFight = true; });
  const BOSSES = [
    { name: 'דרקון הלבה',    hp: 360, attacks: ['fan', 'summon', 'aimed', 'fan'], rage: ['rain', 'fan', 'aimed', 'summon'] },
    { name: 'דרקון הביצה',   hp: 700, attacks: ['aimed', 'charge', 'fan', 'summon'], rage: ['rain', 'charge', 'cross', 'summon', 'fan'] },
    { name: 'דרקון העצמות',  hp: 900, attacks: ['ring', 'fan', 'spiral', 'aimed'], rage: ['double', 'ring', 'rain', 'cross', 'aimed'] },
    { name: 'דרקון הקריסטל', hp: 1050, attacks: ['ring', 'summon', 'fan', 'charge', 'aimed'], rage: ['cross', 'ring', 'double', 'charge', 'rain'] },
    { name: 'דרקון הסערה',   hp: 1200, attacks: ['spiral', 'fan', 'summon', 'ring', 'charge', 'aimed'], rage: ['double', 'rain', 'cross', 'charge', 'summon', 'ring'] },
  ];
  // Enemy dragons are bright and warm against the dark ground, each world in its own colours.
  const DRAGONS = [
    { c: '#FFE14A', dark: '#A87A00', belly: '#FFF8D0', wing: '#FF9A2A', horn: '#FFFFFF' },
    { c: '#FF5FB0', dark: '#9E1A5E', belly: '#FFE0F0', wing: '#C77DFF', horn: '#FFFFFF' },
    { c: '#5AA8FF', dark: '#1A4FA8', belly: '#E0EEFF', wing: '#9AD0FF', horn: '#FFFFFF' },
    { c: '#FF8A2A', dark: '#A84400', belly: '#FFE6C8', wing: '#FFC24A', horn: '#FFFFFF' },
    { c: '#FF3D5A', dark: '#9E0A24', belly: '#FFE0E6', wing: '#FFB03D', horn: '#FFE95C' },
  ];
  const KILL_PCT = 80, HP_CHAL = 70; // challenges: beat 80% of the dragons; finish with 70% health or more

  // ---------- Level scripts: the same waves every time you play a level ----------
  function mulberry(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function buildScript(w, l, cfg) {
    const rnd = mulberry((w + 1) * 1009 + l * 131 + 17);
    const g = w * 5 + l;
    const len = cfg.len;
    const gap = w === 0 ? 3.6 - l * 0.08 : clamp(3.0 - g * 0.06, 1.75, 3.0);
    const kinds = ['line', 'vee', 'snake', 'swoop'];
    if (g >= 1) kinds.push('shooters', 'pincer', 'splitters');
    if (g >= 2) kinds.push('brute');
    if (g >= 4) kinds.push('caster');
    if (g >= 8) kinds.push('brute');
    if (g >= 2) kinds.push('rain', 'divers');
    if (g >= 3) kinds.push('shooters');
    if (g >= 4) kinds.push('wall');
    if (g >= 6) kinds.push('bomber', 'divers');
    const tanks = cfg.bossFight ? [] : g === 0 ? [0.6] : [0.4, 0.8];
    const ev = [];
    let t = cfg.bossFight ? len : 2, ti = 0, last = '';
    while (t < len) {
      let type;
      if (ti < tanks.length && t >= tanks[ti] * len) { type = 'tank'; ti++; }
      else { do type = kinds[Math.floor(rnd() * kinds.length)]; while (type === last); }
      last = type;
      ev.push({ t, type, side: rnd() < 0.5 ? -1 : 1, x: 70 + rnd() * 220, seed: Math.floor(rnd() * 1e9) });
      t += gap * (type === 'tank' ? 2.1 : ['shooters', 'bomber', 'brute', 'caster'].includes(type) ? 1.5 : 1) * (0.85 + rnd() * 0.3);
    }
    let foes = 0, coins = 0;
    for (const e of ev) for (const s of formation(e, w)) { foes++; coins += s.coins; }
    if (cfg.bossFight) coins += BOSS_COINS;
    Object.assign(cfg, { script: ev, foes, coins, coinGoal: Math.max(5, Math.round(coins * 0.6)) });
  }
  // The enemies of one wave: what they are, how they move, when they show up.
  function formation(ev, w) {
    const rnd = mulberry(ev.seed || 1);
    const sp = 1 + w * 0.09; // enemies get a little quicker world by world
    const out = [];
    const A = (o) => out.push({ kind: 'small', coins: 1, delay: 0, ...o });
    const B = (o) => out.push({ kind: 'spit', coins: 2, delay: 0, ...o });
    switch (ev.type) {
      case 'line': {
        const n = w >= 2 ? 6 : 5;
        for (let i = 0; i < n; i++) A({ mv: 'down', x0: 40 + i * (280 / (n - 1)), y0: -30, v: 72 * sp, amp: 12, f: 2, ph: i, delay: i * 0.1 });
        break;
      }
      case 'vee':
        for (let i = 0; i < 5; i++) A({ mv: 'down', x0: 180 + (i - 2) * 58, y0: -30, v: 82 * sp, amp: 0, f: 0, ph: 0, delay: Math.abs(i - 2) * 0.28 });
        break;
      case 'snake': {
        const x0 = clamp(ev.x, 95, 265);
        for (let i = 0; i < 7; i++) A({ mv: 'down', x0, y0: -30, v: 88 * sp, amp: 72, f: 2.1, ph: 0, delay: i * 0.3 });
        break;
      }
      case 'swoop': {
        const s = ev.side, y = 50 + rnd() * 70;
        for (let i = 0; i < 5; i++) {
          A({ mv: 'swoop', p0: [s < 0 ? -30 : VW + 30, y], p1: [180, 420 + rnd() * 40], p2: [s < 0 ? VW + 40 : -40, 150 + rnd() * 90],
            dur: 4.4 / sp, delay: i * 0.36, face: true });
        }
        break;
      }
      case 'rain': {
        const n = 6 + Math.min(4, w);
        for (let i = 0; i < n; i++) A({ mv: 'fall', x0: 30 + rnd() * 300, y0: -30, v: (165 + rnd() * 30) * sp, vx: (rnd() - 0.5) * 28, delay: i * 0.5 });
        break;
      }
      case 'shooters': {
        const n = w >= 2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          B({ mv: 'hover', x0: n === 2 ? 110 + i * 140 : 70 + i * 110, y0: -36, stop: 100 + (i % 2) * 55, tin: 1.5, hold: 5.5, v: 95,
            amp: 18, delay: i * 0.4, every: 2.5 - w * 0.12 });
        }
        break;
      }
      case 'pincer': {
        // a group from each side at once
        for (const s of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            A({ mv: 'swoop', p0: [s < 0 ? -30 : VW + 30, 70 + i * 12], p1: [180 + s * -20, 380], p2: [s < 0 ? VW + 40 : -40, 120 + rnd() * 60],
              dur: 4.6 / sp, delay: i * 0.4, face: true });
          }
        }
        break;
      }
      case 'divers': {
        // they stop at the top, shake, then dive straight at where the monster is
        const n = 3 + Math.min(2, w);
        for (let i = 0; i < n; i++) A({ mv: 'dive', x0: 50 + (i + 0.5) * (260 / n) + rnd() * 20, y0: -30, stop: 70 + rnd() * 60, tin: 0.9, hold: 0.7 + i * 0.35, v: 250 * sp, delay: i * 0.15 });
        break;
      }
      case 'wall': {
        for (let i = 0; i < 7; i++) A({ mv: 'down', x0: 28 + i * 50.6, y0: -30, v: 55 * sp, amp: 8, f: 1.5, ph: i * 0.6, delay: 0 });
        break;
      }
      case 'brute': {
        // armoured giants: slow, and they take a lot of hits
        const n = w >= 2 ? 2 : 1;
        for (let i = 0; i < n; i++) A({ mv: 'down', brute: true, x0: n === 1 ? clamp(ev.x, 90, 270) : 100 + i * 160, y0: -50, v: 34 * sp, amp: 18, f: 0.8, ph: i * 2, delay: i * 0.8, coins: 4 });
        break;
      }
      case 'splitters':
        // when one is beaten it splits into two small dragons
        for (let i = 0; i < 3; i++) A({ mv: 'down', splitter: true, x0: 180 + (i - 1) * 95, y0: -40, v: 58 * sp, amp: 10, f: 1.4, ph: i, delay: Math.abs(i - 1) * 0.4, coins: 2 });
        break;
      case 'caster':
        // a magic dragon that stops and shoots rings of shots
        B({ mv: 'hover', caster: true, x0: clamp(ev.x, 90, 270), y0: -50, stop: 120, tin: 1.6, hold: 7, v: 80, amp: 50, every: 3.0 - w * 0.1, coins: 4 });
        break;
      case 'bomber':
        B({ mv: 'hover', bomber: true, x0: 70 + rnd() * 220, y0: -50, stop: 90 + rnd() * 50, tin: 1.8, hold: 6, v: 80, amp: 60, every: 1.9 - w * 0.05, coins: 4 });
        break;
      case 'tank':
        B({ mv: 'hover', tank: true, x0: clamp(ev.x, 110, 250), y0: -60, stop: 150, tin: 2.4, hold: 9, v: 70, amp: 40, every: 1.7 - w * 0.06, coins: 6 });
        break;
      default: break;
    }
    return out;
  }
  const BOSS_COINS = 16;
  WORLDS.forEach((wd, w) => wd.levels.forEach((cfg, l) => buildScript(w, l, cfg)));

  const CHALS = [
    { bit: 1, icon: '🎯', label: () => `${KILL_PCT}%` },
    { bit: 2, icon: '🪙', label: (cfg) => `${cfg.coinGoal}` },
    { bit: 4, icon: '❤️', label: () => `${HP_CHAL}%` },
  ];
  const goalText = (cfg) => (cfg.bossFight ? 'מביסים את הדרקון' : `<bdi>${cfg.foes}</bdi> דרקונים בדרך`);

  // ---------- Pictures for the menus (drawn once, from the same code as the game) ----------
  const iconCache = {};
  function paintURL(key, w, h, draw) {
    if (!iconCache[key]) {
      const s = document.createElement('canvas');
      s.width = w; s.height = h;
      draw(s.getContext('2d'));
      iconCache[key] = s.toDataURL();
    }
    return iconCache[key];
  }
  const headURL = (id) => paintURL(`h-${id}`, 160, 160, (c) => { c.translate(80, 84); c.scale(5.6, 5.6); drawHead(c, id, 0, 0, 0, 0, 0); });
  const bossURL = (w) => paintURL(`b-${w}`, 240, 250, (c) => { c.translate(120, 132); c.scale(1.18, 1.18); drawBoss(c, w, 0.4, null, 0.72); });
  const heroURL = (heads) => paintURL(`hero-${heads.join()}`, 200, 200, (c) => { c.translate(100, 112); c.scale(1.6, 1.6); drawHydra(c, 0, 0, heads, 0.3, {}); });
  const specialURL = (id) => paintURL(`s-${id}`, 120, 120, (c) => { c.translate(60, 60); c.scale(2.2, 2.2); drawSpecialIcon(c, id); });
  const MAP = { banner: (w) => `assets/hworld-${w + 1}.svg`, boss: bossURL };
  // The prize of a world is a new head.
  const prize = (id) => ({ src: headURL(id), title: `${HEADS[id].name} גדל!`, line: HEADS[id].perk });
  const headsList = () => HEAD_ORDER.filter((h) => h === 'fire' || rec().unlocked.includes(h));
  // The heads you take along: the ones you've grown and switched on (at least one).
  const MAX_HEADS = 3;
  const activeHeads = () => {
    const r = rec(), all = headsList();
    if (!Array.isArray(r.active)) return all.slice(0, MAX_HEADS);
    const on = all.filter((h) => r.active.includes(h)).slice(0, MAX_HEADS);
    return on.length ? on : [all[0]];
  };
  // r.active keeps the order the heads were picked in, so the oldest pick is the one that makes room.
  const picked = () => {
    const r = rec(), all = headsList();
    return Array.isArray(r.active) ? r.active.filter((h) => all.includes(h)).slice(-MAX_HEADS) : all.slice(0, MAX_HEADS);
  };
  function toggleHead(id) {
    const r = rec();
    let act = picked();
    if (act.includes(id)) {
      if (act.length === 1) return false; // the last head stays
      act = act.filter((h) => h !== id);
      r.active = act; store.save();
      return 'off';
    }
    act.push(id);
    const out = act.length > MAX_HEADS ? act.shift() : null;
    r.active = act; store.save();
    return out || 'on';
  }
  // A new head from a boss: it takes the place of the head you choose (or just joins if there's room).
  function swapHead(newId, oldId) {
    const r = rec();
    let act = picked().filter((h) => h !== newId);
    if (oldId) act = act.filter((h) => h !== oldId);
    act.push(newId);
    r.active = act.slice(-MAX_HEADS); store.save();
  }

  // ---------- Canvas ----------
  const cv = $('#hcv');
  const ctx = cv.getContext('2d');
  let RES = 1, sprites = {}, tileCv = null, vignette = null;
  function sprite(name, w, h) {
    const key = `${name}@${w}x${h}`;
    if (!sprites[key]) {
      const s = document.createElement('canvas');
      s.width = Math.max(1, Math.ceil(w * RES)); s.height = Math.max(1, Math.ceil(h * RES));
      if (images[name]) s.getContext('2d').drawImage(images[name], 0, 0, s.width, s.height);
      sprites[key] = s;
    }
    return sprites[key];
  }
  function resize() {
    const wrap = $('#boardWrap');
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (W <= 0 || H <= 0) return;
    const s = Math.min(W / VW, H / VH);
    cv.style.width = `${Math.floor(VW * s)}px`;
    cv.style.height = `${Math.floor(VH * s)}px`;
    RES = s * Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(VW * RES); cv.height = Math.round(VH * RES);
    sprites = {};
    const g = core.G();
    if (g && g.mode === 'hydra') buildTile(g);
  }
  // The ground far below: one picture that repeats as it scrolls. Toned down and dark, so the fight stands out.
  function buildTile(g) {
    tileCv = document.createElement('canvas');
    tileCv.width = Math.round(VW * RES); tileCv.height = Math.round(VH * RES);
    const c = tileCv.getContext('2d'), img = images[g.world.bg];
    if (img) { c.filter = 'saturate(0.85) brightness(0.88)'; c.drawImage(img, 0, 0, tileCv.width, tileCv.height); c.filter = 'none'; }
    else { c.fillStyle = '#1A1428'; c.fillRect(0, 0, tileCv.width, tileCv.height); }
    vignette = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VH * 0.75);
    vignette.addColorStop(0, 'rgba(8,4,16,0)'); vignette.addColorStop(1, 'rgba(8,4,16,.55)');
  }

  // ---------- Level start ----------
  let G = null;
  async function start(w, l) {
    const world = WORLDS[w], cfg = world.levels[l], r = rec();
    await core.loadScene(world.bg);
    if (WORLDS[w + 1]) core.loadScene(WORLDS[w + 1].bg);
    const key = `${w + 1}-${l + 1}`;
    const help = (r.streak[key] || 0) >= 3 ? 0.85 : 1; // a little quiet help after 3 losses in a row
    const boss = !!cfg.bossFight;
    const heads = activeHeads();
    const special = SPECIALS[r.special] && (r.special === 'roar' || (r.specials || []).includes(r.special)) ? r.special : 'roar';
    G = {
      mode: 'hydra', w, l, cfg, key, world, help, bossFight: boss, bossInfo: BOSSES[w],
      ch: { src: heroURL(heads) },
      hp: 100, maxHp: 100, score: 0, coins: 0, kills: 0, spawned: 0,
      state: 'ready', readyT: boss ? 3.2 : 2.4, t: 0, playT: 0, st: 0, shownSec: -1, ev: 0,
      P: { x: VW / 2, y: VH + 80, tx: VW / 2, ty: VH - 120, inv: 0, cool: {}, open: {}, heads, dead: 0 },
      lv: Object.fromEntries(heads.map((id) => [id, heroLevel(id)])), boost: 0,
      scorch: [], enemies: [], rocks: [], rockWarn: [], rockT: 6, shots: [], bullets: [], fx: [], pickups: [], particles: [], gusts: [], clouds: [], beam: null, meteors: [],
      motes: [], scroll: 0, special, charge: 0, roarFx: 0, shieldT: 0, freezeT: 0, meteorT: 0,
      shake: 0, flash: 0, boss: null, winT: 0, ending: false, killsSincePower: 0, hudKey: '',
    };
    G.readyMax = G.readyT;
    if (boss) bossEnters(); // it flies in during the intro card and the fight starts with it
    for (let i = 0; i < 26; i++) G.motes.push(newMote(true));
    core.setG(G);
    core.setPaused(false);
    core.hideOverlays();
    const game = $('#game');
    game.dataset.world = `h${w + 1}`;
    core.show('game');
    resize();
    core.buildLives();
    hud(true);
    $('#timerNum').textContent = core.fmtTime(0);
    const b = $('#banner');
    const best = (r.best || {})[key];
    const bestLine = best ? `<small class="best-line">השיא <bdi>${core.fmtTime(best)}</bdi></small>` : '';
    const head = boss
      ? `<div class="ready-world">${world.name}</div><div class="ready-title boss">${BOSSES[w].name}</div>`
      : `<div class="ready-world">${world.name}</div><div class="ready-title">שלב ${l + 1}</div>`;
    const how = [heads.length === 1 ? 'הראש יורה לבד, רק מזיזים את המפלצת' : `${heads.length} ראשים יורים לבד`];
    if (boss) how.push('יורים בדרקון עד שהחיים שלו נגמרים');
    else if (w === 0 && l === 0) how.push('אוספים מטבעות וקונים שדרוגים בחנות');
    const prizeLine = boss ? `<div class="ready-prize"><img src="${headURL(world.unlock)}" alt=""><span>הפרס: <b>${HEADS[world.unlock].name}</b><br><small>${HEADS[world.unlock].perk}</small></span></div>` : '';
    b.innerHTML = `<div class="ready-card">${head}<div class="ready-goal">${goalText(cfg)}</div>${
      how.map((s) => `<div class="ready-how">${s}</div>`).join('')}${prizeLine}${bestLine}${
      core.chalRow(cfg, (r.chal || {})[key] || 0, 0, CHALS)}<div class="ready-bar"><i style="animation-duration:${G.readyT}s"></i></div></div>`;
    b.className = 'banner';
    if (boss) sfx.boss(); else sfx.ready();
    b.hidden = false;
    held.left = held.right = held.up = held.down = false;
    sw.id = null;
    core.keepAwake();
  }

  // ---------- Enemies ----------
  const FOES = { small: { r: 15, hp: 2 }, spit: { r: 18, hp: 6 } };
  const hpK = () => (G.w === 0 ? 0.75 : 1 + G.w * 0.5);
  const EASY = () => (G.w === 0 ? 0.8 : 1); // world 1: slower shots, less damage
  function spawnWave(ev) {
    if (ev.type === 'boss') { bossEnters(); return; }
    for (const s of formation(ev, G.w)) addEnemy(s);
  }
  function addEnemy(s, summon = false) {
    const F = FOES[s.kind];
    const size = s.tank ? 1.85 : s.brute ? 1.65 : s.bomber || s.caster ? 1.4 : s.splitter ? 1.3 : 1;
    const hp = (s.tank ? 36 : s.brute ? 26 : s.caster ? 18 : s.bomber ? 15 : s.splitter ? 8 : F.hp) * hpK() * G.help;
    const e = { ...s, size, r: F.r * size, hp, maxHp: hp, t: -s.delay, x: -200, y: -200, slow: 0, poison: 0,
      flash: 0, push: 0, shootT: (s.every || 2) * rand(0.5, 1), seen: false, summon, anim: Math.random() * 6, rot: 0 };
    if (!summon) G.spawned++;
    place(e);
    G.enemies.push(e);
  }
  // Where an enemy is at its own time e.t (slowed enemies live slower, so they move slower along their path).
  function place(e) {
    const t = Math.max(0, e.t);
    let x = e.x, y = e.y;
    if (e.mv === 'down') { x = e.x0 + e.amp * Math.sin(t * e.f + e.ph); y = e.y0 + e.v * t; }
    else if (e.mv === 'fall') { x = e.x0 + e.vx * t; y = e.y0 + e.v * t; }
    else if (e.mv === 'swoop') {
      const u = t / e.dur, a = 1 - u;
      x = a * a * e.p0[0] + 2 * a * u * e.p1[0] + u * u * e.p2[0];
      y = a * a * e.p0[1] + 2 * a * u * e.p1[1] + u * u * e.p2[1];
      if (u > 1.05) e.gone = true;
    } else if (e.mv === 'dive') {
      if (t < e.tin) { x = e.x0; y = e.y0 + (e.stop - e.y0) * easeOut(t / e.tin); }
      else if (t < e.tin + e.hold) { x = e.x0 + Math.sin(t * 40) * 1.6; y = e.stop; e.warn = true; }
      else {
        if (!e.dir) { const a = Math.atan2(G.P.y - e.stop, G.P.x - e.x0); e.dir = [Math.cos(a), Math.sin(a)]; e.face = true; e.warn = false; }
        const h = t - e.tin - e.hold;
        x = e.x0 + e.dir[0] * e.v * h; y = e.stop + e.dir[1] * e.v * h;
      }
    } else if (e.mv === 'hover') {
      if (t < e.tin) { x = e.x0; y = e.y0 + (e.stop - e.y0) * easeOut(t / e.tin); }
      else if (t < e.tin + e.hold) { const h = t - e.tin; x = e.x0 + e.amp * Math.sin(h * 0.9); y = e.stop + Math.sin(h * 2) * 6; }
      else { const h = t - e.tin - e.hold; x = e.x0 + e.amp * Math.sin(e.hold * 0.9); y = e.stop - e.v * h * h * 0.6; e.leaving = true; }
    }
    if (e.face) { const dx = x - e.x, dy = y - e.y; if (dx * dx + dy * dy > 0.01) e.rot = Math.atan2(dy, dx) - Math.PI / 2; }
    e.x = x; e.y = y + e.push;
  }
  const frozen = () => G.freezeT > 0;
  function updateEnemies(dt) {
    const ts = frozen() ? 0 : 1;
    for (const e of G.enemies) {
      const k = (e.slow > 0 ? 0.4 : 1) * ts;
      e.t += dt * k; e.anim += dt * k;
      if (e.slow > 0) e.slow -= dt;
      if (e.flash > 0) e.flash -= dt;
      e.push *= Math.pow(0.08, dt);
      if (e.t < 0) continue;
      place(e);
      if (!e.seen && e.y > -10 && e.y < VH) e.seen = true;
      if (e.poison > 0) {
        e.poison -= dt;
        hurt(e, e.pdps * dt, true);
        if (Math.random() < dt * 8) G.particles.push({ x: e.x + rand(-e.r, e.r), y: e.y, vx: 0, vy: -30, life: 0.6, max: 0.6, color: '#B6FF6A', size: rand(2, 4), bubble: true });
      }
      // Spitting dragons aim at the monster while they're on the screen.
      if (e.every && e.t > (e.tin || 0) && !e.leaving && e.y > 20 && e.y < VH * 0.6 && ts) {
        e.shootT -= dt * k;
        if (e.shootT <= 0) { e.shootT = e.every / G.help / EASY(); enemyShoot(e); }
      }
      // Bumping into the monster hurts both.
      if (G.state === 'play' && dist(e, G.P) < e.r * 0.75 + 9) { hit(e.tank ? 30 : 22); hurt(e, 4); }
      if (e.y > VH + 50 || (e.y < -140 && e.seen) || e.x < -80 || e.x > VW + 80) e.gone = true;
    }
    G.enemies = G.enemies.filter((e) => !e.gone && !e.dead);
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function enemyShoot(e) {
    const P = G.P, a = Math.atan2(P.y - e.y, P.x - e.x), s = (120 + G.w * 10) * G.help * EASY();
    if (e.caster) { const off = Math.random() * TAU; for (let i = 0; i < 10; i++) bullet(e.x, e.y + 10, off + i * TAU / 10, s * 0.7); e.spat = 0.5; sfx.tone(700, 0.25, 'sine', 0.04, 0, 300); return; }
    if (e.tank || e.bomber) { const n = e.tank && G.w >= 3 ? 5 : 3; for (let i = 0; i < n; i++) bullet(e.x, e.y + e.r * 0.5, a + (i - (n - 1) / 2) * 0.24, s); }
    else bullet(e.x, e.y + e.r * 0.4, a, s);
    e.spat = 0.3;
    sfx.tone(300, 0.08, 'triangle', 0.025, 0, 200);
  }
  function bullet(x, y, a, s, r = 6, dmg = 15) { G.bullets.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r, t: Math.random(), dmg }); }

  // Damage. Kill: coins, sometimes a power-up, and some special charge.
  function hurt(e, dmg, quiet = false) {
    if (e.dead || e.t < 0) return;
    e.hp -= dmg;
    if (!quiet) e.flash = 0.08;
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {
    e.dead = true;
    if (!e.summon) G.kills++;
    const big = e.tank || e.brute || e.caster || e.bomber;
    G.score += e.tank ? 200 : big ? 120 : e.kind === 'spit' ? 40 : 15;
    G.charge = Math.min(1, G.charge + (e.tank ? 0.25 : big ? 0.15 : 0.05));
    if (e.splitter) {
      for (const sd of [-1, 1]) {
        addEnemy({ kind: 'small', coins: 1, delay: 0, mv: 'swoop', p0: [e.x, e.y], p1: [e.x + sd * 90, e.y + 110], p2: [e.x + sd * 170, VH + 70], dur: 2.6, face: true });
      }
      G.fx.push({ type: 'ring', x: e.x, y: e.y, r: 10, t: 0.3, max: 0.3, grow: 40 });
    }
    boom(e.x, e.y, e.r);
    if (!e.summon) for (let i = 0; i < e.coins; i++) drop('coin', e.x + rand(-e.r, e.r) * 0.8, e.y + rand(-e.r, e.r) * 0.8);
    G.killsSincePower++;
    if (e.tank || (big && Math.random() < 0.35) || G.killsSincePower >= 26) { G.killsSincePower = 0; drop('power', e.x, e.y); }
    if (e.tank || (big && G.hp < G.maxHp * 0.7) || (G.hp < G.maxHp * 0.6 && Math.random() < 0.06)) drop('heart', e.x + 18, e.y);
    sfx.tone(big ? 160 : 520, big ? 0.4 : 0.1, big ? 'sawtooth' : 'square', 0.04, 0, big ? 60 : 1300);
  }
  function boom(x, y, r) {
    const n = Math.round(6 + r * 0.6);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, 170);
      G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), max: 0.6,
        color: ['#FFD23F', '#FF9F1C', '#FFFFFF', '#FF6B3A'][i % 4], size: rand(2.5, 5), drag: true, glow: true });
    }
    G.fx.push({ type: 'ring', x, y, r: r * 0.6, t: 0.3, max: 0.3, grow: r * 3 });
  }
  function drop(type, x, y) { G.pickups.push({ type, x, y, vx: rand(-40, 40), vy: rand(-90, -40), t: 0, spin: Math.random() * 6 }); }

  // ---------- The boss ----------
  function bossEnters() {
    const hp = BOSSES[G.w].hp * G.help;
    G.boss = { x: VW / 2, y: -160, hp, max: hp, t: 0, atk: 0, atkT: 1.6, act: null, enter: G.readyT, enterMax: G.readyT, phase: 1, trans: 0, r: 68, flash: 0, charge: null };
    hud(true);
  }
  function updateBoss(dt) {
    const B = G.boss;
    if (!B || B.dead) return;
    if (B.flash > 0) B.flash -= dt;
    if (frozen()) return;
    B.t += dt;
    const homeX = VW / 2 + Math.sin(B.t * 0.55) * 90, homeY = 165 + Math.sin(B.t * 1.3) * 10;
    if (B.enter > 0) {
      B.enter -= dt;
      B.x = homeX; B.y = homeY - 330 * (1 - easeOut(1 - Math.max(0, B.enter) / B.enterMax));
      return;
    }
    if (G.state !== 'play') return;
    if (B.phase === 1 && B.hp <= B.max * 0.5) {
      B.phase = 2; B.trans = 1.8; B.act = null; B.charge = null; B.atk = 0;
      for (const b of G.bullets) { b.dead = true; puff(b.x, b.y); }
      G.shake = 0.9; G.flash = 0.35;
      floatText(VW / 2, VH * 0.45, 'הדרקון זועם!', '#FF6B4A');
      sfx.tone(90, 1.0, 'sawtooth', 0.1, 0, 40); sfx.tone(180, 0.8, 'square', 0.05, 0.1, 70);
    }
    if (B.trans > 0) {
      B.trans -= dt;
      B.x += (VW / 2 - B.x) * Math.min(1, dt * 3) + Math.sin(B.t * 50) * 2; B.y += (150 - B.y) * Math.min(1, dt * 3);
      if (Math.random() < 0.3) G.fx.push({ type: 'ring', x: B.x, y: B.y, r: 40, t: 0.5, max: 0.5, grow: 140 });
      return;
    }
    if (B.charge) {
      // A dive: shakes in place (with a warning), dashes down at the monster, then flies back up.
      const c = B.charge;
      c.t += dt;
      if (c.t < 0.8) { B.x = c.x + Math.sin(c.t * 60) * 3; B.y = c.y; }
      else if (c.t < 1.5) { const k = easeOut((c.t - 0.8) / 0.7); B.x = c.x + (c.tx - c.x) * k; B.y = c.y + (VH * 0.6 - c.y) * k; }
      else if (c.t < 2.6) { const k = easeOut((c.t - 1.5) / 1.1); B.x = c.tx + (homeX - c.tx) * k; B.y = VH * 0.6 + (homeY - VH * 0.6) * k; }
      else B.charge = null;
    } else { B.x += (homeX - B.x) * Math.min(1, dt * 2); B.y += (homeY - B.y) * Math.min(1, dt * 2); }
    if (G.state === 'play' && dist(B, G.P) < B.r * 0.8 + 9) hit(30);
    if (B.act) { runAttack(B, dt); return; }
    B.atkT -= dt * (B.phase === 2 ? 1.45 : 1);
    if (B.atkT <= 0) {
      const list = B.phase === 2 ? BOSSES[G.w].rage : BOSSES[G.w].attacks;
      B.act = { type: list[B.atk % list.length], t: 0, n: 0 };
      B.atk++;
      B.atkT = (2.5 - G.w * 0.12) / G.help;
    }
  }
  function runAttack(B, dt) {
    const a = B.act, P = G.P, s = (115 + G.w * 9) * G.help * EASY() * (B.phase === 2 ? 1.1 : 1);
    a.t += dt;
    const aim = Math.atan2(P.y - B.y, P.x - B.x);
    if (a.type === 'fan') {
      if (a.t > 0.45 && a.n < 2) {
        a.n++;
        const n = 5 + Math.min(2, G.w);
        for (let i = 0; i < n; i++) bullet(B.x, B.y + 52, aim + (i - (n - 1) / 2) * 0.2 + (a.n === 2 ? 0.1 : 0), s);
        sfx.tone(260, 0.15, 'triangle', 0.05, 0, 140);
        a.t = 0.2;
      }
      if (a.n >= 2) B.act = null;
    } else if (a.type === 'aimed') {
      if (a.t > 0.3 + a.n * 0.2 && a.n < 4) { a.n++; bullet(B.x, B.y + 52, aim, s * 1.15, 7); sfx.tone(400, 0.08, 'square', 0.03, 0, 250); }
      if (a.n >= 4) B.act = null;
    } else if (a.type === 'ring') {
      if (a.t > 0.5) {
        const n = 14, off = Math.random() * TAU;
        for (let i = 0; i < n; i++) bullet(B.x, B.y, off + i * TAU / n, s * 0.8);
        sfx.tone(200, 0.3, 'sine', 0.06, 0, 400);
        B.act = null;
      }
    } else if (a.type === 'spiral') {
      while (a.t > 0.3 + a.n * 0.09 && a.n < 22) { const k = a.n++; bullet(B.x, B.y + 10, Math.PI / 2 + Math.sin(k * 0.45) * 1.2, s * 0.85); }
      if (a.n >= 22) B.act = null;
    } else if (a.type === 'summon') {
      if (a.t > 0.5) {
        const cnt = B.phase === 2 ? 5 : 3;
        for (let i = 0; i < cnt; i++) {
          const sd = (i - (cnt - 1) / 2) * (B.phase === 2 ? 0.6 : 1);
          addEnemy({ kind: 'small', coins: 0, delay: i * 0.25, mv: 'swoop', p0: [B.x, B.y + 20], p1: [B.x + sd * 150, VH * 0.75],
            p2: [B.x + sd * 260, -60], dur: 4.2, face: true }, true);
        }
        sfx.tone(600, 0.2, 'triangle', 0.05, 0, 900);
        B.act = null;
      }
    } else if (a.type === 'rain') {
      // fire rains down from the top of the screen
      while (a.t > 0.4 + a.n * 0.11 && a.n < 20) { a.n++; bullet(20 + Math.random() * (VW - 40), -8, Math.PI / 2 + (Math.random() - 0.5) * 0.2, s * 0.85, 6.5); }
      if (a.n === 1) sfx.tone(150, 0.6, 'sawtooth', 0.04, 0, 300);
      if (a.n >= 20) B.act = null;
    } else if (a.type === 'cross') {
      // four streams turning around the boss
      while (a.t > 0.3 + a.n * 0.12 && a.n < 18) { const k = a.n++; for (let q = 0; q < 4; q++) bullet(B.x, B.y + 10, k * 0.22 + q * Math.PI / 2, s * 0.8); }
      if (a.n >= 18) B.act = null;
    } else if (a.type === 'double') {
      // two spirals turning opposite ways
      while (a.t > 0.3 + a.n * 0.08 && a.n < 26) { const k = a.n++; bullet(B.x, B.y + 20, Math.PI / 2 + Math.sin(k * 0.5) * 1.3, s * 0.8); bullet(B.x, B.y + 20, Math.PI / 2 - Math.sin(k * 0.5) * 1.3, s * 0.8); }
      if (a.n >= 26) B.act = null;
    } else if (a.type === 'charge') {
      if (!B.charge) { B.charge = { t: 0, x: B.x, y: B.y, tx: clamp(P.x, 60, VW - 60) }; sfx.tone(120, 0.6, 'sawtooth', 0.05, 0, 240); }
      B.act = null;
    }
  }
  function hurtBoss(dmg) {
    const B = G.boss;
    if (!B || B.dead || B.enter > 0 || B.trans > 0) return;
    B.hp -= dmg; B.flash = 0.07;
    if (B.hp <= 0) { B.hp = 0; B.dead = true; win(); }
  }
  const bossHittable = () => G.boss && !G.boss.dead && G.boss.enter <= 0;

  // ---------- The monster's heads ----------
  // Necks fan out from the shoulders; the first heads get the middle spots. More heads: a wider fan.
  const SPREAD = [0, 0.38, 0.66, 0.86, 1.02, 1.15];
  const neckLen = (a, n) => 22 + n * 1.3 - Math.abs(a) * 4;
  function headSlots(n) {
    const S = SPREAD[n - 1] || 1.15;
    const angs = [...Array(n)].map((_, i) => (n === 1 ? 0 : -S + (2 * S * i) / (n - 1)));
    const order = angs.map((a, i) => i).sort((i, j) => Math.abs(angs[i]) - Math.abs(angs[j]) || angs[i] - angs[j]);
    const slots = new Array(n);
    order.forEach((slot, k) => { slots[k] = angs[slot]; });
    return slots; // slots[k] = angle of the k-th head
  }
  function headGeo(k, n, t) {
    const a = headSlots(n)[k] + Math.sin(t * 2.6 + k * 1.7) * 0.05;
    const len = neckLen(a, n), bx = Math.sin(a) * 8, by = -11;
    return { a, bx, by, hx: bx + Math.sin(a) * len, hy: by - Math.cos(a) * len };
  }
  function headPos(P, k, n, t) {
    const h = headGeo(k, n, t);
    return { x: P.x + h.hx + Math.sin(h.a) * 8, y: P.y + h.hy - Math.cos(h.a) * 8, a: h.a };
  }
  const lvOf = (id) => Math.min(5, (G.lv[id] || 1) + (G.boost > 0 ? 1 : 0));
  function shootHeads(dt) {
    const P = G.P, n = P.heads.length;
    G.beam = null;
    P.heads.forEach((id, k) => {
      const lv = lvOf(id), h = headPos(P, k, n, G.t);
      P.open[id] = Math.max(0, (P.open[id] || 0) - dt * 6);
      if (id === 'ice') { iceBeam(h, lv, dt); P.open[id] = 0.8; return; }
      P.cool[id] = (P.cool[id] == null ? rand(0, 0.2) : P.cool[id]) - dt;
      if (P.cool[id] > 0) return;
      P.open[id] = 1;
      const S = (x, y, a, sp, o) => G.shots.push({ id, x, y, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp, t: 0, ...o });
      if (id === 'fire') {
        P.cool[id] += 0.2;
        const big = lv >= 4, dmg = big ? 1.4 : 1.1, r = big ? 7.5 : 6;
        const pat = lv === 1 ? [[0, 0]] : lv === 2 ? [[-6, 0], [6, 0]] : lv === 3 ? [[0, 0], [-3, -0.13], [3, 0.13]]
          : lv === 4 ? [[-5, 0], [5, 0], [-3, -0.16], [3, 0.16]] : [[0, 0], [-5, -0.1], [5, 0.1], [-3, -0.22], [3, 0.22]];
        for (const [ox, a] of pat) S(h.x + ox, h.y, a, 560, { dmg, r });
        if ((G.shotSound = !G.shotSound)) sfx.tone(180, 0.06, 'sawtooth', 0.012, 0, 90);
      } else if (id === 'poison') {
        P.cool[id] += Math.max(0.5, 1.0 - lv * 0.1);
        S(h.x, h.y, h.a * 0.25, 300, { glob: true, fuse: 0.55, lv, r: 7 });
        if (lv >= 4) S(h.x, h.y, h.a * 0.25 + 0.3, 300, { glob: true, fuse: 0.5, lv, r: 7 });
        sfx.tone(240, 0.12, 'sine', 0.03, 0, 520);
      } else if (id === 'bolt') {
        P.cool[id] += Math.max(0.55, 1.1 - lv * 0.12);
        zap(h, 1 + lv, 2 + lv * 0.4);
      } else if (id === 'wind') {
        P.cool[id] += Math.max(0.5, 0.8 - lv * 0.06);
        G.gusts.push({ x: h.x, y: h.y - 6, vy: -340, life: 0.9, w: 44 + lv * 10, dmg: 0.7 * lv, hit: new Set() });
        sfx.tone(500, 0.18, 'sine', 0.012, 0, 260);
      } else if (id === 'star') {
        P.cool[id] += Math.max(0.35, 0.55 - lv * 0.04);
        const cnt = lv >= 5 ? 3 : lv >= 3 ? 2 : 1, sp = lv >= 2 ? 380 : 320;
        for (let i = 0; i < cnt; i++) S(h.x, h.y, h.a * 0.8 + (i - (cnt - 1) / 2) * 0.5, sp, { dmg: 1.5, home: true, life: 2.4, spin: 0, r: 6, trail: [] });
      }
    });
  }
  // Ice: a beam straight up from the ice head. It hits the first enemy in its way (from level 3 it goes through all of them).
  function iceBeam(h, lv, dt) {
    const wdt = 4 + lv * 1.4, dps = 3.5 + lv * 1.8, pierce = lv >= 3;
    const inLine = G.enemies.filter((e) => !e.dead && e.t >= 0 && e.y < h.y && e.y > -20 && Math.abs(e.x - h.x) < e.r + wdt / 2)
      .sort((a, b) => b.y - a.y);
    let end = -10;
    const targets = pierce ? inLine : inLine.slice(0, 1);
    if (!pierce && inLine.length) end = inLine[0].y + inLine[0].r * 0.3;
    for (const e of targets) { hurt(e, dps * dt, true); e.slow = Math.max(e.slow, 0.5); if (Math.random() < dt * 10) e.flash = 0.04; }
    const B = G.boss;
    if (bossHittable() && Math.abs(B.x - h.x) < B.r && B.y < h.y && (pierce || !inLine.length)) {
      hurtBoss(dps * dt);
      if (!pierce) end = Math.max(end, B.y + B.r * 0.5);
    }
    G.beam = { x: h.x, y0: h.y, y1: end, w: wdt, hit: end > -10 };
  }
  // Lightning: hits the closest enemy (or the boss), then jumps on to the next closest ones.
  function zap(from, jumps, dmg) {
    const pts = [{ x: from.x, y: from.y }];
    let at = from;
    const done = new Set();
    for (let j = 0; j < jumps; j++) {
      let best = null, bd = j === 0 ? 330 : 130;
      for (const e of G.enemies) {
        if (e.dead || e.t < 0 || done.has(e) || e.y < -10) continue;
        const d = dist(e, at);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best && bossHittable() && j === 0 && dist(G.boss, at) < 420) {
        pts.push({ x: G.boss.x + rand(-20, 20), y: G.boss.y + rand(-10, 20) });
        hurtBoss(dmg * 1.5);
        break;
      }
      if (!best) break;
      done.add(best);
      pts.push({ x: best.x, y: best.y });
      hurt(best, dmg);
      at = best;
    }
    if (pts.length > 1) {
      G.fx.push({ type: 'bolt', pts, t: 0.2, max: 0.2, seed: Math.random() * 100 });
      sfx.tone(1400, 0.06, 'sawtooth', 0.02, 0, 500);
    }
  }
  function popGlob(s) {
    s.dead = true;
    G.clouds.push({ x: s.x, y: s.y, r: 30 + s.lv * 7, life: 2.2, max: 2.2, dps: 1.6 + s.lv * 0.9 });
    for (let i = 0; i < 10; i++) G.particles.push({ x: s.x, y: s.y, vx: rand(-90, 90), vy: rand(-90, 60), life: 0.4, max: 0.4, color: '#B6FF6A', size: rand(2, 4), drag: true, glow: true });
    sfx.tone(160, 0.2, 'sine', 0.04, 0, 90);
  }
  function updateShots(dt) {
    for (const s of G.shots) {
      s.t += dt;
      if (s.home) {
        s.life -= dt;
        s.spin += dt * 8;
        s.trail.push(s.x, s.y); if (s.trail.length > 12) s.trail.splice(0, 2);
        const tgt = nearestFoe(s);
        if (tgt) {
          const want = Math.atan2(tgt.y - s.y, tgt.x - s.x), cur = Math.atan2(s.vy, s.vx);
          let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          const na = cur + clamp(d, -5.5 * dt, 5.5 * dt), sp = Math.hypot(s.vx, s.vy);
          s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
        }
        if (s.life <= 0) s.dead = true;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.glob) { s.fuse -= dt; s.vx *= Math.pow(0.4, dt); s.vy *= Math.pow(0.4, dt); if (s.fuse <= 0) { popGlob(s); continue; } }
      if (s.y < -20 || s.y > VH + 20 || s.x < -20 || s.x > VW + 20) { s.dead = true; continue; }
      const r = s.r || 5;
      const B = G.boss;
      if (bossHittable() && Math.abs(s.x - B.x) < B.r + r && Math.abs(s.y - B.y) < B.r * 0.85 + r) {
        if (s.glob) { popGlob(s); continue; }
        s.dead = true; hurtBoss(s.dmg); sparkHit(s); continue;
      }
      for (const e of G.enemies) {
        if (e.dead || e.t < 0) continue;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (e.r + r) ** 2) {
          if (s.glob) { popGlob(s); break; }
          s.dead = true;
          hurt(e, s.dmg);
          sparkHit(s);
          break;
        }
      }
    }
    G.shots = G.shots.filter((s) => !s.dead);
    for (const cl of G.clouds) {
      cl.life -= dt;
      for (const e of G.enemies) if (!e.dead && e.t >= 0 && dist(e, cl) < cl.r + e.r * 0.5) { e.poison = 0.6; e.pdps = cl.dps; }
      if (bossHittable() && dist(G.boss, cl) < cl.r + G.boss.r * 0.6) hurtBoss(cl.dps * dt * 0.8);
    }
    G.clouds = G.clouds.filter((cl) => cl.life > 0);
    for (const g of G.gusts) {
      g.life -= dt; g.y += g.vy * dt;
      for (const b of G.bullets) if (Math.abs(b.x - g.x) < g.w / 2 && Math.abs(b.y - g.y) < 18) { b.dead = true; puff(b.x, b.y); }
      for (const e of G.enemies) {
        if (e.dead || e.t < 0 || g.hit.has(e)) continue;
        if (Math.abs(e.x - g.x) < g.w / 2 + e.r && Math.abs(e.y - g.y) < 18 + e.r) { g.hit.add(e); e.push -= 26; hurt(e, g.dmg); }
      }
      const B = G.boss;
      if (bossHittable() && !g.hit.has(B) && Math.abs(B.x - g.x) < g.w / 2 + B.r && Math.abs(B.y - g.y) < 18 + B.r * 0.8) { g.hit.add(B); hurtBoss(g.dmg); }
    }
    G.gusts = G.gusts.filter((g) => g.life > 0 && g.y > -30);
  }
  function nearestFoe(s) {
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      if (e.dead || e.t < 0 || e.y < 0) continue;
      const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best && bossHittable()) best = G.boss;
    return best;
  }
  const SPARK = { fire: ['#FFF1A0', '#FF8A1C'], star: ['#FFFFFF', '#C9A8FF'] };
  function sparkHit(s) {
    const cols = SPARK[s.id] || ['#FFFFFF'];
    for (let i = 0; i < 4; i++) G.particles.push({ x: s.x, y: s.y, vx: rand(-90, 90), vy: rand(-70, 40), life: 0.25, max: 0.25, color: cols[i % 2], size: rand(1.5, 3), glow: true });
  }
  function puff(x, y) {
    for (let i = 0; i < 4; i++) G.particles.push({ x, y, vx: rand(-50, 50), vy: rand(-80, -20), life: 0.35, max: 0.35, color: 'rgba(255,255,255,.9)', size: rand(2, 3.5) });
  }

  // ---------- The monster ----------
  function hit(dmg = 20) {
    const P = G.P;
    if (P.inv > 0 || G.shieldT > 0 || G.state !== 'play') return;
    G.hp = Math.max(0, G.hp - dmg * G.help * EASY());
    core.buildLives();
    P.inv = 1.1; G.shake = 0.3; G.flash = 0.15; G.hurtT = 0.5;
    // A short moment to recover: enemy shots right around the monster pop.
    for (const b of G.bullets) if (dist(b, P) < 90) { b.dead = true; puff(b.x, b.y); }
    for (let i = 0; i < 12; i++) G.particles.push({ x: P.x, y: P.y, vx: rand(-150, 150), vy: rand(-150, 100), life: 0.5, max: 0.5, color: ['#FFFFFF', '#FF4D6D', '#8A6CFF'][i % 3], size: rand(3, 5), drag: true });
    floatText(P.x + 24, P.y - 30, `-${Math.round(dmg * G.help * EASY())}`, '#FF6B7A');
    sfx.ouch();
    if (G.hp <= 0) { G.state = 'dying'; P.dead = 0.001; core.lose(); }
  }
  function updatePlayer(dt) {
    const P = G.P;
    if (P.inv > 0) P.inv -= dt;
    if (G.state === 'play') {
      const vx = (held.right ? 1 : 0) - (held.left ? 1 : 0), vy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (vx || vy) { const m = Math.hypot(vx, vy); P.tx += vx / m * 270 * dt; P.ty += vy / m * 270 * dt; }
      P.tx = clamp(P.tx, 22, VW - 30); P.ty = clamp(P.ty, VH * 0.3, VH - 40);
    }
    const k = Math.min(1, dt * 20);
    P.x += (P.tx - P.x) * k; P.y += (P.ty - P.y) * k;
  }

  // ---------- Things to avoid: a few slow floating hazards, a different kind in every world ----------
  // They can't be destroyed; our shots break on them (the beam, lightning and wind pass by).
  function updateRocks(dt) {
    const ts = frozen() ? 0 : 1;
    if (!G.ending) {
      G.rockT -= dt * ts;
      if (G.rockT <= 0) {
        G.rockT = (G.bossFight ? 11 : 7.5) - G.w * 0.5 + rand(0, 3);
        G.rockWarn.push({ x: rand(40, VW - 50), t: 1.4, max: 1.4 });
        sfx.tone(880, 0.08, 'square', 0.025); sfx.tone(880, 0.08, 'square', 0.025, 0.16);
      }
    }
    for (const wn of G.rockWarn) {
      wn.t -= dt * ts;
      if (wn.t <= 0) { wn.dead = true; G.rocks.push({ x: wn.x, y: -40, vx: 0, vy: 210 + G.w * 12, r: 22, rot: 0, spin: 3 * (Math.random() < 0.5 ? -1 : 1), t: 0 }); sfx.tone(160, 0.5, 'sawtooth', 0.04, 0, 60); }
    }
    G.rockWarn = G.rockWarn.filter((wn) => !wn.dead);
    const P = G.P;
    for (const k of G.rocks) {
      k.t += dt; k.x += k.vx * dt * ts; k.y += k.vy * dt * ts; k.rot += k.spin * dt * ts;
      if (k.y > VH + 40) k.dead = true;
      if (G.state === 'play' && !k.hitIt && dist(k, P) < k.r * 0.85 + 8) { hit(25); k.hitIt = true; }
      for (const s of G.shots) {
        if (!s.dead && (s.x - k.x) ** 2 + (s.y - k.y) ** 2 < (k.r + (s.r || 5)) ** 2) {
          if (s.glob) popGlob(s);
          else {
            s.dead = true;
            for (let i = 0; i < 3; i++) G.particles.push({ x: s.x, y: s.y, vx: rand(-120, 120), vy: rand(20, 120), life: 0.25, max: 0.25, color: '#FFFFFF', size: rand(1.2, 2.2), glow: true });
            k.ting = 0.12;
          }
        }
      }
      if (k.ting > 0) k.ting -= dt;
    }
    G.rocks = G.rocks.filter((k) => !k.dead);
  }
  // A mine: a big glowing spiked ball with a yellow-and-black warning ring. It can't be destroyed.
  function drawRock(c, k) {
    const r = k.r, pulse = 0.5 + 0.5 * Math.sin(k.t * 10);
    c.save(); c.translate(k.x, k.y);
    // a streak behind it, and a hot glow
    c.save(); c.globalCompositeOperation = 'lighter';
    const tr = c.createLinearGradient(0, -r * 5, 0, 0); tr.addColorStop(0, 'rgba(255,60,40,0)'); tr.addColorStop(1, 'rgba(255,80,40,.45)');
    c.fillStyle = tr; c.fillRect(-r * 0.7, -r * 5, r * 1.4, r * 5);
    c.beginPath(); c.arc(0, 0, r * (1.8 + pulse * 0.3), 0, TAU); c.fillStyle = 'rgba(255,60,40,.22)'; c.fill(); c.restore();
    c.rotate(k.rot);
    c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = 2.2;
    for (let i = 0; i < 8; i++) {
      c.save(); c.rotate(i / 8 * TAU);
      c.beginPath(); c.moveTo(-r * 0.3, -r * 0.82); c.lineTo(0, -r * 1.45); c.lineTo(r * 0.3, -r * 0.82); c.closePath();
      c.fillStyle = '#FFD23F'; c.fill(); c.stroke(); c.restore();
    }
    // the warning ring: yellow and black stripes
    for (let i = 0; i < 12; i++) {
      c.beginPath(); c.arc(0, 0, r * 0.86, i / 12 * TAU, (i + 1) / 12 * TAU); c.arc(0, 0, r * 0.6, (i + 1) / 12 * TAU, i / 12 * TAU, true); c.closePath();
      c.fillStyle = i % 2 ? '#14100A' : '#FFD23F'; c.fill();
    }
    c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, r * 0.6, 0, TAU); c.fillStyle = '#C0121E'; c.fill(); c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.beginPath(); c.arc(0, 0, r * (0.36 + pulse * 0.1), 0, TAU); c.fillStyle = '#FF6A3A'; c.fill();
    c.beginPath(); c.arc(0, 0, r * 0.16, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); c.restore();
    c.restore();
  }
  // Before a mine comes: its lane down the screen flashes red, with arrows running down it.
  function drawRockWarn(c) {
    for (const wn of G.rockWarn) {
      const k = 1 - wn.t / wn.max, w = 60, blink = Math.floor(wn.t * 8) % 2 ? 0.35 : 1;
      c.save(); c.translate(wn.x, 0);
      c.fillStyle = `rgba(255,40,60,${(0.1 + 0.12 * k) * blink})`; c.fillRect(-w / 2, 0, w, VH);
      c.strokeStyle = `rgba(255,80,90,${0.7 * blink})`; c.lineWidth = 2; c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, VH); c.moveTo(w / 2, 0); c.lineTo(w / 2, VH); c.stroke(); c.setLineDash([]);
      c.strokeStyle = `rgba(255,120,120,${0.6 * blink})`; c.lineWidth = 3; c.lineCap = 'round';
      for (let y = ((G.t * 220) % 70) - 70; y < VH; y += 70) { c.beginPath(); c.moveTo(-9, y); c.lineTo(0, y + 9); c.lineTo(9, y); c.stroke(); }
      if (blink === 1) {
        c.beginPath(); c.moveTo(0, 6); c.lineTo(15, 32); c.lineTo(-15, 32); c.closePath();
        c.fillStyle = '#FFD23F'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
        c.font = `19px ${FONT}`; c.textAlign = 'center'; c.fillStyle = INK; c.fillText('!', 0, 30);
      }
      c.restore();
    }
  }

  // ---------- Pickups ----------
  function updatePickups(dt) {
    const P = G.P;
    for (const p of G.pickups) {
      p.t += dt; p.spin += dt * 5;
      const d = dist(p, P);
      if (G.state === 'play' && (d < 130 || G.ending) && p.t > 0.35) {
        const sp = G.ending ? 520 : 420;
        p.vx = (P.x - p.x) / Math.max(1, d) * sp; p.vy = (P.y - p.y) / Math.max(1, d) * sp;
      } else { p.vx *= Math.pow(0.2, dt); p.vy = Math.min(80, p.vy + 260 * dt); }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (G.state === 'play' && d < 28) { p.dead = true; collect(p); }
      if (p.y > VH + 20) p.dead = true;
    }
    G.pickups = G.pickups.filter((p) => !p.dead);
  }
  function collect(p) {
    const P = G.P;
    if (p.type === 'coin') {
      G.coins++; G.score += 5;
      sfx.tone(1320 + (G.coins % 4) * 110, 0.06, 'triangle', 0.035);
    } else if (p.type === 'power') {
      G.boost = Math.max(G.boost, 0) + 14;
      floatText(P.x, P.y - 50, 'כל הנשקים +1!', '#FFD23F');
      sfx.power();
    } else if (p.type === 'heart') {
      G.hp = Math.min(G.maxHp, G.hp + 30); core.buildLives();
      floatText(P.x, P.y - 50, '+30 חיים', '#7FE08A');
      sfx.power();
    }
  }

  // ---------- The special power ----------
  const SPECIAL_BTN = { x: 40, y: VH - 42, r: 26 };
  function useSpecial() {
    if (G.state !== 'play' || G.charge < 1) return;
    G.charge = 0;
    const sp = G.special;
    for (const id of G.P.heads) G.P.open[id] = 2;
    if (sp === 'roar') {
      G.roarFx = 0.9; G.shake = 0.5; G.flash = 0.3;
      for (const b of G.bullets) { b.dead = true; puff(b.x, b.y); }
      for (const e of G.enemies) if (e.t >= 0 && e.y > -20) hurt(e, 12 * hpK());
      if (bossHittable()) hurtBoss(G.boss.max * 0.07);
      sfx.tone(110, 0.7, 'sawtooth', 0.09, 0, 55); sfx.tone(220, 0.5, 'square', 0.04, 0.05, 90);
    } else if (sp === 'shield') {
      G.shieldT = 6;
      sfx.tone(440, 0.5, 'sine', 0.07, 0, 880);
    } else if (sp === 'freeze') {
      G.freezeT = 4; G.flash = 0.2;
      sfx.tone(1800, 0.6, 'sine', 0.05, 0, 600);
    } else if (sp === 'meteor') {
      G.meteorT = 3.4; G.meteorNext = 0.35; G.meteorMax = 3.4;
      G.shake = 0.4;
      floatText(VW / 2, VH * 0.4, 'גשם מטאורים!', '#FFB020');
      sfx.tone(70, 1.4, 'sawtooth', 0.08, 0, 35); sfx.tone(140, 1.2, 'square', 0.03, 0.1, 50);
    }
  }
  function updateSpecials(dt) {
    if (G.shieldT > 0) { G.shieldT -= dt; for (const b of G.bullets) if (dist(b, G.P) < 40) { b.dead = true; puff(b.x, b.y); } }
    if (G.freezeT > 0) G.freezeT -= dt;
    if (G.meteorT > 0) {
      G.meteorT -= dt; G.meteorNext -= dt;
      if (G.meteorNext <= 0) {
        G.meteorNext = 0.1;
        const live = G.enemies.filter((e) => !e.dead && e.t >= 0 && e.y > 0 && e.y < VH);
        const tg = live.length && Math.random() < 0.7 ? live[Math.floor(Math.random() * live.length)]
          : bossHittable() && Math.random() < 0.6 ? { x: G.boss.x + rand(-40, 40), y: G.boss.y + rand(-20, 30) } : { x: rand(20, VW - 20), y: rand(60, VH * 0.6) };
        const big = Math.random() < 0.35;
        G.meteors.push({ x: tg.x + rand(90, 160), y: tg.y - rand(300, 380), tx: tg.x + rand(-10, 10), ty: tg.y + rand(-10, 10), t: 0, dur: rand(0.5, 0.65), r: big ? rand(15, 19) : rand(10, 13), rot: Math.random() * 6 });
      }
    }
    for (const m of G.meteors) {
      m.t += dt;
      if (m.t >= m.dur) {
        m.dead = true;
        const R = 40 + m.r * 2;
        boom(m.tx, m.ty, m.r * 2.4);
        G.fx.push({ type: 'blast', x: m.tx, y: m.ty, r: R, t: 0.45, max: 0.45 });
        G.scorch.push({ x: m.tx, y: m.ty, r: m.r * 1.6, t: 4 });
        for (let i = 0; i < 10; i++) { const a = rand(0, TAU), sp = rand(80, 220); G.particles.push({ x: m.tx, y: m.ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, color: ['#FFD23F', '#FF7A1A', '#FFFFFF'][i % 3], size: rand(2, 4.5), drag: true, glow: true }); }
        G.shake = Math.max(G.shake, 0.25);
        for (const e of G.enemies) if (!e.dead && e.t >= 0 && Math.hypot(e.x - m.tx, e.y - m.ty) < R + e.r) hurt(e, 14 * hpK());
        if (bossHittable() && Math.hypot(G.boss.x - m.tx, G.boss.y - m.ty) < R + 40) hurtBoss(G.boss.max * 0.015);
        sfx.tone(90 + Math.random() * 40, 0.25, 'square', 0.045, 0, 45);
      }
    }
    G.meteors = G.meteors.filter((m) => !m.dead);
  }

  // ---------- Background ----------
  function newMote(anyY) {
    const wd = G.world;
    return { x: rand(0, VW), y: anyY ? rand(0, VH) : wd.moteUp ? VH + 10 : -10, v: wd.streaks ? rand(160, 320) : rand(30, 90) * (wd.moteUp ? -1 : 1),
      vx: rand(-10, 10), r: rand(1, 2.4), c: wd.motes[Math.floor(Math.random() * wd.motes.length)], tw: Math.random() * 6 };
  }
  const CLOUDS = [];
  for (let i = 0; i < 4; i++) CLOUDS.push({ x: rand(0, VW), y: i * 190, s: rand(0.7, 1.2) });

  // ---------- Update ----------
  const held = { left: false, right: false, up: false, down: false };
  function update(dt) {
    G.t += dt;
    for (const k of ['shake', 'flash', 'roarFx']) if (G[k] > 0) G[k] -= dt;
    G.scroll = (G.scroll + dt * (G.state === 'won' ? 90 : 46)) % VH;
    for (const c of CLOUDS) { c.y += dt * 120; if (c.y > VH + 80) { c.y -= VH + 240; c.x = rand(0, VW); c.s = rand(0.7, 1.2); } }
    for (const m of G.motes) { m.y += m.v * dt; m.x += m.vx * dt; m.tw += dt * 4; if (m.y > VH + 12 || m.y < -12) Object.assign(m, newMote(false)); }
    updateParticles(dt);
    for (const f of G.fx) f.t -= dt;
    G.fx = G.fx.filter((f) => f.t > 0);
    if (G.state === 'ready') {
      G.readyT -= dt;
      updateBoss(dt);
      const k = easeOut(clamp(1 - G.readyT / G.readyMax, 0, 1));
      G.P.y = VH + 80 + (G.P.ty - VH - 80) * Math.min(1, k * 1.4); G.P.x = G.P.tx;
      if (G.readyT <= 0) core.startPlay();
      return;
    }
    if (G.state === 'won') { updateWin(dt); return; }
    updatePlayer(dt);
    if (G.state === 'dying' || G.state === 'lost') {
      const P = G.P;
      P.dead += dt; P.y += dt * 140 * P.dead; P.ty = P.y;
      G.beam = null;
      updateEnemies(dt); updateBullets(dt); updateShots(dt);
      return;
    }
    if (G.state !== 'play') return;
    G.playT += dt;
    if (Math.floor(G.playT) !== G.shownSec) { G.shownSec = Math.floor(G.playT); $('#timerNum').textContent = core.fmtTime(G.playT); }
    if (G.boost > 0) G.boost -= dt;
    if (!frozen()) G.st += dt;
    const sc = G.cfg.script;
    while (G.ev < sc.length && sc[G.ev].t <= G.st) spawnWave(sc[G.ev++]);
    shootHeads(dt);
    updateShots(dt);
    updateEnemies(dt);
    updateBoss(dt);
    if (G.state !== 'play') return;
    updateSpecials(dt);
    updateRocks(dt);
    updateBullets(dt);
    updatePickups(dt);
    // A normal level ends once the last wave is over: the monster flies on and the coins left fly to it.
    if (!G.bossFight && G.ev >= sc.length && (G.enemies.length === 0 || G.st > G.cfg.len + 9)) {
      if (!G.ending) { G.ending = true; G.endT = 0; }
      G.endT += dt;
      if (G.endT > 1.1 || (!G.pickups.length && G.endT > 0.5)) win();
    }
    hud();
  }
  function updateBullets(dt) {
    const P = G.P, ts = frozen() ? 0 : 1;
    for (const b of G.bullets) {
      b.t += dt; b.x += b.vx * dt * ts; b.y += b.vy * dt * ts;
      if (b.y > VH + 20 || b.y < -30 || b.x < -20 || b.x > VW + 20) b.dead = true;
      else if (G.state === 'play' && (b.x - P.x) ** 2 + (b.y - P.y) ** 2 < (b.r + 6) ** 2) { b.dead = true; hit(b.dmg || 15); }
    }
    G.bullets = G.bullets.filter((b) => !b.dead);
  }

  // ---------- Win ----------
  const CONFETTI = ['#FFD23F', '#FFB020', '#FFFFFF', '#8A6CFF', '#7FD4FF'];
  function win() {
    if (G.state === 'won') return;
    G.state = 'won'; G.winT = 0; G.beam = null;
    for (const b of G.bullets) puff(b.x, b.y);
    G.bullets = [];
    for (const e of G.enemies) boom(e.x, e.y, e.r * 0.6);
    G.enemies = [];
    for (const p of G.pickups) if (p.type === 'coin') G.coins++;
    G.pickups = [];
    held.left = held.right = held.up = held.down = false;
    if (G.bossFight) {
      sfx.defeat();
      const B = G.boss;
      G.coins += BOSS_COINS;
      G.score += 1000;
      if (B) for (let i = 0; i < BOSS_COINS; i++) G.particles.push({ coin: true, x: B.x, y: B.y, vx: rand(-160, 160), vy: rand(-260, -60), life: 1.4, max: 1.4, spin: rand(0, 6) });
    }
    sfx.win();
    const pct = G.spawned ? G.kills / G.spawned * 100 : 100;
    const left = G.hp / G.maxHp;
    const done = (pct >= KILL_PCT ? 1 : 0) | (G.coins >= G.cfg.coinGoal ? 2 : 0) | (left >= HP_CHAL / 100 ? 4 : 0);
    hud(true);
    core.finishWin(left >= 0.7 ? 3 : left >= 0.35 ? 2 : 1, done, G.bossFight ? 2800 : 2200);
  }
  function updateWin(dt) {
    G.winT += dt;
    const P = G.P, B = G.boss;
    if (B && G.bossFight) {
      if (G.winT < 1.2 && Math.random() < 0.5) boom(B.x + rand(-50, 50), B.y + rand(-40, 40), 14);
      if (!G.bossPopped && G.winT > 1.2) {
        G.bossPopped = true; G.shake = 0.5;
        boom(B.x, B.y, 60);
        sfx.tone(70, 0.45, 'sawtooth', 0.1, 0, 35);
        floatText(B.x, B.y + 40, 'הדרקון הובס!', '#FFD23F');
      }
    }
    // The monster flies on: up and out of the top.
    const flyAt = G.bossFight ? 1.6 : 0.4;
    if (G.winT > flyAt) { P.y -= dt * 260 * Math.min(1, (G.winT - flyAt) * 1.5); P.ty = P.y; }
    for (const id of P.heads) P.open[id] = Math.max(0, (P.open[id] || 0) - dt * 3);
    if (!G.confettiDone && G.winT > (G.bossFight ? 1.6 : 0.8)) {
      G.confettiDone = true;
      for (let k = 0; k < 70; k++) {
        G.particles.push({ conf: true, x: rand(0, VW), y: rand(-160, -10), vx: rand(-30, 30), vy: rand(60, 140),
          rot: rand(0, 6), vr: rand(-8, 8), w: rand(5, 8), h: rand(2, 4), color: CONFETTI[k % CONFETTI.length],
          life: 3.2, max: 3.2, sway: rand(0, 6) });
      }
      sfx.claim();
    }
  }

  // ---------- Particles ----------
  function floatText(x, y, text, color) { G.particles.push({ x, y, vx: 0, vy: -40, life: 1.3, max: 1.3, color, text }); }
  function updateParticles(dt) {
    for (const q of G.particles) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.conf) { q.rot += q.vr * dt; q.sway += dt * 4; q.x += Math.sin(q.sway) * 30 * dt; }
      else if (q.coin) { q.vy += 420 * dt; q.spin += dt * 8; }
      else if (q.drag) { q.vx *= Math.pow(0.05, dt); q.vy *= Math.pow(0.05, dt); }
      else if (!q.text && !q.bubble) q.vy += 160 * dt;
    }
    G.particles = G.particles.filter((q) => q.life > 0);
    if (G.particles.length > 420) G.particles.splice(0, G.particles.length - 420);
  }

  // ---------- HUD ----------
  function hud(force) {
    const key = G.bossFight ? 'b' : `n${G.l}`;
    if (!force && key === G.hudKey) return;
    G.hudKey = key;
    $('#levelName').textContent = G.bossFight ? 'בוס' : `שלב ${G.l + 1}`;
  }

  // ---------- Render ----------
  function render() {
    const c = ctx;
    c.setTransform(RES, 0, 0, RES, 0, 0);
    if (G.shake > 0) c.translate(rand(-4, 4) * G.shake * 2, rand(-4, 4) * G.shake * 2);
    if (tileCv) {
      const y = Math.round(G.scroll * RES) / RES;
      c.drawImage(tileCv, 0, y - VH, VW, VH);
      c.drawImage(tileCv, 0, y, VW, VH);
    }
    if (vignette) { c.fillStyle = vignette; c.fillRect(0, 0, VW, VH); }
    drawMotes(c);
    drawClouds(c);
    drawRockWarn(c);
    for (const sc of G.scorch) { const a = Math.min(1, sc.t) * 0.55; c.beginPath(); c.arc(sc.x, sc.y, sc.r, 0, TAU); c.fillStyle = `rgba(20,8,4,${a})`; c.fill(); c.beginPath(); c.arc(sc.x, sc.y, sc.r * 0.5, 0, TAU); c.fillStyle = `rgba(255,90,20,${a * 0.6})`; c.fill(); sc.y += 46 / 60; sc.t -= 1 / 60; }
    G.scorch = G.scorch.filter((sc) => sc.t > 0);
    for (const cl of G.clouds) drawPoisonCloud(c, cl);
    for (const p of G.pickups) drawPickup(c, p);
    for (const k of G.rocks) drawRock(c, k);
    for (const e of G.enemies) if (e.t >= 0) drawEnemy(c, e);
    if (G.boss && !G.bossPopped) drawBossLive(c);
    drawPlayerShots(c);
    drawHydraLive(c);
    for (const b of G.bullets) drawBullet(c, b);
    drawFx(c);
    drawParticles(c);
    if (G.freezeT > 0) { c.fillStyle = `rgba(120,200,255,${0.12 + 0.04 * Math.sin(G.t * 6)})`; c.fillRect(0, 0, VW, VH); }
    drawTrack(c);
    drawBossBar(c);
    drawUI(c);
    if (G.flash > 0) { c.fillStyle = `rgba(255,255,255,${G.flash * 0.8})`; c.fillRect(-10, -10, VW + 20, VH + 20); }
  }
  function drawMotes(c) {
    for (const m of G.motes) {
      c.globalAlpha = 0.4 + Math.sin(m.tw) * 0.25;
      c.fillStyle = m.c;
      if (G.world.streaks) c.fillRect(m.x, m.y, 1.4, m.r * 6);
      else { c.beginPath(); c.arc(m.x, m.y, m.r, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  function drawClouds(c) {
    if (G.world.streaks) return;
    c.fillStyle = 'rgba(200,210,255,.07)';
    for (const k of CLOUDS) {
      c.beginPath();
      for (const [dx, dy, r] of [[0, 0, 34], [36, -12, 42], [76, 0, 32], [38, 14, 34]]) { c.moveTo(k.x + dx * k.s + r * k.s, k.y + dy * k.s); c.arc(k.x + dx * k.s, k.y + dy * k.s, r * k.s, 0, TAU); }
      c.fill();
    }
  }
  function drawHydraLive(c) {
    const P = G.P;
    if ((G.state === 'dying' || G.state === 'lost') && P.dead > 1.5) return;
    if (P.inv > 0 && G.state === 'play' && Math.floor(P.inv * 12) % 2 === 0) c.globalAlpha = 0.35;
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.ellipse(P.x + 18, P.y + 52, 18, 6, 0, 0, TAU); c.fill();
    drawHydra(c, P.x, P.y, P.heads, G.t, { open: P.open, roar: G.roarFx > 0, spin: P.dead ? P.dead * 5 : 0 });
    c.globalAlpha = 1;
    if (G.shieldT > 0) {
      const k = Math.min(1, G.shieldT) * (0.7 + 0.3 * Math.sin(G.t * 10));
      c.save(); c.globalCompositeOperation = 'lighter';
      c.beginPath(); c.arc(P.x, P.y - 6, 42, 0, TAU); c.fillStyle = `rgba(90,160,255,${0.16 * k})`; c.fill();
      c.lineWidth = 2.5; c.strokeStyle = `rgba(150,210,255,${0.8 * k})`; c.stroke();
      c.restore();
    }
  }

  // The monster: a hulking armoured beast with clawed arms and a glowing core, floating on a swirl of magic fire.
  // A neck and head grows from its shoulders for every power it has.
  function drawHydra(c, x, y, heads, t, o) {
    c.save(); c.translate(x, y);
    if (o.spin) c.rotate(o.spin);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    // the magic fire it floats on
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const f = Math.sin(t * 14 + i * 2) * 2, len = 26 + i * 3 + f;
      c.beginPath(); c.moveTo(-9 + i * 1.5, 14); c.quadraticCurveTo(-4 + Math.sin(t * 9 + i) * 4, 14 + len * 0.6, Math.sin(t * 7 + i) * 3, 14 + len);
      c.quadraticCurveTo(4 + Math.sin(t * 9 + i) * 4, 14 + len * 0.6, 9 - i * 1.5, 14); c.closePath();
      c.fillStyle = ['rgba(120,80,255,.35)', 'rgba(170,120,255,.35)', 'rgba(220,180,255,.4)', 'rgba(255,255,255,.45)'][i]; c.fill();
    }
    c.restore();
    // necks (drawn under the body so they grow out of the shoulders)
    const n = heads.length, geo = heads.map((_, k) => headGeo(k, n, t));
    // o.grow[id] (0..1): a head that's just growing out (the title screen uses it)
    const gr = (id) => (o.grow && o.grow[id] != null ? o.grow[id] : 1);
    heads.forEach((id, k) => {
      const g = geo[k], q = Math.min(1, gr(id));
      c.beginPath(); c.moveTo(g.bx * 0.7, -4); c.quadraticCurveTo(g.bx + Math.sin(g.a) * 6 * q, -4 + (g.by - 2) * q, g.bx * 0.7 + (g.hx - g.bx * 0.7) * q, -4 + (g.hy + 4) * q);
      c.strokeStyle = INK; c.lineWidth = 8; c.stroke();
      c.strokeStyle = BODY.c; c.lineWidth = 5; c.stroke();
      c.strokeStyle = HEADS[id].c; c.globalAlpha = 0.7; c.lineWidth = 1.6; c.stroke(); c.globalAlpha = 1;
    });
    c.strokeStyle = INK;
    // arms with claws, swaying a little
    for (const sd of [-1, 1]) {
      const sw = Math.sin(t * 3 + sd) * 0.12;
      c.save(); c.translate(sd * 12, -2); c.rotate(sd * (0.35 + sw));
      c.beginPath(); c.moveTo(-3.5, 0); c.quadraticCurveTo(sd * 3, 8, sd * 1.5, 16); c.lineTo(sd * 5.5, 16); c.quadraticCurveTo(sd * 7, 7, 3.5, 0); c.closePath();
      c.fillStyle = BODY.c; c.fill(); c.lineWidth = 1.8; c.stroke();
      for (const k of [-2, 1, 4]) { c.beginPath(); c.moveTo(sd * 3.5 + k, 15.5); c.lineTo(sd * 3.5 + k * 1.3, 20); c.lineTo(sd * 3.5 + k + 1.4, 15.5); c.closePath(); c.fillStyle = BODY.bone; c.fill(); c.lineWidth = 1; c.stroke(); }
      c.restore();
    }
    // the body: broad shoulders, narrow waist
    c.beginPath();
    c.moveTo(-15, -8); c.quadraticCurveTo(0, -15, 15, -8); c.quadraticCurveTo(16, 2, 9, 12); c.quadraticCurveTo(0, 18, -9, 12); c.quadraticCurveTo(-16, 2, -15, -8); c.closePath();
    c.fillStyle = BODY.c; c.fill(); c.lineWidth = 2.2; c.stroke();
    c.strokeStyle = BODY.plate; c.lineWidth = 1.3;
    for (const yy of [3, 8]) { c.beginPath(); c.moveTo(-8, yy); c.quadraticCurveTo(0, yy + 3, 8, yy); c.stroke(); }
    // shoulder plates with spikes
    c.strokeStyle = INK;
    for (const sd of [-1, 1]) {
      c.beginPath(); c.ellipse(sd * 12, -7, 6.5, 4.5, sd * 0.3, 0, TAU); c.fillStyle = BODY.plate; c.fill(); c.lineWidth = 1.8; c.stroke();
      c.beginPath(); c.moveTo(sd * 10, -10); c.lineTo(sd * 15, -17); c.lineTo(sd * 15, -9); c.closePath(); c.fillStyle = BODY.bone; c.fill(); c.lineWidth = 1.3; c.stroke();
    }
    // the glowing core
    const pulse = 0.75 + 0.25 * Math.sin(t * 4);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.beginPath(); c.arc(0, -1, 7 * pulse, 0, TAU); c.fillStyle = 'rgba(160,110,255,.45)'; c.fill(); c.restore();
    c.beginPath(); c.moveTo(0, -5.5); c.lineTo(3.4, -1); c.lineTo(0, 3.5); c.lineTo(-3.4, -1); c.closePath(); c.fillStyle = '#D8C8FF'; c.fill(); c.lineWidth = 1.2; c.stroke();
    // heads, the middle ones last so they sit on top (a bit bigger than before)
    const order = heads.map((_, k) => k).sort((i, j) => Math.abs(geo[j].a) - Math.abs(geo[i].a));
    for (const k of order) {
      const g = geo[k], id = heads[k], q = gr(id), qm = Math.min(1, q);
      if (q <= 0.02) continue;
      c.save(); c.translate(g.bx * 0.7 + (g.hx - g.bx * 0.7) * qm, -4 + (g.hy + 4) * qm); c.rotate(g.a); c.scale(1.18 * q, 1.18 * q);
      drawHead(c, id, 0, 0, t + k, o.roar ? 1 : (o.open && o.open[id]) || 0, 0);
      c.restore();
    }
    c.restore();
  }
  // One head, pointing up (−y), about 12 wide and 18 long. Each kind has its own shape.
  function drawHead(c, id, x, y, t, open, a) {
    const H = HEADS[id];
    c.save(); c.translate(x, y); if (a) c.rotate(a);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 1.6;
    const jaw = Math.min(1, open) * 2.2;
    const fs = (fill) => { c.fillStyle = fill; c.fill(); c.stroke(); };
    // glowing mouth when it fires
    if (open > 0.05) {
      c.save(); c.globalCompositeOperation = 'lighter';
      c.beginPath(); c.arc(0, -12, 4 + jaw * 1.5, 0, TAU); c.fillStyle = `${H.glow}66`; c.fill(); c.restore();
    }
    if (id === 'fire') {
      // a horned reptile head
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 3, 2); c.quadraticCurveTo(sd * 9, 4, sd * 10, 10); c.quadraticCurveTo(sd * 7, 5, sd * 4.5, 5); c.closePath(); fs('#D9CFB8'); }
      c.beginPath(); c.moveTo(0, -13 - jaw); c.quadraticCurveTo(5, -10, 6, -2); c.quadraticCurveTo(6, 5, 0, 6); c.quadraticCurveTo(-6, 5, -6, -2); c.quadraticCurveTo(-5, -10, 0, -13 - jaw); c.closePath(); fs(H.c);
      c.beginPath(); c.moveTo(-3, -6); c.lineTo(0, -2); c.lineTo(3, -6); c.strokeStyle = H.dark; c.stroke(); c.strokeStyle = INK;
    } else if (id === 'ice') {
      // a crystal head with a crown of ice spikes
      for (const [sx, h] of [[-5, 7], [-2.5, 9], [2.5, 9], [5, 7]]) { c.beginPath(); c.moveTo(sx - 1.6, 2); c.lineTo(sx * 1.25, 2 + h); c.lineTo(sx + 1.6, 2); c.closePath(); fs('#E6FBFF'); }
      c.beginPath(); c.moveTo(0, -13 - jaw); c.lineTo(5, -6); c.lineTo(6, 2); c.lineTo(3, 6); c.lineTo(-3, 6); c.lineTo(-6, 2); c.lineTo(-5, -6); c.closePath(); fs(H.c);
      c.beginPath(); c.moveTo(0, -12); c.lineTo(2.5, -6); c.lineTo(0, 4); c.strokeStyle = '#E6FBFF'; c.stroke(); c.strokeStyle = INK;
    } else if (id === 'poison') {
      // a cobra head with a wide hood and fangs
      c.beginPath(); c.moveTo(0, -4); c.bezierCurveTo(11, -2, 10, 9, 0, 9); c.bezierCurveTo(-10, 9, -11, -2, 0, -4); fs(H.dark);
      c.fillStyle = '#B6FF6A'; for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 5, 3, 1.4, 0, TAU); c.fill(); }
      c.beginPath(); c.ellipse(0, -5 - jaw * 0.4, 4.2, 8 + jaw * 0.4, 0, 0, TAU); fs(H.c);
      c.fillStyle = '#FFFFFF'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 1.6, -12 - jaw); c.lineTo(sd * 1.1, -15.5 - jaw); c.lineTo(sd * 0.6, -12 - jaw); c.fill(); }
    } else if (id === 'bolt') {
      // a beaked head with a lightning crest
      c.beginPath(); c.moveTo(0, 2); c.lineTo(-3, 6); c.lineTo(0, 7); c.lineTo(-2, 11); c.lineTo(3, 6); c.lineTo(0.5, 5.5); c.lineTo(2.5, 2); c.closePath(); fs('#FFF6A0');
      c.beginPath(); c.ellipse(0, -2, 5.5, 6.5, 0, 0, TAU); fs(H.c);
      c.beginPath(); c.moveTo(-3, -6); c.lineTo(0, -15 - jaw); c.lineTo(3, -6); c.closePath(); fs('#3A3A46');
    } else if (id === 'wind') {
      // a feathered head with long plumes swept back
      for (const sd of [-1, 0, 1]) { c.beginPath(); c.moveTo(sd * 3, 2); c.quadraticCurveTo(sd * 7, 8, sd * 4 + Math.sin(t * 6 + sd) * 1.5, 14); c.quadraticCurveTo(sd * 2, 8, -sd * 0.5, 3); c.closePath(); fs(sd ? '#E6FFFA' : H.dark); }
      c.beginPath(); c.moveTo(0, -12 - jaw); c.quadraticCurveTo(6, -7, 5, 1); c.quadraticCurveTo(0, 5, -5, 1); c.quadraticCurveTo(-6, -7, 0, -12 - jaw); c.closePath(); fs(H.c);
    } else {
      // a smooth star head with a glowing third eye
      c.beginPath(); c.ellipse(0, -3, 6, 9, 0, 0, TAU); fs(H.c);
      c.fillStyle = '#FFFFFF'; for (const [sx, sy] of [[-3, 2], [3.4, 0], [1, 4]]) { c.beginPath(); c.arc(sx, sy, 0.7, 0, TAU); c.fill(); }
      c.save(); c.globalCompositeOperation = 'lighter';
      c.beginPath(); c.arc(0, -4, 3.2, 0, TAU); c.fillStyle = 'rgba(240,200,255,.5)'; c.fill(); c.restore();
      c.beginPath(); c.arc(0, -4, 1.4, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
    }
    // eyes: narrow and glowing
    c.fillStyle = id === 'star' ? '#FFE95C' : H.glow;
    for (const sd of [-1, 1]) {
      c.save(); c.translate(sd * 3.2, id === 'poison' ? -6 : -3); c.rotate(sd * 0.5);
      c.beginPath(); c.ellipse(0, 0, 1.6, 0.9, 0, 0, TAU); c.fill(); c.restore();
    }
    c.restore();
  }
  function starPath(c, x, y, R, r, n) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = i * Math.PI / n - Math.PI / 2, rr = i % 2 ? r : R;
      if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  // ---------- Our shots: glowing (added light), each weapon its own look ----------
  function drawPlayerShots(c) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    // ice beam
    const bm = G.beam;
    if (bm) {
      const fl = 0.85 + 0.15 * Math.sin(G.t * 40);
      const y1 = bm.y1, h = bm.y0 - y1;
      c.fillStyle = 'rgba(80,180,255,.16)'; c.fillRect(bm.x - bm.w * 1.4, y1, bm.w * 2.8, h);
      c.fillStyle = `rgba(120,210,255,${0.55 * fl})`; c.fillRect(bm.x - bm.w / 2, y1, bm.w, h);
      c.fillStyle = 'rgba(235,250,255,.75)'; c.fillRect(bm.x - bm.w * 0.18, y1, bm.w * 0.36, h);
      if (bm.hit) {
        c.beginPath(); c.arc(bm.x, y1, bm.w * 1.8 * fl, 0, TAU); c.fillStyle = 'rgba(180,240,255,.6)'; c.fill();
        if (Math.random() < 0.5) G.particles.push({ x: bm.x + rand(-6, 6), y: y1, vx: rand(-60, 60), vy: rand(-60, 20), life: 0.3, max: 0.3, color: '#E6FBFF', size: rand(1.5, 3), glow: true });
      }
    }
    for (const s of G.shots) {
      if (s.id === 'fire') {
        const r = s.r;
        for (let i = 3; i >= 1; i--) { c.beginPath(); c.arc(s.x - s.vx * 0.012 * i, s.y - s.vy * 0.012 * i, r * (1 - i * 0.2), 0, TAU); c.fillStyle = `rgba(255,${90 + i * 20},20,${0.35 - i * 0.08})`; c.fill(); }
        c.beginPath(); c.arc(s.x, s.y, r * 1.9, 0, TAU); c.fillStyle = 'rgba(255,110,20,.28)'; c.fill();
        c.beginPath(); c.arc(s.x, s.y, r, 0, TAU); c.fillStyle = 'rgba(255,170,40,.95)'; c.fill();
        c.beginPath(); c.arc(s.x, s.y - r * 0.15, r * 0.5, 0, TAU); c.fillStyle = '#FFF6C0'; c.fill();
      } else if (s.id === 'poison') {
        c.beginPath(); c.arc(s.x, s.y, s.r * 1.8, 0, TAU); c.fillStyle = 'rgba(120,255,60,.22)'; c.fill();
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fillStyle = 'rgba(130,230,60,.95)'; c.fill();
        c.beginPath(); c.arc(s.x - 2, s.y - 2, s.r * 0.35, 0, TAU); c.fillStyle = '#F0FFD0'; c.fill();
      } else if (s.id === 'star') {
        for (let i = 0; i + 1 < s.trail.length; i += 2) { const k = i / s.trail.length; c.beginPath(); c.arc(s.trail[i], s.trail[i + 1], 1 + k * 3, 0, TAU); c.fillStyle = `rgba(200,150,255,${k * 0.5})`; c.fill(); }
        c.save(); c.translate(s.x, s.y); c.rotate(s.spin);
        c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fillStyle = 'rgba(170,120,255,.25)'; c.fill();
        starPath(c, 0, 0, 7.5, 3.2, 5); c.fillStyle = '#E8D0FF'; c.fill();
        c.beginPath(); c.arc(0, 0, 2.2, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
        c.restore();
      }
    }
    for (const g of G.gusts) {
      const k = clamp(g.life / 0.9, 0, 1);
      c.lineCap = 'round';
      for (const [dy, w, al] of [[0, g.w / 2, 0.75], [9, g.w / 2.6, 0.45], [17, g.w / 3.6, 0.25]]) {
        c.beginPath(); c.moveTo(g.x - w, g.y + dy + 8); c.quadraticCurveTo(g.x, g.y + dy - 12, g.x + w, g.y + dy + 8);
        c.strokeStyle = `rgba(170,255,240,${al * k})`; c.lineWidth = 4; c.stroke();
      }
    }
    c.restore();
  }
  function drawPoisonCloud(c, cl) {
    const k = clamp(cl.life / cl.max, 0, 1), a = Math.min(1, k * 2.5);
    c.save();
    for (let i = 0; i < 5; i++) {
      const an = G.t * 0.8 + i * 1.26, rr = cl.r * (0.45 + 0.15 * Math.sin(G.t * 2 + i));
      c.beginPath(); c.arc(cl.x + Math.cos(an) * cl.r * 0.4, cl.y + Math.sin(an) * cl.r * 0.35, rr, 0, TAU);
      c.fillStyle = `rgba(110,210,60,${0.16 * a})`; c.fill();
    }
    c.beginPath(); c.arc(cl.x, cl.y, cl.r, 0, TAU); c.strokeStyle = `rgba(170,255,90,${0.35 * a})`; c.lineWidth = 1.5; c.setLineDash([4, 6]); c.stroke(); c.setLineDash([]);
    c.restore();
  }
  // Enemy shots: solid red-hot orbs with a dark ring, so they never look like ours.
  function drawBullet(c, b) {
    const pulse = 1 + Math.sin(b.t * 14) * 0.15;
    c.beginPath(); c.arc(b.x, b.y, (b.r + 5) * pulse, 0, TAU); c.fillStyle = 'rgba(255,40,70,.3)'; c.fill();
    c.beginPath(); c.arc(b.x, b.y, b.r + 1.5, 0, TAU); c.fillStyle = '#1A0610'; c.fill();
    c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fillStyle = '#FF2D55'; c.fill();
    c.beginPath(); c.arc(b.x, b.y, b.r * 0.55, 0, TAU); c.fillStyle = '#FFE0E8'; c.fill();
  }
  function drawFx(c) {
    // during the meteor shower the sky goes dark red
    if (G.meteorT > 0) { const k = Math.min(1, G.meteorT * 2, (G.meteorMax - G.meteorT) * 3); c.fillStyle = `rgba(90,10,0,${0.28 * k})`; c.fillRect(0, 0, VW, VH); }
    for (const f of G.fx) {
      if (f.type !== 'blast') continue;
      const k = f.t / f.max;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.beginPath(); c.arc(f.x, f.y, f.r * (1 - k * 0.5) * 0.7, 0, TAU); c.fillStyle = `rgba(255,170,60,${0.6 * k})`; c.fill();
      c.restore();
      c.beginPath(); c.arc(f.x, f.y, f.r * (1.2 - k), 0, TAU); c.strokeStyle = `rgba(255,230,180,${k})`; c.lineWidth = 5 * k + 1; c.stroke();
    }
    for (const f of G.fx) {
      const k = f.t / f.max;
      if (f.type === 'ring') {
        c.beginPath(); c.arc(f.x, f.y, f.r + f.grow * (1 - k), 0, TAU);
        c.strokeStyle = `rgba(255,220,150,${k})`; c.lineWidth = 3 * k + 1; c.stroke();
      } else if (f.type === 'bolt') {
        const rnd = mulberry(Math.floor(f.seed + f.t * 60));
        c.beginPath();
        f.pts.forEach((p, i) => {
          if (i === 0) { c.moveTo(p.x, p.y); return; }
          const q = f.pts[i - 1];
          for (let s = 1; s <= 5; s++) {
            const u = s / 5, j = s < 5 ? 20 : 0;
            c.lineTo(q.x + (p.x - q.x) * u + (rnd() - 0.5) * j, q.y + (p.y - q.y) * u + (rnd() - 0.5) * j);
          }
        });
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, k * 2.5); c.lineJoin = 'round';
        c.strokeStyle = 'rgba(120,140,255,.5)'; c.lineWidth = 9; c.stroke();
        c.strokeStyle = '#D8E4FF'; c.lineWidth = 3.2; c.stroke();
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.2; c.stroke();
        c.restore();
        for (const p of f.pts.slice(1)) { c.save(); c.globalCompositeOperation = 'lighter'; c.beginPath(); c.arc(p.x, p.y, 10 * k, 0, TAU); c.fillStyle = 'rgba(180,200,255,.5)'; c.fill(); c.restore(); }
      }
    }
    for (const m of G.meteors) {
      const u = m.t / m.dur, x = m.x + (m.tx - m.x) * u, y = m.y + (m.ty - m.y) * u;
      const dx = m.tx - m.x, dy = m.ty - m.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, r = m.r;
      // a target ring on the ground where it will land
      c.beginPath(); c.arc(m.tx, m.ty, (40 + r * 2) * (0.4 + 0.6 * u), 0, TAU); c.strokeStyle = `rgba(255,120,40,${0.5 * u})`; c.lineWidth = 2; c.setLineDash([5, 5]); c.stroke(); c.setLineDash([]);
      c.save(); c.globalCompositeOperation = 'lighter';
      // the fire tail
      const tl = r * 9;
      const g = c.createLinearGradient(x, y, x - ux * tl, y - uy * tl); g.addColorStop(0, 'rgba(255,210,90,.95)'); g.addColorStop(0.35, 'rgba(255,110,30,.6)'); g.addColorStop(1, 'rgba(255,40,20,0)');
      c.beginPath(); c.moveTo(x + uy * r, y - ux * r); c.lineTo(x - ux * tl, y - uy * tl); c.lineTo(x - uy * r, y + ux * r); c.closePath(); c.fillStyle = g; c.fill();
      c.beginPath(); c.arc(x, y, r * 2, 0, TAU); c.fillStyle = 'rgba(255,140,40,.35)'; c.fill();
      c.restore();
      // the rock itself
      c.save(); c.translate(x, y); c.rotate(m.rot + m.t * 6);
      c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = r * (0.85 + 0.15 * Math.sin(i * 2.7 + m.rot)); i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath();
      c.fillStyle = '#4A2A20'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#140808'; c.stroke();
      c.beginPath(); c.moveTo(-r * 0.4, -r * 0.2); c.lineTo(r * 0.1, r * 0.1); c.lineTo(r * 0.35, -r * 0.35); c.strokeStyle = '#FFB020'; c.lineWidth = 2; c.stroke();
      c.restore();
    }
    if (G.roarFx > 0) {
      const k = 1 - G.roarFx / 0.9;
      c.beginPath(); c.arc(G.P.x, G.P.y - 20, 40 + k * 520, 0, TAU);
      c.strokeStyle = `rgba(255,230,180,${0.8 * (1 - k)})`; c.lineWidth = 14 * (1 - k) + 2; c.stroke();
    }
  }
  function drawPickup(c, p) {
    c.save(); c.translate(p.x, p.y);
    if (p.type === 'coin') drawCoin(c, 0, 0, 8.5, p.spin, true);
    else if (p.type === 'power') {
      const b = 1 + Math.sin(p.t * 8) * 0.08;
      c.scale(b, b);
      c.save(); c.globalCompositeOperation = 'lighter'; c.beginPath(); c.arc(0, 0, 17, 0, TAU); c.fillStyle = 'rgba(255,200,60,.3)'; c.fill(); c.restore();
      c.beginPath(); c.moveTo(0, -12); c.lineTo(11, -2); c.lineTo(7, 11); c.lineTo(-7, 11); c.lineTo(-11, -2); c.closePath();
      c.fillStyle = '#FFB020'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
      c.beginPath(); c.moveTo(-5, 3); c.lineTo(0, -3); c.lineTo(5, 3); c.moveTo(-5, 8); c.lineTo(0, 2); c.lineTo(5, 8);
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.2; c.lineCap = 'round'; c.stroke();
    } else if (p.type === 'heart') {
      const b = 1 + Math.sin(p.t * 7) * 0.1;
      c.scale(b, b);
      c.save(); c.globalCompositeOperation = 'lighter'; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fillStyle = 'rgba(80,255,140,.25)'; c.fill(); c.restore();
      c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-14, 0, -10, -12, 0, -5); c.bezierCurveTo(10, -12, 14, 0, 0, 10); c.closePath();
      c.fillStyle = '#3EE07A'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
      c.fillStyle = '#FFFFFF'; c.fillRect(-1.5, -4, 3, 9); c.fillRect(-4.5, -1, 9, 3);
    }
    c.restore();
  }
  function drawCoin(c, x, y, r, spin, shine = false) {
    const sx = Math.max(0.25, Math.abs(Math.cos(spin)));
    if (shine) {
      c.save(); c.globalCompositeOperation = 'lighter';
      c.beginPath(); c.arc(x, y, r * 2.3, 0, TAU); c.fillStyle = 'rgba(255,200,40,.22)'; c.fill();
      c.restore();
    }
    c.save(); c.translate(x, y); c.scale(sx, 1);
    c.beginPath(); c.arc(0, 0, r + 1.5, 0, TAU); c.fillStyle = '#2A1600'; c.fill();
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = '#FFD84A'; c.fill();
    c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU); c.fillStyle = '#FFB800'; c.fill();
    c.beginPath(); c.arc(-r * 0.3, -r * 0.35, r * 0.28, 0, TAU); c.fillStyle = '#FFFBE0'; c.fill();
    c.restore();
    if (shine && Math.sin(spin * 1.7) > 0.93) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x + r * 0.5, y - r * 0.6);
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(0, -5); c.lineTo(1.2, 0); c.lineTo(0, 5); c.lineTo(-1.2, 0); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-5, 0); c.lineTo(0, 1.2); c.lineTo(5, 0); c.lineTo(0, -1.2); c.closePath(); c.fill(); c.restore();
    }
  }
  function drawParticles(c) {
    for (const q of G.particles) {
      const a = clamp(q.life / q.max, 0, 1);
      c.globalAlpha = q.conf ? Math.min(1, q.life) : a;
      if (q.text) {
        c.font = `22px ${FONT}`; c.textAlign = 'center';
        c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(q.text, q.x, q.y);
        c.fillStyle = q.color; c.fillText(q.text, q.x, q.y);
      } else if (q.conf) {
        c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.fillStyle = q.color; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); c.restore();
      } else if (q.coin) {
        drawCoin(c, q.x, q.y, 8, q.spin, true);
      } else if (q.bubble) {
        c.beginPath(); c.arc(q.x, q.y, q.size, 0, TAU); c.strokeStyle = q.color; c.lineWidth = 1.5; c.stroke();
      } else {
        if (q.glow) c.globalCompositeOperation = 'lighter';
        c.fillStyle = q.color;
        c.beginPath(); c.arc(q.x, q.y, q.size, 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
    }
    c.globalAlpha = 1;
  }
  // On the board: the special power button (bottom left), the weapon boost and the coins.
  function drawSpecialIcon(c, id) {
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 1.6;
    if (id === 'roar') {
      for (const r of [7, 11, 15]) { c.beginPath(); c.arc(-6, 0, r, -0.6, 0.6); c.strokeStyle = '#FFE2A8'; c.lineWidth = 2.4; c.stroke(); }
      c.strokeStyle = INK; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-14, -6); c.lineTo(-2, -3); c.lineTo(-14, 0); c.lineTo(-2, 3); c.lineTo(-14, 6); c.fillStyle = '#E8452C'; c.fill(); c.stroke();
    } else if (id === 'shield') {
      c.beginPath(); c.moveTo(0, -12); c.lineTo(10, -7); c.lineTo(9, 4); c.quadraticCurveTo(5, 10, 0, 13); c.quadraticCurveTo(-5, 10, -9, 4); c.lineTo(-10, -7); c.closePath();
      c.fillStyle = '#4FA3FF'; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(0, -7); c.lineTo(5, -4); c.lineTo(4.5, 3); c.quadraticCurveTo(2, 7, 0, 8); c.closePath(); c.fillStyle = '#BFE0FF'; c.fill();
    } else if (id === 'freeze') {
      for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -12); c.moveTo(0, -7); c.lineTo(-3.5, -10); c.moveTo(0, -7); c.lineTo(3.5, -10); c.strokeStyle = '#BFF4FF'; c.lineWidth = 2.4; c.stroke(); c.restore(); }
      c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fillStyle = '#7FD4FF'; c.fill(); c.strokeStyle = INK; c.stroke();
    } else {
      c.beginPath(); c.moveTo(2, -2); c.lineTo(13, -13); c.strokeStyle = '#FFB020'; c.lineWidth = 5; c.stroke();
      c.beginPath(); c.moveTo(-8, 2); c.lineTo(0, -6); c.strokeStyle = '#FF7A1A'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = INK; c.lineWidth = 1.6;
      c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fillStyle = '#7A5A48'; c.fill(); c.stroke();
      c.beginPath(); c.arc(-8, 8, 3.5, 0, TAU); c.fillStyle = '#7A5A48'; c.fill(); c.stroke();
    }
  }
  // How far through the level: the monster climbs from the start to the finish flag (or the boss).
  // The boss's health: a wide bar under its name at the top of the board.
  function drawBossBar(c) {
    const B = G.boss;
    if (!B || B.enter > 0.6 || G.bossPopped) return;
    const x0 = 40, w = VW - 140, y = 30, k = clamp(B.hp / B.max, 0, 1);
    B.lag = B.lag == null ? k : Math.max(k, B.lag - 0.4 * (1 / 60));
    c.save();
    c.font = `15px ${FONT}`; c.textAlign = 'center'; c.lineWidth = 3.5; c.strokeStyle = INK;
    c.direction = 'rtl';
    const nm = B.phase === 2 ? `${BOSSES[G.w].name} · זועם!` : BOSSES[G.w].name;
    c.strokeText(nm, x0 + w / 2, y - 7); c.fillStyle = B.phase === 2 ? '#FF8A6A' : '#FFD0C0'; c.fillText(nm, x0 + w / 2, y - 7);
    c.fillStyle = B.phase === 2 ? `rgba(120,0,20,${0.6 + 0.3 * Math.sin(G.t * 8)})` : 'rgba(5,4,12,.85)'; c.fillRect(x0 - 2, y - 2, w + 4, 14);
    c.fillStyle = '#FFFFFF'; c.fillRect(x0 + w * (1 - B.lag), y, w * B.lag, 10);
    const gr = c.createLinearGradient(0, y, 0, y + 10); gr.addColorStop(0, '#FF7A8A'); gr.addColorStop(1, '#C0122E');
    c.fillStyle = gr; c.fillRect(x0 + w * (1 - k), y, w * k, 10);
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x0, y, w, 3);
    c.strokeStyle = '#FF6B4A'; c.lineWidth = 1.2; c.strokeRect(x0 - 2, y - 2, w + 4, 14);
    if (B.phase === 1) { c.fillStyle = '#FFD23F'; c.fillRect(x0 + w / 2 - 1, y - 4, 2, 18); } // where it gets angry
    c.restore();
  }
  function drawTrack(c) {
    if (G.bossFight) return; // a boss fight has the boss's health bar instead
    const x = VW - 14, top = 54, bot = VH - 96;
    const k = G.bossFight ? (G.boss ? 1 : clamp(G.st / G.cfg.len, 0, 1)) : clamp(G.st / G.cfg.len, 0, 1);
    c.save();
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, bot); c.lineTo(x, top); c.strokeStyle = 'rgba(5,4,12,.7)'; c.lineWidth = 7; c.stroke();
    c.beginPath(); c.moveTo(x, bot); c.lineTo(x, top); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; c.setLineDash([3, 6]); c.stroke(); c.setLineDash([]);
    const y = bot - (bot - top) * k;
    c.beginPath(); c.moveTo(x, bot); c.lineTo(x, y); c.strokeStyle = '#F2B84B'; c.lineWidth = 3; c.stroke();
    // start: a small dot
    c.beginPath(); c.arc(x, bot, 4, 0, TAU); c.fillStyle = '#F2B84B'; c.fill();
    // finish: a flag, or the boss's skull
    if (G.bossFight) {
      c.beginPath(); c.arc(x, top - 6, 9, 0, TAU); c.fillStyle = '#3A0A14'; c.fill(); c.strokeStyle = '#FF6B4A'; c.lineWidth = 1.5; c.stroke();
      c.font = `12px ${FONT}`; c.textAlign = 'center'; c.fillStyle = '#FFE0D0'; c.fillText('☠', x, top - 2);
    } else {
      c.beginPath(); c.moveTo(x, top + 2); c.lineTo(x, top - 16); c.strokeStyle = '#EEF1FF'; c.lineWidth = 1.6; c.stroke();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#0A0614' : '#FFFFFF'; c.fillRect(x - 12 + i * 4, top - 16 + j * 4, 4, 4); }
    }
    // the monster: its first head, riding up the track
    c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fillStyle = 'rgba(12,8,22,.9)'; c.fill(); c.strokeStyle = '#F2B84B'; c.lineWidth = 1.6; c.stroke();
    c.save(); c.translate(x, y + 2); c.scale(0.62, 0.62); drawHead(c, G.P.heads[0], 0, 0, G.t, 0, 0); c.restore();
    c.restore();
  }
  function drawUI(c) {
    const b = SPECIAL_BTN, full = G.charge >= 1, pulse = full ? 1 + Math.sin(G.t * 8) * 0.05 : 1;
    c.save(); c.translate(b.x, b.y); c.scale(pulse, pulse);
    if (full) { c.save(); c.globalCompositeOperation = 'lighter'; c.beginPath(); c.arc(0, 0, b.r + 10, 0, TAU); c.fillStyle = 'rgba(255,190,60,.3)'; c.fill(); c.restore(); }
    c.beginPath(); c.arc(0, 0, b.r, 0, TAU); c.fillStyle = full ? '#3A2A10' : 'rgba(12,8,22,.75)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = full ? '#FFC93C' : 'rgba(255,255,255,.25)'; c.stroke();
    c.beginPath(); c.arc(0, 0, b.r - 4, -Math.PI / 2, -Math.PI / 2 + TAU * G.charge);
    c.strokeStyle = '#FFC93C'; c.lineWidth = 3.5; c.lineCap = 'round'; c.stroke();
    c.globalAlpha = full ? 1 : 0.55;
    drawSpecialIcon(c, G.special);
    c.globalAlpha = 1;
    c.font = `13px ${FONT}`; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = INK;
    const label = SPECIALS[G.special].name;
    c.strokeText(label, 0, -b.r - 6); c.fillStyle = full ? '#FFC93C' : 'rgba(255,255,255,.75)'; c.fillText(label, 0, -b.r - 6);
    c.restore();
    // weapon boost from a power-up
    if (G.boost > 0) {
      const w = 64, k = clamp(G.boost / 14, 0, 1);
      c.fillStyle = 'rgba(12,8,22,.7)'; c.fillRect(78, VH - 34, w, 8);
      c.fillStyle = '#FFB020'; c.fillRect(78, VH - 34, w * k, 8);
      c.font = `12px ${FONT}`; c.textAlign = 'left'; c.fillStyle = '#FFE2A8'; c.fillText('+1 נשק', 78, VH - 40);
    }
    // coins
    const cy = G.boss && !G.bossPopped ? 58 : 20;
    drawCoin(c, VW - 78, cy, 7.5, 0);
    c.font = `17px ${FONT}`; c.textAlign = 'left';
    c.lineWidth = 3; c.strokeStyle = INK;
    const txt = `${G.coins}`;
    c.strokeText(txt, VW - 66, cy + 6); c.fillStyle = G.coins >= G.cfg.coinGoal ? '#FFC93C' : '#FFFFFF'; c.fillText(txt, VW - 66, cy + 6);
  }

  // ---------- Enemies, drawn ----------
  function drawEnemy(c, e) {
    // a warm danger glow behind every dragon, so it stands out from the ground
    c.save(); c.globalCompositeOperation = 'lighter';
    c.beginPath(); c.arc(e.x, e.y, e.r * 1.25, 0, TAU); c.fillStyle = 'rgba(255,90,40,.13)'; c.fill(); c.restore();
    c.save(); c.translate(e.x, e.y);
    c.scale(e.size, e.size);
    if (e.rot) c.rotate(e.rot);
    const P = DRAGONS[G.w];
    if (e.kind === 'spit') { c.scale(1.22, 1.22); drawDragon(c, e.anim, P, G.w, { angry: true, open: e.spat > 0 ? 1 : 0 }); }
    else drawDragon(c, e.anim, P, G.w, { angry: e.brute || e.splitter });
    if (e.brute) drawArmor(c);
    if (e.splitter) drawSplit(c, e.anim);
    if (e.caster) drawCaster(c, e.anim, e.spat > 0);
    c.restore();
    if (e.spat > 0) e.spat -= 1 / 60;
    if (e.warn) {
      c.font = `18px ${FONT}`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = INK;
      c.strokeText('!', e.x, e.y - e.r - 6); c.fillStyle = '#FF4D6D'; c.fillText('!', e.x, e.y - e.r - 6);
    }
    if (e.flash > 0 || e.slow > 0) {
      c.beginPath(); c.arc(e.x, e.y, e.r * 0.95, 0, TAU);
      c.fillStyle = e.flash > 0 ? 'rgba(255,255,255,.55)' : 'rgba(150,220,255,.35)'; c.fill();
    }
    // big enemies show how much is left
    if (e.maxHp >= 8 * hpK() * G.help && e.hp < e.maxHp) {
      const w = Math.min(56, e.r * 2);
      c.fillStyle = 'rgba(12,8,22,.85)'; c.fillRect(e.x - w / 2 - 1.5, e.y - e.r - 13, w + 3, 7);
      c.fillStyle = '#FF4D6D'; c.fillRect(e.x - w / 2, e.y - e.r - 11.5, w * Math.max(0, e.hp) / e.maxHp, 4);
    }
  }
  // A brute: a steel helmet and shoulder plates with rivets.
  function drawArmor(c) {
    c.strokeStyle = INK; c.lineWidth = 1.6;
    for (const sd of [-1, 1]) {
      c.beginPath(); c.ellipse(sd * 6.5, -3, 4.2, 5.5, sd * 0.3, 0, TAU); c.fillStyle = '#8A93A8'; c.fill(); c.stroke();
      c.beginPath(); c.arc(sd * 6.5, -3, 0.9, 0, TAU); c.fillStyle = '#E0E6F0'; c.fill();
    }
    c.beginPath(); c.arc(0, 9, 8, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fillStyle = '#9AA3B8'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-2, 2.5); c.lineTo(0, -3.5); c.lineTo(2, 2.5); c.closePath(); c.fillStyle = '#E0E6F0'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-7.5, 7.5); c.lineTo(7.5, 7.5); c.strokeStyle = '#5A6078'; c.lineWidth = 1.2; c.stroke();
  }
  // A splitter: a glowing crack down the middle, where it will split.
  function drawSplit(c, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.beginPath(); c.moveTo(0, -12); c.lineTo(1.6, -6); c.lineTo(-1.6, -1); c.lineTo(1.6, 4); c.lineTo(0, 14);
    c.strokeStyle = `rgba(255,120,240,${0.6 + 0.3 * Math.sin(t * 8)})`; c.lineWidth = 2.2; c.stroke();
    c.restore();
  }
  // A caster: a glowing orb floating in front of it (it flares when it shoots) and a crown of horns.
  function drawCaster(c, t, firing) {
    c.strokeStyle = INK; c.lineWidth = 1.3;
    for (const a of [-0.6, -0.2, 0.2, 0.6]) {
      c.save(); c.translate(0, 4); c.rotate(a + Math.PI);
      c.beginPath(); c.moveTo(-1.4, 0); c.lineTo(0, 6); c.lineTo(1.4, 0); c.closePath(); c.fillStyle = '#E8D0FF'; c.fill(); c.stroke(); c.restore();
    }
    const r = (firing ? 6.5 : 4.5) + Math.sin(t * 6) * 0.6;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.beginPath(); c.arc(0, 24, r * 2.2, 0, TAU); c.fillStyle = 'rgba(255,80,220,.25)'; c.fill();
    c.beginPath(); c.arc(0, 24, r, 0, TAU); c.fillStyle = 'rgba(255,150,240,.9)'; c.fill();
    c.beginPath(); c.arc(0, 24, r * 0.45, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill();
    c.restore();
  }
  function fillStroke(c, fill) { c.fillStyle = fill; c.fill(); c.stroke(); }
  // A dragon flying down at you: tail up top, wings out, head at the bottom. About 50 wide.
  function drawDragon(c, t, P, w, o) {
    const k = o.lw || 1, f = Math.sin(t * (o.boss ? 6 : 13));
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    // tail
    const sw = Math.sin(t * 3), tx = Math.sin(t * 3 + 1) * 5, ty = -27;
    c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(sw * 8, -18, tx, ty);
    c.lineWidth = 6.5 * k; c.stroke(); c.lineWidth = 3.6 * k; c.strokeStyle = P.c; c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.8 * k;
    c.save(); c.translate(tx, ty); c.rotate(sw * 0.3);
    c.beginPath(); c.moveTo(0, -8); c.lineTo(4, -1); c.lineTo(0, 2); c.lineTo(-4, -1); c.closePath(); fillStroke(c, P.horn);
    c.restore();
    // wings
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(sd * 5, -4);
      c.quadraticCurveTo(sd * 14, -17 - f * 6, sd * 25, -11 - f * 7);
      c.lineTo(sd * 21, -3 - f * 3); c.quadraticCurveTo(sd * 17, -4, sd * 15, 1);
      c.quadraticCurveTo(sd * 11, -1, sd * 7, 4); c.closePath();
      c.lineWidth = 1.9 * k; fillStroke(c, P.wing);
      c.beginPath(); c.moveTo(sd * 6, -3); c.lineTo(sd * 21, -9 - f * 5); c.strokeStyle = P.dark; c.lineWidth = 1.3 * k; c.stroke(); c.strokeStyle = INK;
    }
    // body, with spikes down the back
    c.lineWidth = 1.9 * k;
    for (const y of [-9, -4]) { c.beginPath(); c.moveTo(-2.4, y + 1); c.lineTo(0, y - 3.5); c.lineTo(2.4, y + 1); fillStroke(c, P.horn); }
    c.beginPath(); c.ellipse(0, -1, 8.5, 9.5, 0, 0, TAU); fillStroke(c, P.c);
    c.beginPath(); c.ellipse(0, 0.5, 4.6, 6.2, 0, 0, TAU); c.fillStyle = P.belly; c.fill();
    // horns
    for (const sd of [-1, 1]) {
      c.beginPath();
      if (o.boss) { c.moveTo(sd * 3, 4.5); c.quadraticCurveTo(sd * 10, 2, sd * 11, -5); c.quadraticCurveTo(sd * 10, 5, sd * 6.5, 7.5); }
      else { c.moveTo(sd * 3, 4.5); c.quadraticCurveTo(sd * 8, 3, sd * 8.5, -1); c.quadraticCurveTo(sd * 8.5, 5, sd * 6.5, 7); }
      c.closePath(); fillStroke(c, P.horn);
    }
    // head
    c.beginPath(); c.ellipse(0, 9, 7, 6.6, 0, 0, TAU); fillStroke(c, P.c);
    c.beginPath(); c.ellipse(0, 13, 4.6, 3.4, 0, 0, TAU); fillStroke(c, P.belly);
    c.fillStyle = INK;
    for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 1.7, 14, 0.7, 0, TAU); c.fill(); }
    if (o.open) { c.beginPath(); c.ellipse(0, 16, 3, 1.9, 0, 0, TAU); c.fillStyle = '#FF2D55'; c.fill(); }
    if (o.boss) {
      c.fillStyle = '#FFFFFF';
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 3.6, 15); c.lineTo(sd * 2.6, 17.6); c.lineTo(sd * 1.6, 15.6); c.closePath(); c.fill(); }
    }
    for (const sd of [-1, 1]) {
      c.beginPath(); c.ellipse(sd * 3.1, 7.8, 2.1, 1.6, sd * 0.35, 0, TAU); c.fillStyle = o.boss ? '#FFE95C' : '#FFFFFF'; c.fill(); c.lineWidth = 1.1 * k; c.stroke();
      c.beginPath(); c.arc(sd * 3, 8.3, 0.95, 0, TAU); c.fillStyle = INK; c.fill();
      if (o.angry || o.boss) { c.beginPath(); c.moveTo(sd * 5.6, 5); c.lineTo(sd * 1.2, 6.4); c.lineWidth = 1.4 * k; c.stroke(); }
    }
  }
  // ---------- The five bosses: each one its own big, detailed, animated dragon ----------
  // Drawn facing down at you (tail up, head at the bottom), about 300 wide at scale 1. B: the live boss (or null for the map icon).
  function drawBoss(c, w, t, B, scale = 1) {
    c.save(); c.scale(scale, scale);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
    const open = B && (B.act || (B.charge && B.charge.t < 1.5)) ? 1 : 0;
    [bossLava, bossSwamp, bossBones, bossCrystal, bossStorm][w](c, t, open);
    c.restore();
  }
  const glowOn = (c) => { c.save(); c.globalCompositeOperation = 'lighter'; };
  function fs(c, fill, lw = 3) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
  function path(c, pts, close = true) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath(); }
  // A bat-like wing from the shoulder: ribs out to the tips, scalloped bottom edge.
  function batWing(c, sd, f, o) {
    const tips = [[150, -78 - f * 26], [138, -24 - f * 16], [112, 14 - f * 8], [76, 40 - f * 3]];
    c.save(); c.scale(sd, 1);
    c.beginPath(); c.moveTo(26, -30);
    c.quadraticCurveTo(80, -110 - f * 30, tips[0][0], tips[0][1]);
    for (let i = 1; i < tips.length; i++) {
      const [px, py] = tips[i - 1], [x, y] = tips[i];
      c.quadraticCurveTo((px + x) / 2 - 8, (py + y) / 2 - 2, x, y);
    }
    c.quadraticCurveTo(52, 34, 30, 22); c.closePath();
    if (o.fill) fs(c, o.fill, o.lw || 3);
    if (o.ribs) {
      c.beginPath(); for (const [x, y] of tips) { c.moveTo(28, -26); c.quadraticCurveTo(x * 0.5, y * 0.6 - 16, x, y); }
      c.strokeStyle = o.ribs; c.lineWidth = o.ribW || 3; c.stroke();
    }
    c.restore();
    return tips;
  }

  // 1. Lava: a molten dragon with glowing cracks, obsidian horns, a burning tail and dripping magma.
  function bossLava(c, t, open) {
    const f = Math.sin(t * 5), pulse = 0.6 + 0.4 * Math.sin(t * 4);
    // tail with a flame on the end
    const tx = Math.sin(t * 2) * 30, ty = -150;
    c.beginPath(); c.moveTo(0, -40); c.bezierCurveTo(-20, -80, tx + 20, -110, tx, ty);
    c.lineWidth = 26; c.strokeStyle = INK; c.stroke(); c.lineWidth = 19; c.strokeStyle = '#5A1A10'; c.stroke();
    c.lineWidth = 3; c.strokeStyle = '#FF7A1A'; c.setLineDash([8, 10]); c.stroke(); c.setLineDash([]);
    glowOn(c);
    for (let i = 0; i < 4; i++) {
      const h = 34 + i * 6 + Math.sin(t * 13 + i) * 6;
      c.beginPath(); c.moveTo(tx - 14 + i * 2, ty + 6); c.quadraticCurveTo(tx - 10 + Math.sin(t * 9 + i) * 6, ty - h * 0.6, tx + Math.sin(t * 11 + i) * 4, ty - h);
      c.quadraticCurveTo(tx + 10 + Math.sin(t * 7 + i) * 6, ty - h * 0.6, tx + 14 - i * 2, ty + 6); c.closePath();
      c.fillStyle = ['rgba(255,60,20,.5)', 'rgba(255,130,30,.5)', 'rgba(255,200,60,.55)', 'rgba(255,255,200,.6)'][i]; c.fill();
    }
    c.restore();
    // wings: dark membrane, glowing ribs and hot edges
    for (const sd of [-1, 1]) {
      const tips = batWing(c, sd, f, { fill: '#2A0E0C', ribs: '#FF6A1A', ribW: 3.5 });
      glowOn(c); c.scale(sd, 1);
      for (const [x, y] of tips) { c.beginPath(); c.arc(x, y, 6 + pulse * 3, 0, TAU); c.fillStyle = 'rgba(255,120,40,.5)'; c.fill(); }
      c.restore();
      // magma drips falling from the wing tips
      c.save(); c.scale(sd, 1);
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.8 + i * 0.33) % 1, [x, y] = tips[i + 1];
        c.globalAlpha = 1 - k; c.beginPath(); c.ellipse(x, y + 10 + k * 70, 3.5, 5, 0, 0, TAU); c.fillStyle = '#FF8A2A'; c.fill();
      }
      c.restore();
    }
    // body
    c.beginPath(); c.ellipse(0, -2, 50, 60, 0, 0, TAU); fs(c, '#5A1A10', 4);
    c.beginPath(); c.ellipse(0, 6, 28, 42, 0, 0, TAU); c.fillStyle = '#7A2A14'; c.fill();
    c.strokeStyle = '#C2481E'; c.lineWidth = 3;
    for (const y of [-14, 0, 14, 28]) { c.beginPath(); c.moveTo(-22, y); c.quadraticCurveTo(0, y + 8, 22, y); c.stroke(); }
    // glowing cracks
    glowOn(c);
    c.strokeStyle = `rgba(255,${120 + pulse * 80},40,${0.6 + pulse * 0.4})`; c.lineWidth = 3;
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(sd * 44, -30); c.lineTo(sd * 30, -12); c.lineTo(sd * 40, 4); c.lineTo(sd * 28, 22); c.lineTo(sd * 36, 40); c.stroke();
      c.beginPath(); c.moveTo(sd * 30, -12); c.lineTo(sd * 16, -20); c.stroke();
    }
    c.restore();
    // obsidian spikes down the back
    for (const y of [-52, -38, -24]) { path(c, [[-8, y + 8], [0, y - 14], [8, y + 8]]); fs(c, '#140808', 2.5); }
    // head
    path(c, [[-30, 40], [30, 40], [26, 70], [14, 96], [-14, 96], [-26, 70]]); fs(c, '#6A2010', 4);
    // horns: obsidian, swept back
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(sd * 18, 46); c.quadraticCurveTo(sd * 52, 36, sd * 58, 2); c.quadraticCurveTo(sd * 44, 28, sd * 26, 58); c.closePath(); fs(c, '#1A0A0A', 3);
      c.beginPath(); c.moveTo(sd * 24, 48); c.quadraticCurveTo(sd * 46, 40, sd * 54, 12); c.strokeStyle = '#5A2A20'; c.lineWidth = 2; c.stroke();
    }
    // eyes: angry glowing slits
    glowOn(c);
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(sd * 6, 62); c.lineTo(sd * 24, 54); c.lineTo(sd * 20, 66); c.closePath();
      c.fillStyle = '#FFE45C'; c.fill();
      c.beginPath(); c.arc(sd * 16, 60, 12, 0, TAU); c.fillStyle = 'rgba(255,160,40,.3)'; c.fill();
    }
    c.restore();
    // mouth: a glowing maw when it attacks
    if (open) {
      glowOn(c);
      c.beginPath(); c.ellipse(0, 92, 14, 8, 0, 0, TAU); c.fillStyle = '#FFD23F'; c.fill();
      c.beginPath(); c.arc(0, 98, 26, 0, TAU); c.fillStyle = 'rgba(255,120,30,.35)'; c.fill();
      c.restore();
    } else { c.beginPath(); c.moveTo(-10, 90); c.lineTo(10, 90); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
    c.fillStyle = '#FFF4D0';
    for (const sd of [-1, 1]) { path(c, [[sd * 6, 92], [sd * 9, 102], [sd * 12, 92]]); c.fill(); }
  }

  // 2. Swamp: a mossy bog dragon with torn wings, glowing mushrooms on its back, three eyes and ghost wisps.
  function bossSwamp(c, t, open) {
    const f = Math.sin(t * 4);
    // ghost wisps circling it
    glowOn(c);
    for (let i = 0; i < 4; i++) {
      const a = t * 0.9 + i * 1.57, x = Math.cos(a) * 140, y = Math.sin(a) * 70 - 10;
      c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fillStyle = 'rgba(120,255,190,.18)'; c.fill();
      c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fillStyle = 'rgba(200,255,230,.6)'; c.fill();
    }
    c.restore();
    // a long tail with a spiked club
    const tx = Math.sin(t * 1.6) * 34, ty = -145;
    c.beginPath(); c.moveTo(0, -40); c.bezierCurveTo(30, -80, tx - 30, -110, tx, ty);
    c.lineWidth = 22; c.strokeStyle = INK; c.stroke(); c.lineWidth = 15; c.strokeStyle = '#2E4A3A'; c.stroke();
    c.beginPath(); c.arc(tx, ty, 14, 0, TAU); fs(c, '#3A5A44');
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; path(c, [[tx + Math.cos(a - 0.3) * 12, ty + Math.sin(a - 0.3) * 12], [tx + Math.cos(a) * 24, ty + Math.sin(a) * 24], [tx + Math.cos(a + 0.3) * 12, ty + Math.sin(a + 0.3) * 12]]); fs(c, '#C8D8C0', 2); }
    // torn wings, with holes and hanging moss
    for (const sd of [-1, 1]) {
      const tips = batWing(c, sd, f, { fill: '#1E3428', ribs: '#5A7A5A', ribW: 4 });
      c.save(); c.scale(sd, 1);
      c.fillStyle = 'rgba(6,12,10,.9)';
      for (const [x, y, r] of [[96, -40, 10], [120, -10, 7], [70, 0, 8], [104, 20, 6]]) { c.beginPath(); c.ellipse(x, y - f * 10, r, r * 0.7, 0.4, 0, TAU); c.fill(); }
      c.strokeStyle = '#6A9A5A'; c.lineWidth = 2.5;
      for (const [x, y] of tips.slice(1)) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(t * 3 + x) * 6, y + 18, x - 2, y + 30); c.stroke(); }
      c.restore();
    }
    // body: lumpy and mossy
    c.beginPath();
    for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, r = 1 + Math.sin(i * 3.1) * 0.05; const x = Math.cos(a) * 52 * r, y = -2 + Math.sin(a) * 60 * r; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); fs(c, '#2E4A3A', 4);
    c.fillStyle = '#3E6A44';
    for (const [x, y, r] of [[-24, -30, 14], [20, -38, 12], [-8, -8, 10], [26, 6, 11], [-28, 18, 9]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.beginPath(); c.ellipse(0, 20, 24, 30, 0, 0, TAU); c.fillStyle = '#C89AA8'; c.fill();
    // glowing mushrooms growing on its back
    for (const [x, y, col] of [[-22, -42, '#4AF0FF'], [14, -48, '#C77DFF'], [30, -20, '#7CFF8A'], [-34, -10, '#C77DFF']]) {
      glowOn(c); c.beginPath(); c.arc(x, y - 4, 16, 0, TAU); c.fillStyle = `${col}33`; c.fill(); c.restore();
      c.fillStyle = '#E0E8D0'; c.fillRect(x - 2, y - 2, 4, 9);
      c.beginPath(); c.moveTo(x - 9, y); c.quadraticCurveTo(x, y - 14, x + 9, y); c.closePath(); fs(c, col, 2);
    }
    // head: broad and toad-like
    c.beginPath(); c.ellipse(0, 66, 40, 30, 0, 0, TAU); fs(c, '#3A5A44', 4);
    c.beginPath(); c.ellipse(0, 82, 30, 13, 0, 0, TAU); c.fillStyle = '#2A4030'; c.fill();
    // three glowing eyes
    for (const [x, y, r] of [[-18, 58, 7], [18, 58, 7], [0, 48, 6]]) {
      glowOn(c); c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.fillStyle = 'rgba(180,255,80,.3)'; c.fill(); c.restore();
      c.beginPath(); c.arc(x, y, r, 0, TAU); fs(c, '#D8FF6A', 2);
      c.beginPath(); c.ellipse(x, y, r * 0.25, r * 0.8, 0, 0, TAU); c.fillStyle = INK; c.fill();
    }
    // mouth, with slime dripping
    c.beginPath(); c.moveTo(-26, 82); c.quadraticCurveTo(0, open ? 106 : 92, 26, 82); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    if (open) { c.beginPath(); c.moveTo(-24, 83); c.quadraticCurveTo(0, 104, 24, 83); c.quadraticCurveTo(0, 90, -24, 83); c.fillStyle = '#3A0A1A'; c.fill(); }
    glowOn(c);
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.7 + i * 0.37) % 1, x = -14 + i * 14;
      c.beginPath(); c.ellipse(x, 88 + k * 40, 3, 4 + k * 3, 0, 0, TAU); c.fillStyle = `rgba(150,255,90,${0.8 * (1 - k)})`; c.fill();
    }
    c.restore();
  }

  // 3. Bones: a skeleton dragon - skull, ribcage with a burning heart inside, bone wings, a spine for a tail.
  function bossBones(c, t, open) {
    const f = Math.sin(t * 4.5), beat = 0.7 + 0.3 * Math.abs(Math.sin(t * 3));
    glowOn(c); c.beginPath(); c.arc(0, 0, 150, 0, TAU); c.fillStyle = 'rgba(120,40,200,.1)'; c.fill(); c.restore();
    // the spine tail: a line of vertebrae
    for (let i = 0; i < 9; i++) {
      const k = i / 8, x = Math.sin(t * 2 + k * 3) * 26 * k, y = -46 - k * 110;
      c.beginPath(); c.ellipse(x, y, 10 - k * 4, 7 - k * 2, 0, 0, TAU); fs(c, '#E6DCC4', 2.5);
      path(c, [[x - 4, y - 4], [x, y - 14 + k * 4], [x + 4, y - 4]]); fs(c, '#CFC3A6', 2);
    }
    // bone wings: long finger bones with a thin torn membrane between them
    for (const sd of [-1, 1]) {
      c.save(); c.scale(sd, 1);
      const tips = [[154, -82 - f * 26], [142, -26 - f * 16], [116, 14 - f * 8], [80, 40 - f * 3]];
      c.beginPath(); c.moveTo(28, -26);
      for (const [x, y] of tips) c.lineTo(x, y);
      c.lineTo(34, 24); c.closePath(); c.fillStyle = 'rgba(60,30,90,.45)'; c.fill();
      c.lineWidth = 9; c.strokeStyle = INK;
      for (const [x, y] of tips) { c.beginPath(); c.moveTo(28, -26); c.quadraticCurveTo(x * 0.5, y * 0.6 - 18, x, y); c.stroke(); }
      c.lineWidth = 5; c.strokeStyle = '#E6DCC4';
      for (const [x, y] of tips) { c.beginPath(); c.moveTo(28, -26); c.quadraticCurveTo(x * 0.5, y * 0.6 - 18, x, y); c.stroke(); }
      for (const [x, y] of tips) { c.beginPath(); c.arc(x, y, 5, 0, TAU); fs(c, '#E6DCC4', 2); }
      c.restore();
    }
    // the heart burning inside the ribs
    glowOn(c);
    c.beginPath(); c.arc(0, -4, 34 * beat, 0, TAU); c.fillStyle = 'rgba(255,40,60,.25)'; c.fill();
    c.beginPath(); c.arc(0, -4, 15 * beat, 0, TAU); c.fillStyle = 'rgba(255,90,90,.85)'; c.fill();
    c.restore();
    // spine and ribs
    c.lineWidth = 10; c.strokeStyle = INK; c.beginPath(); c.moveTo(0, -50); c.lineTo(0, 40); c.stroke();
    c.lineWidth = 6; c.strokeStyle = '#E6DCC4'; c.stroke();
    for (let i = 0; i < 5; i++) {
      const y = -38 + i * 15, w = 44 - Math.abs(i - 1.5) * 6;
      for (const sd of [-1, 1]) {
        c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(sd * w, y - 8, sd * (w + 6), y + 14, sd * (w - 10), y + 22);
        c.lineWidth = 8; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4.5; c.strokeStyle = '#D9CFB8'; c.stroke();
      }
    }
    // skull
    c.beginPath(); c.moveTo(-34, 44); c.quadraticCurveTo(0, 26, 34, 44); c.lineTo(30, 72); c.lineTo(18, 100); c.lineTo(-18, 100); c.lineTo(-30, 72); c.closePath(); fs(c, '#E6DCC4', 4);
    for (const sd of [-1, 1]) {
      c.beginPath(); c.moveTo(sd * 22, 44); c.quadraticCurveTo(sd * 50, 30, sd * 60, -6); c.quadraticCurveTo(sd * 46, 26, sd * 30, 54); c.closePath(); fs(c, '#BFB294', 3);
    }
    c.beginPath(); c.moveTo(-28, 74); c.lineTo(28, 74); c.lineWidth = 2; c.strokeStyle = '#A89A7C'; c.stroke();
    // eye sockets with burning eyes
    for (const sd of [-1, 1]) {
      c.beginPath(); c.ellipse(sd * 14, 58, 10, 9, sd * 0.3, 0, TAU); c.fillStyle = '#1A1012'; c.fill();
      glowOn(c); c.beginPath(); c.arc(sd * 14, 58, 12, 0, TAU); c.fillStyle = 'rgba(255,40,40,.35)'; c.fill();
      c.beginPath(); c.arc(sd * 14, 58, 4 + beat, 0, TAU); c.fillStyle = '#FF5A3A'; c.fill(); c.restore();
    }
    c.beginPath(); path(c, [[-4, 76], [0, 70], [4, 76]]); c.fillStyle = '#1A1012'; c.fill();
    // jaw with teeth (it drops open when it attacks)
    const jaw = open ? 10 : 0;
    c.fillStyle = '#F4EEDC';
    for (let i = -2; i <= 2; i++) { path(c, [[i * 7 - 3, 96], [i * 7, 106 + jaw * 0.3], [i * 7 + 3, 96]]); fs(c, '#F4EEDC', 1.5); }
    c.beginPath(); c.moveTo(-18, 102 + jaw); c.lineTo(18, 102 + jaw); c.lineTo(12, 114 + jaw); c.lineTo(-12, 114 + jaw); c.closePath(); fs(c, '#D9CFB8', 3);
  }

  // 4. Crystal: a faceted dragon of gem stone, see-through crystal wings and a shining core.
  function bossCrystal(c, t, open) {
    const f = Math.sin(t * 4), pulse = 0.6 + 0.4 * Math.sin(t * 3);
    // tail of stacked crystal shards
    for (let i = 0; i < 6; i++) {
      const k = i / 5, x = Math.sin(t * 1.8 + k * 2) * 24 * k, y = -48 - k * 100, s = 16 - k * 7;
      path(c, [[x, y - s * 1.6], [x + s, y], [x, y + s * 0.8], [x - s, y]]); fs(c, i % 2 ? '#7B5CFF' : '#4AF0FF', 2.5);
    }
    // wings: see-through, faceted, glowing edges
    for (const sd of [-1, 1]) {
      c.save(); c.scale(sd, 1);
      const pts = [[30, -30], [92, -96 - f * 28], [158, -66 - f * 24], [140, -10 - f * 14], [106, 26 - f * 6], [36, 20]];
      glowOn(c); path(c, pts); c.fillStyle = 'rgba(90,200,255,.22)'; c.fill(); c.restore();
      path(c, pts); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      glowOn(c);
      c.beginPath(); for (const [x, y] of pts.slice(1, 5)) { c.moveTo(30, -10); c.lineTo(x, y); }
      c.strokeStyle = 'rgba(170,240,255,.7)'; c.lineWidth = 2; c.stroke();
      path(c, pts); c.strokeStyle = 'rgba(120,230,255,.9)'; c.lineWidth = 2; c.stroke();
      c.restore(); c.restore();
    }
    // body: a gem with facets
    const body = [[0, -64], [40, -40], [50, 0], [36, 40], [0, 56], [-36, 40], [-50, 0], [-40, -40]];
    path(c, body); fs(c, '#3A2A7A', 4);
    c.strokeStyle = '#6A5AC8'; c.lineWidth = 2; c.beginPath();
    for (const [x, y] of body) { c.moveTo(0, -4); c.lineTo(x, y); } c.stroke();
    // the core
    glowOn(c);
    c.beginPath(); c.arc(0, -4, 36 * pulse, 0, TAU); c.fillStyle = 'rgba(255,80,220,.25)'; c.fill();
    path(c, [[0, -24], [14, -4], [0, 16], [-14, -4]]); c.fillStyle = 'rgba(255,170,250,.95)'; c.fill();
    c.restore();
    // crystal spikes on the shoulders and back
    for (const [x, y, h, col] of [[-30, -44, 34, '#4AF0FF'], [30, -44, 34, '#FF4FD8'], [-12, -58, 26, '#B8A8FF'], [12, -58, 26, '#4AF0FF'], [-46, -12, 24, '#FF4FD8'], [46, -12, 24, '#B8A8FF']]) {
      path(c, [[x - 7, y + 6], [x + (x > 0 ? 4 : -4), y - h], [x + 7, y + 6]]); fs(c, col, 2.5);
      path(c, [[x + (x > 0 ? 4 : -4), y - h], [x + 2, y + 4], [x + 7, y + 6]]); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
    }
    // head: angular, with crystal horns
    path(c, [[-28, 46], [28, 46], [22, 80], [8, 102], [-8, 102], [-22, 80]]); fs(c, '#4A3A9A', 4);
    c.strokeStyle = '#7A6AD8'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 46); c.lineTo(0, 100); c.moveTo(-22, 80); c.lineTo(22, 80); c.stroke();
    for (const sd of [-1, 1]) { path(c, [[sd * 18, 50], [sd * 54, 6], [sd * 30, 58]]); fs(c, '#4AF0FF', 3); }
    glowOn(c);
    for (const sd of [-1, 1]) {
      path(c, [[sd * 6, 66], [sd * 22, 60], [sd * 18, 70]]); c.fillStyle = '#FFFFFF'; c.fill();
      c.beginPath(); c.arc(sd * 15, 65, 12, 0, TAU); c.fillStyle = 'rgba(120,230,255,.3)'; c.fill();
    }
    if (open) { c.beginPath(); c.ellipse(0, 96, 10, 7, 0, 0, TAU); c.fillStyle = 'rgba(255,120,240,.9)'; c.fill(); }
    // twinkles
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.6 + i / 6) % 1, a = i * 1.7, x = Math.cos(a) * (60 + i * 14), y = Math.sin(a) * 60 - 10;
      const s = Math.sin(k * Math.PI) * 6;
      c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.25, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.25, y); c.closePath();
      c.moveTo(x - s, y); c.lineTo(x, y + s * 0.25); c.lineTo(x + s, y); c.lineTo(x, y - s * 0.25); c.closePath();
      c.fillStyle = '#FFFFFF'; c.fill();
    }
    c.restore();
  }

  // 5. Storm: a dark thunder dragon with lightning running over it and sparks jumping between its horns.
  function bossStorm(c, t, open) {
    const f = Math.sin(t * 5), rnd = mulberry(Math.floor(t * 14));
    const zig = (x0, y0, x1, y1, n, j) => { c.beginPath(); c.moveTo(x0, y0); for (let i = 1; i < n; i++) { const u = i / n; c.lineTo(x0 + (x1 - x0) * u + (rnd() - 0.5) * j, y0 + (y1 - y0) * u + (rnd() - 0.5) * j); } c.lineTo(x1, y1); };
    // tail ending in a crackling orb
    const tx = Math.sin(t * 2.2) * 30, ty = -150;
    c.beginPath(); c.moveTo(0, -40); c.bezierCurveTo(-26, -80, tx + 26, -112, tx, ty);
    c.lineWidth = 22; c.strokeStyle = INK; c.stroke(); c.lineWidth = 15; c.strokeStyle = '#1A2240'; c.stroke();
    glowOn(c);
    c.beginPath(); c.arc(tx, ty, 22, 0, TAU); c.fillStyle = 'rgba(90,170,255,.35)'; c.fill();
    c.beginPath(); c.arc(tx, ty, 10, 0, TAU); c.fillStyle = '#D8EEFF'; c.fill();
    zig(tx, ty, tx + (rnd() - 0.5) * 60, ty - 30, 5, 14); c.strokeStyle = '#BFE4FF'; c.lineWidth = 2; c.stroke();
    c.restore();
    // wings with glowing edges and storm clouds along them
    for (const sd of [-1, 1]) {
      const tips = batWing(c, sd, f, { fill: '#121830', ribs: '#2A3A6A', ribW: 4 });
      c.save(); c.scale(sd, 1);
      glowOn(c);
      c.beginPath(); c.moveTo(26, -30); c.quadraticCurveTo(80, -110 - f * 30, tips[0][0], tips[0][1]);
      c.strokeStyle = 'rgba(110,190,255,.8)'; c.lineWidth = 3; c.stroke();
      if (rnd() < 0.5) { const [x, y] = tips[1 + Math.floor(rnd() * 3)]; zig(x, y, x + (rnd() - 0.5) * 40, y + 40, 5, 12); c.strokeStyle = '#FFF6B0'; c.lineWidth = 2; c.stroke(); }
      c.restore();
      c.fillStyle = 'rgba(40,50,80,.9)';
      for (const [x, y, r] of [[70, -70 - f * 18, 16], [96, -78 - f * 22, 13], [120, -74 - f * 24, 11]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      c.restore();
    }
    // body, with lightning veins
    c.beginPath(); c.ellipse(0, -2, 48, 60, 0, 0, TAU); fs(c, '#1A2240', 4);
    c.beginPath(); c.ellipse(0, 8, 24, 38, 0, 0, TAU); c.fillStyle = '#26305A'; c.fill();
    glowOn(c);
    for (let i = 0; i < 3; i++) { zig(rnd() * 60 - 30, -50, rnd() * 60 - 30, 44, 6, 22); c.strokeStyle = i ? 'rgba(140,200,255,.55)' : 'rgba(255,246,176,.9)'; c.lineWidth = i ? 2 : 2.5; c.stroke(); }
    c.restore();
    // a mane of energy spikes
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + 0.25 + i * (Math.PI - 0.5) / 6, x = Math.cos(a) * 46, y = Math.sin(a) * 30 + 34;
      path(c, [[x - 6, y + 4], [x * 1.5, y - 24 + Math.sin(t * 6 + i) * 4], [x + 6, y + 4]]); fs(c, '#3E6AC8', 2.5);
    }
    // head
    path(c, [[-30, 42], [30, 42], [26, 72], [12, 100], [-12, 100], [-26, 72]]); fs(c, '#222C50', 4);
    // horns, with sparks jumping between them
    for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 18, 46); c.lineTo(sd * 54, 0); c.lineTo(sd * 28, 54); c.closePath(); fs(c, '#9AB0D8', 3); }
    glowOn(c);
    zig(-54, 0, 54, 0, 9, 18); c.strokeStyle = 'rgba(160,210,255,.6)'; c.lineWidth = 5; c.stroke();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.8; c.stroke();
    // white-hot eyes
    for (const sd of [-1, 1]) {
      c.beginPath(); c.arc(sd * 15, 62, 14, 0, TAU); c.fillStyle = 'rgba(140,200,255,.35)'; c.fill();
      path(c, [[sd * 5, 66], [sd * 24, 58], [sd * 20, 69]]); c.fillStyle = '#FFFFFF'; c.fill();
    }
    if (open) { c.beginPath(); c.ellipse(0, 94, 12, 8, 0, 0, TAU); c.fillStyle = '#D8F0FF'; c.fill(); zig(0, 98, (rnd() - 0.5) * 30, 140, 5, 12); c.strokeStyle = '#FFF6B0'; c.lineWidth = 2.5; c.stroke(); }
    c.restore();
  }
  function drawBossLive(c) {
    const B = G.boss;
    c.save(); c.translate(B.x, B.y);
    if (B.charge && B.charge.t < 0.8) {
      // the warning before a dive: a red stripe where it will come down
      c.save(); c.translate(B.charge.tx - B.x, 0);
      c.fillStyle = `rgba(255,40,70,${0.18 + 0.12 * Math.sin(B.charge.t * 30)})`;
      c.fillRect(-62, 40, 124, VH * 0.6);
      c.restore();
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    c.beginPath(); c.arc(0, 0, 110, 0, TAU); c.fillStyle = 'rgba(255,80,40,.12)'; c.fill();
    if (B.phase === 2) {
      const k = 0.5 + 0.5 * Math.sin(G.t * 6);
      c.beginPath(); c.arc(0, 10, 150 + k * 14, 0, TAU); c.fillStyle = `rgba(255,30,40,${0.14 + 0.1 * k})`; c.fill();
      for (let i = 0; i < 6; i++) { const a = G.t * 1.5 + i * 1.05; c.beginPath(); c.arc(Math.cos(a) * 120, 10 + Math.sin(a) * 90, 7, 0, TAU); c.fillStyle = 'rgba(255,90,60,.6)'; c.fill(); }
    }
    c.restore();
    if (B.phase === 2) c.scale(1.08, 1.08);
    drawBoss(c, G.w, G.t, B);
    if (B.flash > 0) { c.beginPath(); c.arc(0, 0, B.r, 0, TAU); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill(); }
    c.restore();
  }

  // ---------- Title screen: the heads ----------
  let shownHead = 'fire';
  // The title is the monster's lair: it hovers over a rune circle and really fires with the heads you picked.
  // Tap a head card to put it in or take it out (up to 3); tap a slot under the monster to take that head out.
  const lair = { t: 0, last: 0, shots: [], gusts: [], fx: [], clouds: [], meteors: [], bits: [], cool: {}, grow: {}, pop: {}, beam: null, meteorT: 0, roarFx: 0, P: { x: 0, y: 0 } };
  const isOpen = (id) => id === 'fire' || rec().unlocked.includes(id);
  function growHead(id) {
    lair.grow[id] = 0; lair.pop[id] = true; lair.cool[id] = 0.5;
    sfx.tone(150, 0.32, 'sawtooth', 0.05, 0, 60); sfx.tone(520, 0.14, 'triangle', 0.05, 0.08, 900);
  }
  function dropHead(id) {
    const H = HEADS[id];
    for (let i = 0; i < 16; i++) lair.bits.push({ x: rand(-14, 14), y: rand(-50, -30), vx: rand(-60, 60), vy: rand(-70, 10), life: 0.6, max: 0.6, color: H.glow, size: rand(1.5, 3.5) });
    sfx.tone(330, 0.16, 'triangle', 0.05, 0, 140);
  }
  function pickHead(id) {
    sfx.init();
    shownHead = id;
    let note = '';
    if (!isOpen(id)) { sfx.tap(); buildTitle(); return; }
    const res = toggleHead(id);
    if (res === false) { sfx.tone(200, 0.12, 'square', 0.04); note = 'צריך לפחות ראש אחד'; }
    else if (res === 'off') dropHead(id);
    else { growHead(id); if (res !== 'on') { dropHead(res); note = `${HEADS[id].name} נכנס, ${HEADS[res].name} יצא (עד ${MAX_HEADS} ראשים)`; } }
    buildTitle();
    if (note) $('#charPerk').innerHTML = note;
  }
  const pips = (lv) => `<span class="pips">${[1, 2, 3, 4].map((k) => `<i class="${k <= lv ? 'on' : ''}"></i>`).join('')}</span>`;
  function buildTitle() {
    const box = $('#chars'), on = activeHeads();
    box.innerHTML = '';
    HEAD_ORDER.forEach((id, i) => {
      const H = HEADS[id], open = isOpen(id), act = on.includes(id);
      const b = document.createElement('button');
      b.className = `char head${open ? '' : ' locked'}${act ? ' sel' : open ? ' off' : ''}${id === shownHead ? ' shown' : ''}`;
      b.style.setProperty('--hc', H.c); b.style.setProperty('--hg', H.glow);
      b.setAttribute('aria-label', open ? H.name : `נעול, נפתח אחרי עולם ${i}`);
      b.setAttribute('aria-pressed', act);
      b.innerHTML = `<img src="${headURL(id)}" alt="">`
        + (!open ? `<span class="lock">🔒<small>${i}</small></span>` : act ? `<span class="mark on">${on.indexOf(id) + 1}</span>` : '<span class="mark add">+</span>')
        + (open ? pips(heroLevel(id)) : '');
      b.addEventListener('click', () => pickHead(id));
      box.appendChild(b);
    });
    // the three slots on the monster
    const slots = $('#slots');
    slots.innerHTML = '';
    for (let k = 0; k < MAX_HEADS; k++) {
      const id = on[k], b = document.createElement('button');
      b.className = `slot${id ? ' full' : ''}`;
      if (id) {
        b.style.setProperty('--hc', HEADS[id].c); b.style.setProperty('--hg', HEADS[id].glow);
        b.innerHTML = `<img src="${headURL(id)}" alt="">`;
        b.setAttribute('aria-label', `להוציא את ${HEADS[id].name}`);
        b.addEventListener('click', () => pickHead(id));
      } else {
        b.innerHTML = '<span>+</span>';
        b.setAttribute('aria-label', 'מקום פנוי לראש');
        b.addEventListener('click', () => { sfx.init(); sfx.tap(); $('#charPerk').innerHTML = 'בוחרים ראש מהרשימה למטה'; });
      }
      slots.appendChild(b);
    }
    $('#headCount').innerHTML = `ראשים בקרב <b>${on.length}/${MAX_HEADS}</b>`;
    const H = HEADS[shownHead], open = isOpen(shownHead), act = on.includes(shownHead);
    const perk = $('#charPerk');
    perk.style.setProperty('--hc', H.c);
    perk.innerHTML = !open ? `🔒 ${H.name} גדל אחרי עולם ${HEAD_ORDER.indexOf(shownHead)}`
      : `<b class="hn">${H.name}</b> ${H.lv[heroLevel(shownHead) - 1]} ${pips(heroLevel(shownHead))} <b class="${act ? 'is-on' : 'is-off'}">${act ? 'בקרב' : 'בחוץ'}</b>`;
  }

  // The lair's little show: the same shots as in the game, flying up out of the picture.
  function lairFire(heads, dt, top) {
    const L = lair, n = heads.length;
    L.beam = null;
    heads.forEach((id, k) => {
      if ((L.grow[id] ?? 1) < 1) return;
      const lv = heroLevel(id), h = headPos(L.P, k, n, L.t);
      if (id === 'ice') { L.beam = { x: h.x, y0: h.y, y1: top, w: 3 + lv * 1.2, hit: false }; return; }
      L.cool[id] = (L.cool[id] ?? rand(0, 0.4)) - dt;
      if (L.cool[id] > 0) return;
      L.pop[id] = false;
      const S = (x, y, a, sp, o) => L.shots.push({ id, x, y, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp, t: 0, ...o });
      if (id === 'fire') {
        L.cool[id] += 0.3;
        const r = lv >= 4 ? 6.5 : 5;
        const pat = lv === 1 ? [[0, 0]] : lv === 2 ? [[-4, 0], [4, 0]] : lv === 3 ? [[0, 0], [-2, -0.15], [2, 0.15]] : [[-4, 0], [4, 0], [-2, -0.18], [2, 0.18]];
        for (const [ox, a] of pat) S(h.x + ox, h.y, a + h.a * 0.2, 190, { r });
      } else if (id === 'poison') {
        L.cool[id] += 1.0;
        S(h.x, h.y, h.a * 0.3, 120, { glob: true, fuse: 0.42, lv, r: 5.5 });
      } else if (id === 'bolt') {
        L.cool[id] += 0.9;
        const pts = [{ x: h.x, y: h.y }];
        for (let j = 0; j < Math.min(4, lv + 1); j++) { const p = pts[pts.length - 1]; pts.push({ x: clamp(p.x + rand(-30, 30), -70, 70), y: p.y - rand(18, 28) }); }
        L.fx.push({ type: 'bolt', pts, t: 0.22, max: 0.22, seed: Math.random() * 100 });
      } else if (id === 'wind') {
        L.cool[id] += 0.8;
        L.gusts.push({ x: h.x, y: h.y - 4, vy: -120, life: 0.9, w: 22 + lv * 5 });
      } else if (id === 'star') {
        L.cool[id] += 0.55;
        const cnt = lv >= 3 ? 2 : 1;
        for (let i = 0; i < cnt; i++) S(h.x, h.y, h.a * 0.8 + (i - (cnt - 1) / 2) * 0.6, 130, { spin: 0, trail: [], r: 6, wob: rand(0, TAU) });
      }
    });
    for (const s of L.shots) {
      s.t += dt;
      if (s.id === 'star') {
        s.spin += dt * 8; s.trail.push(s.x, s.y); if (s.trail.length > 12) s.trail.splice(0, 2);
        s.vx += Math.sin(s.t * 7 + s.wob) * 300 * dt;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.glob) {
        s.fuse -= dt; s.vy *= Math.pow(0.3, dt);
        if (s.fuse <= 0) { s.dead = true; L.clouds.push({ x: s.x, y: s.y, r: 10 + s.lv * 2.5, life: 1.2, max: 1.2 }); }
      }
      if (s.y < top - 20) s.dead = true;
    }
    for (const g of L.gusts) { g.y += g.vy * dt; g.life -= dt; }
    for (const cl of L.clouds) cl.life -= dt;
    for (const f of L.fx) f.t -= dt;
    for (const p of L.bits) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt; }
    L.shots = L.shots.filter((s) => !s.dead);
    L.gusts = L.gusts.filter((g) => g.life > 0 && g.y > top - 30);
    L.clouds = L.clouds.filter((cl) => cl.life > 0);
    L.fx = L.fx.filter((f) => f.t > 0);
    L.bits = L.bits.filter((p) => p.life > 0);
  }
  // The rune circle under the monster, one coloured arc for each head in the fight.
  function drawAltar(c, heads, t) {
    c.save(); c.translate(0, 44); c.scale(0.86, 0.3);
    c.save(); c.globalCompositeOperation = 'lighter';
    if (!lair.glow || lair.glowC !== c) { lair.glowC = c; lair.glow = c.createRadialGradient(0, 0, 4, 0, 0, 70); lair.glow.addColorStop(0, 'rgba(150,110,255,.38)'); lair.glow.addColorStop(1, 'rgba(150,110,255,0)'); }
    c.fillStyle = lair.glow; c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.fill();
    c.restore();
    c.lineWidth = 2.4;
    const seg = TAU / MAX_HEADS;
    for (let k = 0; k < MAX_HEADS; k++) {
      const id = heads[k], a0 = t * 0.5 + k * seg + 0.12, a1 = a0 + seg - 0.24;
      c.beginPath(); c.arc(0, 0, 58, a0, a1);
      c.strokeStyle = id ? HEADS[id].c : 'rgba(255,255,255,.14)'; c.globalAlpha = id ? 0.95 : 1; c.stroke();
    }
    c.globalAlpha = 1;
    c.setLineDash([3, 7]); c.lineWidth = 1.5; c.strokeStyle = 'rgba(242,184,75,.55)';
    c.beginPath(); c.arc(0, 0, 46, -t * 0.8, -t * 0.8 + TAU); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 6; i++) {
      const a = -t * 0.8 + i * TAU / 6;
      c.beginPath(); c.arc(Math.cos(a) * 46, Math.sin(a) * 46, 3, 0, TAU); c.fillStyle = '#FFDE95'; c.fill();
    }
    c.restore();
  }
  function paintHero(cv2, t) {
    // The picture is only decoration, so it draws at a lighter resolution, and its size is read twice a second, not every frame.
    const L = lair;
    if (!L.sz || L.sz.cv !== cv2 || (L.frame = (L.frame || 0) + 1) % 30 === 0) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      L.sz = { cv: cv2, dpr, cw: cv2.clientWidth || 200, chh: cv2.clientHeight || 200, c: L.sz && L.sz.cv === cv2 ? L.sz.c : cv2.getContext('2d') };
      const W = Math.round(L.sz.cw * dpr), H = Math.round(L.sz.chh * dpr);
      if (cv2.width !== W || cv2.height !== H) { cv2.width = W; cv2.height = H; }
    }
    const { dpr, cw, chh, c } = L.sz;
    if (!chh || !cw) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv2.width, cv2.height);
    const dt = clamp(t - L.last, 0, 0.05);
    L.last = t; L.t = t;
    const s = Math.min(chh / 140, cw / 150), oy = chh * 0.64, top = -oy / s;
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * cw / 2, dpr * oy);
    const heads = activeHeads(), open = {}, grow = {};
    for (const id of heads) {
      if (L.grow[id] != null && L.grow[id] < 1.6) {
        L.grow[id] += dt * 3.2;
        if (L.grow[id] >= 1.6) delete L.grow[id];
      }
      const g = L.grow[id];
      // a springy grow: overshoot a little, then settle
      grow[id] = g == null ? 1 : g < 1 ? easeOut(g) * 1.25 : 1.25 - (g - 1) / 0.6 * 0.25;
    }
    heads.forEach((id, k) => { open[id] = L.grow[id] != null ? 1 : Math.max(0, Math.sin(t * 3 - k * 0.8)) * 0.8; });
    L.P.y = Math.sin(t * 2.2) * 2.5;
    lairFire(heads, dt, top);
    drawAltar(c, heads, t);
    const keep = G; G = L;
    try {
      for (const cl of L.clouds) drawPoisonCloud(c, cl);
      drawPlayerShots(c);
      drawHydra(c, 0, L.P.y, heads, t, { open, grow });
      drawFx(c);
    } finally { G = keep; }
    // a flash and sparks where a new head pops out
    heads.forEach((id, k) => {
      const g = L.grow[id];
      if (g == null) return;
      const h = headPos(L.P, k, heads.length, t);
      if (L.pop[id] && g > 0.5) {
        L.pop[id] = false;
        for (let i = 0; i < 22; i++) { const a = rand(0, TAU), v = rand(40, 120); L.bits.push({ x: h.x, y: h.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, max: 0.7, color: i % 3 ? HEADS[id].glow : '#FFFFFF', size: rand(1.5, 3.5) }); }
      }
      if (g < 1) {
        c.save(); c.globalCompositeOperation = 'lighter';
        c.beginPath(); c.arc(h.x, h.y, 6 + g * 26, 0, TAU); c.strokeStyle = HEADS[id].glow; c.globalAlpha = 1 - g; c.lineWidth = 3; c.stroke();
        c.restore();
      }
    });
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of L.bits) { c.globalAlpha = p.life / p.max; c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fillStyle = p.color; c.fill(); }
    c.restore();
  }

  // ---------- Controls ----------
  // Touch: drag anywhere and the monster moves with the finger (it doesn't jump under it).
  // A tap on the special button (or two quick taps anywhere) uses the special power when it's full.
  const sw = { id: null };
  const wrap = $('#boardWrap');
  const toBoard = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH, k: VW / r.width }; };
  let lastTap = 0;
  const playing = () => G && G.mode === 'hydra' && G.state === 'play' && !core.isPaused();
  wrap.addEventListener('pointerdown', (e) => {
    if (!G || e.target.closest('button, .overlay')) return;
    core.skipIntro();
    if (!playing()) return;
    sfx.init();
    const p = toBoard(e);
    if (G.charge >= 1 && Math.hypot(p.x - SPECIAL_BTN.x, p.y - SPECIAL_BTN.y) < SPECIAL_BTN.r + 14) { useSpecial(); return; }
    Object.assign(sw, { id: e.pointerId, cx: e.clientX, cy: e.clientY, px: G.P.tx, py: G.P.ty, k: p.k * 1.2, t: e.timeStamp, moved: 0 });
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  wrap.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sw.id || !playing()) return;
    const dx = e.clientX - sw.cx, dy = e.clientY - sw.cy;
    sw.moved = Math.max(sw.moved, Math.hypot(dx, dy));
    G.P.tx = clamp(sw.px + dx * sw.k, 22, VW - 22);
    G.P.ty = clamp(sw.py + dy * sw.k, VH * 0.3, VH - 40);
    // If the finger pushes past an edge, count from there, so coming back moves right away.
    sw.px = G.P.tx - dx * sw.k; sw.py = G.P.ty - dy * sw.k;
  });
  const swEnd = (e) => {
    if (e.pointerId !== sw.id) return;
    sw.id = null;
    if (!playing() || e.type === 'pointercancel') return;
    if (sw.moved < 12 && e.timeStamp - sw.t < 260) {
      if (e.timeStamp - lastTap < 340) { useSpecial(); lastTap = 0; } else lastTap = e.timeStamp;
    }
  };
  wrap.addEventListener('pointerup', swEnd);
  wrap.addEventListener('pointercancel', swEnd);

  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  function key(e, down) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (down && !e.repeat) { core.skipIntro(); if (playing()) useSpecial(); } return; }
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    if (down) core.skipIntro();
    held[k] = down;
  }
  function onPause() { held.left = held.right = held.up = held.down = false; sw.id = null; }

  return {
    game: { heads: HEADS, worlds: WORLDS, chals: CHALS, goal: goalText, start, bosses: BOSSES, map: MAP, prize, buildTitle, paintHero },
    heads: { activeHeads, toggleHead, swapHead, MAX_HEADS, headURL, HEADS },
    shop: { HEADS, HEAD_ORDER, LEVEL_PRICE, MAX_SHOP_LV, SPECIALS, SPECIAL_ORDER, headURL, specialURL, heroLevel },
    update: (dt) => { G = core.G(); update(dt); },
    render: () => { G = core.G(); render(); },
    resize, key, onPause, heroNow: () => heroURL(activeHeads()),
  };
};
