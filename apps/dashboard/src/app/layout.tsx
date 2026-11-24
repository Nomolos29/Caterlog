import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caterlog — Vendor Command Dashboard",
  description:
    "WhatsApp-first commerce command center: orders, Monnify escrow reconciliation, catalog, shipping, discounts and live chat sync.",
};

const EXTENSION_ERROR_GUARD = `
(function () {
  if (typeof window === "undefined") return;
  function isExtensionError(msg, stack, filename) {
    var combined = ((msg || "") + " " + (stack || "") + " " + (filename || "")).toLowerCase();
    return (
      combined.indexOf("chrome-extension://") !== -1 ||
      combined.indexOf("moz-extension://") !== -1 ||
      combined.indexOf("metamask") !== -1 ||
      combined.indexOf("nkbihfbeogaeaoehlefnkodbefgpgknn") !== -1 ||
      combined.indexOf("inpage.js") !== -1
    );
  }
  window.addEventListener(
    "error",
    function (event) {
      var err = event && event.error;
      if (
        isExtensionError(
          event && event.message,
          err && err.stack,
          event && event.filename
        )
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
  window.addEventListener(
    "unhandledrejection",
    function (event) {
      var reason = event && event.reason;
      var msg = typeof reason === "string" ? reason : reason && reason.message;
      var stack = reason && reason.stack;
      if (isExtensionError(msg, stack, "")) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EXTENSION_ERROR_GUARD }} />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
