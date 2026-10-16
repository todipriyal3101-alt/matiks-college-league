import type { Metadata } from "next";

import { AuthCard } from "@/components/auth-card";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard subtitle="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
