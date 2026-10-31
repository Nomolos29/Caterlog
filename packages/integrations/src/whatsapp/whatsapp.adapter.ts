import crypto from "node:crypto";
import type { MessagingChannelPort } from "@caterlog/commerce-core";

export interface WhatsAppCloudConfig {
  accessToken: string;
  defaultPhoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  sandboxMock: boolean;
}

export interface SentWhatsAppMessageLog {
  id: string;
  toPhone: string;
  text: string;
  vendorPhoneId: string;
  sentAt: Date;
}

/**
 * Meta WhatsApp Cloud API & Coexistence Adapter (Implements `MessagingChannelPort`).
 *
 * Key UX feature for Nigerian Mobile Banking:
 * When sending a Virtual Account invoice, it sends two sequential bubbles:
 * 1. The structured Invoice Summary with Verified Seller badge and countdown timer.
 * 2. A second bubble containing ONLY the 10-digit NUBAN (`8092341102`) for 1-tap copy-paste.
 */
export class WhatsAppCloudAdapter implements MessagingChannelPort {
  private readonly sandboxOutbox: SentWhatsAppMessageLog[] = [];
  private readonly config: WhatsAppCloudConfig;

  constructor(config: WhatsAppCloudConfig) {
    this.config = config;
  }

  /**
   * Verifies Meta's `x-hub-signature-256` header (`sha256=<hex>`).
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", this.config.appSecret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader.trim(), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  public getSandboxOutbox(): readonly SentWhatsAppMessageLog[] {
    return this.sandboxOutbox;
  }

  public clearSandboxOutbox(): void {
    this.sandboxOutbox.length = 0;
  }

  public async sendTextMessage(params: {
    toPhone: string;
    text: string;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    const phoneId = params.vendorPhoneId ?? this.config.defaultPhoneNumberId;

    if (this.config.sandboxMock) {
      this.sandboxOutbox.push({
        id: `wamid.mock.${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        toPhone: params.toPhone,
        text: params.text,
        vendorPhoneId: phoneId,
        sentAt: new Date(),
      });
      return;
    }

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.toPhone.replace(/\+/g, ""),
        type: "text",
        text: { preview_url: true, body: params.text },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`WhatsApp Cloud API send failed (${response.status}): ${errText}`);
    }
  }

  public async sendVirtualAccountInvoice(params: {
    toBuyerPhone: string;
    vendorBusinessName: string;
    isVendorVerified: boolean;
    orderShortCode: string;
    productSummary: string;
    totalAmountFormatted: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresInMinutes: number;
    vendorPhoneId?: string | null;
  }): Promise<void> {
    const trustBadge = params.isVendorVerified
      ? "✓ *Verified Caterlog Seller*"
      : "🏪 *Caterlog Seller*";

    const invoiceBubble = [
      `🧾 *Order Invoice ${params.orderShortCode}*`,
      `${params.vendorBusinessName} (${trustBadge})`,
      `────────────────────`,
      `📦 *Item:* ${params.productSummary}`,
      `💰 *Exact Amount:* *${params.totalAmountFormatted}*`,
      `🏦 *Bank:* ${params.bankName}`,
      `🔢 *Account No:* *${params.accountNumber}*`,
      `👤 *Account Name:* ${params.accountName}`,
      `⏳ *Stock Reserved For:* ${params.expiresInMinutes} mins`,
      `────────────────────`,
      `_Copy the account number in the next message to transfer. This chat will update automatically once your transfer clears!_`,
    ].join("\n");

    // 1. Send formatted Invoice Summary
    await this.sendTextMessage({
      toPhone: params.toBuyerPhone,
      text: invoiceBubble,
      vendorPhoneId: params.vendorPhoneId,
    });

    // 2. Immediately send a standalone bubble with ONLY the 10-digit NUBAN for 1-tap copy on mobile
    await this.sendTextMessage({
      toPhone: params.toBuyerPhone,
      text: params.accountNumber,
      vendorPhoneId: params.vendorPhoneId,
    });
  }
}

