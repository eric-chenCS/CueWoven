import { parseTakeoutHistory, validateTakeoutFileSize } from '../lib/takeout.js';

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);
const DEFAULTS = { enabled: true, dwellSeconds: 20, maxAgeDays: 30, perVideo: 2, transcriptConcurrency: 6 };
let historyCandidates = [];
const selectedHistory = new Set();
let bulkBusy = false;
let historyImportBusy = false;
let latestJob = null;
let jobWaiter = null;
let libraryRefresh;

function updateTranscriptButton() {
  const count = videos.filter(v => v.method === 'history-title').length;
  $('history-transcripts').disabled = bulkBusy || historyImportBusy || !count;
  $('history-transcripts').textContent = count ? `Fetch missing transcripts (${count})` : 'Fetch missing transcripts';
}

$('welcome-import').addEventListener('click', () => $('takeout-import').click());
$('welcome-empty').addEventListener('click', async () => {
  await chrome.storage.local.set({ onboardingComplete: true });
  $('welcome').hidden = true;
  $('startup-msg').textContent = 'Ready. Recall will build your library from new videos. You can import history later.';
});

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------
let videos = [];

async function loadLibrary() {
  const res = await send({ type: 'list' });
  videos = (res && res.videos) || [];
  const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
  $('welcome').hidden = !!onboardingComplete || videos.length > 0;
  if (videos.length && !onboardingComplete) await chrome.storage.local.set({ onboardingComplete: true });
  const moments = videos.reduce((n, v) => n + (v.method === 'history-title' ? 0 : v.chunkCount || 0), 0);
  const stats = $('stats');
  stats.textContent = '';
  for (const [n, label] of [[videos.length, videos.length === 1 ? 'video' : 'videos'], [moments, 'searchable moments']]) {
    const s = document.createElement('span');
    s.className = 'stat';
    const b = document.createElement('b');
    b.textContent = n;
    s.append(b, ' ' + label);
    stats.append(s);
  }
  renderLibrary();
  renderHistory();
  updateTranscriptButton();
}

