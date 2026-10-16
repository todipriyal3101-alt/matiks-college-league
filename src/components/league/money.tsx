import { formatINR } from "@/lib/league";
import { cn } from "@/lib/utils";

/** Rupee amount in Indian format, monospaced (₹1,00,000). */
export function Money({ amount, className }: { amount: number | null | undefined; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>{formatINR(amount)}</span>;
}
