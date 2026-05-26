const axios = require("axios");

const REDDIT_BASE_URL = "https://www.reddit.com";
const DEFAULT_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = Number(process.env.REDDIT_CACHE_TTL_MS) || 10 * 60 * 1000;
const DEFAULT_USER_AGENT =
  process.env.REDDIT_USER_AGENT ||
  "agent-search/1.0 (local academic project)";

const reddit = axios.create({
  baseURL: REDDIT_BASE_URL,
  timeout: Number(process.env.REDDIT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  headers: {
    "User-Agent": DEFAULT_USER_AGENT,
    Accept: "application/json",
  },
});

const responseCache = new Map();

function getCacheValue(key) {
  const cached = responseCache.get(key);

  if (!cached || cached.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return cached.value;
}

function setCacheValue(key, value) {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getPostPermalink(post) {
  const permalink = post?.data?.permalink;

  if (!permalink) {
    return "";
  }

  return permalink.endsWith("/") ? permalink : `${permalink}/`;
}

async function searchRedditPosts(query, options = {}) {
  const limit = options.limit || 2;

  if (!query) {
    return [];
  }

  const cacheKey = `search:${query}:${limit}`;
  const cachedPosts = getCacheValue(cacheKey);

  if (cachedPosts) {
    return cachedPosts;
  }

  const response = await reddit.get("/search.json", {
    params: {
      q: query,
      sort: "relevance",
      t: "year",
      type: "link",
      limit,
    },
  });

  const posts = response.data?.data?.children || [];

  const normalizedPosts = posts
    .map((post) => ({
      id: post.data?.id,
      title: cleanText(post.data?.title),
      subreddit: post.data?.subreddit,
      score: post.data?.score ?? 0,
      commentsCount: post.data?.num_comments ?? 0,
      permalink: getPostPermalink(post),
      selftext: cleanText(post.data?.selftext),
    }))
    .filter((post) => post.id && post.permalink);

  setCacheValue(cacheKey, normalizedPosts);

  return normalizedPosts;
}

function flattenCommentTree(children, comments = []) {
  children.forEach((child) => {
    if (child.kind !== "t1") {
      return;
    }

    const body = cleanText(child.data?.body);

    if (body && body !== "[deleted]" && body !== "[removed]") {
      comments.push({
        body,
        score: child.data?.score ?? 0,
        subreddit: child.data?.subreddit,
      });
    }

    const replies = child.data?.replies?.data?.children;

    if (Array.isArray(replies) && comments.length < 12) {
      flattenCommentTree(replies, comments);
    }
  });

  return comments;
}

async function fetchPostComments(permalink, options = {}) {
  if (!permalink) {
    return [];
  }

  const limit = options.limit || 6;
  const cacheKey = `comments:${permalink}:${limit}`;
  const cachedComments = getCacheValue(cacheKey);

  if (cachedComments) {
    return cachedComments;
  }

  const response = await reddit.get(`${permalink}.json`, {
    params: {
      sort: "confidence",
      limit,
      raw_json: 1,
    },
  });

  const commentChildren = response.data?.[1]?.data?.children || [];
  const comments = flattenCommentTree(commentChildren)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  setCacheValue(cacheKey, comments);

  return comments;
}

async function searchRedditWithComments(query, options = {}) {
  const posts = await searchRedditPosts(query, {
    limit: options.postLimit || 2,
  });

  const commentsByPost = await Promise.all(
    posts.map(async (post) => {
      try {
        const comments = await fetchPostComments(post.permalink, {
          limit: options.commentLimit || 4,
        });

        return {
          ...post,
          comments,
        };
      } catch (err) {
        return {
          ...post,
          comments: [],
        };
      }
    })
  );

  return commentsByPost;
}

module.exports = {
  searchRedditPosts,
  fetchPostComments,
  searchRedditWithComments,
};
