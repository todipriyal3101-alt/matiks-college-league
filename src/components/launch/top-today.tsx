import { TrophyIcon } from "lucide-react";
import Link from "next/link";

import { Glass } from "@/components/glass";
import { getTopToday } from "@/lib/data/public";

/** Today's duel board (resets at midnight IST): first name + college only. */
export async function TopToday({ limit = 10 }: { limit?: number }) {
  const rows = await getTopToday(limit);
  return (
    <Glass className="p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-sans text-sm font-bold tracking-wide uppercase">
        <TrophyIcon className="size-4 text-primary" aria-hidden /> Top today
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No scores yet today. Be the first on the board!</p>
      ) : (
        <ol className="mt-2 divide-y divide-white/6">
          {rows.map((r, i) => (
            <li key={`${r.player_name}-${r.college_slug}-${i}`} className="flex items-center gap-3 py-2 text-sm">
              <span className={`w-5 font-display text-xl ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{r.player_name}</span>
                {r.college_name && (
                  <>
                    <span className="text-muted-foreground"> · </span>
                    {r.college_slug ? (
                      <Link href={`/c/${r.college_slug}`} className="text-muted-foreground hover:text-foreground">
                        {r.college_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{r.college_name}</span>
                    )}
                  </>
                )}
              </span>
              <span className="font-mono font-bold">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Glass>
  );
}
