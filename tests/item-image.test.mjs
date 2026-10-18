import {test} from 'node:test';
import assert from 'node:assert/strict';
import {faviconUrl,imageSources,setItemImage} from '../lib/item-image.js';
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
 assert.deepEqual(imageSources({kind:'page',url:'invalid'},runtime),[runtime.getURL('icons/web.svg')]);
});
test('broken images fall through to the local icon without looping or keeping scene alt text',()=>{
 const classes=new Map(),image={classList:{toggle:(name,value)=>classes.set(name,value)},alt:'Saved scene'};
 setItemImage(image,{kind:'page',url:'https://example.com',image:'bad-image'},runtime);
 assert.equal(image.src,'bad-image');assert.equal(classes.get('website-icon'),false);
 image.onerror();assert.match(image.src,/_favicon/);assert.equal(image.alt,'');
 image.onerror();assert.equal(image.src,runtime.getURL('icons/web.svg'));assert.equal(classes.get('website-icon'),true);
 image.onerror();assert.equal(image.onerror,null);assert.equal(image.referrerPolicy,'no-referrer');
});
