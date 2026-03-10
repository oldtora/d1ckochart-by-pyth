const PYTH_BTC_USD_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
const HERMES_URL = 'https://hermes.pyth.network';

const priceEl = document.getElementById('priceEl');
const indicatorWrap = document.getElementById('indicatorWrap');

const BAND_SIZE = 10000;
const ANGLE_MIN = 60;
const ANGLE_MAX = 120;
const HEIGHT_MIN_PX = 26;
const HEIGHT_MAX_PX = 100;

let lastPrice = null;

function parsePythPrice(parsedItem) {
  if (!parsedItem?.price) return null;
  const { price, expo } = parsedItem.price;
  return Number(price) * Math.pow(10, expo);
}

function formatPrice(usd) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(usd);
}

function getTInBand(priceUsd) {
  const bandStart = Math.floor(priceUsd / BAND_SIZE) * BAND_SIZE;
  const t = (priceUsd - bandStart) / BAND_SIZE;
  return Math.max(0, Math.min(1, t));
}

function setPrice(priceUsd) {
  if (priceUsd == null) return;

  const t = getTInBand(priceUsd);
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

  priceEl.textContent = formatPrice(priceUsd);
  priceEl.classList.remove('loading', 'up', 'down');
  priceEl.classList.add(direction);

  indicatorWrap.classList.remove('up', 'down');
  indicatorWrap.classList.add(direction);
  indicatorWrap.style.height = `${heightPx}px`;
  indicatorWrap.style.transform = `rotate(${angle}deg)`;
}

function setIndicatorFromT(t, direction) {
  const angle = ANGLE_MAX - t * (ANGLE_MAX - ANGLE_MIN);
  const heightPx = Math.round(HEIGHT_MIN_PX + t * (HEIGHT_MAX_PX - HEIGHT_MIN_PX));
  indicatorWrap.classList.remove('up', 'down');
  indicatorWrap.classList.add(direction);
  indicatorWrap.style.height = `${heightPx}px`;
  indicatorWrap.style.transform = `rotate(${angle}deg)`;
}

async function fetchLatestPrice() {
  const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${PYTH_BTC_USD_ID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Pyth API error');
  const data = await res.json();
  const parsed = data?.parsed?.[0];
  return parsePythPrice(parsed);
}

function connectStream() {
  const url = `${HERMES_URL}/v2/updates/price/stream?ids[]=${PYTH_BTC_USD_ID}`;
  const es = new EventSource(url);

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

function initFaq() {
  const btn = document.getElementById('faqBtn');
  const modal = document.getElementById('faqModal');
  const close = document.getElementById('faqClose');
  if (!btn || !modal) return;
  btn.addEventListener('click', () => { modal.hidden = false; });
  close.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
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
  const priceSim = document.getElementById('testPriceSim');
  const btnUp = document.getElementById('testUp');
  const btnDown = document.getElementById('testDown');
  if (!panel || !sl) return;

  panel.hidden = false;
  let direction = 'up';

  function apply() {
    const t = sl.value / 100;
    tValue.textContent = t.toFixed(2);
    const fakePrice = 70000 + t * 10000;
    priceSim.textContent = formatPrice(fakePrice);
    priceEl.textContent = formatPrice(fakePrice);
    priceEl.classList.remove('loading', 'up', 'down');
    priceEl.classList.add(direction);
    setIndicatorFromT(t, direction);
  }

  sl.addEventListener('input', apply);
  btnUp.addEventListener('click', () => { direction = 'up'; apply(); });
  btnDown.addEventListener('click', () => { direction = 'down'; apply(); });
  apply();
}

async function init() {
  initFaq();
  initTestEnvLink();

  if (location.search.includes('test=1')) {
    initTestPanel();
    return;
  }
  try {
    const initial = await fetchLatestPrice();
    if (initial != null) setPrice(initial);
    try {
      connectStream();
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
