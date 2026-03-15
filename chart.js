/**
 * Terminal-style chart: p.png moves with Pyth price and draws a trail (green up, red down).
 * Same pairs as main app. No test panel, no heads, no variant.
 * Wrapped in IIFE to avoid conflicting with app.js (HERMES_URL, FEEDS, etc.).
 */
(function() {
'use strict';

const HERMES_URL = 'https://hermes.pyth.network';

const FEEDS = [
  { id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', label: 'BTC/USD', bandSize: 10000, maxFractionDigits: 0 },
  { id: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', label: 'ETH/USD', bandSize: 500, maxFractionDigits: 2 },
  { id: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d', label: 'SOL/USD', bandSize: 20, maxFractionDigits: 2 },
  { id: '0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff', label: 'PYTH/USD', bandSize: 0.1, maxFractionDigits: 4 },
  { id: '0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b', label: 'HYPE/USD', bandSize: 20, maxFractionDigits: 2 },
  { id: '0x245f89fb8084840bd098d661a026032ee21062270003426797c9196d2d8d4e43', label: 'FOGO/USD', bandSize: 0.1, maxFractionDigits: 4 },
  { id: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f', label: 'BNB/USD', bandSize: 100, maxFractionDigits: 2 },
];

const UP_COLOR = '#00d4aa';
const DOWN_COLOR = '#e55a5a';

const CHART_FEED_STORAGE_KEY = 'chartFeedLabel';
let currentFeedIndex = 0;
let eventSource = null;
const trail = [];
let priceZoom = 1;
/** Видимое окно по времени (мс). Центр слайдера = 1 мин = 60_000. Не в минутах — управляем графиком. */
let visibleWindowMs = 60 * 1000;
let timeOffset = 0;
let priceCenterOffset = 0;
const PADDING = { top: 24, right: 8, bottom: 24, left: 8 };
let canvasEl, ctx, rocketImg;
let lastPrice = null;
let drag = { active: false, startX: 0, startY: 0, startTimeOffset: 0, startPriceCenterOffset: 0, startRangeSpan: 0, startDrawW: 0, startDrawH: 0 };

function getFeed() {
  return FEEDS[currentFeedIndex];
}

function parsePythPrice(parsedItem) {
  if (!parsedItem?.price) return null;
  const { price, expo } = parsedItem.price;
  return Number(price) * Math.pow(10, expo);
}

function formatPrice(value) {
  const f = getFeed();
  const maxFrac = f.maxFractionDigits != null ? f.maxFractionDigits : 2;
  if (value >= 0 && value < 1) return '$' + value.toFixed(Math.max(maxFrac, 4)).replace(/\.?0+$/, '');
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: maxFrac });
}

function getElements() {
  canvasEl = document.getElementById('chartCanvas');
  rocketImg = document.getElementById('chartRocket');
  if (!canvasEl) return false;
  ctx = canvasEl.getContext('2d');
  return true;
}

function setCanvasSize() {
  if (!canvasEl) return;
  const wrap = canvasEl.parentElement;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvasEl.width = w * dpr;
  canvasEl.height = h * dpr;
  canvasEl.style.width = w + 'px';
  canvasEl.style.height = h + 'px';
  updateTimeSliderWidth();
  draw();
}

function updateTimeSliderWidth() {
  const chartMain = document.querySelector('.chart-main');
  const timeWrap = document.getElementById('timeSliderWrap');
  if (!chartMain || !timeWrap) return;
  const w = chartMain.clientWidth;
  const h = chartMain.clientHeight;
  timeWrap.style.width = Math.round(w * 0.8) + 'px';

  // Price slider: track length = 80% of chart height
  const priceWrap = document.querySelector('.chart-price-slider-wrap');
  const priceInput = document.getElementById('priceZoomSlider');
  if (priceWrap && priceInput) {
    const trackLen = Math.round(h * 0.8);
    priceWrap.style.height = trackLen + 'px';
    priceInput.style.width = trackLen + 'px';
  }
}

function getVisibleWindow() {
  const now = Date.now();
  const tMax = now - timeOffset;
  const tMin = tMax - visibleWindowMs;
  return { tMin, tMax };
}

function getVisiblePoints() {
  const { tMin } = getVisibleWindow();
  return trail.filter((p) => p.t >= tMin);
}

function getPriceRange(points) {
  if (points.length === 0) return { min: 0, max: 1 };
  let min = points[0].price;
  let max = points[0].price;
  for (let i = 1; i < points.length; i++) {
    if (points[i].price < min) min = points[i].price;
    if (points[i].price > max) max = points[i].price;
  }
  const pad = (max - min) * 0.05 || 1;
  const center = (min + max) / 2 + priceCenterOffset;
  const half = Math.max((max - min) / 2 + pad, 1) * priceZoom;
  return { min: center - half, max: center + half };
}

function priceToY(price, range, h) {
  const { min, max } = range;
  const y = ((price - min) / (max - min)) * (h - PADDING.top - PADDING.bottom);
  return h - PADDING.bottom - y;
}

function timeToX(t, tMin, tMax, w) {
  const x = ((t - tMin) / (tMax - tMin)) * (w - PADDING.left - PADDING.right);
  return PADDING.left + x;
}

function draw() {
  if (!ctx || !canvasEl) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const drawW = canvasEl.style.width ? parseInt(canvasEl.style.width, 10) : canvasEl.width / dpr;
  const drawH = canvasEl.style.height ? parseInt(canvasEl.style.height, 10) : canvasEl.height / dpr;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.restore();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const points = getVisiblePoints();
  const { tMin, tMax } = getVisibleWindow();
  const range = getPriceRange(points);

  const gridColor = 'rgba(255, 255, 255, 0.07)';
  const gridCols = 16;
  const gridRows = 12;
  const gridStepX = (drawW - PADDING.left - PADDING.right) / gridCols;
  const gridStepY = (drawH - PADDING.top - PADDING.bottom) / gridRows;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 1; i < gridCols; i++) {
    const x = PADDING.left + i * gridStepX;
    ctx.beginPath();
    ctx.moveTo(x, PADDING.top);
    ctx.lineTo(x, drawH - PADDING.bottom);
    ctx.stroke();
  }
  for (let i = 1; i < gridRows; i++) {
    const y = PADDING.top + i * gridStepY;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(drawW - PADDING.right, y);
    ctx.stroke();
  }

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const x1 = timeToX(a.t, tMin, tMax, drawW);
    const y1 = priceToY(a.price, range, drawH);
    const x2 = timeToX(b.t, tMin, tMax, drawW);
    const y2 = priceToY(b.price, range, drawH);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = b.direction >= 0 ? UP_COLOR : DOWN_COLOR;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  ctx.restore();

  if (rocketImg && rocketImg.complete && rocketImg.naturalWidth && points.length > 0) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const last = points[points.length - 1];
    const x = timeToX(last.t, tMin, tMax, drawW);
    const y = priceToY(last.price, range, drawH);
    const size = 24;
    let angle = 0;
    if (points.length >= 2) {
      const prev = points[points.length - 2];
      const x1 = timeToX(prev.t, tMin, tMax, drawW);
      const y1 = priceToY(prev.price, range, drawH);
      angle = Math.atan2(y - y1, x - x1);
    }
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(rocketImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  updateChartHeader();
}

function getVisibleMinMax() {
  const points = getVisiblePoints();
  if (points.length === 0) return { min: null, max: null };
  let minP = points[0].price;
  let maxP = points[0].price;
  for (let i = 1; i < points.length; i++) {
    if (points[i].price < minP) minP = points[i].price;
    if (points[i].price > maxP) maxP = points[i].price;
  }
  return { min: minP, max: maxP };
}

function updateChartHeader() {
  const nowEl = document.getElementById('chartPriceNow');
  const minEl = document.getElementById('chartMinPrice');
  const maxEl = document.getElementById('chartMaxPrice');
  if (nowEl) {
    nowEl.textContent = lastPrice != null ? formatPrice(lastPrice) : '—';
    nowEl.className = 'chart-price-value' + (lastPrice != null && trail.length >= 2 ? (trail[trail.length - 1].direction >= 0 ? ' up' : ' down') : '');
  }
  const { min: minP, max: maxP } = getVisibleMinMax();
  if (minEl) {
    minEl.textContent = minP != null ? formatPrice(minP) : '—';
  }
  if (maxEl) {
    maxEl.textContent = maxP != null ? formatPrice(maxP) : '—';
  }
}

function addPoint(priceUsd) {
  const t = Date.now();
  const direction = lastPrice == null ? 0 : (priceUsd >= lastPrice ? 1 : -1);
  if (trail.length > 0 && t <= trail[trail.length - 1].t) {
    trail[trail.length - 1] = { t, price: priceUsd, direction };
  } else {
    trail.push({ t, price: priceUsd, direction });
  }
  lastPrice = priceUsd;
  draw();

  updateChartHeader();
}

function connectStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  const id = getFeed().id;
  const url = `${HERMES_URL}/v2/updates/price/stream?ids[]=${id}`;
  const es = new EventSource(url);
  eventSource = es;

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const parsed = data?.parsed?.[0];
      const priceUsd = parsePythPrice(parsed);
      if (priceUsd != null) addPoint(priceUsd);
    } catch (_) {}
  };

  es.onerror = () => {
    es.close();
    eventSource = null;
    startPolling();
  };
}

async function fetchLatestPrice() {
  const id = getFeed().id;
  const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Pyth API error');
  const data = await res.json();
  const parsed = data?.parsed?.[0];
  return parsePythPrice(parsed);
}

function startChart() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  updateChartHeader();
  fetchLatestPrice()
    .then((p) => { if (p != null) addPoint(p); })
    .catch(() => {});
  connectStream();
}

