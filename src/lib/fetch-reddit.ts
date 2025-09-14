import { extractRedditCore, RedditCore } from "@/lib/reddit-extract";
import { google } from "googleapis";

const customsearch = google.customsearch("v1");

async function searchGoogle(query: string) {
  const res = await customsearch.cse.list({
    cx: process.env.GOOGLE_CSE_ID!, // Your Custom Search Engine ID
    q: query,
    auth: process.env.GOOGLE_API_KEY!, // Your API key
  });
  return res.data.items?.slice(0, 5);
}

async function fetchRedditPostsFromLinks(items: any[]): Promise<RedditCore[]> {
  if (items.length === 0) {
    return [
      {
        title: "No posts found",
        post: "No posts found",
        comments: ["No posts found"],
      },
    ] as RedditCore[];
  }
  return Promise.all(
    items.map(async (item) => {
      const redditJson = (await (
        await fetch(`${item.link}/.json`)
      ).json()) as unknown;
      const redditCore = extractRedditCore(redditJson) as RedditCore;
      return redditCore;
    }),
  );
}

export async function fetchRedditPosts(query: string) {
  const posts = (await searchGoogle(query)) || [];
  const redditPosts = await fetchRedditPostsFromLinks(posts || []);
  return redditPosts;
}
