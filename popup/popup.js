import { formatTime, deepLink, queryTerms } from '../lib/search.js';

const $ = (id) => document.getElementById(id);
const q = $('q');
const details = $('details');
const refineToggle = $('refine-toggle');
const refinePanel = $('refine-panel');
const resultsEl = $('results');
const statusEl = $('status');
let sinceDays = 0;
let searchSeq = 0;
let activeIndex = -1;
let currentTab = null;

const send = (msg) => chrome.runtime.sendMessage(msg);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function highlight(el, text, terms) {
  el.textContent = '';
  if (!terms.length) { el.textContent = text; return; }
  const re = new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) el.append(text.slice(last, m.index));
    const mark = document.createElement('mark');
    mark.textContent = m[0];
    el.append(mark);
    last = m.index + m[0].length;
  }
  if (last < text.length) el.append(text.slice(last));
}

function ago(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 864e5);
  if (d <= 0) return 'watched today';
  if (d === 1) return 'watched yesterday';
  if (d < 30) return `watched ${d} days ago`;
  return 'watched ' + new Date(ts).toLocaleDateString();
}

function empty(title, lines = [], hint = '') {
  resultsEl.textContent = '';
  const box = document.createElement('div');
  box.className = 'empty';
  const h = document.createElement('h2');
  h.textContent = title;
  box.append(h);
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    box.append(p);
  }
  if (hint) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = hint;
    box.append(p);
  }
  resultsEl.append(box);
}

function render(results, query) {
  resultsEl.textContent = '';
  activeIndex = -1;
  const terms = queryTerms(query);
  const tpl = $('result-tpl');
  for (const r of results) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const url = r.titleOnly ? `https://www.youtube.com/watch?v=${encodeURIComponent(r.videoId)}` : deepLink(r.videoId, r.start);
    node.href = url;
    node.querySelector('img').src = `https://i.ytimg.com/vi/${encodeURIComponent(r.videoId)}/mqdefault.jpg`;
    node.querySelector('.time').textContent = r.titleOnly ? 'Video' : formatTime(r.start);
    node.querySelector('.title').textContent = r.title || r.videoId;
    highlight(node.querySelector('.snippet'), r.titleOnly ? 'From your history · title match. Add a transcript to search what was said.' : '“' + r.text + '”', terms);
    node.querySelector('.meta').textContent = [r.channel, ago(r.watchedAt || r.indexedAt), Math.round(r.score * 100) + (r.titleOnly ? '% title match' : '% match')]
      .filter(Boolean)
      .join(' · ');
    node.addEventListener('click', (e) => {
      e.preventDefault();
      openResult(url, e.ctrlKey || e.metaKey);
    });
    resultsEl.append(node);
  }
}

function openResult(url, background) {
  chrome.tabs.create({ url, active: !background });
  if (!background) window.close();
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
async function runSearch() {
  const seq = ++searchSeq;
  const original = q.value.trim();
  const query = [original, !refinePanel.hidden && details.value.trim()].filter(Boolean).join('. ');
  // Refinement belongs to this open popup; reopening starts with an independent query.
  chrome.storage.session.set({ lastQuery: original, sinceDays }).catch(() => {});
  if (!original) { showIdle(); return; }
  const res = await send({ type: 'search', query, sinceDays });
  if (seq !== searchSeq) return; // a newer search started
  if (!res || res.error) {
    empty('Search failed', [res ? res.error : 'The search engine did not respond.'], 'Try again in a moment.');
    return;
  }
  if (res.empty) { showIdle(); return; }
  if (!res.results.length) {
    empty('No match yet', ['Nothing you’ve watched lines up with that.'], sinceDays ? 'Try “Any time”, or describe it differently.' : 'Try describing it a different way.');
    return;
  }
  render(res.results, query);
}

let debounce;
function scheduleSearch() {
  ++searchSeq; // Invalidate pending results as soon as the query changes.
  activeIndex = -1;
  resultsEl.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
  clearTimeout(debounce);
  if (!q.value.trim()) {
    chrome.storage.session.set({ lastQuery: '', sinceDays }).catch(() => {});
    showIdle();
    return;
  }
  debounce = setTimeout(runSearch, 250);
}

q.addEventListener('input', () => {
  details.value = '';
  refinePanel.hidden = true;
  refineToggle.setAttribute('aria-expanded', 'false');
  refineToggle.disabled = !q.value.trim();
  scheduleSearch();
});

details.addEventListener('input', scheduleSearch);
details.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    clearTimeout(debounce);
    runSearch();
  }
});

