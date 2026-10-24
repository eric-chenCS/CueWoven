const fixture=require('./web-fixture.cjs'),assert=require('assert/strict');
// The Diagnostics report opens an email to support (not GitHub) without leaving an empty tab behind.
(async()=>{const f=await fixture(),errors=[];f.context.on('weberror',e=>errors.push(e.error().message));try{
 const o=f.options;await o.goto(f.base+'/options/options.html');
 await o.evaluate(()=>{for(let n=document.getElementById('report');n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;});
 assert.equal((await o.locator('#report-open').textContent()).trim(),'Email report to support');
 await o.evaluate(()=>{window.__links=[];const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){window.__links.push(this.href);};});
 const tabs=f.context.pages().length;
 await o.locator('#report-text').fill('Search froze after import');await o.locator('#report-open').click();
 await o.waitForFunction(()=>document.querySelector('#report-msg').textContent.includes('support@fusilite.com'));
 const [link]=await o.evaluate(()=>window.__links);
 assert.match(link,/^mailto:support@fusilite\.com\?subject=CueWoven%20problem%3A%20Search%20froze%20after%20import&body=/);
 assert.match(decodeURIComponent(link),/CueWoven: \d+\.\d+\.\d+/);
 assert.equal(f.context.pages().length,tabs,'no tab opened');
 assert.doesNotMatch(await o.locator('#report').innerText(),/GitHub/);
 assert.deepEqual(errors,[]);console.log('SUPPORT_REPORT_PASS',link.slice(0,90));
}finally{await f.close();}})().catch(error=>{console.error(error);process.exitCode=1});
