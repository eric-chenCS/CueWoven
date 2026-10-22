import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = {};
ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(new URL('../lib/parse.js', import.meta.url), 'utf8'), ctx);
const P = ctx.__recallParse;

test('parseJson3 reads events, drops blanks and [Music]', () => {
  const json = {
    events: [
      { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: '[Music]' }] },
      { tStartMs: 1500, dDurationMs: 3000, segs: [{ utf8: 'black holes ' }, { utf8: 'bend light' }] },
      { tStartMs: 4000, aAppend: 1, segs: [{ utf8: '\n' }] },
      { tStartMs: 5000, dDurationMs: 1000 },
      { tStartMs: 6200, dDurationMs: 1000, segs: [{ utf8: 'it&#39;s wild' }] },
    ],
  };
  const out = P.parseJson3(JSON.stringify(json));
  assert.equal(out.length, 2);
  assert.equal(out[0].text, 'black holes bend light');
  assert.equal(out[0].start, 1.5);
  assert.equal(out[1].text, "it's wild");
});

test('parseTimedText handles classic XML with entities', () => {
  const xml = '<?xml version="1.0"?><transcript><text start="12.5" dur="3.1">Tom &amp;amp; Jerry</text><text start="15.6" dur="2">say &quot;hi&quot;</text></transcript>';
  const out = P.parseTimedText(xml);
  assert.equal(out.length, 2);
  assert.equal(out[0].start, 12.5);
  assert.equal(out[1].text, 'say "hi"');
});

test('parseTimedText handles srv3 XML in milliseconds', () => {
  const xml = '<timedtext format="3"><body><p t="61000" d="2500">hello <s>world</s></p></body></timedtext>';
  const out = P.parseTimedText(xml);
  assert.equal(out.length, 1);
  assert.equal(out[0].start, 61);
  assert.equal(out[0].text, 'hello world');
});

test('parseInnertubeTranscript finds segments anywhere in the response', () => {
  const resp = {
    actions: [{ updateEngagementPanelAction: { content: { transcriptRenderer: { body: { transcriptSegmentListRenderer: { initialSegments: [
      { transcriptSectionHeaderRenderer: { snippet: { simpleText: 'Intro' } } },
      { transcriptSegmentRenderer: { startMs: '0', endMs: '4000', snippet: { runs: [{ text: 'welcome back' }] } } },
      { transcriptSegmentRenderer: { startMs: '4000', endMs: '9000', snippet: { runs: [{ text: 'today: ' }, { text: 'batteries' }] } } },
    ] } } } } } }],
  };
  const out = P.parseInnertubeTranscript(resp);
  assert.equal(out.length, 2);
  assert.equal(out[1].text, 'today: batteries');
  assert.equal(out[1].start, 4);
  assert.equal(out[1].dur, 5);
});

test('parseTimestamp', () => {
  assert.equal(P.parseTimestamp('0:07'), 7);
  assert.equal(P.parseTimestamp('12:05'), 725);
  assert.equal(P.parseTimestamp('1:02:03'), 3723);
  assert.ok(Number.isNaN(P.parseTimestamp('abc')));
  assert.ok(Number.isNaN(P.parseTimestamp('')));
  assert.ok(Number.isNaN(P.parseTimestamp('1::2')));
  assert.ok(Number.isNaN(P.parseTimestamp('-1')));
});

test('out-of-range HTML entities do not crash caption parsing', () => {
  assert.equal(P.decodeEntities('&#99999999;'), '&#99999999;');
  assert.equal(P.decodeEntities('&#x110000;'), '&#x110000;');
  assert.equal(P.decodeEntities('&#128512;'), '😀');
});

test('pickCaptionTrack prefers manual English', () => {
  const tracks = [
    { languageCode: 'de', baseUrl: 'de' },
    { languageCode: 'en', kind: 'asr', baseUrl: 'en-asr' },
    { languageCode: 'en-GB', baseUrl: 'en-gb' },
  ];
  assert.equal(P.pickCaptionTrack(tracks).baseUrl, 'en-gb');
  assert.equal(P.pickCaptionTrack(tracks.slice(0, 2)).baseUrl, 'en-asr');
  assert.equal(P.pickCaptionTrack([]), null);
});

test('transcript panel parsing supports both YouTube layouts and skips malformed timestamps', () => {
  const row = (timestampSelector, textSelector, timestamp, text) => ({
    querySelector: selectors => selectors.split(', ').includes(timestampSelector) ? {textContent: timestamp}
      : selectors.split(', ').includes(textSelector) ? {textContent: text} : null,
  });
  const document = {querySelectorAll: selector => {
    assert.equal(selector, 'ytd-transcript-segment-renderer, transcript-segment-view-model');
    return [
      row('.segment-timestamp', '.segment-text', '0:42', '  legacy caption  '),
      row('.ytwTranscriptSegmentViewModelTimestamp', '.yt-core-attributed-string', '1:05', 'new caption'),
      row('.ytwTranscriptSegmentViewModelTimestamp', '.ytAttributedStringHost', '1:12', 'current live caption'),
      row('.segment-timestamp', '.segment-text', 'invalid', 'skip me'),
      row('.segment-timestamp', '.segment-text', '0:00', '[Music]'),
    ];
  }};
  const result = P.parseTranscriptDom(document);
  assert.equal(result.length, 3);
  assert.equal(result[0].start, 42);
  assert.equal(result[0].text, 'legacy caption');
  assert.equal(result[1].start, 65);
  assert.equal(result[1].text, 'new caption');
  assert.equal(result[2].start, 72);
  assert.equal(result[2].text, 'current live caption');
});

test('speech language prefers original metadata and ASR over translated captions',()=>{
 const captions=tracks=>({captions:{playerCaptionsTracklistRenderer:{captionTracks:tracks}}});
 assert.equal(P.speechLanguage(captions([{languageCode:'en'},{kind:'asr',languageCode:'es'}])),'es');
 assert.equal(P.speechLanguage({...captions([{languageCode:'es'}]),videoDetails:{defaultAudioLanguage:'en-GB'}}),'en-GB');
 assert.equal(P.speechLanguage(captions([{languageCode:'es'}])),'und');assert.equal(P.speechLanguage({}),null);
});

test('uploaded mixed subtitle languages do not imply English audio',()=>{
 const player=tracks=>({captions:{playerCaptionsTracklistRenderer:{captionTracks:tracks}}});
 assert.equal(P.speechLanguage(player([{languageCode:'es'},{languageCode:'en'}])),'und');assert.equal(P.speechLanguage(player([{languageCode:'en'},{languageCode:'es'}])),'und');
 assert.equal(P.speechLanguage(player([{languageCode:'en-GB'},{languageCode:'en'}])),'en-GB');
 assert.equal(P.speechLanguage(player([{kind:'asr',languageCode:'es'},{languageCode:'en'}])),'es');
});
