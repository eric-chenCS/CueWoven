import {queryTerms} from './search.js';

// Questions use only the submitted query; they never assert details from a guessed result.
export function refinementQuestions(query) {
  const text = String(query || '').slice(0, 2000);
  const terms = queryTerms(text).filter(term => !['find', 'remember', 'watched', 'watching', 'saw', 'search', 'speaker', 'calling', 'himself', 'himselve', 'article', 'page'].includes(term));
  const topic = terms.slice(0, 8).join(' ').slice(0, 72), about = topic ? `“${topic}”` : 'this';
  const questions = {
    said: topic ? `Do you remember any exact words related to ${about}?` : 'Do you remember any words that were said or written?',
    screen: topic ? `What stood out on screen about ${about}?` : 'What do you remember seeing on screen?',
    source: topic ? `Do you remember the channel or site for ${about}?` : 'Which channel or site do you remember?',
    when: `When did you see ${about}?`,
    primary: topic ? `What else do you remember about ${about}?` : 'What do you remember seeing or hearing?',
  };
  // Keep negated memories neutral instead of treating an excluded subject as the target.
  if (/\b(?:not|no|without|isn't|wasn't|aren't|weren't)\b/i.test(text.replace(/’/g, "'"))) return questions;
  const vehicle = terms.find(term => /^(?:cars?|trucks?|bikes?|motorcycles?|trains?|planes?|boats?|bus|buses)$/.test(term));
  if (vehicle) {
    const plural = /^(?:cars|trucks|bikes|motorcycles|trains|planes|boats|buses)$/.test(vehicle);
    const action = terms.some(term => /^(?:driv(?:e|es|ing)|drift(?:s|ed|ing)?|flip(?:s|ped|ping)?|crash(?:es|ed|ing)?|park(?:s|ed|ing)?|rac(?:e|es|ing)|jump(?:s|ed|ing)?)$/.test(term));
    questions.primary = action ? `What else happened around the ${vehicle}?` : `What ${plural ? 'were' : 'was'} the ${vehicle} doing?`;
    questions.screen = terms.some(term => /^(?:red|blue|green|yellow|black|white|silver|gray|grey|orange|purple|pink|brown)$/.test(term))
      ? `What else was around the ${vehicle}, or where did you see ${plural ? 'them' : 'it'}?`
      : `Do you remember the color or surroundings of the ${vehicle}?`;
  } else if (/\b(?:speaker|speakers|interview|podcast|said|saying)\b/i.test(text)) {
    questions.primary = questions.said;
  } else if (/\b(?:article|paper|blog|read)\b/i.test(text)) {
    questions.primary = topic ? `What point or example do you remember reading about ${about}?` : 'What point or example do you remember reading?';
  }
  return questions;
}
