/**
 * Check for duplicate articles by scanning frontmatter url: fields.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function findDuplicate(normalizedUrl, vaultPath) {
  const articlesDir = join(vaultPath, 'Articles');

  let files;
  try {
    files = await readdir(articlesDir);
  } catch {
    // Articles/ doesn't exist yet — no duplicates
    return null;
  }

  const mdFiles = files.filter(f => f.endsWith('.md'));

  for (const file of mdFiles) {
    const filepath = join(articlesDir, file);
    try {
      const content = await readFile(filepath, 'utf-8');
      // Only scan the frontmatter (between first --- and second ---)
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;

      const fm = fmMatch[1];
      const urlMatch = fm.match(/^url:\s*(.+)$/m);
      if (urlMatch && urlMatch[1].trim() === normalizedUrl) {
        // Extract title from frontmatter
        const titleMatch = fm.match(/^title:\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : null;
        return { file, title, filepath };
      }
    } catch {
      // Skip unreadable files
      continue;
    }
  }

  return null;
}
