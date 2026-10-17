const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-embedding-upgrade-')),{headless:true,executablePath:process.env.RECALL_BROWSER,viewport:{width:480,height:700},args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base=`chrome-extension://${new URL(worker.url()).hostname}`;
  const options=await context.newPage();await options.goto(`${base}/options/options.html`);await options.evaluate(()=>chrome.storage.local.set({settings:{enabled:false,maxAgeDays:0,scenesEnabled:false,speechEnabled:false}}));
  const before=await options.evaluate(async()=>{
   const db=await import(chrome.runtime.getURL('lib/db.js'));await db.clearAll();
   await db.replaceVideo({videoId:'aaaaaaaaaaa',title:'Legacy audio',channel:'Fixture',method:'speech-local',partial:true,watchedAt:100,indexedAt:200,chunkCount:1},[{videoId:'aaaaaaaaaaa',start:42,text:'Chemical reactions inside electrodes trap active lithium. An aging phone stores less charge after repeated cycles.',speechStart:40,speechEnd:55,vec:new Float32Array(384)}]);
   await db.replaceVideo({videoId:'bbbbbbbbbbb',title:'Coffee lessons',method:'captions',indexedAt:200,watchedAt:100,chunkCount:64},Array.from({length:64},(_,i)=>({videoId:'bbbbbbbbbbb',start:i*30,text:'Grind roasted coffee beans with a burr grinder before brewing a fresh cup. Lesson '+i,vec:new Float32Array(384)})));
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d').fillRect(0,0,320,180);
   await db.scenes.put({key:'aaaaaaaaaaa:2',videoId:'aaaaaaaaaaa',start:42,indexedAt:200,watchedAt:100,image:canvas.toDataURL('image/jpeg',.6),vec:new Float32Array(512)});
   return {video:await db.getVideo('aaaaaaaaaaa'),chunks:await db.chunksOf('aaaaaaaaaaa')};
  });
  await options.evaluate(()=>chrome.runtime.sendMessage({type:'search',query:'lithium electrodes losing charge',singleVideo:true}));
  const wait=async predicate=>{const deadline=Date.now()+120000;do{const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100))}while(Date.now()<deadline);throw Error('Embedding upgrade timed out')};
  const done=await wait(async()=>{const state=(await options.evaluate(()=>chrome.runtime.sendMessage({type:'status'}))).embeddingMigration;if(state.status==='error')throw Error(state.error);return state.status==='ready'&&state});
  assert.equal(done.total,65);assert.equal(done.updated,65);
  const after=await options.evaluate(async()=>{const db=await import(chrome.runtime.getURL('lib/db.js'));return {video:await db.getVideo('aaaaaaaaaaa'),chunks:await db.chunksOf('aaaaaaaaaaa')}});
  assert.deepEqual(after.video,before.video);for(const key of ['id','videoId','start','text','speechStart','speechEnd'])assert.equal(after.chunks[0][key],before.chunks[0][key]);assert.equal(after.chunks[0].embeddingVersion,'minilm-l6-v2-body-v2');assert.equal(after.chunks[0].vec.length,384);
  const popup=await context.newPage();await popup.goto(`${base}/popup/popup.html`);await popup.locator('#q').fill('lithium electrodes losing charge');await popup.locator('#q').press('Enter');
  await wait(async()=>await popup.locator('.result .match-sources').first().textContent().catch(()=>''));assert.match(await popup.locator('.result .match-sources').first().textContent(),/Audio/);assert.doesNotMatch(await popup.locator('.result .meta').first().textContent(),/%/);assert.match(await popup.locator('.result').first().getAttribute('href'),/t=42s/);
  await popup.screenshot({path:path.join(process.env.RECALL_SCREENSHOT_DIR||os.tmpdir(),'recall-accuracy-audio.png'),fullPage:true});
  const races=await options.evaluate(async()=>{
   const db=await import(chrome.runtime.getURL('lib/db.js')),snapshot=await db.chunksOf('aaaaaaaaaaa');
   await db.touchWatch('aaaaaaaaaaa',999);const touched=await db.updateEmbeddings(snapshot,[new Float32Array(384)],'race-test');
   const watchedAt=(await db.getVideo('aaaaaaaaaaa')).watchedAt;
   await db.replaceVideo({videoId:'aaaaaaaaaaa',title:'Full caption',method:'captions',chunkCount:1,indexedAt:200},[{videoId:'aaaaaaaaaaa',start:88,text:'New full caption wins',vec:new Float32Array(384)}]);
   const replacement=await db.updateEmbeddings(snapshot,[new Float32Array(384)],'different-version');
   const current=await db.getVideo('aaaaaaaaaaa'),chunks=await db.chunksOf('aaaaaaaaaaa');await db.deleteVideo('aaaaaaaaaaa');
   const deleted=await db.updateEmbeddings(chunks,[new Float32Array(384)],'different-version');
   return {touched,watchedAt,replacement,current:current.sceneCount,text:chunks[0].text,deleted,resurrected:!!await db.getVideo('aaaaaaaaaaa')};
  });
  assert.deepEqual(races,{touched:1,watchedAt:999,replacement:0,current:1,text:'New full caption wins',deleted:0,resurrected:false});assert.deepEqual(errors,[]);
  console.log('EMBEDDING_UPGRADE_PASS: 65 legacy chunks, metadata/ranges/scenes preserved, Audio indicator and timestamp, no fake confidence, concurrent recency/replacement/deletion protection.');
 }finally{await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
