# LegalLens

GenAI legal-literacy assistant built for PromptWars ("AI for Legal Assistance & Access").
Paste a contract, agreement, or policy and get plain-language simplification, risk
highlights, a pre-signing checklist, lawyer-prep questions, and grounded Q&A.

Not legal advice — informational only.

## Project structure

```
legallens/
├── index.html        # static frontend
├── api/analyze.js     # Vercel serverless function (calls Anthropic API server-side)
├── package.json
└── .gitignore
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

## Local testing (optional)

Install the Vercel CLI, then run `vercel dev` from the project root — it serves
`index.html` and runs `api/analyze.js` locally, reading `ANTHROPIC_API_KEY` from
a `.env` file (see `.gitignore` — never commit that file).

## Notes

- The API key never reaches the browser; only the server function uses it.
- Swap the model name in `api/analyze.js` if you want a different Claude model.
- To deploy on Netlify instead, move `api/analyze.js` to `netlify/functions/analyze.js`
  and adjust the fetch path in `index.html` to `/.netlify/functions/analyze`.
