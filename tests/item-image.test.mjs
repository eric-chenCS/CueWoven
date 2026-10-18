import {test} from 'node:test';
import assert from 'node:assert/strict';
import {faviconUrl,bundledFavicon,imageSources,setItemImage} from '../lib/item-image.js';
import {DEFAULT_DOMAINS} from '../lib/web-sites.js';
import {readFileSync} from 'node:fs';
const runtime={getURL:path=>'chrome-extension://fixture/'+path};
test('website icons use the browser endpoint and only disclose the origin to it',()=>{
 const icon=new URL(faviconUrl('https://example.com/article?query=private#details',runtime));
 assert.equal(icon.hostname,'fixture');assert.equal(icon.protocol,'chrome-extension:');assert.equal(icon.pathname,'/_favicon/');
 assert.equal(icon.searchParams.get('pageUrl'),'https://example.com/');assert.equal(icon.searchParams.get('size'),'32');
 for(const value of ['javascript:alert(1)','data:text/html,hi','file:///secret','https://name:password@example.com'])assert.equal(faviconUrl(value,runtime),null);
 assert.equal(imageSources({kind:'page',url:'https://example.com/article'},runtime).length,2);
});
test('saved scenes and YouTube thumbnails remain preferred, with local fallbacks for all kinds',()=>{
 const video={videoId:'aaaaaaaaaaa',image:'data:image/jpeg;base64,AAAA'};
 assert.deepEqual(imageSources(video,runtime),[video.image,'https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg',runtime.getURL('icons/web.svg')]);
 assert.deepEqual(imageSources({sample:true,videoId:'rcDemo00001'},runtime),[runtime.getURL('icons/web.svg')]);
 assert.deepEqual(imageSources({kind:'page',url:'invalid'},runtime),[runtime.getURL('icons/site.svg')]);
});
test('broken images fall through to the local icon without looping or keeping scene alt text',()=>{
 const classes=new Map(),image={classList:{toggle:(name,value)=>classes.set(name,value)},alt:'Saved scene'};
 setItemImage(image,{kind:'page',url:'https://example.com',image:'bad-image'},runtime);
 assert.equal(image.src,'bad-image');assert.equal(classes.get('website-icon'),false);
 image.onerror();assert.match(image.src,/_favicon/);assert.equal(image.alt,'');
 image.onerror();assert.equal(image.src,runtime.getURL('icons/site.svg'));assert.equal(classes.get('website-icon'),true);
 image.onerror();assert.equal(image.onerror,null);assert.equal(image.referrerPolicy,'no-referrer');
});

test('all suggested sites have real local icons; hostname boundaries prevent mismatches',()=>{
 for(const host of DEFAULT_DOMAINS){
  const expected=runtime.getURL('icons/sites/'+host+'.png');
  assert.equal(bundledFavicon('https://www.'+host+'/article',runtime),expected);
  assert.equal(imageSources({kind:'page',url:'https://'+host},runtime)[0],expected);
  const bytes=readFileSync(new URL('../icons/sites/'+host+'.png',import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 }
 for(const value of ['https://notyoutube.com','https://youtube.com.evil.test','https://youtube.com@evil.test','javascript:youtube.com','file:///youtube.com'])assert.equal(bundledFavicon(value,runtime),null);
});
