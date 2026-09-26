const test = require('node:test');
const assert = require('node:assert');
const handler = require('./analyze.js');
const { validatePrompt, MAX_PROMPT_LENGTH } = handler;

// --- Unit tests: validatePrompt ---------------------------------------

test('validatePrompt: rejects missing body', () => {
  assert.ok(validatePrompt(undefined));
  assert.ok(validatePrompt(null));
});

test('validatePrompt: rejects missing prompt field', () => {
  assert.ok(validatePrompt({}));
});

test('validatePrompt: rejects non-string prompt', () => {
  assert.ok(validatePrompt({ prompt: 123 }));
});

test('validatePrompt: rejects empty / whitespace-only prompt', () => {
  assert.ok(validatePrompt({ prompt: '' }));
  assert.ok(validatePrompt({ prompt: '   ' }));
});

test('validatePrompt: rejects prompt over the length limit', () => {
  const tooLong = 'a'.repeat(MAX_PROMPT_LENGTH + 1);
  assert.ok(validatePrompt({ prompt: tooLong }));
});

test('validatePrompt: accepts a normal prompt', () => {
  assert.strictEqual(validatePrompt({ prompt: 'Please simplify this contract.' }), null);
});

test('validatePrompt: accepts a prompt exactly at the length limit', () => {
  const atLimit = 'a'.repeat(MAX_PROMPT_LENGTH);
  assert.strictEqual(validatePrompt({ prompt: atLimit }), null);
});

// --- Integration-style tests: the handler itself, with req/res/fetch mocked ---

/** Minimal mock of Vercel's (req, res) so we can call the handler directly. */
function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

test('handler: rejects non-POST methods', async () => {
  const req = { method: 'GET' };
  const res = mockRes();
  await handler(req, res);
  assert.strictEqual(res.statusCode, 405);
});

test('handler: rejects invalid prompt with 400', async () => {
  const req = { method: 'POST', body: {}, headers: {} };
  const res = mockRes();
  await handler(req, res);
  assert.strictEqual(res.statusCode, 400);
});

test('handler: returns 500 (generic) when ANTHROPIC_API_KEY is missing', async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const req = { method: 'POST', body: { prompt: 'hello' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 500);
    // Never leak internal config details in the error message.
    assert.ok(!/ANTHROPIC_API_KEY/i.test(JSON.stringify(res.body)));
  } finally {
    if (original) process.env.ANTHROPIC_API_KEY = original;
  }
});

test('handler: returns model text on a successful upstream call', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text: 'Simplified output here.' }] })
  });
  try {
    const req = { method: 'POST', body: { prompt: 'Simplify this.' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.text, 'Simplified output here.');
  } finally {
    global.fetch = originalFetch;
  }
});

test('handler: surfaces upstream failure without leaking details', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: { message: 'rate limited upstream' } })
  });
  try {
    const req = { method: 'POST', body: { prompt: 'Simplify this.' }, headers: {} };
    const res = mockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 429);
    assert.strictEqual(res.body.error, 'Upstream AI service error');
  } finally {
    global.fetch = originalFetch;
  }
});
