// Controlled platform pages: real Chromium media/DOM, no production accounts.
const {chromium}=require(process.env.RECALL_PLAYWRIGHT || 'playwright');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.RECALL_BROWSER?{executablePath:process.env.RECALL_BROWSER}:{})});
  const results=[];
  try {
    for(const [host,container,caption,url1,url2] of [
      ['www.instagram.com','article','h1','/reel/first','/reel/second'],
      ['www.tiktok.com','div data-e2e="recommend-list-item-container"','h1 data-e2e="video-desc"','/@creator/video/111','/@creator/video/222'],
      ['www.facebook.com','article','h2','/reel/111','/reel/222'],
      ['x.com','article','h2','/creator/status/111','/creator/status/222'],
    ]) {
      const page=await browser.newPage({viewport:{width:1000,height:800}}), errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route(`https://${host}/**`,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Feed</title>
        <video id="neighbour" muted style="position:absolute;left:-1000px;width:300px;height:500px"></video>
        <${container}><a id="post" href="${url1}">Permalink</a><${caption}>Aurora first post caption</${caption.split(' ')[0]}><video id="active" muted style="width:300px;height:500px"></video></${container.split(' ')[0]}>
        <script>for(const v of document.querySelectorAll('video')){const c=document.createElement('canvas');c.width=300;c.height=500;const ctx=c.getContext('2d');setInterval(()=>{ctx.fillRect(0,0,300,500)},50);v.srcObject=c.captureStream(20);v.play();}</script>`}));
      await page.goto(`https://${host}/`);
      await page.waitForFunction(()=>document.querySelector('#active').readyState>=2);
      await page.evaluate(()=>{
        window.messages=[];
        window.chrome={storage:{local:{get:async()=>({webCapture:{enabled:true,allSites:true,audio:false},settings:{enabled:true,lightMode:true}})},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(){}},sendMessage:async msg=>{
          messages.push({...msg,at:performance.now()});
          if(msg.type==='web-identify')return {video:{videoId:'web_'+msg.url.split('/').at(-1),kind:'video',title:msg.title,url:msg.url}};
          return {ok:true};
        }}};
        window.captureStarted=performance.now();
      });
      for(const file of ['lib/web-policy.js','content/web-capture.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,file),'utf8')});
      await page.waitForFunction(()=>messages.some(msg=>msg.type==='web-metadata'));
      const first=await page.evaluate(()=>messages.find(msg=>msg.type==='web-metadata'));
      assert.equal(first.video.url,`https://${host}${url1}`);assert.match(first.text,/Aurora/);
      assert.ok(first.at-await page.evaluate(()=>captureStarted)<5000);
      assert.equal(await page.evaluate(()=>__recallMediaElement().id),'active');
      // Several platforms reuse the same media element while changing the post.
      assert.equal(await page.evaluate(({url2})=>{document.querySelector('#post').href=url2;document.querySelector('h1,h2').textContent='Nebula second post caption';return __recallMediaElement()}, {url2}),null,'a reused player must not emit frames under the previous post identity');
      await page.waitForFunction(()=>messages.filter(msg=>msg.type==='web-metadata').length>=2);
      const second=await page.evaluate(()=>messages.filter(msg=>msg.type==='web-metadata').at(-1));
      assert.equal(second.video.url,`https://${host}${url2}`);assert.match(second.text,/Nebula/);
      await page.evaluate(()=>document.querySelector('#active').pause());
      assert.equal(await page.evaluate(()=>__recallMediaElement()),null);
      assert.equal(await page.evaluate(()=>messages.some(msg=>msg.type==='speech-auto-start')),false);
      assert.deepEqual(errors,[]);results.push({host,metadata:true,reusedPlayer:true,activeVideo:true});await page.close();
    }
    console.log('SHORT_FEEDS_PASS',JSON.stringify(results));
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
