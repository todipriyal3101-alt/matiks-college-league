/* eslint-disable @next/next/no-img-element -- logos are user uploads from our public bucket, previewed live */
import { Logo } from "@/components/league/logo";
import { Sticker } from "@/components/stickers";
import { formatINR, prizeProgress } from "@/lib/league";
import { cn } from "@/lib/utils";
import type { Country } from "@/lib/validation/portal";

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const caps = words.filter((w) => w === w.toUpperCase() && w.length > 1);
  if (caps.length) return caps[0].slice(0, 4);
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "?";
}

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export function weekLabel(start: string, end: string) {
  if (!start) return null;
  const a = new Date(`${start}T00:00:00Z`);
  const b = end ? new Date(`${end}T00:00:00Z`) : null;
  return b ? `${day.format(a)} – ${day.format(b)} ${b.getUTCFullYear()}` : day.format(a);
}

/**
 * The college card as it builds (same layout as the 1200×627 image from /c/[slug]/card): name, logos, club, league
 * week and the prize tier the squad target unlocks. USA shows players only.
 */
export function CardPreview({
  name,
  place,
  season,
  country,
  collegeLogoUrl,
  clubName,
  clubLogoUrl,
  week,
  players,
  className,
}: {
  name: string;
  place: string | null;
  season: string;
  country: Country;
  collegeLogoUrl: string | null;
  clubName: string;
  clubLogoUrl: string | null;
  week: string | null;
  players: number;
  className?: string;
}) {
  const p = prizeProgress(players);
  const usa = country === "usa";
  const count = new Intl.NumberFormat("en-IN").format(p.players);
  const display = name.trim() || "Your college";

  return (
    <figure className={cn("space-y-2", className)} aria-label="Live preview of your college card">
      <div className="@container relative aspect-[1200/627] overflow-hidden rounded-[1.25rem] bg-[radial-gradient(circle_at_85%_15%,rgb(177_250_99/0.18),transparent_45%),radial-gradient(circle_at_0%_100%,rgb(184_167_245/0.18),transparent_45%),#161616] p-[4.5%] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        <Logo className="origin-top-left scale-[0.72]" />
        <div className="mt-[3%] flex items-center gap-[4%]">
          <span className="grid aspect-square w-[17%] shrink-0 place-items-center overflow-hidden rounded-[22%] bg-white text-[clamp(9px,2.4cqw,14px)] font-extrabold text-background">
            {collegeLogoUrl ? <img src={collegeLogoUrl} alt="" className="size-full object-contain" /> : initials(display)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[9px] font-bold tracking-[0.14em] text-muted-foreground uppercase sm:text-[10px]">
              {[season, place].filter(Boolean).join(" · ")}
            </p>
            <p className="line-clamp-2 font-display text-[clamp(20px,6.2cqw,40px)] leading-[0.92] break-words uppercase">{display}</p>
            <p className="font-display text-[clamp(20px,6.2cqw,40px)] leading-[0.92] text-primary uppercase">is in!</p>
          </div>
        </div>
        <div className="mt-[4%] max-w-[64%]">
          <p className="text-[11px] font-extrabold sm:text-sm">
            {count} players{!usa && <span className="text-primary"> · {formatINR(p.unlocked)} unlocked</span>}
          </p>
          {!usa && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8 sm:h-2">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#e8ff9c] transition-[width] duration-500" style={{ width: `${p.pct}%` }} />
            </div>
          )}
        </div>
        <Sticker name="trophy" className="absolute right-[5%] bottom-[6%] h-auto w-[19%]" style={{ "--tilt": "-8deg" } as React.CSSProperties} />
      </div>
      <figcaption className="glass-surface grid gap-1.5 rounded-2xl p-3.5 text-sm">
        <span className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Hosted by</span>
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            {clubLogoUrl && <img src={clubLogoUrl} alt="" className="size-6 rounded-md bg-white object-contain" />}
            <span className="truncate">{clubName.trim() || "—"}</span>
          </span>
        </span>
        <span className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">League week</span>
          <span className="font-semibold">{week ?? "—"}</span>
        </span>
      </figcaption>
    </figure>
  );
}
