# Clawsidian

OpenClaw's Obsidian Toolkit — a CLI for saving web articles to Obsidian vaults with structured metadata.

Fetches articles, converts them to clean markdown, extracts metadata, auto-generates tags, and saves to your vault with YAML frontmatter. Built for [OpenClaw](https://openclaw.ai) agents but works standalone.

## Install

```sh
npm install -g clawsidian
```

Requires Node.js 20+.

## Usage

Save an article:

```sh
clawsidian save https://paulgraham.com/superlinear.html
```

```
Saved:
  File:   Articles/2026-02-15-superlinear-returns.md
  Title:  "Superlinear Returns"
  Source:  Paul Graham
  Tags:   returns, superlinear, growth, performance
  Status: complete
```

Preview without writing:

```sh
clawsidian save https://example.com/article --dry-run
```

Override auto-generated tags:

```sh
clawsidian save https://example.com/article --tags "ai,ml,tutorial"
```

Use a custom vault path:

```sh
clawsidian save https://example.com/article --vault ~/my-vault
```

JSON output (for programmatic use by agents):

```sh
clawsidian save https://example.com/article --json
```

## Queue

Add URLs for later processing:

```sh
clawsidian save --queue https://example.com/article-1
clawsidian save --queue https://example.com/article-2
```

Process the queue:

```sh
clawsidian save --process-queue
```

Failed URLs are retained in the queue for retry.

## Output Format

Articles are saved to `Articles/` with YAML frontmatter:

```markdown
---
url: https://example.com/article
saved: 2026-02-15
title: Article Title
author: Author Name
source: Example Blog
published: 2026-02-10
tags:
  - topic-one
  - topic-two
  - topic-three
status: complete
---

# Article Title

Article content in clean markdown...
```

## Features

- **Content extraction** via Mozilla Readability (same as Firefox Reader View)
- **HTML to markdown** conversion with Turndown
- **Auto-tagging** from article content using frequency-based keyword extraction
- **Duplicate detection** by URL matching across existing articles
- **Paywall handling** — saves available preview with `status: partial`
- **URL normalization** — strips tracking params, normalizes protocol
- **Queue system** with atomic writes for deferred processing
- **JSON output** for integration with AI agents and scripts

## Options

```
--vault <path>    Vault root path (default: ~/openclaw/obsidian-vault)
--tags <tags>     Comma-separated tags (overrides auto-generated)
--json            Output JSON instead of human-readable text
--dry-run         Show what would be saved without writing
--queue           Add URL to queue instead of saving immediately
--process-queue   Process all queued URLs
-h, --help        Show help
```

## License

MIT
