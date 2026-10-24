// Shared by isolated page capture and extension modules; never reads page data.
(function(root) {
  const blocked = /^(?:mail|accounts|docs|drive|calendar|meet|chat)\.google\.|(?:^|\.)(?:gmail\.com|outlook\.com|live\.com|proton\.me|protonmail\.com|icloud\.com|paypal\.com|venmo\.com|chase\.com|bankofamerica\.com|wellsfargo\.com|capitalone\.com|citi\.com|mychart\.com|epic\.com|patientportal\.com|slack\.com|discord\.com|web\.whatsapp\.com|messenger\.com|chatgpt\.com|chat\.openai\.com|notion\.so|teams\.microsoft\.com|healthcare\.gov|irs\.gov|dropbox\.com|1password\.com|myworkday\.com|workday\.com|instructure\.com|turbotax\.intuit\.com)$/i;
  const sensitive = /(?:^|[.\/_-])(?:bank|banking|health|healthcare|medical|patient|hospital|clinic|insurance|wallet|checkout|inbox|mail|webmail|email|messages|direct|messenger|login|signin|sign-in|logout|account|settings|admin|dashboard|portal|private)(?:[.\/_-]|$)/i;
  const privateRoute = /^(?:account|accounts|login|signin|sign-in|logout|settings|admin|dashboard|portal|private|inbox|mail|email|webmail|messages|direct|checkout|wallet)$/i;
  const privateDetail = /^(?:messag[^/]*|payslips?|paystubs?|grades?|gradebook|order-history|orderhistory|orders?|vaults?|myaccount|userpreferences|gp\/your-account)$/i;
  const authenticationHost = /(?:^|\.)(?:duosecurity\.com|duo\.com|okta\.com|okta-emea\.com|auth0\.com|onelogin\.com|pingidentity\.com|login\.microsoftonline\.com|login\.live\.com|blackboard\.com|brightspace\.com|powerschool\.com)$/i;
  const authenticationPart = /^(?:auth|authenticate|authentication|authorize|authorization|sso|saml|saml2|oauth|oauth2|oidc|mfa|2fa|otp|idp|adfs|cas|shibboleth|shibboleth\.sso|duo|verify|verification|security-check|security-challenge)$/i;
  function redactText(value) {
    return String(value||'')
      .replace(/-----BEGIN ((?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY)-----[\s\S]*?-----END \1-----/g,'[private key redacted]')
      .replace(/\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[A-Za-z0-9_-]{35}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,})\b/g,'[API key redacted]')
      .replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{10,}\b/g,'[token redacted]')
      .replace(/\b(?:authorization|proxy-authorization)["']?\s*[:=]\s*["']?(?:Bearer|Basic)\s+[A-Za-z0-9._~+\/-]{12,}={0,2}/gi,'[authorization redacted]')
      .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}/gi,'[token redacted]')
      .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password)["']?\s*[:=]\s*["']?[A-Za-z0-9._~+\/-]{12,}={0,2}/gi,'[secret redacted]')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g,'[SSN redacted]')
      .replace(/(?<![\w])(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}(?!\d)/g,'[phone redacted]')
      .replace(/\b(?:\d[ -]?){12,18}\d\b/g,match=>{
        const digits=match.replace(/\D/g,''),reversed=[...digits].reverse();
        let sum=0;for(let i=0;i<reversed.length;i++){let n=Number(reversed[i]);if(i%2){n*=2;if(n>9)n-=9;}sum+=n;}
        return digits.length>=13&&digits.length<=19&&sum%10===0?'[card redacted]':match;
      });
  }
  // Search result pages from major engines: [host, path, query parameter]. All follow the one "Save my web searches" setting.
  const engines=[[/^(?:www\.)?google\.[a-z.]+$/i,/^\/search$/,'q'],[/^(?:www\.|cn\.)?bing\.com$/i,/^\/(?:(?:images|videos|news|shop)\/)?search$/,'q'],[/^(?:html\.|lite\.)?duckduckgo\.com$/i,/^\/(?:html\/?|lite\/?)?$/,'q'],[/^(?:[a-z]+\.)*search\.yahoo\.com$/i,/^\/search/,'p'],[/^search\.brave\.com$/i,/^\/(?:(?:images|videos|news)\/)?search$/,'q'],[/^(?:www\.)?ecosia\.org$/i,/^\/(?:(?:images|videos|news)\/)?search$/,'q']];
  const searchKey=url=>engines.find(([host,path,key])=>host.test(url.hostname)&&path.test(url.pathname)&&url.searchParams.has(key))?.[2]||null;
  const searchUrl=url=>!!searchKey(url);
  const searchQuery=url=>{const key=searchKey(url);return key?url.searchParams.get(key):null;};
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
      if (authenticationHost.test(host) || host.split('.').some(part=>authenticationPart.test(part)) || [...checkedSegments,...hashSegments.slice(0,2)].some(part=>authenticationPart.test(part))) return null;
      if (blocked.test(host) || /\.(?:gov|mil)(?:\.[a-z]{2})?$/i.test(host) || sensitive.test(host) || checkedSegments.some(part=>privateRoute.test(part)||privateDetail.test(part)) || hashSegments.slice(0,2).some(part=>privateRoute.test(part)||privateDetail.test(part))) return null;
      if(/(?:^|\.)(?:amazon\.[a-z.]+)$/i.test(host)&&/\/(?:gp\/(?:your-account|css)|your-orders)/i.test(url.pathname))return null;
      if(searchUrl(url)&&/\b(?:health|symptoms?|diagnos\w*|treatment|depression|suicid\w*|pregnan\w*|cancer|hiv|diabetes|medication|therapy)\b/i.test(searchQuery(url)))return null;
      const decoded=decodeURIComponent(url.href);
      if(redactText(decoded)!==decoded)return null;
      for (const key of url.searchParams.keys()) if (/^(?:access_token|refresh_token|id_token|token|api_key|apikey|client_secret|sig|signature|auth|authorization|password|secret|session|session_id|sid|code|SAMLRequest|SAMLResponse|ticket|wresult|ssn|credit_card)$/i.test(key)) return null;
      for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|fbclid$|gclid$|igsh$)/i.test(key)) url.searchParams.delete(key);
      if (/(?:^|[&#])(?:access_token|id_token|token|password|secret)=/i.test(url.hash)) return null;
      const key = searchKey(url);
      if (key) url.search = "?" + key + "=" + encodeURIComponent(url.searchParams.get(key));
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
  Object.defineProperty(root, "__recallWebPolicy", { value: { safeUrl, ownerId, webId, domain, matches, allowed,redactText,searchUrl,searchQuery }, configurable: true });
})(globalThis);
