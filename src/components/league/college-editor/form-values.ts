import type { RegistrationDetail } from "@/lib/data/league-ops";
import type { Tables } from "@/lib/database.types";
import type { AdminEditorInput } from "@/lib/validation/league-ops";

/** The editor form holds the admin superset; POC mode validates with the narrower schema (extra keys are dropped). */
export type EditorFormValues = AdminEditorInput;
export type ContactFormValues = EditorFormValues["contacts"][number];
export type WinnerFormValues = EditorFormValues["winners"][number];

const s = (v: string | null | undefined) => v ?? "";

export function contactToForm(c: Tables<"contacts">): ContactFormValues {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: s(c.phone),
    year: s(c.year),
    course: s(c.course),
    matiksUsername: s(c.matiks_username),
    tshirtSize: c.tshirt_size,
    address: s(c.address),
    pincode: s(c.pincode),
    merchDescription: s(c.merch_description),
  };
}

export function winnerToForm(w: Tables<"winners">): WinnerFormValues {
  return {
    id: w.id,
    position: w.position,
    name: s(w.name),
    email: s(w.email),
    phone: s(w.phone),
    matiksUsername: s(w.matiks_username),
    upiId: s(w.upi_id),
    tshirtSize: w.tshirt_size,
    address: s(w.address),
    pincode: s(w.pincode),
    prizeType: w.prize_type,
    prizeAmount: w.prize_amount,
    merchDescription: s(w.merch_description),
  };
}

export function toFormValues(detail: RegistrationDetail): EditorFormValues {
  return {
    teamName: s(detail.registration.team_name),
    participantCount: detail.registration.participant_count,
    prizePoolOverride: detail.registration.prize_pool_override ?? "",
    contacts: detail.contacts.map(contactToForm),
    winners: detail.winners.map(winnerToForm),
  };
}

export const EMPTY_CONTACT: ContactFormValues = {
  name: "",
  email: "",
  phone: "",
  year: "",
  course: "",
  matiksUsername: "",
  tshirtSize: null,
  address: "",
  pincode: "",
  merchDescription: "",
};

export function emptyWinner(position: string): WinnerFormValues {
  return {
    position,
    name: "",
    email: "",
    phone: "",
    matiksUsername: "",
    upiId: "",
    tshirtSize: null,
    address: "",
    pincode: "",
    prizeType: "cash",
    prizeAmount: 0,
    merchDescription: "",
  };
}

/** "1st", "2nd", "3rd", "4th" … for the next winner. */
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
