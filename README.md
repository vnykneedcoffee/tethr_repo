# Tethr

Tethr is an immersive calm digital environment, not a dashboard or a conventional wellness SaaS product.

## Run locally

The client uses native ES modules, so serve it over HTTP rather than opening `index.html` directly.

```bash
npm start
```

Or on Windows, double-click `start-tethr-ai.bat`.

Then open `http://localhost:4173`.

For local Gemini testing, create a file named `.env` beside `package.json` and set:

```env
GEMINI_API_KEY=your_new_key_here
GEMINI_MODEL=gemini-3.6-flash
PORT=4173
```

`.env` is ignored by Git. Never put the real key in browser code or commit it.

## Vercel deployment

This project is deliberately structured so the static website and the API function live in the same Vercel project.

- Static site: repository root (`index.html`, `src/`, `data/`, `assets/`, `audio/`)
- Serverless API: `api/companion.js`
- Provider: `server/provider.mjs`
- API endpoint: `/api/companion`
- Diagnostic endpoint: `/api/health`

In the Vercel project, add these environment variables for **Production** (and Preview if you want preview deployments to use Gemini):

- `GEMINI_API_KEY` = the API key from the new Google AI Studio project
- `GEMINI_MODEL` = `gemini-3.6-flash`

Then redeploy. The frontend never receives the API key.

After deployment, open `/api/health`. It should return `ok: true`, `geminiConfigured: true`, and `model: "gemini-2.5-flash"`. This confirms that Vercel is loading the environment variable before you test the chat.

## What is included

- Cinematic opening experience
- Fullscreen entry attempt
- Persistent first-person landscape
- Subtle mouse parallax and falling leaves
- Level 0 — passive peace
- Level 1 — breathing + invitation toward conversation
- Level 2 — thought externalization + grounding
- Level 3 — body-first + environment-based grounding + companion
- Scripted companion fallback when Gemini is unavailable
- Client and server safety interruption for explicit self-harm / immediate-danger language
- Centralized configuration for audio, cadence, timings, copy, and intervention steps
- Server-side Gemini provider adapter
- Responsive desktop/tablet/mobile layouts
- Reduced-motion support
- No accounts, analytics, scoring, streaks, or progress dashboards

## Gemini model

The default model is `gemini-3.6-flash`. The provider calls Gemini's `models.generateContent` endpoint and sends the API key only in the server-side `x-goog-api-key` header.

## Audio

The current project intentionally contains one soundscape file:

`audio/soundScape.mpeg`

Its path is configured in `data/config.js`.

The app starts audio only after the user presses ENTER, satisfying normal browser autoplay restrictions.

## Privacy

The browser sends only the current companion message history to `/api/companion`. The project does not write chat history to a database or local storage. The Gemini key is server-side only.
