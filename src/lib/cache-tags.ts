// Cache tags for "use cache" data. After a mutation, call updateTag(tag) in a
// server action (shows immediately) or revalidateTag(tag, { expire: 0 }) in a route handler.
export const CACHE_TAGS = {
  league: "league",
  matches: "matches",
  /** Public /colleges wall (approved colleges). Bump on review-status changes, adds, deletes and merges. */
  colleges: "colleges",
} as const;
