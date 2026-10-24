import { BadgeCheckIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Glass } from "@/components/glass";
import { CertificateActions } from "@/components/launch/certificate-actions";
import { EmptyState } from "@/components/league/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicCertificate } from "@/lib/data/public";
import { CERT_NAME } from "@/lib/linkedin";
import { siteUrl } from "@/lib/site-url";

const CERT_ID = /^MCL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i;
const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

// Public verify page for a Campus Lead certificate. Never indexed (noindex + not in the sitemap + robots.txt).
export async function generateMetadata({ params }: PageProps<"/certificate/[id]">): Promise<Metadata> {
  const { id } = await params;
  const cert = CERT_ID.test(id) ? await getPublicCertificate(id) : null;
  return {
    title: cert ? `${cert.recipient_name} · ${CERT_NAME}` : "Certificate",
    description: cert ? `${cert.recipient_name} is the Campus Lead for ${cert.college_name} in the ${cert.season}.` : undefined,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default function CertificatePage({ params }: PageProps<"/certificate/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto aspect-[1200/848] w-full max-w-3xl rounded-3xl" />}>
      <Certificate params={params} />
    </Suspense>
  );
}

async function Certificate({ params }: Pick<PageProps<"/certificate/[id]">, "params">) {
  const { id } = await params;
  const cert = CERT_ID.test(id) ? await getPublicCertificate(id) : null;
  if (!cert) {
    return (
      <Glass className="mx-auto max-w-lg p-6">
        <EmptyState icon={SearchXIcon} title="This certificate isn't available" description="It may have been hidden by its owner, or the ID is wrong." />
      </Glass>
    );
  }
  const url = `${siteUrl}/certificate/${cert.id}`;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-olive px-3 py-1 text-sm font-bold text-primary">
          <BadgeCheckIcon className="size-4" aria-hidden /> Verified by Matiks
        </p>
        <h1 className="mt-2 text-5xl sm:text-6xl">{cert.recipient_name}</h1>
        <p className="mt-1 text-foreground/85">
          Campus Lead · <strong>{cert.college_name}</strong> · {cert.season}
        </p>
        <p className="text-sm text-muted-foreground">
          Issued {day.format(new Date(cert.issued_at))} · ID <span className="font-mono">{cert.id}</span>
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated certificate image */}
      <img
        src={`/certificate/${cert.id}/image`}
        alt={`Campus Lead certificate for ${cert.recipient_name}, ${cert.college_name}`}
        width={1200}
        height={848}
        className="w-full rounded-2xl shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]"
      />
      <CertificateActions id={cert.id} issuedAt={cert.issued_at} college={cert.college_name} season={cert.season} url={url} />
    </div>
  );
}
