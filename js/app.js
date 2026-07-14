/* ==========================================================================
   NTE Transfer Guide — app.js
   UI ロジック一式（タブ切替・検索フォーム・結果表示・地図・駅一覧・設定）
   ========================================================================== */

const CONFIG = {
  // ★ 自分のリポジトリを作成したら、このURLを書き換えてください。
  GITHUB_REPO_URL: 'https://github.com/YOUR_USERNAME/nte-transfer-guide',
  MAP_IMAGE_SRC: 'images/Neverness_Map.png',
  MAP_IMAGE_SIZE: 5632,
  MAX_VIA: 3,
  HISTORY_KEY: 'nte_search_history_v1',
  MAX_HISTORY: 14,
};

/* ------------------------------------------------------------------ utils */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function stationName(id) { return (STATIONS[id] && STATIONS[id].name) || id; }

const NAME_TO_ID = Object.fromEntries(Object.entries(STATIONS).map(([id, s]) => [s.name, id]));

function lineOf(id) { return CUSTOM_LINES[id]; }

/* 駅がどの路線に属するか（駅一覧タブでの表示順維持のため CUSTOM_LINES の順で構築） */
function stationsOfLine(lineId) {
  const line = CUSTOM_LINES[lineId];
  const seen = new Set();
  const out = [];
  for (const p of line.points) {
    if (p.type === 'station' && !seen.has(p.id)) { seen.add(p.id); out.push(p.id); }
  }
  return out;
}

function linesOfStation(stationId) {
  return Object.entries(CUSTOM_LINES).filter(([, l]) =>
    l.points.some(p => p.type === 'station' && p.id === stationId)
  ).map(([id]) => id);
}

function isInterchange(stationId) {
  if (linesOfStation(stationId).length > 1) return true;
  return WALK_TRANSFERS.some(w => w.a === stationId || w.b === stationId);
}

/* ------------------------------------------------------------------ init */
document.addEventListener('DOMContentLoaded', () => {
  wireGithubLinks();
  startClock();
  populateStationList();
  wireTabs();
  wireSearchForm();
  wireHistoryButtons();
  wireMapTab();
  renderStationListTab();
  wireSettingsTab();
  wireRouteDetailModal();
});

function wireGithubLinks() {
  $$('.js-github-link').forEach(a => { a.href = CONFIG.GITHUB_REPO_URL; });
}

function startClock() {
  const el = $('#clock');
  const tick = () => {
    const d = new Date();
    el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 1000 * 10);
}

function populateStationList() {
  const dl = $('#station-list');
  dl.innerHTML = Object.values(STATIONS)
    .map(s => `<option value="${s.name}"></option>`).join('');
}

/* ------------------------------------------------------------------ tabs */
function wireTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
}
function activateTab(tab) {
  $$('.tab-btn').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('.tab-panel').forEach(p => p.classList.remove('active'));
  $(`#tab-${tab}`).classList.add('active');
  closeStationPopup();
  closeHistoryDropdown();
  if (tab === 'map') requestAnimationFrame(fitMapToContainer);
}

/* ================================================================== 検索 */
function wireSearchForm() {
  $('#add-via-btn').addEventListener('click', () => addViaRow());

  $('#swap-btn').addEventListener('click', () => {
    const f = $('#from-input'), t = $('#to-input');
    [f.value, t.value] = [t.value, f.value];
  });

  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch();
  });

  $('#back-to-form-btn').addEventListener('click', () => {
    $('#search-results').classList.add('hidden');
    $('#search-form').classList.remove('hidden');
  });
}

