# Vertex AI Backend

Supabase + Express backend for Vertex AI login, chat, and AI tool generation.
It also exposes the real OAuth login flow used by the Android app buttons.

## AI Failover

The Android app never calls AI providers directly. It calls this backend, and
the backend silently tries providers in `AI_PROVIDER_ORDER`.

```bash
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GROQ_API_KEY=...
HF_API_KEY=...
OPENROUTER_API_KEY=...
XAI_API_KEY=...
AI_PROVIDER_ORDER=gemini,groq,openrouter,huggingface,anthropic,openai,xai
```

If Gemini quota/credit/rate-limit fails, backend tries GroqCloud, OpenRouter
free models, Hugging Face, Claude, OpenAI, then xAI/Grok. The app still receives one normal
`vertex.ai` reply, so users do not see provider names or quota errors. If every
provider fails, the backend returns a generic temporary-busy message.

## Chat Tools

`/api/chat` also detects tool requests from normal language. If the user asks
for an image, website, app, video, music, code, or writing output, the backend
returns a normal `reply` plus a `tool` payload. The Android chat screen and
talking avatar render that payload inline, while the separate Tools page still
works independently.

Website and app builder prompts now ask for:

- preview-ready single-file HTML with CSS in `<style>` and JavaScript in
  `<script>`
- React/Vite project files such as `package.json`, `src/App.jsx`, and
  `src/styles.css`
- deploy files such as `netlify.toml`, `vercel.json`, and GitHub Pages workflow
- debug/test checklist and build commands

Actual one-click deployment requires a hosting token stored only on the backend:

```bash
NETLIFY_AUTH_TOKEN=...
VERCEL_TOKEN=...
```

Do not put deploy tokens inside the APK.

## Run

First run `backend/supabase/schema.sql` in Supabase SQL Editor, then set
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

```bash
cd backend
npm install
npm start
```

Default server: `http://0.0.0.0:5000`

## Requirements

- Supabase project URL from Project Settings > API.
- Supabase service role key from Project Settings > API. Keep it only in backend `.env`; never put it in APK/client code.
- `GEMINI_API_KEY` set in `.env`.

If you get `Supabase connection failed`, run `backend/supabase/schema.sql` in the Supabase SQL Editor and recheck `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

## Real Social Login

Add provider keys in `backend/.env`, then restart `npm start`.

```bash
PUBLIC_BACKEND_URL=https://your-public-backend-url
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

Provider callback URLs to register:

```text
{PUBLIC_BACKEND_URL}/api/auth/oauth/google/callback
{PUBLIC_BACKEND_URL}/api/auth/oauth/github/callback
{PUBLIC_BACKEND_URL}/api/auth/oauth/microsoft/callback
{PUBLIC_BACKEND_URL}/api/auth/oauth/apple/callback
```

For real OAuth, providers usually require a public HTTPS backend URL. Local Wi-Fi IPs like `http://10.x.x.x:5000` are okay for app-to-backend testing, but many OAuth dashboards will reject them as callback URLs. Use a deployed backend or HTTPS tunnel such as ngrok, then put that public URL in `PUBLIC_BACKEND_URL`.

For a real Android phone, keep phone and laptop on the same Wi-Fi. If your laptop IP changes, update `API_BASE_URLS` in `src/services/api.js` and rebuild the APK.
