import "server-only";

import type { OverviewRow } from "@/lib/data/league-ops";
import { createAdminClient } from "@/lib/supabase/admin";

// Logo downloads for admins (route /admin/logos checks the role first). Only files in our own public "logos"
// bucket are ever read, by storage path, so a stored URL can't make the server fetch anything else.

export type LogoKind = "college" | "club";

const BUCKET_PREFIX = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/logos/`;

/** "users/<uid>/college-x.png" for a URL in our logos bucket; null for anything else. */
export function logoPath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(BUCKET_PREFIX)) return null;
  const path = decodeURIComponent(url.slice(BUCKET_PREFIX.length));
  return /^[A-Za-z0-9/_.-]+$/.test(path) && !path.includes("..") ? path : null;
}

/** "IIT Guwahati" → "IIT-Guwahati" (safe in file and folder names). */
export function slug(text: string) {
  return text.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "college";
}

/** "IIT-Guwahati-college-logo.png": keeps the uploaded file's own extension. */
export function logoFileName(college: string, kind: LogoKind, path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "png";
  return `${slug(college)}-${kind}-logo.${ext}`;
}

/** A registration's logos that live in our bucket. The college logo falls back to the college master record's. */
export function logosOf(row: Pick<OverviewRow, "college_logo_url" | "club_logo_url">): { kind: LogoKind; path: string }[] {
  return (
    [
      ["college", logoPath(row.college_logo_url)],
      ["club", logoPath(row.club_logo_url)],
    ] as const
  ).flatMap(([kind, path]) => (path ? [{ kind, path }] : []));
}

/** The original file, byte for byte. */
export async function downloadLogo(path: string): Promise<{ data: Uint8Array<ArrayBuffer>; type: string } | null> {
  const { data, error } = await createAdminClient().storage.from("logos").download(path);
  if (error || !data) return null;
  return { data: new Uint8Array(await data.arrayBuffer()) as Uint8Array<ArrayBuffer>, type: data.type || "application/octet-stream" };
}
