/**
 * Summarize article content using any OpenAI-compatible API.
 * API key is resolved by config.js from env vars or OpenClaw config.
 */

export async function summarizeContent(content, title, config = {}) {
  const apiKey = config.apiKey
    || (config.apiKeyEnv && process.env[config.apiKeyEnv])
    || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = config.openaiBaseUrl || 'https://api.openai.com/v1';
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
    });

    if (!res.ok) return null;

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    return summary || null;
  } catch {
    return null;
  }
}
