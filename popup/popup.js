import { formatTime, deepLink, queryTerms } from '../lib/search.js';

const $ = (id) => document.getElementById(id);
const q = $('q');
const details = $('details');
const refineToggle = $('refine-toggle');
const refinePanel = $('refine-panel');
const singleVideo = $('single-video');
const resultsEl = $('results');
const statusEl = $('status');
let sinceDays = 0;
let searchSeq = 0;
let activeIndex = -1;
let currentTab = null;
let resultOffset = 0;

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
  $('result-pages').hidden = true;
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
    node.querySelector('img').src = r.image || `https://i.ytimg.com/vi/${encodeURIComponent(r.videoId)}/mqdefault.jpg`;
    if (r.image) node.querySelector('img').alt = 'Saved scene at ' + formatTime(r.sceneStart ?? r.start);
    node.querySelector('.time').textContent = r.titleOnly ? 'Video' : formatTime(r.start);
    node.querySelector('.title').textContent = r.title || r.videoId;
    highlight(node.querySelector('.snippet'), r.scene ? 'Saved scene from the portion you watched.' : r.titleOnly ? 'From your history · title match. Add a transcript to search what was said.' : '“' + r.text + '”', terms);
    node.querySelector('.meta').textContent = [r.channel, ago(r.watchedAt || r.indexedAt), r.speechGenerated && 'AI speech · played portions', r.scene ? 'Visual match' : r.titleOnly ? 'Title match' : 'Spoken-content match']
      .filter(Boolean)
      .join(' · ');
    for (const label of r.matchSources || [r.titleOnly?'Title':r.speechGenerated?'Audio':'Transcript']) {
      const indicator=document.createElement('span');indicator.textContent=label;
      indicator.title=label==='Audio'?'AI transcription of player audio':label==='Scene'?'A saved image from the video':label==='Transcript'?'Words from video captions':'Video title from saved history';node.querySelector('.match-sources').append(indicator);
    }
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
  clearTimeout(debounce);
  const seq = ++searchSeq;
  const original = q.value.trim();
  const query = [original, !refinePanel.hidden && details.value.trim()].filter(Boolean).join('. ');
  // Refinement belongs to this open popup; reopening starts with an independent query.
  chrome.storage.session.set({ lastQuery: original, sinceDays }).catch(() => {});
  if (!original) { showIdle(); return; }
  $('previous-video').disabled = true;
  $('next-video').disabled = true;
  $('page-label').textContent = 'Searching…';
  $('result-pages').hidden = !singleVideo.checked;
  const res = await send({ type: 'search', query, sinceDays, singleVideo: singleVideo.checked, offset: resultOffset })
    .catch(e => ({ error: e.message || 'The search engine did not respond.' }));
  if (seq !== searchSeq) return; // a newer search started
  if (!res || res.error) {
    empty('Search failed', [res ? res.error : 'The search engine did not respond.'], 'Try again in a moment.');
    return;
  }
  if (res.sceneError) renderVision({status:'error',error:res.sceneError});
  if (res.empty) {showIdle();return;}
  if (!res.results.length) {
    if (singleVideo.checked && resultOffset > 0) {
      resultOffset = 0; // The library may have changed while browsing matches.
      return runSearch();
    }
    empty('No match yet', ['Nothing you’ve watched lines up with that.'], sinceDays ? 'Try “Any time”, or describe it differently.' : 'Try describing it a different way.');
    return;
  }
  render(singleVideo.checked ? res.results.slice(0, 1) : res.results, query);
  $('result-pages').hidden = !singleVideo.checked;
  $('page-label').textContent = resultOffset ? `Video ${resultOffset + 1}` : 'Best match';
  $('previous-video').disabled = resultOffset === 0;
  $('next-video').disabled = res.results.length < 2;
}

let debounce;
function scheduleSearch() {
  resultOffset = 0;
  $('previous-video').disabled = true;
  $('next-video').disabled = true;
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
    resultOffset = 0;
    runSearch();
  }
});

