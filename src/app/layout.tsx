import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Brand fonts (CLAUDE.md rule 8): Space Grotesk headings, Inter body, JetBrains Mono numbers.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Matiks College League",
    template: "%s · Matiks College League",
  },
  description:
    "Matiks' inter-college mind sports league. Register your college and compete.",
};

export const viewport: Viewport = {
  themeColor: "#0b0d16", // --background
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-clip">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" closeButton />
      </body>
    </html>
  );
}
