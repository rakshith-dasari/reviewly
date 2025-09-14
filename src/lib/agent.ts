import { getLLMResponse } from "./inference";

var systemPrompt = `You are an expert product reviewer of the product ${productName}.`;

export async function getAgentResponse(req: Request) {
  const { messages, model } = await req.json();

  // Initial LLM Response
  const response = await getLLMResponse(messages, model);
}
