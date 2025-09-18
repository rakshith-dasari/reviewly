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

// Realistic User-Agent strings to rotate through
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getRandomUserAgent(): string {
  return (
    process.env.OUTBOUND_USER_AGENT ||
    USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  );
}

async function randomDelay(min = 500, max = 1500) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function fetchRedditJson(link: string): Promise<unknown> {
  // Try different Reddit URL patterns to avoid detection
  const urlVariations = [
    `${link}/.json`,
    `${link.replace("www.reddit.com", "old.reddit.com")}/.json`,
    `${link}/.json?raw_json=1`,
    `${link}/.json?limit=100`, // Try with limit parameter
    `${link.replace("www.reddit.com", "i.reddit.com")}/.json`, // Try mobile interface
  ];

  for (let urlIndex = 0; urlIndex < urlVariations.length; urlIndex++) {
    const url = urlVariations[urlIndex];

    // Add random delay between different URL attempts
    if (urlIndex > 0) {
      await randomDelay(1000, 2000);
    }

    const headers: Record<string, string> = {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "User-Agent": getRandomUserAgent(),
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    };

    try {
      // Add small random delay to appear more human-like
      await randomDelay();

      const res = await fetchWithTimeout(url, {
        headers,
        redirect: "follow",
        cache: "no-store",
        timeoutMs: 20_000, // Increased timeout for serverless
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let data: unknown;

        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          // Try to parse as JSON even if content-type is wrong
          const text = await res.text();
          try {
            data = JSON.parse(text);
          } catch {
            // If this URL variation failed, try the next one
            console.warn(
              `Failed to parse JSON from ${url}, trying next variation...`
            );
            continue;
          }
        }

        console.log(`Successfully fetched Reddit data from ${url}`);
        return data;
      } else {
        console.warn(
          `Reddit fetch failed with ${res.status} for ${url}, trying next variation...`
        );
        // Don't throw immediately, try next URL variation
        continue;
      }
    } catch (error) {
      console.warn(`Error with ${url}:`, error);
      // Try next URL variation
      continue;
    }
  }

  // If all URL variations failed, throw error
  console.error(`All Reddit URL variations failed for ${link}`);
  throw new Error(
    `Failed to fetch Reddit data after trying ${urlVariations.length} different URLs`
  );
}

async function fetchRedditJsonWithRetry(
  link: string,
  maxRetries = 1 // Reduced retries since we try multiple URLs
): Promise<unknown> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add exponential backoff delay for retries
      if (attempt > 0) {
        const delay = Math.min(3000 * Math.pow(2, attempt - 1), 10000); // Longer delays
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
  for (let i = 0; i < redditItems.length; i++) {
    const item = redditItems[i];

    try {
      // Add random delay between posts to appear more human-like
      if (i > 0) {
        await randomDelay(2000, 4000);
      }

      console.log(
        `Fetching Reddit post ${i + 1}/${redditItems.length}: ${item.link}`
      );
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
