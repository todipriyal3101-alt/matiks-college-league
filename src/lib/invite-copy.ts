/** Shared wording for invite pages and their preview images (first name + college only). */
export function inviteHeadline(i: { kind: string; display_name: string | null; college_name: string | null; score: number | null }) {
  const who = i.display_name ?? "A friend";
  const from = i.college_name ? ` from ${i.college_name}` : "";
  if (i.kind === "player" && i.score != null) return { title: `${who}${from} challenged you`, kicker: `Beat ${i.score}` };
  return { title: `${who}${from} invited you`, kicker: "Join the league" };
}
