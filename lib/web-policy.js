// Shared by isolated page capture and extension modules; never reads page data.
(function(root) {
  const blocked = /^(?:mail|accounts|docs|drive|calendar|meet|chat)\.google\.|(?:^|\.)(?:gmail\.com|outlook\.com|live\.com|proton\.me|protonmail\.com|icloud\.com|paypal\.com|venmo\.com|chase\.com|bankofamerica\.com|wellsfargo\.com|capitalone\.com|citi\.com|mychart\.com|epic\.com|patientportal\.com|slack\.com|discord\.com|web\.whatsapp\.com|messenger\.com|chatgpt\.com|chat\.openai\.com|notion\.so|teams\.microsoft\.com|healthcare\.gov|irs\.gov)$/i;
  const sensitive = /(?:^|[.\/_-])(?:bank|banking|health|healthcare|medical|patient|hospital|clinic|insurance|wallet|checkout|inbox|mail|webmail|email|messages|direct|messenger|login|signin|sign-in|logout|account|settings|admin|dashboard|portal|private)(?:[.\/_-]|$)/i;
  function safeUrl(value) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || value.length > 4096) return null;
      const host = url.hostname.toLowerCase();
      if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") || /^(?:\d+\.){3}\d+$/.test(host) || host.includes(":")) return null;
      if (blocked.test(host) || /\.(?:gov|mil)(?:\.[a-z]{2})?$/i.test(host) || sensitive.test(host + url.pathname + url.hash)) return null;
      for (const key of url.searchParams.keys()) if (/^(?:access_token|id_token|token|auth|authorization|password|secret|session|session_id|sid|code|ssn|credit_card)$/i.test(key)) return null;
      for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|fbclid$|gclid$|igsh$)/i.test(key)) url.searchParams.delete(key);
      if (/(?:^|[&#])(?:access_token|id_token|token|password|secret)=/i.test(url.hash)) return null;
      if (/^(?:www\.)?google\.[a-z.]+$/i.test(host) && url.pathname === "/search" && url.searchParams.has("q")) url.search = "?q=" + encodeURIComponent(url.searchParams.get("q"));
      url.hash = "";
      return url;
    } catch {
      return null;
    }
  }
  const ownerId = (id) => typeof id === "string" && (/^[\w-]{11}$/.test(id) || /^web_[a-f0-9]{64}$/.test(id));
  const webId = (id) => typeof id === "string" && /^web_[a-f0-9]{64}$/.test(id);
  const domain = (value) => {
    try {
      const url = new URL(value.includes("://") ? value : "https://" + value);
      if (url.pathname !== "/" || url.search || url.hash || url.port) return null;
      return safeUrl(url.href)?.hostname || null;
    } catch {
      return null;
    }
  };
  const matches = (host, domains) => domains.some((site) => host === site || host.endsWith("." + site));
  function allowed(value, settings = {}) {
    const url = safeUrl(value);
    return !!url && settings.enabled === true && !settings.paused && !matches(url.hostname, settings.blocked || []) && (settings.allSites === true || matches(url.hostname, settings.domains || []));
  }
  Object.defineProperty(root, "__recallWebPolicy", { value: { safeUrl, ownerId, webId, domain, matches, allowed }, configurable: true });
})(globalThis);