function addViaRow(prefill = '') {
  const container = $('#via-container');
  if (container.children.length >= CONFIG.MAX_VIA) return;
  const row = document.createElement('div');
  row.className = 'via-row';
  row.innerHTML = `
    <span class="field-dot" style="background:var(--ink-faint)"></span>
    <input type="text" class="field-input via-input" list="station-list" placeholder="経由駅を入力" value="${prefill}">
    <button type="button" class="via-remove-btn" aria-label="経由駅を削除">×</button>
  `;
  row.querySelector('.via-remove-btn').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function resolveStationId(name) {
  name = (name || '').trim();
  return NAME_TO_ID[name] || null;
}

function runSearch() {
  const hint = $('#form-hint');
  hint.textContent = '';

  const fromName = $('#from-input').value.trim();
  const toName = $('#to-input').value.trim();
  const fromId = resolveStationId(fromName);
  const toId = resolveStationId(toName);

  if (!fromName || !toName) { hint.textContent = '出発駅と到着駅を入力してください。'; return; }
  if (!fromId) { hint.textContent = `「${fromName}」という駅は見つかりません。候補一覧から選択してください。`; return; }
  if (!toId) { hint.textContent = `「${toName}」という駅は見つかりません。候補一覧から選択してください。`; return; }
  if (fromId === toId) { hint.textContent = '出発駅と到着駅が同じです。'; return; }

  const viaIds = [];
  for (const input of $$('.via-input')) {
    const v = input.value.trim();
    if (!v) continue;
    const id = resolveStationId(v);
    if (!id) { hint.textContent = `経由駅「${v}」が見つかりません。`; return; }
    viaIds.push(id);
  }

  const fastest = NTEGraph.findRoute(fromId, toId, viaIds, { preferFewTransfers: false });
  const fewest = NTEGraph.findRoute(fromId, toId, viaIds, { preferFewTransfers: true });

  if (!fastest) {
    showNoRoute();
    return;
  }

  saveHistory(fromName, toName);
  renderResults(fastest, fewest);

  $('#search-form').classList.add('hidden');
  $('#search-results').classList.remove('hidden');
}

function routeSignature(route) {
  return route.legs.map(l => l.transfer
    ? `T:${l.stationFrom}-${l.stationTo}`
    : `R:${l.lineId}:${l.from}-${l.to}`).join('|');
}

function showNoRoute() {
  const list = $('#results-list');
  list.innerHTML = `<div class="no-route-msg">該当するルートが見つかりませんでした。駅名をご確認のうえ、再度検索してください。</div>`;
  $('#search-form').classList.add('hidden');
  $('#search-results').classList.remove('hidden');
}

let CURRENT_ROUTES = [];

function renderResults(fastest, fewest) {
  const list = $('#results-list');
  const sameRoute = fewest && routeSignature(fastest) === routeSignature(fewest);
  CURRENT_ROUTES = sameRoute || !fewest ? [fastest] : [fastest, fewest];

  const cards = [];
  cards.push(routeCardHTML(fastest, sameRoute ? '最短ルート' : '最短時間', 'fastest', 0));
  if (fewest && !sameRoute) cards.push(routeCardHTML(fewest, '乗換少なめ', 'fewest', 1));
  list.innerHTML = cards.join('');

  $$('.route-card', list).forEach(card => {
    card.addEventListener('click', () => openRouteDetail(CURRENT_ROUTES[Number(card.dataset.routeIndex)]));
  });
}

function routeStripHTML(route) {
  const parts = [];
  route.legs.forEach(leg => {
    if (leg.transfer) {
      parts.push(`<span class="route-strip-xfer" title="${leg.label || '乗り換え'}">${leg.kind === 'walk' ? '🚶' : '⇅'}</span>`);
    } else {
      parts.push(`<span class="route-strip-seg" style="background:${lineOf(leg.lineId).hex}" title="${lineOf(leg.lineId).name}"></span>`);
    }
  });
  return `<div class="route-strip">${parts.join('')}</div>`;
}

function routeTimelineHTML(route) {
  const legsHtml = route.legs.map(leg => {
    if (leg.transfer) {
      return `<div class="leg-transfer">
        <span class="transfer-icon">${leg.kind === 'walk' ? '🚶' : '🔁'}</span>
        <span class="transfer-text">${leg.label || (stationName(leg.stationFrom) + ' 乗り換え')}（${leg.gate === 'inside' ? '改札内' : '改札外'}）</span>
        <span class="transfer-mins">${leg.minutes}分</span>
      </div>`;
    }
    const line = lineOf(leg.lineId);
    const passed = leg.segs.slice(0, -1).map(s => stationName(s.to));
    return `<div class="leg-ride">
      <div class="leg-rail">
        <span class="leg-dot" style="background:${line.hex}"></span>
        <span class="leg-line" style="background:${line.hex}"></span>
      </div>
      <div class="leg-body">
        <div class="leg-station">${stationName(leg.from)}</div>
        <div class="leg-line-name">
          <span class="leg-line-chip" style="background:${line.hex}">${line.symbol}</span>
          ${line.name}${line.loop ? '（単線環状・一方向）' : ''}
        </div>
        ${passed.length ? `<div class="leg-mins">通過: ${passed.join('・')}</div>` : ''}
        <div class="leg-mins">乗車 ${leg.minutes}分</div>
      </div>
    </div>`;
  }).join('');

  const lastLeg = [...route.legs].reverse().find(l => !l.transfer);
  const finalStation = lastLeg ? lastLeg.to : '';

  return `${legsHtml}
    <div class="leg-ride route-final-station">
      <div class="leg-rail"><span class="leg-dot" style="background:var(--accent-2)"></span></div>
      <div class="leg-body"><div class="leg-station">${stationName(finalStation)} <span style="color:var(--ink-dim);font-weight:400;font-size:12px;">（到着）</span></div></div>
    </div>`;
}

function routeCardHTML(route, tagLabel, tagClass, routeIndex) {
  const rideCount = route.legs.filter(l => !l.transfer).reduce((n, l) => n + l.segs.length, 0);

  return `<div class="route-card" data-route-index="${routeIndex}" role="button" tabindex="0">
    <div class="route-card-head">
      <div>
        <span class="route-tag ${tagClass}">${tagLabel}</span>
        <div class="route-time">${route.totalMinutes}<span>分</span></div>
      </div>
      <div class="route-meta">乗り換え ${route.transferCount}回 ・ 停車 ${rideCount}駅</div>
    </div>
    ${routeStripHTML(route)}
    <div class="route-timeline">${routeTimelineHTML(route)}</div>
    <p class="route-detail-hint">🗺 タップして地図とハイライトされた行き方を見る</p>
  </div>`;
}

/* ------------------------------------------------------------------ 履歴 */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveHistory(fromName, toName) {
  let h = loadHistory().filter(e => !(e.from === fromName && e.to === toName));
  h.unshift({ from: fromName, to: toName, ts: Date.now() });
  h = h.slice(0, CONFIG.MAX_HISTORY);
  localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(h));
}
function clearHistory() {
  localStorage.removeItem(CONFIG.HISTORY_KEY);
}

