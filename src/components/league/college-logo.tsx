import Image from "next/image";

import { cn } from "@/lib/utils";

// Logos in our public bucket go through next/image (a 40px logo shouldn't cost a 150 KB original); next.config
// allows this host. Anything else stays a plain <img>.
const BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/`;

const TINTS = ["bg-[#ffd27a]", "bg-[#9cc7ff]", "bg-lilac", "bg-[#6ee7d8]", "bg-[#ff8f7a]", "bg-primary"];

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const caps = words.filter((w) => w === w.toUpperCase() && w.length > 1);
  if (caps.length) return caps[0].slice(0, 4);
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "?";
}

/** The college's uploaded logo, or its initials on a tint picked from the name (same name → same tint). */
export function CollegeLogo({ url, name, className }: { url: string | null | undefined; name: string; className?: string }) {
  if (url?.startsWith(BUCKET)) {
    return <Image src={url} alt="" width={128} height={128} className={cn("size-11 shrink-0 rounded-xl bg-white object-contain p-0.5", className)} />;
  }
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from our public bucket
      <img src={url} alt="" loading="lazy" className={cn("size-11 shrink-0 rounded-xl bg-white object-contain p-0.5", className)} />
    );
  }
  const tint = TINTS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TINTS.length];
  return (
    <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-[11px] font-bold text-background", tint, className)}>
      {initials(name)}
    </span>
  );
}
