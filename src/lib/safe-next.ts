/** Only same-site relative paths, so `next` params can't be used as an open redirect. */
export function safeNext(next: string | null | undefined, fallback = "/admin") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}
