// Admins enter times in India time (IST, UTC+5:30) regardless of their browser's timezone.

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in IST, for <input type="datetime-local">. */
export function toIstInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** "YYYY-MM-DDTHH:mm" entered as IST → ISO timestamp (UTC). */
export function fromIstInput(value: string): string {
  return new Date(`${value}:00+05:30`).toISOString();
}

export const istDateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export const istDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
