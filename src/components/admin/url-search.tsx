"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A search box synced to ?q= (debounced), for server-filtered lists. */
export function UrlSearch({ placeholder, className }: { placeholder: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value.trim() === current) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 rounded-full pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-white/10"
          aria-label="Clear search"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
