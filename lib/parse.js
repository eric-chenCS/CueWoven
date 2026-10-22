// Transcript parsing helpers.
// Loaded as a classic script in YouTube's page (MAIN world), so it exposes a single
// namespaced global instead of using ES module exports. Tests load it with node:vm.
(function (root) {
  'use strict';

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

  function decodeEntities(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }

  function cleanText(s) {
    return decodeEntities(s)
      .replace(/<[^>]+>/g, ' ')         // stray markup inside captions
      .replace(/\[[^\]]{1,30}\]/g, ' ') // [Music], [Applause], [Laughter]
      .replace(/\s+/g, ' ')
      .trim();
  }

  // "1:02:03" | "12:05" | "45" -> seconds
  function parseTimestamp(str) {
    if (!/^\d+(?::\d{1,2}){0,2}$/.test(String(str).trim())) return NaN;
    const parts = String(str).trim().split(':').map(Number);
    if (!parts.length || parts.some((n) => !Number.isFinite(n))) return NaN;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }

  function finalize(segments) {
    return segments
      .map((s) => ({ start: Math.max(0, +s.start || 0), dur: Math.max(0, +s.dur || 0), text: cleanText(s.text || '') }))
      .filter((s) => s.text.length > 0)
      .sort((a, b) => a.start - b.start);
  }

  // YouTube timedtext fmt=json3
  function parseJson3(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const events = (data && data.events) || [];
    return finalize(
      events
        .filter((e) => Array.isArray(e.segs))
        .map((e) => ({
          start: (e.tStartMs || 0) / 1000,
          dur: (e.dDurationMs || 0) / 1000,
          text: e.segs.map((s) => s.utf8 || '').join(''),
        }))
    );
  }

  // YouTube timedtext XML: classic <text start dur> or srv3 <p t d> (ms)
  function parseTimedTextXml(xml) {
    const out = [];
    const classic = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = classic.exec(xml))) {
      const start = attr(m[1], 'start');
      const dur = attr(m[1], 'dur');
      out.push({ start: parseFloat(start) || 0, dur: parseFloat(dur) || 0, text: m[2] });
    }
    if (!out.length) {
      const srv3 = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
      while ((m = srv3.exec(xml))) {
        const t = parseFloat(attr(m[1], 't'));
        if (!Number.isFinite(t)) continue;
        out.push({ start: t / 1000, dur: (parseFloat(attr(m[1], 'd')) || 0) / 1000, text: m[2] });
      }
    }
    return finalize(out);
  }

  function attr(attrs, name) {
    const r = new RegExp('\\b' + name + '="([^"]*)"').exec(attrs);
    return r ? r[1] : '';
  }

  function parseTimedText(body) {
    const t = String(body || '').trim();
    if (!t) return [];
    if (t[0] === '{') return parseJson3(t);
    if (t[0] === '<') return parseTimedTextXml(t);
    return [];
  }

  // Collect every value stored under `key` anywhere in a nested object (YouTube's
  // Innertube responses change layout often, so we search rather than hard-code paths).
  function findAll(obj, key, out = [], depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 40) return out;
    if (Array.isArray(obj)) {
      for (const v of obj) findAll(v, key, out, depth + 1);
      return out;
    }
    for (const k of Object.keys(obj)) {
      if (k === key) out.push(obj[k]);
      else findAll(obj[k], key, out, depth + 1);
    }
    return out;
  }

  function runsText(t) {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (t.simpleText) return t.simpleText;
    if (Array.isArray(t.runs)) return t.runs.map((r) => r.text || '').join('');
    if (t.content) return t.content;
    return '';
  }

  // Innertube /youtubei/v1/get_transcript response
  function parseInnertubeTranscript(json) {
    const segs = findAll(json, 'transcriptSegmentRenderer');
    return finalize(
      segs.map((r) => {
        const start = Number(r.startMs) / 1000;
        const end = Number(r.endMs) / 1000;
        return { start, dur: Number.isFinite(end) ? end - start : 0, text: runsText(r.snippet) };
      })
    );
  }

  function parseTranscriptDom(document) {
    return finalize(Array.from(document.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model'))
      .map(el => {
        const timestamp = el.querySelector('.segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp');
        const text = el.querySelector('.segment-text, .ytwTranscriptSegmentViewModelSegment') ||
          Array.from(el.querySelectorAll('.yt-core-attributed-string, .ytAttributedStringHost')).find(node =>
            !node.closest('.segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp, .ytwTranscriptSegmentViewModelTimestampA11yLabel') && !node.contains(timestamp));
        return {start: parseTimestamp(timestamp?.textContent || ''), dur: 0, text: text?.textContent || ''};
      }).filter(segment => Number.isFinite(segment.start)));
  }

  // Choose the best caption track: manual English > auto English > any manual > anything.
  function pickCaptionTrack(tracks) {
    if (!Array.isArray(tracks) || !tracks.length) return null;
    const isEn = (t) => /^en\b/i.test(t.languageCode || '');
    const isAsr = (t) => t.kind === 'asr';
    return (
      tracks.find((t) => isEn(t) && !isAsr(t)) ||
      tracks.find((t) => isEn(t)) ||
      tracks.find((t) => !isAsr(t)) ||
      tracks[0]
    );
  }

  // Original audio metadata or ASR tracks take precedence over translated captions.
  function speechLanguage(pr) {
    const explicit=pr?.videoDetails?.defaultAudioLanguage || pr?.microformat?.playerMicroformatRenderer?.defaultAudioLanguage;
    if (typeof explicit==='string' && explicit) return explicit;
    const tracks=pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks)) return null;
    const asr=tracks.find(track=>track.kind==='asr'&&track.languageCode);
    if (asr) return asr.languageCode;
    const codes=tracks.map(track=>track.languageCode).filter(Boolean);
    if(codes.some(code=>!/^en(?:-|$)/i.test(code)))return 'und';
    return codes[0] || null;
  }
  const api = {
    decodeEntities,
    cleanText,
    parseTimestamp,
    parseJson3,
    parseTimedTextXml,
    parseTimedText,
    findAll,
    parseInnertubeTranscript,
    parseTranscriptDom,
    pickCaptionTrack,
    speechLanguage,
  };
  Object.defineProperty(root, '__recallParse', { value: api, configurable: true });
})(typeof globalThis !== 'undefined' ? globalThis : window);
