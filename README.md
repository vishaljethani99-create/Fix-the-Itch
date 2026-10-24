# GoLan

GoLan is a communication project for service-counter conversations, such as at a hospital, bank, or office. It helps turn sign labels into a sentence that can be spoken aloud, and simplify staff speech into a caption that is easier to read.

The repository currently includes a starter web page and two API routes. An API route is a URL that another part of an app can send information to and receive a result from. A complete user interface and sign-recognition model are not included yet, so the sign labels must currently be supplied by the caller.

## How to use Fix the GoLan

1. Start the development server using the instructions below.
2. Choose a conversation scenario (`hospital`, `bank`, or `office`) and a language (`en`, `hi`, or `mr`).
3. Send recognized sign labels to `/api/compose` to receive a sentence and a short summary.
4. Send staff speech text to `/api/simplify` to receive a simpler caption, important words, and suggested replies.
5. Use the browser speech helpers in `lib/speech.ts` to read text aloud or, in supported browsers, convert speech to text.

At this stage, the project provides the communication building blocks and API examples; it does not yet provide screens or automatically recognize sign language from a camera.

## Terms used in this guide

- **Node.js**: The program that runs the web server on your computer.
- **npm**: The tool that installs the packages the project needs and runs its commands.
- **Next.js**: The web framework used to serve the starter page and API routes.
- **TypeScript**: JavaScript with extra type checks that help catch mistakes while developing.
- **API**: A way for one part of the app to send data to another part and get a response.
- **JSON**: A text format used to send structured data, such as the examples below.
- **Scenario**: The kind of service counter where the conversation is taking place.
- **Language code**: A short label for the response language: `en` is English, `hi` is Hindi, and `mr` is Marathi.
- **Mock mode**: A demonstration mode that returns simple sample responses without contacting Google's AI service.
- **Fallback**: A basic response used when the AI service is not configured or cannot return a usable answer.
- **Google GenAI**: Google's generative AI service, used for responses when mock mode is turned off and an API key is configured.

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

Mock mode is enabled by default (`MOCK_GEMMA=true`), so you can try the API without an AI account or API key. Its replies are simple examples, not AI-generated translations. To use Google's AI service instead, set `MOCK_GEMMA=false` and put your key in `.env.local`:

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

Both routes accept a JSON request and return a JSON response. In the examples, `POST` means the caller is sending data to the route. An HTTP `400` response means the request was not valid.

### `POST /api/compose`

Send sign labels to this route to get a short sentence and summary. A sign label is a word describing a recognized sign, such as `"help"`.

Request:

```json
{
  "signs": ["help", "doctor"],
  "scenario": "hospital",
  "lang": "en",
  "history": []
}
```

In the request, `scenario` must be `hospital`, `bank`, or `office`, and `lang` must be `en`, `hi`, or `mr`. `history` is a list of previous conversation messages; send an empty list (`[]`) when there are no previous messages. Each message has `who` (`signer` or `staff`) and `text`. The examples show the expected data shape; they do not imply that camera-based sign recognition is already included.

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

Send the staff member's words to this route to get a simpler caption, key terms, and suggested replies for the signer.

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
