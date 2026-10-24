// The invite link someone arrived through (/i/CODE), last-touch, 30 days. Set in src/proxy.ts; read by the duel
// routes (plays) and the register action (registrations). Kept next to the UTM/ref attribution cookie.
export const INVITE_COOKIE = "mcl_invite";
export const INVITE_MAX_AGE = 60 * 60 * 24 * 30;
export const INVITE_CODE_RE = /^[a-z0-9]{10}$/;
