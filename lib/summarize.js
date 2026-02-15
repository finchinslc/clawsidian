/**
 * Summarize article content using OpenAI API.
 * Returns a concise 2-3 sentence summary suitable for a blockquote.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4.1-mini';

export async function summarizeContent(content, title) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Truncate content to avoid token limits — first ~6000 chars is usually enough
  const truncated = content.substring(0, 6000);

  const prompt = `Summarize this article in 2-3 concise sentences. Focus on the key takeaway and why it matters. Be direct — no filler phrases like "This article discusses" or "The author explains."

Title: ${title}

Content:
${truncated}`;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
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
