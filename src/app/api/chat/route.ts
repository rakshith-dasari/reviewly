import { streamText, convertToModelMessages, stepCountIs, tool } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { fetchRedditPosts } from "@/lib/fetch-reddit";
import z from "zod";
import { createOpenAI } from "@ai-sdk/openai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { messages, model } = await req.json();
  const result = await streamText({
    system: `You are an expert product reviewer. You will be presented with reddit posts and comments about a product. Analyze them and produce a single JSON object only (no markdown, no code fences, no additional commentary) with the following exact schema:
{
  "rating": number (integer 1-10),
  "pros": string[],
  "cons": string[],
  "description": string
}
Rules:
- rating must be an integer between 1 and 10
- pros and cons should be concise bullet-style phrases (5-8 items combined preferred)
- description is a brief 2-3 sentence summary
Respond with JSON only.`,
    model: openrouter(model),
    tools: {
      redditSearch: tool({
        description: "Gets reddit posts and comments for a given query",
        inputSchema: z.object({
          query: z.string().describe("The product to search for"),
        }),
        execute: async ({ query }) => ({
          query,
          posts: await fetchRedditPosts(query),
        }),
      }),
    },
    stopWhen: stepCountIs(5), // stop after a maximum of 5 steps if tools were called
    messages: convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