let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  function poll() {
    fetchLatestPrice()
      .then((p) => { if (p != null) addPoint(p); })
      .catch(() => {});
    pollTimer = setTimeout(poll, 2500);
  }
  poll();
}

function switchFeed(index) {
  if (index === currentFeedIndex) return;
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  currentFeedIndex = index;
  trail.length = 0;
  lastPrice = null;
  const sel = document.getElementById('chartFeedSelect');
  if (sel) sel.selectedIndex = index;
  try {
    if (FEEDS[index]?.label) localStorage.setItem(CHART_FEED_STORAGE_KEY, FEEDS[index].label);
  } catch (_) {}
  updateChartHeader();
  startChart();
  draw();
}

function initFeedSelect() {
  const sel = document.getElementById('chartFeedSelect');
  if (sel) {
    try {
      const saved = localStorage.getItem(CHART_FEED_STORAGE_KEY);
      if (saved) {
        const idx = FEEDS.findIndex((f) => f.label === saved);
        if (idx >= 0) currentFeedIndex = idx;
      }
    } catch (_) {}
    FEEDS.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.label;
      opt.textContent = f.label;
      sel.appendChild(opt);
    });
    sel.selectedIndex = currentFeedIndex;
    sel.addEventListener('change', () => switchFeed(sel.selectedIndex));
  }
  updateChartHeader();
  startChart();
  draw();
}

