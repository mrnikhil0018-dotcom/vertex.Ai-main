# Deploy Vertex AI Backend

The Android APK should not depend on your laptop. Deploy this backend to a
public HTTPS server, then rebuild the APK with that server URL.

## Recommended: Render Web Service

1. Push this project to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Use `render.yaml` from the repo root, or configure manually:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/api/health`
4. Add the environment variables from `backend/.env.example`.
5. Set `PUBLIC_BACKEND_URL` to the Render URL, for example:
   `https://vertex-ai-backend.onrender.com`
6. Open this URL to confirm:
   `https://your-backend-url/api/health`

Expected response:

```json
{"ok":true,"app":"Vertex AI Backend","database":"supabase"}
```

## Important

- Keep `SUPABASE_SERVICE_ROLE_KEY` only on the backend server.
- Do not put AI keys or service role keys inside the APK.
- For social login, register callback URLs in each provider dashboard:

```text
https://your-backend-url/api/auth/oauth/google/callback
https://your-backend-url/api/auth/oauth/github/callback
https://your-backend-url/api/auth/oauth/microsoft/callback
https://your-backend-url/api/auth/oauth/apple/callback
```

## Rebuild APK With Cloud URL

After the backend is live:

```bash
npm run set-backend-url -- https://your-backend-url
cd android
gradlew assembleRelease
```

Then install:

```text
android/app/build/outputs/apk/release/app-release.apk
```
