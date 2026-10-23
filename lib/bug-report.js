// Reports leave the device only when the user opens or copies them; no sites, history or searches are included.
export const ISSUES_URL = 'https://github.com/eric-chenCS/CueWoven/issues/new';
const FEATURES = ['enabled', 'speechEnabled', 'scenesEnabled', 'screenTextEnabled', 'articleImagesEnabled', 'lightMode'];
const MAX_TEXT = 4000; // keeps the prefilled issue URL well under browser and GitHub limits

export function buildReport({text, version, userAgent, storageMB, settings = {}}) {
  const description = String(text || '').trim();
  if (!description) throw new Error('Describe what happened first.');
  const shown = description.length > MAX_TEXT ? description.slice(0, MAX_TEXT) + '\n[shortened]' : description;
  const features = FEATURES.map(key => `${key}: ${settings[key] ? 'on' : 'off'}`).join(', ');
  const body = [
    '### What happened', shown, '',
    '### Details', `- CueWoven: ${version}`, `- Browser: ${userAgent}`,
    `- Storage used: ${Number.isFinite(storageMB) ? storageMB.toFixed(1) + ' MB' : 'unknown'}`, `- Features: ${features}`, '',
    'If Edge crashed, please also attach the matching entry from edge://crashes.',
  ].join('\n');
  const title = `Bug: ${description.split('\n')[0].slice(0, 80)}`;
  return {body, url: `${ISSUES_URL}?${new URLSearchParams({title, body})}`};
}