function wireHistoryButtons() {
  $$('.history-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHistoryDropdown(btn);
    });
  });
  document.addEventListener('click', closeHistoryDropdown);
}

function toggleHistoryDropdown(btn) {
  const dd = $('#history-dropdown');
  const targetId = btn.dataset.target;
  const isOpenForSame = !dd.classList.contains('hidden') && dd.dataset.target === targetId;
  closeHistoryDropdown();
  if (isOpenForSame) return;

  const history = loadHistory();
  const field = targetId === 'from-input' ? 'from' : 'to';
  const values = [];
  for (const h of history) {
    if (!values.includes(h[field])) values.push(h[field]);
    if (values.length >= 8) break;
  }

  dd.dataset.target = targetId;
  dd.innerHTML = `<div class="hd-title">最近の検索履歴</div>` + (
    values.length
      ? values.map(v => `<button type="button" data-val="${v}">${v}</button>`).join('')
      : `<div class="hd-empty">履歴はまだありません</div>`
  );
  dd.querySelectorAll('button[data-val]').forEach(b => {
    b.addEventListener('click', () => {
      $(`#${targetId}`).value = b.dataset.val;
      closeHistoryDropdown();
    });
  });

  const rect = btn.getBoundingClientRect();
  const formRect = $('#search-form').getBoundingClientRect();
  dd.style.top = `${btn.offsetParent ? rect.bottom - formRect.top + $('#search-form').scrollTop + 6 : 0}px`;
  dd.style.left = `${rect.left - formRect.left}px`;
  dd.classList.remove('hidden');
}
function closeHistoryDropdown() {
  const dd = $('#history-dropdown');
  dd.classList.add('hidden');
  dd.dataset.target = '';
}

