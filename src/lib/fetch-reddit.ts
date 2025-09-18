import { extractRedditCore, RedditCore } from "@/lib/reddit-extract";

/**
 * Simple timeout wrapper for fetch to avoid hanging in serverless environments.
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs = 10_000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function searchGoogleRest(query: string) {
  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return [] as any[];

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", `${query} reddit`);

  try {
    const res = await fetchWithTimeout(url, { cache: "no-store" });
    if (!res.ok) return [] as any[];
    const data = (await res.json()) as { items?: any[] };
    return (data.items || []).slice(0, 5);
  } catch {
    return [] as any[];
  }
}

// Discovery is performed via Google CSE only

async function fetchRedditJson(link: string): Promise<unknown> {
  const url = `${link}/.json`;
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain;q=0.9",
    "User-Agent":
      process.env.OUTBOUND_USER_AGENT ||
      "reviewly/1.0 (https://your-domain.example; contact@example.com)",
  };
  const res = await fetchWithTimeout(url, {
    headers,
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    // Some backends mislabel JSON as text/plain
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Non-JSON response");
    }
  }
  return (await res.json()) as unknown;
}

async function fetchRedditPostsFromLinks(items: any[]): Promise<RedditCore[]> {
  const redditItems = Array.isArray(items)
    ? items.filter((it) => {
        const link: string | undefined = it?.link;
        if (!link) return false;
        try {
          const u = new URL(link);
          return /(^|\.)reddit\.com$/.test(u.hostname.replace(/^www\./, ""));
        } catch {
          return false;
        }
      })
    : [];

  if (redditItems.length === 0) {
    return [
      {
        title: "No posts found",
        post: "No posts found",
        comments: ["No posts found"],
      },
    ];
  }

  const results: RedditCore[] = [];
  for (const item of redditItems) {
    try {
      const redditJson = await fetchRedditJson(item.link);
      const redditCore = extractRedditCore(redditJson) as RedditCore;
      results.push(redditCore);
    } catch {
      // skip this item on failure
      continue;
    }
  }

  if (results.length === 0) {
    return [
      {
        title: "No posts found",
        post: "No posts found",
        comments: ["No posts found"],
      },
    ];
  }
  return results;
}

export async function fetchRedditPosts(query: string) {
  // Use Google CSE to find Reddit post links
  const posts = (await searchGoogleRest(query)) || [];
  const redditPosts = await fetchRedditPostsFromLinks(posts || []);
  return redditPosts;
}
