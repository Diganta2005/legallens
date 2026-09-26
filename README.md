# LegalLens

GenAI legal-literacy assistant built for **PromptWars — "AI for Legal Assistance & Access."**
Paste a contract, agreement, or policy and get plain-language simplification, risk
highlights, a pre-signing checklist, lawyer-prep questions, and grounded Q&A.

**Not legal advice — informational only.**

**GenAI Service:** Anthropic Claude (`claude-sonnet-4-6`) via the Messages API,
called server-side through a Vercel serverless function so the API key is never
exposed to the browser.

## Problem statement alignment

| Use case from the brief | Feature in LegalLens |
|---|---|
| Simplifying complex legal documents | "Simplify document" |
| Comparing contracts / highlighting inconsistencies | "Highlight risks & obligations" |
| Answering questions based on provided documents | Ask box (Q&A grounded only in the pasted text) |
| Helping users understand options / next steps | "Generate checklist" |
| Preparing questions for a legal professional | "Prep questions for a lawyer" |
| Assist, don't replace, professional legal advice | Disclaimer shown in the UI at all times |

## Project structure

```
legallens/
├── index.html                    # static markup
├── app.js                         # frontend logic (separated for cacheability & clarity)
├── api/
│   ├── analyze.js                 # Vercel serverless function (calls Anthropic API server-side)
│   └── analyze.test.js            # unit + handler-level tests
├── .github/workflows/test.yml    # CI: runs tests + lint on every push/PR
├── .eslintrc.json
├── package.json
└── .gitignore
```

## Security

- API key lives only in a server-side environment variable, never in frontend code.
- Input is validated and length-capped (20,000 chars) before it reaches the model.
- Requests to the Anthropic API time out after 30s (`AbortController`).
- A lightweight per-IP rate limit blunts abusive request bursts.
- Error responses are generic — internal details (missing keys, upstream errors) are never leaked to the client.
- AI output is rendered with `textContent`/DOM nodes, never `innerHTML`, so model output can't inject markup or scripts (XSS-safe by construction).

## Efficiency

- No frontend framework or build step — a single static HTML file loads instantly.
- Client-side character counter and length cap avoid sending oversized requests.
- `max_tokens` is capped server-side to bound response latency and cost.

## Accessibility

- Every input has an associated `<label>` (visually hidden where space is tight).
- The results panel uses `role="status"` with `aria-live="polite"` so screen readers announce new AI output automatically.
- Visible focus outlines (`:focus-visible`) for full keyboard navigation.
- Buttons use `type="button"` to avoid unintended form submission behavior.
- Respects the OS light/dark color scheme automatically.

## Testing

- **Unit tests** cover input validation (empty, oversized, non-string, boundary cases).
- **Integration-style tests** exercise the actual request handler with mocked
  `req`/`res`/`fetch`: rejecting non-POST methods, rejecting invalid bodies,
  a missing-API-key path, a successful upstream response, and an upstream
  failure — checking in each case that no internal detail leaks into the error.
- Uses Node's built-in test runner (`node:test`) — no test-framework dependency.
- **Continuous integration**: `.github/workflows/test.yml` runs the full suite
  (and lint) on every push and pull request, across Node 18 and 20.

```
npm test
npm run lint
```

## Deploy to GitHub + Vercel

1. **Push to GitHub**
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git branch -M main
   git push -u origin main
   ```

2. **Import into Vercel**
   - Go to vercel.com → New Project → Import your GitHub repo.
   - Framework preset: "Other" (no build step needed).

3. **Set your API key**
   - In the Vercel project → Settings → Environment Variables, add:
     - `ANTHROPIC_API_KEY` = your key from console.anthropic.com
   - Redeploy after adding it (env vars only apply to new deployments).

4. **Done**
   - Vercel gives you a live URL (e.g. `legallens.vercel.app`).
   - `index.html` is served as-is; `api/analyze.js` automatically becomes a
     serverless endpoint at `/api/analyze`.

## Local testing

Install the Vercel CLI, then run `vercel dev` from the project root — it serves
`index.html` and runs `api/analyze.js` locally, reading `ANTHROPIC_API_KEY` from
a `.env` file (see `.gitignore` — never commit that file).

## Notes

- Swap the model name in `api/analyze.js` if you want a different Claude model.
- To deploy on Netlify instead, move `api/analyze.js` to `netlify/functions/analyze.js`
  and adjust the fetch path in `index.html` to `/.netlify/functions/analyze`.
- The in-memory rate limiter resets on cold start and isn't shared across serverless
  instances — fine for a hackathon demo; swap in Redis/Upstash for production scale.
