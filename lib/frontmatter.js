/**
 * Build YAML frontmatter for saved articles.
 * Uses the yaml package for proper escaping of special characters.
 */

import { stringify } from 'yaml';

export function buildFrontmatter({ url, title, author, source, published, tags, status, warning }) {
  const fm = {};

  // Required fields (always present)
  fm.url = url;
  fm.saved = new Date().toISOString().split('T')[0];
  fm.title = title || 'Untitled';
  fm.source = source || 'Unknown';

  // Optional fields (omit if null/undefined)
  if (author) fm.author = author;
  if (published) fm.published = published;

  // Tags (always present, even if empty fallback)
  fm.tags = tags && tags.length > 0 ? tags : ['untagged'];

  // Status
  fm.status = status || 'complete';

  // Warning (only for partial saves)
  if (warning) fm.warning = warning;

  const yamlStr = stringify(fm, {
    lineWidth: 0, // no wrapping
    singleQuote: false,
  });

  return `---\n${yamlStr}---`;
}
