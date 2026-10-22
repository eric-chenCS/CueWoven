import { formatTime, queryTerms,playbackStart } from '../lib/search.js';
import {policy} from '../lib/web-items.js';
import {setItemImage} from '../lib/item-image.js';
import {captureLabel} from '../lib/capture-reason.js';
import {withTimeout} from '../lib/request-timeout.js';
import {resultLink} from '../lib/result-link.js';
import {sampleFor} from '../lib/samples.js';
import {videoIdFromUrl} from '../lib/video.js';
import {openShortcut} from '../lib/shortcut.js';
import {refinementQuestions} from '../lib/refinement-questions.js';
import {hasSearchDetail} from '../lib/search-input.js';

const $ = (id) => document.getElementById(id);
const q = $('q');
const details = $('details');
const refineToggle = $('refine-toggle');
const refinePanel = $('refine-panel');
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
let submittedQuery = null;
// Details build on the search typed above them; "Not this one" hides results. Both belong to this search only.
let clues = [];
const excluded = new Set();
const searchText = () => [q.value.trim(), ...clues].filter(Boolean).join('. ');
function renderClues() {
  const bar = $('clues');
  bar.textContent = '';
  const tag = (label, name, remove) => {
    const el = document.createElement('span'), text = document.createElement('span'), x = document.createElement('button');
    el.className = 'clue'; text.textContent = label;
    x.type = 'button'; x.textContent = '✕'; x.title = name; x.setAttribute('aria-label', name);
    x.addEventListener('click', () => { remove(); renderClues(); searchAgain(); q.focus(); });
    el.append(text, x); bar.append(el);
  };
  clues.forEach((clue, i) => tag('+ ' + clue, `Remove detail: ${clue}`, () => clues.splice(i, 1)));
  if (excluded.size) tag(`${excluded.size} hidden`, 'Show hidden results again', () => excluded.clear());
  bar.hidden = !bar.childElementCount;
}
function searchAgain() { submittedQuery = searchText(); runSearch(); }
function setRefineOpen(open, focus = open) {
  refinePanel.hidden = !open;
  refineToggle.setAttribute('aria-expanded', String(open));
  if (focus) details.focus();
}
function showRefine(needsDetail) {
  $('refine').hidden = false;
  const questions = refinementQuestions(submittedQuery);
  $('refine-question').textContent = questions.primary;
  document.querySelectorAll('.hint-chip').forEach(chip => {
    chip.dataset.hint = questions[chip.dataset.question];
    chip.setAttribute('aria-pressed', 'false');
  });
  details.placeholder = 'Add a detail you remember, then press Enter';
  refineToggle.textContent = needsDetail ? 'Add one more detail to narrow it down' : 'Not it? Add a detail';
  if (needsDetail && refinePanel.hidden) setRefineOpen(true, false);
}
function resetRefine() {
  clues = []; excluded.clear(); renderClues();
  details.value = ''; setRefineOpen(false); $('refine').hidden = true;
}

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

// One big card for the best match, then compact rows for other videos; "Show more" reveals the rest.
const PAGE = 12, OTHERS_SHOWN = 3, MORE_STEP = 8;
let found = [], visible = 0, moreAvailable = false, closeCall = false, othersOpen = false, lastRequest = null;
function renderResults() {
  resultsEl.textContent = '';
  activeIndex = -1;
  const terms = queryTerms(submittedQuery || '');
  const [best, ...others] = found;
  resultsEl.append(resultCard(best, terms, 'best'));
  if (!others.length) return;
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'others-head'; toggle.textContent = 'Other matches';
  toggle.setAttribute('aria-expanded', String(othersOpen));
  toggle.addEventListener('click', () => { othersOpen = !othersOpen; renderResults(); resultsEl.querySelector('.others-head').focus(); });
  resultsEl.append(toggle);
  if (!othersOpen) return;
  const rows = others.slice(0, visible - 1);
  rows.forEach((r, i) => {
    const card = resultCard(r, terms, 'compact');
    // The engine flags a near tie between the top two from comparable scores.
    if (i === 0 && closeCall) {
      const tag = document.createElement('span');
      tag.className = 'almost'; tag.textContent = 'Almost as good';
      tag.title = 'This matches nearly as well as the best match. Add a detail to tell them apart.';
      card.querySelector('.title').prepend(tag);
    }
    resultsEl.append(card);
  });
  if (visible < found.length || moreAvailable) {
    const more = document.createElement('button');
    more.type = 'button'; more.className = 'link-btn show-more'; more.textContent = 'Show more';
    more.addEventListener('click', showMore);
    resultsEl.append(more);
  }
}
async function showMore() {
  if (visible >= found.length && moreAvailable) {
    const seq = searchSeq;
    const res = await send({ ...lastRequest, offset: found.length }).catch(e => ({ error: e.message }));
    if (seq !== searchSeq || !res || res.error) return;
    const known = new Set(found.map(r => r.videoId));
    found.push(...res.results.filter(r => !known.has(r.videoId)));
    moreAvailable = res.results.length === PAGE;
  }
  const first = visible;
  visible = Math.min(found.length, visible + MORE_STEP);
  renderResults();
  resultsEl.querySelectorAll('.result')[first]?.focus();
}

