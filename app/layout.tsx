import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Space_Grotesk({
  variable: "--font-sans-stack",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DNA Codec Lab — GA-Optimized Genetic Storage",
  description:
    "An interactive molecular-storage simulator where a genetic algorithm evolves the DNA storage codec itself, and the fittest genome becomes the live encoder for your message.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: browser extensions (Grammarly et al.) inject
          attributes onto <body> before React hydrates. */}
      <body className="relative min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
