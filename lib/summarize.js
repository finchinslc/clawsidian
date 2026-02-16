/**
 * Summarize article content using any OpenAI-compatible API.
 * API key is resolved by config.js from env vars or OpenClaw config.
 */

const ALLOWED_API_HOSTS = new Set([
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'openrouter.ai',
  'api.x.ai',
  'api.anthropic.com',
]);

const ALLOWED_API_KEY_ENVS = new Set([
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'XAI_API_KEY',
  'ANTHROPIC_API_KEY',
]);

function isAllowedBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return ALLOWED_API_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function summarizeContent(content, title, config = {}) {
  const baseUrl = config.openaiBaseUrl || 'https://api.openai.com/v1';

  if (!isAllowedBaseUrl(baseUrl)) {
    process.stderr.write(`Warning: Blocked summarization request to untrusted host: ${baseUrl}\n`);
    return null;
  }

  // Only read from known provider env vars to prevent exfiltration of arbitrary secrets
  const apiKeyEnv = config.apiKeyEnv && ALLOWED_API_KEY_ENVS.has(config.apiKeyEnv)
    ? config.apiKeyEnv
    : null;

  const apiKey = config.apiKey
    || (apiKeyEnv && process.env[apiKeyEnv])
    || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = config.summaryModel || 'gpt-4.1-nano';

  const truncated = content.substring(0, 6000);

  const prompt = `Summarize this article in 2-3 concise sentences. Focus on the key takeaway and why it matters. Be direct — no filler phrases like "This article discusses" or "The author explains."

Title: ${title}

Content:
${truncated}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      process.stderr.write(`Warning: Summarization API returned ${res.status}\n`);
      return null;
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    return summary || null;
  } catch {
    return null;
  }
}
