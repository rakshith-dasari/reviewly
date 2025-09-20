import Sentiment from "sentiment";
import type { RedditCore } from "./reddit-extract";

const analyzer = new Sentiment();

export type PostSentimentPoint = {
  timestamp: number;
  score: number;
  magnitude: number;
  label: "positive" | "neutral" | "negative";
  title: string;
};

function classify(score: number): "positive" | "neutral" | "negative" {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

/**
 * Calculates sentiment for each reddit post (title + post body + top comments).
 * Returns a point per post for time-series visualization.
 */
export function computeSentimentSeries(
  posts: RedditCore[]
): PostSentimentPoint[] {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  return (
    posts
      .map((p) => {
        const text = [p.title, p.post, ...(p.comments || [])].join("\n\n");
        // Debug: log basic post info
        try {
          console.log("[sentiment] analyzing post", {
            title: p.title,
            createdAt: p.createdAt,
            commentsCount: (p.comments || []).length,
          });
        } catch {}
        const res = analyzer.analyze(text);
        const score = typeof res.score === "number" ? res.score : 0;
        const magnitude = Array.isArray(res.calculation)
          ? res.calculation.reduce((acc, token) => {
              const delta = Object.values(token)[0] as number;
              return acc + Math.abs(typeof delta === "number" ? delta : 0);
            }, 0)
          : Math.abs(score);
        const createdAtMaybe: unknown = (p as any)?.createdAt;
        const ts =
          typeof createdAtMaybe === "number" && Number.isFinite(createdAtMaybe)
            ? createdAtMaybe
            : Date.now();
        try {
          console.log("[sentiment] result", {
            title: p.title,
            score,
            magnitude,
            timestamp: ts,
          });
        } catch {}
        return {
          timestamp: ts as number,
          score,
          magnitude,
          label: classify(score),
          title: p.title,
        } as PostSentimentPoint;
      })
      // sort by timestamp ascending for line charts
      .sort((a, b) => a.timestamp - b.timestamp)
  );
}
