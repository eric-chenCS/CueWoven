import test from "node:test";
import assert from "node:assert/strict";
import "../content/passage-jump.js";
const { findPassage } = globalThis.__recallPassage;

test("passage jump finds saved words despite curly quotes, dashes and edits", () => {
  const page = "Intro.\nThe reef’s coral bleaching — caused by warm‑water stress — spreads fast. Footer";
  const [start, end] = findPassage(page, "The reef's coral bleaching - caused by warm-water stress - spreads fast.");
  assert.equal(page.slice(start, end), "The reef’s coral bleaching — caused by warm‑water stress — spreads fast.");
  const edited = "The reef's coral bleaching is now caused by warm-water stress";
  assert.equal(edited.slice(...findPassage(edited, "The reef's coral bleaching caused by warm-water stress")), "The reef's coral bleaching");
  assert.equal(findPassage("Nothing related here at all.", "coral bleaching caused by warm water"), null);
  const quoted = "turning them “white.” Then";
  assert.equal(quoted.slice(...findPassage(quoted, '"turning them white."')), "turning them “white.");
  assert.equal(findPassage("anything", ""), null);
});

test('exact article jumps use surrounding context instead of the first repeated phrase', () => {
  const phrase = 'warm ocean water drives away algae';
  const page = 'Navigation: ' + phrase + ' in the menu.\nResearch: ' + phrase + ' from coral after prolonged heat stress.';
  const hit = findPassage(page, phrase, {exact: true, prefix: 'Research:', suffix: 'from coral after prolonged heat stress.'});
  assert.equal(hit[0], page.lastIndexOf(phrase));
  assert.equal(page.slice(...hit), phrase);
  assert.equal(findPassage(phrase + '. ' + phrase, phrase, {exact: true}), null, 'indistinguishable occurrences cannot claim a precise jump');
  assert.equal(findPassage('We study warm ocean water but the rest has changed.', phrase, {exact: true}), null, 'a partial four-word match is not an exact target');
  assert.equal(findPassage('Navigation: ' + phrase + ' in the menu.', phrase, {exact: true, prefix: 'Research:', suffix: 'from coral after prolonged heat stress.'}), null, 'an earlier complete phrase with different context must wait for the intended paragraph');
});

test('passage matches respect word boundaries and retain a long exact phrase', () => {
  assert.equal(findPassage('A bookmark is useful.', 'mark', {exact: true}), null);
  assert.equal(findPassage('A redwood grows here.', 'red wood', {exact: true}), null);
  const phrase = Array.from({length: 28}, (_, i) => 'word' + i).join(' ');
  assert.equal(('Intro ' + phrase).slice(...findPassage('Intro ' + phrase, phrase, {exact: true})), phrase);
});
