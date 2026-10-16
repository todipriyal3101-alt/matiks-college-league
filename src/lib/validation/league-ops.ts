import { z } from "zod";

import { Constants } from "@/lib/database.types";
import { REVIEW_STATUSES, STAGES } from "@/lib/league";

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

/** 10-digit Indian mobile; accepts +91 / 0 prefixes and spaces. Empty → null. */
const optionalPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))
  .refine((v) => v === "" || /^[6-9]\d{9}$/.test(v), "Enter a 10-digit Indian mobile number")
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

const pincode = optionalMatch(/^[1-9]\d{5}$/, "6-digit pincode", 6);
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

export const adminEditorSchema = editorSchema.extend({
  contacts: z.array(adminContactSchema).min(1, "Keep at least the primary contact").max(3, "Max 3 contacts"),
  winners: z.array(adminWinnerSchema).max(50),
  stage: z.enum(STAGES),
  reviewStatus: z.enum(REVIEW_STATUSES),
  participantCount: z.coerce.number().int().min(0).max(100_000),
  prizePoolOverride: rupees.nullable(),
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

// ---------- Overview filters (synced to the URL) ----------

export const OVERVIEW_SORTS = ["college", "participants", "prize", "newest"] as const;

export const overviewFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  review: z.enum([...REVIEW_STATUSES, "all"]).catch("all"),
  stage: z.enum([...STAGES, "all"]).catch("all"),
  source: z.string().trim().max(50).catch("all"),
  sort: z.enum(OVERVIEW_SORTS).catch("college"),
});

export type OverviewFilters = z.output<typeof overviewFiltersSchema>;

/** Parse filters from URL search params; anything invalid falls back to the default. */
export function parseOverviewFilters(params: Record<string, string | string[] | undefined>): OverviewFilters {
  const pick = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return overviewFiltersSchema.parse({
    q: pick("q") ?? "",
    review: pick("review") ?? "all",
    stage: pick("stage") ?? "all",
    source: pick("source") ?? "all",
    sort: pick("sort") ?? "college",
  });
}
