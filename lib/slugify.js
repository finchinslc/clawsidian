/**
 * Generate human-readable filenames from article titles.
 */

import { existsSync } from 'node:fs';

export function generateReadableTitle(title) {
  if (!title) return null;
  // Clean up the title for use in a filename — keep it human-readable
  // Remove characters that are problematic in filenames
  return title
    .replace(/[\x00-\x1f\x7f]/g, '') // strip control characters (null bytes, etc.)
    .replace(/[\/\\:*?"<>|]/g, '-')   // replace illegal filename chars
    .replace(/\s+/g, ' ')             // normalize whitespace
    .replace(/^-+|-+$/g, '')          // trim leading/trailing hyphens
    .trim()
    .substring(0, 120);               // reasonable max length
}

export function generateFilename(title, domain, vaultPath) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Human-readable format: "Title (YYYY-MM-DD).md"
  let readableTitle = generateReadableTitle(title);

  // Fallback to domain if no usable title
  if (!readableTitle && domain) {
    readableTitle = domain;
  }
  if (!readableTitle) {
    readableTitle = 'Untitled Article';
  }

  let basename = `${readableTitle} (${today})`;
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
