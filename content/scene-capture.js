// Capture only video pixels. Cheap probes run independently of bounded inference.
(function(){
  const P=globalThis.__recallScenePolicy;
  let timer,clock,options={},generation=0,inFlight=null,pending=null,previous=null,revision=null;
  let lastBaseline=null,baselineProbe=null,nextBaselineCheck=0,lastAttempt=-Infinity,extraBlockedUntil=0,retryAt=0,seen=new Set(),budget=P.createBudget();
  let probeCanvas,frameCanvas;
  const send=async msg=>{try{return await chrome.runtime.sendMessage(msg);}catch(error){return {error:error.message};}};
  function schedule(delay=P.PROBE_MS){clearTimeout(timer);if(clock&&options.enabled!==false&&options.scenesEnabled!==false)timer=setTimeout(tick,delay);}
  function pixels(video){
    if(!probeCanvas){probeCanvas=document.createElement('canvas');probeCanvas.width=P.WIDTH;probeCanvas.height=P.HEIGHT;}
    const ctx=probeCanvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,P.WIDTH,P.HEIGHT);
    return ctx.getImageData(0,0,P.WIDTH,P.HEIGHT).data;
  }
  function snapshot(video){
    if(!frameCanvas){frameCanvas=document.createElement('canvas');frameCanvas.width=320;frameCanvas.height=180;}
    const ctx=frameCanvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,320,180);
    const scale=Math.min(320/video.videoWidth,180/video.videoHeight),w=video.videoWidth*scale,h=video.videoHeight*scale;
    ctx.drawImage(video,(320-w)/2,(180-h)/2,w,h);return frameCanvas.toDataURL('image/jpeg',.6);
  }
  async function pump(){
    if(inFlight||!pending||Date.now()-lastAttempt<P.MIN_GAP_MS)return;
    const frame=pending;pending=null;inFlight=frame;lastAttempt=Date.now();const sentAt=lastAttempt;
    try{
      const response=await send({type:'scene-frame',video:frame.video,start:frame.start,image:frame.image,revision:frame.revision,capturedAt:frame.created,adaptive:frame.adaptive});
      if(frame.generation!==generation)return;
      if(response?.busy){if(!pending&&Date.now()-frame.created<P.MAX_AGE_MS)pending=frame;return;}
      if(response?.rateLimited){extraBlockedUntil=Date.now()+Math.max(P.MIN_GAP_MS,Math.min(60000,response.retryAfterMs||60000));return;}
      if(response?.ok){
        seen.add(frame.key);if(seen.size>480)seen.delete(seen.values().next().value);
        if(frame.adaptive)budget.record(sentAt);else {lastBaseline=sentAt;baselineProbe=frame.probe;nextBaselineCheck=Math.max(nextBaselineCheck,sentAt+P.BASELINE_MS);}
      }
      if(response?.error){retryAt=Date.now()+P.BASELINE_MS;pending=null;send({type:'scene-capture-error',reason:'Scene snapshots could not be saved: '+response.error});}
    }finally{inFlight=null;}
  }
  function tick(){
    const state=clock?.(),video=document.querySelector('video');
    if(!state?.video||state.forced)return;
    if(!state.visible||state.paused||state.seeking||state.ad||!video||video.readyState<2||!video.videoWidth||!video.videoHeight||!Number.isFinite(state.time)||state.time<0){previous=null;pending=null;schedule();return;}
    const now=Date.now();
    if(now<retryAt){schedule();return;}
    if(revision!==state.revision){previous=null;pending=null;revision=state.revision;}
    if(pending&&(pending.generation!==generation||pending.video.videoId!==state.video.videoId||now-pending.created>=P.MAX_AGE_MS))pending=null;
    try{
      const current=pixels(video),changed=P.changedFrame(previous,current);previous=current;
      const baselineKey='base:'+Math.floor(state.time/20),changeKey='change:'+Math.floor(state.time*2);
      const checkBaseline=now>=nextBaselineCheck;
      const baseline=(lastBaseline===null||now-lastBaseline>=P.QUIET_MS||(checkBaseline&&P.changedFrame(baselineProbe,current)))&&!seen.has(baselineKey)&&inFlight?.key!==baselineKey;
      if(checkBaseline)nextBaselineCheck=now+P.BASELINE_MS;
      const extra=changed&&!seen.has(changeKey)&&now>=extraBlockedUntil&&budget.allows(now);
      // Keep the first waiting event, including if the picture changes back immediately.
      if(!pending&&(baseline||extra))pending={key:baseline?baselineKey:changeKey,video:state.video,start:state.time,revision:state.revision,adaptive:!baseline,image:snapshot(video),probe:current,created:now,generation};
      const work=pump();schedule();return work;
    }catch(error){stop();send({type:'scene-capture-error',reason:'This player does not allow scene snapshots. Captions and speech search are still available.'});}
  }
  function reset(){generation++;clearTimeout(timer);pending=null;previous=null;baselineProbe=null;revision=null;probeCanvas=null;frameCanvas=null;}
  function start(readClock,settings){reset();clock=readClock;options=settings;seen=new Set();budget=P.createBudget();lastBaseline=null;baselineProbe=null;nextBaselineCheck=0;lastAttempt=-Infinity;extraBlockedUntil=0;retryAt=0;schedule(Math.max(3,Number(settings.dwellSeconds)||0)*1000);}
  function stop(){reset();clock=null;}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes.settings)return;options={...options,...changes.settings.newValue};if(options.enabled===false||options.scenesEnabled===false)reset();else schedule();});
  window.addEventListener('pagehide',stop);document.addEventListener('yt-navigate-start',stop);
  globalThis.__recallScenes={start,stop};
})();
