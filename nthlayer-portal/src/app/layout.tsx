import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nth Layer — Strategic Signal Portal",
  description: "Structured operator judgement at scale",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
