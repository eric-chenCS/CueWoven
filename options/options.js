import {setItemImage} from '../lib/item-image.js';
import {restoreBackup} from '../lib/backup.js';
import {DEFAULT_SETTINGS as DEFAULTS, resetPreferences} from '../lib/settings.js';
import {resultLink} from '../lib/result-link.js';
import {sampleFor} from '../lib/samples.js';
import {beginLibraryTask,libraryBusy,onLibraryBusy} from '../lib/library-busy.js';
import {openShortcut,isPinned} from '../lib/shortcut.js';

const $ = (id) => document.getElementById(id);
$('version').textContent = 'v' + (chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version);
const send = (msg) => chrome.runtime.sendMessage(msg);
// Native confirm() can only say OK; name the action on the button and focus Cancel first.
let confirmationPending = false;
function confirmAction(message, action, {danger = true} = {}) {
  if (confirmationPending) return Promise.resolve(false);
  const dialog = $('confirm-dialog');
  $('confirm-text').textContent = message;$('confirm-ok').textContent = action;$('confirm-ok').className = danger ? 'btn danger' : 'btn';dialog.returnValue = '';
  dialog.showModal();
  confirmationPending = true;
  return new Promise(resolve => dialog.addEventListener('close', () => {confirmationPending = false;resolve(dialog.returnValue === 'ok');}, {once: true}));
}
let restoreBusy = false;
let libraryRefresh;
let libraryDirty=false;
function scheduleLibraryRefresh(){
  clearTimeout(libraryRefresh);
  libraryRefresh=setTimeout(()=>{
    if(libraryBusy()||restoreBusy)return;
    libraryDirty=false;loadLibrary().catch(()=>{});
  },500);
}

$('welcome-restore').addEventListener('click', () => { $('backup-controls').scrollIntoView({block:'center'}); $('import').click(); });

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------
let videos = [];

async function loadLibrary() {
  const res = await send({ type: 'list' });
  videos = (res && res.videos) || [];
  $('scene-storage').textContent = res?.sceneStorageFull ? 'Image storage is full, so the oldest scenes and images are removed before your “Forget what I watch or read after” time. Choose a shorter time, or turn on Lite mode to stop saving new scenes.' : '';
  const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
  $('welcome').hidden = !!onboardingComplete || videos.length > 0;
  if (videos.length && !onboardingComplete) await chrome.storage.local.set({ onboardingComplete: true });
  const moments = videos.reduce((n, v) => n + (v.method === 'history-title' ? 0 : v.chunkCount || 0), 0);
  const stats = $('stats');
  stats.textContent = '';
  const screenMoments=videos.reduce((n,v)=>n+(v.screenCount||0),0);
  stats.title=`${screenMoments} on-screen text moments`;
  for (const [n,label] of [[videos.length,videos.length===1?'item':'items'],[moments+screenMoments,'moments'],[videos.reduce((n,v)=>n+(v.sceneCount||0),0),'images / scenes']].filter(([n],i)=>i===0||n>0)) {
    const s = document.createElement('span');
    s.className = 'stat';
    const b = document.createElement('b');
    b.textContent = n;
    s.append(b, ' ' + label);
    stats.append(s);
  }
  renderLibrary();
}

function sizeLibrary() {
  const lib = $('library'), rows = lib.querySelectorAll('.vid');
  lib.style.maxHeight = rows.length > 5 ? `${Math.ceil(rows[4].getBoundingClientRect().bottom - lib.getBoundingClientRect().top + lib.scrollTop + 1)}px` : '';
}
new ResizeObserver(sizeLibrary).observe($('library'));

function renderLibrary() {
  const lib = $('library');
  const f = $('filter').value.trim().toLowerCase();
  const matches = f ? videos.filter((v) => (v.title + ' ' + v.channel).toLowerCase().includes(f)) : videos;
  const list = matches.slice(0, 200);
  lib.textContent = '';
  if (matches.length > 200) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = `Showing 200 of ${matches.length} items. Search titles, channels or sites to find more.`;
    lib.append(note);
  }
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'empty-lib';
    p.textContent = videos.length ? 'No items match that filter.' : 'Nothing indexed yet. Watch YouTube or enable website capture below.';
    lib.append(p);
    return;
  }
  for (const v of list) {
    const row = document.createElement('div');
    row.className = 'vid';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    setItemImage(img, v);
    const info = document.createElement('div');
    info.className = 'info';
    const t = document.createElement('div');
    t.className = 't';
    t.textContent = (v.sample&&sampleFor(v.videoId)?.title) || v.title || v.videoId;
    const m = document.createElement('div');
    m.className = 'm';
    m.textContent=[v.sample?'CueWoven demo':v.channel,v.method==='history-title'?'Title only':`${v.chunkCount} moments`,v.method==='speech-local'?'AI speech':'',new Date(v.indexedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})].filter(Boolean).join(' · ');
    m.title=[v.sceneCount?`${v.sceneCount} ${v.kind==='page'?'images':'scenes'}`:'',v.screenCount?`${v.screenCount} on-screen text moments`:'',v.method==='speech-local'?'Played portions only':''].filter(Boolean).join(' · ');
    info.append(t, m);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const open = document.createElement('a');
    open.className = 'btn ghost small';
    open.href = resultLink({...v,start:0,titleOnly:true});
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
    del.disabled = restoreBusy || libraryBusy();
    row.append(img, info, actions);
    lib.append(row);
  }
  lib.scrollTop = 0;
  sizeLibrary();
}

