const test = require('node:test');
const assert = require('node:assert');
const { validatePrompt, MAX_PROMPT_LENGTH } = require('./analyze.js');

test('rejects missing body', () => {
  assert.ok(validatePrompt(undefined));
  assert.ok(validatePrompt(null));
});

test('rejects missing prompt field', () => {
  assert.ok(validatePrompt({}));
});

test('rejects non-string prompt', () => {
  assert.ok(validatePrompt({ prompt: 123 }));
});

test('rejects empty / whitespace-only prompt', () => {
  assert.ok(validatePrompt({ prompt: '' }));
  assert.ok(validatePrompt({ prompt: '   ' }));
});

test('rejects prompt over the length limit', () => {
  const tooLong = 'a'.repeat(MAX_PROMPT_LENGTH + 1);
  assert.ok(validatePrompt({ prompt: tooLong }));
});

test('accepts a normal prompt', () => {
  assert.strictEqual(validatePrompt({ prompt: 'Please simplify this contract.' }), null);
});

test('accepts a prompt exactly at the length limit', () => {
  const atLimit = 'a'.repeat(MAX_PROMPT_LENGTH);
  assert.strictEqual(validatePrompt({ prompt: atLimit }), null);
});
