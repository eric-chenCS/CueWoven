import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const events={},requests=[],opened=[];
const event=name=>({addListener:fn=>events[name]=fn});
globalThis.chrome={
 runtime:{onMessage:event('message'),onInstalled:event('install'),id:'test',getURL:path=>'chrome-extension://test/'+path,getContexts:async()=>[{}],sendMessage:async msg=>{requests.push(msg);return {results:[{videoId:'aaaaaaaaaaa',title:'<b>Coral & algae</b>',text:'Warm <water>',start:42}]};}},
 alarms:{onAlarm:event('alarm')},storage:{onChanged:event('storage')},
 tabs:{create:async value=>opened.push(value),update:async value=>opened.push(value)},
 omnibox:{onInputChanged:event('changed'),onInputEntered:event('entered'),onInputStarted:event('started'),onInputCancelled:event('cancelled'),setDefaultSuggestion:()=>{}},
};
await import('../background.js');
test('rc address-bar suggestions reuse local retrieval and escape untrusted title markup',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url)));
 assert.equal(manifest.omnibox.keyword,'rc');
 let suggestions;await events.changed('coral',rows=>suggestions=rows);
 assert.equal(requests.at(-1).type,'search');assert.equal(requests.at(-1).perVideo,1);
 assert.equal(suggestions[0].content,'https://www.youtube.com/watch?v=aaaaaaaaaaa&t=42s');
 assert.ok(suggestions[0].description.includes('&lt;b&gt;Coral &amp; algae&lt;/b&gt;'));
 await events.entered(suggestions[0].content,'newBackgroundTab');assert.equal(opened.at(-1).active,false);
 await events.entered('coral algae','currentTab');assert.equal(opened.at(-1).url,suggestions[0].content);
});