$('filter').addEventListener('input', renderLibrary);

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target === 'offscreen') return false;
  if (msg.type === 'index-changed') {
    libraryDirty=true;
    if(!restoreBusy&&!libraryBusy())scheduleLibraryRefresh();
  }
  return false;
});

function setControls() {
  for (const id of ['welcome-restore', 'import', 'export', 'clear']) $(id).disabled = restoreBusy || libraryBusy();
  renderLibrary();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
for (const [id, value] of Object.entries({ ...DEFAULTS, theme: 'system' })) {
  const control = $(id);
  if (control?.tagName === 'SELECT') {
    const option = [...control.options].find(option => option.value === String(value));
    if (option) { option.textContent += ' (default option)'; option.dataset.default = 'true'; }
  } else if (control?.type === 'checkbox') {
    const note = document.createElement('span');
    note.className = 'hint default-note';
    note.textContent = `Default: ${value ? 'On' : 'Off'}`;
    control.closest('label').querySelector('.setting-text').append(note);
  }
}
$('reset-settings').addEventListener('click', async () => {
  const button = $('reset-settings');
  button.disabled = true;
  try {
    const defaults = await deviceDefaults();
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({...resetPreferences(settings, defaults), liteModeInitialized: true});
    await loadSettings();
    $('reset-msg').textContent = 'Settings reset to default.';
    clearTimeout(resetTimer);resetTimer = setTimeout(() => ($('reset-msg').textContent = ''), 6000);
  } catch (error) {
    clearTimeout(resetTimer);
    $('reset-msg').textContent = `Could not reset settings: ${error.message}`;
  } finally { button.disabled = false; }
});

function selectRetention(id, days) {
  const select = $(id), value = String(days);
  if (![...select.options].some(option => option.value === value)) select.add(new Option(`${days} days (previous setting)`, value));
  select.value = value;
}
async function loadSettings() {
  let defaults;
  try { defaults = await deviceDefaults(); }
  catch (error) { $('reset-msg').textContent = error.message; return; }
  const { settings } = await chrome.storage.local.get('settings');
  const s = Object.assign({}, defaults, settings);
  $('lightMode').closest('label').querySelector('.default-note').textContent = defaults.lightMode
    ? 'Default: On for devices with 8 GB RAM or less. You can turn it off.' : 'Default: Off';
  $('enabled').checked = !!s.enabled;
  $('lightMode').checked=!!s.lightMode;
  $('speechEnabled').checked = s.speechEnabled !== false;
  $('scenesEnabled').checked = s.scenesEnabled === true;
  $('scenesEnabled').indeterminate = !!s.scenesEnabled !== !!s.articleImagesEnabled;
  $('visual-mixed').hidden = !$('scenesEnabled').indeterminate;
  $('visual-mixed').textContent = $('scenesEnabled').indeterminate ? `Currently enabled for ${s.scenesEnabled ? 'video scenes' : 'article images'} only. Toggle to apply to both.` : '';
  $('screenTextEnabled').checked=s.screenTextEnabled!==false;
  $('dwellSeconds').value = String(s.dwellSeconds);
  selectRetention('maxAgeDays', s.maxAgeDays);
  $('sceneStorageMB').value = String(s.sceneStorageMB);
  for(const id of ['scenesEnabled','screenTextEnabled','speechEnabled'])$(id).disabled=!!s.lightMode;
}

let savedTimer, resetTimer;
async function deviceDefaults() {
  const defaults = await send({type: 'settings-defaults'});
  if (!defaults || defaults.error) throw Error(defaults?.error || 'Could not load device defaults.');
  return defaults;
}
async function saveSettings(event) {
  try {
    // Finish first-time device setup before a user's save can replace its settings.
    await deviceDefaults();
    const {settings:stored={}}=await chrome.storage.local.get('settings');
    const storedMB=stored.sceneStorageMB??DEFAULTS.sceneStorageMB,sceneStorageMB=Number($('sceneStorageMB').value);
    if(sceneStorageMB<storedMB&&!await confirmAction(`Lower image storage to ${sceneStorageMB>=1024?'1 GB':sceneStorageMB+' MB'}? If your saved images don't fit, the oldest scenes and article images are deleted now. This can't be undone.`,'Lower storage')){$('sceneStorageMB').value=String(storedMB);return;}
    const storedDays=stored.maxAgeDays??DEFAULTS.maxAgeDays;
    if(Number($('maxAgeDays').value)===0&&storedDays!==0&&!await confirmAction('Keep everything forever? Your library will keep growing, so searches can get slower and use more memory over time. Images still stay within your image storage limit.','Keep forever',{danger:false})){$('maxAgeDays').value=String(storedDays);return;}
    const settings = {
      ...stored,
      enabled: $('enabled').checked,
      lightMode:$('lightMode').checked,
      speechEnabled: $('speechEnabled').checked,
      scenesEnabled: $('scenesEnabled').indeterminate ? stored.scenesEnabled === true : $('scenesEnabled').checked,
      articleImagesEnabled: $('scenesEnabled').indeterminate ? stored.articleImagesEnabled === true : $('scenesEnabled').checked,
      screenTextEnabled:$('screenTextEnabled').checked,
      dwellSeconds: Number($('dwellSeconds').value),
      maxAgeDays: Number($('maxAgeDays').value),
      sceneStorageMB,
    };
    for(const id of ['scenesEnabled','screenTextEnabled','speechEnabled'])$(id).disabled=settings.lightMode;
    if (!$('scenesEnabled').indeterminate) { $('visual-mixed').hidden = true; $('visual-mixed').textContent = ''; }
    await chrome.storage.local.set({ settings, ...(event?.target?.id === 'lightMode' ? {liteModeInitialized: true} : {}) });
    const status = $(event?.target?.closest('#sec-data') ? 'data-saved' : 'saved');
    $('saved').textContent = $('data-saved').textContent = '';
    status.textContent = 'Saved';
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (status.textContent = ''), 1500);
    if (settings.maxAgeDays||settings.importMaxAgeDays||sceneStorageMB!==storedMB) send({ type: 'prune' }).then(loadLibrary);
  } catch (error) { $('saved').textContent = `Could not save settings: ${error.message}`; }
}
for (const id of ['lightMode','enabled', 'dwellSeconds', 'maxAgeDays', 'sceneStorageMB', 'speechEnabled', 'scenesEnabled','screenTextEnabled']) $(id).addEventListener('change', saveSettings);

