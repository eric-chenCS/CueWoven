import { formatTime, queryTerms,playbackStart } from '../lib/search.js';
import {policy} from '../lib/web-items.js';
import {setItemImage} from '../lib/item-image.js';
import {captureLabel} from '../lib/capture-reason.js';
import {withTimeout} from '../lib/request-timeout.js';
import {resultLink} from '../lib/result-link.js';
import {sampleFor} from '../lib/samples.js';
import {videoIdFromUrl} from '../lib/video.js';

const $ = (id) => document.getElementById(id);
const q = $('q');
const details = $('details');
const refineToggle = $('refine-toggle');
const refinePanel = $('refine-panel');
const singleVideo = $('single-video');
const resultsEl = $('results');
const statusEl = $('status');
let sinceDays = 0;
let customRange = null; // {from, to} as YYYY-MM-DD while the Custom chip is on; either may be empty
let inferFilters = true;
// Local midnight at the start of From through the end of To, as the engine's [sinceMs, untilMs).
function customMs() {
  if (!customRange) return {};
  const day = (value, add = 0) => { if (!value) return 0; const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d + add).getTime(); };
  const sinceMs = day(customRange.from), untilMs = day(customRange.to, 1);
  return { ...(sinceMs ? { sinceMs } : {}), ...(untilMs ? { untilMs } : {}) };
}
function showChips(days) {
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-checked', String(c.dataset.days === 'custom' ? !!customRange : !customRange && Number(c.dataset.days) === days)));
  $('custom-range').hidden = !customRange;
}
let searchSeq = 0;
let activeIndex = -1;
let renderedSeq = -1;
let currentTab = null;
let currentMedia = null;
let resultOffset = 0;
let submittedQuery = null;
const searchText = () => [q.value.trim(), !refinePanel.hidden && details.value.trim()].filter(Boolean).join('. ');

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
  $('tie-hint').hidden = true;
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
    const wrap = tpl.content.firstElementChild.cloneNode(true),node=wrap.querySelector('.result');
    const url = resultLink(r);
    node.href = url;
    setItemImage(node.querySelector('img'), r);
    if (r.image) node.querySelector('img').alt = r.articleImage?(r.caption||'Saved article image'):'Saved scene at ' + formatTime(r.sceneStart ?? r.start);
    node.querySelector('.time').textContent = r.kind==='search'?'Search':r.kind==='page'||r.pageText?'Page':r.titleOnly ? 'Video' : formatTime(r.start);
    if(r.screenText)node.querySelector('.time').title='Text observed at '+formatTime(r.start)+'. Playback starts at '+formatTime(playbackStart(r))+'.';
    node.querySelector('.title').textContent = (r.sample&&sampleFor(r.videoId)?.title) || r.title || r.videoId;
    highlight(node.querySelector('.snippet'),r.articleImage?(r.caption||'An image from this article.'):r.scene?'A scene you watched.':r.titleOnly?'Matched the title.':'“'+r.text+'”',terms);
    const meta=node.querySelector('.meta');
    meta.textContent=[r.sample?'CueWoven demo':r.channel,r.kind?ago(r.watchedAt||r.indexedAt).replace(/^watched/,'visited'):ago(r.watchedAt||r.indexedAt)].filter(Boolean).join(' · ');
    meta.title=r.articleImage?'Image saved from this article':r.speechGenerated?'AI speech · played portions':r.screenText?'On-screen text · sampled frames':r.scene?'Visual match':r.titleOnly?'Title match':r.pageText?'Saved page text':r.sample?'Authored sample captions':'Spoken-content match';
    // Like Microsoft Recall: results that share the meaning but not your specific words say so.
    if(r.match==='related'){const tag=document.createElement('span');tag.className='related';tag.textContent='Related';tag.title='Similar in meaning, but doesn\u2019t contain the specific words you searched for';node.querySelector('.match-sources').append(tag);}
    for (const label of r.matchSources || [r.titleOnly?'Title':r.speechGenerated?'Audio':'Transcript']) {
      const indicator=document.createElement('span');indicator.textContent=label;
      indicator.title=label==='On-screen text'?'Text recognized from sampled video pixels; timing is approximate':label==='Audio'?'AI transcription of player audio':label==='Article image'?'A compressed image saved from this article':label==='Image caption'?'Caption or alternative text of a saved article image':label==='Scene'?'A saved image from the video':label==='Transcript'?'Words from video captions':label==='Page text'?'Text saved from a page you read':label==='Search'?'A saved search query':'A title from saved history';node.querySelector('.match-sources').append(indicator);
    }
    node.addEventListener('click', (e) => {
      e.preventDefault();
      openResult(url, e.ctrlKey || e.metaKey);
    });
    const copy=wrap.querySelector('.copy-link');
    copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(url);copy.textContent='Copied';}
      catch{copy.textContent='Copy failed';}
      setTimeout(()=>{copy.textContent='Copy link';},2000);
    });
    resultsEl.append(wrap);
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
  $('search-retry').hidden=true;
  $('applied-filters').hidden=true;
  $('ignore-inferred').hidden=true;
  const original = q.value.trim();
  const query = searchText();
  if (query !== submittedQuery) {
    if (original) empty('Press Enter to search'); else showIdle();
    return;
  }
  // Refinement belongs to this open popup; reopening starts with an independent query.
  chrome.storage.session.set({ lastQuery: original, sinceDays, customRange, inferFilters }).catch(() => {});
  if (!original) { showIdle(); return; }
  $('previous-video').disabled = true;
  $('next-video').disabled = true;
  $('page-label').textContent = 'Searching…';
  $('result-pages').hidden = !singleVideo.checked;
  const res = await withTimeout((async()=>{
    const videoId=$('video-scope').checked?currentMedia?.videoId:undefined;
    if(videoId){
      const state=await send({type:'video-status',videoId});
      if(state.error)throw Error(state.error);
      if(!state.has){const indexed=await send({type:'index-tab',tabId:currentTab.id});if(!indexed?.ok)throw Error(indexed?.reason||indexed?.error||'Captions are not ready. Play the video and retry.');}
    }
    return send({ type: 'search', query,videoId, sinceDays, ...customMs(), inferFilters, singleVideo: singleVideo.checked, offset: resultOffset,kind:$('kind-filter').value });
  })())
    .catch(e => ({ error: e.message || 'The search engine did not respond.' }));
  if (seq !== searchSeq) return; // a newer search started
  if (!res || res.error) {
    empty('Search failed', [res ? res.error : 'The search engine did not respond.'], 'Try again in a moment.');
    $('search-retry').hidden=false;
    return;
  }
  $('applied-filters').textContent=res.filtersRelaxed?'No matches with the suggested filters. Showing results without them.':res.appliedFilters?.length?'Using: '+res.appliedFilters.join(' · '):'';
  $('applied-filters').hidden=!res.filtersRelaxed&&!res.appliedFilters?.length;
  $('ignore-inferred').hidden=!res.appliedFilters?.length;
  showChips(res.appliedSinceDays ?? sinceDays);
  if (res.sceneError) renderVision({status:'error',error:res.sceneError});
  else if(res.visualPending){$('scene-status').textContent='Image search is preparing. Text results are ready; search again shortly for images.';$('scene-status').hidden=false;}
  if (res.empty) {showIdle();return;}
  if (!res.results.length) {
    if (singleVideo.checked && resultOffset > 0) {
      resultOffset = 0; // The library may have changed while browsing matches.
      return runSearch();
    }
    empty('No match yet', ['Nothing you’ve watched lines up with that.'], (res.appliedSinceDays||sinceDays||customRange) ? 'Try “Any time”, or describe it differently.' : 'Try describing it a different way.');
    return;
  }
  render(singleVideo.checked ? res.results.slice(0, 1) : res.results, query);
  showTie(res.nearTie === true);
  renderedSeq=seq;
  $('result-pages').hidden = !singleVideo.checked;
  $('page-label').textContent = resultOffset ? `Match ${resultOffset + 1}` : 'Best match';
  $('previous-video').disabled = resultOffset === 0;
  $('next-video').disabled = res.results.length < 2;
}

