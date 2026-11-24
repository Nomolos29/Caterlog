import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caterlog Storefront & Brand Website",
  description: "Verified E-Commerce Storefront & Brand Website Powered by Caterlog",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