function resultCard(r, terms, variant) {
    const wrap = $('result-tpl').content.firstElementChild.cloneNode(true),node=wrap.querySelector('.result');
    wrap.classList.add(variant);
    const url = resultLink(r, submittedQuery || '');
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
    const title=node.querySelector('.title').textContent;
    wrap.querySelector('.not-this').addEventListener('click',()=>{
      excluded.add(r.videoId);renderClues();searchAgain();
      // Say what was hidden, since the next match can look much like it.
      $('hidden-text').textContent=`Hid “${title}”.`;$('hidden-undo').dataset.videoId=r.videoId;$('hidden-note').hidden=false;
    });
    const copy=wrap.querySelector('.copy-link');
    copy.addEventListener('click',async()=>{
      let label='Copied';
      try{await navigator.clipboard.writeText(url);copy.classList.add('copied');}
      catch{label='Copy failed';}
      copy.title=label;copy.setAttribute('aria-label',label);
      setTimeout(()=>{copy.classList.remove('copied');copy.title='Copy link to this moment';copy.setAttribute('aria-label',copy.title);},2000);
    });
    return wrap;
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
  $('hidden-note').hidden=true;
  $('search-retry').hidden=true;
  $('applied-filters').hidden=true;
  $('ignore-inferred').hidden=true;
  const original = q.value.trim();
  const query = searchText();
  if (query !== submittedQuery) {
    $('refine').hidden = true;
    if (original) empty('Press Enter to search'); else showIdle();
    return;
  }
  // Refinement belongs to this open popup; reopening starts with an independent query.
  chrome.storage.session.set({ lastQuery: original, sinceDays, customRange, inferFilters }).catch(() => {});
  if (!original) { $('refine').hidden = true; showIdle(); return; }
  if (!hasSearchDetail(query)) {
    empty('Describe something you remember', ['Try a topic, a name, an action, or a phrase.']);
    $('refine').hidden = true;
    return;
  }
  // One distinct video per row, so "Other matches" are alternatives rather than more moments of the best one.
  const request = { type: 'search', query, sinceDays, ...customMs(), ...(excluded.size ? { exclude: [...excluded] } : {}), inferFilters, distinct: true, offset: 0, kind: $('kind-filter').value };
  const videoId=$('video-scope').checked?currentMedia?.videoId:undefined;
  const res = await withTimeout((async()=>{
    if(videoId){
      const state=await send({type:'video-status',videoId});
      if(state.error)throw Error(state.error);
      // Saved speech, OCR and scenes are searchable even when captions are unavailable.
      if(!state.has&&!state.content){const indexed=await send({type:'index-tab',tabId:currentTab.id});if(!indexed?.ok)throw Error(indexed?.reason||indexed?.error||'Captions are not ready. Play the video and retry.');}
    }
    if(videoId)request.videoId=videoId;
    return send(request);
  })())
    .catch(e => ({ error: e.message || 'The search engine did not respond.' }));
  if (seq !== searchSeq) return; // a newer search started
  if (!res || res.error) {
    empty(videoId ? 'Couldn’t search this video' : 'Search failed', [res ? res.error : 'The search engine did not respond.'], 'Try again in a moment.');
    $('search-retry').hidden=false;
    $('refine').hidden = true;
    return;
  }
  $('applied-filters').textContent=res.filtersRelaxed?'No matches in that time range. Showing other dates'+(res.appliedFilters?.length?' on '+res.appliedFilters.join(' · '):'')+'.':res.appliedFilters?.length?'Using: '+res.appliedFilters.join(' · '):'';
  $('applied-filters').hidden=!res.filtersRelaxed&&!res.appliedFilters?.length;
  $('ignore-inferred').hidden=!res.appliedFilters?.length;
  $('ignore-inferred').textContent=res.appliedSource?'Search without suggested filters':'Ignore suggested filters';
  showChips(res.appliedSinceDays ?? sinceDays);
  if (res.sceneError) renderVision({status:'error',error:res.sceneError});
  else if(res.visualPending){$('scene-status').textContent='Image search is preparing. Text results are ready; search again shortly for images.';$('scene-status').hidden=false;}
  if (res.empty && !videoId && !res.appliedSource) {$('refine').hidden = true;showIdle();return;}
  if (!res.results.length) {
    empty(res.appliedSource?'No matches on '+res.appliedSource:'Add one more detail', [], res.appliedSource?'Add another detail or search without suggested filters.':(res.appliedSinceDays||sinceDays||customRange) ? 'You can also try “Any time” to widen your search.' : 'Use a detail you remember to narrow your search.');
    showRefine(true);
    return;
  }
  showRefine(res.nearTie === true || res.results[0].match === 'related');
  found = res.results; visible = Math.min(found.length, 1 + OTHERS_SHOWN);
  moreAvailable = found.length === PAGE; closeCall = res.nearTie === true; lastRequest = request;
  // Alternatives start folded so a confident answer reads as one; they open when the engine is unsure.
  othersOpen = closeCall || found[0].match === 'related';
  renderResults();
  renderedSeq=seq;
}
$('ignore-inferred').addEventListener('click',()=>{inferFilters=false;runSearch();q.focus();});