function priceZoomFromSliderValue(val) {
  return 0.25 * Math.pow(16, val / 100);
}

function sliderValueFromPriceZoom(z) {
  if (z <= 0.25) return 0;
  return Math.round(100 * Math.log(z / 0.25) / Math.log(16));
}

/** Слайдер времени 0–100: центр 50 = 1 мин. Влево (0) = уже, вправо (100) = шире. Без привязки к минутам. */
function windowMsFromSlider(val) {
  const parsed = parseFloat(val, 10);
  const v = Math.max(0, Math.min(100, Number.isNaN(parsed) ? 50 : parsed));
  if (v <= 50) {
    return 30000 + (v / 50) * (60000 - 30000);
  }
  return 60000 + ((v - 50) / 50) * (3600000 - 60000);
}

function sliderFromWindowMs(ms) {
  const m = Math.max(30000, Math.min(3600000, ms));
  if (m <= 60000) return 50 * (m - 30000) / (60000 - 30000);
  return 50 + 50 * (m - 60000) / (3600000 - 60000);
}

function setPriceZoomFromSlider() {
  const el = document.getElementById('priceZoomSlider');
  if (!el) return;
  const val = parseFloat(el.value, 10);
  priceZoom = priceZoomFromSliderValue(100 - val);
  draw();
}

let timeSliderRaf = 0;
function setTimeFromSlider() {
  const el = document.getElementById('timeZoomSlider');
  if (!el) return;
  visibleWindowMs = windowMsFromSlider(el.value);
  if (timeSliderRaf) cancelAnimationFrame(timeSliderRaf);
  timeSliderRaf = requestAnimationFrame(function() {
    timeSliderRaf = 0;
    draw();
  });
}

function resetChart() {
  visibleWindowMs = 60 * 1000;
  priceZoom = 1;
  timeOffset = 0;
  priceCenterOffset = 0;
  const timeEl = document.getElementById('timeZoomSlider');
  if (timeEl) timeEl.value = '50';
  const priceEl = document.getElementById('priceZoomSlider');
  if (priceEl) priceEl.value = '50';
  updateChartHeader();
  draw();
}

function initSliders() {
  const priceEl = document.getElementById('priceZoomSlider');
  if (priceEl) {
    priceEl.value = String(100 - sliderValueFromPriceZoom(priceZoom));
    priceEl.addEventListener('input', setPriceZoomFromSlider);
  }
  const timeEl = document.getElementById('timeZoomSlider');
  if (timeEl) {
    timeEl.value = String(sliderFromWindowMs(visibleWindowMs));
    timeEl.addEventListener('input', setTimeFromSlider);
  }
}

function initResetButton() {
  document.getElementById('chartReset')?.addEventListener('click', resetChart);
}