function renderLibrary() {
  const lib = $('library');
  const f = $('filter').value.trim().toLowerCase();
  const matches = f ? videos.filter((v) => (v.title + ' ' + v.channel).toLowerCase().includes(f)) : videos;
  const list = matches.slice(0, 200);
  lib.textContent = '';
  if (matches.length > 200) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = `Showing 200 of ${matches.length} videos. Filter titles or channels to find more.`;
    lib.append(note);
  }
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'empty-lib';
    p.textContent = videos.length ? 'No videos match that filter.' : 'Nothing indexed yet. Watch a captioned YouTube video, or pre-load some above.';
    lib.append(p);
    return;
  }
  for (const v of list) {
    const row = document.createElement('div');
    row.className = 'vid';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = `https://i.ytimg.com/vi/${encodeURIComponent(v.videoId)}/mqdefault.jpg`;
    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('div');
    t.className = 't';
    t.textContent = v.title || v.videoId;
    const m = document.createElement('div');
    m.className = 'm';
    m.textContent = [v.channel, v.method === 'history-title' ? 'Title saved · no transcript' : `${v.chunkCount} moments`, 'indexed ' + new Date(v.indexedAt).toLocaleString()].filter(Boolean).join(' · ');
    info.append(t, m);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const open = document.createElement('a');
    open.className = 'btn ghost small';
    open.href = `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Open';
    const del = document.createElement('button');
    del.className = 'btn danger small';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      del.disabled = true;
      const response = await send({ type: 'delete', videoId: v.videoId });
      if (response?.error) { $('data-msg').textContent = response.error; del.disabled = false; return; }
      loadLibrary();
    });
    actions.append(open, del);
    if (v.method === 'history-title') {
      const index = document.createElement('button');
      index.className = 'btn ghost small';
      index.textContent = 'Add transcript';
      index.disabled = bulkBusy || historyImportBusy;
      index.addEventListener('click', () => runBulk([v.videoId]));
      actions.prepend(index);
    }
    del.disabled = historyImportBusy || bulkBusy;
    row.append(img, info, actions);
    lib.append(row);
  }
}

$('filter').addEventListener('input', renderLibrary);

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target === 'offscreen') return false;
  if (msg.type === 'index-changed' && !historyImportBusy) {
    clearTimeout(libraryRefresh);
    libraryRefresh = setTimeout(() => loadLibrary().catch(() => {}), 500);
  }
  if (msg.type === 'bulk-progress') onBulkProgress(msg);
  if (msg.type === 'transcript-job') applyTranscriptJob(msg.job);
  if (msg.type === 'import-progress') $('data-msg').textContent = `Importing… ${msg.done} of ${msg.total}`;
  if (msg.type === 'model-status' && msg.state.status === 'loading') {
    $('bulk-summary').textContent = `Loading the model… ${Math.round(msg.state.progress * 100)}%`;
  }
  return false;
});

async function saveHistoryTitles(entries) {
  if (historyImportBusy || bulkBusy) return;
  historyImportBusy = true;
  const controls = ['takeout-import', 'takeout-transcripts', 'browser-transcripts', 'history-transcripts', 'welcome-import', 'history-scan', 'history-save', 'history-index', 'bulk-go', 'import', 'clear'];
  controls.forEach(id => { $(id).disabled = true; });
  renderLibrary();
  let imported = 0;
  let skipped = 0;
  let processed = 0;
  let complete = false;
  try {
    for (let i = 0; i < entries.length; i += 16) {
      $('history-import-msg').textContent = `Adding history to Recall… ${processed} of ${entries.length}. First use may download the search model.`;
      const batch = entries.slice(i, i + 16);
      const res = await send({ type: 'import-history', videos: batch });
      if (!res || res.error) throw new Error(res?.error || 'The import did not respond.');
      imported += res.imported;
      skipped += res.skipped;
      processed += batch.length;
    }
    $('history-import-msg').textContent = `Added ${imported} searchable video titles; ${skipped} already saved. Open Recall to search your past videos.`;
    complete = true;
  } catch (e) {
    $('history-import-msg').textContent = `Import stopped after adding ${imported} titles: ${e.message}. Already added videos are saved; re-import to continue.`;
  } finally {
    historyImportBusy = false;
    controls.forEach(id => { $(id).disabled = false; });
    await loadLibrary();
  }
  return complete;
}

async function addHistory(entries, fetchTranscripts) {
  if (!await saveHistoryTitles(entries)) return false;
  if (fetchTranscripts) {
    const importedIds = new Set(entries.map(v => v.videoId));
    await runBulk(videos.filter(v => v.method === 'history-title' && importedIds.has(v.videoId))
      .sort((a, b) => b.watchedAt - a.watchedAt).map(v => v.videoId), true);
  }
  return true;
}

$('takeout-import').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const fetchTranscripts = $('takeout-transcripts').checked;
  try {
    validateTakeoutFileSize(file.size);
    const entries = parseTakeoutHistory(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
    await addHistory(entries, fetchTranscripts);
  } catch (e) {
    $('history-import-msg').textContent = `Could not import history: ${e.message}`;
  }
});

$('history-save').addEventListener('click', async () => {
  const fetchTranscripts = $('browser-transcripts').checked;
  try {
    const complete = await addHistory(historyCandidates.map(v => ({
      videoId: v.videoId, title: v.title, channel: '', watchedAt: v.lastVisitTime,
    })), fetchTranscripts);
    $('history-msg').textContent = complete && fetchTranscripts ? $('bulk-summary').textContent : $('history-import-msg').textContent;
  } catch (e) {
    $('history-msg').textContent = `Could not add history: ${e.message}`;
  }
});

// ---------------------------------------------------------------------------
// Existing YouTube visits (optional browser permission)
// ---------------------------------------------------------------------------
$('history-transcripts').addEventListener('click', () => runBulk(videos.filter(v => v.method === 'history-title')
  .sort((a, b) => b.watchedAt - a.watchedAt).map(v => v.videoId), true));

function updateHistorySelection() {
  $('history-index').disabled = bulkBusy || historyImportBusy || !selectedHistory.size;
  $('history-index').textContent = selectedHistory.size ? `Index selected videos (${selectedHistory.size}/20)` : 'Index selected videos';
}

function renderHistory() {
  const list = $('history-list');
  list.textContent = '';
  const indexed = new Set(videos.filter(v => v.method !== 'history-title').map(v => v.videoId));
  const query = $('history-filter').value.trim().toLowerCase();
  const matches = historyCandidates.filter(v => (v.title + ' ' + v.videoId).toLowerCase().includes(query));
  for (const v of matches) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.disabled = indexed.has(v.videoId) || bulkBusy || historyImportBusy;
    if (indexed.has(v.videoId)) selectedHistory.delete(v.videoId);
    check.checked = selectedHistory.has(v.videoId);
    check.setAttribute('aria-label', `Select ${v.title}`);
    check.addEventListener('change', () => {
      if (check.checked && selectedHistory.size >= 20) {
        check.checked = false;
        $('history-msg').textContent = 'Select at most 20 videos for each batch.';
        return;
      }
      if (check.checked) selectedHistory.add(v.videoId);
      else selectedHistory.delete(v.videoId);
      updateHistorySelection();
    });
    const link = document.createElement('a');
    link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = v.title;
    const note = document.createElement('span');
    note.className = 'note';
    note.textContent = indexed.has(v.videoId) ? 'Indexed' : `Visited ${new Date(v.lastVisitTime).toLocaleDateString()}`;
    row.append(check, link, note);
    list.append(row);
  }
  if (historyCandidates.length && !matches.length) list.textContent = 'No titles match. Try different words.';
  updateHistorySelection();
}

$('history-filter').addEventListener('input', renderHistory);
$('history-scan').addEventListener('click', async () => {
  const button = $('history-scan');
  button.disabled = true;
  try {
    // Request directly in this click handler to preserve the browser's user gesture.
    if (!await chrome.permissions.request({ permissions: ['history'] })) {
      $('history-msg').textContent = 'History access was not granted. You can still paste YouTube links below.';
      return;
    }
    $('history-msg').textContent = 'Looking for YouTube videos…';
    const res = await send({ type: 'history-videos', days: Number($('history-days').value) });
    if (!res || res.error) throw new Error(res?.error || 'History scan did not respond.');
    historyCandidates = res.videos;
    selectedHistory.clear();
    $('history-tools').hidden = !historyCandidates.length;
    $('history-msg').textContent = `${historyCandidates.length} unique YouTube videos found.${res.limited ? ' Showing up to 500 recent videos; choose a shorter range to narrow the scan.' : ''} Titles can be searched now; indexing is needed to search spoken content.`;
    renderHistory();
  } catch (e) {
    $('history-msg').textContent = `Could not read history: ${e.message}`;
  } finally {
    button.disabled = bulkBusy;
  }
});

$('history-index').addEventListener('click', async () => {
  const ids = Array.from(selectedHistory).slice(0, 20);
  if (!ids.length) return;
  const res = await runBulk(ids);
  for (const result of res?.results || []) {
    if (result.status === 'done' || result.status === 'skipped') selectedHistory.delete(result.videoId);
  }
  $('history-msg').textContent = $('bulk-summary').textContent;
  renderHistory();
});

// ---------------------------------------------------------------------------
// Bulk pre-load
// ---------------------------------------------------------------------------
const logRows = new Map();

function onBulkProgress(p) {
  let li = logRows.get(p.videoId);
  if (!li) {
    li = document.createElement('li');
    li.innerHTML = '<span class="st"></span><span class="what"></span><span class="why"></span>';
    $('bulk-log').append(li);
    logRows.set(p.videoId, li);
    if (logRows.size > 100) {
      const oldest = logRows.keys().next().value;
      logRows.get(oldest).remove();
      logRows.delete(oldest);
    }
  }
  const labels = { working: 'Indexing', done: 'Done', failed: 'Failed', skipped: 'Skipped' };
  const st = li.querySelector('.st');
  st.textContent = labels[p.status] || p.status;
  st.className = 'st ' + p.status;
  li.querySelector('.what').textContent = p.title || p.videoId;
  li.querySelector('.why').textContent = p.status === 'done' ? `· ${p.chunkCount} moments` : p.reason ? '· ' + p.reason : '';
}

function setBulkControls(busy) {
  bulkBusy = busy;
  for (const id of ['takeout-import', 'takeout-transcripts', 'browser-transcripts', 'welcome-import', 'history-save', 'history-scan', 'import', 'clear', 'bulk-go']) $(id).disabled = busy || historyImportBusy;
  $('bulk-go').textContent = busy ? 'Fetching in background…' : 'Index these videos';
  $('bulk-stop').hidden = !busy;
  updateTranscriptButton();
  renderLibrary();
  renderHistory();
}

function applyTranscriptJob(job) {
  if (!job || latestJob?.id === job.id && job.revision < latestJob.revision) return;
  const changed = latestJob?.id !== job.id;
  if (changed) { $('bulk-log').textContent = ''; logRows.clear(); }
  latestJob = job;
  const busy = ['running', 'pausing'].includes(job.status);
  if (changed || bulkBusy !== busy) setBulkControls(busy);
  for (const result of job.results) onBulkProgress(result);
  for (const active of job.active) onBulkProgress({...active, status: 'working'});
  $('bulk-stop').disabled = job.status === 'pausing';
  $('bulk-stop').textContent = job.status === 'pausing' ? 'Pausing active videos…' : 'Pause after active videos';
  if (busy) {
    $('bulk-summary').textContent = `${job.completed} of ${job.total} finished · ${job.active.length} fetching in background. You can close this settings page.`;
  } else {
    const label = {done: 'Finished', paused: 'Paused', interrupted: 'Interrupted'}[job.status] || job.status;
    $('bulk-summary').textContent = `${label}: ${job.done} indexed${job.skipped ? `, ${job.skipped} already there` : ''}, ${job.failed} failed. ${job.total - job.completed} not attempted.${job.reason ? ' ' + job.reason : ''}`;
    if (jobWaiter?.id === job.id) { jobWaiter.resolve({results: job.results}); jobWaiter = null; }
    clearTimeout(libraryRefresh);
    loadLibrary().catch(() => {});
  }
}

async function runBulk(urls, all = false) {
  if (bulkBusy || historyImportBusy) return;
  if (!urls.length) { $('bulk-summary').textContent = all ? 'No missing transcripts for these videos.' : 'Paste at least one YouTube link.'; return; }
  setBulkControls(true);
  $('bulk-summary').scrollIntoView({behavior: 'smooth', block: 'center'});
  try {
    const unique = Array.from(new Set(urls));
    const response = await send({type: 'transcript-job-start', urls: all ? unique : unique.slice(0, 50)});
    if (!response?.job || response.error) throw new Error(response?.error || 'Background fetching did not respond.');
    return await new Promise(resolve => {
      jobWaiter = {id: response.job.id, resolve};
      applyTranscriptJob(latestJob?.id === response.job.id ? latestJob : response.job);
    });
  } catch (e) {
    $('bulk-summary').textContent = `Indexing failed: ${e.message}`;
    setBulkControls(false);
    await loadLibrary();
  }
}

$('bulk-stop').addEventListener('click', async () => {
  $('bulk-stop').disabled = true;
  try {
    const response = await send({type: 'transcript-job-pause'});
    if (response?.error) throw new Error(response.error);
    applyTranscriptJob(response?.job);
  } catch (e) {
    $('bulk-stop').disabled = false;
    $('bulk-summary').textContent = `Could not pause: ${e.message}`;
  }
});

$('bulk-go').addEventListener('click', () => {
  runBulk($('bulk-urls').value.split(/\s+/).filter(Boolean));
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = Object.assign({}, DEFAULTS, settings);
  $('enabled').checked = !!s.enabled;
  $('dwellSeconds').value = String(s.dwellSeconds);
  $('maxAgeDays').value = String(s.maxAgeDays);
  $('perVideo').value = String(s.perVideo);
  $('transcriptConcurrency').value = String([3, 6].includes(s.transcriptConcurrency) ? s.transcriptConcurrency : 6);
}

let savedTimer;
async function saveSettings() {
  const settings = {
    enabled: $('enabled').checked,
    dwellSeconds: Number($('dwellSeconds').value),
    maxAgeDays: Number($('maxAgeDays').value),
    perVideo: Number($('perVideo').value),
    transcriptConcurrency: Number($('transcriptConcurrency').value),
  };
  await chrome.storage.local.set({ settings });
  $('saved').textContent = 'Saved';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => ($('saved').textContent = ''), 1500);
  if (settings.maxAgeDays) send({ type: 'prune' }).then(loadLibrary);
}
for (const id of ['enabled', 'dwellSeconds', 'maxAgeDays', 'perVideo', 'transcriptConcurrency']) $(id).addEventListener('change', saveSettings);

// ---------------------------------------------------------------------------
// Export / import / wipe
// ---------------------------------------------------------------------------
$('export').addEventListener('click', async () => {
  const data = await send({ type: 'export' });
  if (!data || data.error) { $('data-msg').textContent = (data && data.error) || 'Export failed.'; return; }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `recall-index-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $('data-msg').textContent = `Exported ${data.videos.length} videos.`;
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  $('data-msg').textContent = 'Reading file…';
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (_) {
    $('data-msg').textContent = 'That file isn’t valid JSON.';
    return;
  }
  $('data-msg').textContent = 'Importing… (first import may download the model)';
  const res = await send({ type: 'import', data });
  $('data-msg').textContent = res && !res.error ? `Imported ${res.imported} videos.` : (res && res.error) || 'Import failed.';
  loadLibrary();
});

$('clear').addEventListener('click', async () => {
  if (!confirm('Delete every indexed video and transcript from this browser? This can’t be undone.')) return;
  const response = await send({ type: 'clear' });
  if (response?.error) { $('data-msg').textContent = response.error; return; }
  $('data-msg').textContent = 'Everything was deleted.';
  loadLibrary();
});

loadSettings();
loadLibrary();

send({type: 'transcript-job-status'}).then(response => applyTranscriptJob(response?.job)).catch(() => {});
