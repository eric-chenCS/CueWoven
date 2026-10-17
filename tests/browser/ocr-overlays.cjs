const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=process.env.RECALL_EXTENSION||path.resolve(__dirname,'../..');
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'recall-ocr-overlays-')),{headless:true,executablePath:process.env.RECALL_BROWSER,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage(),requests=[];
  page.on('request',request=>requests.push(request.url()));await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options/options.html`);
  const report=await page.evaluate(async()=>{
   const {createOcrModel}=await import(chrome.runtime.getURL('offscreen/ocr-model.js')),model=createOcrModel(),canvas=document.createElement('canvas');
   canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d'),rows=[];
   const pairs=[['The dose is 10 mg.','The dose is 90 mg.'],['The battery is safe to use.','The battery is not safe to use.'],['Alice defeated Bob in the final.','Bob defeated Alice in the final.']];
   try{
    for(const background of ['boxed','light'])for(const pair of pairs)for(let variant=0;variant<8;variant++){
     const lines=variant%2?[...pair].reverse():pair;
     ctx.fillStyle=background==='light'?'#fff':'#345b78';ctx.fillRect(0,0,1280,720);ctx.fillStyle=background==='light'?'#fff':'#111';ctx.fillRect(70,70,1140,100);ctx.fillRect(70,550,1140,130);
     ctx.font=`bold ${32+Math.floor(variant/2)*4}px Arial`;ctx.fillStyle=background==='light'?'#111':'#fff';ctx.fillText(lines[0],100,135);ctx.fillText(lines[1],100,625);
     const start=performance.now(),result=await model.read(canvas.toDataURL('image/jpeg',.95),1280,720);
     rows.push({background,expected:lines,lines:result.lines,ms:Math.round(performance.now()-start)});
    }
    for(let variant=0;variant<8;variant++){
     ctx.fillStyle='#fff';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#111';ctx.font=`bold ${32+Math.floor(variant/2)*4}px Arial`;
     ctx.fillText('RECALL',variant%2?900:100,135);
     const start=performance.now(),result=await model.read(canvas.toDataURL('image/jpeg',.95),1280,720);
     rows.push({background:'isolated',expected:['RECALL'],lines:result.lines,ms:Math.round(performance.now()-start)});
    }
    return rows;
   }finally{model.release()}
  });
  const normalized=text=>text.toLowerCase().replace(/\s+/g,' ').replace(/[.!?]/g,'').trim();
  for(const row of report)for(const expected of row.expected)assert.ok(row.lines.some(line=>normalized(line)===normalized(expected)),JSON.stringify(row));
  assert.ok(requests.filter(url=>/tesseract|traineddata|ocr\//.test(url)).every(url=>url.startsWith('chrome-extension://')));
  const warm=report.slice(1).map(row=>row.ms).sort((a,b)=>a-b);
  console.log('OCR_OVERLAYS_PASS',JSON.stringify({frames:report.length,retainedLines:report.reduce((sum,row)=>sum+row.expected.length,0),firstMs:report[0].ms,warmMedianMs:warm[Math.floor(warm.length/2)],warmP95Ms:warm[Math.ceil(warm.length*.95)-1],scope:'Real bundled English Tesseract OCR; 56 generated boxed/light/isolated frames, 32–44px fonts, both overlay positions. This is not arbitrary-video OCR accuracy.'}));
 }finally{await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
