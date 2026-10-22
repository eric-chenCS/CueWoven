import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasSearchDetail} from '../lib/search-input.js';

test('punctuation, whitespace and common filler-only queries do not submit a search', () => {
 for (const query of ['', '   ', '...', '?! —', '“”', '"..."', 'that', 'or', 'I', 'THE', 'that or I', 'i’m', "it's", 'ｔｈａｔ', 'this and that', 'who is it']) assert.equal(hasSearchDetail(query),false,query);
});
test('meaningful single words and short names remain searchable without a length gate', () => {
 for (const query of ['car', 'Minecraft', 'photosynthesis', 'open', 'AI', 'VR', 'x', 'C++', 'R', '猫', 'café', '2026', '42', 'video', 'someone said open', 'that car', 'the I robot movie']) assert.equal(hasSearchDetail(query),true,query);
});
test('balanced double quotes allow explicit searches for filler words but not punctuation', () => {
 for (const query of ['"I"', '"or"', '“that”', 'the word "the"', '"that or I"']) assert.equal(hasSearchDetail(query),true,query);
 for (const query of ['"..."','“?!”','"  "','"that','that"']) assert.equal(hasSearchDetail(query),false,query);
});
test('user-written details can make a filler base query meaningful', () => {
 assert.equal(hasSearchDetail('that. red car'),true);
 assert.equal(hasSearchDetail('that. or it'),false);
 assert.equal(hasSearchDetail(undefined),false);assert.equal(hasSearchDetail(null),false);
});
