const HERMES_URL = 'https://hermes.pyth.network';

const FEEDS = [
  { id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', label: 'BTC/USD', bandSize: 10000, maxFractionDigits: 0, celebrationStep: 5000 },
  { id: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', label: 'ETH/USD', bandSize: 500, maxFractionDigits: 2, celebrationStep: 500 },
  { id: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d', label: 'SOL/USD', bandSize: 20, maxFractionDigits: 2, celebrationStep: 5 },
  { id: '0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff', label: 'PYTH/USD', bandSize: 0.1, maxFractionDigits: 4, celebrationStep: 0.05 },
  { id: '0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b', label: 'HYPE/USD', bandSize: 20, maxFractionDigits: 2, celebrationStep: 5 },
  { id: '0x245f89fb8084840bd098d661a026032ee21062270003426797c9196d2d8d4e43', label: 'FOGO/USD', bandSize: 0.1, maxFractionDigits: 4, celebrationStep: 0.05 },
  { id: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f', label: 'BNB/USD', bandSize: 100, maxFractionDigits: 2, celebrationStep: 50 },
];

const STORAGE_KEYS = { feed: 'd1ckochart_feed', head: 'd1ckochart_head', variant: 'd1ckochart_variant' };

const HEAD_OPTIONS = [
  { label: 'oldtora', src: 'img/1.png' },
  { label: 'pepito', src: 'img/2.png' },
  { label: 'planck', src: 'img/3.png' },
  { label: 'marc', src: 'img/4.png' },
  { label: 'noname_trader', src: 'img/5.png' },
];

const priceEl = document.getElementById('priceEl');
const priceLabelEl = document.getElementById('priceLabel');
const indicatorWrap = document.getElementById('indicatorWrap');
const breastWrap = document.getElementById('breastWrap');

const ANGLE_MIN = 60;
const ANGLE_MAX = 120;
const HEIGHT_MIN_PX = 26;
const HEIGHT_MAX_PX = 100;
const BREAST_MIN_PX = 20;
const BREAST_MAX_PX = 36;
const NIPPLE_MIN_PX = 4;
const NIPPLE_MAX_PX = 8;

let currentFeedIndex = 0;
let chartVariant = 'male';
let lastPrice = null;
let eventSource = null;
let initialPrice = null;

function getCurrentFeed() {
  return FEEDS[currentFeedIndex];
}

function parsePythPrice(parsedItem) {
  if (!parsedItem?.price) return null;
  const { price, expo } = parsedItem.price;
  return Number(price) * Math.pow(10, expo);
}

function formatPrice(value, feed) {
  const f = feed || getCurrentFeed();
  const maxFrac = f.maxFractionDigits != null ? f.maxFractionDigits : 0;
  const prefix = '$';
  if (value > 0 && value < 1) {
    const str = value.toFixed(Math.max(maxFrac, 4)).replace(/\.?0+$/, '');
    return prefix + str;
  }
  return prefix + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(value);
}

function getTInBand(priceUsd, bandSize) {
  const bandStart = Math.floor(priceUsd / bandSize) * bandSize;
  const t = (priceUsd - bandStart) / bandSize;
  return Math.max(0, Math.min(1, t));
}

function fireConfetti() {
  const container = document.getElementById('confettiContainer') || (() => {
    const el = document.createElement('div');
    el.id = 'confettiContainer';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  })();
  const colors = ['#00d4aa', '#e55a5a', '#f0c14b', '#6b6b7b', '#e8e6e3'];
  const count = 45;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.animationDelay = Math.random() * 0.5 + 's';
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.width = (6 + Math.random() * 8) + 'px';
    p.style.height = p.style.width;
    container.appendChild(p);
    setTimeout(() => p.remove(), 2500);
  }
}

function updatePriceChangeDisplay(priceUsd) {
  const el = document.getElementById('priceChangeEl');
  if (!el) return;
  if (priceUsd == null || initialPrice == null || initialPrice === 0) {
    el.textContent = '—';
    el.className = 'price-change';
    return;
  }
  const pct = ((priceUsd - initialPrice) / initialPrice) * 100;
  const sign = pct >= 0 ? '+' : '';
  el.textContent = sign + pct.toFixed(2) + '%';
  el.className = 'price-change ' + (pct >= 0 ? 'up' : 'down');
}

function setPrice(priceUsd) {
  if (priceUsd == null) return;

  const feed = getCurrentFeed();
  if (initialPrice == null) initialPrice = priceUsd;

  const step = feed.celebrationStep;
  if (step != null && lastPrice != null) {
    const prevBand = Math.floor(lastPrice / step) * step;
    const currBand = Math.floor(priceUsd / step) * step;
    if (prevBand !== currBand) fireConfetti();
  }

  const t = getTInBand(priceUsd, feed.bandSize);
  const angle = ANGLE_MAX - t * (ANGLE_MAX - ANGLE_MIN);
  const heightPx = Math.round(HEIGHT_MIN_PX + t * (HEIGHT_MAX_PX - HEIGHT_MIN_PX));

  const direction = lastPrice == null
    ? 'up'
    : priceUsd > lastPrice
      ? 'up'
      : priceUsd < lastPrice
        ? 'down'
        : 'up';
  lastPrice = priceUsd;

  if (priceLabelEl) priceLabelEl.textContent = feed.label;
  priceEl.textContent = formatPrice(priceUsd, feed);
  priceEl.classList.remove('loading', 'up', 'down');
  priceEl.classList.add(direction);

  updatePriceChangeDisplay(priceUsd);

  if (chartVariant === 'female' && breastWrap) {
    const breastHeightPx = Math.round(BREAST_MIN_PX + t * (BREAST_MAX_PX - BREAST_MIN_PX));
    const nipplePx = Math.round(NIPPLE_MIN_PX + t * (NIPPLE_MAX_PX - NIPPLE_MIN_PX));
    breastWrap.style.setProperty('--breast-height', breastHeightPx + 'px');
    breastWrap.style.setProperty('--nipple-size', nipplePx + 'px');
    breastWrap.classList.remove('up', 'down');
    breastWrap.classList.add(direction);
  } else if (indicatorWrap) {
    indicatorWrap.classList.remove('up', 'down');
    indicatorWrap.classList.add(direction);
    indicatorWrap.style.height = `${heightPx}px`;
    indicatorWrap.style.transform = `rotate(${angle}deg)`;
  }
}

function setIndicatorFromT(t, direction) {
  const angle = ANGLE_MAX - t * (ANGLE_MAX - ANGLE_MIN);
  const heightPx = Math.round(HEIGHT_MIN_PX + t * (HEIGHT_MAX_PX - HEIGHT_MIN_PX));
  if (indicatorWrap) {
    indicatorWrap.classList.remove('up', 'down');
    indicatorWrap.classList.add(direction);
    indicatorWrap.style.height = `${heightPx}px`;
    indicatorWrap.style.transform = `rotate(${angle}deg)`;
  }
}

function setBreastFromT(t, direction) {
  if (!breastWrap) return;
  const heightPx = Math.round(BREAST_MIN_PX + t * (BREAST_MAX_PX - BREAST_MIN_PX));
  const nipplePx = Math.round(NIPPLE_MIN_PX + t * (NIPPLE_MAX_PX - NIPPLE_MIN_PX));
  breastWrap.style.setProperty('--breast-height', heightPx + 'px');
  breastWrap.style.setProperty('--nipple-size', nipplePx + 'px');
  breastWrap.classList.remove('up', 'down');
  breastWrap.classList.add(direction);
}

async function fetchLatestPrice(feedId) {
  const id = feedId || getCurrentFeed().id;
  const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Pyth API error');
  const data = await res.json();
  const parsed = data?.parsed?.[0];
  return parsePythPrice(parsed);
}

function connectStream(feedId) {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  const id = feedId || getCurrentFeed().id;
  const url = `${HERMES_URL}/v2/updates/price/stream?ids[]=${id}`;
  const es = new EventSource(url);
  eventSource = es;

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const parsed = data?.parsed?.[0];
      const priceUsd = parsePythPrice(parsed);
      if (priceUsd != null) setPrice(priceUsd);
    } catch (_) {}
  };

  es.onerror = () => {
    es.close();
    eventSource = null;
    startPolling();
  };

  return es;
}

let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  function poll() {
    fetchLatestPrice()
      .then((p) => { if (p != null) setPrice(p); })
      .catch(() => {});
    pollTimer = setTimeout(poll, 2500);
  }
  poll();
}

