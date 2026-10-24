import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Montserrat, Nunito_Sans, Space_Mono } from "next/font/google";

import { EarlyScript } from "@/components/early-script";
import { LiquidGlassFilter } from "@/components/glass";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

// Matiks fonts (CLAUDE.md rule 8), as on matiks.com: Montserrat UI, Nunito Sans paragraphs,
// Bebas Neue display headings, Space Mono numbers.
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });
// Not preloaded: paragraphs and numbers aren't needed for the first paint (they swap in when loaded).
const nunitoSans = Nunito_Sans({ variable: "--font-nunito-sans", subsets: ["latin"], preload: false });
const bebasNeue = Bebas_Neue({ variable: "--font-bebas-neue", subsets: ["latin"], weight: "400" });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Matiks College League",
    template: "%s · Matiks College League",
  },
  description:
    "Matiks' inter-college mind sports league. Register your college and compete.",
  openGraph: { type: "website", siteName: "Matiks College League", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a", // --background
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // <EarlyScript> adds class="refraction" on Chromium before hydration.
      suppressHydrationWarning
      className={`dark ${montserrat.variable} ${nunitoSans.variable} ${bebasNeue.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-clip">
        <EarlyScript />
        <LiquidGlassFilter />
        <TooltipProvider>{children}</TooltipProvider>
        {/* Lifted above the sticky "Unsaved changes · Save" bar so toasts never cover the Save button. */}
        <Toaster theme="dark" closeButton offset={{ bottom: 88 }} mobileOffset={{ bottom: 88 }} />
        <Analytics />
      </body>
    </html>
  );
}
