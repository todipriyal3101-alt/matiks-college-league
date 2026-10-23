import { z } from "zod";

import { Constants } from "@/lib/database.types";

// POC portal + admin redesign (migration 0005). Shared by client forms and server actions (CLAUDE.md rule 5).

export const COUNTRIES = Constants.public.Enums.country;
export type Country = (typeof COUNTRIES)[number];

export const COUNTRY_LABELS: Record<Country, string> = { india: "India", usa: "USA" };
export const COUNTRY_FLAGS: Record<Country, string> = { india: "🇮🇳", usa: "🇺🇸" };

/** India: 10-digit mobile (+91 / 0 stripped). USA and others: 7–15 digits with an optional +country code. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, "Enter a valid phone number"));

export const personName = z.string().trim().min(2, "Enter your name").max(80, "Max 80 characters");

/** Sign-up and profile: name + phone, saved in the user's auth metadata. */
export const profileSchema = z.object({ name: personName, phone: phoneSchema });
export type ProfileInput = z.input<typeof profileSchema>;

export const signUpSchema = profileSchema.extend({
  email: z.email("Enter a valid email").trim().toLowerCase().max(120),
  password: z.string().min(8, "At least 8 characters").max(72),
});

/** "iitg.ac.in": lowercase, no "@", at least one dot. Same rule as registrations_email_domain_check. */
export const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export const emailDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^@+/, ""))
  .pipe(z.string().regex(DOMAIN_RE, "Enter a domain like iitg.ac.in"));

/** A file in our public "logos" bucket (same rule as the registrations_*_logo_check constraints). */
export const logoUrlSchema = z
  .string()
  .max(500)
  .regex(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/logos\/[A-Za-z0-9/_.-]+$/, "Upload the logo again")
  .nullable();

const isoDate = z.iso.date("Pick a date");

/** The registration details a POC fills in (Register tab) and admins can edit (college editor, Add college). */
export const registrationDetailsSchema = z
  .object({
    collegeEmail: z.email("Enter a valid email").trim().toLowerCase().max(254),
    emailDomain: emailDomainSchema,
    collegeLogoUrl: logoUrlSchema,
    clubName: z
      .string()
      .trim()
      .max(100, "Max 100 characters")
      .transform((v) => v || null)
      .nullable(),
    clubLogoUrl: logoUrlSchema,
    registrationStart: isoDate,
    leagueStart: isoDate,
    leagueEnd: isoDate,
  })
  .refine((v) => v.leagueStart >= v.registrationStart, {
    message: "League start can't be before registration start",
    path: ["leagueStart"],
  })
  .refine((v) => v.leagueEnd >= v.leagueStart, { message: "League end can't be before league start", path: ["leagueEnd"] });

export type RegistrationDetailsInput = z.input<typeof registrationDetailsSchema>;

// ---------- Contacts filled in by POCs (Register form + Team contacts) ----------

export const TSHIRT_SIZES = Constants.public.Enums.tshirt_size;
export const YEARS = ["1st year", "2nd year", "3rd year", "4th year", "5th year", "Postgraduate", "PhD", "Faculty", "Staff"] as const;

const blankToNull = (v: unknown) => (typeof v === "string" ? v.trim() || null : v);

/**
 * One contact as a POC enters it. Name, phone, email, year and Matiks username are required; T-shirt, address and
 * pincode can wait (the "Complete contact details" checklist item asks for them later).
 */
export const pocContactSchema = z.object({
  id: z.uuid().optional(),
  name: personName,
  phone: phoneSchema,
  email: z.email("Enter a valid email").trim().toLowerCase().max(120),
  year: z.string().trim().min(1, "Pick a year").max(40),
  matiksUsername: z
    .string()
    .trim()
    .min(2, "Enter the Matiks username")
    .max(50)
    .regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, dot, dash or underscore"),
  tshirtSize: z.enum(TSHIRT_SIZES).nullable(),
  address: z.preprocess(blankToNull, z.string().max(300, "Max 300 characters").nullable()),
  pincode: z.preprocess(blankToNull, z.string().regex(/^([1-9]\d{5}|\d{5}(-\d{4})?)$/, "6-digit pincode (or US ZIP)").nullable()),
});

export type PocContactInput = z.input<typeof pocContactSchema>;

/** Form values for one contact (strings; "" = empty). */
export type ContactFields = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  year: string;
  matiksUsername: string;
  tshirtSize: (typeof TSHIRT_SIZES)[number] | null;
  address: string;
  pincode: string;
};

export const EMPTY_CONTACT_FIELDS: ContactFields = {
  name: "",
  phone: "",
  email: "",
  year: "",
  matiksUsername: "",
  tshirtSize: null,
  address: "",
  pincode: "",
};

/** contacts row → form values. */
export function contactFieldsFromRow(c: {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  year: string | null;
  matiks_username: string | null;
  tshirt_size: (typeof TSHIRT_SIZES)[number] | null;
  address: string | null;
  pincode: string | null;
}): ContactFields {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email,
    year: c.year ?? "",
    matiksUsername: c.matiks_username ?? "",
    tshirtSize: c.tshirt_size,
    address: c.address ?? "",
    pincode: c.pincode ?? "",
  };
}

/** What's still missing for shipping merch (T-shirt, address, pincode). Empty = complete. */
export function missingContactDetails(c: { tshirt_size: string | null; address: string | null; pincode: string | null }) {
  return [!c.tshirt_size && "T-shirt", !c.address?.trim() && "address", !c.pincode?.trim() && "pincode"].filter(Boolean) as string[];
}

