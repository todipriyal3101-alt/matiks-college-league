import "server-only";

import { createClient } from "@/lib/supabase/server";

// Winners and contacts across every college of one season (admin pages, exports and search).
// Reads with the admin's own session, so RLS ("winners/contacts admin read") decides access.

export async function getSeasonWinners(leagueId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("winners")
    .select(
      "id, registration_id, position, name, phone, email, upi_id, prize_type, prize_amount, payment_status, payment_reference, paid_at, merch_sent, registrations!inner(league_id, colleges(name))",
    )
    .eq("registrations.league_id", leagueId)
    .order("registration_id")
    .order("position");
  if (error) throw new Error(error.message);
  return data.map(({ registrations, ...w }) => ({ ...w, college: registrations.colleges.name }));
}

export async function getSeasonContacts(leagueId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, registration_id, role, is_primary, name, phone, email, tshirt_size, address, pincode, merch_description, merch_sent, merch_sent_at, registrations!inner(league_id, colleges(name))",
    )
    .eq("registrations.league_id", leagueId)
    .order("registration_id")
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(({ registrations, ...c }) => ({ ...c, college: registrations.colleges.name }));
}

export type PersonHit = {
  kind: "winner" | "contact";
  registrationId: string;
  college: string;
  name: string;
  phone: string | null;
  detail: string;
};

/** Everyone a season's admins might look up by name or phone. */
export async function getSeasonPeople(leagueId: string): Promise<PersonHit[]> {
  const [winners, contacts] = await Promise.all([getSeasonWinners(leagueId), getSeasonContacts(leagueId)]);
  return [
    ...contacts.map((c) => ({
      kind: "contact" as const,
      registrationId: c.registration_id,
      college: c.college,
      name: c.name,
      phone: c.phone,
      detail: c.is_primary ? "Primary POC" : "Contact",
    })),
    ...winners
      .filter((w) => w.name || w.phone)
      .map((w) => ({
        kind: "winner" as const,
        registrationId: w.registration_id,
        college: w.college,
        name: w.name ?? "",
        phone: w.phone,
        detail: `Winner · ${w.position}`,
      })),
  ];
}

const digits = (v: string) => v.replace(/\D/g, "");

/** Name contains the query, or (3+ digits typed) the phone contains those digits. */
export function matchPeople(people: PersonHit[], query: string): PersonHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qDigits = digits(q);
  const byPhone = qDigits.length >= 3 && qDigits.length === q.replace(/[\s+()-]/g, "").length;
  return people.filter((p) => p.name.toLowerCase().includes(q) || (byPhone && p.phone && digits(p.phone).includes(qDigits)));
}
