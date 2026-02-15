/**
 * Generate filename slugs from article titles.
 * Max 60 chars, truncated at word boundary, non-ASCII transliterated.
 */

import slugifyLib from 'slugify';
import { existsSync } from 'node:fs';

const MAX_SLUG_LENGTH = 60;

export function generateSlug(title) {
  if (!title) return null;

  let slug = slugifyLib(title, {
    lower: true,
    strict: true, // strip special chars
    trim: true,
  });

  if (!slug) return null;

  // Truncate at word boundary (last hyphen before max length)
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.substring(0, MAX_SLUG_LENGTH);
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > 10) {
      slug = slug.substring(0, lastHyphen);
    }
  }

  return slug || null;
}

export function generateFilename(title, domain, vaultPath) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let slug = generateSlug(title);

  // Fallback to domain if no usable slug
  if (!slug && domain) {
    slug = generateSlug(domain.replace(/\./g, '-'));
  }
  if (!slug) {
    slug = 'untitled-article';
  }

  let basename = `${today}-${slug}`;
  let filename = `${basename}.md`;
  let filepath = `${vaultPath}/Articles/${filename}`;

  // Handle collisions by appending -2, -3, etc.
  let counter = 2;
  while (existsSync(filepath)) {
    filename = `${basename}-${counter}.md`;
    filepath = `${vaultPath}/Articles/${filename}`;
    counter++;
  }

  return { filename, filepath };
}
