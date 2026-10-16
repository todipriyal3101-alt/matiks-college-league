// Landing page copy. Everything marked TODO is a placeholder waiting for final copy.
// The league name and registration deadline come from the active league in the database when set.

export const LANDING = {
  fallbackLeagueName: "Brumble 2.0",
  tagline: "TODO: tagline",
  prizePool: "TODO: prize pool",
  format: [
    // TODO: describe the league format (rounds, team size, games played).
    "TODO: format point 1",
    "TODO: format point 2",
    "TODO: format point 3",
  ],
  timeline: [
    { label: "Registration closes", date: "TODO: date" }, // replaced by leagues.registration_deadline when set
    { label: "Qualifiers", date: "TODO: date" },
    { label: "Finals", date: "TODO: date" },
  ],
  whoCanJoin: [
    // TODO: eligibility rules.
    "TODO: who can join",
  ],
  faq: [
    // TODO: final FAQ.
    { q: "TODO: question 1", a: "TODO: answer 1" },
    { q: "TODO: question 2", a: "TODO: answer 2" },
    { q: "TODO: question 3", a: "TODO: answer 3" },
  ],
} as const;