function prepareSearch() {
  submittedQuery = null;
  renderedSeq = -1;
  $('applied-filters').hidden = true;
  $('ignore-inferred').hidden = true;
  $('hidden-note').hidden = true;
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
  resetRefine();
  prepareSearch();
});

details.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  const detail = details.value.trim();
  if (!detail) return;
  clues.push(detail);
  details.value = '';
  renderClues();
  searchAgain();
});

refineToggle.addEventListener('click', () => setRefineOpen(refinePanel.hidden));
$('hidden-undo').addEventListener('click', e => { excluded.delete(e.currentTarget.dataset.videoId); renderClues(); searchAgain(); q.focus(); });
document.querySelectorAll('.hint-chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.hint-chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
  details.placeholder = chip.dataset.hint;
  $('refine-question').textContent = chip.dataset.hint;
  details.focus();
}));

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
    if (target && renderedSeq===searchSeq) openResult(target.href, e.ctrlKey || e.metaKey);
    else {
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
    runSearch();
    (custom && !customRange.from && !customRange.to ? $('range-from') : q).focus();
  });
});
for (const id of ['range-from', 'range-to']) $(id).addEventListener('change', () => {
  let from = $('range-from').value, to = $('range-to').value;
  if (from && to && from > to) { [from, to] = [to, from]; $('range-from').value = from; $('range-to').value = to; }
  customRange = { from, to };
  runSearch();
});

$('kind-filter').addEventListener('change',runSearch);
$('video-scope').addEventListener('change',runSearch);
$('search-retry').addEventListener('click',runSearch);
$('web-pause-popup').addEventListener('click',async()=>{const {webCapture={}}=await chrome.storage.local.get('webCapture');await chrome.storage.local.set({webCapture:{...webCapture,paused:!webCapture.paused}});refreshWebPause();});
async function refreshWebPause(){const {webCapture={}}=await chrome.storage.local.get('webCapture');$('web-pause-popup').hidden=!webCapture.enabled;const on=!webCapture.paused;$('web-pause-popup').textContent=on?'Stop saving sites':'Start saving sites';$('web-pause-popup').title=on?'CueWoven is saving pages you read on your sites. Click to stop.':'CueWoven isn\u2019t saving websites right now. Click to start again.';}

// ---------------------------------------------------------------------------
// Status, model progress, idle state
// ---------------------------------------------------------------------------
let stats = { videos: 0, chunks: 0 };

// One example per popup open, each showing something search understands (moments, sites, typed dates,
// scenes, on-screen text, channels, exact quotes), so people learn it without reading instructions.
const EXAMPLES = [
  'the part about why batteries wear out',
  'that TikTok about tire rotation last week',
  'a red car on a mountain road',
  'the article about coral bleaching 3 days ago',
  'the recipe video where they whisk the eggs',
  'the thread I read on Reddit yesterday about mechanical keyboards',
  'that Instagram reel I saw a few weeks ago about meal prep',
  'the Veritasium video about why the sky is blue',
  'the lecture slide with the supply and demand graph',
  'the part where they said “compound interest”',
  'a whiteboard drawing of a neural network',
  'the video I watched between 1 and 2 months ago about budgeting',
];
const EXAMPLE = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];

// The real shortcut, so people who clicked the icon learn the faster way in.
let shortcut = '';
const shortcutReady = openShortcut().then(key => { shortcut = key; });
function showIdle() {
  if (!(stats.total||stats.videos)) empty('Nothing saved yet',['Watch a video or try the samples.']);
  else empty('Describe what you remember',[],`Try: ${EXAMPLE}`);
  if (shortcut) {
    const tip = document.createElement('p');
    tip.className = 'hint shortcut-tip';
    tip.append('Tip: press ', Object.assign(document.createElement('kbd'), { textContent: shortcut }), ' on any page to open CueWoven.');
    resultsEl.querySelector('.empty').append(tip);
  }
}