function switchFeed(index) {
  if (index === currentFeedIndex) return;
  const sel = document.getElementById('feedSelect');
  if (location.search.includes('test=1')) {
    currentFeedIndex = index;
    lastPrice = null;
    if (sel) sel.selectedIndex = index;
    if (priceLabelEl) priceLabelEl.textContent = getCurrentFeed().label;
    window.dispatchEvent(new CustomEvent('feedChanged'));
    return;
  }
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  currentFeedIndex = index;
  lastPrice = null;
  initialPrice = null;
  if (sel) sel.selectedIndex = index;
  if (priceLabelEl) priceLabelEl.textContent = getCurrentFeed().label;
  priceEl.textContent = 'Loading...';
  priceEl.classList.add('loading');
  updatePriceChangeDisplay(null);
  try { localStorage.setItem(STORAGE_KEYS.feed, String(index)); } catch (_) {}
  const feed = getCurrentFeed();
  fetchLatestPrice(feed.id).then((p) => {
    if (p != null) setPrice(p);
    try { connectStream(feed.id); } catch (_) { startPolling(); }
  }).catch(() => {
    priceEl.textContent = 'Load error';
    priceEl.classList.remove('loading');
    setTimeout(() => switchFeed(currentFeedIndex), 2000);
  });
}

function initFeedSelect() {
  const select = document.getElementById('feedSelect');
  if (!select) return;
  FEEDS.forEach((f, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = f.label;
    if (i === currentFeedIndex) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => switchFeed(Number(select.value)));
  if (priceLabelEl) priceLabelEl.textContent = getCurrentFeed().label;
}

function initHeadSelect() {
  const select = document.getElementById('headSelect');
  const headImg = document.getElementById('headImg');
  if (!select || !headImg) return;
  HEAD_OPTIONS.forEach((opt, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = opt.label;
    if (i === 0) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener('change', () => {
    const idx = Number(select.value);
    headImg.src = HEAD_OPTIONS[idx].src;
    try { localStorage.setItem(STORAGE_KEYS.head, String(idx)); } catch (_) {}
  });
}

function initFaq() {
  const btn = document.getElementById('faqBtn');
  const modal = document.getElementById('faqModal');
  const close = document.getElementById('faqClose');
  if (!btn || !modal) return;
  btn.addEventListener('click', () => { modal.hidden = false; });
  close.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
}

function initChangelog() {
  const btn = document.getElementById('changelogBtn');
  const modal = document.getElementById('changelogModal');
  const close = document.getElementById('changelogClose');
  if (!btn || !modal) return;
  btn.addEventListener('click', () => { modal.hidden = false; });
  close.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
}

function initVariantSwitch() {
  const btnMale = document.getElementById('variantMale');
  const btnFemale = document.getElementById('variantFemale');
  if (!btnMale || !btnFemale) return;
  function setVariant(v) {
    chartVariant = v;
    document.body.classList.remove('male', 'female');
    document.body.classList.add(v);
    btnMale.setAttribute('aria-pressed', v === 'male' ? 'true' : 'false');
    btnFemale.setAttribute('aria-pressed', v === 'female' ? 'true' : 'false');
    try { localStorage.setItem(STORAGE_KEYS.variant, v); } catch (_) {}
    if (lastPrice != null) setPrice(lastPrice);
    else if (chartVariant === 'female' && breastWrap) setBreastFromT(0.5, 'up');
  }
  btnMale.addEventListener('click', () => setVariant('male'));
  btnFemale.addEventListener('click', () => setVariant('female'));
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.variant);
    if (saved === 'female' || saved === 'male') setVariant(saved);
    else setVariant('male');
  } catch (_) {
    setVariant('male');
  }
}

function initChangeRequest() {
  const btn = document.getElementById('changeRequestBtn');
  const modal = document.getElementById('changeRequestModal');
  const close = document.getElementById('changeRequestClose');
  const form = document.getElementById('changeRequestForm');
  const textarea = document.getElementById('changeRequestText');
  const submitBtn = form?.querySelector('button[type="submit"]');
  if (!btn || !modal) return;
  btn.addEventListener('click', () => { modal.hidden = false; });
  close.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = textarea?.value?.trim();
      if (!raw) return;
      const prevLabel = submitBtn?.textContent;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }
      try {
        const res = await fetch('/api/send-change-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: raw }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          if (textarea) textarea.value = '';
          modal.hidden = true;
          if (submitBtn) submitBtn.textContent = 'Sent ✓';
          setTimeout(() => { if (submitBtn) submitBtn.textContent = prevLabel; }, 2000);
        } else {
          alert(data.error || 'Failed to send');
        }
      } catch (_) {
        alert('Network error');
      }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = prevLabel; }
    });
  }
}

