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

const istTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const istDayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** "just now", "5 min ago", "3 h ago", else "12 Oct". For notifications and the chat list. */
export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return istDayMonth.format(new Date(iso));
}

/** Chat message time: "4:05 pm" today, else "12 Oct, 4:05 pm" (IST). */
export function formatMessageTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameDay = istDate.format(d) === istDate.format(now);
  return sameDay ? istTime.format(d) : `${istDayMonth.format(d)}, ${istTime.format(d)}`;
}

/** A plain "YYYY-MM-DD" date column → "15 Nov 2026" (no timezone shift). */
export function formatDay(date: string | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
