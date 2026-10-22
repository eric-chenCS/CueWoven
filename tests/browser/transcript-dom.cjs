const {chromium}=require(process.env.RECALL_PLAYWRIGHT||'playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.RECALL_BROWSER});
 try{
  const page=await browser.newPage();await page.addScriptTag({path:path.resolve(__dirname,'../../lib/parse.js')});
  const cases=[
   ['legacy', '<div class="segment-timestamp">1:12</div><div class="segment-text">Real caption</div>'],
   ['current live layout', '<div class="ytwTranscriptSegmentViewModelTimestamp">1:12</div><span class="ytAttributedStringHost">Real caption</span>'],
   ['attributed timestamp', '<div class="ytwTranscriptSegmentViewModelTimestamp ytAttributedStringHost">1:12</div><span class="ytAttributedStringHost">Real caption</span>'],
   ['nested attributed timestamp', '<div class="ytwTranscriptSegmentViewModelTimestamp"><span class="yt-core-attributed-string">1:12</span></div><span class="ytAttributedStringHost">Real caption</span>'],
   ['explicit caption takes priority', '<div class="ytAttributedStringHost">Unrelated label</div><div class="segment-timestamp">1:12</div><div class="segment-text">Real caption</div>'],
   ['attributed wrapper and accessibility timestamp', '<div class="ytAttributedStringHost"><div class="ytwTranscriptSegmentViewModelTimestamp">1:12</div><div class="ytwTranscriptSegmentViewModelTimestampA11yLabel"><span class="ytAttributedStringHost">72 seconds</span></div><span class="ytAttributedStringHost">Real caption</span></div>'],
   ['timestamp without caption', '<div class="ytwTranscriptSegmentViewModelTimestamp"><span class="ytAttributedStringHost">1:12</span></div>',[]],
   ['spoken timestamp is valid text', '<div class="segment-timestamp">1:12</div><span class="ytAttributedStringHost">1:12</span>',[{start:72,dur:0,text:'1:12'}]],
  ];
  for(const [name,html,expected] of cases){
   const result=await page.evaluate(html=>{const document=new DOMParser().parseFromString('<transcript-segment-view-model>'+html+'</transcript-segment-view-model>','text/html');return window.__recallParse.parseTranscriptDom(document);},html);
   assert.deepEqual(result,expected||[{start:72,dur:0,text:'Real caption'}],name);
  }
  console.log('TRANSCRIPT_DOM_PASS',JSON.stringify({browser:browser.version(),cases:cases.length}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
