// Read only pixels of the visibly playing video; sharp frames are never stored.
(function(){
  let clock,options={},timer,generation=0,busy=false,lastAttempt=0,lastFingerprint='',seen=new Set();
  const send=async msg=>{try{return await chrome.runtime.sendMessage(msg);}catch(error){return {error:error.message};}};
  function schedule(delay=1000){clearTimeout(timer);if(clock && options.enabled!==false && options.screenTextEnabled!==false)timer=setTimeout(tick,delay);}
  async function tick(){
    if(busy){schedule();return;}
    const state=clock?.(),video=document.querySelector('video');
    if(!state?.video || state.forced)return;
    if(!state.visible || state.paused || state.seeking || state.ad || !video || video.readyState<2 || !video.videoWidth || !video.videoHeight){schedule();return;}
    const bucket=Math.floor(state.time/5);
    if(!Number.isFinite(state.time)||state.time<0||seen.has(bucket)||Date.now()-lastAttempt<5000){schedule();return;}
    busy=true;lastAttempt=Date.now();const epoch=generation;
    try{
      const canvas=document.createElement('canvas'),scale=Math.min(1,1280/video.videoWidth,720/video.videoHeight);
      canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const image=canvas.toDataURL('image/jpeg',.95);
      if(image.length>1500000)return;
      const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image)))).join(',');
      if(epoch!==generation || fingerprint===lastFingerprint)return;
      const result=await send({type:'screen-frame',video:state.video,start:state.time,revision:state.revision,width:canvas.width,height:canvas.height,image});
      if(epoch===generation && result?.ok){lastFingerprint=fingerprint;seen.add(bucket);if(seen.size>720)seen.delete(seen.values().next().value);}
      if(epoch===generation && result?.error)send({type:'screen-capture-error',reason:'On-screen text could not be saved: '+result.error});
    }catch(error){if(epoch===generation){clock=null;send({type:'screen-capture-error',reason:'This player does not allow reading video images.'});}}
    finally{busy=false;schedule();}
  }
  function start(readClock,settings){generation++;clearTimeout(timer);clock=readClock;options=settings;lastAttempt=0;lastFingerprint='';seen=new Set();schedule(Math.max(3,Number(settings.dwellSeconds)||0)*1000);}
  function stop(){generation++;clearTimeout(timer);clock=null;lastFingerprint='';}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes.settings)return;options={...options,...changes.settings.newValue};if(options.enabled===false||options.screenTextEnabled===false){generation++;lastFingerprint='';clearTimeout(timer);}else schedule();});
  window.addEventListener('pagehide',stop);document.addEventListener('yt-navigate-start',stop);
  globalThis.__recallScreen={start,stop};
})();
