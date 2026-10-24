"use client";

import { useState } from "react";

import type { ActivityItem } from "@/components/launch/activity-ticker";
import { ClaimScreen, type PendingJoin } from "@/components/register/claim-screen";
import { RegisterStepper, type StepperState } from "@/components/register/register-stepper";
import type { CollegeSearchResult } from "@/lib/data/colleges";
import {
  EMPTY_CONTACT_FIELDS,
  EMPTY_DETAILS,
  TARGET_DEFAULT,
  type ContactFields,
  type DetailsFormValues,
  type RegisterDraft,
} from "@/lib/validation/portal";

/** Register tab before a registration exists: the claim screen, then the stepper (resumed from a saved draft). */
export function RegisterFlow({
  userId,
  email,
  profile,
  season,
  today,
  draft,
  activity,
  earlyBirdLeft,
  pendingJoin,
  verifyEnabled,
  draftVerified,
  squadError,
}: {
  userId: string;
  email: string;
  profile: { name: string; phone: string };
  season: string;
  today: string;
  draft: RegisterDraft | null;
  activity: ActivityItem[];
  earlyBirdLeft: number;
  pendingJoin: PendingJoin | null;
  verifyEnabled: boolean;
  draftVerified: boolean;
  squadError: string | null;
}) {
  const fresh = (college: CollegeSearchResult | null, newName: string | null): StepperState => ({
    step: college ? 1 : 0,
    college,
    newName,
    country: college?.country ?? "india",
    details: { ...EMPTY_DETAILS, registrationStart: today },
    contact: { ...EMPTY_CONTACT_FIELDS, name: profile.name, phone: profile.phone, email },
    targetPlayers: TARGET_DEFAULT,
    customDates: false,
  });

  const resumed: StepperState | null =
    draft && (draft.college || draft.newName != null)
      ? {
          step: draft.step ?? 0,
          college: draft.college ? { ...draft.college, short_name: null } : null,
          newName: draft.newName ?? null,
          country: draft.country ?? "india",
          details: { ...EMPTY_DETAILS, registrationStart: today, ...(draft.details as Partial<DetailsFormValues>) },
          contact: { ...EMPTY_CONTACT_FIELDS, name: profile.name, phone: profile.phone, email, ...(draft.contact as Partial<ContactFields>) },
          targetPlayers: draft.targetPlayers ?? TARGET_DEFAULT,
          customDates: draft.customDates ?? false,
        }
      : null;

  const [state, setState] = useState<StepperState | null>(resumed);
  // A new key per claim restarts the stepper (and its autosave) from that college.
  const [run, setRun] = useState(0);

  if (!state) {
    return (
      <ClaimScreen
        season={season}
        activity={activity}
        earlyBirdLeft={earlyBirdLeft}
        pendingJoin={pendingJoin}
        squadError={squadError}
        onClaim={(college, newName) => {
          setState(fresh(college, newName));
          setRun((n) => n + 1);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }
  return (
    <RegisterStepper
      key={run}
      initial={state}
      userId={userId}
      season={season}
      today={today}
      verifyEnabled={verifyEnabled}
      initiallyVerified={run === 0 && draftVerified}
      onChangeCollege={() => setState(null)}
    />
  );
}
