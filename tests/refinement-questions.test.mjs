import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refinementQuestions} from '../lib/refinement-questions.js';

test('car queries ask about the remembered vehicle without supplying an answer', () => {
 const questions=refinementQuestions('that video of a car');
 assert.equal(questions.primary,'What was the car doing?');
 assert.equal(questions.screen,'Do you remember the color or surroundings of the car?');
 assert.match(questions.said,/“car”/);assert.match(questions.source,/“car”/);assert.match(questions.when,/“car”/);
 assert.ok(Object.values(questions).every(question=>question.endsWith('?')));
 assert.ok(!Object.values(questions).some(question=>/red|crash|fast/i.test(question)));
});
test('provided colors and actions change the follow-up rather than asking for them again', () => {
 const questions=refinementQuestions('a red car flipping over on a wet track');
 assert.equal(questions.primary,'What else happened around the car?');
 assert.match(questions.screen,/What else was around the car/);
 assert.ok(!questions.screen.includes('color'));
});
test('vehicle singular and plural questions use word boundaries and correct grammar', () => {
 for(const vehicle of ['car','truck','bike','motorcycle','train','plane','boat','bus'])assert.equal(refinementQuestions(vehicle).primary,`What was the ${vehicle} doing?`);
 for(const vehicle of ['cars','trucks','bikes','motorcycles','trains','planes','boats','buses'])assert.equal(refinementQuestions(vehicle).primary,`What were the ${vehicle} doing?`);
 for(const word of ['carpet','scar','training','business'])assert.ok(!refinementQuestions(word).primary.includes('doing'));
});
test('speaker and article questions reference the search topic', () => {
 const speaker=refinementQuestions('the speaker calling himselve old and having back pain');
 assert.equal(speaker.primary,speaker.said);assert.match(speaker.primary,/old.*back pain/);assert.ok(!speaker.primary.includes('car'));
 assert.match(refinementQuestions('the article about coral bleaching').primary,/point or example.*coral bleaching/);
});
test('unrecognized topics and Unicode stay tied to the query without needing a model', () => {
 for(const topic of ['sourdough','quantum entanglement','猫','café']){
  const questions=refinementQuestions(topic);assert.match(questions.primary,/What else do you remember about/);
  assert.ok(!Object.values(questions).some(question=>/car|lithium|Veritasium|TikTok/.test(question)));
 }
 assert.ok(refinementQuestions('猫').primary.includes('猫'));
});
test('wrapper-only and missing queries get answerable neutral questions', () => {
 for(const query of [undefined,null,'','that video','the article']){
  const questions=refinementQuestions(query);assert.ok(!Object.values(questions).some(question=>question.includes('“”')||question.includes('undefined')||question.includes('null')));
 }
 assert.equal(refinementQuestions('that video').primary,'What do you remember seeing or hearing?');
});
test('negated subjects keep a neutral topic question instead of assuming the excluded vehicle', () => {
 for(const query of ['not a car, a truck','a video without cars','it wasn’t a car']) {
  assert.match(refinementQuestions(query).primary,/What else do you remember about/);
  assert.ok(!refinementQuestions(query).screen.includes('color or surroundings'));
 }
});
test('long or hostile query text is bounded and cannot become executable markup', () => {
 const questions=refinementQuestions('<img src=x onerror=alert(1)> '+'a'.repeat(3000));
 assert.ok(Object.values(questions).every(question=>question.length<150&&!/[<>]/.test(question)));
});
