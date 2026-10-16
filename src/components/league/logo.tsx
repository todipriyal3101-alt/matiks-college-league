import { cn } from "@/lib/utils";

// The real Matiks wordmark (public/brand/matiks-logo.svg, downloaded from matiks.com). The file is drawn in
// black; like matiks.com we tint it with CSS (a mask over a lime background), so it can also go black on lime.
const wordmark = {
  maskImage: "url(/brand/matiks-logo.svg)",
  WebkitMaskImage: "url(/brand/matiks-logo.svg)",
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "left center",
  WebkitMaskPosition: "left center",
} as const;

/** Matiks wordmark + "College League". Product name: never "MatiksLined". */
export function Logo({
  subtitle,
  compact,
  className,
}: {
  subtitle?: string;
  /** The "o/o" mark only (small screens). */
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <span className={cn("flex items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 288px brand icon, tiny and static */}
        <img src="/brand/icon.png" alt="" width={36} height={36} className="size-9 rounded-lg" />
        <span className="sr-only">Matiks College League</span>
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span aria-hidden className="h-[26px] w-[86px] shrink-0 bg-primary" style={wordmark} />
      <span className="leading-none">
        <span className="sr-only">Matiks </span>
        <span className="block font-display text-[19px] tracking-wide text-foreground uppercase">College League</span>
        {subtitle && <span className="mt-0.5 block text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{subtitle}</span>}
      </span>
    </span>
  );
}
