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

export function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
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
