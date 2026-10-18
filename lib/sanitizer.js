// lib/sanitizer.js
// Strips API keys, tokens, SSNs, credit cards, and sensitive URL parameters before storage.

const SECRET_PATTERNS = [
  // Common API Keys (OpenAI, GitHub, AWS, Slack, Google Cloud, Stripe)
  {
    name: 'API_KEY',
    regex: /\b(?:sk-[a-zA-Z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{36,}|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9a-zA-Z-]{10,}|AIza[0-9A-Za-z-_]{35}|(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,})\b/g
  },
  // JSON Web Tokens (JWTs)
  {
    name: 'JWT',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
  },
  // Private Keys (SSH / RSA / PEM blocks)
  {
    name: 'PRIVATE_KEY',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  },
  // Bearer / Authorization Tokens in code or headers
  {
    name: 'AUTH_TOKEN',
    regex: /\b(?:Bearer|Authorization|api[_-]?key|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_\-\.~+/]{12,}["']?/gi
  },
  // US Social Security Numbers
  {
    name: 'SSN',
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g
  },
  // Credit Card Numbers (13 to 19 digits)
  {
    name: 'CREDIT_CARD',
    regex: /\b(?:\d[ -]*?){13,19}\b/g
  }
];

// Checks if a 13-19 digit number is a real credit card (prevents redacting random timestamps/IDs)
function isValidCreditCard(numStr) {
  const digits = numStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Scrubs sensitive secrets and PII out of any captured webpage text, transcript, or OCR string.
 */
export function sanitizeText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let cleaned = rawText;

  for (const { name, regex } of SECRET_PATTERNS) {
    if (name === 'CREDIT_CARD') {
      cleaned = cleaned.replace(regex, (match) =>
        isValidCreditCard(match) ? `[REDACTED_${name}]` : match
      );
    } else {
      cleaned = cleaned.replace(regex, `[REDACTED_${name}]`);
    }
  }
  return cleaned;
}

/**
 * Strips session tokens, OAuth codes, and API keys from URLs before saving to IndexedDB.
 */
export function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    const sensitiveParamRegex = /^(token|access_token|id_token|refresh_token|code|state|session|session_id|key|api_key|auth|sig|signature|password|secret)$/i;

    for (const key of [...parsed.searchParams.keys()]) {
      if (sensitiveParamRegex.test(key)) {
        parsed.searchParams.set(key, 'REDACTED');
      }
    }
    // Also strip sensitive tokens placed in URL hashes (e.g., #access_token=...)
    if (parsed.hash && /(access_token|id_token|token|key)=/i.test(parsed.hash)) {
      parsed.hash = '';
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}