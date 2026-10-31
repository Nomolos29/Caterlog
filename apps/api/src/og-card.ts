import { formatNaira } from "@caterlog/commerce-core";

export interface OgProductCardInput {
  vendorName: string;
  isVerified: boolean;
  skuCode: string;
  productName: string;
  priceKobo: bigint;
  availableStock: number;
}

/**
 * Generates a Dynamic SVG OpenGraph Card (`/og/product/:sku`) rendered inside WhatsApp link previews.
 * Displays: Product Name, Price Tag (₦), Live Stock Badge ("🟢 4 Left in Stock" or "🔴 Sold Out"),
 * and Layer 2 Verified Seller Badge.
 */
export function renderDynamicProductOgSvg(input: OgProductCardInput): string {
  const priceText = formatNaira(input.priceKobo);
  const inStock = input.availableStock > 0;
  const stockText = inStock ? `${input.availableStock} Left in Stock` : "Sold Out";
  const stockColor = inStock ? "#10B981" : "#EF4444";
  const badgeText = input.isVerified ? "✓ Verified Caterlog Seller" : "Caterlog Seller";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0B0F19"/>
  <rect x="40" y="40" width="1120" height="550" rx="28" fill="#111827" stroke="#1F2937" stroke-width="3"/>
  
  <!-- Verified Badge -->
  <rect x="80" y="85" width="340" height="48" rx="24" fill="#064E3B"/>
  <text x="105" y="116" fill="#34D399" font-family="system-ui, sans-serif" font-size="22" font-weight="700">${escapeXml(badgeText)}</text>

  <!-- SKU Badge -->
  <rect x="440" y="85" width="160" height="48" rx="12" fill="#1F2937"/>
  <text x="468" y="116" fill="#9CA3AF" font-family="monospace" font-size="22" font-weight="700">${escapeXml(input.skuCode)}</text>

  <!-- Vendor Name -->
  <text x="80" y="195" fill="#9CA3AF" font-family="system-ui, sans-serif" font-size="28" font-weight="600">${escapeXml(input.vendorName.toUpperCase())}</text>

  <!-- Product Title -->
  <text x="80" y="275" fill="#F9FAFB" font-family="system-ui, sans-serif" font-size="54" font-weight="800">${escapeXml(input.productName)}</text>

  <!-- Price Tag -->
  <rect x="80" y="340" width="360" height="110" rx="20" fill="#10B981"/>
  <text x="115" y="412" fill="#052E16" font-family="system-ui, sans-serif" font-size="56" font-weight="900">${escapeXml(priceText)}</text>

  <!-- Live Inventory Status Pill -->
  <rect x="470" y="340" width="380" height="110" rx="20" fill="#1F2937" stroke="${stockColor}" stroke-width="3"/>
  <circle cx="525" cy="395" r="14" fill="${stockColor}"/>
  <text x="560" y="408" fill="#F9FAFB" font-family="system-ui, sans-serif" font-size="36" font-weight="700">${escapeXml(stockText)}</text>

  <!-- Footer CTA -->
  <text x="80" y="530" fill="#6EE7B7" font-family="system-ui, sans-serif" font-size="26" font-weight="600">Reply in WhatsApp for instant 10-digit transfer account • Powered by Caterlog</text>
</svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

