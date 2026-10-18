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
