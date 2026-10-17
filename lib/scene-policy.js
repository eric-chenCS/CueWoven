// Shared by classic isolated content scripts and the offscreen ES module.
(function(root){
  const WIDTH=96,HEIGHT=54,PROBE_MS=500,BASELINE_MS=20000,QUIET_MS=60000,MIN_GAP_MS=2000,MAX_AGE_MS=10000,EXTRA_LIMIT=6,WINDOW_MS=60000;
  function changedFrame(before,after){
    if(!before || before.length!==after.length)return false;
    const tiles=new Uint16Array(48);let changed=0;
    for(let pixel=0;pixel<WIDTH*HEIGHT;pixel++){
      const i=pixel*4;
      if(Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]))<32)continue;
      changed++;tiles[Math.floor(pixel/WIDTH/9)*8+Math.floor(pixel%WIDTH/12)]++;
    }
    return changed>=WIDTH*HEIGHT*.18 || tiles.some(count=>count>=12*9*.65);
  }
  function createBudget(){
    let attempts=[];
    const prune=now=>{attempts=attempts.filter(time=>now-time<WINDOW_MS);};
    return {
      allows(now){prune(now);return attempts.length<EXTRA_LIMIT;},
      record(now){prune(now);attempts.push(now);},
      retryAfter(now){prune(now);return attempts.length<EXTRA_LIMIT?0:Math.max(0,WINDOW_MS-(now-attempts[0]));},
    };
  }
  Object.defineProperty(root,'__recallScenePolicy',{value:{WIDTH,HEIGHT,PROBE_MS,BASELINE_MS,QUIET_MS,MIN_GAP_MS,MAX_AGE_MS,EXTRA_LIMIT,changedFrame,createBudget},configurable:true});
})(globalThis);
