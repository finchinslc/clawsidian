/**
 * Extract and structure metadata from fetcher results.
 * Handles source name derivation, author cleanup, and date parsing.
 */

import { extractDomain } from './normalize.js';

const KNOWN_SOURCES = {
  'nytimes.com': 'New York Times',
  'washingtonpost.com': 'Washington Post',
  'theguardian.com': 'The Guardian',
  'arstechnica.com': 'Ars Technica',
  'techcrunch.com': 'TechCrunch',
  'theverge.com': 'The Verge',
  'wired.com': 'Wired',
  'bbc.com': 'BBC',
  'bbc.co.uk': 'BBC',
  'reuters.com': 'Reuters',
  'apnews.com': 'Associated Press',
  'bloomberg.com': 'Bloomberg',
  'forbes.com': 'Forbes',
  'cnbc.com': 'CNBC',
  'cnn.com': 'CNN',
  'x.com': 'X (Twitter)',
  'twitter.com': 'X (Twitter)',
  'github.com': 'GitHub',
  'medium.com': 'Medium',
  'substack.com': 'Substack',
  'reddit.com': 'Reddit',
  'stackoverflow.com': 'Stack Overflow',
  'dev.to': 'DEV Community',
  'hackernews.com': 'Hacker News',
  'news.ycombinator.com': 'Hacker News',
  'arxiv.org': 'arXiv',
  'nature.com': 'Nature',
  'science.org': 'Science',
  'wikipedia.org': 'Wikipedia',
  'youtube.com': 'YouTube',
};

export function extractMetadata(fetchResult, originalUrl) {
  const { article, meta, finalUrl } = fetchResult;

  const title = article.title
    || meta.ogTitle
    || meta.titleTag
    || meta.h1
    || null;

  const author = cleanAuthor(article.byline || meta.ogAuthor);

  const source = deriveSource(finalUrl || originalUrl, meta.ogSiteName);

  const published = parseDate(
    meta.ogPublished || meta.timeDatetime
  );

  return { title, author, source, published };
}

function cleanAuthor(raw) {
  if (!raw) return null;
  // Strip common prefixes
  let cleaned = raw.replace(/^by\s+/i, '').trim();
  // Remove HTML entities
  cleaned = cleaned.replace(/&amp;/g, '&').replace(/&#\d+;/g, '');
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

export function deriveSource(url, ogSiteName) {
  if (ogSiteName) return ogSiteName;

  const domain = extractDomain(url);
  if (!domain) return 'Unknown';

  // Check known sources (also check parent domain for subdomains)
  for (const [key, name] of Object.entries(KNOWN_SOURCES)) {
    if (domain === key || domain.endsWith('.' + key)) {
      return name;
    }
  }

  // Fallback: capitalize the main domain part
  // blog.example.com → "Example"
  // example.co.uk → "Example"
  const parts = domain.split('.');
  const tlds = new Set(['com', 'org', 'net', 'io', 'co', 'uk', 'ai', 'dev', 'app']);
  const meaningful = parts.filter(p => !tlds.has(p) && p.length > 2);
  const name = meaningful[meaningful.length - 1] || parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseDate(raw) {
  if (!raw) return null;
  try {
    const date = new Date(raw);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return null;
  }
}
