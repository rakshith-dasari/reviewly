import { extractRedditCore, RedditCore } from "@/lib/reddit-extract";
import { google } from "googleapis";

const customsearch = google.customsearch("v1");

async function searchGoogle(query: string) {
  console.log(`🔍 Searching Google for: "${query}"`);
  try {
    const res = await customsearch.cse.list({
      cx: process.env.GOOGLE_CSE_ID!, // Your Custom Search Engine ID
      q: query + "site:reddit.com",
      auth: process.env.GOOGLE_API_KEY!, // Your API key
    });
    const results = res.data.items?.slice(0, 5);
    console.log(
      `✅ Google search completed. Found ${results?.length || 0} results`
    );
    if (results) {
      console.log(
        "📋 Search results:",
        results.map((item) => ({ title: item.title, link: item.link }))
      );
    }
    return results;
  } catch (error) {
    console.error("❌ Google search failed:", error);
    return [];
  }
}

async function fetchRedditJson(
  link: string,
  accessToken: string
): Promise<unknown> {
  console.log(`📥 Fetching Reddit JSON from: ${link}`);
  try {
    const res = await fetch(`${link}/.json`, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        "User-Agent": "my-app/1.0",
      },
    });
    console.log(`✅ Reddit JSON fetch successful for: ${link}`);
    const data = await res.json();
    console.log(`📊 Reddit JSON data received, status: ${res.status}`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch Reddit JSON from ${link}:`, error);
    throw error;
  }
}

async function fetchRedditAccessToken() {
  console.log("🔑 Requesting Reddit access token...");
  try {
    const auth = Buffer.from(
      `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
    ).toString("base64");

    console.log("📤 Making OAuth request to Reddit API...");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "User-Agent": "my-app/1.0",
        ContentType: "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "password",
        username: process.env.REDDIT_USERNAME!,
        password: process.env.REDDIT_PASSWORD!,
        scope: "read submit identity",
      }),
    }).then((res) => res.json());

    if (res.access_token) {
      console.log("✅ Reddit access token obtained successfully");
    } else {
      console.error("❌ Failed to obtain Reddit access token:", res);
    }

    return res.access_token;
  } catch (error) {
    console.error("❌ Error fetching Reddit access token:", error);
    throw error;
  }
}

async function fetchRedditPostsFromLinks(items: any[]): Promise<RedditCore[]> {
  console.log(`🔗 Processing ${items?.length || 0} items for Reddit links...`);

  const accessToken = await fetchRedditAccessToken();
  const redditItems = Array.isArray(items)
    ? items.filter((it) => {
        const link: string | undefined = it?.link;
        if (!link) return false;
        try {
          const u = new URL(link);
          const isReddit = /(^|\.)reddit\.com$/.test(
            u.hostname.replace(/^www\./, "")
          );
          if (isReddit) {
            console.log(`✅ Valid Reddit link found: ${link}`);
          }
          return isReddit;
        } catch {
          console.log(`❌ Invalid URL format: ${link}`);
          return false;
        }
      })
    : [];

  console.log(`📊 Filtered to ${redditItems.length} Reddit items`);

  // Replace www.reddit.com with oauth.reddit.com for better OAuth API access
  redditItems.forEach((item) => {
    if (item.link && item.link.includes("www.reddit.com")) {
      const originalLink = item.link;
      item.link = item.link.replace("www.reddit.com", "oauth.reddit.com");
      console.log(`🔄 Replaced URL: ${originalLink} -> ${item.link}`);
    }
  });

  if (redditItems.length === 0) {
    console.log("⚠️ No Reddit items found, returning placeholder");
    return [
      {
        title: "No posts found",
        post: "No posts found",
        comments: ["No posts found"],
      },
    ];
  }

  console.log(`🔄 Starting to process ${redditItems.length} Reddit posts...`);
  const results: RedditCore[] = [];
  for (const [index, item] of redditItems.entries()) {
    try {
      console.log(
        `📝 Processing post ${index + 1}/${redditItems.length}: ${item.link}`
      );
      const redditJson = await fetchRedditJson(item.link, accessToken);
      const redditCore = extractRedditCore(redditJson) as RedditCore;
      results.push(redditCore);
      console.log(`✅ Successfully processed post: "${redditCore.title}"`);
    } catch (error) {
      console.error(
        `❌ Failed to process post ${index + 1}: ${item.link}`,
        error
      );
      // skip this item on failure
      continue;
    }
  }

  console.log(
    `📊 Successfully processed ${results.length} out of ${redditItems.length} Reddit posts`
  );

  if (results.length === 0) {
    console.log("⚠️ No posts successfully processed, returning placeholder");
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
  console.log(`🚀 Starting Reddit post fetch for query: "${query}"`);

  const posts = (await searchGoogle(query)) || [];
  console.log(`📥 Received ${posts.length} posts from Google search`);

  const redditPosts = await fetchRedditPostsFromLinks(posts || []);
  console.log(`🎉 Final result: ${redditPosts.length} Reddit posts retrieved`);

  return redditPosts;
}
