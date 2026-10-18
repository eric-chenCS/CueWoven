// Sites Recall suggests for website saving. They hold mostly public articles and posts;
// private routes on them (messages, settings, accounts) are still skipped by web-policy.js.
export const SUGGESTED_SITES = Object.freeze({
  News: ["nytimes.com", "washingtonpost.com", "theguardian.com", "bbc.com", "cnn.com", "reuters.com", "apnews.com", "npr.org", "bloomberg.com", "theverge.com", "arstechnica.com", "wired.com", "techcrunch.com"],
  Reference: ["wikipedia.org", "britannica.com", "wikihow.com", "stackoverflow.com", "stackexchange.com", "medium.com", "substack.com", "quora.com"],
  Social: ["reddit.com", "x.com", "twitter.com", "instagram.com", "tiktok.com", "threads.net", "bsky.app", "tumblr.com", "pinterest.com"],
});

export const DEFAULT_DOMAINS = Object.freeze(Object.values(SUGGESTED_SITES).flat());

// Which suggested group a site belongs to; anything else was added by the user.
export function siteGroup(domain) {
  for (const [group, sites] of Object.entries(SUGGESTED_SITES)) if (sites.includes(domain)) return group;
  return "Added by you";
}

// Host permission patterns for a list of sites, matching the ones web-access.js registers.
export const siteOrigins = (domains) => domains.flatMap((site) => [`https://*.${site}/*`, `http://*.${site}/*`]);
