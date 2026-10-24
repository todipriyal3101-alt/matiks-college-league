// LinkedIn links for Campus Lead certificates (client + server safe).

export const CERT_NAME = "Campus Lead – Matiks College League";
const ORG_ID = process.env.NEXT_PUBLIC_LINKEDIN_ORG_ID?.trim();

/**
 * "Add to profile" (Licenses & certifications) via LinkedIn's add-to-profile URL. With NEXT_PUBLIC_LINKEDIN_ORG_ID
 * set, the certificate links to the Matiks company page; otherwise it uses organizationName "Matiks".
 */
export function addToProfileUrl(c: { id: string; issuedAt: string; certUrl: string }) {
  const issued = new Date(c.issuedAt);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: CERT_NAME,
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: c.certUrl,
    certId: c.id,
  });
  if (ORG_ID) params.set("organizationId", ORG_ID);
  else params.set("organizationName", "Matiks");
  return `https://www.linkedin.com/profile/add?${params}`;
}

/** LinkedIn's official share dialog only takes a URL (the page's preview image carries the message). */
export function shareOnLinkedInUrl(url: string) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

/** Ready-to-paste post text (the "Copy post text" button). */
export function certificatePostText(c: { college: string; season: string; url: string }) {
  return `Proud to be the Campus Lead for ${c.college} in the ${c.season} by Matiks! 🧠⚡

We're bringing our campus into India's inter-college mind sports league. Think your college can beat us? Take the 30-second math duel and rally your batch.

Verify my certificate: ${c.url}

#MatiksCollegeLeague #CampusLead #MindSports`;
}
