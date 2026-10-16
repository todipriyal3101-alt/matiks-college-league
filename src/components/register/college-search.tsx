"use client";

import { CheckIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import type { CollegeSearchResult } from "@/lib/data/colleges";

const DEBOUNCE_MS = 250;

/** Type-ahead over /api/colleges/search. */
export function CollegeSearch({
  selectedId,
  selectedLabel,
  invalid,
  onSelect,
  onQueryChange,
  id = "college-search",
  placeholder = "Start typing your college name",
  autoFocus,
}: {
  selectedId: string | null;
  selectedLabel: string;
  invalid?: boolean;
  onSelect: (college: CollegeSearchResult) => void;
  onQueryChange?: (query: string) => void;
  id?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(selectedLabel);
  const [results, setResults] = useState<CollegeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const term = query.trim();
  const showResults = term.length >= 2 && term !== selectedLabel;

  useEffect(() => {
    if (!showResults) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/colleges/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { colleges?: CollegeSearchResult[] };
        setResults(data.colleges ?? []);
        setSearched(true);
      } catch {
        // Aborted or offline: keep the previous results.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, showResults]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={invalid}
          className="h-12 pl-9 text-base"
        />
        {loading && (
          <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && searched && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {results.length === 0 && !loading && (
            <li className="px-3 py-3 text-sm text-muted-foreground">No matching colleges yet.</li>
          )}
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery(c.name);
                  onSelect(c);
                }}
                className="flex min-h-12 w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span>
                  <span className="block text-sm font-medium">{c.name}</span>
                  {(c.city || c.state) && (
                    <span className="block text-xs text-muted-foreground">
                      {[c.city, c.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                </span>
                {c.id === selectedId && <CheckIcon className="mt-0.5 size-4 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
