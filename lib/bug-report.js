// Reports leave the device only when the user sends or copies them; no sites, history or searches are included.
export const SUPPORT_EMAIL = 'support@fusilite.com';
const FEATURES = ['enabled', 'speechEnabled', 'scenesEnabled', 'screenTextEnabled', 'articleImagesEnabled', 'lightMode'];
const MAX_TEXT = 1200; // mailto links much past 2,000 characters are cut off or ignored by some email apps

export function buildReport({text, version, userAgent, storageMB, settings = {}}) {
  const description = String(text || '').trim();
  if (!description) throw new Error('Describe what happened first.');
  const shown = description.length > MAX_TEXT ? description.slice(0, MAX_TEXT) + '\n[shortened]' : description;
  const features = FEATURES.map(key => `${key}: ${settings[key] ? 'on' : 'off'}`).join(', ');
  const body = [
    'What happened:', shown, '',
    'Details:', `- CueWoven: ${version}`, `- Browser: ${userAgent}`,
    `- Storage used: ${Number.isFinite(storageMB) ? storageMB.toFixed(1) + ' MB' : 'unknown'}`, `- Features: ${features}`, '',
    'If Edge crashed, please also attach the matching entry from edge://crashes.',
  ].join('\n');
  const subject = `CueWoven problem: ${description.split('\n')[0].slice(0, 80)}`;
  // encodeURIComponent, not URLSearchParams: email apps show "+" literally instead of as a space.
  return {body, url: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`};
}
