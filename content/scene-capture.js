// Capture only the video element, never browser chrome, other tabs or the desktop.
(function () {
  let timer, clock, options = {}, generation = 0, busy = false, seen = new Set(), lastAttempt = 0;
  const send = async msg => {try {return await chrome.runtime.sendMessage(msg);} catch (error) {return {error:error.message};}};
  function schedule(delay = 2000) {clearTimeout(timer);if (clock && options.enabled !== false && options.scenesEnabled !== false) timer = setTimeout(tick,delay);}
  async function tick() {
    if (busy) {schedule();return;}
    const context = clock?.(), video = document.querySelector('video');
    if (!context?.video || context.forced) return;
    if (!context.visible || context.paused || context.seeking || context.ad || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {schedule();return;}
    const bucket = Math.floor(context.time / 20);
    if (!Number.isFinite(context.time) || context.time < 0 || seen.has(bucket) || Date.now()-lastAttempt < 20000) {schedule();return;}
    busy = true;lastAttempt = Date.now();const active = generation;
    try {
      const canvas = document.createElement('canvas');canvas.width = 320;canvas.height = 180;
      const ctx = canvas.getContext('2d');ctx.fillStyle = '#000';ctx.fillRect(0,0,320,180);
      const scale = Math.min(320/video.videoWidth,180/video.videoHeight), w = video.videoWidth*scale, h = video.videoHeight*scale;
      ctx.drawImage(video,(320-w)/2,(180-h)/2,w,h);
      const response = await send({type:'scene-frame',video:context.video,start:context.time,image:canvas.toDataURL('image/jpeg',0.6)});
      if (active === generation && response?.ok) {seen.add(bucket);if (seen.size > 240) seen.delete(seen.values().next().value);}
      if (active === generation && response?.error) send({type:'scene-capture-error',reason:'Scene snapshots could not be saved: '+response.error});
    } catch (error) {
      if (active === generation) {
        clock = null;
        send({type:'scene-capture-error',reason:'This player does not allow scene snapshots. Captions and speech search are still available.'});
      }
    } finally {busy = false;schedule();}
  }
  function start(readClock, settings) {
    generation++;clearTimeout(timer);clock = readClock;options = settings;seen = new Set();lastAttempt = 0;
    schedule(Math.max(3,Number(settings.dwellSeconds) || 0)*1000);
  }
  function stop() {generation++;clearTimeout(timer);clock = null;}
  chrome.storage.onChanged.addListener((changes,area)=>{
    if (area !== 'local' || !changes.settings) return;
    options = {...options,...changes.settings.newValue};
    if (options.enabled === false || options.scenesEnabled === false) clearTimeout(timer);else schedule();
  });
  window.addEventListener('pagehide',stop);document.addEventListener('yt-navigate-start',stop);
  globalThis.__recallScenes = {start,stop};
})();
