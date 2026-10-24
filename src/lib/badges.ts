// POC badges (awarded by the database, migration 0007: refresh_badges()). Labels + how to earn, client-safe.
export const BADGES = [
  { key: "early_bird", label: "Early bird", emoji: "🐣", how: "One of the first 10 colleges approved this season" },
  { key: "full_squad", label: "Full squad", emoji: "🧑‍🤝‍🧑", how: "Add 3 team contacts" },
  { key: "club_200", label: "200 club", emoji: "🔥", how: "Reach 200 players" },
  { key: "club_400", label: "400 club", emoji: "⚡", how: "Reach 400 players" },
  { key: "club_600", label: "600 club", emoji: "🚀", how: "Reach 600 players" },
  { key: "recruiter", label: "Recruiter", emoji: "📣", how: "5+ people play or register through your invite link" },
  { key: "champion", label: "Champion", emoji: "🏆", how: "Finish the league with every prize paid" },
] as const;

export type BadgeKey = (typeof BADGES)[number]["key"];
