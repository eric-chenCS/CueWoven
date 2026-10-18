// Capture only article images already loaded and visible in an allowed active page.
(function(){
  if(globalThis.__recallArticleImages)return;
  const P=globalThis.__recallWebPolicy;
  let page='',generation=0,inFlight=false,seen=new Set(),saved=0,retryAt=0,scanAt=0;
  function reset(){generation++;page='';seen.clear();saved=0;retryAt=0;scanAt=0;}
  function candidates(){
    const root=[...document.querySelectorAll('article,main,[role="main"]')].slice(0,16).map(node=>({node,length:node.textContent?.length||0})).sort((a,b)=>b.length-a.length)[0]?.node;
    if(!root)return [];
    return [...root.querySelectorAll('img')].slice(0,80).filter(img=>{
      if(!img.complete||img.naturalWidth<160||img.naturalHeight<100||img.naturalWidth*img.naturalHeight>16e6||img.naturalWidth/img.naturalHeight>4)return false;
      if(img.closest('nav,header,footer,aside,form,[aria-hidden="true"],[data-ad],.advertisement,.ad,.avatar,.logo'))return false;
      const label=(img.alt||'')+' '+img.className;if(/\b(?:logo|avatar|tracking|advertisement|icon)\b/i.test(label))return false;
      const box=img.getBoundingClientRect();
      return box.width>=120&&box.height>=80&&box.bottom>0&&box.right>0&&box.top<innerHeight&&box.left<innerWidth&&(!img.checkVisibility||img.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))&&P.safeUrl(img.currentSrc||img.src);
    });
  }
  async function snapshot(img){
    const draw=source=>{
      const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height,ratio=Math.min(1,320/width,320/height),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
      const image=canvas.toDataURL('image/jpeg',.6);if(image.length>90000)throw Error('Image too large');return image;
    };
    const source=new URL(img.currentSrc||img.src);
    if(source.origin===location.origin)return draw(img);
    // Content-script canvas access can inherit extension privileges; require a CORS fetch first.
    const response=await fetch(source.href,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});
    if(!response.ok||!['basic','cors'].includes(response.type))throw Error('Image access blocked');
    const reader=response.body.getReader(),parts=[];let bytes=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8e6)throw Error('Image too large');parts.push(value);}}
    finally{await reader.cancel().catch(()=>{});}
    const bitmap=await createImageBitmap(new Blob(parts));
    try{return draw(bitmap);}finally{bitmap.close();}
  }
  async function tick({url,enabled,ready,isAllowed}){
    if(url!==page){reset();page=url;}
    if(!enabled||!ready||inFlight||saved>=3||seen.size>=128||Date.now()<retryAt||Date.now()<scanAt)return;
    scanAt=Date.now()+3000;
    const img=candidates().find(img=>!seen.has(img.currentSrc||img.src));if(!img)return;
    const source=img.currentSrc||img.src,epoch=generation;
    inFlight=true;
    try{
      const image=await snapshot(img);
      if(epoch!==generation||!isAllowed()||P.safeUrl(location.href)?.href!==url)return;
      const caption=P.redactText(img.closest('figure')?.querySelector('figcaption')?.innerText||img.alt||'').trim().slice(0,600);
      const result=await chrome.runtime.sendMessage({type:'web-image',url,image,caption,capturedAt:Date.now()});
      if(epoch!==generation)return;
      if(result?.busy){retryAt=Date.now()+3000;return;}
      if(result?.rateLimited){retryAt=Date.now()+60000;return;}
      if(result?.ok){saved++;seen.add(source);}
      else if(result?.duplicate){saved++;seen.add(source);}
      else if(result?.disabled||result?.inactive)retryAt=Date.now()+3000;
      else {seen.add(source);retryAt=Date.now()+10000;}
    }catch{if(epoch===generation){seen.add(source);retryAt=Date.now()+3000;}}
    finally{inFlight=false;}
  }
  globalThis.__recallArticleImages={tick,reset};
  window.addEventListener('pagehide',reset);
})();