/** Register tab: the college (picked or new) + details + the primary POC's own contact details. */
export const pocRegisterSchema = z
  .object({
    collegeId: z.uuid().nullable(),
    collegeName: z.string().trim().max(200),
    country: z.enum(COUNTRIES),
    details: registrationDetailsSchema,
    contact: pocContactSchema,
  })
  .refine((v) => v.collegeId || v.collegeName.length >= 3, {
    message: "Pick your college or type its full name",
    path: ["collegeName"],
  });

export type PocRegisterInput = z.input<typeof pocRegisterSchema>;

export const denySchema = z.object({
  registrationId: z.uuid(),
  reason: z
    .string()
    .trim()
    .max(500, "Max 500 characters")
    .transform((v) => v || null)
    .nullable(),
});

export const chatMessageSchema = z.object({
  threadId: z.uuid(),
  body: z.string().trim().min(1, "Type a message").max(4000, "Max 4000 characters"),
});

export const POC_NOTIFY_SCOPES = ["all", "approved", "college"] as const;

export const pocNotificationSchema = z
  .object({
    title: z.string().trim().min(1, "Add a title").max(200),
    body: z
      .string()
      .trim()
      .max(2000)
      .transform((v) => v || null)
      .nullable(),
    scope: z.enum(POC_NOTIFY_SCOPES),
    country: z.enum(COUNTRIES),
    registrationId: z.uuid().nullable(),
  })
  .refine((v) => v.scope !== "college" || v.registrationId, { message: "Pick a college", path: ["registrationId"] });

export type PocNotificationInput = z.input<typeof pocNotificationSchema>;

/** "" (or spaces) → null, else trimmed and checked by `schema`. */
const optionalString = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), schema.nullable());

/**
 * Admin edits (Add college, college editor): the same details, all optional (older registrations have none).
 * Dates must still be in order when present.
 */
export const adminDetailsSchema = z
  .object({
    country: z.enum(COUNTRIES),
    collegeEmail: optionalString(z.email("Enter a valid email").toLowerCase().max(254)),
    emailDomain: optionalString(z.string().toLowerCase().transform((v) => v.replace(/^@+/, "")).pipe(z.string().regex(DOMAIN_RE, "Enter a domain like iitg.ac.in"))),
    collegeLogoUrl: logoUrlSchema,
    clubName: optionalString(z.string().max(100, "Max 100 characters")),
    clubLogoUrl: logoUrlSchema,
    registrationStart: optionalString(isoDate),
    leagueStart: optionalString(isoDate),
    leagueEnd: optionalString(isoDate),
  })
  .refine((v) => !v.registrationStart || !v.leagueStart || v.leagueStart >= v.registrationStart, {
    message: "League start can't be before registration start",
    path: ["leagueStart"],
  })
  .refine((v) => !v.leagueStart || !v.leagueEnd || v.leagueEnd >= v.leagueStart, {
    message: "League end can't be before league start",
    path: ["leagueEnd"],
  });

export type AdminDetailsInput = z.input<typeof adminDetailsSchema>;

/** The form shape both schemas read (strings; "" = empty). */
export type DetailsFormValues = {
  collegeEmail: string;
  emailDomain: string;
  collegeLogoUrl: string | null;
  clubName: string;
  clubLogoUrl: string | null;
  registrationStart: string;
  leagueStart: string;
  leagueEnd: string;
};

export const EMPTY_DETAILS: DetailsFormValues = {
  collegeEmail: "",
  emailDomain: "",
  collegeLogoUrl: null,
  clubName: "",
  clubLogoUrl: null,
  registrationStart: "",
  leagueStart: "",
  leagueEnd: "",
};

/** registrations row → form values. */
export function detailsFromRow(r: {
  college_email: string | null;
  email_domain: string | null;
  college_logo_url: string | null;
  club_name: string | null;
  club_logo_url: string | null;
  registration_start: string | null;
  league_start: string | null;
  league_end: string | null;
}): DetailsFormValues {
  return {
    collegeEmail: r.college_email ?? "",
    emailDomain: r.email_domain ?? "",
    collegeLogoUrl: r.college_logo_url,
    clubName: r.club_name ?? "",
    clubLogoUrl: r.club_logo_url,
    registrationStart: r.registration_start ?? "",
    leagueStart: r.league_start ?? "",
    leagueEnd: r.league_end ?? "",
  };
}

/** Parsed details → registrations columns. */
export function detailsToRow(d: {
  collegeEmail: string | null;
  emailDomain: string | null;
  collegeLogoUrl: string | null;
  clubName: string | null;
  clubLogoUrl: string | null;
  registrationStart: string | null;
  leagueStart: string | null;
  leagueEnd: string | null;
}) {
  return {
    college_email: d.collegeEmail,
    email_domain: d.emailDomain,
    college_logo_url: d.collegeLogoUrl,
    club_name: d.clubName,
    club_logo_url: d.clubLogoUrl,
    registration_start: d.registrationStart,
    league_start: d.leagueStart,
    league_end: d.leagueEnd,
  };
}

/** Team contacts: the primary contact first, up to 3 in all. */
export const teamContactsSchema = z.array(pocContactSchema).min(1, "Keep the primary contact").max(3, "A college can have at most 3 contacts");
