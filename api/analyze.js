// Vercel serverless function: POST { prompt } -> { text }
// Security: API key stays server-side only; input is validated and length-capped;
// requests time out; a lightweight in-memory rate limit blunts abuse per instance.

const MAX_PROMPT_LENGTH = 20000; // characters — keeps cost/latency bounded
const REQUEST_TIMEOUT_MS = 30000;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 20;

// Best-effort only: resets on cold start and isn't shared across instances.
// For real production use, back this with Redis/Upstash or a platform rate limiter.
const requestLog = new Map();

function isRateLimited(key) {
  const now = Date.now();
  const timestamps = (requestLog.get(key) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Validates the request body. Exported separately so it can be unit tested
 * without making a real network call.
 * @returns {string|null} an error message, or null if valid
 */
function validatePrompt(body) {
  if (!body || typeof body.prompt !== 'string') {
    return 'Missing "prompt" string in request body';
  }
  if (body.prompt.trim().length === 0) {
    return 'Prompt cannot be empty';
  }
  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    return `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`;
  }
  return null;
}

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const clientKey =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (isRateLimited(clientKey)) {
    res.status(429).json({ error: 'Too many requests — please slow down.' });
    return;
  }

  const validationError = validatePrompt(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Deliberately generic — never leak whether/why a secret is misconfigured.
    res.status(500).json({ error: 'Server is temporarily unavailable' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: req.body.prompt }]
      }),
      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: 'Upstream AI service error' });
      return;
    }

    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.status(200).json({ text });
  } catch (err) {
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'Request timed out — please try again.' });
    } else {
      res.status(500).json({ error: 'Unexpected server error' });
    }
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = handler;
module.exports.validatePrompt = validatePrompt;
module.exports.MAX_PROMPT_LENGTH = MAX_PROMPT_LENGTH;