/* ================================================================== 地図 */
let mapBuilt = false;

function wireMapTab() {
  renderLineLegend('#line-legend');
  buildMapSVG();
  window.addEventListener('resize', () => {
    if ($('#tab-map').classList.contains('active')) fitMapToContainer();
  });
}

function renderLineLegend(sel) {
  const el = $(sel);
  el.innerHTML = Object.values(CUSTOM_LINES).map(l => `
    <span class="legend-chip">
      <span class="legend-swatch" style="background:${l.hex}">${l.symbol}</span>
      ${l.name}${l.loop ? '（環状）' : '（折返）'}
    </span>`).join('');
}

function catmullRomPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// 駅ラベルの向き調整（密集エリアの視認性対策）
const LABEL_OVERRIDES = {
  s2:  { dx: -18, dy: -12, anchor: 'end' },
  s9:  { dx: 18, dy: -14, anchor: 'start' },
  s8:  { dx: 18, dy: 24, anchor: 'start' },
  s10: { dx: -18, dy: -12, anchor: 'end' },
  s11: { dx: 0, dy: -26, anchor: 'middle' },
  s13: { dx: -18, dy: 4, anchor: 'end' },
  s7:  { dx: 18, dy: -12, anchor: 'start' },
};

function buildMapSVG() {
  const size = CONFIG.MAP_IMAGE_SIZE;

  // 表示範囲は駅・制御点のバウンディングボックス＋余白に絞って初期ズームを最適化
  const allPts = [...Object.values(POS), ...Object.values(VERTICES)];
  const xs = allPts.map(p => p[0]), ys = allPts.map(p => p[1]);
  const pad = 260;
  const minX = Math.max(0, Math.min(...xs) - pad);
  const minY = Math.max(0, Math.min(...ys) - pad);
  const maxX = Math.min(size, Math.max(...xs) + pad);
  const maxY = Math.min(size, Math.max(...ys) + pad);
  const vbW = maxX - minX, vbH = maxY - minY;

  const linesHtml = Object.values(CUSTOM_LINES).map(line => {
    const pts = line.points.map(p => p.type === 'station' ? POS[p.id] : VERTICES[p.id]);
    const d = catmullRomPath(pts);
    return `
      <path d="${d}" fill="none" stroke="${line.hex}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"></path>
      <path d="${d}" fill="none" stroke="#05070a" stroke-width="26" stroke-dasharray="2 34" stroke-linecap="round" opacity="0.35"></path>
    `;
  }).join('');

  const stationsHtml = Object.keys(STATIONS).map(id => {
    const [x, y] = POS[id];
    const inter = isInterchange(id);
    const lo = LABEL_OVERRIDES[id] || { dx: 18, dy: 5, anchor: 'start' };
    const r = inter ? 15 : 11;
    return `
      <g class="station-node" data-station="${id}" tabindex="0" role="button" aria-label="${stationName(id)}">
        <circle cx="${x}" cy="${y}" r="${r + 6}" fill="transparent"></circle>
        <circle cx="${x}" cy="${y}" r="${r}" fill="${inter ? '#20262f' : '#12161d'}" stroke="${inter ? 'var(--accent-2)' : '#e9edf3'}" stroke-width="${inter ? 4 : 3}"></circle>
        <text x="${x + lo.dx}" y="${y + lo.dy}" font-size="30" text-anchor="${lo.anchor}">${stationName(id)}</text>
      </g>`;
  }).join('');

  const svg = `
    <svg id="map-svg" viewBox="${minX} ${minY} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">
      <image href="${CONFIG.MAP_IMAGE_SRC}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice"></image>
      <rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="#05070a" opacity="0.18"></rect>
      ${linesHtml}
      ${stationsHtml}
    </svg>
  `;

  const slot = $('#map-svg-slot');
  slot.innerHTML = svg;
  slot.dataset.vbw = vbW;
  slot.dataset.vbh = vbH;

  $$('.station-node', slot).forEach(node => {
    const open = (evt) => {
      evt.preventDefault();
      const rect = node.querySelector('circle:nth-child(2)').getBoundingClientRect();
      openStationPopup(node.dataset.station, rect.left + rect.width / 2, rect.top);
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
  });

  wireMapPanZoom();
  buildZoomControls();
  requestAnimationFrame(fitMapToContainer);
  mapBuilt = true;
}

let mapScale = 1;
function fitMapToContainer() {
  const slot = $('#map-svg-slot');
  const svg = $('#map-svg', slot);
  if (!svg) return;
  const vbW = parseFloat(slot.dataset.vbw);
  const containerW = slot.clientWidth;
  mapScale = (containerW / vbW) * 1.6; // 少しズームインした状態を初期表示にする
  applyMapScale();
  centerMapView();
}
function applyMapScale() {
  const slot = $('#map-svg-slot');
  const svg = $('#map-svg', slot);
  if (!svg) return;
  const vbW = parseFloat(slot.dataset.vbw);
  const vbH = parseFloat(slot.dataset.vbh);
  svg.style.width = `${vbW * mapScale}px`;
  svg.style.height = `${vbH * mapScale}px`;
}
function centerMapView() {
  const slot = $('#map-svg-slot');
  const svg = $('#map-svg', slot);
  if (!svg) return;
  requestAnimationFrame(() => {
    const svgW = svg.getBoundingClientRect().width;
    const svgH = svg.getBoundingClientRect().height;
    slot.scrollLeft = Math.max(0, (svgW - slot.clientWidth) / 2);
    slot.scrollTop = Math.max(0, (svgH - slot.clientHeight) / 2);
  });
}
function buildZoomControls() {
  if ($('.map-zoom-controls')) return;
  const wrap = document.createElement('div');
  wrap.className = 'map-zoom-controls';
  wrap.innerHTML = `<button type="button" id="zoom-in" aria-label="拡大">＋</button><button type="button" id="zoom-out" aria-label="縮小">－</button>`;
  $('#map-wrap').appendChild(wrap);
  $('#zoom-in').addEventListener('click', () => { mapScale = Math.min(mapScale * 1.25, 6); applyMapScale(); });
  $('#zoom-out').addEventListener('click', () => { mapScale = Math.max(mapScale / 1.25, 0.15); applyMapScale(); });
}

function wireMapPanZoom() {
  const slot = $('#map-svg-slot');
  let dragging = false, sx = 0, sy = 0, scrollL = 0, scrollT = 0;
  slot.addEventListener('mousedown', (e) => {
    dragging = true; slot.classList.add('dragging');
    sx = e.clientX; sy = e.clientY; scrollL = slot.scrollLeft; scrollT = slot.scrollTop;
  });
  window.addEventListener('mouseup', () => { dragging = false; slot.classList.remove('dragging'); });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    slot.scrollLeft = scrollL - (e.clientX - sx);
    slot.scrollTop = scrollT - (e.clientY - sy);
  });
  slot.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    mapScale = Math.min(6, Math.max(0.15, mapScale * (e.deltaY < 0 ? 1.1 : 0.9)));
    applyMapScale();
  }, { passive: false });
}

