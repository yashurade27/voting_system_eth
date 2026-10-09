import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "SealedBallot — commit–reveal elections on Ethereum",
  description:
    "Run tamper-proof elections on Ethereum. Votes stay sealed as hashes until the reveal phase, then every ballot is counted in public.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceMono.variable} antialiased`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-ink/10 bg-card">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-sm text-graphite/70">
              <span className="label">SealedBallot · Blockchain mini project</span>
              <span>Solidity · Hardhat · Next.js · wagmi · viem</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
