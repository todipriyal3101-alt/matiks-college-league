import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getAdmin } from "@/lib/auth/admin";
import type { OverviewRow } from "@/lib/data/league-ops";
import {
  getAdminCountry,
  getOverviewRow,
  getRegistrations,
  inCollegeTab,
  matchesCollegeSearch,
  parseCollegeTab,
} from "@/lib/data/portal";
import { downloadLogo, logoFileName, logosOf, slug, type LogoKind } from "@/lib/logos";
import { COUNTRY_LABELS } from "@/lib/validation/portal";
import { zipStream, type ZipEntry } from "@/lib/zip";

// Logo downloads, admins and viewers only (rows are read with their own session, so RLS applies too).
//   ?registration=<id>&kind=college|club   one original file, e.g. IIT-Guwahati-college-logo.png
//   ?registration=<id>                     that college's logos as a ZIP
//   ?all=1&status=<tab>&q=<search>         every college in the selected country matching the /admin/colleges filter,
//                                          one folder per college; colleges without logos are skipped
export async function GET(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Not logged in", { status: 401 });

  const params = request.nextUrl.searchParams;
  const headers = { "Cache-Control": "no-store" };
  const registrationId = params.get("registration");

  if (registrationId) {
    if (!z.uuid().safeParse(registrationId).success) return new NextResponse("Bad request", { status: 400 });
    const row = await getOverviewRow(registrationId);
    if (!row) return new NextResponse("Not found", { status: 404 });
    const logos = logosOf(row);
    const kind = params.get("kind") as LogoKind | null;

    if (kind) {
      const logo = logos.find((l) => l.kind === kind);
      const file = logo && (await downloadLogo(logo.path));
      if (!logo || !file) return new NextResponse("No such logo", { status: 404 });
      return new NextResponse(file.data, {
        headers: {
          ...headers,
          "Content-Type": file.type,
          "Content-Disposition": `attachment; filename="${logoFileName(row.college_name ?? "college", kind, logo.path)}"`,
        },
      });
    }
    if (!logos.length) return new NextResponse("This college has no logos", { status: 404 });
    return zipResponse([row], `${slug(row.college_name ?? "college")}-logos.zip`);
  }

  if (params.get("all")) {
    const country = await getAdminCountry();
    const tab = parseCollegeTab(params.get("status"));
    const q = (params.get("q") ?? "").trim().toLowerCase().slice(0, 100);
    const rows = (await getRegistrations(country)).filter((r) => inCollegeTab(r, tab) && matchesCollegeSearch(r, q) && logosOf(r).length);
    if (!rows.length) return new NextResponse("No logos to download", { status: 404 });
    const name = `matiks-college-league-${COUNTRY_LABELS[country]}-${tab}-logos-${new Date().toISOString().slice(0, 10)}.zip`.toLowerCase();
    return zipResponse(rows, name);
  }

  return new NextResponse("Bad request", { status: 400 });
}

/** Streams a ZIP: one folder per college ("IIT-Guwahati/IIT-Guwahati-college-logo.png"). */
function zipResponse(rows: OverviewRow[], fileName: string) {
  async function* entries(): AsyncGenerator<ZipEntry> {
    const used = new Set<string>();
    for (const row of rows) {
      const college = row.college_name ?? "college";
      // Same college in two seasons: keep the folders apart.
      let folder = slug(college);
      if (used.has(folder)) folder = `${folder}-${slug(row.league_name ?? row.registration_id ?? "")}`;
      used.add(folder);
      for (const logo of logosOf(row)) {
        const file = await downloadLogo(logo.path);
        if (file) yield { name: `${folder}/${logoFileName(college, logo.kind, logo.path)}`, data: file.data };
      }
    }
  }
  return new NextResponse(zipStream(entries()), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
