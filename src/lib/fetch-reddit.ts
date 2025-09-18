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

  if (!key || !cx) {
    console.error(
      "Missing Google CSE credentials: GOOGLE_API_KEY or GOOGLE_CSE_ID"
    );
    return [] as any[];
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", `${query} site:reddit.com`);
  url.searchParams.set("num", "5");

  try {
    console.log(`Searching Google CSE for: ${query}`);
    const res = await fetchWithTimeout(url, {
      cache: "no-store",
      timeoutMs: 10_000,
    });

    if (!res.ok) {
      console.error(
        `Google CSE request failed: ${res.status} ${res.statusText}`
      );
      return [] as any[];
    }

    const data = (await res.json()) as { items?: any[] };
    const items = (data.items || []).slice(0, 5);
    console.log(`Found ${items.length} Reddit links from Google CSE`);
    return items;
  } catch (error) {
    console.error("Google CSE search failed:", error);
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
      "Mozilla/5.0 (compatible; reviewly-bot/1.0; +https://reviewly.app)",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  };

  try {
    const res = await fetchWithTimeout(url, {
      headers,
      redirect: "follow",
      cache: "no-store",
      timeoutMs: 15_000, // Increased timeout for serverless
    });

    if (!res.ok) {
      console.error(
        `Reddit fetch failed: ${res.status} ${res.statusText} for ${url}`
      );
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      console.warn(`Non-JSON content-type received: ${contentType}`);
      // Some backends mislabel JSON as text/plain
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error(`Failed to parse response as JSON: ${parseError}`);
        throw new Error("Non-JSON response");
      }
    }
    return (await res.json()) as unknown;
  } catch (error) {
    console.error(`Error fetching Reddit JSON from ${url}:`, error);
    throw error;
  }
}

async function fetchRedditJsonWithRetry(
  link: string,
  maxRetries = 2
): Promise<unknown> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add exponential backoff delay for retries
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(
          `Retrying Reddit fetch (attempt ${
            attempt + 1
          }) after ${delay}ms delay`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      return await fetchRedditJson(link);
    } catch (error) {
      console.error(`Reddit fetch attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
  throw new Error("All retry attempts failed");
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

  console.log(`Processing ${redditItems.length} Reddit links`);

  if (redditItems.length === 0) {
    console.warn("No Reddit items found to process");
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
      console.log(`Fetching Reddit post: ${item.link}`);
      const redditJson = await fetchRedditJsonWithRetry(item.link);
      const redditCore = extractRedditCore(redditJson) as RedditCore;
      results.push(redditCore);
      console.log(`Successfully processed Reddit post: ${redditCore.title}`);
    } catch (error) {
      console.error(`Failed to fetch Reddit post ${item.link}:`, error);
      // skip this item on failure
      continue;
    }
  }

  console.log(
    `Successfully processed ${results.length} out of ${redditItems.length} Reddit posts`
  );

  if (results.length === 0) {
    console.warn("No Reddit posts could be processed successfully");
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
  try {
    console.log(`Starting Reddit search for query: ${query}`);

    // Validate environment variables
    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CSE_ID) {
      console.error("Missing required environment variables for Google CSE");
      return [
        {
          title: "Configuration Error",
          post: "Missing Google API credentials. Please check GOOGLE_API_KEY and GOOGLE_CSE_ID environment variables.",
          comments: [
            "Please configure Google Custom Search Engine credentials in your deployment settings.",
          ],
        },
      ];
    }

    // Use Google CSE to find Reddit post links
    const posts = (await searchGoogleRest(query)) || [];
    console.log(`Google CSE returned ${posts.length} results`);

    const redditPosts = await fetchRedditPostsFromLinks(posts || []);
    console.log(`Final result: ${redditPosts.length} Reddit posts processed`);

    return redditPosts;
  } catch (error) {
    console.error(
      `Critical error in fetchRedditPosts for query "${query}":`,
      error
    );
    return [
      {
        title: "Error",
        post: `Failed to fetch Reddit posts for "${query}". Please try again or check the deployment logs for more details.`,
        comments: [
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        ],
      },
    ];
  }
}
