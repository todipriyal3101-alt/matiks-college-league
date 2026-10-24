import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// Liquid Glass (CLAUDE.md rule 8 + globals.css "Liquid Glass"). One component for every glass surface.

const glassVariants = cva("", {
  variants: {
    variant: {
      /** Frosted panel: cards, stat tiles, nav. */
      panel: "glass rounded-3xl",
      /** Denser: anything floating over content. */
      strong: "glass-strong rounded-3xl",
      /** Same look without the blur, for repeated rows. */
      surface: "glass-surface rounded-2xl",
      /** Rounded pill: nav bars, segmented controls. */
      pill: "glass rounded-full",
    },
    refract: { true: "glass-refract", false: "" },
  },
  defaultVariants: { variant: "panel", refract: false },
});

export function Glass({
  className,
  variant,
  refract,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof glassVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return <Comp data-slot="glass" className={cn(glassVariants({ variant, refract }), className)} {...props} />;
}

/** The SVG filter behind `glass-refract` (on for Chromium only: <EarlyScript>). Rendered once in the root layout. */
export function LiquidGlassFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <filter id="liquid-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves={2} seed={7} result="noise" />
        <feGaussianBlur in="noise" stdDeviation={2} result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale={26} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
