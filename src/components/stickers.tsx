import { cn } from "@/lib/utils";

// Decorative Matiks stickers (public/brand/stickers: WebP + PNG fallback, transparent). Purely decorative:
// aria-hidden, alt="", pointer-events: none, lazy, fixed size from width/height so nothing shifts.

const STICKERS = {
  trophy: { w: 584, h: 567 },
  streak: { w: 384, h: 513 },
  vault: { w: 582, h: 491 },
  "game-modes": { w: 585, h: 414 },
} as const;

export type StickerName = keyof typeof STICKERS;

export function Sticker({
  name,
  className,
  style,
  side,
  eager = false,
}: {
  name: StickerName;
  className?: string;
  style?: React.CSSProperties;
  side?: "left" | "right";
  /** In view on load (empty states): load at once so it never delays the page's largest paint. */
  eager?: boolean;
}) {
  const { w, h } = STICKERS[name];
  return (
    <picture className="contents">
      <source srcSet={`/brand/stickers/${name}.webp`} type="image/webp" />
      <img
        src={`/brand/stickers/${name}.png`}
        alt=""
        aria-hidden
        width={w}
        height={h}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className={cn("sticker pointer-events-none select-none", className)}
        style={style}
        data-side={side}
      />
    </picture>
  );
}

const PANELS = {
  admin: { left: "vault", right: "game-modes", leftTilt: "-8deg", rightTilt: "6deg" },
  poc: { left: "trophy", right: "streak", leftTilt: "-6deg", rightTilt: "8deg" },
} as const;

/**
 * Two stickers in the empty side gutters of a panel, fixed while scrolling. Sized to the gutter (never over the
 * content), shown only on wide screens (rules in globals.css "Panel stickers"); hidden on phones.
 */
export function PanelStickers({ panel }: { panel: keyof typeof PANELS }) {
  const p = PANELS[panel];
  return (
    <div aria-hidden className="panel-stickers" data-panel={panel}>
      <Sticker name={p.left} side="left" className="panel-sticker" style={{ "--tilt": p.leftTilt } as React.CSSProperties} />
      <Sticker name={p.right} side="right" className="panel-sticker" style={{ "--tilt": p.rightTilt } as React.CSSProperties} />
    </div>
  );
}

/** A small sticker for empty states (no chats yet, no winners yet, registration pending). All screen sizes. */
export function EmptyStateSticker({ name, className }: { name: StickerName; className?: string }) {
  return (
    <Sticker eager name={name} className={cn("sticker-float mx-auto h-auto w-24 sm:w-28", className)} style={{ "--tilt": "-4deg" } as React.CSSProperties} />
  );
}
