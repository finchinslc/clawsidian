/**
 * Basic keyword extraction from article content.
 * Used as fallback tags when Finch doesn't provide --tags.
 */

const STOP_WORDS = new Set([
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on',
  'with','he','as','you','do','at','this','but','his','by','from','they','we',
  'say','her','she','or','an','will','my','one','all','would','there','their',
  'what','so','up','out','if','about','who','get','which','go','me','when',
  'make','can','like','time','no','just','him','know','take','people','into',
  'year','your','good','some','could','them','see','other','than','then','now',
  'look','only','come','its','over','think','also','back','after','use','two',
  'how','our','work','first','well','way','even','new','want','because','any',
  'these','give','day','most','us','been','has','are','was','were','did','does',
  'been','being','having','doing','would','should','could','might','must','shall',
  'will','can','need','dare','ought','used','may','also','very','often','however',
  'too','usually','really','already','still','since','another','each','every',
  'both','few','more','most','other','some','such','many','much','own','same',
]);

export function extractKeywords(text, count = 5) {
  if (!text || text.length < 50) return [];

  const cleaned = text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

  const words = cleaned.toLowerCase().match(/[a-z]{3,}/g) || [];
  const freqMap = new Map();
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    freqMap.set(word, (freqMap.get(word) || 0) + 1);
  }

  return [...freqMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word.replace(/\s+/g, '-'));
}