// The search engine decides near ties (it knows which scores are comparable); this only shows it.
function showTie(tie) {
  $('tie-hint').hidden = !tie;
  if (!tie) return;
  $('tie-next').hidden = !singleVideo.checked;
  $('tie-text').textContent = singleVideo.checked
    ? 'Another video matches almost as well. Add the channel or a detail to pick one, or'
    : 'The top videos match almost equally. Add the channel or a detail to pick one.';
}
$('ignore-inferred').addEventListener('click',()=>{inferFilters=false;resultOffset=0;runSearch();q.focus();});
$('tie-next').addEventListener('click', () => $('next-video').click());

function prepareSearch() {
  submittedQuery = null;
  renderedSeq = -1;
  $('applied-filters').hidden = true;
  $('ignore-inferred').hidden = true;
  resultOffset = 0;
  $('previous-video').disabled = true;
  $('next-video').disabled = true;
  $('search-retry').hidden=true;
  ++searchSeq; // Invalidate pending results as soon as the query changes.
  activeIndex = -1;
  resultsEl.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
  if (!q.value.trim()) {
    chrome.storage.session.set({ lastQuery: '', sinceDays, customRange }).catch(() => {});
    showIdle();
    return;
  }
  empty('Press Enter to search');
}

q.addEventListener('input', () => {
  inferFilters = true;
  details.value = '';
  refinePanel.hidden = true;
  refineToggle.setAttribute('aria-expanded', 'false');
  refineToggle.disabled = !q.value.trim();
  prepareSearch();
});