// ---------------------------------------------------------------------------
// Export / import / wipe
// ---------------------------------------------------------------------------
$('export').addEventListener('click', async () => {
  const data = await send({ type: 'export' });
  if (!data || data.error) { $('data-msg').textContent = (data && data.error) || 'Export failed.'; return; }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cuewoven-index-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $('data-msg').textContent = `Exported ${data.videos.length} videos`+(data.items?.length?` and ${data.items.length} web items`:'')+'.';
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if(restoreBusy || libraryBusy())return;
  const release=beginLibraryTask();
  restoreBusy=true;setControls();
  $('data-msg').textContent='Reading file…';
  try {
    let data;try{data=JSON.parse(await file.text());}catch{throw Error('That file isn’t valid JSON.');}
    $('data-msg').textContent='Restoring… Keep this page open. First use may download models.';
    const res=await restoreBackup(data,send,({done,total})=>{$('data-msg').textContent=`Restoring… ${done}/${total} items. Keep this page open.`;});
    $('data-msg').textContent=`Imported ${res.imported} ${data.items?.length?'items':'videos'}.`;
  }catch(error){$('data-msg').textContent=error.message;}
  finally{restoreBusy=false;release();setControls();loadLibrary();}
});

$('clear').addEventListener('click', async () => {
  if (!await confirmAction('Delete every saved video, page, search query and transcript from this browser? This cannot be undone.', 'Delete everything')) return;
  const response = await send({ type: 'clear' });
  if (response?.error) { $('data-msg').textContent = response.error; return; }
  $('data-msg').textContent = 'Everything was deleted.';
  loadLibrary();
});

onLibraryBusy(()=>{setControls();if(!libraryBusy()&&libraryDirty)scheduleLibraryRefresh();});
loadSettings();
loadLibrary();

// Show the real shortcut and pin state; refresh when returning from Chrome's shortcut page.
async function showHowToOpen() {
  const key = await openShortcut();
  $('shortcut-key').textContent = key || 'Not set';
  $('welcome-shortcut').textContent = key;
  $('welcome-shortcut-line').hidden = !key;
  $('welcome-pin').hidden = await isPinned();
}
showHowToOpen();
document.addEventListener('visibilitychange', () => { if (!document.hidden) showHowToOpen(); });
$('shortcut-change').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

$('forget-recent').addEventListener('click',async()=>{
  if(libraryBusy()||restoreBusy)return;
  const hours=Number($('forget-hours').value);
  if(!await confirmAction('Forget items CueWoven saved or updated in the last '+(hours===1?'hour':hours===24?'day':'week')+'? This removes all their saved evidence.','Forget items'))return;
  const release=beginLibraryTask();
  try{const result=await send({type:'forget-recent',hours});if(result.error)throw Error(result.error);$('data-msg').textContent='Forgot '+result.removed+' recently saved items.';await loadLibrary();}
  catch(error){$('data-msg').textContent=error.message;}
  finally{release();}
});
