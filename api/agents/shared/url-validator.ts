// ============================================================================
// SHARED URL VALIDATOR
// Verifies URLs returned by agents are real and not hallucinated/parked
// Used by Bridge, Beacon, and Amplify to enforce the actionable-links tenet
// ============================================================================

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Known parking/marketplace domains — if a URL redirects to these, it's parked
const PARKING_DOMAINS = [
  'godaddy.com',
  'sedo.com',
  'dan.com',
  'hugedomains.com',
  'parkingcrew.net',
  'sav.com',
  'undeveloped.com',
  'afternic.com',
  'parked-content.com',
  'bodis.com',
];

// Body content indicators that strongly suggest a parking page
const PARKING_INDICATORS = [
  'domain is for sale',
  'buy this domain',
  'this domain may be for sale',
  'forsale.godaddy',
  'this domain is parked',
  'domain parking',
  'domain marketplace',
];

const TIMEOUT_MS = 8000;
const USER_AGENT = 'Mozilla/5.0 (compatible; PodcastGrowthAgent/1.0; +https://podcastgrowthagent.com)';

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        ...(init.headers || {}),
      },
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function validateUrl(url: string): Promise<ValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'malformed_url' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Platform-specific routing
  if (hostname.includes('reddit.com')) {
    return validateReddit(parsed);
  }
  if (hostname.includes('podcasts.apple.com')) {
    return validateStatusOnly(url);
  }
  if (hostname.includes('open.spotify.com')) {
    return validateStatusOnly(url);
  }
  if (hostname === 'medium.com' || hostname.endsWith('.medium.com')) {
    return validateMedium(url);
  }
  if (hostname.endsWith('.substack.com') || hostname === 'substack.com') {
    return validateStatusOnly(url);
  }
  if (hostname.includes('facebook.com') || hostname.includes('linkedin.com') || hostname.includes('discord.gg') || hostname.includes('discord.com')) {
    return validateBestEffort(url);
  }

  // Generic indie website: full parking-page detection
  return validateGenericWebsite(url);
}

// Reddit: pattern-only validation
// Reddit aggressively blocks server-side requests from cloud IPs (Vercel),
// which made network validation hang and falsely fail every URL.
// Reddit's URL pattern is highly predictable, so we trust the pattern instead.
async function validateReddit(parsed: URL): Promise<ValidationResult> {
  const path = parsed.pathname;
  // Match /r/[name] or /r/[name]/ — alphanumerics and underscores only
  const pattern = /^\/r\/[a-zA-Z0-9_]{2,21}\/?$/;
  if (pattern.test(path)) {
    return { valid: true };
  }
  return { valid: false, reason: 'reddit_url_pattern_invalid' };
}

// Status-only check: HEAD request, accept any 2xx/3xx
async function validateStatusOnly(url: string): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' });
    if (response.status >= 200 && response.status < 400) {
      return { valid: true };
    }
    return { valid: false, reason: `http_${response.status}` };
  } catch (err: any) {
    return { valid: false, reason: `network_error: ${err.message}` };
  }
}

// Medium: returns 403 to scrapers but real publications still respond
// Only filter on hard 404
async function validateMedium(url: string): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' });
    if (response.status === 404) {
      return { valid: false, reason: 'medium_publication_not_found' };
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `network_error: ${err.message}` };
  }
}

// Best-effort for platforms that block scraping (Facebook, LinkedIn, Discord)
async function validateBestEffort(url: string): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' });
    if (response.status === 404) {
      return { valid: false, reason: 'page_not_found' };
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `network_error: ${err.message}` };
  }
}

// Generic indie website: full validation including parking detection
async function validateGenericWebsite(url: string): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(url, { method: 'GET' });

    if (response.status === 404) {
      return { valid: false, reason: 'not_found' };
    }
    if (response.status >= 500) {
      return { valid: false, reason: `http_${response.status}` };
    }

    // Check final URL after redirects for parking marketplace domains
    const finalHostname = new URL(response.url).hostname.toLowerCase();
    for (const parkingDomain of PARKING_DOMAINS) {
      if (finalHostname.includes(parkingDomain)) {
        return { valid: false, reason: `redirected_to_parked: ${finalHostname}` };
      }
    }

    // Read body and check for parking page indicators
    const body = await response.text();
    const bodyLower = body.toLowerCase();

    for (const indicator of PARKING_INDICATORS) {
      if (bodyLower.includes(indicator)) {
        return { valid: false, reason: `parking_indicator: ${indicator}` };
      }
    }

    // Catch the JS-redirect-to-lander pattern (Burnout Doctor case)
    if (body.length < 600 && bodyLower.includes('window.location') && bodyLower.includes('lander')) {
      return { valid: false, reason: 'js_redirect_to_lander' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `network_error: ${err.message}` };
  }
}

// Convenience: filter an array of items by validating one URL field per item
// Logs each rejection for monitoring
export async function filterByValidUrls<T>(
  items: T[],
  getUrl: (item: T) => string,
  agentName: string
): Promise<T[]> {
  if (items.length === 0) return items;

  const results = await Promise.all(items.map(item => validateUrl(getUrl(item))));

  const filtered: T[] = [];
  results.forEach((result, i) => {
    if (result.valid) {
      filtered.push(items[i]);
    } else {
      console.log(`🚫 [${agentName}] Filtered URL: ${getUrl(items[i])} — reason: ${result.reason}`);
    }
  });

  return filtered;
}