details.addEventListener('input', prepareSearch);
details.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    resultOffset = 0;
    submittedQuery = searchText();
    runSearch();
  }
});

refineToggle.addEventListener('click', () => {
  resultOffset = 0;
  const open = refinePanel.hidden;
  refinePanel.hidden = !open;
  refineToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    details.focus();
  } else {
    const hadDetails = !!details.value.trim();
    details.value = '';
    if (hadDetails) prepareSearch();
    q.focus();
  }
});

q.addEventListener('keydown', async (e) => {
  const items = Array.from(resultsEl.querySelectorAll('.result'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!items.length) return;
    e.preventDefault();
    activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    items[activeIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    const target = items[activeIndex >= 0 ? activeIndex : 0];
    if (target && renderedSeq===searchSeq && (activeIndex>=0 || singleVideo.checked)) openResult(target.href, e.ctrlKey || e.metaKey);
    else {
      resultOffset=0;
      submittedQuery=searchText();
      await runSearch();
    }
  }
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const custom = chip.dataset.days === 'custom';
    customRange = custom ? { from: $('range-from').value, to: $('range-to').value } : null;
    sinceDays = custom ? 0 : Number(chip.dataset.days) || 0;
    showChips(sinceDays);
    inferFilters = false;
    resultOffset = 0;
    runSearch();
    (custom && !customRange.from && !customRange.to ? $('range-from') : q).focus();
  });
});
for (const id of ['range-from', 'range-to']) $(id).addEventListener('change', () => {
  let from = $('range-from').value, to = $('range-to').value;
  if (from && to && from > to) { [from, to] = [to, from]; $('range-from').value = from; $('range-to').value = to; }
  customRange = { from, to };
  resultOffset = 0;
  runSearch();
});

singleVideo.addEventListener('change', () => {
  resultOffset = 0;
  chrome.storage.local.set({ singleVideoView: singleVideo.checked }).catch(() => {});
  runSearch();
});
$('kind-filter').addEventListener('change',()=>{resultOffset=0;runSearch();});
$('video-scope').addEventListener('change',()=>{resultOffset=0;runSearch();});
$('search-retry').addEventListener('click',runSearch);
$('web-pause-popup').addEventListener('click',async()=>{const {webCapture={}}=await chrome.storage.local.get('webCapture');await chrome.storage.local.set({webCapture:{...webCapture,paused:!webCapture.paused}});refreshWebPause();});
async function refreshWebPause(){const {webCapture={}}=await chrome.storage.local.get('webCapture');$('web-pause-popup').hidden=!webCapture.enabled;const on=!webCapture.paused;$('web-pause-popup').textContent=on?'Stop saving sites':'Start saving sites';$('web-pause-popup').title=on?'CueWoven is saving pages you read on your sites. Click to stop.':'CueWoven isn\u2019t saving websites right now. Click to start again.';}
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
  if (!(stats.total||stats.videos)) empty('Nothing saved yet',['Watch a video, add a link or try the samples.']);
  else empty('Describe what you remember',[],'Like “the part about why batteries wear out”');
}

