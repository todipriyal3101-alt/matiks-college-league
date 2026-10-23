import { Glass } from "@/components/glass";
import { Logo } from "@/components/league/logo";

/** Same footprint as <PanelNav> while the user loads, so nothing jumps. */
export function NavFallback() {
  return (
    <div className="sticky top-3 z-40 px-4" aria-hidden>
      <Glass variant="pill" className="mx-auto flex h-14 max-w-6xl items-center pl-4 sm:h-15 sm:pl-5">
        <Logo />
      </Glass>
    </div>
  );
}
