import {test} from 'node:test';
import assert from 'node:assert/strict';
import {policy} from '../lib/web-items.js';
import {isExtensionPage} from '../lib/message-source.js';
test('shared redaction catches credentials in prose, headers, JSON and PEM blocks',()=>{
  const samples=[
    'sk-'+ 'a'.repeat(30),'github_pat_'+ 'a'.repeat(40),'ghp_'+ 'a'.repeat(36),
    'AKIA'+ 'A'.repeat(16),'xoxb-'+ 'a'.repeat(25),'AIza'+ 'a'.repeat(35),'sk_live_'+ 'a'.repeat(24),
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmno',
    'Bearer abcdefghijklmnopqrstuvwxyz123456',
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    'Authorization: Basic YWxhZGRpbjpvcGVuc2VzYW1l',
    '"api_key": "abcdefghijklmnopqrstuvwxyz123456"',
    "password = 'abcdefghijklmnopqrstuvwxyz123456'",
    'client_secret=abcdefghijklmnopqrstuvwxyz123456',
    '-----BEGIN PRIVATE KEY-----\nabcdefg\n-----END PRIVATE KEY-----',
    '-----BEGIN OPENSSH PRIVATE KEY-----\nabcdefg\n-----END OPENSSH PRIVATE KEY-----',
    '-----BEGIN ENCRYPTED PRIVATE KEY-----\nabcdefg\n-----END ENCRYPTED PRIVATE KEY-----'
  ];
  for(const value of samples){const clean=policy.redactText(value);assert.notEqual(clean,value);assert.match(clean,/redacted/);assert.equal(policy.redactText(clean),clean);}
  for(const value of ['API keys authenticate requests.','A password should be long and unique.','const token = parseToken(input);','Secret sharing and tokenization improve data handling.','Coral reefs lose algae in warm water.'])assert.equal(policy.redactText(value),value);
  const pii=policy.redactText('person@example.com 212-555-1234 123-45-6789 4111 1111 1111 1111');
  for(const label of ['email','phone','SSN','card'])assert.ok(pii.includes('['+label+' redacted]'));
});
test('credential URLs are excluded centrally and ordinary state/key parameters keep their identity',()=>{
  for(const name of ['refresh_token','api_key','apikey','client_secret','sig','signature'])assert.equal(policy.safeUrl('https://example.com/article?'+name+'=opaque'),null);
  assert.equal(policy.safeUrl('https://example.com/article?key=sk-'+ 'a'.repeat(30)),null);
  const url='https://example.com/article?state=CA&key=chapter1';assert.equal(policy.safeUrl(url).href,url);
});
test('sender checks accept real extension tabs but reject websites, lookalikes and subframes',()=>{
  const runtime={id:'abc',getURL:path=>'chrome-extension://abc/'+path},paths=['options/options.html'];
  for(const tab of [undefined,{id:1}])assert.ok(isExtensionPage({id:'abc',url:runtime.getURL(paths[0])+'#settings',tab},runtime,paths));
  for(const sender of [null,{id:'other',url:runtime.getURL(paths[0])},{id:'abc'},{id:'abc',url:'https://example.com/options/options.html'},{id:'abc',url:runtime.getURL(paths[0])+'/fake'},{id:'abc',url:runtime.getURL(paths[0])+'?fake'},{id:'abc',url:runtime.getURL(paths[0]),frameId:1}])assert.equal(isExtensionPage(sender,runtime,paths),false);
});

test('OCR records redact both searchable text and observed lines, including backup restores',async()=>{
  const {screenRecord}=await import('../lib/screen-text.js');
  const secret='sk-'+ 'a'.repeat(30),row=screenRecord({videoId:'aaaaaaaaaaa',start:5,text:'Coral science '+secret,observedLines:['Coral science '+secret]});
  assert.equal(JSON.stringify(row).includes(secret),false);assert.match(row.text,/redacted/);assert.match(row.observedLines[0],/redacted/);
});
