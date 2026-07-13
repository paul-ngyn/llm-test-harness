import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Eval Harness",
  description: "Define test suites, run them against models, score the outputs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            ⚖️ LLM Eval Harness
          </Link>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
