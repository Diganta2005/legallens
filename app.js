/**
 * LegalLens frontend logic.
 * Talks to the /api/analyze serverless endpoint; renders all output as plain
 * text nodes (never innerHTML) so model output can never inject markup/scripts.
 */

const MAX_LEN = 20000;

const outEl = document.getElementById('out');
const docEl = document.getElementById('doc');
const charcountEl = document.getElementById('charcount');
const buttons = document.querySelectorAll('button[data-action]');

/** Prompt templates for each fixed action, parameterized by the pasted document. */
const prompts = {
  simplify: (doc) =>
    `You are a legal-literacy assistant. Rewrite the following document in plain, ` +
    `simple language a non-lawyer can understand. Preserve all substantive meaning ` +
    `and important terms; do not omit obligations. Use short paragraphs or bullet points.\n\nDocument:\n${doc}`,
  risks: (doc) =>
    `You are a legal-literacy assistant. Analyze the following document and list: ` +
    `1) Key obligations for each party, 2) Potential risks or red flags, ` +
    `3) Any unusual, one-sided, or inconsistent clauses. Use clear headers and bullet points. ` +
    `Do not give legal advice, only informational analysis.\n\nDocument:\n${doc}`,
  checklist: (doc) =>
    `You are a legal-literacy assistant. Based on the following document, produce: ` +
    `1) A short plain-language summary (3-5 sentences), 2) An action checklist of ` +
    `things the reader should do or verify before signing/agreeing.\n\nDocument:\n${doc}`,
  prep: (doc) =>
    `You are a legal-literacy assistant. Based on the following document, generate a ` +
    `list of specific, well-informed questions the reader should ask a licensed lawyer ` +
    `before proceeding. Group questions by topic.\n\nDocument:\n${doc}`
};

/**
 * Builds the prompt for a free-form question grounded in the pasted document.
 * @param {string} doc
 * @param {string} question
 * @returns {string}
 */
function buildAskPrompt(doc, question) {
  return (
    `You are a legal-literacy assistant. Answer the user's question using ONLY the ` +
    `document below. If the answer isn't in the document, say so clearly. Do not give ` +
    `legal advice, only informational explanation.\n\nDocument:\n${doc}\n\nQuestion: ${question}`
  );
}

/**
 * Renders the output panel. Always uses text nodes, never innerHTML, so AI
 * output can never be interpreted as markup.
 * @param {string} [text]
 * @param {boolean} [loading]
 */
function setOut(text, loading) {
  outEl.classList.toggle('empty', !text && !loading);
  outEl.textContent = '';
  if (loading) {
    const spinner = document.createElement('span');
    spinner.className = 'spin';
    spinner.setAttribute('aria-hidden', 'true');
    outEl.appendChild(spinner);
    outEl.appendChild(document.createTextNode('Thinking...'));
  } else {
    outEl.appendChild(document.createTextNode(text || 'Results will appear here.'));
  }
}

/** @param {boolean} busy */
function setBusy(busy) {
  buttons.forEach((b) => (b.disabled = busy));
}

/**
 * Runs one action: builds the right prompt, calls the backend, renders the result.
 * @param {'simplify'|'risks'|'checklist'|'prep'|'ask'} action
 * @param {string} [extra] the question text, only used when action === 'ask'
 */
async function runAction(action, extra) {
  const doc = docEl.value.trim();
  if (!doc) {
    setOut('Paste a document first.');
    return;
  }
  if (doc.length > MAX_LEN) {
    setOut(`Document is too long (max ${MAX_LEN} characters).`);
    return;
  }

  setBusy(true);
  setOut('', true);

  try {
    const prompt = action === 'ask' ? buildAskPrompt(doc, extra) : prompts[action](doc);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    setOut(data.text);
  } catch (err) {
    setOut('Something went wrong: ' + (err && err.message ? err.message : 'please try again.'));
  } finally {
    setBusy(false);
  }
}

docEl.addEventListener('input', () => {
  charcountEl.textContent = `${docEl.value.length} / ${MAX_LEN} characters`;
});

buttons.forEach((b) => {
  if (b.id === 'askBtn') return;
  b.addEventListener('click', () => runAction(b.dataset.action));
});

document.getElementById('askBtn').addEventListener('click', () => {
  const q = document.getElementById('q').value.trim();
  if (!q) {
    setOut('Type a question first.');
    return;
  }
  runAction('ask', q);
});

document.getElementById('q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('askBtn').click();
});
