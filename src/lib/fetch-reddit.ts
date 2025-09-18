import { extractRedditCore, RedditCore } from "@/lib/reddit-extract";
import { google } from "googleapis";

const customsearch = google.customsearch("v1");

async function searchGoogle(query: string) {
  try {
    const res = await customsearch.cse.list({
      cx: process.env.GOOGLE_CSE_ID!, // Your Custom Search Engine ID
      q: query + "reddit",
      auth: process.env.GOOGLE_API_KEY!, // Your API key
    });
    return res.data.items?.slice(0, 5);
  } catch (error) {
    return [];
  }
}

async function fetchRedditJson(link: string): Promise<unknown> {
  const url = `${link}/.json`;
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain;q=0.9",
    "User-Agent": "reviewly/1.0 (+https://github.com/)",
  };
  const res = await fetch(url, { headers, redirect: "follow" });
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
  const posts = (await searchGoogle(query)) || [];
  const redditPosts = await fetchRedditPostsFromLinks(posts || []);
  return redditPosts;
}
