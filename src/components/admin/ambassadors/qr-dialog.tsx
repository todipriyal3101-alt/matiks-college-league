"use client";

import { DownloadIcon } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { CopyButton } from "@/components/league/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Poster QR for an ambassador's link. Dark-on-white so it scans reliably when printed. */
export function QrDialog({ name, code, link, onClose }: { name: string; code: string; link: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: "M" }).then(setDataUrl);
  }, [link]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{name}&apos;s QR code</DialogTitle>
          <DialogDescription className="flex items-center gap-1 break-all">
            <span className="font-mono text-xs">{link}</span>
            <CopyButton value={link} label="link" />
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto aspect-square w-64 overflow-hidden rounded-lg bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL, nothing to optimise */}
          {dataUrl && <img src={dataUrl} alt={`QR code for ${link}`} className="size-full" />}
        </div>
        <Button asChild disabled={!dataUrl}>
          <a href={dataUrl ?? "#"} download={`matiks-${code}.png`}>
            <DownloadIcon /> Download PNG
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
