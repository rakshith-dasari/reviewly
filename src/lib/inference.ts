import {
  streamText,
  UIMessage,
  convertToModelMessages,
  generateText,
  tool,
  stepCountIs,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { fetchRedditPosts } from "./fetch-reddit";
// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function getLLMResponseTools(
  messages: UIMessage[],
  model: string
) {
  const result = await streamText({
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

export async function getLLMResponse(messages: UIMessage[], model: string) {
  const { text } = await generateText({
    model: openrouter(model),
    messages: convertToModelMessages(messages),
    system:
      "You are a helpful assistant that can answer questions and help with tasks",
  });
  return text;
}

export async function getLLMStreamResponse(req: Request) {
  const {
    messages,
    model,
  }: { messages: UIMessage[]; model: string; webSearch: boolean } =
    await req.json();

  const result = await streamText({
    model: openrouter(model),
    messages: convertToModelMessages(messages),
    system:
      "You are a helpful assistant that can answer questions and help with tasks",
  });

  // send sources and reasoning back to the client
  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
