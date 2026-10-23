import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Country } from "@/lib/validation/portal";

// Winners, contacts and participants across every college of one country, all seasons (search, POCs, exports).
// Reads with the admin's own session, so RLS ("winners/contacts/participants admin read") decides access.

const college = "registrations!inner(league_id, leagues(name), colleges!inner(name, country))";

export async function getWinners(country: Country) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("winners")
    .select(`id, registration_id, position, name, phone, email, upi_id, prize_type, prize_amount, payment_status, payment_reference, paid_at, merch_sent, ${college}`)
    .eq("registrations.colleges.country", country)
    .order("registration_id")
    .order("position");
  if (error) throw new Error(error.message);
  return data.map(({ registrations, ...w }) => ({ ...w, college: registrations.colleges.name, league: registrations.leagues.name }));
}

export async function getContacts(country: Country) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      `id, registration_id, role, is_primary, name, phone, email, year, course, matiks_username, tshirt_size, address, pincode, merch_description, merch_sent, merch_sent_at, ${college}`,
    )
    .eq("registrations.colleges.country", country)
    .order("registration_id")
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(({ registrations, ...c }) => ({ ...c, college: registrations.colleges.name, league: registrations.leagues.name }));
}

export async function getParticipants(country: Country) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participants")
    .select(`id, registration_id, name, email, matiks_username, year, ${college}`)
    .eq("registrations.colleges.country", country)
    .order("registration_id")
    .order("name");
  if (error) throw new Error(error.message);
  return data.map(({ registrations, ...p }) => ({ ...p, college: registrations.colleges.name, league: registrations.leagues.name }));
}

export type PersonHit = {
  kind: "winner" | "contact";
  registrationId: string;
  college: string;
  name: string;
  phone: string | null;
  email: string | null;
  detail: string;
};

/** Everyone admins might look up by name, phone or email (contacts = POCs, and winners). */
export async function getPeople(country: Country): Promise<PersonHit[]> {
  const [winners, contacts] = await Promise.all([getWinners(country), getContacts(country)]);
  return [
    ...contacts.map((c) => ({
      kind: "contact" as const,
      registrationId: c.registration_id,
      college: c.college,
      name: c.name,
      phone: c.phone,
      email: c.email,
      detail: c.is_primary ? "Primary POC" : "POC",
    })),
    ...winners
      .filter((w) => w.name || w.phone || w.email)
      .map((w) => ({
        kind: "winner" as const,
        registrationId: w.registration_id,
        college: w.college,
        name: w.name ?? "",
        phone: w.phone,
        email: w.email,
        detail: `Winner · ${w.position}`,
      })),
  ];
}

const digits = (v: string) => v.replace(/\D/g, "");

/** Name or email contains the query, or (3+ digits typed) the phone contains those digits. */
export function matchPeople(people: PersonHit[], query: string): PersonHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qDigits = digits(q);
  const byPhone = qDigits.length >= 3 && qDigits.length === q.replace(/[\s+()-]/g, "").length;
  return people.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (byPhone && p.phone && digits(p.phone).includes(qDigits)),
  );
}
