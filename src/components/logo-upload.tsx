"use client";

import { CameraIcon, ImageUpIcon, Loader2Icon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 1200;

/** Camera photos are big (and sometimes HEIC): redraw anything too large or not PNG/JPG/WebP as a ≤1200px JPEG. */
async function shrink(file: File): Promise<File> {
  if (file.size <= MAX_BYTES && file.type in TYPES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // Not decodable here: the checks below explain what to do.
  }
}

/**
 * Uploads a logo to the public "logos" bucket and returns its public URL (migration 0005: images only, max 2 MB;
 * storage policies decide which folders the user may write: users/<uid>/…, registrations/<id>/…, admins anywhere).
 */
export function LogoUpload({
  folder,
  name,
  value,
  onChange,
  label,
  hint = "PNG, JPG or WebP · max 2 MB",
  disabled,
  invalid,
  camera = false,
}: {
  /** e.g. `users/<uid>` or `registrations/<id>` */
  folder: string;
  /** File name without extension: "college" | "club". */
  name: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Phones: also offer "Take photo" (opens the camera). */
  camera?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(picked: File) {
    setError(null);
    const file = await shrink(picked);
    const ext = TYPES[file.type as keyof typeof TYPES];
    if (!ext) return setError("Use a PNG, JPG or WebP image.");
    if (file.size > MAX_BYTES) return setError("That image is over 2 MB. Pick a smaller one.");
    setBusy(true);
    const supabase = createClient();
    // A new name each time, so the browser and CDN never show a stale cached logo.
    const path = `${folder}/${name}-${Date.now().toString(36)}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (uploadError) {
      console.error("logo upload:", uploadError.message);
      return setError(/size|large/i.test(uploadError.message) ? "That image is over 2 MB." : "Upload failed. Please try again.");
    }
    onChange(supabase.storage.from("logos").getPublicUrl(path).data.publicUrl);
  }

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex items-center gap-3.5 rounded-2xl bg-white/4 p-3 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.12)]",
          invalid && "shadow-[inset_0_0_0_1.5px_var(--destructive)]",
        )}
      >
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
          className={cn(
            "grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value ? "bg-white" : "border-[1.5px] border-dashed border-white/25 bg-white/6",
          )}
          aria-label={value ? `Replace ${label}` : `Upload ${label}`}
        >
          {busy ? (
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from our public bucket
            <img src={value} alt="" className="size-full object-contain" />
          ) : (
            <ImageUpIcon className="size-5 text-muted-foreground" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-sm font-semibold">
            {label}
          </label>
          <p className="text-xs text-muted-foreground">{busy ? "Uploading…" : value ? "Tap the logo to replace it" : hint}</p>
        </div>
        {camera && !disabled && (
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraInput.current?.click()}
            className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-3 text-xs font-semibold pointer-coarse:inline-flex"
          >
            <CameraIcon className="size-4" aria-hidden /> Take photo
          </button>
        )}
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/8 hover:text-foreground"
            aria-label={`Remove ${label}`}
          >
            <XIcon className="size-4" />
          </button>
        )}
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        {camera && (
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-label={`Take a photo for the ${label}`}
            disabled={disabled || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
