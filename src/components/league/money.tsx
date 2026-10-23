import { formatMoney } from "@/lib/league";
import { cn } from "@/lib/utils";
import type { Country } from "@/lib/validation/portal";

/** Prize money, monospaced: ₹1,00,000 for India, $1,000 for the USA. */
export function Money({ amount, country = "india", className }: { amount: number | null | undefined; country?: Country; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>{formatMoney(amount, country)}</span>;
}
