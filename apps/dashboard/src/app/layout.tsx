import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caterlog — Vendor Command Dashboard",
  description:
    "WhatsApp-first commerce command center: orders, Monnify escrow reconciliation, catalog, shipping, discounts and live chat sync.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
