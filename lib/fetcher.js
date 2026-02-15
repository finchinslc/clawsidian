/**
 * Fetch HTML and extract readable content using Mozilla Readability.
 * Converts extracted HTML to markdown via Turndown.
 */

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Preserve code block language hints
turndown.addRule('fencedCodeBlock', {
  filter(node) {
    return node.nodeName === 'PRE' && node.querySelector('code');
  },
  replacement(content, node) {
    const code = node.querySelector('code');
    const lang = (code.className.match(/language-(\S+)/) || [])[1] || '';
    const text = code.textContent.replace(/\n$/, '');
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  },
});

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function fetchArticle(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: httpErrorMessage(response.status),
    };
  }

  const html = await response.text();
  const finalUrl = response.url; // after redirects

  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  // Extract OpenGraph and meta info before Readability modifies the DOM
  const ogTitle = metaContent(doc, 'og:title');
  const ogAuthor = metaContent(doc, 'og:author') || metaContent(doc, 'author');
  const ogPublished = metaContent(doc, 'article:published_time')
    || metaContent(doc, 'datePublished')
    || metaContent(doc, 'date');
  const ogSiteName = metaContent(doc, 'og:site_name');
  const h1 = doc.querySelector('h1')?.textContent?.trim() || null;
  const titleTag = doc.querySelector('title')?.textContent?.trim() || null;

  // Extract published date from <time> elements
  const timeEl = doc.querySelector('time[datetime]');
  const timeDatetime = timeEl?.getAttribute('datetime') || null;

  const reader = new Readability(doc);
  const article = reader.parse();

  if (!article || !article.content || article.content.trim().length < 50) {
    return {
      success: false,
      status: response.status,
      error: 'No content could be extracted',
      partial: !!article?.content,
      meta: { ogTitle, ogAuthor, ogPublished, ogSiteName, h1, titleTag, timeDatetime },
    };
  }

  const markdown = turndown.turndown(article.content);

  return {
    success: true,
    finalUrl,
    status: response.status,
    article: {
      title: article.title || ogTitle || titleTag || h1 || null,
      byline: article.byline || ogAuthor || null,
      content: markdown,
      excerpt: article.excerpt || null,
      length: article.length || 0,
    },
    meta: {
      ogTitle,
      ogAuthor,
      ogPublished,
      ogSiteName,
      h1,
      titleTag,
      timeDatetime,
    },
  };
}

function metaContent(doc, nameOrProperty) {
  const el = doc.querySelector(
    `meta[property="${nameOrProperty}"], meta[name="${nameOrProperty}"]`
  );
  return el?.getAttribute('content')?.trim() || null;
}

function httpErrorMessage(status) {
  const messages = {
    400: 'Bad request (400)',
    401: 'Authentication required (401)',
    403: 'Access denied (403)',
    404: 'Page not found (404)',
    410: 'Page removed (410)',
    429: 'Rate limited, try again later',
    500: 'Server error (500)',
    502: 'Bad gateway (502)',
    503: 'Service unavailable (503)',
  };
  return messages[status] || `HTTP error (${status})`;
}
