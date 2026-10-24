import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildReport, SUPPORT_EMAIL} from '../lib/bug-report.js';

const base = {version: '3.3.52 beta', userAgent: 'Mozilla/5.0 Edg/155.0.4283.62', storageMB: 312.44, settings: {enabled: true, speechEnabled: false, dwellSeconds: 10}};
const parts = url => {
  const [address, query] = url.slice('mailto:'.length).split('?');
  return {address, ...Object.fromEntries(query.split('&').map(pair => pair.split('=')).map(([key, value]) => [key, decodeURIComponent(value)]))};
};

test('report carries the description, version, browser and feature switches only', () => {
  const {body, url} = buildReport({...base, text: '  Search froze\nafter import  '});
  assert.match(body, /What happened:\nSearch froze\nafter import\n/);
  assert.match(body, /CueWoven: 3\.3\.52 beta/);
  assert.match(body, /Edg\/155\.0\.4283\.62/);
  assert.match(body, /Storage used: 312\.4 MB/);
  assert.match(body, /enabled: on, speechEnabled: off/);
  assert.doesNotMatch(body, /dwellSeconds/);
  const mail = parts(url);
  assert.equal(mail.address, SUPPORT_EMAIL);
  assert.equal(mail.subject, 'CueWoven problem: Search froze');
  assert.equal(mail.body, body);
  assert.doesNotMatch(url, /\+/, 'spaces are %20 so email apps do not show plus signs');
});

test('empty descriptions are rejected', () => {
  assert.throws(() => buildReport({...base, text: '   '}), /Describe what happened/);
});

test('long descriptions are shortened so the email link stays usable', () => {
  const {body, url} = buildReport({...base, text: 'x'.repeat(20000)});
  assert.match(body, /\[shortened\]/);
  assert.ok(url.length < 2000, `url length ${url.length}`);
});

test('unknown storage is reported as unknown', () => {
  assert.match(buildReport({...base, storageMB: NaN, text: 'a'}).body, /Storage used: unknown/);
});