function showModel(state) {
  const box = $('model');
  if (!state || state.status === 'ready' || state.status === 'idle') { box.hidden = true; return; }
  box.hidden = false;
  if (state.status === 'error') {
    $('model-text').textContent = 'Couldn’t load the search model: ' + (state.error || 'unknown error');
    $('model-bar').style.width = '0';
  } else {
    $('model-text').textContent = `Loading search… ${Math.round((state.progress || 0) * 100)}%`;
    $('model-bar').style.width = Math.round((state.progress || 0) * 100) + '%';
  }
}

async function refreshStatus() {
  const s = await send({ type: 'status' });
  if (!s || s.error) { statusEl.textContent = ''; return; }
  stats = s;
  renderEmbedding(s.embeddingMigration);
  if (s.total||s.videos) $('start-choice').hidden = true;
  statusEl.textContent=`${(s.total||s.videos||0).toLocaleString()} saved`;
  statusEl.title=`${s.videos} videos`+(s.pages?`, ${s.pages} pages`:'')+(s.searches?`, ${s.searches} searches`:'')+`, ${s.chunks} moments`+(s.scenes?`, ${s.scenes} scenes`:'');
  showModel(s.model);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target === 'offscreen') return false;
  if (msg.type === 'speech-state') renderSpeech(msg.state);
  if (msg.type === 'vision-state') renderVision(msg.state);
  if (msg.type === 'ocr-state') {const state=msg.state,message=state.status==='loading'?'Loading on-screen text reader…':state.status==='working'?'Reading on-screen text on this device…':state.status==='error'?state.error:'';$('ocr-status').textContent=message;$('ocr-status').hidden=!message;}
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
  if(currentTab&&/^https?:/.test(currentTab.url||''))send({type:'capture-status',tabId:currentTab.id}).then(state=>{$('capture-indicator').textContent=captureLabel(state.reason);$('capture-indicator').hidden=!$('page-capture').hidden;}).catch(()=>{});
  if(currentTab&&/^https?:/.test(currentTab.url||'')&&!(currentTab.url||'').startsWith('https://www.youtube.com/')){$('page-capture').hidden=false;await refreshPageCapture();}
  if (!currentTab || !currentTab.url || !/^https:\/\/www\.youtube\.com\/watch\?/.test(currentTab.url)&&!policy.safeUrl(currentTab.url)) return;
  $('index-now').hidden = false;
  try {
    const { video } = await chrome.tabs.sendMessage(currentTab.id, { type: 'get-video' });
    currentMedia=video;
    if(!currentMedia&&videoIdFromUrl(currentTab.url))currentMedia={videoId:videoIdFromUrl(currentTab.url),title:currentTab.title||'this video'};
    $('video-scope-row').hidden=!currentMedia;
    if(!currentTab.url.startsWith('https://www.youtube.com/'))$('index-now').hidden=!video;
    if (video && video.title) $('index-now-text').textContent = video.title;
  } catch (_) {
    if(videoIdFromUrl(currentTab.url)){currentMedia={videoId:videoIdFromUrl(currentTab.url),title:currentTab.title||'this video'};$('video-scope-row').hidden=false;}
  }
}