function showModel(state) {
  const box = $('model');
  if (!state || state.status === 'ready' || state.status === 'idle') { box.hidden = true; return; }
  box.hidden = false;
  if (state.status === 'error') {
    $('model-text').textContent = 'Couldn’t load the search engine: ' + (state.error || 'unknown error');
    $('model-bar').style.width = '0';
  } else {
    $('model-text').textContent = `Loading search engine… ${Math.round((state.progress || 0) * 100)}%`;
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
  if (msg.type === 'vision-state') renderVision(msg.state);
  if (msg.type === 'ocr-state') {const state=msg.state,message=state.status==='loading'?'Loading on-screen text reader…':state.status==='working'?'Reading on-screen text on this device…':state.status==='error'?state.error:'';$('ocr-status').textContent=message;$('ocr-status').hidden=!message;}
  if (msg.type === 'embedding-status') renderEmbedding(msg.state);
  if (msg.type === 'model-status') showModel(msg.state);
  if (msg.type === 'index-changed') refreshStatus();
  return false;
});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.settings&&!!changes.settings.oldValue?.lightMode!==!!changes.settings.newValue?.lightMode)prepareSearch();
});

// ---------------------------------------------------------------------------
// Current-tab context and automatic capture status
// ---------------------------------------------------------------------------
let captureStatusPending = false;
async function refreshCaptureIndicator() {
  if(captureStatusPending || !/^https?:/.test(currentTab?.url||''))return;
  captureStatusPending=true;
  try {
    const state=await send({type:'capture-status',tabId:currentTab.id});
    $('capture-indicator').textContent=captureLabel(state.reason);
    $('capture-indicator').hidden=!$('page-capture').hidden;
  } catch (_) {}
  finally {captureStatusPending=false;}
}
async function setupCaptureContext() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await refreshCaptureIndicator();
  if(videoIdFromUrl(currentTab?.url))setInterval(refreshCaptureIndicator,1500);
  if(currentTab&&/^https?:/.test(currentTab.url||'')&&!(currentTab.url||'').startsWith('https://www.youtube.com/')){$('page-capture').hidden=false;await refreshPageCapture();}
  if (!currentTab || !currentTab.url || !/^https:\/\/www\.youtube\.com\/watch\?/.test(currentTab.url)&&!policy.safeUrl(currentTab.url)) return;
  try {
    const { video } = await chrome.tabs.sendMessage(currentTab.id, { type: 'get-video' });
    currentMedia=video;
    if(!currentMedia&&videoIdFromUrl(currentTab.url))currentMedia={videoId:videoIdFromUrl(currentTab.url),title:currentTab.title||'this video'};
    $('video-scope-row').hidden=!currentMedia;
  } catch (_) {
    if(videoIdFromUrl(currentTab.url)){currentMedia={videoId:videoIdFromUrl(currentTab.url),title:currentTab.title||'this video'};$('video-scope-row').hidden=false;}
  }
}

async function refreshPageCapture(){
  if(!currentTab)return;
  const status=await send({type:'web-page-status',tabId:currentTab.id}).catch(()=>({reason:'refresh-required'}));
  $('page-capture-status').textContent=captureLabel(status.reason);
  $('page-forget').disabled=!status.host||status.incognito;
}
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
  await refreshStatus();q.value='why do batteries wear out';prepareSearch();q.focus();
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
  await shortcutReady;
  await refreshStatus();
  refreshWebPause();
  const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
  $('start-choice').hidden = !!onboardingComplete || (stats.total||stats.videos) > 0;
  await setupCaptureContext();
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
    q.select();
    prepareSearch();
  } else {
    showIdle();
  }
  if (stats.total||stats.videos) send({ type: 'warmup' }).catch(()=>{}); // Keep text responsive; visual models load only when needed.
})();

// Capture processing can report progress without adding manual controls to search.
function renderVision(state={}) {
  const message=state.status==='loading'?'Loading visual search… '+Math.round((state.progress || 0)*100)+'%':state.status==='working'?'Processing scenes on this device…':state.status==='error'?state.error:'';
  $('scene-status').textContent=message;$('scene-status').hidden=!message;
}
function renderEmbedding(state={}) {
  const message=state.status==='running'?`Improving saved text matches… ${state.done}/${state.total}. Search remains available.`:state.status==='error'?'Saved-match update paused: '+state.error:'';
  $('embedding-status').textContent=message;$('embedding-status').hidden=!message;
}
