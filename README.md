# Reviewly

AI-powered product review summaries distilled from real user conversations. Reviewly searches Reddit, analyzes discussions with an LLM, and renders a clean, structured verdict with rating, pros, cons, and a concise summary—complete with sources and optional reasoning.

## Key Features

- **AI review synthesis**: Converts noisy Reddit threads into a single, trustworthy JSON summary (rating, pros, cons, description).
- **Live, low-latency streaming**: See the response stream in real time with smooth autoscroll and minimal UI jank.
- **Verified source citations**: One-click sources panel lists every URL used in the analysis.
- **On-demand reasoning**: Expandable reasoning lets you peek behind the curtain—kept collapsed by default for a clean UI.
- **Tool calling with traces**: Collapsible tool panels show parameters and outputs (e.g., Reddit fetches) without cluttering the chat.
- **Model picker**: Swap between GPT‑4o, DeepSeek R1, and OSS models; works great with OpenRouter or native OpenAI.
- **JSON‑first UI**: Structured output is resiliently parsed and rendered as beautiful cards.
- **Quality of life**: Retry last prompt, one‑click copy, dark/light theme toggle.

## How It Works

1. You describe the product or topic you want reviewed.
2. A server‑side tool searches Reddit and retrieves relevant posts + comments.
3. The LLM analyzes signal vs. noise and emits a strict JSON schema.
4. The UI renders rating, pros/cons, and a concise description, with sources and reasoning available on demand.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 to view the app.

## Configuration (OpenRouter or OpenAI)

You can run with native OpenAI or route through OpenRouter for access to many providers/models.

1. Create a `.env.local` file in `ai-chatbot/` with one of the following setups.

OpenRouter (recommended for model variety):

```
OPENAI_API_KEY=sk-or-v1_...           # your OpenRouter API key
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# Optional attribution/policy headers depending on platform support
# OPENROUTER_HTTP_REFERER=http://localhost:3000
# OPENROUTER_APP_TITLE=Reviewly
```

Native OpenAI:

```
OPENAI_API_KEY=sk-live-...
```

Then restart the dev server:

```
npm run dev
```

No code changes are required; the API route passes the selected model slug to the configured OpenAI‑compatible endpoint.

## Tech Stack

- **Framework**: Next.js (App Router), TypeScript
- **LLM SDK**: Vercel AI SDK (`useChat`, streaming UI parts)
- **Models**: GPT‑4o, DeepSeek R1, OSS via OpenRouter (or native OpenAI)
- **UI**: Tailwind + shadcn/ui, Lucide icons, `streamdown` for streaming markdown
- **UX utilities**: `use-stick-to-bottom` for smooth autoscroll
- **Validation**: `zod` for tool input schemas; step limiter on tool calls

## Roadmap

- Additional sources beyond Reddit (e.g., Amazon, YouTube, forums)
- Saved reviews, shareable links, and export to Markdown/JSON
- Quality presets (speed vs. depth) and multi-model consensus