refineToggle.addEventListener('click', () => {
  resultOffset = 0;
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
    else { resultOffset = 0; runSearch(); }
  }
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
    sinceDays = Number(chip.dataset.days) || 0;
    resultOffset = 0;
    clearTimeout(debounce);
    runSearch();
    q.focus();
  });
});

singleVideo.addEventListener('change', () => {
  resultOffset = 0;
  chrome.storage.local.set({ singleVideoView: singleVideo.checked }).catch(() => {});
  runSearch();
});
$('previous-video').addEventListener('click', () => {
  resultOffset = Math.max(0, resultOffset - 1);
  runSearch();
});
$('next-video').addEventListener('click', () => {
  resultOffset++;
  runSearch();
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
  renderEmbedding(s.embeddingMigration);
  if (s.videos) $('start-choice').hidden = true;
  statusEl.textContent = `${s.videos} video${s.videos === 1 ? '' : 's'} · ${s.chunks} moments` + (s.scenes ? ` · ${s.scenes} scenes` : '');
  showModel(s.model);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target === 'offscreen') return false;
  if (msg.type === 'speech-state') renderSpeech(msg.state);
  if (msg.type === 'vision-state') renderVision(msg.state);
  if (msg.type === 'embedding-status') renderEmbedding(msg.state);
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
  const { onboardingComplete, singleVideoView } = await chrome.storage.local.get(['onboardingComplete', 'singleVideoView']);
  singleVideo.checked = singleVideoView !== false;
  $('start-choice').hidden = !!onboardingComplete || stats.videos > 0;
  await setupIndexNow();
  refreshSpeech();
  send({type:'vision-status'}).then(renderVision).catch(()=>{});
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

// Caption failures start speech automatically; the popup exposes status and controls.
function renderVision(state={}) {
  const message=state.status==='loading'?'Downloading scene model… '+Math.round((state.progress || 0)*100)+'%':state.status==='working'?'Processing scenes on this device…':state.status==='error'?state.error:'';
  $('scene-status').textContent=message;$('scene-status').hidden=!message;
}
function renderEmbedding(state={}) {
  const message=state.status==='running'?`Improving saved text matches… ${state.done}/${state.total}. Search remains available.`:state.status==='error'?'Saved-match update paused: '+state.error:'';
  $('embedding-status').textContent=message;$('embedding-status').hidden=!message;
}
function renderSpeech(state = {}) {
  const active = ['preparing', 'recording', 'stopping'].includes(state.status);
  const videoTab = !!currentTab?.url && /^https:\/\/www\.youtube\.com\/watch\?/.test(currentTab.url) && !new URL(currentTab.url).searchParams.has('recall_index');
  $('speech').hidden = !active && !videoTab;
  $('speech-start').disabled = active || !videoTab;
  $('speech-stop').hidden = !active;$('speech-stop').disabled = state.status === 'stopping';
  const label = state.video?.title ? '“' + state.video.title + '”' : 'this video';
  $('speech-status').textContent = state.status === 'preparing' ? 'Loading speech model… ' + Math.round((state.progress || 0) * 100) + '%' :
    state.status === 'recording' ? 'Listening to ' + label + ' · ' + (state.saved || 0) + ' speech segments saved. Only played portions are captured.' :
    state.status === 'stopping' ? 'Finishing captured audio…' : state.reason || (state.saved ? 'Saved ' + state.saved + ' speech segments from ' + label + '.' : 'Starts automatically when captions cannot be captured. You can retry here; transcripts may contain recognition errors.');
}
async function refreshSpeech() {
  const state = await send({type: 'speech-status'}).catch(error => ({reason: error.message}));renderSpeech(state);
}
$('speech-start').addEventListener('click', async () => {
  const button = $('speech-start');button.disabled = true;
  try {
    const response = await send({type: 'speech-start', tabId: currentTab.id});
    if (response?.error) throw new Error(response.error);
    renderSpeech(response);
  } catch (error) {renderSpeech({reason: error.message});}
});
$('speech-stop').addEventListener('click', async () => {
  $('speech-stop').disabled = true;
  const response = await send({type: 'speech-stop'}).catch(error => ({reason: error.message}));renderSpeech(response);
});
