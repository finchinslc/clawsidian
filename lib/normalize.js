/**
 * URL normalization for duplicate detection and storage.
 * Strips tracking params, normalizes protocol/host, removes fragments.
 */

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'source', 'smid', 'fbclid', 'gclid', 'mc_cid', 'mc_eid',
  'ocid', 'icid', 'ncid', 'sr_share', '_hsenc', '_hsmi',
]);

export function normalizeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Force https
  url.protocol = 'https:';

  // Remove www prefix
  url.hostname = url.hostname.replace(/^www\./, '');

  // Lowercase hostname
  url.hostname = url.hostname.toLowerCase();

  // Strip tracking query params
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) {
      url.searchParams.delete(key);
    }
  }

  // Remove fragment
  url.hash = '';

  // Build clean URL and remove trailing slash (but keep root /)
  let result = url.toString();
  if (result.endsWith('/') && url.pathname !== '/') {
    result = result.slice(0, -1);
  }

  return result;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost', '0.0.0.0', '[::1]', '[::0]',
]);

const PRIVATE_IP_PATTERNS = [
  /^127\./,                         // 127.0.0.0/8 loopback
  /^10\./,                          // 10.0.0.0/8 private
  /^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12 private
  /^192\.168\./,                    // 192.168.0.0/16 private
  /^169\.254\./,                    // 169.254.0.0/16 link-local
  /^0\./,                           // 0.0.0.0/8
  /^\[?::1\]?$/,                    // IPv6 loopback
  /^\[?fe80:/i,                     // IPv6 link-local
  /^\[?fc/i,                        // IPv6 unique local
  /^\[?fd/i,                        // IPv6 unique local
];

const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost', '.arpa'];

export function isValidUrl(str) {
  try {
    const url = new URL(str);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) return false;
    if (BLOCKED_SUFFIXES.some(suffix => hostname.endsWith(suffix))) return false;
    if (PRIVATE_IP_PATTERNS.some(re => re.test(hostname))) return false;

    // Block numeric IP representations (decimal, hex, octal encodings)
    if (/^\d+$/.test(hostname)) return false;
    if (/^0x[0-9a-f]+$/i.test(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

export function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}
