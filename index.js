#!/usr/bin/env node

/**
 * Clawsidian — OpenClaw's Obsidian Toolkit
 *
 * Usage:
 *   clawsidian save <url> [options]
 *   clawsidian save --process-queue [options]
 */

import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

import { normalizeUrl, isValidUrl, extractDomain } from './lib/normalize.js';
import { fetchArticle } from './lib/fetcher.js';
import { extractMetadata } from './lib/metadata.js';
import { generateFilename } from './lib/slugify.js';
import { buildFrontmatter } from './lib/frontmatter.js';
import { findDuplicate } from './lib/duplicate.js';
import { extractKeywords } from './lib/keywords.js';
import { readQueue, addToQueue, writeQueue } from './lib/queue.js';
import { writeFile } from 'node:fs/promises';

// --- Argument Parsing ---

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    vault: { type: 'string', default: join(homedir(), 'openclaw/obsidian-vault') },
    tags: { type: 'string' },
    json: { type: 'boolean', default: false },
    queue: { type: 'boolean', default: false },
    'process-queue': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const subcommand = positionals[0];
const urlArg = positionals[1];

// --- Main ---

if (values.help || !subcommand) {
  printUsage();
  process.exit(0);
}

if (subcommand !== 'save') {
  output({ success: false, error: `Unknown command: ${subcommand}. Available: save` });
  process.exit(1);
}

const vaultPath = resolve(values.vault);

try {
  await ensureArticlesDir();

  if (values['process-queue']) {
    await processQueue();
  } else if (values.queue) {
    await queueUrl();
  } else {
    await saveArticle();
  }
} catch (err) {
  output({ success: false, error: `Unexpected error: ${err.message}` });
  process.exit(1);
}

// --- Commands ---

async function saveArticle() {
  if (!urlArg) {
    output({ success: false, error: 'No URL provided. Usage: clawsidian save <url>' });
    process.exit(1);
  }

  const result = await saveUrl(urlArg);
  output(result);
  process.exit(result.success ? 0 : 1);
}

async function queueUrl() {
  if (!urlArg) {
    output({ success: false, error: 'No URL provided. Usage: clawsidian save --queue <url>' });
    process.exit(1);
  }

  if (!isValidUrl(urlArg)) {
    output({ success: false, error: 'Invalid URL format' });
    process.exit(1);
  }

  const result = await addToQueue(vaultPath, urlArg);
  if (result.added) {
    output({ success: true, queued: true, url: urlArg, message: 'URL added to queue' });
  } else {
    output({ success: false, error: result.reason, url: urlArg });
    process.exit(1);
  }
}

async function processQueue() {
  const queue = await readQueue(vaultPath);

  if (queue.length === 0) {
    output({ success: true, processed: 0, message: 'Queue is empty' });
    return;
  }

  const results = [];
  const failedItems = [];
  for (const item of queue) {
    const result = await saveUrl(item.url);
    results.push(result);
    if (!result.success && !result.duplicate) {
      failedItems.push(item);
    }
  }

  // Retain failed items in the queue so they can be retried
  await writeQueue(vaultPath, failedItems);

  const succeeded = results.filter(r => r.success).length;
  const failed = failedItems.length;
  const duplicates = results.filter(r => r.duplicate).length;

  output({
    success: true,
    processed: results.length,
    succeeded,
    failed,
    duplicates,
    results,
  });
}

// --- Core Save Logic ---

