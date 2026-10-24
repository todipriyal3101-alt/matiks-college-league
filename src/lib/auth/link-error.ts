// Dead Supabase email links (expired, already used) come back as ?error=access_denied&error_code=otp_expired&
// error_description=… in the query or the #hash. Every page sends them to /login with one friendly message: the query
// in src/proxy.ts and /auth/callback, the hash in <EarlyScript> (the server never sees it).

export const LINK_ERROR_LOGIN = "/login?error=link_expired";

/** Supabase's auth error params (not our own /login?error=…, which has no error_code or error_description). */
export function isAuthLinkError(params: URLSearchParams) {
  return params.has("error_code") || params.has("error_description");
}