function initTestEnvLink() {
  const link = document.getElementById('testEnvLink');
  if (!link) return;
  if (location.search.includes('test=1')) {
    link.textContent = 'Real chart';
    link.href = location.pathname || '/';
  }
}

function initTestPanel() {
  const panel = document.getElementById('test-panel');
  const sl = document.getElementById('testT');
  const tValue = document.getElementById('testTValue');
  const btnUp = document.getElementById('testUp');
  const btnDown = document.getElementById('testDown');
  const btnConfetti = document.getElementById('testConfetti');
  if (!panel || !sl) return;

  panel.hidden = false;
  document.body.classList.add('test-mode');
  const priceChangeWrap = document.getElementById('priceChangeWrap');
  if (priceChangeWrap) priceChangeWrap.hidden = true;
  if (priceLabelEl) priceLabelEl.textContent = getCurrentFeed().label;
  priceEl.classList.remove('loading', 'up', 'down');

  if (btnConfetti) btnConfetti.addEventListener('click', () => fireConfetti());

  let direction = 'up';

  window.addEventListener('feedChanged', apply);

  function apply() {
    const t = sl.value / 100;
    const feed = getCurrentFeed();
    const valueInBand = t * feed.bandSize;
    tValue.textContent = t.toFixed(2);
    if (priceLabelEl) priceLabelEl.textContent = feed.label;
    priceEl.textContent = formatPrice(valueInBand, feed);
    priceEl.classList.remove('up', 'down');
    priceEl.classList.add(direction);
    if (chartVariant === 'female') setBreastFromT(t, direction);
    else setIndicatorFromT(t, direction);
  }

  sl.addEventListener('input', apply);
  btnUp.addEventListener('click', () => { direction = 'up'; apply(); });
  btnDown.addEventListener('click', () => { direction = 'down'; apply(); });
  apply();
}

