import { z } from "zod";

import { Constants } from "@/lib/database.types";

// Shared by the /register form (client) and submitRegistration (server).

export const COLLEGE_TYPES = Constants.public.Enums.college_type;

export const COLLEGE_TYPE_LABELS: Record<(typeof COLLEGE_TYPES)[number], string> = {
  iit: "IIT",
  nit: "NIT",
  iiit: "IIIT",
  bits: "BITS",
  government: "Government",
  private: "Private",
  other: "Other",
};

export const YEARS = ["1st year", "2nd year", "3rd year", "4th year", "5th year", "Postgraduate", "Other"] as const;

/** Same rule as the colleges.normalized_name generated column. */
export function normalizeCollegeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const text = (max: number) => z.string().trim().max(max, `Max ${max} characters`);
const required = (label: string, max = 120) => text(max).min(1, `${label} is required`);

const matiksUsername = required("Matiks username", 50).regex(
  /^[A-Za-z0-9._-]+$/,
  "Letters, numbers, dot, dash or underscore only",
);

export const collegeStepSchema = z
  .object({
    collegeId: z.uuid().nullable(),
    collegeLabel: text(200), // display only: the picked college's name
    notListed: z.boolean(),
    newCollege: z.object({
      name: text(200),
      city: text(80),
      state: text(80),
      type: z.enum(COLLEGE_TYPES),
    }),
  })
  .superRefine((v, ctx) => {
    if (!v.notListed) {
      if (!v.collegeId) {
        ctx.addIssue({ code: "custom", path: ["collegeId"], message: "Pick your college from the list" });
      }
      return;
    }
    if (normalizeCollegeName(v.newCollege.name).length < 3) {
      ctx.addIssue({ code: "custom", path: ["newCollege", "name"], message: "Enter your college's full name" });
    }
    if (!v.newCollege.city) {
      ctx.addIssue({ code: "custom", path: ["newCollege", "city"], message: "City is required" });
    }
    if (!v.newCollege.state) {
      ctx.addIssue({ code: "custom", path: ["newCollege", "state"], message: "State is required" });
    }
  });

export const pocStepSchema = z.object({
  name: required("Name", 80),
  email: z.email("Enter a valid email").trim().toLowerCase().max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")),
  year: z.enum(YEARS, "Select your year"),
  // Optional on the public form (2-step registration); the POC can add it later in the college portal.
  course: text(80),
  matiksUsername,
});

export const teammateSchema = z.object({
  name: required("Name", 80),
  email: z.union([z.literal(""), z.email("Enter a valid email").trim().toLowerCase().max(120)]),
  matiksUsername,
});

export const teamStepSchema = z.object({
  teamName: text(60),
  teammates: z.array(teammateSchema).max(10, "Max 10 teammates"),
});

export const reviewStepSchema = z.object({
  consent: z.literal(true, "Please accept to continue"),
  turnstileToken: z.string().min(1, "Please complete the captcha"),
});

export const registrationSchema = z.object({
  college: collegeStepSchema,
  poc: pocStepSchema,
  team: teamStepSchema,
  review: reviewStepSchema,
});

export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationData = z.output<typeof registrationSchema>;

export type RegistrationResult =
  | { status: "already_registered"; collegeName: string; pocFirstName: string | null }
  | { status: "closed" }
  | { status: "error"; message: string };
