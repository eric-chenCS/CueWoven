// Result links carry #recall-text=<passage>; if the browser's text fragment missed (page edits, quotes, dashes), find, scroll to and highlight the passage here. Page text never leaves the tab.
(function(root) {
  if (root.__recallPassage) return;
  // 1:1 replacements so match offsets still index the original text.
  const fold = (s) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―−]/g, "-").replace(/ /g, " ");
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // [start, end) of the longest run of passage words (at least 4) still on the page, or null.
  function findPassage(text, phrase) {
    const hay = fold(text), words = fold(String(phrase || "")).split(/\s+/).map((w) => w.replace(/^["'(\[]+|["')\]]+$/g, "")).filter(Boolean).slice(0, 20);
    for (let size = words.length; size >= Math.min(4, words.length) && size > 0; size--)
      for (let i = 0; i + size <= words.length; i++) {
        const m = new RegExp(words.slice(i, i + size).map(escape).join("[\\s\"'()\\[\\]]*"), "i").exec(hay);
        if (m) return [m.index, m.index + m[0].length];
      }
    return null;
  }
  Object.defineProperty(root, "__recallPassage", { value: { findPassage }, configurable: true });
  if (typeof document === "undefined") return;
  const phrase = new URLSearchParams(location.hash.slice(1).split(":~:")[0]).get("recall-text");
  if (!phrase) return;
  function notice() {
    const box = document.createElement("div");
    box.setAttribute("role", "status");
    box.textContent = "CueWoven couldn't find the saved passage. The page may have changed since you saved it.";
    box.style.cssText = "position:fixed;z-index:2147483647;bottom:16px;left:50%;transform:translateX(-50%);max-width:calc(100% - 32px);padding:10px 14px;border-radius:8px;background:#222;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)";
    document.body.append(box);
    setTimeout(() => box.remove(), 6e3);
  }
  let tries = 0;
  function attempt() {
    const nodes = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.parentElement?.closest("script,style,noscript,template") || n.parentElement?.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) === false ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let text = "";
    for (let n; (n = walker.nextNode()); ) {
      nodes.push([n, text.length]);
      text += n.data;
    }
    const hit = findPassage(text, phrase);
    // Late-rendering pages get a few more chances before we say it's gone.
    if (!hit) return ++tries < 4 ? setTimeout(attempt, 1e3 * tries) : notice();
    const at = (offset) => {
      let k = nodes.length - 1;
      while (k > 0 && nodes[k][1] > offset) k--;
      return [nodes[k][0], offset - nodes[k][1]];
    };
    const range = document.createRange();
    range.setStart(...at(hit[0]));
    range.setEnd(...at(hit[1]));
    const box = range.getBoundingClientRect();
    if (box.top < 0 || box.bottom > innerHeight) range.startContainer.parentElement?.scrollIntoView({ block: "center" });
    if (root.CSS?.highlights && root.Highlight) {
      const style = document.createElement("style");
      style.textContent = "::highlight(cuewoven-passage){background:#ffe066;color:#000}";
      document.head.append(style);
      CSS.highlights.set("cuewoven-passage", new Highlight(range));
    }
  }
  // Let the browser's own text-fragment scroll run first.
  const start = () => setTimeout(attempt, 300);
  document.readyState === "complete" ? start() : addEventListener("load", start, { once: true });
})(globalThis);