$('index-now-btn').addEventListener('click', async () => {
  const btn = $('index-now-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  const res = await send({ type: 'index-tab', tabId: currentTab.id });
  btn.disabled = false;
  if (res && res.ok) {
    btn.textContent = 'Saved';
    $('index-now-text').textContent = res.chunkCount ? `Saved ${res.chunkCount} moments` : 'Saved';
    refreshStatus();
  } else {
    btn.textContent = 'Retry';
    $('index-now-text').textContent = (res && (res.reason || res.error)) || 'Couldn’t index this video.';
  }
});

async function refreshPageCapture(){
  if(!currentTab)return;
  const status=await send({type:'web-page-status',tabId:currentTab.id}).catch(()=>({reason:'refresh-required'}));
  $('page-capture-status').textContent=captureLabel(status.reason);
  $('page-save-now').disabled=!['saved','duplicate','waiting','too-short'].includes(status.reason);
  $('page-forget').disabled=!status.host||status.incognito;
}
$('page-save-now').addEventListener('click',async()=>{const result=await send({type:'index-tab',tabId:currentTab.id}).catch(error=>({error:error.message}));$('page-capture-status').textContent=result.ok?'Saved on this device':result.reason||result.error||'Page capture is busy.';});
$('page-forget').addEventListener('click',async()=>{const result=await send({type:'web-forget-current',tabId:currentTab.id}).catch(error=>({error:error.message}));if(result.error)$('page-capture-status').textContent=result.error;else{await refreshPageCapture();refreshStatus();}});
$('open-library').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

$('start-restore').addEventListener('click', () => chrome.tabs.create({url:chrome.runtime.getURL('options/options.html#sec-data')}));
$('start-samples').addEventListener('click',async()=>{
  const button=$('start-samples');button.disabled=true;button.textContent='Adding samples…';
  const result=await send({type:'load-samples'}).catch(error=>({error:error.message}));
  button.disabled=false;button.textContent='Try sample videos';
  if(result.error){empty('Could not load samples',[result.error]);return;}
  await refreshStatus();q.value='why do batteries wear out';refineToggle.disabled=false;prepareSearch();q.focus();
});
$('start-empty').addEventListener('click', async () => {
  await chrome.storage.local.set({ onboardingComplete: true });
  $('start-choice').hidden = true;
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async () => {
  q.focus();
  const saved = await chrome.storage.session.get(['lastQuery', 'sinceDays', 'customRange', 'inferFilters']).catch(() => ({}));
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  $('range-from').max = $('range-to').max = today;
  await refreshStatus();
  refreshWebPause();
  const { onboardingComplete, singleVideoView } = await chrome.storage.local.get(['onboardingComplete', 'singleVideoView']);
  singleVideo.checked = singleVideoView !== false;
  $('start-choice').hidden = !!onboardingComplete || (stats.total||stats.videos) > 0;
  await setupIndexNow();
  refreshSpeech();
  send({type:'vision-status'}).then(renderVision).catch(()=>{});
  inferFilters = saved?.inferFilters !== false;
  if (saved?.customRange) {
    customRange = { from: saved.customRange.from || '', to: saved.customRange.to || '' };
    $('range-from').value = customRange.from; $('range-to').value = customRange.to;
  }
  if (saved && (saved.sinceDays || customRange)) {
    sinceDays = customRange ? 0 : saved.sinceDays;
    showChips(sinceDays);
  }
  if (saved && saved.lastQuery) {
    q.value = saved.lastQuery;
    refineToggle.disabled = !q.value.trim();
    q.select();
    prepareSearch();
  } else {
    showIdle();
  }
  if (stats.total||stats.videos) send({ type: 'warmup',scenes:stats.scenes>0 }).catch(()=>{}); // no model download is needed for an empty library
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
  const videoTab = !!currentMedia || !!currentTab?.url && /^https:\/\/www\.youtube\.com\/watch\?/.test(currentTab.url) && !new URL(currentTab.url).searchParams.has('recall_index');
  $('speech').hidden = !active && !videoTab;
  $('speech-heading').textContent=state.status==='recording'?'Speech-to-text · listening':state.status==='preparing'?'Speech-to-text · loading model':'Speech-to-text';
  $('speech-start').disabled = active || !videoTab;
  $('speech-stop').hidden = !active;$('speech-stop').disabled = state.status === 'stopping';
  const label = state.video?.title ? '“' + state.video.title + '”' : 'this video';
  $('speech-status').textContent = state.status === 'preparing' ? 'Loading speech model… ' + Math.round((state.progress || 0) * 100) + '%' :
    state.status === 'recording' ? 'Listening to ' + label + ' · ' + (state.saved || 0) + ' speech segments saved. Only played portions are captured.' :
    state.status === 'stopping' ? 'Finishing captured audio…' : state.reason || (state.saved ? 'Saved ' + state.saved + ' speech segments from ' + label + '.' : 'Starts automatically when captions cannot be captured. Start retries with the English model even if language metadata is uncertain or wrong; recognition errors are possible.');
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