/* ---------------------------------------------------------- 駅ポップアップ */
function openStationPopup(stationId, x, y) {
  const popup = $('#station-popup');
  const lines = linesOfStation(stationId);
  const walk = WALK_TRANSFERS.find(w => w.a === stationId || w.b === stationId);

  popup.innerHTML = `
    <button type="button" class="popup-close" aria-label="閉じる">×</button>
    <h3>${stationName(stationId)}</h3>
    <div class="popup-lines">
      ${lines.map(lid => `<span class="legend-swatch" style="width:20px;height:20px;background:${CUSTOM_LINES[lid].hex}">${CUSTOM_LINES[lid].symbol}</span>`).join('')}
    </div>
    ${walk ? `<p style="font-size:11.5px;color:var(--ink-dim);margin:-4px 0 10px;">${walk.note}</p>` : ''}
    <div class="popup-btns">
      <button type="button" data-act="from">この駅を出発に設定</button>
      <button type="button" data-act="to">この駅を到着に設定</button>
      <button type="button" data-act="via">この駅を経由に追加</button>
    </div>
  `;
  popup.classList.remove('hidden');
  const pw = 240, vw = window.innerWidth, vh = window.innerHeight;
  popup.style.left = `${Math.min(Math.max(8, x - pw / 2), vw - pw - 8)}px`;
  popup.style.top = `${Math.min(Math.max(8, y - 10), vh - 220)}px`;

  popup.querySelector('.popup-close').addEventListener('click', closeStationPopup);
  popup.querySelector('[data-act="from"]').addEventListener('click', () => {
    activateTab('search');
    $('#from-input').value = stationName(stationId);
    closeStationPopup();
  });
  popup.querySelector('[data-act="to"]').addEventListener('click', () => {
    activateTab('search');
    $('#to-input').value = stationName(stationId);
    closeStationPopup();
  });
  popup.querySelector('[data-act="via"]').addEventListener('click', () => {
    activateTab('search');
    addViaRow(stationName(stationId));
    closeStationPopup();
  });

  setTimeout(() => document.addEventListener('click', outsidePopupClick), 0);
}
function outsidePopupClick(e) {
  const popup = $('#station-popup');
  if (popup.contains(e.target) || e.target.closest('.station-node')) return;
  closeStationPopup();
}
function closeStationPopup() {
  $('#station-popup').classList.add('hidden');
  document.removeEventListener('click', outsidePopupClick);
}

