import Image from "next/image";

import mascot from "../../../public/brand/mascot.webp";

/** The Matiks mascot (public/brand/mascot.webp, from matiks.com). Public pages only, never the admin panel. */
export function Mascot({ className, priority, eager }: { className?: string; priority?: boolean; eager?: boolean }) {
  return (
    <Image
      src={mascot}
      alt=""
      className={className}
      sizes="(max-width: 640px) 160px, 280px"
      priority={priority}
      loading={eager && !priority ? "eager" : undefined}
    />
  );
}