async function saveUrl(url) {
  // 1. Validate
  if (!isValidUrl(url)) {
    return { success: false, error: 'Invalid URL format', url };
  }

  // 2. Normalize
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return { success: false, error: 'Could not normalize URL', url };
  }

  const domain = extractDomain(normalizedUrl);

  // 3. Duplicate check
  const existing = await findDuplicate(normalizedUrl, vaultPath);
  if (existing) {
    return {
      success: false,
      duplicate: true,
      existing_file: `Articles/${existing.file}`,
      existing_title: existing.title,
      url: normalizedUrl,
    };
  }

  // 4. Fetch
  let fetchResult;
  try {
    fetchResult = await fetchArticle(url);
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { success: false, error: 'Request timed out', url: normalizedUrl };
    }
    return { success: false, error: `Network error: ${err.message}`, url: normalizedUrl };
  }

  if (!fetchResult.success) {
    if (fetchResult.partial && fetchResult.meta) {
      return await savePartial(normalizedUrl, domain, fetchResult);
    }
    return { success: false, error: fetchResult.error, url: normalizedUrl };
  }

  // 5. Extract metadata
  const metadata = extractMetadata(fetchResult, normalizedUrl);
  const title = metadata.title || domain;

  // 6. Keywords / tags
  const keywords = extractKeywords(fetchResult.article.content);
  const tags = values.tags
    ? values.tags.split(',').map(t => t.trim().toLowerCase())
    : keywords;

  // 7. Generate filename
  const { filename, filepath } = generateFilename(title, domain, vaultPath);

  // 8. Build file content
  const frontmatter = buildFrontmatter({
    url: normalizedUrl,
    title,
    author: metadata.author,
    source: metadata.source,
    published: metadata.published,
    tags,
    status: 'complete',
  });

  const fileContent = `${frontmatter}\n\n# ${title}\n\n${fetchResult.article.content}\n`;

  // 9. Build result
  const result = {
    success: true,
    file: `Articles/${filename}`,
    title,
    author: metadata.author || undefined,
    source: metadata.source,
    published: metadata.published || undefined,
    keywords,
    tags,
    status: 'complete',
    url: normalizedUrl,
  };

  if (values['dry-run']) {
    return { ...result, dry_run: true };
  }

  await writeFile(filepath, fileContent, 'utf-8');
  return result;
}

async function savePartial(normalizedUrl, domain, fetchResult) {
  const meta = fetchResult.meta;
  const title = meta.ogTitle || meta.titleTag || meta.h1 || domain;

  const tags = values.tags
    ? values.tags.split(',').map(t => t.trim().toLowerCase())
    : ['untagged'];

  const { filename, filepath } = generateFilename(title, domain, vaultPath);

  const frontmatter = buildFrontmatter({
    url: normalizedUrl,
    title,
    source: domain,
    tags,
    status: 'partial',
    warning: 'Content may be incomplete due to paywall or access restriction',
  });

  const fileContent = `${frontmatter}\n\n# ${title}\n\n*Note: This article may be incomplete due to paywall or access restrictions.*\n`;

  const result = {
    success: true,
    file: `Articles/${filename}`,
    title,
    source: domain,
    tags,
    status: 'partial',
    url: normalizedUrl,
  };

  if (values['dry-run']) {
    return { ...result, dry_run: true };
  }

  await writeFile(filepath, fileContent, 'utf-8');
  return result;
}

// --- Helpers ---

async function ensureArticlesDir() {
  const dir = join(vaultPath, 'Articles');
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function output(data) {
  if (values.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    printHuman(data);
  }
}

function printHuman(data) {
  if (data.queued) {
    console.log(`Queued: ${data.url}`);
    return;
  }

  if (data.processed !== undefined) {
    console.log(`Processed ${data.processed} queued articles: ${data.succeeded} saved, ${data.duplicates} duplicates, ${data.failed} failed`);
    return;
  }

  if (data.duplicate) {
    console.log(`Already saved: ${data.existing_file}`);
    if (data.existing_title) console.log(`Title: "${data.existing_title}"`);
    return;
  }

  if (!data.success) {
    console.error(`Error: ${data.error}`);
    return;
  }

  if (data.dry_run) {
    console.log('[DRY RUN] Would save:');
  } else {
    console.log('Saved:');
  }
  console.log(`  File:   ${data.file}`);
  console.log(`  Title:  "${data.title}"`);
  if (data.author) console.log(`  Author: ${data.author}`);
  console.log(`  Source: ${data.source}`);
  if (data.tags?.length) console.log(`  Tags:   ${data.tags.join(', ')}`);
  console.log(`  Status: ${data.status}`);
}

function printUsage() {
  console.log(`
Clawsidian — OpenClaw's Obsidian Toolkit

Usage:
  clawsidian save <url> [options]     Save a web article to the vault
  clawsidian save --queue <url>       Add URL to queue for later processing
  clawsidian save --process-queue     Process all queued URLs

Options:
  --vault <path>    Vault root path (default: ~/openclaw/obsidian-vault)
  --tags <tags>     Comma-separated tags (e.g., "ai,ml,tutorial")
  --json            Output JSON instead of human-readable text
  --dry-run         Show what would be saved without writing
  -h, --help        Show this help
`);
}
