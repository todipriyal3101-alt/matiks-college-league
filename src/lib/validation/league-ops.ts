import { z } from "zod";

import { Constants } from "@/lib/database.types";
import { adminDetailsSchema, phoneSchema } from "@/lib/validation/portal";

// League operations (SPEC "League operations"): shared by the editor (client) and server actions.

export const TSHIRT_SIZES = Constants.public.Enums.tshirt_size;
export const PRIZE_TYPES = Constants.public.Enums.prize_type;

export const PRIZE_TYPE_LABELS: Record<(typeof PRIZE_TYPES)[number], string> = {
  cash: "Cash",
  cash_plus_merch: "Cash + Merch",
  merch_only: "Merch only",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Max ${max} characters`)
    .transform((v) => v || null)
    .nullable();

const optionalMatch = (re: RegExp, message: string, max = 120) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => v === "" || re.test(v), message)
    .transform((v) => v || null)
    .nullable();

/**
 * Indian mobiles are stored as 10 digits (+91 / 0 prefixes dropped); other countries (USA POCs) as +country digits.
 * Empty → null.
 */
const optionalPhone = z
  .string()
  .trim()
  .transform((v) => {
    const compact = v.replace(/[\s().-]/g, "");
    const indian = compact.match(/^(?:\+91|0)?([6-9]\d{9})$/);
    return indian ? indian[1] : compact;
  })
  .refine((v) => v === "" || /^\+?\d{7,15}$/.test(v), "Enter a valid phone number")
  .transform((v) => v || null)
  .nullable();

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email")
  .transform((v) => v || null)
  .nullable();

const pincode = optionalMatch(/^([1-9]\d{5}|\d{5}(-\d{4})?)$/, "6-digit pincode (or US ZIP)", 10);
const upiId = optionalMatch(/^[\w.-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/, "UPI ID looks like name@bank");
const matiksUsername = optionalMatch(/^[A-Za-z0-9._-]+$/, "Letters, numbers, dot, dash or underscore", 50);
const tshirtSize = z.enum(TSHIRT_SIZES).nullable();
const rupees = z.coerce.number().int("Whole rupees only").min(0, "Can't be negative").max(10_00_000, "Too large");

/** Fields a POC or admin can edit on a contact. Admin-only merch fields are separate. */
export const contactSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.email("Enter a valid email").trim().toLowerCase().max(120),
  phone: optionalPhone,
  year: optionalText(40),
  course: optionalText(80),
  matiksUsername,
  tshirtSize,
  address: optionalText(300),
  pincode,
});

/** Fields a POC or admin can edit on a winner. Prize/payment/merch fields are admin-only (adminWinnerSchema). */
export const winnerSchema = z.object({
  id: z.uuid().optional(),
  position: z.string().trim().min(1, "Position is required").max(40),
  name: optionalText(80),
  email: optionalEmail,
  phone: optionalPhone,
  matiksUsername,
  upiId,
  tshirtSize,
  address: optionalText(300),
  pincode,
});

export const adminWinnerSchema = winnerSchema.extend({
  prizeType: z.enum(PRIZE_TYPES),
  prizeAmount: rupees,
  merchDescription: optionalText(200),
});

export const adminContactSchema = contactSchema.extend({
  merchDescription: optionalText(200),
});

/** The editor's one form (sticky "Unsaved changes · Save" bar). Admin mode uses the admin variants. */
export const editorSchema = z.object({
  teamName: optionalText(60),
  contacts: z.array(contactSchema).min(1, "Keep at least the primary contact").max(3, "Max 3 contacts"),
  winners: z.array(winnerSchema).max(50),
});

// Stage, review status, paid and merch are immediate toggles (with Undo), not part of the form.
export const adminEditorSchema = editorSchema.extend({
  contacts: z.array(adminContactSchema).min(1, "Keep at least the primary contact").max(3, "Max 3 contacts"),
  winners: z.array(adminWinnerSchema).max(50),
  participantCount: z.coerce.number("Enter a number").int("Whole number").min(0).max(100_000),
  /** Empty = no override (use the auto tier). */
  prizePoolOverride: z.preprocess((v) => (v === "" || v == null ? null : v), rupees.nullable()),
  /** Country (on the college) + college email/domain, logos, club, dates (migration 0005). */
  details: adminDetailsSchema,
});

export type EditorInput = z.input<typeof editorSchema>;
export type EditorData = z.output<typeof editorSchema>;
export type AdminEditorInput = z.input<typeof adminEditorSchema>;
export type AdminEditorData = z.output<typeof adminEditorSchema>;

/** "Mark paid" dialog: the bank / UPI transaction reference (UTR). */
export const markPaidSchema = z.object({
  winnerId: z.uuid(),
  utr: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,30}$/, "UTR is 6–30 letters or digits"),
});

/** Admin "Add college" (overview dialog + addCollege action). */
export const addCollegeSchema = z
  .object({
    leagueId: z.uuid(),
    collegeId: z.uuid().nullable(),
    newCollege: z
      .object({
        name: z.string().trim().min(3, "Enter the college's full name").max(200),
        city: z.string().trim().min(1, "City is required").max(80),
        state: z.string().trim().min(1, "State is required").max(80),
      })
      .nullable(),
    /** Email the POC a portal invite (default), so they can sign in without creating an account first. */
    invitePoc: z.boolean().default(true),
    /** Country (on the college) + the registration details; all optional except the country. */
    details: adminDetailsSchema,
    poc: z.object({
      name: z.string().trim().min(1, "POC name is required").max(80),
      phone: phoneSchema,
      email: z.email("Enter a valid email (needed for the portal invite)").trim().toLowerCase().max(120),
    }),
  })
  .refine((v) => v.collegeId || v.newCollege, { message: "Pick a college or add a new one", path: ["collegeId"] });

export type AddCollegeInput = z.input<typeof addCollegeSchema>;
