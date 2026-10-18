// Shared by isolated page capture and extension modules; never reads page data.
(function(root) {
  const blocked = /^(?:mail|accounts|docs|drive|calendar|meet|chat)\.google\.|(?:^|\.)(?:gmail\.com|outlook\.com|live\.com|proton\.me|protonmail\.com|icloud\.com|paypal\.com|venmo\.com|chase\.com|bankofamerica\.com|wellsfargo\.com|capitalone\.com|citi\.com|mychart\.com|epic\.com|patientportal\.com|slack\.com|discord\.com|web\.whatsapp\.com|messenger\.com|chatgpt\.com|chat\.openai\.com|notion\.so|teams\.microsoft\.com|healthcare\.gov|irs\.gov|dropbox\.com|1password\.com|myworkday\.com|workday\.com|instructure\.com|turbotax\.intuit\.com)$/i;
  const sensitive = /(?:^|[.\/_-])(?:bank|banking|health|healthcare|medical|patient|hospital|clinic|insurance|wallet|checkout|inbox|mail|webmail|email|messages|direct|messenger|login|signin|sign-in|logout|account|settings|admin|dashboard|portal|private)(?:[.\/_-]|$)/i;
  const privateRoute = /^(?:account|accounts|login|signin|sign-in|logout|settings|admin|dashboard|portal|private|inbox|mail|email|webmail|messages|direct|checkout|wallet)$/i;
  const privateDetail = /^(?:messag[^/]*|payslips?|paystubs?|grades?|gradebook|order-history|orderhistory|orders?|vaults?|myaccount|userpreferences|gp\/your-account)$/i;
  function redactText(value) {
    return String(value||'')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g,'[SSN redacted]')
      .replace(/(?<![\w])(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}(?!\d)/g,'[phone redacted]')
      .replace(/\b(?:\d[ -]?){12,18}\d\b/g,match=>{
        const digits=match.replace(/\D/g,''),reversed=[...digits].reverse();
        let sum=0;for(let i=0;i<reversed.length;i++){let n=Number(reversed[i]);if(i%2){n*=2;if(n>9)n-=9;}sum+=n;}
        return digits.length>=13&&digits.length<=19&&sum%10===0?'[card redacted]':match;
      });
  }
  const searchUrl=url=>/^(?:www\.)?google\.[a-z.]+$/i.test(url.hostname)&&url.pathname==='/search'&&url.searchParams.has('q');
  function safeUrl(value) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || value.length > 4096) return null;
      const host = url.hostname.toLowerCase();
      if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") || /^(?:\d+\.){3}\d+$/.test(host) || host.includes(":")) return null;
      const segments = decodeURIComponent(url.pathname).split("/").filter(Boolean);
      const hashSegments = /^#\//.test(url.hash) ? decodeURIComponent(url.hash.slice(2)).split(/[/?]/).filter(Boolean) : [];
      const publicRoot=/^(?:wiki|articles?|section|questions|library|docs|reference|blog|news)$/i.test(segments[0]||'');
      const checkedSegments=publicRoot?segments.slice(0,1):segments.slice(0,2);
      if (blocked.test(host) || /\.(?:gov|mil)(?:\.[a-z]{2})?$/i.test(host) || sensitive.test(host) || checkedSegments.some(part=>privateRoute.test(part)||privateDetail.test(part)) || hashSegments.slice(0,2).some(part=>privateRoute.test(part)||privateDetail.test(part))) return null;
      if(/(?:^|\.)(?:amazon\.[a-z.]+)$/i.test(host)&&/\/(?:gp\/(?:your-account|css)|your-orders)/i.test(url.pathname))return null;
      if(searchUrl(url)&&/\b(?:health|symptoms?|diagnos\w*|treatment|depression|suicid\w*|pregnan\w*|cancer|hiv|diabetes|medication|therapy)\b/i.test(url.searchParams.get('q')))return null;
      const decoded=decodeURIComponent(url.href);
      if(redactText(decoded)!==decoded)return null;
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
    return !!url && (!searchUrl(url)||settings.searches===true) && settings.enabled === true && !settings.paused && !matches(url.hostname, settings.blocked || []) && (settings.allSites === true || matches(url.hostname, settings.domains || []));
  }
  Object.defineProperty(root, "__recallWebPolicy", { value: { safeUrl, ownerId, webId, domain, matches, allowed,redactText,searchUrl }, configurable: true });
})(globalThis);
