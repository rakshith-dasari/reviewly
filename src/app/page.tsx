"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Actions, Action } from "@/components/ai-elements/actions";
import { Fragment, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { ToolUIPart } from "ai";
import { Response } from "@/components/ai-elements/response";
import { CopyIcon, RefreshCcwIcon, MoonIcon, SunIcon } from "lucide-react";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Review = {
  rating: number;
  pros: string[];
  cons: string[];
  description: string;
};

function parseReviewJSON(text: string): Review | null {
  const trimmed = String(text || "").trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;
  try {
    const obj = JSON.parse(unfenced);
    if (
      obj &&
      typeof obj.rating === "number" &&
      Number.isFinite(obj.rating) &&
      Math.floor(obj.rating) === obj.rating &&
      obj.rating >= 1 &&
      obj.rating <= 10 &&
      Array.isArray(obj.pros) &&
      Array.isArray(obj.cons) &&
      typeof obj.description === "string"
    ) {
      return {
        rating: obj.rating,
        pros: obj.pros.filter((p: unknown) => typeof p === "string"),
        cons: obj.cons.filter((c: unknown) => typeof c === "string"),
        description: obj.description,
      } as Review;
    }
  } catch (_) {
    // fall through
  }
  return null;
}

function ratingAccent(rating: number) {
  if (rating >= 8) {
    return {
      title: "text-green-600 dark:text-green-400",
      headerBg: "from-green-500/15 to-emerald-500/10",
      bar: "bg-green-500",
      border: "border-green-500/20 dark:border-green-400/20",
    } as const;
  }
  if (rating >= 5) {
    return {
      title: "text-amber-600 dark:text-amber-400",
      headerBg: "from-amber-500/15 to-yellow-500/10",
      bar: "bg-amber-500",
      border: "border-amber-500/20 dark:border-amber-400/20",
    } as const;
  }
  return {
    title: "text-red-600 dark:text-red-400",
    headerBg: "from-red-500/15 to-rose-500/10",
    bar: "bg-red-500",
    border: "border-red-500/20 dark:border-red-400/20",
  } as const;
}

function ReviewCards({ review }: { review: Review }) {
  const accent = ratingAccent(review.rating);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
      <Card className="border">
        <CardHeader className="pb-4 rounded-t-lg">
          <CardDescription>Rating</CardDescription>
          <CardTitle className={cn("text-4xl", accent.title)}>
            {review.rating}/10
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full", accent.bar)}
              style={{ width: `${review.rating * 10}%` }}
            />
          </div>
        </CardContent>
      </Card>
      <Card className="border">
        <CardHeader className="rounded-t-lg">
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6">{review.description}</p>
        </CardContent>
      </Card>
      <Card className="border">
        <CardHeader className="rounded-t-lg">
          <CardDescription>Pros</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {review.pros.map((p, i) => (
              <li key={`pro-${i}`}>{p}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="border">
        <CardHeader className="rounded-t-lg">
          <CardDescription>Cons</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {review.cons.map((c, i) => (
              <li key={`con-${i}`}>{c}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

type ModelOption = { name: string; value: string };

const defaultModels: ModelOption[] = [
  { name: "Kimi K2", value: "moonshotai/kimi-k2:free" },
  { name: "Deepseek V3.1", value: "deepseek/deepseek-chat-v3.1:free" },
  { name: "GLM 4.5 Air", value: "z-ai/glm-4.5-air:free" },
];

const models: ModelOption[] = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_MODELS;
    if (!raw) return defaultModels;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cleaned = parsed
        .map((m: any) => ({
          name: typeof m?.name === "string" ? m.name : String(m?.name ?? ""),
          value:
            typeof m?.value === "string" ? m.value : String(m?.value ?? ""),
        }))
        .filter((m) => !!m.name && !!m.value);
      return cleaned.length ? cleaned : defaultModels;
    }
  } catch (_) {
    // ignore and use defaults
  }
  return defaultModels;
})();

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(
    models[0]?.value ?? defaultModels[0].value
  );
  const [isDark, setIsDark] = useState<boolean>(true);
  const { messages, sendMessage, status, setMessages } = useChat();
  const suggestions = ["iPhone Air", "BMW M3", "Take Care by Drake"] as const;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const resolved = stored ? stored === "dark" : true;
      setIsDark(resolved);
    } catch (_) {
      // noop
    }
  }, []);

  const handleRetry = () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    const lastUserText = (
      lastUserMessage?.parts.find((p) => p.type === "text") as any
    )?.text as string | undefined;
    if (lastUserText) {
      sendMessage(
        { text: lastUserText },
        {
          body: {
            model: model,
          },
        }
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(
        { text: input },
        {
          body: {
            model: model,
          },
        }
      );
      setInput("");
    }
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = !isDark;
    setIsDark(next);
    if (next) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleReset = () => {
    setInput("");
    try {
      // Clear chat transcript
      setMessages([] as any);
    } catch (_) {
      // noop fallback
    }
    const el = document.getElementById(
      "chat-input"
    ) as HTMLTextAreaElement | null;
    el?.focus();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <h1 className="text-6xl font-bold mb-4 mt-4">Reviewly</h1>
        <h2 className="text-md font-light mb-4">Review anything.</h2>
        <Conversation className="h-full">
          <ConversationContent>
            {/* Live status indicator */}
            {(() => {
              // Determine a human-friendly live status label
              let liveLabel: string | null = null;

              // Show analyzing when user just submitted the prompt
              if (status === "submitted") {
                liveLabel = "Analyzing…";
              }

              // If a tool is currently running, show a tool-specific label
              // Find the most recent assistant tool part that hasn't completed
              for (let i = messages.length - 1; i >= 0; i--) {
                const m = messages[i];
                if (m.role !== "assistant") continue;
                for (let j = m.parts.length - 1; j >= 0; j--) {
                  const p: any = m.parts[j];
                  const typeStr: string | undefined =
                    typeof p?.type === "string" ? p.type : undefined;
                  const isToolPart =
                    !!typeStr &&
                    (typeStr === "dynamic-tool" || typeStr.startsWith("tool-"));
                  if (isToolPart) {
                    const state = p.state as string | undefined;
                    if (
                      state &&
                      state !== "output-available" &&
                      state !== "output-error"
                    ) {
                      const toolKey =
                        (p as any).toolName ||
                        (p as any).name ||
                        typeStr ||
                        "tool";
                      const keyStr = String(toolKey).toLowerCase();
                      if (keyStr.includes("reddit")) {
                        liveLabel = "Fetching Reddit posts…";
                      } else {
                        liveLabel = "Running tool…";
                      }
                      break;
                    }
                  }
                }
                if (liveLabel) break;
              }

              return liveLabel ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
                  <Loader size={14} />
                  <span>{liveLabel}</span>
                </div>
              ) : null;
            })()}
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "assistant" &&
                  message.parts.some((part) => part.type === "source-url") && (
                    <Sources>
                      <SourcesTrigger
                        count={
                          message.parts.filter(
                            (part) => part.type === "source-url"
                          ).length
                        }
                      />
                      {message.parts
                        .filter((part) => part.type === "source-url")
                        .map((part: any, i) => (
                          <SourcesContent key={`${message.id}-${i}`}>
                            <Source
                              key={`${message.id}-${i}`}
                              href={part.url}
                              title={part.url}
                            />
                          </SourcesContent>
                        ))}
                    </Sources>
                  )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      const text = (part as any).text as string;
                      const isStreamingThisPart =
                        status === "streaming" &&
                        i === message.parts.length - 1 &&
                        message.id === messages.at(-1)?.id;
                      const review = !isStreamingThisPart
                        ? parseReviewJSON(text)
                        : null;
                      return (
                        <Fragment key={`${message.id}-${i}`}>
                          <Message from={message.role}>
                            <MessageContent>
                              {review ? (
                                <ReviewCards review={review} />
                              ) : (
                                <Response>{text}</Response>
                              )}
                            </MessageContent>
                          </Message>
                          {message.role === "assistant" &&
                            message.id === messages.at(-1)?.id &&
                            i === message.parts.length - 1 && (
                              <Actions className="mt-2">
                                <Action onClick={handleRetry} label="Retry">
                                  <RefreshCcwIcon className="size-3" />
                                </Action>
                                <Action
                                  onClick={() =>
                                    navigator.clipboard.writeText(text)
                                  }
                                  label="Copy"
                                >
                                  <CopyIcon className="size-3" />
                                </Action>
                              </Actions>
                            )}
                        </Fragment>
                      );
                    case "reasoning":
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={
                            status === "streaming" &&
                            i === message.parts.length - 1 &&
                            message.id === messages.at(-1)?.id
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {(part as any).text}
                          </ReasoningContent>
                        </Reasoning>
                      );
                    // Tool UI parts are dynamic: types are "dynamic-tool" or "tool-<name>"
                    default: {
                      const p: any = part as any;
                      const typeStr: string | undefined =
                        typeof p?.type === "string" ? p.type : undefined;
                      const isToolPart =
                        !!typeStr &&
                        (typeStr === "dynamic-tool" ||
                          typeStr.startsWith("tool-"));
                      if (isToolPart) {
                        // Coerce the type for ToolHeader: ensure it matches ToolUIPart['type']
                        const toolType =
                          typeStr as unknown as ToolUIPart["type"];
                        return (
                          <Tool key={`${message.id}-${i}`}>
                            <ToolHeader type={toolType} state={p.state} />
                            <ToolContent>
                              <ToolInput input={p.input} />
                              <ToolOutput
                                output={p.output}
                                errorText={p.errorText}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    }
                  }
                })}
              </div>
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Suggested prompts */}
        <div className="mt-3 mb-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Try:</span>
          {suggestions.map((s) => (
            <Badge key={s} variant="secondary" asChild>
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => {
                  sendMessage(
                    { text: s },
                    {
                      body: {
                        model: model,
                      },
                    }
                  );
                  setInput("");
                  const el = document.getElementById(
                    "chat-input"
                  ) as HTMLTextAreaElement | null;
                  el?.focus();
                }}
              >
                {s}
              </button>
            </Badge>
          ))}
        </div>

        <PromptInput onSubmit={handleSubmit} className="mt-4">
          <PromptInputTextarea
            onChange={(e) => setInput(e.target.value)}
            value={input}
            id="chat-input"
          />
          <PromptInputToolbar>
            <PromptInputTools>
              <PromptInputButton
                variant="ghost"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                <span className="hidden sm:inline">
                  {isDark ? "Light" : "Dark"}
                </span>
              </PromptInputButton>
              <PromptInputButton
                variant="ghost"
                onClick={handleReset}
                aria-label="Reset chat"
              >
                <RefreshCcwIcon size={16} />
                <span className="hidden sm:inline">Reset</span>
              </PromptInputButton>
              <PromptInputModelSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {models.map((model) => (
                    <PromptInputModelSelectItem
                      key={model.value}
                      value={model.value}
                    >
                      {model.name}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input} status={status} />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