/* ---------------------------------------------------------- ルート詳細（地図ハイライト） */
function buildStopsSequence(route) {
  const stops = [];
  const push = (id) => { if (!stops.length || stops[stops.length - 1].id !== id) stops.push({ id }); };
  route.legs.forEach(leg => {
    if (leg.transfer) { push(leg.stationFrom); push(leg.stationTo); }
    else { push(leg.from); push(leg.to); }
  });
  if (stops.length) {
    stops[0].role = 'start';
    stops[stops.length - 1].role = 'goal';
    for (let i = 1; i < stops.length - 1; i++) stops[i].role = 'transfer';
  }
  return stops;
}

function segPointsToCoords(seg) {
  return seg.points.map(p => p.type === 'station' ? POS[p.id] : VERTICES[p.id]);
}

function buildRouteDetailSVG(route) {
  const size = CONFIG.MAP_IMAGE_SIZE;
  const routePts = [];
  const highlightPaths = [];

  route.legs.forEach(leg => {
    if (leg.transfer) {
      if (leg.kind === 'walk') {
        const a = POS[leg.stationFrom], b = POS[leg.stationTo];
        routePts.push(a, b);
        highlightPaths.push({ d: `M ${a[0]},${a[1]} L ${b[0]},${b[1]}`, color: '#f7f9fc', dashed: true });
      } else {
        routePts.push(POS[leg.stationFrom]);
      }
    } else {
      const pts = [];
      leg.segs.forEach((seg, i) => {
        const segPts = segPointsToCoords(seg);
        if (i > 0) segPts.shift();
        pts.push(...segPts);
      });
      routePts.push(...pts);
      highlightPaths.push({ d: catmullRomPath(pts), color: lineOf(leg.lineId).hex, dashed: false });
    }
  });

  const pad = 320;
  const xs = routePts.map(p => p[0]), ys = routePts.map(p => p[1]);
  const minX = Math.max(0, Math.min(...xs) - pad);
  const minY = Math.max(0, Math.min(...ys) - pad);
  const maxX = Math.min(size, Math.max(...xs) + pad);
  const maxY = Math.min(size, Math.max(...ys) + pad);
  const vbW = maxX - minX, vbH = maxY - minY;

  const baseLinesHtml = Object.values(CUSTOM_LINES).map(line => {
    const pts = line.points.map(p => p.type === 'station' ? POS[p.id] : VERTICES[p.id]);
    return `<path d="${catmullRomPath(pts)}" fill="none" stroke="${line.hex}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity="0.2"></path>`;
  }).join('');

  const highlightHtml = highlightPaths.map(hp => hp.dashed
    ? `<path d="${hp.d}" fill="none" stroke="${hp.color}" stroke-width="10" stroke-dasharray="4 20" stroke-linecap="round" opacity="0.95"></path>`
    : `<path d="${hp.d}" fill="none" stroke="#ffffff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"></path>
       <path d="${hp.d}" fill="none" stroke="${hp.color}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"></path>`
  ).join('');

  const stops = buildStopsSequence(route);
  const stopIds = new Set(stops.map(s => s.id));
  const dimStationsHtml = Object.keys(STATIONS).filter(id => !stopIds.has(id)).map(id => {
    const [x, y] = POS[id];
    return `<circle cx="${x}" cy="${y}" r="9" fill="#2b3341" stroke="#8b95a8" stroke-width="2" opacity="0.55"></circle>`;
  }).join('');

  const roleColor = { start: '#f2b134', goal: '#4fd1c5', transfer: '#ffffff' };
  const stopMarkersHtml = stops.map((s, i) => {
    const [x, y] = POS[s.id];
    const lo = LABEL_OVERRIDES[s.id] || { dx: 20, dy: 6, anchor: 'start' };
    return `<g>
      <circle cx="${x}" cy="${y}" r="22" fill="${roleColor[s.role]}" stroke="#20262f" stroke-width="4"></circle>
      <text x="${x}" y="${y + 8}" font-size="22" text-anchor="middle" font-weight="800" fill="#20262f">${i + 1}</text>
      <text x="${x + lo.dx}" y="${y + lo.dy - 30}" font-size="32" text-anchor="${lo.anchor}" font-weight="700" fill="#ffffff" stroke="#05070a" stroke-width="6" paint-order="stroke">${stationName(s.id)}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="${minX} ${minY} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">
    <image href="${CONFIG.MAP_IMAGE_SRC}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice"></image>
    <rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="#05070a" opacity="0.32"></rect>
    ${baseLinesHtml}
    ${dimStationsHtml}
    ${highlightHtml}
    ${stopMarkersHtml}
  </svg>`;
}

function openRouteDetail(route) {
  if (!route) return;
  const stops = buildStopsSequence(route);
  $('#rd-title').textContent = `${stationName(stops[0].id)} → ${stationName(stops[stops.length - 1].id)}`;
  $('#rd-eyebrow').textContent = `所要時間 ${route.totalMinutes}分 ／ 乗り換え ${route.transferCount}回`;
  $('#route-detail-map').innerHTML = buildRouteDetailSVG(route);
  $('#route-detail-timeline').innerHTML = `<div class="route-timeline">${routeTimelineHTML(route)}</div>`;
  $('#route-detail-overlay').classList.remove('hidden');
}
function closeRouteDetail() {
  $('#route-detail-overlay').classList.add('hidden');
}
function wireRouteDetailModal() {
  $('#rd-close').addEventListener('click', closeRouteDetail);
  $('#route-detail-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'route-detail-overlay') closeRouteDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRouteDetail();
  });
}

/* ================================================================ 駅一覧 */
function renderStationListTab() {
  const el = $('#station-list-by-line');
  el.innerHTML = Object.entries(CUSTOM_LINES).map(([lid, line]) => {
    const stations = stationsOfLine(lid);
    return `
      <div class="line-group">
        <div class="line-group-head">
          <span class="legend-swatch" style="background:${line.hex}">${line.symbol}</span>
          <h2>${line.name}</h2>
          <span class="line-sub">${line.loop ? '単線環状運転（一方向）' : '折り返し運転'} ・ ${stations.length}駅</span>
        </div>
        <div class="station-chip-list">
          ${stations.map(id => `
            <button type="button" class="station-chip" data-station="${id}">
              ${stationName(id)}
              ${isInterchange(id) ? '<span class="transfer-mark">乗換</span>' : ''}
            </button>`).join('')}
        </div>
      </div>`;
  }).join('');

  $$('.station-chip', el).forEach(chip => {
    chip.addEventListener('click', (e) => {
      const rect = chip.getBoundingClientRect();
      openStationPopup(chip.dataset.station, rect.left + rect.width / 2, rect.top);
    });
  });
}

/* ================================================================ 設定 */
function wireSettingsTab() {
  $('#clear-history-btn').addEventListener('click', () => {
    clearHistory();
    const status = $('#clear-history-status');
    status.textContent = '検索履歴を削除しました。';
    setTimeout(() => { status.textContent = ''; }, 3000);
  });
}
