// Cache tags for "use cache" data. After a mutation, call updateTag(tag) in a
// server action (shows immediately) or revalidateTag(tag, { expire: 0 }) in a route handler.
export const CACHE_TAGS = {
  league: "league",
  matches: "matches",
  /** Public /colleges wall (approved colleges). Bump on review-status changes, adds, deletes and merges. */
  colleges: "colleges",
  /** Launch pages: college race, home numbers, /c/[slug] (approved colleges' public data). Bumped with `colleges`. */
  race: "race",
  /** Activity ticker, early-bird spots, state rivalry (0008). Bumped on new registrations; also bump with `colleges`. */
  activity: "activity",
  /** "Top today" duel board. */
  duels: "duels",
} as const;
