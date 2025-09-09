export type RedditCore = {
    title: string;
    post: string;      // selftext
    comments: string[]; // top 5 top-level comments by score, cleaned
  };
  
  /**
   * Extracts { title, post, comments } from Reddit .json
   * @param input The parsed Reddit JSON (usually an array of 2 listings: [postListing, commentsListing])
   */
  export function extractRedditCore(input: unknown): RedditCore {
    const arr = Array.isArray(input) ? input : [];
  
    // --- Post (t3) ---
    const postListing = arr[0] as any;
    const postChild =
      postListing?.data?.children?.find((c: any) => c?.kind === "t3") ?? postListing?.data?.children?.[0];
  
    const title: string = (postChild?.data?.title ?? "").toString();
    const post: string = (postChild?.data?.selftext ?? "").toString();
  
    // --- Comments (t1), top-level only ---
    const commentsListing = arr[1] as any;
    const rawTopLevel = Array.isArray(commentsListing?.data?.children)
      ? commentsListing.data.children.filter((c: any) => c?.kind === "t1").map((c: any) => c.data)
      : [];
  
    // Clean & rank
    const cleaned = rawTopLevel
      .map((d: any) => {
        const body = (d?.body ?? "").toString().trim();
        const score = Number.isFinite(d?.score) ? Number(d.score) : 0;
        return { body, score };
      })
      .filter(
        (c: any) =>
          c.body &&
          c.body.toLowerCase() !== "[deleted]" &&
          c.body.toLowerCase() !== "[removed]"
      )
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5)
      .map((c: any) => c.body);
  
    return { title, post, comments: cleaned };
  }
  
  /* Example usage:
  
  import { extractRedditCore } from "./extractRedditCore";
  
  const json = await (await fetch("https://www.reddit.com/r/typescript/comments/xxxxxx.json")).json();
  const { title, post, comments } = extractRedditCore(json);
  console.log({ title, post, comments });
  
  */
  