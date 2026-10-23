import { Glass } from "@/components/glass";

const wordmark = {
  maskImage: "url(/brand/matiks-logo.svg)",
  WebkitMaskImage: "url(/brand/matiks-logo.svg)",
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
} as const;

/** The big glass MATIKS banner at the bottom of the Overview (the real wordmark, tinted like frosted metal). */
export function MatiksBanner() {
  return (
    <Glass refract className="flex h-32 items-center justify-center overflow-hidden rounded-[2rem] sm:h-48" role="img" aria-label="Matiks">
      <span aria-hidden className="h-[62%] w-[80%] max-w-xl bg-linear-to-b from-white to-white/50" style={wordmark} />
    </Glass>
  );
}