async function init() {
  try {
    const savedFeed = localStorage.getItem(STORAGE_KEYS.feed);
    const fi = parseInt(savedFeed, 10);
    if (!isNaN(fi) && fi >= 0 && fi < FEEDS.length) currentFeedIndex = fi;
  } catch (_) {}

  initFaq();
  initChangelog();
  initChangeRequest();
  initTestEnvLink();
  initFeedSelect();
  initHeadSelect();
  initVariantSwitch();

  const headSelect = document.getElementById('headSelect');
  const headImg = document.getElementById('headImg');
  if (headSelect && headImg) {
    try {
      const savedHead = localStorage.getItem(STORAGE_KEYS.head);
      const hi = parseInt(savedHead, 10);
      if (!isNaN(hi) && hi >= 0 && hi < HEAD_OPTIONS.length) {
        headSelect.selectedIndex = hi;
        headImg.src = HEAD_OPTIONS[hi].src;
      }
    } catch (_) {}
  }

  if (location.search.includes('test=1')) {
    initTestPanel();
    return;
  }
  const feed = getCurrentFeed();
  try {
    const initial = await fetchLatestPrice(feed.id);
    if (initial != null) setPrice(initial);
    try {
      connectStream(feed.id);
    } catch (_) {
      startPolling();
    }
  } catch (e) {
    priceEl.textContent = 'Load error';
    priceEl.classList.remove('loading');
    setTimeout(init, 5000);
  }
}

init();
