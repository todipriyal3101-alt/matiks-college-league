import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PanelStickers } from "@/components/stickers";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Decorative, wide screens only; must stay a direct child here so position: fixed isn't trapped. */}
      <PanelStickers panel="public" />
      <SiteHeader />
      <main className="rise-in mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <SiteFooter />
    </div>
  );
}
