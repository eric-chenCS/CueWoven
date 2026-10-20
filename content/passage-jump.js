// Locate saved passages locally. Exact wording is highlighted; semantic suggestions only scroll and label.
(function(root) {
  if (root.__recallPassage) return;
  // 1:1 replacements so match offsets still index the original text.
  const fold = (s) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―−]/g, "-").replace(/ /g, " ");
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // [start, end) of the longest run of passage words (at least 4) still on the page, or null.
  function findPassage(text, phrase, {prefix = "", suffix = "", exact = false} = {}) {
    const hay = fold(text), words = fold(String(phrase || "").slice(0, 500)).split(/\s+/).map((w) => w.replace(/^["'(\[]+|["')\]]+$/g, "")).filter(Boolean).slice(0, exact ? 250 : 20);
    const context = value => fold(value).toLowerCase().replace(/\s+/g, " ").trim();
    prefix = context(prefix); suffix = context(suffix);
    for (let size = words.length; size >= (exact ? words.length : Math.min(4, words.length)) && size > 0; size--)
      for (let i = 0; i + size <= words.length; i++) {
        const pattern = "(?<![\\p{L}\\p{N}_])" + words.slice(i, i + size).map(escape).join("[\\s\"'()\\[\\]]+") + "(?![\\p{L}\\p{N}_])";
        let best = null, score = -1, tied = false;
        for (const m of hay.matchAll(new RegExp(pattern, "giu"))) {
          const end = m.index + m[0].length;
          const support = Number(!!prefix && context(hay.slice(Math.max(0, m.index - 400), m.index)).endsWith(prefix)) + Number(!!suffix && context(hay.slice(end, end + 400)).startsWith(suffix));
          if (support > score) {best = [m.index, end]; score = support; tied = false;}
          else if (support === score) tied = true;
        }
        if (best) return exact && (tied || (prefix || suffix) && score === 0) ? null : best;
      }
    return null;
  }
  Object.defineProperty(root, "__recallPassage", { value: { findPassage }, configurable: true });
  if (typeof document === "undefined") return;
  const params = new URLSearchParams(location.hash.slice(1).split(":~:")[0]), phrase = params.get("recall-text");
  if (!phrase) return;
  const suggested = params.get('recall-suggest') === '1';
  let dismissed = false, marker = null, timer;
  const interactions = suggested ? new AbortController() : null;
  function dismiss() {
    dismissed = true;
    clearTimeout(timer);
    marker?.remove();
    interactions?.abort();
  }
  if (suggested) for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, dismiss, {capture: true, passive: true, signal: interactions.signal});
  function notice(message = "CueWoven couldn't find the saved passage. The page may have changed since you saved it.") {
    const box = document.createElement("div");
    box.setAttribute("role", "status");
    box.textContent = message;
    box.style.cssText = "position:fixed;z-index:2147483647;bottom:16px;left:50%;transform:translateX(-50%);max-width:calc(100% - 32px);padding:10px 14px;border-radius:8px;background:#222;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:none";
    document.body.append(box);
    if (suggested) marker = box; else setTimeout(() => box.remove(), 6e3);
    return box;
  }
  let tries = 0;
  function visible(element) {
    if (!element) return false;
    if (element.checkVisibility?.({checkOpacity: true, checkVisibilityCSS: true}) !== false) return true;
    // display:contents has no box, but its descendants can still be visible.
    const style = getComputedStyle(element);
    return style.display === 'contents' && !['hidden', 'collapse'].includes(style.visibility) && Number(style.opacity) !== 0 && visible(element.parentElement);
  }
  function attempt() {
    if (dismissed) return;
    const nodes = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => {
      const element = n.nodeType === Node.TEXT_NODE ? n.parentElement : n;
      return element?.closest("script,style,noscript,template") || !visible(element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } });
    let text = "", previousBlock = null;
    for (let n; (n = walker.nextNode()); ) {
      if (n.nodeType !== Node.TEXT_NODE) {if (n.nodeName === 'BR') text += "\n";continue;}
      // Adjacent paragraphs need a word boundary; inline elements retain their original spacing.
      const block = n.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li,div,section,article,main,header,footer,nav,aside,td,th,blockquote,pre');
      if (nodes.length && block !== previousBlock) text += "\n";
      nodes.push([n, text.length]);
      text += n.data;
      previousBlock = block;
    }
    const hit = findPassage(text, phrase, {prefix: params.get('recall-prefix') || '', suffix: params.get('recall-suffix') || '', exact: params.get('recall-exact') === '1'});
    // Late-rendering pages get a few more chances before we say it's gone.
    if (!hit) return ++tries < 4 ? timer = setTimeout(attempt, 1e3 * tries) : notice();
    const at = (offset, end = false) => {
      let k = nodes.length - 1;
      while (k > 0 && (end ? nodes[k][1] >= offset : nodes[k][1] > offset)) k--;
      return [nodes[k][0], Math.min(nodes[k][0].length, offset - nodes[k][1])];
    };
    const range = document.createRange();
    range.setStart(...at(hit[0]));
    range.setEnd(...at(hit[1], true));
    const box = range.getBoundingClientRect();
    if (box.top < 0 || box.bottom > innerHeight) range.startContainer.parentElement?.scrollIntoView({ block: "center", behavior: 'instant' });
    // Boxless wrappers cannot scrollIntoView; position the actual matched text instead.
    const position = range.getBoundingClientRect();
    if (position.top < 0 || position.bottom > innerHeight) scrollBy({top: position.top - Math.max(0, (innerHeight - position.height) / 2), behavior: 'instant'});
    if (suggested) {
      notice('Suggested section · Similar in meaning').dataset.cuewovenSuggestion = '';
      // Ignore the scroll caused by our own jump, then dismiss on subsequent page scrolling.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!dismissed) addEventListener('scroll', dismiss, {capture: true, passive: true, signal: interactions.signal});
      }));
    } else if (root.CSS?.highlights && root.Highlight) {
      const style = document.createElement("style");
      style.textContent = "::highlight(cuewoven-passage){background:#ffe066;color:#000}";
      document.head.append(style);
      CSS.highlights.set("cuewoven-passage", new Highlight(range));
    }
  }
  // Let the browser's own text-fragment scroll run first.
  const start = () => {if (!dismissed) timer = setTimeout(attempt, 300);};
  document.readyState === "complete" ? start() : addEventListener("load", start, { once: true });
})(globalThis);
