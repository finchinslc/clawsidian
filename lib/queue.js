/**
 * File-based queue for deferred article saving.
 * Atomic writes via temp file + rename to prevent corruption.
 */

import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function queuePath(vaultPath) {
  return join(vaultPath, 'Articles', '.queue.json');
}

export async function readQueue(vaultPath) {
  const path = queuePath(vaultPath);
  try {
    const data = await readFile(path, 'utf-8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item =>
      item && typeof item === 'object' && typeof item.url === 'string'
    );
  } catch {
    return [];
  }
}

export async function addToQueue(vaultPath, url) {
  const queue = await readQueue(vaultPath);
  // Avoid duplicate queue entries
  if (queue.some(item => item.url === url)) {
    return { added: false, reason: 'Already in queue' };
  }
  queue.push({
    url,
    added: new Date().toISOString(),
  });
  await atomicWrite(queuePath(vaultPath), JSON.stringify(queue, null, 2));
  return { added: true };
}

export async function writeQueue(vaultPath, items) {
  if (items.length === 0) {
    await clearQueue(vaultPath);
  } else {
    await atomicWrite(queuePath(vaultPath), JSON.stringify(items, null, 2));
  }
}

export async function clearQueue(vaultPath) {
  const path = queuePath(vaultPath);
  try {
    await unlink(path);
  } catch {
    // File didn't exist, that's fine
  }
}

async function atomicWrite(filepath, data) {
  const tmpPath = filepath + '.' + randomUUID().slice(0, 8) + '.tmp';
  await writeFile(tmpPath, data, 'utf-8');
  await rename(tmpPath, filepath);
}
