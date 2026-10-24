# Fix the Itch

Fix the Itch is a Node.js and TypeScript application with communication helpers for service-counter conversations. It can turn recognized sign labels into a short sentence, simplify staff speech into a caption, and provide browser speech recognition and text-to-speech helpers.

The repository currently provides a small Next.js home page and the API routes. A full user interface and sign-recognition model are not included yet; callers provide the recognized sign labels.

## Requirements

- Node.js 20.9 or newer
- npm

## Getting started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Open <http://localhost:3000>.

Mock mode is enabled by default (`MOCK_GEMMA=true`) and does not need an API key. To call Google GenAI, set `MOCK_GEMMA=false` and put your key in `.env.local`:

```dotenv
GEMINI_API_KEY=your_key_here
GEMMA_MODEL=gemma-4-26b-a4b-it
MOCK_GEMMA=false
```

Never commit `.env.local` or share its key. If a key was exposed or committed, revoke it and create a replacement.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Run the TypeScript checker |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |

## API

Both routes accept JSON and return JSON. Invalid JSON or invalid request data returns HTTP `400`.

### `POST /api/compose`

Turns sign labels into a short sentence and summary.

Request:

```json
{
  "signs": ["help", "doctor"],
  "scenario": "hospital",
  "lang": "en",
  "history": []
}
```

`scenario` must be `hospital`, `bank`, or `office`. `lang` must be `en`, `hi`, or `mr`. Each history item has a `who` value of `signer` or `staff` and a `text` string.

Response:

```json
{
  "sentence": "I need help with: help doctor.",
  "fallback": true,
  "summary": {
    "needs": "help doctor",
    "symptoms": "-",
    "notes": "Mock mode active"
  }
}
```

### `POST /api/simplify`

Simplifies a staff member's speech for a signer.

Request:

```json
{
  "speech": "Please wait while I check your account.",
  "scenario": "bank",
  "lang": "en"
}
```

Response:

```json
{
  "caption": "Please wait",
  "keyTerms": ["Please", "wait"],
  "quickReplies": ["Yes", "No", "Please wait"],
  "fallback": true
}
```

## Project structure

```text
app/
  api/compose/route.ts    Compose API endpoint
  api/simplify/route.ts   Speech simplification endpoint
  layout.tsx              Root page layout and metadata
  page.tsx                Starter home page
lib/
  api.ts                  Client helpers for API requests
  gemma.ts                Google GenAI and mock-mode logic
  session.ts              Sign buffering and conversation history
  speech.ts               Browser speech recognition and synthesis
  types.ts                Shared request and response types
  validation.ts           API request validation
```
