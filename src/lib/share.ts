import { toast } from "sonner";

/** Copies `url` and confirms with a toast. */
export async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  } catch {
    toast.error("Couldn't copy the link.");
  }
}

/** Native share sheet on phones (touch + Web Share API); everywhere else, copy the link. */
export async function shareLink(url: string, title: string) {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return;
    } catch (e) {
      // Closing the sheet is not an error.
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  await copyLink(url);
}

/** Absolute URL of an admin page or the public registration form. */
export const absoluteUrl = (path: string) => new URL(path, window.location.origin).toString();