refineToggle.addEventListener('click', () => {
  clearTimeout(debounce);
  const open = refinePanel.hidden;
  refinePanel.hidden = !open;
  refineToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    details.focus();
  } else {
    details.value = '';
    q.focus();
  }
  runSearch();
});

q.addEventListener('keydown', (e) => {
  const items = Array.from(resultsEl.querySelectorAll('.result'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!items.length) return;
    e.preventDefault();
    activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    items[activeIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    clearTimeout(debounce);
    const target = items[activeIndex >= 0 ? activeIndex : 0];
    if (target && activeIndex >= 0) openResult(target.href, e.ctrlKey || e.metaKey);
    else runSearch();
  }
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
    sinceDays = Number(chip.dataset.days) || 0;
    clearTimeout(debounce);
    runSearch();
    q.focus();
  });
});

// ---------------------------------------------------------------------------
// Status, model progress, idle state
// ---------------------------------------------------------------------------
let stats = { videos: 0, chunks: 0 };

function showIdle() {
  if (!stats.videos) {
    empty('Your watch history is empty so far', [
      'Watch any YouTube video with captions for about 20 seconds and Recall indexes it automatically.',
    ], 'Pre-load demo videos from Library & settings.');
  } else {
    empty('Describe what you remember', [
      `Searching titles and indexed transcripts from ${stats.videos} saved video${stats.videos === 1 ? '' : 's'}.`,
    ], 'Try: “the part about why batteries wear out”');
  }
}

function showModel(state) {
  const box = $('model');
  if (!state || state.status === 'ready' || state.status === 'idle') { box.hidden = true; return; }
  box.hidden = false;
  if (state.status === 'error') {
    $('model-text').textContent = 'Couldn’t load the search model: ' + (state.error || 'unknown error');
    $('model-bar').style.width = '0';
  } else {
    $('model-text').textContent = `Loading the search model (first run downloads ~23 MB)… ${Math.round((state.progress || 0) * 100)}%`;
    $('model-bar').style.width = Math.round((state.progress || 0) * 100) + '%';
  }
}

async function refreshStatus() {
  const s = await send({ type: 'status' });
  if (!s || s.error) { statusEl.textContent = ''; return; }
  stats = s;
  if (s.videos) $('start-choice').hidden = true;
  statusEl.textContent = `${s.videos} video${s.videos === 1 ? '' : 's'} · ${s.chunks} moments`;
  showModel(s.model);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target === 'offscreen') return false;
  if (msg.type === 'model-status') showModel(msg.state);
  if (msg.type === 'index-changed') refreshStatus();
  return false;
});

// ---------------------------------------------------------------------------
// "Index this video now" for the current YouTube tab
// ---------------------------------------------------------------------------
async function setupIndexNow() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!currentTab || !currentTab.url || !/^https:\/\/www\.youtube\.com\/watch\?/.test(currentTab.url)) return;
  $('index-now').hidden = false;
  try {
    const { video } = await chrome.tabs.sendMessage(currentTab.id, { type: 'get-video' });
    if (video && video.title) $('index-now-text').textContent = `Index “${video.title}”`;
  } catch (_) { /* tab needs a reload; handled on click */ }
}

$('index-now-btn').addEventListener('click', async () => {
  const btn = $('index-now-btn');
  btn.disabled = true;
  btn.textContent = 'Indexing…';
  const res = await send({ type: 'index-tab', tabId: currentTab.id });
  btn.disabled = false;
  if (res && res.ok) {
    btn.textContent = 'Done ✓';
    $('index-now-text').textContent = res.chunkCount ? `Indexed ${res.chunkCount} moments from this video` : 'Indexed';
    refreshStatus();
  } else {
    btn.textContent = 'Retry';
    $('index-now-text').textContent = (res && (res.reason || res.error)) || 'Couldn’t index this video.';
  }
});

$('open-library').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

$('start-import').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('start-empty').addEventListener('click', async () => {
  await chrome.storage.local.set({ onboardingComplete: true });
  $('start-choice').hidden = true;
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async () => {
  q.focus();
  const saved = await chrome.storage.session.get(['lastQuery', 'sinceDays']).catch(() => ({}));
  await refreshStatus();
  const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
  $('start-choice').hidden = !!onboardingComplete || stats.videos > 0;
  setupIndexNow();
  if (saved && saved.sinceDays) {
    sinceDays = saved.sinceDays;
    document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(Number(c.dataset.days) === sinceDays)));
  }
  if (saved && saved.lastQuery) {
    q.value = saved.lastQuery;
    refineToggle.disabled = !q.value.trim();
    q.select();
    runSearch();
  } else {
    showIdle();
  }
  if (stats.videos) send({ type: 'warmup' }); // no model download is needed for an empty library
})();