function initHelpTooltip() {
  const trigger = document.getElementById('chartHelpTrigger');
  const popup = document.getElementById('chartHelpPopup');
  if (!trigger || !popup) return;
  function show() {
    const r = trigger.getBoundingClientRect();
    const padding = 8;
    let left = r.left;
    let top = r.bottom + padding;
    const popupW = 320;
    if (left + popupW > window.innerWidth - 16) left = window.innerWidth - popupW - 16;
    if (left < 16) left = 16;
    if (top + 200 > window.innerHeight - 16) top = r.top - 200 - padding;
    if (top < 16) top = 16;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.classList.add('is-visible');
  }
  function hide() {
    popup.classList.remove('is-visible');
  }
  trigger.addEventListener('mouseenter', show);
  trigger.addEventListener('mouseleave', hide);
}

function applyTimePan(delta) {
  const windowMs = visibleWindowMs;
  const step = windowMs * 0.2;
  const minOffset = -windowMs;
  timeOffset = Math.max(minOffset, Math.min(1e9, timeOffset + (delta > 0 ? -step : step)));
  draw();
}

function applyPricePan(delta) {
  const points = getVisiblePoints();
  if (points.length === 0) return;
  const range = getPriceRange(points);
  const step = (range.max - range.min) * 0.12;
  priceCenterOffset += delta > 0 ? -step : step;
  draw();
}

function getDrawSize() {
  if (!canvasEl) return { w: 0, h: 0 };
  const drawW = canvasEl.style.width ? parseInt(canvasEl.style.width, 10) : canvasEl.width;
  const drawH = canvasEl.style.height ? parseInt(canvasEl.style.height, 10) : canvasEl.height;
  return { w: drawW, h: drawH };
}

function initDragPan() {
  const canvasWrap = document.querySelector('.chart-canvas-wrap');
  if (!canvasWrap) return;
  canvasWrap.style.cursor = 'grab';

  canvasWrap.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const points = getVisiblePoints();
    const range = getPriceRange(points);
    const { w: drawW, h: drawH } = getDrawSize();
    drag.active = true;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.startTimeOffset = timeOffset;
    drag.startPriceCenterOffset = priceCenterOffset;
    drag.startRangeSpan = range.max - range.min || 1;
    drag.startDrawW = drawW || 1;
    drag.startDrawH = drawH || 1;
    canvasWrap.style.cursor = 'grabbing';
  });

  const onMove = (e) => {
    if (!drag.active) return;
    const windowMs = visibleWindowMs;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const minOffset = -windowMs;
    timeOffset = Math.max(minOffset, drag.startTimeOffset + (dx / drag.startDrawW) * windowMs);
    priceCenterOffset = drag.startPriceCenterOffset + (dy / drag.startDrawH) * drag.startRangeSpan;
    draw();
  };

  const onUp = () => {
    if (!drag.active) return;
    drag.active = false;
    canvasWrap.style.cursor = 'grab';
  };

  canvasWrap.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('mouseleave', onUp);
}

function applyPriceZoom(delta) {
  if (delta > 0) priceZoom = Math.max(0.25, priceZoom / 1.15);
  else priceZoom = Math.min(4, priceZoom * 1.15);
  const el = document.getElementById('priceZoomSlider');
  if (el) el.value = String(100 - sliderValueFromPriceZoom(priceZoom));
  draw();
}

function initWheel() {
  const canvasWrap = document.querySelector('.chart-canvas-wrap');
  if (canvasWrap) {
    canvasWrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.shiftKey) {
        applyPricePan(e.deltaY);
      } else {
        const timeDelta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        if (timeDelta !== 0) applyTimePan(timeDelta);
      }
    }, { passive: false });
  }
}

function init() {
  if (window._chartInited) return;
  if (!getElements()) return;
  window._chartInited = true;
  rocketImg?.addEventListener('load', draw);
  if (rocketImg?.complete) draw();

  setCanvasSize();
  window.addEventListener('resize', setCanvasSize);
  updateTimeSliderWidth();

  initSliders();
  initResetButton();
  initHelpTooltip();
  initDragPan();
  initWheel();
  initFeedSelect();
}

function runChart() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

function setupChart() {
  if (document.getElementById('chartModal')) {
    window.initChartModal = function() {
      if (window._chartInited) return;
      init();
    };
  window.chartModalOnShow = function() {
    if (typeof setCanvasSize !== 'function' || typeof draw !== 'function') return;
    function resizeAndDraw() {
      setCanvasSize();
      draw();
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(resizeAndDraw);
    });
    setTimeout(resizeAndDraw, 80);
  };
  } else {
    runChart();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupChart);
} else {
  setupChart();
}

})();
