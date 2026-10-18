import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateVideoMetadataBatch} from '../lib/video-metadata.js';
test('live metadata validates the whole batch and retains only bounded public fields',()=>{
 const good={videoId:'aaaaaaaaaaa',title:' A video ',channel:'c'.repeat(300),watchedAt:Date.now(),privateField:'do not save'};
 const result=validateVideoMetadataBatch([good]);assert.equal(result[0].title,'A video');assert.equal(result[0].channel.length,200);assert.equal(result[0].privateField,undefined);
 for(const value of [null,[],Array(33).fill(good),[{...good,videoId:'bad'}],[{...good,watchedAt:NaN}],[good,{...good,title:''}]])assert.throws(()=>validateVideoMetadataBatch(value));
});
