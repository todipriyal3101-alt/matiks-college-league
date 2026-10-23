import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="fade-in mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
