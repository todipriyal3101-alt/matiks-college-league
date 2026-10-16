import { formatINR, PRIZE_TIERS } from "@/lib/league";

// Landing page copy. The league name and dates come from the active league in the database.

const tiers = PRIZE_TIERS.map((t) => (t.min > 0 ? `${t.min}+ players: ${formatINR(t.amount)}` : `Fewer: ${formatINR(t.amount)}`));

/** Public support contact (Matiks staff, not a student). */
export const SUPPORT_EMAIL = "satish@matiks.com";

export const LANDING = {
  fallbackLeagueName: "Brumble 2.0",
  tagline: "Play it smart.",
  prizePool: `Up to ${formatINR(PRIZE_TIERS[0].amount)}`,
  prizeNote: "Bigger college turnout = bigger prize",
  format: ["7 days of play", "100% online, play from anywhere", "Your college vs the rest"],
  whoCanJoin: ["Everyone from your college", "Any year, any course"],
  faq: [
    {
      q: "How big is the prize pool?",
      a: `It grows with the number of students from your college who play. ${tiers.join(" · ")}.`,
    },
    {
      q: "Who registers our college?",
      a: "One student registers and becomes the point of contact. Once we approve it, they get an email invite to the college portal.",
    },
    {
      q: "My college is already registered. How do I join?",
      a: "Ask your college's point of contact to add you to the team.",
    },
  ],
} as const;
