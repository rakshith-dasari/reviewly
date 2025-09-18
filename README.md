# Reviewly

AI-powered product review summaries distilled from real user conversations. Reviewly searches Reddit, analyzes discussions with an LLM, and renders a clean, structured verdict with rating, pros, cons, and a concise summary—complete with sources and optional reasoning.

## Key Features

- **AI review synthesis**: Converts noisy Reddit threads into a single, trustworthy JSON summary (rating, pros, cons, description).
- **Live, low-latency streaming**: See the response stream in real time with smooth autoscroll and minimal UI jank.
- **Verified source citations**: One-click sources panel lists every URL used in the analysis.
- **On-demand reasoning**: Expandable reasoning lets you peek behind the curtain—kept collapsed by default for a clean UI.
- **Tool calling with traces**: Collapsible tool panels show parameters and outputs (e.g., Reddit fetches) without cluttering the chat.
- **Model picker**: Swap between multiple models
- **JSON‑first UI**: Structured output is resiliently parsed and rendered as beautiful cards.
- **Quality of life**: Retry last prompt, one‑click copy, dark/light theme toggle.

## How It Works

1. You describe the product or topic you want reviewed.
2. A server‑side tool searches Reddit and retrieves relevant posts + comments.
3. The LLM analyzes signal vs. noise and emits a strict JSON schema.
4. The UI renders rating, pros/cons, and a concise description, with sources and reasoning available on demand.


## Tech Stack

- **Framework**: Next.js (App Router), TypeScript
- **LLM SDK**: Vercel AI SDK
- **UI**: Tailwind + shadcn/ui
- **Search**: Goolgle Search API, Reddit API
